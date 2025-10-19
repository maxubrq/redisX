import { describe, it, expect } from 'vitest';
import { Buffer } from 'buffer';
import { Resp3Writer } from '../writer';
import type { Resp3 } from '../parser';

describe('Resp3Writer', () => {
    let writer: Resp3Writer;

    beforeEach(() => {
        writer = new Resp3Writer();
    });

    describe('Simple String', () => {
        it('should encode simple string', () => {
            const value: Resp3 = {
                __type: 'simple_string',
                value: 'OK',
            };
            const result = writer.encode(value);
            expect(result.toString()).toBe('+OK\r\n');
        });

        it('should encode simple string with attributes', () => {
            const attributes = new Map([['ttl', 3600]]);
            const value: Resp3 = {
                __type: 'simple_string',
                value: 'OK',
                attributes,
            };
            const result = writer.encode(value);
            expect(result.toString()).toBe('|1\r\n+ttl\r\n:3600\r\n+OK\r\n');
        });
    });

    describe('Error', () => {
        it('should encode error without code', () => {
            const value: Resp3 = {
                __type: 'error',
                message: 'Something went wrong',
            };
            const result = writer.encode(value);
            expect(result.toString()).toBe('-Something went wrong\r\n');
        });

        it('should encode error with code', () => {
            const value: Resp3 = {
                __type: 'error',
                code: 'ERR',
                message: 'unknown command',
            };
            const result = writer.encode(value);
            expect(result.toString()).toBe('-ERR unknown command\r\n');
        });
    });

    describe('Integer', () => {
        it('should encode positive integer', () => {
            const value: Resp3 = {
                __type: 'integer',
                value: BigInt(42),
            };
            const result = writer.encode(value);
            expect(result.toString()).toBe(':42\r\n');
        });

        it('should encode negative integer', () => {
            const value: Resp3 = {
                __type: 'integer',
                value: BigInt(-42),
            };
            const result = writer.encode(value);
            expect(result.toString()).toBe(':-42\r\n');
        });

        it('should encode zero', () => {
            const value: Resp3 = {
                __type: 'integer',
                value: BigInt(0),
            };
            const result = writer.encode(value);
            expect(result.toString()).toBe(':0\r\n');
        });
    });

    describe('Double', () => {
        it('should encode positive double', () => {
            const value: Resp3 = {
                __type: 'double',
                value: 3.14,
            };
            const result = writer.encode(value);
            expect(result.toString()).toBe(',3.14\r\n');
        });

        it('should encode negative double', () => {
            const value: Resp3 = {
                __type: 'double',
                value: -3.14,
            };
            const result = writer.encode(value);
            expect(result.toString()).toBe(',-3.14\r\n');
        });

        it('should encode infinity', () => {
            const value: Resp3 = {
                __type: 'double',
                value: Infinity,
            };
            const result = writer.encode(value);
            expect(result.toString()).toBe(',inf\r\n');
        });

        it('should encode negative infinity', () => {
            const value: Resp3 = {
                __type: 'double',
                value: -Infinity,
            };
            const result = writer.encode(value);
            expect(result.toString()).toBe(',-inf\r\n');
        });

        it('should encode NaN', () => {
            const value: Resp3 = {
                __type: 'double',
                value: NaN,
            };
            const result = writer.encode(value);
            expect(result.toString()).toBe(',nan\r\n');
        });
    });

    describe('Big Number', () => {
        it('should encode bigint', () => {
            const value: Resp3 = {
                __type: 'big_number',
                value: BigInt('123456789012345678901234567890'),
            };
            const result = writer.encode(value);
            expect(result.toString()).toBe('(123456789012345678901234567890\r\n');
        });

        it('should encode string big number', () => {
            const value: Resp3 = {
                __type: 'big_number',
                value: '123456789012345678901234567890',
            };
            const result = writer.encode(value);
            expect(result.toString()).toBe('(123456789012345678901234567890\r\n');
        });
    });

    describe('Boolean', () => {
        it('should encode true', () => {
            const value: Resp3 = {
                __type: 'boolean',
                value: true,
            };
            const result = writer.encode(value);
            expect(result.toString()).toBe('#t\r\n');
        });

        it('should encode false', () => {
            const value: Resp3 = {
                __type: 'boolean',
                value: false,
            };
            const result = writer.encode(value);
            expect(result.toString()).toBe('#f\r\n');
        });
    });

    describe('Null', () => {
        it('should encode null', () => {
            const value: Resp3 = {
                __type: 'null',
            };
            const result = writer.encode(value);
            expect(result.toString()).toBe('_\r\n');
        });
    });

    describe('Blob String', () => {
        it('should encode blob string', () => {
            const value: Resp3 = {
                __type: 'blob_string',
                value: Buffer.from('hello'),
            };
            const result = writer.encode(value);
            expect(result.toString()).toBe('$5\r\nhello\r\n');
        });

        it('should encode null blob string', () => {
            const value: Resp3 = {
                __type: 'blob_string',
                value: null,
            };
            const result = writer.encode(value);
            expect(result.toString()).toBe('$-1\r\n');
        });

        it('should encode empty blob string', () => {
            const value: Resp3 = {
                __type: 'blob_string',
                value: Buffer.alloc(0),
            };
            const result = writer.encode(value);
            expect(result.toString()).toBe('$0\r\n\r\n');
        });
    });

    describe('Blob Error', () => {
        it('should encode blob error without code', () => {
            const value: Resp3 = {
                __type: 'blob_error',
                message: 'Something went wrong',
            };
            const result = writer.encode(value);
            expect(result.toString()).toBe('!20\r\nSomething went wrong\r\n');
        });

        it('should encode blob error with code', () => {
            const value: Resp3 = {
                __type: 'blob_error',
                code: 'ERR',
                message: 'unknown command',
            };
            const result = writer.encode(value);
            expect(result.toString()).toBe('!19\r\nERR unknown command\r\n');
        });
    });

    describe('Verbatim String', () => {
        it('should encode verbatim string', () => {
            const value: Resp3 = {
                __type: 'verbatim_string',
                format: 'txt',
                value: 'Some string',
            };
            const result = writer.encode(value);
            expect(result.toString()).toBe('=15\r\ntxt:Some string\r\n');
        });
    });

    describe('Array', () => {
        it('should encode empty array', () => {
            const value: Resp3 = {
                __type: 'array',
                value: [],
            };
            const result = writer.encode(value);
            expect(result.toString()).toBe('*0\r\n');
        });

        it('should encode null array', () => {
            const value: Resp3 = {
                __type: 'array',
                value: null,
            };
            const result = writer.encode(value);
            expect(result.toString()).toBe('*-1\r\n');
        });

        it('should encode array with mixed types', () => {
            const value: Resp3 = {
                __type: 'array',
                value: [
                    { __type: 'simple_string', value: 'hello' },
                    { __type: 'integer', value: BigInt(42) },
                    { __type: 'null' },
                ],
            };
            const result = writer.encode(value);
            expect(result.toString()).toBe('*3\r\n+hello\r\n:42\r\n_\r\n');
        });

        it('should encode nested array', () => {
            const value: Resp3 = {
                __type: 'array',
                value: [
                    {
                        __type: 'array',
                        value: [
                            { __type: 'integer', value: BigInt(1) },
                            { __type: 'integer', value: BigInt(2) },
                        ],
                    },
                    { __type: 'simple_string', value: 'world' },
                ],
            };
            const result = writer.encode(value);
            expect(result.toString()).toBe('*2\r\n*2\r\n:1\r\n:2\r\n+world\r\n');
        });
    });

    describe('Map', () => {
        it('should encode empty map', () => {
            const value: Resp3 = {
                __type: 'map',
                value: new Map(),
            };
            const result = writer.encode(value);
            expect(result.toString()).toBe('%0\r\n');
        });

        it('should encode null map', () => {
            const value: Resp3 = {
                __type: 'map',
                value: null,
            };
            const result = writer.encode(value);
            expect(result.toString()).toBe('%-1\r\n');
        });

        it('should encode map with string keys and values', () => {
            const map = new Map([
                ['first', { __type: 'integer', value: BigInt(1) }],
                ['second', { __type: 'integer', value: BigInt(2) }],
            ]);
            const value: Resp3 = {
                __type: 'map',
                value: map,
            };
            const result = writer.encode(value);
            expect(result.toString()).toBe('%2\r\n+first\r\n:1\r\n+second\r\n:2\r\n');
        });
    });

    describe('Set', () => {
        it('should encode empty set', () => {
            const value: Resp3 = {
                __type: 'set',
                value: new Set(),
            };
            const result = writer.encode(value);
            expect(result.toString()).toBe('~0\r\n');
        });

        it('should encode null set', () => {
            const value: Resp3 = {
                __type: 'set',
                value: null,
            };
            const result = writer.encode(value);
            expect(result.toString()).toBe('~-1\r\n');
        });

        it('should encode set with values', () => {
            const set = new Set([
                { __type: 'simple_string', value: 'hello' },
                { __type: 'simple_string', value: 'world' },
            ]);
            const value: Resp3 = {
                __type: 'set',
                value: set,
            };
            const result = writer.encode(value);
            expect(result.toString()).toBe('~2\r\n+hello\r\n+world\r\n');
        });
    });

    describe('Push', () => {
        it('should encode push message', () => {
            const value: Resp3 = {
                __type: 'push',
                value: [
                    { __type: 'simple_string', value: 'message' },
                    { __type: 'simple_string', value: 'hello world' },
                ],
            };
            const result = writer.encode(value);
            expect(result.toString()).toBe('>2\r\n+message\r\n+hello world\r\n');
        });
    });

    describe('Attributes', () => {
        it('should encode attributes', () => {
            const attributes = new Map([
                ['ttl', { __type: 'integer', value: BigInt(3600) }],
                ['type', { __type: 'simple_string', value: 'string' }],
            ]);
            const value: Resp3 = {
                __type: 'simple_string',
                value: 'OK',
                attributes,
            };
            const result = writer.encode(value);
            expect(result.toString()).toBe('|2\r\n+ttl\r\n:3600\r\n+type\r\n+string\r\n+OK\r\n');
        });
    });

    describe('encodeArray', () => {
        it('should encode array of values', () => {
            const values: Resp3[] = [
                { __type: 'simple_string', value: 'hello' },
                { __type: 'integer', value: BigInt(42) },
            ];
            const result = writer.encodeArray(values);
            expect(result.toString()).toBe('*2\r\n+hello\r\n:42\r\n');
        });
    });

    describe('encodeCommand', () => {
        it('should encode simple command', () => {
            const result = writer.encodeCommand('PING');
            expect(result.toString()).toBe('*1\r\n$4\r\nPING\r\n');
        });

        it('should encode command with string arguments', () => {
            const result = writer.encodeCommand('SET', 'key', 'value');
            expect(result.toString()).toBe('*3\r\n$3\r\nSET\r\n$3\r\nkey\r\n$5\r\nvalue\r\n');
        });

        it('should encode command with number arguments', () => {
            const result = writer.encodeCommand('INCRBY', 'counter', 5);
            expect(result.toString()).toBe('*3\r\n$6\r\nINCRBY\r\n$7\r\ncounter\r\n$1\r\n5\r\n');
        });

        it('should encode command with buffer arguments', () => {
            const buffer = Buffer.from('binary data');
            const result = writer.encodeCommand('SET', 'key', buffer);
            expect(result.toString()).toBe(
                '*3\r\n$3\r\nSET\r\n$3\r\nkey\r\n$11\r\nbinary data\r\n',
            );
        });
    });

    describe('Buffer management', () => {
        it('should handle large values', () => {
            const largeString = 'x'.repeat(10000);
            const value: Resp3 = {
                __type: 'blob_string',
                value: Buffer.from(largeString),
            };
            const result = writer.encode(value);
            expect(result.length).toBe(10000 + 10); // 10000 bytes + $10000\r\n\r\n (10 chars for "10000")
        });

        it('should reuse buffer efficiently', () => {
            const writer1 = new Resp3Writer();
            const writer2 = new Resp3Writer();

            const value1: Resp3 = { __type: 'simple_string', value: 'hello' };
            const value2: Resp3 = { __type: 'simple_string', value: 'world' };

            const result1 = writer1.encode(value1);
            const result2 = writer2.encode(value2);

            expect(result1.toString()).toBe('+hello\r\n');
            expect(result2.toString()).toBe('+world\r\n');
        });
    });

    describe('Edge cases', () => {
        it('should handle empty string', () => {
            const value: Resp3 = {
                __type: 'simple_string',
                value: '',
            };
            const result = writer.encode(value);
            expect(result.toString()).toBe('+\r\n');
        });

        it('should handle string with special characters', () => {
            const value: Resp3 = {
                __type: 'blob_string',
                value: Buffer.from('hello\r\nworld'),
            };
            const result = writer.encode(value);
            expect(result.toString()).toBe('$12\r\nhello\r\nworld\r\n');
        });

        it('should handle unicode strings', () => {
            const value: Resp3 = {
                __type: 'blob_string',
                value: Buffer.from('你好世界', 'utf8'),
            };
            const result = writer.encode(value);
            expect(result.toString()).toBe('$12\r\n你好世界\r\n');
        });
    });
});
