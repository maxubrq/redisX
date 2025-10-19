/**
 * Main Redis client implementation
 *
 * Provides the primary interface for interacting with Redis servers,
 * integrating connection management, command execution, and event handling.
 */

import { EventEmitter } from 'events';
import { ConnectionManager } from './connection';
import { createCommandRegistry, createCommandsAPI, type CommandsAPI } from './commands';
import { ConnectionRequiredError, InvalidStateError, ConfigurationError } from './errors';
import type {
    ClientOptions,
    RequiredClientOptions,
    ClientState,
    ConnectionInfo,
    ClientEvents,
    CommandContext,
} from './types';
import { DEFAULT_CLIENT_OPTIONS } from './types';

/**
 * Connection API interface
 */
export interface ConnectionAPI {
    /**
     * Connect to Redis server
     */
    connect(): Promise<void>;

    /**
     * Disconnect from Redis server
     */
    disconnect(): Promise<void>;

    /**
     * Current connection state
     */
    readonly state: ClientState;

    /**
     * Connection information
     */
    readonly info: ConnectionInfo;
}

/**
 * Main Redis client class
 */
export class RedisClient extends EventEmitter {
    private _connectionManager: ConnectionManager;
    private _commandRegistry: ReturnType<typeof createCommandRegistry>;
    private _options: RequiredClientOptions;
    private _commands!: CommandsAPI;
    private _connection!: ConnectionAPI;
    private _isInitialized = false;

    constructor(options: ClientOptions = {}) {
        super();
        this._options = this._normalizeOptions(options);
        this._connectionManager = new ConnectionManager(this._options);
        this._commandRegistry = createCommandRegistry();
        this._setupEventHandlers();
        this._initializeAPIs();
    }

    /**
     * Commands API for executing Redis commands
     */
    get commands(): CommandsAPI {
        this._ensureInitialized();
        return this._commands;
    }

    /**
     * Connection API for managing connection
     */
    get connection(): ConnectionAPI {
        this._ensureInitialized();
        return this._connection;
    }

    /**
     * Current connection state
     */
    get state(): ClientState {
        return this._connectionManager.state;
    }

    /**
     * Connection information
     */
    get info(): ConnectionInfo {
        return this._connectionManager.info;
    }

    /**
     * Whether client is connected and ready for commands
     */
    get isConnected(): boolean {
        return this._connectionManager.isConnected;
    }

    /**
     * Client options
     */
    get options(): Readonly<RequiredClientOptions> {
        return this._options;
    }

    /**
     * Connect to Redis server
     */
    async connect(): Promise<void> {
        this._ensureInitialized();
        await this._connectionManager.connect();
    }

    /**
     * Disconnect from Redis server
     */
    async disconnect(): Promise<void> {
        this._ensureInitialized();
        await this._connectionManager.disconnect();
    }

    /**
     * Send a generic command to Redis
     * @param command Command name
     * @param args Command arguments
     * @returns Command result
     */
    async send<T = unknown>(command: string, ...args: unknown[]): Promise<T> {
        this._ensureInitialized();

        // Auto-connect if enabled and not connected
        if (this._options.autoConnect && !this.isConnected) {
            await this.connect();
        }

        if (!this.isConnected) {
            throw new ConnectionRequiredError(command, this.state);
        }

        const context: CommandContext = {
            client: this,
            connection: this._connectionManager,
            timeout: this._options.commandTimeout,
        };

        return this._commandRegistry.execute<T>(context, command, ...args);
    }

    /**
     * Set up event handlers
     */
    private _setupEventHandlers(): void {
        this._connectionManager.on('connect', info => {
            this.emit('connect', info);
        });

        this._connectionManager.on('disconnect', reason => {
            this.emit('disconnect', reason);
        });

        this._connectionManager.on('error', error => {
            this.emit('error', error);
        });

        this._connectionManager.on('push', data => {
            this.emit('push' as keyof ClientEvents, data as any);
        });

        this._connectionManager.on('state:change', (oldState, newState) => {
            this.emit('state:change', oldState, newState);
        });
    }

    /**
     * Initialize APIs
     */
    private _initializeAPIs(): void {
        const context: CommandContext = {
            client: this,
            connection: this._connectionManager,
            timeout: this._options.commandTimeout,
        };

        this._commands = createCommandsAPI(context, this._commandRegistry);
        this._connection = this._createConnectionAPI();
        this._isInitialized = true;
    }

    /**
     * Create connection API
     */
    private _createConnectionAPI(): ConnectionAPI {
        const self = this;
        return {
            connect: () => self.connect(),
            disconnect: () => self.disconnect(),
            get state() {
                return self._connectionManager.state;
            },
            get info() {
                return self._connectionManager.info;
            },
        };
    }

    /**
     * Normalize and validate client options
     */
    private _normalizeOptions(options: ClientOptions): RequiredClientOptions {
        const normalized = { ...DEFAULT_CLIENT_OPTIONS, ...options };

        // Parse URL if provided
        if (normalized.url) {
            const parsed = this._parseUrl(normalized.url);
            Object.assign(normalized, parsed);
        }

        // Validate options
        this._validateOptions(normalized);

        return normalized;
    }

    /**
     * Parse Redis URL
     */
    private _parseUrl(url: string): Partial<RequiredClientOptions> {
        try {
            const parsed = new URL(url);
            if (parsed.protocol !== 'redis:' && parsed.protocol !== 'rediss:') {
                throw new Error('Invalid protocol. Expected redis: or rediss:');
            }

            return {
                host: parsed.hostname,
                port: parsed.port ? parseInt(parsed.port, 10) : 6379,
                username: parsed.username || '',
                password: parsed.password || '',
                database: parsed.pathname ? parseInt(parsed.pathname.slice(1), 10) : 0,
            };
        } catch (error) {
            throw new ConfigurationError(`Invalid Redis URL: ${error}`, 'url', url);
        }
    }

    /**
     * Validate client options
     */
    private _validateOptions(options: RequiredClientOptions): void {
        if (options.port < 1 || options.port > 65535) {
            throw new ConfigurationError('Port must be between 1 and 65535', 'port', options.port);
        }

        if (options.connectTimeout < 0) {
            throw new ConfigurationError(
                'Connect timeout must be non-negative',
                'connectTimeout',
                options.connectTimeout,
            );
        }

        if (options.commandTimeout < 0) {
            throw new ConfigurationError(
                'Command timeout must be non-negative',
                'commandTimeout',
                options.commandTimeout,
            );
        }

        if (options.database < 0) {
            throw new ConfigurationError(
                'Database must be non-negative',
                'database',
                options.database,
            );
        }
    }

    /**
     * Ensure client is initialized
     */
    private _ensureInitialized(): void {
        if (!this._isInitialized) {
            throw new InvalidStateError('Client not initialized', this.state, [
                'connected',
                'disconnected',
            ]);
        }
    }

    // Event emitter type definitions
    on<K extends keyof ClientEvents>(event: K, listener: ClientEvents[K]): this;
    on(event: string, listener: (...args: any[]) => void): this {
        return super.on(event, listener);
    }

    emit<K extends keyof ClientEvents>(event: K, ...args: Parameters<ClientEvents[K]>): boolean;
    emit(event: string, ...args: any[]): boolean {
        return super.emit(event, ...args);
    }
}

/**
 * Create a new Redis client
 * @param options Client configuration options
 * @returns Promise that resolves to a connected Redis client
 */
export async function createClient(options?: ClientOptions): Promise<RedisClient> {
    const client = new RedisClient(options);

    // Auto-connect if enabled
    if (client.options.autoConnect) {
        await client.connect();
    }

    return client;
}
