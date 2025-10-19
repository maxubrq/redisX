import { EventEmitter } from 'events';
import type { NetErrorCode } from './errors';

/**
 * Configuration options for transport connections
 */
export interface TransportOptions {
  /** Hostname or IP address to connect to */
  host: string;
  /** Port number to connect to */
  port: number;
  /** Connection timeout in milliseconds (default: 5000) */
  connectTimeout?: number;
  /** Keep-alive settings */
  keepAlive?: boolean;
  /** Keep-alive initial delay in milliseconds */
  keepAliveInitialDelay?: number;
}

/**
 * Transport connection states
 */
export type TransportState = 
  | 'disconnected' 
  | 'connecting' 
  | 'connected' 
  | 'closing' 
  | 'closed';

/**
 * Data event payload
 */
export interface DataEvent {
  /** The data chunk received */
  data: Buffer;
  /** Timestamp when data was received */
  timestamp: number;
}

/**
 * Error event payload
 */
export interface ErrorEvent {
  /** The error that occurred */
  error: Error;
  /** Error code for programmatic handling */
  code: NetErrorCode;
  /** Timestamp when error occurred */
  timestamp: number;
}

/**
 * Abstract transport interface for network communication
 * 
 * Provides a unified interface for different transport implementations
 * (TCP, TLS, WebSocket) with lifecycle management and backpressure handling.
 */
export interface ITransport extends EventEmitter {
  /** Current connection state */
  readonly state: TransportState;
  
  /** Remote address in "host:port" format for logging */
  readonly address: string;
  
  /** Connection options */
  readonly options: Readonly<TransportOptions>;
  
  /**
   * Establish connection to remote host
   * @returns Promise that resolves when connection is established
   * @throws {ConnectionError} When connection fails
   * @throws {TimeoutError} When connection times out
   */
  connect(): Promise<void>;
  
  /**
   * Write data to the transport
   * @param data Buffer to write
   * @returns Promise that resolves when data is written (may be queued)
   * @throws {WriteError} When write fails
   * @throws {InvalidStateError} When not connected
   */
  write(data: Buffer): Promise<void>;
  
  /**
   * Close the transport connection
   * @returns Promise that resolves when connection is closed
   */
  close(): Promise<void>;
  
  // Event definitions for TypeScript
  on(event: 'data', listener: (event: DataEvent) => void): this;
  on(event: 'close', listener: () => void): this;
  on(event: 'error', listener: (event: ErrorEvent) => void): this;
  on(event: 'connect', listener: () => void): this;
  on(event: 'drain', listener: () => void): this;
  
  emit(event: 'data', data: DataEvent): boolean;
  emit(event: 'close'): boolean;
  emit(event: 'error', error: ErrorEvent): boolean;
  emit(event: 'connect'): boolean;
  emit(event: 'drain'): boolean;
}
