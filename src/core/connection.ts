/**
 * Connection manager for redisX client
 *
 * Integrates transport layer (net) with protocol layer (parser_writer) to provide
 * a unified connection interface with command/response correlation, lifecycle
 * management, and event handling.
 */

import { EventEmitter } from 'events';
import { TcpTransport, type ITransport, type TransportOptions } from '../net';
import { Resp3Parser, Resp3Writer, type ParserOptions, type Resp3 } from '../parser_writer';
import { ConnectionRequiredError, CommandTimeoutError, ParseError, TransformError } from './errors';
import type {
    ClientState,
    ConnectionInfo,
    PendingCommand,
    ConnectionManagerEvents,
    RequiredClientOptions,
} from './types';

/**
 * Connection manager that orchestrates transport and protocol layers
 */
export class ConnectionManager extends EventEmitter {
    private _transport: ITransport | null = null;
    private _parser: Resp3Parser | null = null;
    private _writer: Resp3Writer | null = null;
    private _state: ClientState = 'disconnected';
    private _pendingCommands: Map<string, PendingCommand> = new Map();
    private _commandIdCounter = 0;
    private _options: RequiredClientOptions;
    private _connectionInfo: ConnectionInfo;
    private _isHandshakeComplete = false;

    constructor(options: RequiredClientOptions) {
        super();
        this._options = options;
        this._connectionInfo = this._createConnectionInfo();
    }
    /**
     * Current connection state
     */
    get state(): ClientState {
        return this._state;
    }

    /**
     * Connection information
     */
    get info(): ConnectionInfo {
        return this._connectionInfo;
    }

    /**
     * Whether connection is established and ready for commands
     */
    get isConnected(): boolean {
        return this._state === 'connected' && this._isHandshakeComplete;
    }

    /**
     * Number of pending commands
     */
    get pendingCommandCount(): number {
        return this._pendingCommands.size;
    }

    /**
     * Establish connection to Redis server
     */
    async connect(): Promise<void> {
        if (this._state === 'connected' || this._state === 'connecting') {
            return;
        }

        this._setState('connecting');

        try {
            // Create transport
            const transportOptions: TransportOptions = {
                host: this._options.host,
                port: this._options.port,
                connectTimeout: this._options.connectTimeout,
            };

            this._transport = new TcpTransport(transportOptions);
            this._setupTransportHandlers();

            // Create parser and writer
            this._parser = new Resp3Parser({
                onReply: this._handleReply.bind(this),
                onPush: this._handlePush.bind(this),
                onError: this._handleParseError.bind(this),
            });
            this._writer = new Resp3Writer();

            // Connect transport
            await this._transport.connect();
            this._setState('connected');

            // Perform RESP3 handshake
            await this._performHandshake();

            this._isHandshakeComplete = true;
            this._updateConnectionInfo();
            this.emit('connect', this._connectionInfo);
        } catch (error) {
            this._setState('error');
            this.emit('error', error as Error);
            throw error;
        }
    }

    /**
     * Close connection to Redis server
     */
    async disconnect(): Promise<void> {
        if (this._state === 'disconnected' || this._state === 'disconnecting') {
            return;
        }

        this._setState('disconnecting');

        try {
            // Reject all pending commands
            for (const [_id, pending] of this._pendingCommands) {
                pending.reject(new ConnectionRequiredError('DISCONNECT', 'disconnecting'));
                if (pending.timeout) {
                    clearTimeout(pending.timeout);
                }
            }
            this._pendingCommands.clear();

            // Close transport
            if (this._transport) {
                await this._transport.close();
                this._transport = null;
            }

            // Clean up parser and writer
            this._parser = null;
            this._writer = null;
            this._isHandshakeComplete = false;

            this._setState('disconnected');
            this._updateConnectionInfo();
            this.emit('disconnect', 'Client disconnect');
        } catch (error) {
            this._setState('error');
            this.emit('error', error as Error);
            throw error;
        }
    }

    /**
     * Send a command to Redis and return the response
     */
    async sendCommand<T = unknown>(command: string, ...args: unknown[]): Promise<T> {
        if (!this.isConnected) {
            throw new ConnectionRequiredError(command, this._state);
        }

        if (!this._transport || !this._writer) {
            throw new ConnectionRequiredError(command, this._state);
        }

        const commandId = this._generateCommandId();
        const startTime = Date.now();

        return new Promise<T>((resolve, reject) => {
            // Set up command timeout
            const timeout = setTimeout(() => {
                this._pendingCommands.delete(commandId);
                reject(new CommandTimeoutError(command, this._options.commandTimeout, args));
            }, this._options.commandTimeout);

            // Store pending command
            const pending: PendingCommand = {
                id: commandId,
                command,
                args,
                resolve: (value: unknown) => {
                    clearTimeout(timeout);
                    this._pendingCommands.delete(commandId);
                    const duration = Date.now() - startTime;
                    const result = {
                        value: value as T,
                        duration,
                        timestamp: new Date(startTime),
                        command,
                        args,
                    };
                    this.emit('command:end' as keyof ConnectionManagerEvents, result as any);
                    resolve(value as T);
                },
                reject: (error: Error) => {
                    clearTimeout(timeout);
                    this._pendingCommands.delete(commandId);
                    this.emit(
                        'command:error' as keyof ConnectionManagerEvents,
                        command as any,
                        error as any,
                    );
                    reject(error);
                },
                timeout,
                sentAt: new Date(startTime),
            };

            this._pendingCommands.set(commandId, pending);

            try {
                // Encode and send command
                const commandBuffer = this._writer!.encodeCommand(command, ...(args as string[]));
                this._transport!.write(commandBuffer as any);

                this.emit(
                    'command:start' as keyof ConnectionManagerEvents,
                    command as any,
                    args as any,
                );
            } catch (error) {
                pending.reject(error as Error);
            }
        });
    }

