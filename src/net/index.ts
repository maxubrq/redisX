/**
 * Net module exports for redisX transport layer
 * 
 * Provides transport abstraction and TCP implementation for network communication
 * with Redis servers. This module handles the low-level socket operations,
 * backpressure management, and connection lifecycle.
 */

// Transport interface and types
export type { 
  ITransport, 
  TransportOptions, 
  TransportState, 
  DataEvent, 
  ErrorEvent 
} from './transport';

// TCP transport implementation
export { TcpTransport } from './tcp-transport';

// Error types and codes
export { 
  RedisXNetError,
  ConnectionError, 
  TimeoutError, 
  WriteError,
  NetErrorCodes,
  type NetErrorCode
} from './errors';
