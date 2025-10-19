/**
 * Command type definitions and metadata
 *
 * Provides type definitions for Redis commands, their arguments, responses,
 * and metadata for type-safe command execution.
 */

import type { Resp3 } from '../../parser_writer';
import type { ResponseTransformer, CommandMetadata } from '../types';

/**
 * Options for SET command
 */
export interface SetOptions {
    /** Set expiry time in seconds */
    EX?: number;
    /** Set expiry time in milliseconds */
    PX?: number;
    /** Set expiry time as Unix timestamp in seconds */
    EXAT?: number;
    /** Set expiry time as Unix timestamp in milliseconds */
    PXAT?: number;
    /** Only set if key doesn't exist */
    NX?: boolean;
    /** Only set if key exists */
    XX?: boolean;
    /** Keep existing TTL */
    KEEPTTL?: boolean;
    /** Return old value */
    GET?: boolean;
}

/**
 * Options for GET command with additional flags
 */
export interface GetOptions {
    /** Return value as binary data */
    binary?: boolean;
}

/**
 * Command argument types
 */
export type CommandArg = string | number | Buffer | boolean;

/**
 * Basic command response types
 */
export type PingResponse = string;
export type EchoResponse = string;
export type GetResponse = string | null;
export type SetResponse = 'OK' | string | null; // 'OK' for SET, old value for SET ... GET
export type DelResponse = number;
export type ExistsResponse = number;

/**
 * Command metadata registry
 */
export const COMMAND_METADATA: Record<string, CommandMetadata> = {
    PING: {
        name: 'PING',
        minArgs: 0,
        maxArgs: 1,
        keyPositions: [],
        readOnly: true,
        allowDisconnected: false,
    },
    ECHO: {
        name: 'ECHO',
        minArgs: 1,
        maxArgs: 1,
        keyPositions: [],
        readOnly: true,
        allowDisconnected: false,
    },
    GET: {
        name: 'GET',
        minArgs: 1,
        maxArgs: 1,
        keyPositions: [0],
        readOnly: true,
        allowDisconnected: false,
    },
    SET: {
        name: 'SET',
        minArgs: 2,
        maxArgs: 10, // Variable args for options
        keyPositions: [0],
        readOnly: false,
        allowDisconnected: false,
    },
    DEL: {
        name: 'DEL',
        minArgs: 1,
        keyPositions: [], // All args are keys
        readOnly: false,
        allowDisconnected: false,
    },
    EXISTS: {
        name: 'EXISTS',
        minArgs: 1,
        keyPositions: [], // All args are keys
        readOnly: true,
        allowDisconnected: false,
    },
} as const;

/**
 * Response transformers for commands
 */
export const RESPONSE_TRANSFORMERS: Record<string, ResponseTransformer> = {
    PING: (resp3: Resp3) => {
        if (resp3.__type === 'simple_string') {
            return resp3.value;
        }
        throw new Error(`Unexpected PING response: ${JSON.stringify(resp3)}`);
    },
    ECHO: (resp3: Resp3) => {
        if (resp3.__type === 'blob_string') {
            return resp3.value?.toString('utf8') || null;
        }
        throw new Error(`Unexpected ECHO response: ${JSON.stringify(resp3)}`);
    },
    GET: (resp3: Resp3) => {
        if (resp3.__type === 'blob_string') {
            return resp3.value?.toString('utf8') || null;
        }
        if (resp3.__type === 'null') {
            return null;
        }
        throw new Error(`Unexpected GET response: ${JSON.stringify(resp3)}`);
    },
    SET: (resp3: Resp3) => {
        if (resp3.__type === 'simple_string' && resp3.value === 'OK') {
            return 'OK' as const;
        }
        if (resp3.__type === 'blob_string') {
            return resp3.value?.toString('utf8') || null;
        }
        if (resp3.__type === 'null') {
            return null;
        }
        throw new Error(`Unexpected SET response: ${JSON.stringify(resp3)}`);
    },
    DEL: (resp3: Resp3) => {
        if (resp3.__type === 'integer') {
            return Number(resp3.value);
        }
        throw new Error(`Unexpected DEL response: ${JSON.stringify(resp3)}`);
    },
    EXISTS: (resp3: Resp3) => {
        if (resp3.__type === 'integer') {
            return Number(resp3.value);
        }
        throw new Error(`Unexpected EXISTS response: ${JSON.stringify(resp3)}`);
    },
} as const;

/**
 * Type guard to check if value is a valid command argument
 */
export function isValidCommandArg(value: unknown): value is CommandArg {
    return (
        typeof value === 'string' ||
        typeof value === 'number' ||
        Buffer.isBuffer(value) ||
        typeof value === 'boolean'
    );
}

/**
 * Validate command arguments against metadata
 */
export function validateCommandArgs(
    command: string,
    args: unknown[],
): asserts args is CommandArg[] {
    const metadata = COMMAND_METADATA[command.toUpperCase()];
    if (!metadata) {
        throw new Error(`Unknown command: ${command}`);
    }

    if (args.length < metadata.minArgs) {
        throw new Error(
            `Command ${command} requires at least ${metadata.minArgs} arguments, got ${args.length}`,
        );
    }

    if (metadata.maxArgs !== undefined && args.length > metadata.maxArgs) {
        throw new Error(
            `Command ${command} accepts at most ${metadata.maxArgs} arguments, got ${args.length}`,
        );
    }

    for (const arg of args) {
        if (!isValidCommandArg(arg)) {
            throw new Error(
                `Invalid argument type for command ${command}: ${typeof arg}. Expected: string, number, Buffer, or boolean`,
            );
        }
    }
}

/**
 * Get command metadata
 */
export function getCommandMetadata(command: string): CommandMetadata {
    const metadata = COMMAND_METADATA[command.toUpperCase()];
    if (!metadata) {
        throw new Error(`Unknown command: ${command}`);
    }
    return metadata;
}

/**
 * Get response transformer for command
 */
export function getResponseTransformer(command: string): ResponseTransformer | undefined {
    return RESPONSE_TRANSFORMERS[command.toUpperCase()];
}

/**
 * Build SET command arguments from options
 */
export function buildSetArgs(key: string, value: string, options?: SetOptions): string[] {
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
