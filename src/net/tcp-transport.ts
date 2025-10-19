import { EventEmitter } from 'events';
import { Socket } from 'net';
import { ConnectionError, NetErrorCodes, TimeoutError, WriteError } from './errors';
import type { ITransport, TransportOptions, TransportState } from './transport';

/**
 * TCP transport implementation using Node.js net.Socket
 *
 * Provides reliable TCP connectivity with backpressure handling,
 * connection lifecycle management, and typed error reporting.
 */
export class TcpTransport extends EventEmitter implements ITransport {
    private _socket: Socket | null = null;
    private _state: TransportState = 'disconnected';
    private _writeQueue: Buffer[] = [];
    private _isWriting = false;
    private _connectTimeout: NodeJS.Timeout | null = null;
    private _connectPromise: Promise<void> | null = null;

    constructor(public readonly options: Readonly<TransportOptions>) {
        super();
    }

    get state(): TransportState {
        return this._state;
    }

    get address(): string {
        return `${this.options.host}:${this.options.port}`;
    }

    async connect(): Promise<void> {
        if (this._state === 'connected') {
            throw new ConnectionError('Already connected', NetErrorCodes.ALREADY_CONNECTED);
        }

        if (this._state === 'connecting') {
            return this._connectPromise!;
        }

        this._state = 'connecting';
        this._connectPromise = this._performConnect();
        return this._connectPromise;
    }

    private async _performConnect(): Promise<void> {
        return new Promise((resolve, reject) => {
            const socket = new Socket();
            this._socket = socket;

            // Set up connection timeout
            const timeoutMs = this.options.connectTimeout ?? 5000;
            this._connectTimeout = setTimeout(() => {
                socket.destroy();
                const error = new TimeoutError(
                    `Connection timeout after ${timeoutMs}ms`,
                    NetErrorCodes.CONNECTION_TIMEOUT,
                    timeoutMs,
                );
                this._handleError(error);
                reject(error);
            }, timeoutMs);

            // Handle successful connection
            socket.once('connect', () => {
                this._clearConnectTimeout();
                this._state = 'connected';
                this._setupSocketHandlers();
                this.emit('connect');
                resolve();
            });

            // Handle connection errors
            socket.once('error', err => {
                this._clearConnectTimeout();
                const error = this._mapSocketError(err);
                this._handleError(error);
                reject(error);
            });

            // Connect to remote host
            socket.connect(this.options.port, this.options.host);
        });
    }

    private _clearConnectTimeout(): void {
        if (this._connectTimeout) {
            clearTimeout(this._connectTimeout);
            this._connectTimeout = null;
        }
    }

    private _setupSocketHandlers(): void {
        if (!this._socket) return;

        // Handle incoming data
        this._socket.on('data', (chunk: Buffer) => {
            this.emit('data', {
                data: chunk,
                timestamp: Date.now(),
            });
        });

        // Handle socket close
        this._socket.on('close', (hadError: boolean) => {
            const previousState = this._state;
            this._state = 'closed';
            this.emit('close');

            if (hadError && previousState === 'connected') {
                const error = new ConnectionError(
                    'Connection closed unexpectedly',
                    NetErrorCodes.CONNECTION_CLOSED,
                );
                this._handleError(error);
            }
        });

        // Handle socket errors
        this._socket.on('error', err => {
            const error = this._mapSocketError(err);
            this._handleError(error);
        });

        // Handle write backpressure
        this._socket.on('drain', () => {
            this.emit('drain');
            this._processWriteQueue();
        });
    }

    async write(data: Buffer): Promise<void> {
        if (this._state !== 'connected') {
            throw new WriteError(
                `Cannot write in state: ${this._state}`,
                NetErrorCodes.INVALID_STATE,
                0,
                data.length,
            );
        }

        if (!this._socket) {
            throw new WriteError(
                'Socket not available',
                NetErrorCodes.NOT_CONNECTED,
                0,
                data.length,
            );
        }

        // Add to write queue
        this._writeQueue.push(data);

        // Process queue if not already writing
        if (!this._isWriting) {
            this._processWriteQueue();
        }
    }

    private _processWriteQueue(): void {
        if (!this._socket || this._isWriting || this._writeQueue.length === 0) {
            return;
        }

        this._isWriting = true;

        while (this._writeQueue.length > 0) {
            const data = this._writeQueue.shift()!;
            const success = this._socket.write(data);

            if (!success) {
                // Socket is backpressured, wait for 'drain' event
                this._writeQueue.unshift(data); // Put back at front
                this._isWriting = false;
                return;
            }
        }

        this._isWriting = false;
    }

    async close(): Promise<void> {
        if (this._state === 'closed' || this._state === 'disconnected') {
            return;
        }

        this._state = 'closing';
        this._clearConnectTimeout();

        if (this._socket) {
            return new Promise(resolve => {
                this._socket!.on('close', () => {
                    this._state = 'closed';
                    resolve();
                });

                this._socket!.end();
            });
        }

        this._state = 'closed';
    }

    private _mapSocketError(err: Error): ConnectionError | WriteError {
        const message = err.message;
        const code = (err as any).code as string;

        // Map common Node.js socket error codes
        switch (code) {
            case 'ECONNREFUSED':
                return new ConnectionError(
                    `Connection refused: ${message}`,
                    NetErrorCodes.CONNECTION_REFUSED,
                    err,
                );
            case 'ECONNRESET':
                return new ConnectionError(
                    `Connection reset: ${message}`,
                    NetErrorCodes.CONNECTION_RESET,
                    err,
                );
            case 'ETIMEDOUT':
                return new TimeoutError(
                    `Connection timeout: ${message}`,
                    NetErrorCodes.CONNECTION_TIMEOUT,
                    0,
                    err,
                );
            case 'ENOTFOUND':
                return new ConnectionError(
                    `Host not found: ${message}`,
                    NetErrorCodes.CONNECTION_REFUSED,
                    err,
                );
            default:
                return new ConnectionError(
                    `Socket error: ${message}`,
                    NetErrorCodes.UNKNOWN_ERROR,
                    err,
                );
        }
    }

    private _handleError(error: Error): void {
        this.emit('error', {
            error,
            code: (error as any).code || NetErrorCodes.UNKNOWN_ERROR,
            timestamp: Date.now(),
        });
    }
}
