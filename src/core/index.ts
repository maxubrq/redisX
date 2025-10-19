/**
 * Core module public API for redisX client
 *
 * Provides the main entry point for creating and using Redis clients
 * with type-safe command execution and connection management.
 */

// Main client exports
export { createClient, RedisClient } from './client';
export type { ConnectionAPI } from './client';

// Type definitions
export type {
    ClientOptions,
    RequiredClientOptions,
    ClientState,
    ConnectionInfo,
    CommandResult,
    PendingCommand,
    CommandContext,
    CommandExecutor,
    ResponseTransformer,
    CommandMetadata,
    ClientEvents,
    ConnectionManagerEvents,
} from './types';

// Error types
export {
    RedisXError,
    CommandError,
    ConnectionRequiredError,
    CommandTimeoutError,
    InvalidArgumentsError,
    InvalidStateError,
    ParseError,
    TransformError,
    ConfigurationError,
    CoreErrorCodes,
    AllErrorCodes,
    isNetworkError,
    isCoreError,
    isCommandError,
    isConnectionRequiredError,
    isTimeoutError,
} from './errors';

export type { CoreErrorCode, AllErrorCode } from './errors';

// Command types and utilities
export type {
    SetOptions,
    GetOptions,
    PingResponse,
    EchoResponse,
    GetResponse,
    SetResponse,
    DelResponse,
    ExistsResponse,
} from './commands/types';

export { createCommandRegistry, createCommandsAPI, type CommandsAPI } from './commands';

// Connection manager (for advanced users)
export { ConnectionManager } from './connection';

// Re-export network errors for convenience
export {
    RedisXNetError,
    ConnectionError,
    TimeoutError,
    WriteError,
    NetErrorCodes,
} from '../net/errors';

export type { NetErrorCode } from '../net/errors';
