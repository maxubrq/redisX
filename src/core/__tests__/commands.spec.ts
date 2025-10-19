/**
 * Unit tests for command system
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createCommandRegistry, createCommandsAPI } from '../commands';
import { BasicCommands } from '../commands/basic';
import { ConnectionRequiredError } from '../errors';
import type { CommandContext } from '../types';

describe('BasicCommands', () => {
    let basicCommands: BasicCommands;
    let mockContext: CommandContext;

    beforeEach(() => {
        basicCommands = new BasicCommands();
        mockContext = {
            client: {} as any,
            connection: {
                sendCommand: vi.fn(),
            } as any,
            timeout: 5000,
        };
    });

    describe('ping', () => {
        it('should execute PING without message', async () => {
            const mockSendCommand = vi.fn().mockResolvedValue('PONG');
            mockContext.connection.sendCommand = mockSendCommand;

            const result = await basicCommands.ping(mockContext);

            expect(result).toBe('PONG');
            expect(mockSendCommand).toHaveBeenCalledWith('PING');
        });

        it('should execute PING with message', async () => {
            const mockSendCommand = vi.fn().mockResolvedValue('Hello');
            mockContext.connection.sendCommand = mockSendCommand;

            const result = await basicCommands.ping(mockContext, 'Hello');

            expect(result).toBe('Hello');
            expect(mockSendCommand).toHaveBeenCalledWith('PING', 'Hello');
        });
    });

    describe('echo', () => {
        it('should execute ECHO command', async () => {
            const mockSendCommand = vi.fn().mockResolvedValue('Hello World');
            mockContext.connection.sendCommand = mockSendCommand;

            const result = await basicCommands.echo(mockContext, 'Hello World');

            expect(result).toBe('Hello World');
            expect(mockSendCommand).toHaveBeenCalledWith('ECHO', 'Hello World');
        });
    });

    describe('get', () => {
        it('should execute GET command', async () => {
            const mockSendCommand = vi.fn().mockResolvedValue('value');
            mockContext.connection.sendCommand = mockSendCommand;

            const result = await basicCommands.get(mockContext, 'key');

            expect(result).toBe('value');
            expect(mockSendCommand).toHaveBeenCalledWith('GET', 'key');
        });

        it('should execute GET command with options', async () => {
            const mockSendCommand = vi.fn().mockResolvedValue('value');
            mockContext.connection.sendCommand = mockSendCommand;

            const result = await basicCommands.get(mockContext, 'key', { binary: true });

            expect(result).toBe('value');
            expect(mockSendCommand).toHaveBeenCalledWith('GET', 'key');
        });
    });

    describe('set', () => {
        it('should execute SET command', async () => {
            const mockSendCommand = vi.fn().mockResolvedValue('OK');
            mockContext.connection.sendCommand = mockSendCommand;

            const result = await basicCommands.set(mockContext, 'key', 'value');

            expect(result).toBe('OK');
            expect(mockSendCommand).toHaveBeenCalledWith('SET', 'key', 'value');
        });

        it('should execute SET command with options', async () => {
            const mockSendCommand = vi.fn().mockResolvedValue('OK');
            mockContext.connection.sendCommand = mockSendCommand;

            const result = await basicCommands.set(mockContext, 'key', 'value', {
                EX: 60,
                NX: true,
            });

            expect(result).toBe('OK');
            expect(mockSendCommand).toHaveBeenCalledWith('SET', 'key', 'value', 'EX', '60', 'NX');
        });
    });

    describe('del', () => {
        it('should execute DEL command with single key', async () => {
            const mockSendCommand = vi.fn().mockResolvedValue(1);
            mockContext.connection.sendCommand = mockSendCommand;

            const result = await basicCommands.del(mockContext, 'key1');

            expect(result).toBe(1);
            expect(mockSendCommand).toHaveBeenCalledWith('DEL', 'key1');
        });

        it('should execute DEL command with multiple keys', async () => {
            const mockSendCommand = vi.fn().mockResolvedValue(2);
            mockContext.connection.sendCommand = mockSendCommand;

            const result = await basicCommands.del(mockContext, 'key1', 'key2');

            expect(result).toBe(2);
            expect(mockSendCommand).toHaveBeenCalledWith('DEL', 'key1', 'key2');
        });

        it('should throw error for empty keys', async () => {
            await expect(basicCommands.del(mockContext)).rejects.toThrow(
                'DEL requires at least one key',
            );
        });
    });

    describe('exists', () => {
        it('should execute EXISTS command with single key', async () => {
            const mockSendCommand = vi.fn().mockResolvedValue(1);
            mockContext.connection.sendCommand = mockSendCommand;

            const result = await basicCommands.exists(mockContext, 'key1');

            expect(result).toBe(1);
            expect(mockSendCommand).toHaveBeenCalledWith('EXISTS', 'key1');
        });

        it('should execute EXISTS command with multiple keys', async () => {
            const mockSendCommand = vi.fn().mockResolvedValue(2);
            mockContext.connection.sendCommand = mockSendCommand;

            const result = await basicCommands.exists(mockContext, 'key1', 'key2');

            expect(result).toBe(2);
            expect(mockSendCommand).toHaveBeenCalledWith('EXISTS', 'key1', 'key2');
        });

        it('should throw error for empty keys', async () => {
            await expect(basicCommands.exists(mockContext)).rejects.toThrow(
                'EXISTS requires at least one key',
            );
        });
    });

    describe('execute', () => {
        it('should execute generic command', async () => {
            const mockSendCommand = vi.fn().mockResolvedValue('result');
            mockContext.connection.sendCommand = mockSendCommand;

            const result = await basicCommands.execute(mockContext, 'CUSTOM', 'arg1', 'arg2');

            expect(result).toBe('result');
            expect(mockSendCommand).toHaveBeenCalledWith('CUSTOM', 'arg1', 'arg2');
        });
    });
});

describe('CommandRegistry', () => {
    let registry: ReturnType<typeof createCommandRegistry>;
    let mockContext: CommandContext;

    beforeEach(() => {
        registry = createCommandRegistry();
        mockContext = {
            client: {} as any,
            connection: {
                sendCommand: vi.fn(),
            } as any,
            timeout: 5000,
        };
    });

    describe('registration', () => {
        it('should register command executor', () => {
            const mockExecutor = {
                execute: vi.fn().mockResolvedValue('result'),
            };

            registry.register('test', mockExecutor);

            expect(registry.get('test')).toBe(mockExecutor);
        });

        it('should register command executor case-insensitively', () => {
            const mockExecutor = {
                execute: vi.fn().mockResolvedValue('result'),
            };

            registry.register('TEST', mockExecutor);

            expect(registry.get('test')).toBe(mockExecutor);
            expect(registry.get('Test')).toBe(mockExecutor);
        });
    });

    describe('execution', () => {
        it('should execute registered command', async () => {
            const mockExecutor = {
                execute: vi.fn().mockResolvedValue('result'),
            };
            registry.register('test', mockExecutor);

            const result = await registry.execute(mockContext, 'test', 'arg1', 'arg2');

            expect(result).toBe('result');
            expect(mockExecutor.execute).toHaveBeenCalledWith(mockContext, 'test', 'arg1', 'arg2');
        });

        it('should throw error for unknown command', async () => {
            await expect(registry.execute(mockContext, 'unknown')).rejects.toThrow(
                'Unknown command: unknown',
            );
        });
    });

    describe('basic commands', () => {
        it('should have ping command registered', () => {
            expect(registry.get('ping')).toBeDefined();
        });

        it('should have echo command registered', () => {
            expect(registry.get('echo')).toBeDefined();
        });

        it('should have get command registered', () => {
            expect(registry.get('get')).toBeDefined();
        });

        it('should have set command registered', () => {
            expect(registry.get('set')).toBeDefined();
        });

        it('should have del command registered', () => {
            expect(registry.get('del')).toBeDefined();
        });

        it('should have exists command registered', () => {
            expect(registry.get('exists')).toBeDefined();
        });
    });
});

describe('CommandsAPI', () => {
    let commandsAPI: ReturnType<typeof createCommandsAPI>;
    let mockContext: CommandContext;
    let mockRegistry: ReturnType<typeof createCommandRegistry>;

    beforeEach(() => {
        mockRegistry = createCommandRegistry();
        mockContext = {
            client: {} as any,
            connection: {
                sendCommand: vi.fn(),
            } as any,
            timeout: 5000,
        };
        commandsAPI = createCommandsAPI(mockContext, mockRegistry);
    });

    describe('ping', () => {
        it('should execute ping command', async () => {
            const mockExecute = vi.fn().mockResolvedValue('PONG');
            vi.spyOn(mockRegistry, 'execute').mockImplementation(mockExecute);

            const result = await commandsAPI.ping();

            expect(result).toBe('PONG');
            expect(mockExecute).toHaveBeenCalledWith(mockContext, 'ping', undefined);
        });

        it('should execute ping command with message', async () => {
            const mockExecute = vi.fn().mockResolvedValue('Hello');
            vi.spyOn(mockRegistry, 'execute').mockImplementation(mockExecute);

            const result = await commandsAPI.ping('Hello');

            expect(result).toBe('Hello');
            expect(mockExecute).toHaveBeenCalledWith(mockContext, 'ping', 'Hello');
        });
    });

    describe('echo', () => {
        it('should execute echo command', async () => {
            const mockExecute = vi.fn().mockResolvedValue('Hello World');
            vi.spyOn(mockRegistry, 'execute').mockImplementation(mockExecute);

            const result = await commandsAPI.echo('Hello World');

            expect(result).toBe('Hello World');
            expect(mockExecute).toHaveBeenCalledWith(mockContext, 'echo', 'Hello World');
        });
    });

    describe('get', () => {
        it('should execute get command', async () => {
            const mockExecute = vi.fn().mockResolvedValue('value');
            vi.spyOn(mockRegistry, 'execute').mockImplementation(mockExecute);

            const result = await commandsAPI.get('key');

            expect(result).toBe('value');
            expect(mockExecute).toHaveBeenCalledWith(mockContext, 'get', 'key', undefined);
        });

        it('should execute get command with options', async () => {
            const mockExecute = vi.fn().mockResolvedValue('value');
            vi.spyOn(mockRegistry, 'execute').mockImplementation(mockExecute);

            const result = await commandsAPI.get('key', { binary: true });

            expect(result).toBe('value');
            expect(mockExecute).toHaveBeenCalledWith(mockContext, 'get', 'key', { binary: true });
        });
    });

    describe('set', () => {
        it('should execute set command', async () => {
            const mockExecute = vi.fn().mockResolvedValue('OK');
            vi.spyOn(mockRegistry, 'execute').mockImplementation(mockExecute);

            const result = await commandsAPI.set('key', 'value');

            expect(result).toBe('OK');
            expect(mockExecute).toHaveBeenCalledWith(mockContext, 'set', 'key', 'value', undefined);
        });

        it('should execute set command with options', async () => {
            const mockExecute = vi.fn().mockResolvedValue('OK');
            vi.spyOn(mockRegistry, 'execute').mockImplementation(mockExecute);

            const result = await commandsAPI.set('key', 'value', { EX: 60, NX: true });

            expect(result).toBe('OK');
            expect(mockExecute).toHaveBeenCalledWith(mockContext, 'set', 'key', 'value', {
                EX: 60,
                NX: true,
            });
        });
    });

    describe('del', () => {
        it('should execute del command', async () => {
            const mockExecute = vi.fn().mockResolvedValue(1);
            vi.spyOn(mockRegistry, 'execute').mockImplementation(mockExecute);

            const result = await commandsAPI.del('key1');

            expect(result).toBe(1);
            expect(mockExecute).toHaveBeenCalledWith(mockContext, 'del', 'key1');
        });

        it('should execute del command with multiple keys', async () => {
            const mockExecute = vi.fn().mockResolvedValue(2);
            vi.spyOn(mockRegistry, 'execute').mockImplementation(mockExecute);

            const result = await commandsAPI.del('key1', 'key2');

            expect(result).toBe(2);
            expect(mockExecute).toHaveBeenCalledWith(mockContext, 'del', 'key1', 'key2');
        });
    });

    describe('exists', () => {
        it('should execute exists command', async () => {
            const mockExecute = vi.fn().mockResolvedValue(1);
            vi.spyOn(mockRegistry, 'execute').mockImplementation(mockExecute);

            const result = await commandsAPI.exists('key1');

            expect(result).toBe(1);
            expect(mockExecute).toHaveBeenCalledWith(mockContext, 'exists', 'key1');
        });

        it('should execute exists command with multiple keys', async () => {
            const mockExecute = vi.fn().mockResolvedValue(2);
            vi.spyOn(mockRegistry, 'execute').mockImplementation(mockExecute);

            const result = await commandsAPI.exists('key1', 'key2');

            expect(result).toBe(2);
            expect(mockExecute).toHaveBeenCalledWith(mockContext, 'exists', 'key1', 'key2');
        });
    });
});
