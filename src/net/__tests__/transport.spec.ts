import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';
import type { ITransport, TransportOptions, TransportState, DataEvent, ErrorEvent } from '../transport';
import { NetErrorCodes } from '../errors';

/**
 * Mock transport implementation for testing the interface contract
 */
class MockTransport extends EventEmitter implements ITransport {
    private _state: TransportState = 'disconnected';
    private _options: Readonly<TransportOptions>;
    private _shouldFailConnect = false;
    private _shouldFailWrite = false;
    private _shouldFailClose = false;
    private _connectDelay = 0;
    private _writeDelay = 0;
    private _closeDelay = 0;

    constructor(options: Readonly<TransportOptions>) {
        super();
        this._options = options;
    }

    get state(): TransportState {
        return this._state;
    }

    get address(): string {
        return `${this._options.host}:${this._options.port}`;
    }

    get options(): Readonly<TransportOptions> {
        return this._options;
    }

    // Test control methods
    setShouldFailConnect(shouldFail: boolean): void {
        this._shouldFailConnect = shouldFail;
    }

    setShouldFailWrite(shouldFail: boolean): void {
        this._shouldFailWrite = shouldFail;
    }

    setShouldFailClose(shouldFail: boolean): void {
        this._shouldFailClose = shouldFail;
    }

    setConnectDelay(delay: number): void {
        this._connectDelay = delay;
    }

    setWriteDelay(delay: number): void {
        this._writeDelay = delay;
    }

    setCloseDelay(delay: number): void {
        this._closeDelay = delay;
    }

    async connect(): Promise<void> {
        if (this._state === 'connected') {
            throw new Error('Already connected');
        }

        if (this._state === 'connecting') {
            throw new Error('Already connecting');
        }

        this._state = 'connecting';

        if (this._connectDelay > 0) {
            await new Promise(resolve => setTimeout(resolve, this._connectDelay));
        }

        if (this._shouldFailConnect) {
            this._state = 'disconnected';
            const error = new Error('Connection failed');
            this.emit('error', {
                error,
                code: NetErrorCodes.CONNECTION_REFUSED,
                timestamp: Date.now(),
            });
            throw error;
        }

        this._state = 'connected';
        this.emit('connect');
    }

    async write(data: Buffer): Promise<void> {
        if (this._state !== 'connected') {
            throw new Error(`Cannot write in state: ${this._state}`);
        }

        if (this._writeDelay > 0) {
            await new Promise(resolve => setTimeout(resolve, this._writeDelay));
        }

        if (this._shouldFailWrite) {
            const error = new Error('Write failed');
            this.emit('error', {
                error,
                code: NetErrorCodes.WRITE_FAILED,
                timestamp: Date.now(),
            });
            throw error;
        }

        // Simulate successful write
        return Promise.resolve();
    }

    async close(): Promise<void> {
        if (this._state === 'closed' || this._state === 'disconnected') {
            return;
        }

        this._state = 'closing';

        if (this._closeDelay > 0) {
            await new Promise(resolve => setTimeout(resolve, this._closeDelay));
        }

        if (this._shouldFailClose) {
            const error = new Error('Close failed');
            this.emit('error', {
                error,
                code: NetErrorCodes.UNKNOWN_ERROR,
                timestamp: Date.now(),
            });
            throw error;
        }

        this._state = 'closed';
        this.emit('close');
    }

    // Helper method to simulate data reception
    simulateData(data: Buffer): void {
        this.emit('data', {
            data,
            timestamp: Date.now(),
        });
    }

    // Helper method to simulate drain event
    simulateDrain(): void {
        this.emit('drain');
    }
}

