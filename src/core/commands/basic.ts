/**
 * Basic Redis commands implementation
 *
 * Provides typed implementations for fundamental Redis commands with
 * proper argument validation, response transformation, and error handling.
 */

import type { CommandContext, CommandExecutor } from '../types';
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
 * Basic commands implementation
 */
export class BasicCommands implements CommandExecutor {
    /**
     * Execute PING command
     * @param context Command execution context
     * @param message Optional message to ping with
     * @returns PONG response or the message
     */
    async ping(context: CommandContext, message?: string): Promise<PingResponse> {
        const args = message ? [message] : [];
        return context.connection.sendCommand('PING', ...args) as Promise<PingResponse>;
    }

    /**
     * Execute ECHO command
     * @param context Command execution context
     * @param message Message to echo
     * @returns The echoed message
     */
    async echo(context: CommandContext, message: string): Promise<EchoResponse> {
        return context.connection.sendCommand('ECHO', message) as Promise<EchoResponse>;
    }

    /**
     * Execute GET command
     * @param context Command execution context
     * @param key Key to get
     * @param options Optional GET options
     * @returns Value or null if key doesn't exist
     */
    async get(context: CommandContext, key: string, _options?: GetOptions): Promise<GetResponse> {
        // For now, we don't support GET options in basic implementation
        // This would be extended for GET with additional flags
        return context.connection.sendCommand('GET', key) as Promise<GetResponse>;
    }

    /**
     * Execute SET command
     * @param context Command execution context
     * @param key Key to set
     * @param value Value to set
     * @param options Optional SET options
     * @returns 'OK' or old value if GET option is used
     */
    async set(
        context: CommandContext,
        key: string,
        value: string,
        options?: SetOptions,
    ): Promise<SetResponse> {
        const args = this._buildSetArgs(key, value, options);
        return context.connection.sendCommand('SET', ...args) as Promise<SetResponse>;
    }

    /**
     * Execute DEL command
     * @param context Command execution context
     * @param keys Keys to delete
     * @returns Number of keys deleted
     */
    async del(context: CommandContext, ...keys: string[]): Promise<DelResponse> {
        if (keys.length === 0) {
            throw new Error('DEL requires at least one key');
        }
        return context.connection.sendCommand('DEL', ...keys) as Promise<DelResponse>;
    }

    /**
     * Execute EXISTS command
     * @param context Command execution context
     * @param keys Keys to check existence
     * @returns Number of keys that exist
     */
    async exists(context: CommandContext, ...keys: string[]): Promise<ExistsResponse> {
        if (keys.length === 0) {
            throw new Error('EXISTS requires at least one key');
        }
        return context.connection.sendCommand('EXISTS', ...keys) as Promise<ExistsResponse>;
    }

    /**
     * Generic command executor
     * @param context Command execution context
     * @param command Command name
     * @param args Command arguments
     * @returns Command result
     */
    async execute<T = unknown>(
        context: CommandContext,
        command: string,
        ...args: unknown[]
    ): Promise<T> {
        return context.connection.sendCommand(command, ...args) as Promise<T>;
    }

    /**
     * Build SET command arguments from options
     */
    private _buildSetArgs(key: string, value: string, options?: SetOptions): string[] {
        const args: string[] = [key, value];

        if (options) {
            if (options.EX !== undefined) {
                args.push('EX', options.EX.toString());
            }
            if (options.PX !== undefined) {
                args.push('PX', options.PX.toString());
            }
            if (options.EXAT !== undefined) {
                args.push('EXAT', options.EXAT.toString());
            }
            if (options.PXAT !== undefined) {
                args.push('PXAT', options.PXAT.toString());
            }
            if (options.NX) {
                args.push('NX');
            }
            if (options.XX) {
                args.push('XX');
            }
            if (options.KEEPTTL) {
                args.push('KEEPTTL');
            }
            if (options.GET) {
                args.push('GET');
            }
        }

        return args;
    }
}

/**
 * Create basic commands instance
 */
export function createBasicCommands(): BasicCommands {
    return new BasicCommands();
}
