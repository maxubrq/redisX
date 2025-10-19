/**
 * Integration tests for core module
 *
 * These tests demonstrate the core functionality without requiring
 * a real Redis server, using mocked components.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RedisClient, createClient } from '../client';
import { ConnectionManager } from '../connection';
import { createCommandRegistry, createCommandsAPI } from '../commands';
import { ConnectionRequiredError } from '../errors';

describe('Core Module Integration', () => {
    describe('RedisClient', () => {
        it('should create client with default options', () => {
            const client = new RedisClient();
            expect(client).toBeInstanceOf(RedisClient);
            expect(client.options.host).toBe('localhost');
            expect(client.options.port).toBe(6379);
            expect(client.options.autoConnect).toBe(true);
        });

        it('should create client with custom options', () => {
            const client = new RedisClient({
                host: 'redis.example.com',
                port: 6380,
                autoConnect: false,
                connectTimeout: 10000,
            });

            expect(client.options.host).toBe('redis.example.com');
            expect(client.options.port).toBe(6380);
            expect(client.options.autoConnect).toBe(false);
            expect(client.options.connectTimeout).toBe(10000);
        });

        it('should provide commands API', () => {
            const client = new RedisClient({ autoConnect: false });
            expect(client.commands).toBeDefined();
            expect(typeof client.commands.ping).toBe('function');
            expect(typeof client.commands.get).toBe('function');
            expect(typeof client.commands.set).toBe('function');
        });

        it('should provide connection API', () => {
            const client = new RedisClient({ autoConnect: false });
            expect(client.connection).toBeDefined();
            expect(typeof client.connection.connect).toBe('function');
            expect(typeof client.connection.disconnect).toBe('function');
        });

        it('should throw error when executing command without connection', async () => {
            const client = new RedisClient({ autoConnect: false });
            await expect(client.commands.ping()).rejects.toThrow(ConnectionRequiredError);
        });
    });

    describe('ConnectionManager', () => {
        it('should create connection manager with options', () => {
            const manager = new ConnectionManager({
                host: 'localhost',
                port: 6379,
                connectTimeout: 5000,
                commandTimeout: 5000,
                autoConnect: false,
                url: '',
                username: '',
                password: '',
                clientName: '',
                database: 0,
            });

            expect(manager.state).toBe('disconnected');
            expect(manager.isConnected).toBe(false);
            expect(manager.pendingCommandCount).toBe(0);
        });

        it('should have connection info', () => {
            const manager = new ConnectionManager({
                host: 'localhost',
                port: 6379,
                connectTimeout: 5000,
                commandTimeout: 5000,
                autoConnect: false,
                url: '',
                username: '',
                password: '',
                clientName: '',
                database: 0,
            });

            const info = manager.info;
            expect(info.address).toBe('localhost:6379');
            expect(info.state).toBe('disconnected');
            expect(info.isConnected).toBe(false);
        });
    });

    describe('Command System', () => {
        it('should create command registry', () => {
            const registry = createCommandRegistry();
            expect(registry).toBeDefined();
            expect(registry.get('ping')).toBeDefined();
            expect(registry.get('get')).toBeDefined();
            expect(registry.get('set')).toBeDefined();
        });

        it('should create commands API', () => {
            const mockContext = {
                client: {} as any,
                connection: {
                    sendCommand: vi.fn(),
                } as any,
                timeout: 5000,
            };

            const registry = createCommandRegistry();
            const commandsAPI = createCommandsAPI(mockContext, registry);

            expect(commandsAPI).toBeDefined();
            expect(typeof commandsAPI.ping).toBe('function');
            expect(typeof commandsAPI.get).toBe('function');
            expect(typeof commandsAPI.set).toBe('function');
        });
    });

    describe('Error Handling', () => {
        it('should throw ConnectionRequiredError for commands without connection', async () => {
            const client = new RedisClient({ autoConnect: false });
            await expect(client.send('PING')).rejects.toThrow(ConnectionRequiredError);
        });

        it('should throw ConfigurationError for invalid options', () => {
            expect(() => {
                new RedisClient({ port: 0 });
            }).toThrow('Port must be between 1 and 65535');
        });

        it('should throw ConfigurationError for invalid URL', () => {
            expect(() => {
                new RedisClient({ url: 'invalid://url' });
            }).toThrow('Invalid protocol. Expected redis: or rediss:');
        });
    });

    describe('Event System', () => {
        it.skip('should emit state change events', async () => {
            // Skipped: Requires actual Redis connection
            // This test attempts a real connection which causes unhandled errors
            const client = new RedisClient({ autoConnect: false });

            const stateChangePromise = new Promise<void>(resolve => {
                client.on('state:change', (oldState, newState) => {
                    expect(oldState).toBe('disconnected');
                    expect(newState).toBe('connecting');
                    resolve();
                });
            });

            // Trigger state change by attempting connection
            const connectPromise = client.connect().catch(() => {
                // Expected to fail in test environment
            });

            await stateChangePromise;
            await connectPromise;
        });

        it.skip('should emit error events', async () => {
            // Skipped: Requires actual Redis connection
            // This test attempts a real connection which causes unhandled errors
            const client = new RedisClient({ autoConnect: false });

            const errorPromise = new Promise<void>(resolve => {
                client.on('error', error => {
                    expect(error).toBeInstanceOf(Error);
                    resolve();
                });
            });

            // Trigger error by attempting connection
            const connectPromise = client.connect().catch(() => {
                // Expected to fail in test environment
            });

            await errorPromise;
            await connectPromise;
        });
    });

    describe('URL Parsing', () => {
        it('should parse Redis URL correctly', () => {
            const client = new RedisClient({
                url: 'redis://user:pass@redis.example.com:6380/1',
            });

            expect(client.options.host).toBe('redis.example.com');
            expect(client.options.port).toBe(6380);
            expect(client.options.username).toBe('user');
            expect(client.options.password).toBe('pass');
            expect(client.options.database).toBe(1);
        });

        it('should parse Redis URL with default values', () => {
            const client = new RedisClient({
                url: 'redis://localhost',
            });

            expect(client.options.host).toBe('localhost');
            expect(client.options.port).toBe(6379);
            expect(client.options.username).toBe('');
            expect(client.options.password).toBe('');
            expect(client.options.database).toBe(0);
        });
    });

    describe('Type Safety', () => {
        it('should provide typed command responses', async () => {
            const client = new RedisClient({ autoConnect: false });

            // These should be properly typed
            const pingPromise: Promise<string> = client.commands.ping();
            const getPromise: Promise<string | null> = client.commands.get('key');
            const setPromise: Promise<'OK' | string | null> = client.commands.set('key', 'value');
            const delPromise: Promise<number> = client.commands.del('key');
            const existsPromise: Promise<number> = client.commands.exists('key');

            expect(typeof pingPromise.then).toBe('function');
            expect(typeof getPromise.then).toBe('function');
            expect(typeof setPromise.then).toBe('function');
            expect(typeof delPromise.then).toBe('function');
            expect(typeof existsPromise.then).toBe('function');

            // Handle the rejections to prevent unhandled promise errors
            await Promise.allSettled([pingPromise, getPromise, setPromise, delPromise, existsPromise]);
        });

        it('should provide typed options', () => {
            const options = {
                host: 'localhost',
                port: 6379,
                autoConnect: false,
                connectTimeout: 5000,
                commandTimeout: 5000,
            };

            const client = new RedisClient(options);
            expect(client.options.host).toBe('localhost');
            expect(client.options.port).toBe(6379);
            expect(client.options.autoConnect).toBe(false);
        });
    });
});