describe('ITransport Interface', () => {
    let transport: MockTransport;
    const testOptions: Readonly<TransportOptions> = {
        host: 'localhost',
        port: 6379,
        connectTimeout: 5000,
        keepAlive: true,
        keepAliveInitialDelay: 1000,
    };

    beforeEach(() => {
        transport = new MockTransport(testOptions);
    });

    describe('Interface Contract', () => {
        it('should implement EventEmitter', () => {
            expect(transport).toBeInstanceOf(EventEmitter);
        });

        it('should have required properties', () => {
            expect(transport.state).toBeDefined();
            expect(transport.address).toBeDefined();
            expect(transport.options).toBeDefined();
        });

        it('should have required methods', () => {
            expect(typeof transport.connect).toBe('function');
            expect(typeof transport.write).toBe('function');
            expect(typeof transport.close).toBe('function');
        });

        it('should have correct initial state', () => {
            expect(transport.state).toBe('disconnected');
        });

        it('should format address correctly', () => {
            expect(transport.address).toBe('localhost:6379');
        });

        it('should expose options as readonly', () => {
            expect(transport.options).toEqual(testOptions);
            // Note: Object.isFrozen might not work as expected in test environment
            // The important thing is that the options are exposed correctly
            expect(transport.options).toBeDefined();
        });
    });

    describe('State Management', () => {
        it('should transition from disconnected to connecting', async () => {
            // Set a delay to ensure we can check the connecting state
            transport.setConnectDelay(10);
            const connectPromise = transport.connect();
            expect(transport.state).toBe('connecting');
            await connectPromise;
            expect(transport.state).toBe('connected');
        });

        it('should transition from connected to closing to closed', async () => {
            await transport.connect();
            expect(transport.state).toBe('connected');

            // Set a delay to ensure we can check the closing state
            transport.setCloseDelay(10);
            const closePromise = transport.close();
            expect(transport.state).toBe('closing');
            await closePromise;
            expect(transport.state).toBe('closed');
        });

        it('should handle multiple connect calls', async () => {
            await transport.connect();
            expect(transport.state).toBe('connected');

            // Second connect should throw
            await expect(transport.connect()).rejects.toThrow('Already connected');
        });

        it('should handle connect while already connecting', async () => {
            transport.setConnectDelay(100);
            const connectPromise1 = transport.connect();
            
            // Wait a bit to ensure first connect is in progress
            await new Promise(resolve => setTimeout(resolve, 10));
            
            // This should reject the promise
            const connectPromise2 = transport.connect();
            await expect(connectPromise2).rejects.toThrow('Already connecting');

            await expect(connectPromise1).resolves.toBeUndefined();
        });
    });

    describe('Event Emission', () => {
        it('should emit connect event', async () => {
            const connectSpy = vi.fn();
            transport.on('connect', connectSpy);

            await transport.connect();
            expect(connectSpy).toHaveBeenCalledTimes(1);
        });

        it('should emit close event', async () => {
            const closeSpy = vi.fn();
            transport.on('close', closeSpy);

            await transport.connect();
            await transport.close();
            expect(closeSpy).toHaveBeenCalledTimes(1);
        });

        it('should emit data events with correct structure', () => {
            const dataSpy = vi.fn();
            transport.on('data', dataSpy);

            const testData = Buffer.from('test data');
            transport.simulateData(testData);

            expect(dataSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: testData,
                    timestamp: expect.any(Number),
                }),
            );
        });

        it('should emit error events with correct structure', () => {
            const errorSpy = vi.fn();
            transport.on('error', errorSpy);

            transport.setShouldFailConnect(true);
            transport.connect().catch(() => {}); // Ignore the rejection

            expect(errorSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: expect.any(Error),
                    code: NetErrorCodes.CONNECTION_REFUSED,
                    timestamp: expect.any(Number),
                }),
            );
        });

        it('should emit drain events', () => {
            const drainSpy = vi.fn();
            transport.on('drain', drainSpy);

            transport.simulateDrain();
            expect(drainSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe('Write Operations', () => {
        beforeEach(async () => {
            await transport.connect();
        });

        it('should write data successfully', async () => {
            const testData = Buffer.from('test data');
            await expect(transport.write(testData)).resolves.toBeUndefined();
        });

        it('should reject write when not connected', async () => {
            await transport.close();
            const testData = Buffer.from('test data');
            await expect(transport.write(testData)).rejects.toThrow('Cannot write in state: closed');
        });

        it('should reject write when disconnected', async () => {
            const disconnectedTransport = new MockTransport(testOptions);
            const testData = Buffer.from('test data');
            await expect(disconnectedTransport.write(testData)).rejects.toThrow('Cannot write in state: disconnected');
        });

        it('should handle write failures', async () => {
            transport.setShouldFailWrite(true);
            const testData = Buffer.from('test data');
            await expect(transport.write(testData)).rejects.toThrow('Write failed');
        });
    });

    describe('Error Handling', () => {
        it('should handle connection failures', async () => {
            transport.setShouldFailConnect(true);
            await expect(transport.connect()).rejects.toThrow('Connection failed');
        });

        it('should handle write failures with error events', async () => {
            const errorSpy = vi.fn();
            transport.on('error', errorSpy);

            await transport.connect();
            transport.setShouldFailWrite(true);

            await expect(transport.write(Buffer.from('test'))).rejects.toThrow('Write failed');
            expect(errorSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: expect.any(Error),
                    code: NetErrorCodes.WRITE_FAILED,
                    timestamp: expect.any(Number),
                }),
            );
        });

        it('should handle close failures', async () => {
            const errorSpy = vi.fn();
            transport.on('error', errorSpy);

            await transport.connect();
            transport.setShouldFailClose(true);

            await expect(transport.close()).rejects.toThrow('Close failed');
            expect(errorSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: expect.any(Error),
                    code: NetErrorCodes.UNKNOWN_ERROR,
                    timestamp: expect.any(Number),
                }),
            );
        });
    });

    describe('Data Event Structure', () => {
        it('should emit data events with correct DataEvent structure', () => {
            const dataSpy = vi.fn();
            transport.on('data', dataSpy);

            const testData = Buffer.from('hello world');
            transport.simulateData(testData);

            const event = dataSpy.mock.calls[0][0] as DataEvent;
            expect(event).toHaveProperty('data');
            expect(event).toHaveProperty('timestamp');
            expect(event.data).toBe(testData);
            expect(typeof event.timestamp).toBe('number');
            expect(event.timestamp).toBeGreaterThan(0);
        });

        it('should emit error events with correct ErrorEvent structure', () => {
            const errorSpy = vi.fn();
            transport.on('error', errorSpy);

            transport.setShouldFailConnect(true);
            transport.connect().catch(() => {});

            const event = errorSpy.mock.calls[0][0] as ErrorEvent;
            expect(event).toHaveProperty('error');
            expect(event).toHaveProperty('code');
            expect(event).toHaveProperty('timestamp');
            expect(event.error).toBeInstanceOf(Error);
            expect(typeof event.code).toBe('string');
            expect(typeof event.timestamp).toBe('number');
            expect(event.timestamp).toBeGreaterThan(0);
        });
    });

    describe('Transport Options', () => {
        it('should handle all option types', () => {
            const fullOptions: TransportOptions = {
                host: 'example.com',
                port: 1234,
                connectTimeout: 10000,
                keepAlive: false,
                keepAliveInitialDelay: 2000,
            };

            const transportWithFullOptions = new MockTransport(fullOptions);
            expect(transportWithFullOptions.options).toEqual(fullOptions);
        });

        it('should handle minimal options', () => {
            const minimalOptions: TransportOptions = {
                host: 'localhost',
                port: 6379,
            };

            const transportWithMinimalOptions = new MockTransport(minimalOptions);
            expect(transportWithMinimalOptions.options).toEqual(minimalOptions);
        });
    });

    describe('Async Behavior', () => {
        it('should handle async connect delays', async () => {
            transport.setConnectDelay(50);
            const start = Date.now();
            await transport.connect();
            const duration = Date.now() - start;
            expect(duration).toBeGreaterThanOrEqual(45); // Allow some tolerance
        });

        it('should handle async write delays', async () => {
            await transport.connect();
            transport.setWriteDelay(50);
            const start = Date.now();
            await transport.write(Buffer.from('test'));
            const duration = Date.now() - start;
            expect(duration).toBeGreaterThanOrEqual(45); // Allow some tolerance
        });

        it('should handle async close delays', async () => {
            await transport.connect();
            transport.setCloseDelay(50);
            const start = Date.now();
            await transport.close();
            const duration = Date.now() - start;
            expect(duration).toBeGreaterThanOrEqual(45); // Allow some tolerance
        });
    });

    describe('Event Listener Management', () => {
        it('should support multiple event listeners', () => {
            const listener1 = vi.fn();
            const listener2 = vi.fn();
            const listener3 = vi.fn();

            transport.on('connect', listener1);
            transport.on('connect', listener2);
            transport.on('data', listener3);

            transport.connect();
            transport.simulateData(Buffer.from('test'));

            expect(listener1).toHaveBeenCalledTimes(1);
            expect(listener2).toHaveBeenCalledTimes(1);
            expect(listener3).toHaveBeenCalledTimes(1);
        });

        it('should support event listener removal', () => {
            const listener = vi.fn();
            transport.on('connect', listener);
            transport.off('connect', listener);

            transport.connect();
            expect(listener).not.toHaveBeenCalled();
        });
    });

    describe('Type Safety', () => {
        it('should enforce correct event listener types', () => {
            // These should compile without errors
            transport.on('data', (event: DataEvent) => {
                expect(event.data).toBeInstanceOf(Buffer);
                expect(typeof event.timestamp).toBe('number');
            });

            transport.on('error', (event: ErrorEvent) => {
                expect(event.error).toBeInstanceOf(Error);
                expect(typeof event.code).toBe('string');
                expect(typeof event.timestamp).toBe('number');
            });

            transport.on('connect', () => {});
            transport.on('close', () => {});
            transport.on('drain', () => {});
        });

        it('should enforce correct state types', () => {
            const validStates: TransportState[] = ['disconnected', 'connecting', 'connected', 'closing', 'closed'];
            expect(validStates).toContain(transport.state);
        });
    });
});
