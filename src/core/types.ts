/**
 * Core type definitions for redisX client
 *
 * Provides the foundational types for client configuration, connection state,
 * command execution, and result handling.
 */

import type { Resp3 } from '../parser_writer';

/**
 * Client configuration options
 */
export interface ClientOptions {
    /** Redis server URL (redis://user:pass@host:port) */
    url?: string;
    /** Redis server hostname (default: localhost) */
    host?: string;
    /** Redis server port (default: 6379) */
    port?: number;
    /** Username for authentication */
    username?: string;
    /** Password for authentication */
    password?: string;
    /** Client name to identify this connection */
    clientName?: string;
    /** Whether to auto-connect on first command (default: true) */
    autoConnect?: boolean;
    /** Connection timeout in milliseconds (default: 5000) */
    connectTimeout?: number;
    /** Command timeout in milliseconds (default: 5000) */
    commandTimeout?: number;
    /** Database number to select (default: 0) */
    database?: number;
}

/**
 * Required client options with defaults applied
 */
export type RequiredClientOptions = Required<ClientOptions>;

/**
 * Client connection states
 */
export type ClientState = 'disconnected' | 'connecting' | 'connected' | 'disconnecting' | 'error';

/**
 * Connection information and metadata
 */
export interface ConnectionInfo {
    /** Remote address in "host:port" format */
    readonly address: string;
    /** Connection state */
    readonly state: ClientState;
    /** Whether connection is established and ready for commands */
    readonly isConnected: boolean;
    /** Client name if set */
    readonly clientName?: string;
    /** Database number */
    readonly database: number;
    /** Connection timestamp */
    readonly connectedAt?: Date;
}

/**
 * Generic command result wrapper
 */
export interface CommandResult<T = unknown> {
    /** The command result value */
    readonly value: T;
    /** Command execution time in milliseconds */
    readonly duration: number;
    /** Timestamp when command was executed */
    readonly timestamp: Date;
    /** Command that was executed */
    readonly command: string;
    /** Command arguments */
    readonly args: unknown[];
}

/**
 * Pending command information
 */
export interface PendingCommand {
    /** Unique command ID */
    readonly id: string;
    /** Command name */
    readonly command: string;
    /** Command arguments */
    readonly args: unknown[];
    /** Promise resolve function */
    readonly resolve: (value: unknown) => void;
    /** Promise reject function */
    readonly reject: (error: Error) => void;
    /** Command timeout handle */
    readonly timeout?: NodeJS.Timeout;
    /** Timestamp when command was sent */
    readonly sentAt: Date;
}

/**
 * Client events
 */
export interface ClientEvents {
    /** Emitted when connection is established */
    connect: (info: ConnectionInfo) => void;
    /** Emitted when connection is closed */
    disconnect: (reason?: string) => void;
    /** Emitted when an error occurs */
    error: (error: Error) => void;
    /** Emitted when a command starts executing */
    'command:start': (command: string, args: unknown[]) => void;
    /** Emitted when a command completes */
    'command:end': (result: CommandResult) => void;
    /** Emitted when a command fails */
    'command:error': (command: string, error: Error) => void;
    /** Emitted when connection state changes */
    'state:change': (oldState: ClientState, newState: ClientState) => void;
}

/**
 * Connection manager events
 */
export interface ConnectionManagerEvents {
    /** Emitted when connection is established */
    connect: (info: ConnectionInfo) => void;
    /** Emitted when connection is closed */
    disconnect: (reason?: string) => void;
    /** Emitted when an error occurs */
    error: (error: Error) => void;
    /** Emitted when RESP3 push message is received */
    push: (data: Resp3) => void;
    /** Emitted when connection state changes */
    'state:change': (oldState: ClientState, newState: ClientState) => void;
}

/**
 * Command execution context
 */
export interface CommandContext {
    /** The client instance */
    readonly client: any; // Will be typed properly in client.ts
    /** Connection manager */
    readonly connection: any; // Will be typed properly in connection.ts
    /** Command timeout */
    readonly timeout: number;
}

/**
 * Command executor interface
 */
export interface CommandExecutor {
    /**
     * Execute a command with the given context
     */
    execute<T>(context: CommandContext, command: string, ...args: unknown[]): Promise<T>;
}

/**
 * Response transformer function
 */
export type ResponseTransformer<T = unknown> = (resp3: Resp3) => T;

/**
 * Command metadata
 */
export interface CommandMetadata {
    /** Command name */
    readonly name: string;
    /** Minimum number of arguments */
    readonly minArgs: number;
    /** Maximum number of arguments (undefined for unlimited) */
    readonly maxArgs?: number;
    /** Key positions (0-based indices) */
    readonly keyPositions: number[];
    /** Response transformer */
    readonly transform?: ResponseTransformer;
    /** Whether command is read-only */
    readonly readOnly: boolean;
    /** Whether command can be executed on disconnected client */
    readonly allowDisconnected: boolean;
}

/**
 * Default client options
 */
export const DEFAULT_CLIENT_OPTIONS: RequiredClientOptions = {
    url: '',
    host: 'localhost',
    port: 6379,
    username: '',
    password: '',
    clientName: '',
    autoConnect: true,
    connectTimeout: 5000,
    commandTimeout: 5000,
    database: 0,
} as const;
