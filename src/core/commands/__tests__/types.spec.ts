import { describe, it, expect } from 'vitest';
import {
    COMMAND_METADATA,
    RESPONSE_TRANSFORMERS,
    isValidCommandArg,
    validateCommandArgs,
    getCommandMetadata,
    getResponseTransformer,
    buildSetArgs,
    type SetOptions,
    type GetOptions,
    type CommandArg,
} from '../types';

describe('Command Types and Utilities', () => {
    describe('COMMAND_METADATA', () => {
        it('should contain metadata for all basic commands', () => {
            expect(COMMAND_METADATA.PING).toBeDefined();
            expect(COMMAND_METADATA.ECHO).toBeDefined();
            expect(COMMAND_METADATA.GET).toBeDefined();
            expect(COMMAND_METADATA.SET).toBeDefined();
            expect(COMMAND_METADATA.DEL).toBeDefined();
            expect(COMMAND_METADATA.EXISTS).toBeDefined();
        });

        it('should have correct PING metadata', () => {
            const ping = COMMAND_METADATA.PING;
            expect(ping.name).toBe('PING');
            expect(ping.minArgs).toBe(0);
            expect(ping.maxArgs).toBe(1);
            expect(ping.keyPositions).toEqual([]);
            expect(ping.readOnly).toBe(true);
            expect(ping.allowDisconnected).toBe(false);
        });

        it('should have correct GET metadata', () => {
            const get = COMMAND_METADATA.GET;
            expect(get.name).toBe('GET');
            expect(get.minArgs).toBe(1);
            expect(get.maxArgs).toBe(1);
            expect(get.keyPositions).toEqual([0]);
            expect(get.readOnly).toBe(true);
            expect(get.allowDisconnected).toBe(false);
        });

        it('should have correct SET metadata', () => {
            const set = COMMAND_METADATA.SET;
            expect(set.name).toBe('SET');
            expect(set.minArgs).toBe(2);
            expect(set.maxArgs).toBe(10);
            expect(set.keyPositions).toEqual([0]);
            expect(set.readOnly).toBe(false);
            expect(set.allowDisconnected).toBe(false);
        });
    });

    describe('RESPONSE_TRANSFORMERS', () => {
        it('should contain transformers for all commands', () => {
            expect(RESPONSE_TRANSFORMERS.PING).toBeDefined();
            expect(RESPONSE_TRANSFORMERS.ECHO).toBeDefined();
            expect(RESPONSE_TRANSFORMERS.GET).toBeDefined();
            expect(RESPONSE_TRANSFORMERS.SET).toBeDefined();
            expect(RESPONSE_TRANSFORMERS.DEL).toBeDefined();
            expect(RESPONSE_TRANSFORMERS.EXISTS).toBeDefined();
        });

        it('should transform PING response correctly', () => {
            const transformer = RESPONSE_TRANSFORMERS.PING;
            const mockResp3 = { __type: 'simple_string', value: 'PONG' };
            const result = transformer(mockResp3 as any);
            expect(result).toBe('PONG');
        });

        it('should transform ECHO response correctly', () => {
            const transformer = RESPONSE_TRANSFORMERS.ECHO;
            const mockResp3 = { __type: 'blob_string', value: Buffer.from('hello') };
            const result = transformer(mockResp3 as any);
            expect(result).toBe('hello');
        });

        it('should transform GET response correctly', () => {
            const transformer = RESPONSE_TRANSFORMERS.GET;
            
            // Test with blob string
            const mockResp3Blob = { __type: 'blob_string', value: Buffer.from('world') };
            const resultBlob = transformer(mockResp3Blob as any);
            expect(resultBlob).toBe('world');
            
            // Test with null
            const mockResp3Null = { __type: 'null' };
            const resultNull = transformer(mockResp3Null as any);
            expect(resultNull).toBe(null);
        });

        it('should transform SET response correctly', () => {
            const transformer = RESPONSE_TRANSFORMERS.SET;
            
            // Test with OK response
            const mockResp3OK = { __type: 'simple_string', value: 'OK' };
            const resultOK = transformer(mockResp3OK as any);
            expect(resultOK).toBe('OK');
            
            // Test with blob string (GET option)
            const mockResp3Blob = { __type: 'blob_string', value: Buffer.from('old') };
            const resultBlob = transformer(mockResp3Blob as any);
            expect(resultBlob).toBe('old');
            
            // Test with null
            const mockResp3Null = { __type: 'null' };
            const resultNull = transformer(mockResp3Null as any);
            expect(resultNull).toBe(null);
        });

        it('should transform DEL response correctly', () => {
            const transformer = RESPONSE_TRANSFORMERS.DEL;
            const mockResp3 = { __type: 'integer', value: 2 };
            const result = transformer(mockResp3 as any);
            expect(result).toBe(2);
        });

        it('should transform EXISTS response correctly', () => {
            const transformer = RESPONSE_TRANSFORMERS.EXISTS;
            const mockResp3 = { __type: 'integer', value: 1 };
            const result = transformer(mockResp3 as any);
            expect(result).toBe(1);
        });

        it('should throw error for unexpected response types', () => {
            const transformer = RESPONSE_TRANSFORMERS.PING;
            const mockResp3 = { __type: 'integer', value: 123 };
            
            expect(() => transformer(mockResp3 as any)).toThrow('Unexpected PING response');
        });
    });

    describe('isValidCommandArg', () => {
        it('should validate string arguments', () => {
            expect(isValidCommandArg('hello')).toBe(true);
            expect(isValidCommandArg('')).toBe(true);
        });

        it('should validate number arguments', () => {
            expect(isValidCommandArg(123)).toBe(true);
            expect(isValidCommandArg(0)).toBe(true);
            expect(isValidCommandArg(-1)).toBe(true);
            expect(isValidCommandArg(3.14)).toBe(true);
        });

        it('should validate Buffer arguments', () => {
            expect(isValidCommandArg(Buffer.from('hello'))).toBe(true);
            expect(isValidCommandArg(Buffer.alloc(0))).toBe(true);
        });

        it('should validate boolean arguments', () => {
            expect(isValidCommandArg(true)).toBe(true);
            expect(isValidCommandArg(false)).toBe(true);
        });

        it('should reject invalid arguments', () => {
            expect(isValidCommandArg(null)).toBe(false);
            expect(isValidCommandArg(undefined)).toBe(false);
            expect(isValidCommandArg({})).toBe(false);
            expect(isValidCommandArg([])).toBe(false);
            expect(isValidCommandArg(Symbol('test'))).toBe(false);
        });
    });

    describe('validateCommandArgs', () => {
        it('should validate PING command with no args', () => {
            expect(() => validateCommandArgs('PING', [])).not.toThrow();
        });

        it('should validate PING command with one arg', () => {
            expect(() => validateCommandArgs('PING', ['hello'])).not.toThrow();
        });

        it('should validate GET command with one arg', () => {
            expect(() => validateCommandArgs('GET', ['key'])).not.toThrow();
        });

        it('should validate SET command with two args', () => {
            expect(() => validateCommandArgs('SET', ['key', 'value'])).not.toThrow();
        });

        it('should throw error for unknown command', () => {
            expect(() => validateCommandArgs('UNKNOWN', [])).toThrow('Unknown command: UNKNOWN');
        });

        it('should throw error for too few arguments', () => {
            expect(() => validateCommandArgs('GET', [])).toThrow(
                'Command GET requires at least 1 arguments, got 0'
            );
        });

        it('should throw error for too many arguments', () => {
            expect(() => validateCommandArgs('PING', ['arg1', 'arg2'])).toThrow(
                'Command PING accepts at most 1 arguments, got 2'
            );
        });

        it('should throw error for invalid argument types', () => {
            expect(() => validateCommandArgs('GET', [null])).toThrow(
                'Invalid argument type for command GET: object'
            );
        });
    });

    describe('getCommandMetadata', () => {
        it('should return metadata for known commands', () => {
            const pingMeta = getCommandMetadata('PING');
            expect(pingMeta.name).toBe('PING');
            
            const getMeta = getCommandMetadata('get'); // Test case insensitive
            expect(getMeta.name).toBe('GET');
        });

        it('should throw error for unknown commands', () => {
            expect(() => getCommandMetadata('UNKNOWN')).toThrow('Unknown command: UNKNOWN');
        });
    });

    describe('getResponseTransformer', () => {
        it('should return transformer for known commands', () => {
            const pingTransformer = getResponseTransformer('PING');
            expect(pingTransformer).toBeDefined();
            expect(typeof pingTransformer).toBe('function');
            
            const getTransformer = getResponseTransformer('get'); // Test case insensitive
            expect(getTransformer).toBeDefined();
        });

        it('should return undefined for unknown commands', () => {
            const transformer = getResponseTransformer('UNKNOWN');
            expect(transformer).toBeUndefined();
        });
    });

    describe('buildSetArgs', () => {
        it('should build basic SET args', () => {
            const args = buildSetArgs('key', 'value');
            expect(args).toEqual(['key', 'value']);
        });

        it('should build SET args with EX option', () => {
            const args = buildSetArgs('key', 'value', { EX: 60 });
            expect(args).toEqual(['key', 'value', 'EX', '60']);
        });

        it('should build SET args with PX option', () => {
            const args = buildSetArgs('key', 'value', { PX: 1000 });
            expect(args).toEqual(['key', 'value', 'PX', '1000']);
        });

        it('should build SET args with EXAT option', () => {
            const args = buildSetArgs('key', 'value', { EXAT: 1234567890 });
            expect(args).toEqual(['key', 'value', 'EXAT', '1234567890']);
        });

        it('should build SET args with PXAT option', () => {
            const args = buildSetArgs('key', 'value', { PXAT: 1234567890000 });
            expect(args).toEqual(['key', 'value', 'PXAT', '1234567890000']);
        });

        it('should build SET args with NX option', () => {
            const args = buildSetArgs('key', 'value', { NX: true });
            expect(args).toEqual(['key', 'value', 'NX']);
        });

        it('should build SET args with XX option', () => {
            const args = buildSetArgs('key', 'value', { XX: true });
            expect(args).toEqual(['key', 'value', 'XX']);
        });

        it('should build SET args with KEEPTTL option', () => {
            const args = buildSetArgs('key', 'value', { KEEPTTL: true });
            expect(args).toEqual(['key', 'value', 'KEEPTTL']);
        });

        it('should build SET args with GET option', () => {
            const args = buildSetArgs('key', 'value', { GET: true });
            expect(args).toEqual(['key', 'value', 'GET']);
        });

        it('should build SET args with multiple options', () => {
            const args = buildSetArgs('key', 'value', { 
                EX: 60, 
                NX: true, 
                GET: true 
            });
            expect(args).toEqual(['key', 'value', 'EX', '60', 'NX', 'GET']);
        });

        it('should handle undefined options', () => {
            const args = buildSetArgs('key', 'value', undefined);
            expect(args).toEqual(['key', 'value']);
        });

        it('should handle empty options object', () => {
            const args = buildSetArgs('key', 'value', {});
            expect(args).toEqual(['key', 'value']);
        });
    });
});
