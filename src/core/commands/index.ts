/**
 * Command system for redisX client
 *
 * Provides command registry, execution, and type-safe command implementations.
 * This module serves as the foundation for all Redis command execution.
 */

import type { CommandContext, CommandExecutor } from '../types';
import { BasicCommands, createBasicCommands } from './basic';
import type {
    PingResponse,
    EchoResponse,
    GetResponse,
    SetResponse,
    DelResponse,
    ExistsResponse,
    SetOptions,
    GetOptions,
} from './types';

/**
 * Command registry that manages available commands
 */
export class CommandRegistry {
    private _commands: Map<string, CommandExecutor> = new Map();
    private _basicCommands: BasicCommands;

    constructor() {
        this._basicCommands = createBasicCommands();
        this._registerBasicCommands();
    }

    /**
     * Register a command executor
     */
    register(name: string, executor: CommandExecutor): void {
        this._commands.set(name.toLowerCase(), executor);
    }

    /**
     * Get command executor by name
     */
    get(name: string): CommandExecutor | undefined {
        return this._commands.get(name.toLowerCase());
    }

    /**
     * Execute a command
     */
    async execute<T = unknown>(
        context: CommandContext,
        command: string,
        ...args: unknown[]
    ): Promise<T> {
        const executor = this.get(command);
        if (!executor) {
            throw new Error(`Unknown command: ${command}`);
        }

        return executor.execute<T>(context, command, ...args);
    }

    /**
     * Register basic commands
     */
    private _registerBasicCommands(): void {
        // Register individual basic commands
        this.register('ping', {
            execute: (context, command, ...args) => {
                const message = args[0] as string | undefined;
                return this._basicCommands.ping(context, message);
            },
        });

        this.register('echo', {
            execute: (context, command, ...args) => {
                const message = args[0] as string;
                return this._basicCommands.echo(context, message);
            },
        });

        this.register('get', {
            execute: (context, command, ...args) => {
                const key = args[0] as string;
                const options = args[1] as GetOptions | undefined;
                return this._basicCommands.get(context, key, options);
            },
        });

        this.register('set', {
            execute: (context, command, ...args) => {
                const key = args[0] as string;
                const value = args[1] as string;
                const options = args[2] as SetOptions | undefined;
                return this._basicCommands.set(context, key, value, options);
            },
        });

        this.register('del', {
            execute: (context, command, ...args) => {
                const keys = args as string[];
                return this._basicCommands.del(context, ...keys);
            },
        });

        this.register('exists', {
            execute: (context, command, ...args) => {
                const keys = args as string[];
                return this._basicCommands.exists(context, ...keys);
            },
        });
    }
}

/**
 * Commands API interface for the client
 */
export interface CommandsAPI {
    /**
     * Ping the Redis server
     * @param message Optional message to ping with
     * @returns PONG response or the message
     */
    ping(message?: string): Promise<PingResponse>;

    /**
     * Echo a message
     * @param message Message to echo
     * @returns The echoed message
     */
    echo(message: string): Promise<EchoResponse>;

    /**
     * Get a value by key
     * @param key Key to get
     * @param options Optional GET options
     * @returns Value or null if key doesn't exist
     */
    get(key: string, options?: GetOptions): Promise<GetResponse>;

    /**
     * Set a key-value pair
     * @param key Key to set
     * @param value Value to set
     * @param options Optional SET options
     * @returns 'OK' or old value if GET option is used
     */
    set(key: string, value: string, options?: SetOptions): Promise<SetResponse>;

    /**
     * Delete one or more keys
     * @param keys Keys to delete
     * @returns Number of keys deleted
     */
    del(...keys: string[]): Promise<DelResponse>;

    /**
     * Check if one or more keys exist
     * @param keys Keys to check
     * @returns Number of keys that exist
     */
    exists(...keys: string[]): Promise<ExistsResponse>;
}

/**
 * Create commands API implementation
 */
export function createCommandsAPI(context: CommandContext, registry: CommandRegistry): CommandsAPI {
    return {
        async ping(message?: string): Promise<PingResponse> {
            return registry.execute<PingResponse>(context, 'ping', message);
        },

        async echo(message: string): Promise<EchoResponse> {
            return registry.execute<EchoResponse>(context, 'echo', message);
        },

        async get(key: string, options?: GetOptions): Promise<GetResponse> {
            return registry.execute<GetResponse>(context, 'get', key, options);
        },

        async set(key: string, value: string, options?: SetOptions): Promise<SetResponse> {
            return registry.execute<SetResponse>(context, 'set', key, value, options);
        },

        async del(...keys: string[]): Promise<DelResponse> {
            return registry.execute<DelResponse>(context, 'del', ...keys);
        },

        async exists(...keys: string[]): Promise<ExistsResponse> {
            return registry.execute<ExistsResponse>(context, 'exists', ...keys);
        },
    };
}

/**
 * Create command registry instance
 */
export function createCommandRegistry(): CommandRegistry {
    return new CommandRegistry();
}

// Re-export types for convenience
export type {
    SetOptions,
    GetOptions,
    PingResponse,
    EchoResponse,
    GetResponse,
    SetResponse,
    DelResponse,
    ExistsResponse,
} from './types';
