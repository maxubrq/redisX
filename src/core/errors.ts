/**
 * Core error hierarchy for redisX client
 *
 * Provides typed error handling for client operations with specific error codes
 * and context information for debugging and error recovery.
 */

import { RedisXNetError, NetErrorCodes, type NetErrorCode, TimeoutError } from '../net/errors';
import type { ClientState } from './types';

/**
 * Base error class for all redisX client errors
 */
export class RedisXError extends Error {
    constructor(
        message: string,
        public readonly code: string,
        public readonly cause?: Error,
    ) {
        super(message);
        this.name = 'RedisXError';
    }
}

/**
 * Error thrown when command execution fails
 */
export class CommandError extends RedisXError {
    constructor(
        message: string,
        public readonly command: string,
        public readonly args: unknown[],
        public readonly cause?: Error,
    ) {
        super(message, CoreErrorCodes.COMMAND_FAILED, cause);
        this.name = 'CommandError';
    }
}

/**
 * Error thrown when connection is required but not available
 */
export class ConnectionRequiredError extends RedisXError {
    constructor(
        public readonly command: string,
        public readonly currentState: ClientState,
    ) {
        super(
            `Command '${command}' requires an active connection, but client is in '${currentState}' state`,
            CoreErrorCodes.CONNECTION_REQUIRED,
        );
        this.name = 'ConnectionRequiredError';
    }
}

/**
 * Error thrown when command execution times out
 */
export class CommandTimeoutError extends RedisXError {
    constructor(
        public readonly command: string,
        public readonly timeoutMs: number,
        public readonly args: unknown[],
    ) {
        super(
            `Command '${command}' timed out after ${timeoutMs}ms`,
            CoreErrorCodes.COMMAND_TIMEOUT,
        );
        this.name = 'CommandTimeoutError';
    }
}

/**
 * Error thrown when invalid command arguments are provided
 */
export class InvalidArgumentsError extends RedisXError {
    constructor(
        public readonly command: string,
        public readonly expected: string,
        public readonly received: unknown[],
    ) {
        super(
            `Invalid arguments for command '${command}': ${expected}. Received: ${JSON.stringify(received)}`,
            CoreErrorCodes.INVALID_ARGUMENTS,
        );
        this.name = 'InvalidArgumentsError';
    }
}

/**
 * Error thrown when client is in an invalid state for the operation
 */
export class InvalidStateError extends RedisXError {
    constructor(
        public readonly operation: string,
        public readonly currentState: ClientState,
        public readonly expectedStates: ClientState[],
    ) {
        super(
            `Operation '${operation}' not allowed in state '${currentState}'. Expected states: ${expectedStates.join(', ')}`,
            CoreErrorCodes.INVALID_STATE,
        );
        this.name = 'InvalidStateError';
    }
}

/**
 * Error thrown when RESP3 parsing fails
 */
export class ParseError extends RedisXError {
    constructor(
        message: string,
        public readonly data: Buffer,
        public readonly offset: number,
        cause?: Error,
    ) {
        super(message, CoreErrorCodes.PARSE_ERROR, cause);
        this.name = 'ParseError';
    }
}

/**
 * Error thrown when command response transformation fails
 */
export class TransformError extends RedisXError {
    constructor(
        public readonly command: string,
        public readonly expectedType: string,
        public readonly actualValue: unknown,
        cause?: Error,
    ) {
        super(
            `Failed to transform response for command '${command}': expected ${expectedType}, got ${typeof actualValue}`,
            CoreErrorCodes.TRANSFORM_ERROR,
            cause,
        );
        this.name = 'TransformError';
    }
}

/**
 * Error thrown when client configuration is invalid
 */
export class ConfigurationError extends RedisXError {
    constructor(
        message: string,
        public readonly option: string,
        public readonly value: unknown,
    ) {
        super(message, CoreErrorCodes.CONFIGURATION_ERROR);
        this.name = 'ConfigurationError';
    }
}

/**
 * Error codes for core operations
 */
export const CoreErrorCodes = {
    // Command errors
    COMMAND_FAILED: 'COMMAND_FAILED',
    COMMAND_TIMEOUT: 'COMMAND_TIMEOUT',
    INVALID_ARGUMENTS: 'INVALID_ARGUMENTS',

    // Connection errors
    CONNECTION_REQUIRED: 'CONNECTION_REQUIRED',
    INVALID_STATE: 'INVALID_STATE',

    // Protocol errors
    PARSE_ERROR: 'PARSE_ERROR',
    TRANSFORM_ERROR: 'TRANSFORM_ERROR',

    // Configuration errors
    CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',

    // Generic errors
    UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

export type CoreErrorCode = (typeof CoreErrorCodes)[keyof typeof CoreErrorCodes];

/**
 * Combined error codes from both net and core modules
 */
export const AllErrorCodes = {
    ...NetErrorCodes,
    ...CoreErrorCodes,
} as const;

export type AllErrorCode = NetErrorCode | CoreErrorCode;

/**
 * Type guard to check if error is a network error
 */
export function isNetworkError(error: Error): error is RedisXNetError {
    return error instanceof RedisXNetError && !(error instanceof RedisXError);
}

/**
 * Type guard to check if error is a core error
 */
export function isCoreError(error: Error): error is RedisXError {
    return error instanceof RedisXError;
}

/**
 * Type guard to check if error is a command error
 */
export function isCommandError(error: Error): error is CommandError {
    return error instanceof CommandError;
}

/**
 * Type guard to check if error is a connection required error
 */
export function isConnectionRequiredError(error: Error): error is ConnectionRequiredError {
    return error instanceof ConnectionRequiredError;
}

/**
 * Type guard to check if error is a timeout error
 */
export function isTimeoutError(error: Error): error is CommandTimeoutError | TimeoutError {
    return error instanceof CommandTimeoutError || error instanceof TimeoutError;
}

/**
 * Re-export network errors for convenience
 */
export { RedisXNetError, ConnectionError, TimeoutError, WriteError } from '../net/errors';