    /**
     * Set up transport event handlers
     */
    private _setupTransportHandlers(): void {
        if (!this._transport) return;

        this._transport.on('data', event => {
            if (this._parser) {
                this._parser.feed(event.data);
            }
        });

        this._transport.on('error', event => {
            this.emit('error', event.error);
        });

        this._transport.on('close', () => {
            this._setState('disconnected');
            this._updateConnectionInfo();
            this.emit('disconnect', 'Transport closed');
        });
    }

    /**
     * Handle RESP3 reply from parser
     */
    private _handleReply(resp3: Resp3): void {
        // Get the next pending command (FIFO order)
        const [_commandId, pending] = this._pendingCommands.entries().next().value as [
            string,
            PendingCommand,
        ];
        if (!pending) {
            this.emit('error', new Error('Received reply without pending command'));
            return;
        }

        try {
            // Transform RESP3 to appropriate TypeScript type
            const transformed = this._transformResponse(resp3, pending.command);
            pending.resolve(transformed);
        } catch (error) {
            pending.reject(error as Error);
        }
    }

    /**
     * Handle RESP3 push message from parser
     */
    private _handlePush(push: Resp3): void {
        this.emit('push', push);
    }

    /**
     * Handle parser errors
     */
    private _handleParseError(error: Error): void {
        this.emit('error', new ParseError(error.message, Buffer.alloc(0), 0, error));
    }

    /**
     * Transform RESP3 response to TypeScript type
     */
    private _transformResponse(resp3: Resp3, command: string): unknown {
        try {
            switch (resp3.__type) {
                case 'simple_string':
                    return resp3.value;
                case 'error':
                    throw new Error(`${resp3.code || 'ERROR'}: ${resp3.message}`);
                case 'integer':
                    return Number(resp3.value);
                case 'double':
                    return resp3.value;
                case 'big_number':
                    return typeof resp3.value === 'bigint' ? Number(resp3.value) : resp3.value;
                case 'boolean':
                    return resp3.value;
                case 'null':
                    return null;
                case 'blob_string':
                    return resp3.value?.toString('utf8') || null;
                case 'blob_error':
                    throw new Error(`${resp3.code || 'ERROR'}: ${resp3.message}`);
                case 'verbatim_string':
                    return resp3.value;
                case 'array':
                    return resp3.value;
                case 'map':
                    return resp3.value;
                case 'set':
                    return resp3.value;
                case 'push':
                    return resp3.value;
                default:
                    return resp3;
            }
        } catch (error) {
            throw new TransformError(command, 'unknown', resp3, error as Error);
        }
    }

    /**
     * Perform RESP3 handshake
     */
    private async _performHandshake(): Promise<void> {
        if (!this._transport || !this._writer) {
            throw new Error('Transport or writer not available for handshake');
        }

        // Send HELLO 3 command
        const helloBuffer = this._writer.encodeCommand('HELLO', '3');
        await this._transport.write(helloBuffer);

        // Wait for handshake response (simple string "OK")
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Handshake timeout'));
            }, this._options.connectTimeout);

            const originalOnReply = this._parser!.opts.onReply;
            this._parser!.opts.onReply = (resp3: Resp3) => {
                clearTimeout(timeout);
                this._parser!.opts.onReply = originalOnReply as (value: Resp3) => void;
                if (resp3.__type === 'simple_string' && resp3.value === 'OK') {
                    resolve();
                } else {
                    reject(new Error(`Unexpected handshake response: ${JSON.stringify(resp3)}`));
                }
            };
        });
    }

    /**
     * Generate unique command ID
     */
    private _generateCommandId(): string {
        return `cmd_${++this._commandIdCounter}_${Date.now()}`;
    }

    /**
     * Set connection state and emit change event
     */
    private _setState(newState: ClientState): void {
        const oldState = this._state;
        this._state = newState;
        this._updateConnectionInfo();
        this.emit('state:change', oldState, newState);
    }

    /**
     * Update connection info
     */
    private _updateConnectionInfo(): void {
        this._connectionInfo = this._createConnectionInfo();
    }

    /**
     * Create connection info object
     */
    private _createConnectionInfo(): ConnectionInfo {
        return {
            address: this._transport
                ? this._transport.address
                : `${this._options.host}:${this._options.port}`,
            state: this._state,
            isConnected: this.isConnected,
            clientName: this._options.clientName || '',
            database: this._options.database,
            connectedAt: this._state === 'connected' ? new Date() : new Date(0), // eslint-disable-line no-mixed-spaces-and-tabs
        };
    }

    // Event emitter type definitions
    on<K extends keyof ConnectionManagerEvents>(
        event: K,
        listener: ConnectionManagerEvents[K],
    ): this;
    on(event: string, listener: (...args: any[]) => void): this {
        return super.on(event, listener);
    }

    emit<K extends keyof ConnectionManagerEvents>(
        event: K,
        ...args: Parameters<ConnectionManagerEvents[K]>
    ): boolean;
    emit(event: string, ...args: any[]): boolean {
        return super.emit(event, ...args);
    }
}
