/**
 * Network error hierarchy for redisX transport layer
 * 
 * Provides typed error handling for network operations with specific error codes
 * and context information for debugging and error recovery.
 */

/**
 * Base error class for all network-related errors in redisX
 */
export class RedisXNetError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'RedisXNetError';
  }
}

/**
 * Error thrown when connection operations fail
 */
export class ConnectionError extends RedisXNetError {
  constructor(
    message: string,
    code: string,
    cause?: Error
  ) {
    super(message, code, cause);
    this.name = 'ConnectionError';
  }
}

/**
 * Error thrown when operations timeout
 */
export class TimeoutError extends RedisXNetError {
  constructor(
    message: string,
    code: string,
    public readonly timeoutMs: number,
    cause?: Error
  ) {
    super(message, code, cause);
    this.name = 'TimeoutError';
  }
}

/**
 * Error thrown when write operations fail
 */
export class WriteError extends RedisXNetError {
  constructor(
    message: string,
    code: string,
    public readonly bytesWritten: number,
    public readonly totalBytes: number,
    cause?: Error
  ) {
    super(message, code, cause);
    this.name = 'WriteError';
  }
}

/**
 * Error codes for network operations
 */
export const NetErrorCodes = {
  // Connection errors
  CONNECTION_REFUSED: 'CONNECTION_REFUSED',
  CONNECTION_TIMEOUT: 'CONNECTION_TIMEOUT',
  CONNECTION_CLOSED: 'CONNECTION_CLOSED',
  CONNECTION_RESET: 'CONNECTION_RESET',
  CONNECTION_ABORTED: 'CONNECTION_ABORTED',
  
  // Write errors
  WRITE_FAILED: 'WRITE_FAILED',
  WRITE_TIMEOUT: 'WRITE_TIMEOUT',
  WRITE_BACKPRESSURE: 'WRITE_BACKPRESSURE',
  
  // State errors
  INVALID_STATE: 'INVALID_STATE',
  ALREADY_CONNECTED: 'ALREADY_CONNECTED',
  NOT_CONNECTED: 'NOT_CONNECTED',
  
  // Generic errors
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

export type NetErrorCode = typeof NetErrorCodes[keyof typeof NetErrorCodes];
