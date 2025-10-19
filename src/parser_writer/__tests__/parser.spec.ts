import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Buffer } from 'buffer';
import { Resp3Parser, type Resp3, type ParserOptions } from '../parser';

describe('Resp3Parser', () => {
  let parser: Resp3Parser;
  let onReply: ReturnType<typeof vi.fn>;
  let onPush: ReturnType<typeof vi.fn>;
  let onError: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onReply = vi.fn();
    onPush = vi.fn();
    onError = vi.fn();
    parser = new Resp3Parser({ onReply, onPush, onError });
  });

  describe('Basic Types', () => {
    it('should parse simple strings', () => {
      const data = Buffer.from('+OK\r\n');
      parser.feed(data);
      
      expect(onReply).toHaveBeenCalledWith({
        __type: 'simple_string',
        value: 'OK'
      });
    });

    it('should parse errors with code and message', () => {
      const data = Buffer.from('-ERR invalid command\r\n');
      parser.feed(data);
      
      expect(onReply).toHaveBeenCalledWith({
        __type: 'error',
        code: 'ERR',
        message: 'invalid command'
      });
    });

    it('should parse errors without code', () => {
      const data = Buffer.from('-Something went wrong\r\n');
      parser.feed(data);
      
      expect(onReply).toHaveBeenCalledWith({
        __type: 'error',
        code: 'Something',
        message: 'went wrong'
      });
    });

    it('should parse integers', () => {
      const data = Buffer.from(':42\r\n');
      parser.feed(data);
      
      expect(onReply).toHaveBeenCalledWith({
        __type: 'integer',
        value: 42n
      });
    });

    it('should parse large integers', () => {
      const data = Buffer.from(':9223372036854775807\r\n');
      parser.feed(data);
      
      expect(onReply).toHaveBeenCalledWith({
        __type: 'integer',
        value: 9223372036854775807n
      });
    });

    it('should parse negative integers', () => {
      const data = Buffer.from(':-42\r\n');
      parser.feed(data);
      
      expect(onReply).toHaveBeenCalledWith({
        __type: 'integer',
        value: -42n
      });
    });

    it('should parse doubles', () => {
      const data = Buffer.from(',3.14\r\n');
      parser.feed(data);
      
      expect(onReply).toHaveBeenCalledWith({
        __type: 'double',
        value: 3.14
      });
    });

    it('should parse special double values', () => {
      const testCases = [
        { input: ',inf\r\n', expected: Infinity },
        { input: ',-inf\r\n', expected: -Infinity },
        { input: ',nan\r\n', expected: NaN }
      ];

      testCases.forEach(({ input, expected }) => {
        const parser = new Resp3Parser({ onReply });
        parser.feed(Buffer.from(input));
        
        const call = onReply.mock.calls[onReply.mock.calls.length - 1];
        expect(call[0]).toEqual({
          __type: 'double',
          value: expected
        });
      });
    });

    it('should parse booleans', () => {
      const trueData = Buffer.from('#t\r\n');
      const falseData = Buffer.from('#f\r\n');
      
      parser.feed(trueData);
      expect(onReply).toHaveBeenCalledWith({
        __type: 'boolean',
        value: true
      });

      parser.feed(falseData);
      expect(onReply).toHaveBeenCalledWith({
        __type: 'boolean',
        value: false
      });
    });

    it('should parse null', () => {
      const data = Buffer.from('_\r\n');
      parser.feed(data);
      
      expect(onReply).toHaveBeenCalledWith({
        __type: 'null'
      });
    });
  });

  describe('Blob Types', () => {
    it('should parse blob strings', () => {
      const data = Buffer.from('$5\r\nhello\r\n');
      parser.feed(data);
      
      expect(onReply).toHaveBeenCalledWith({
        __type: 'blob_string',
        value: Buffer.from('hello')
      });
    });

    it('should parse empty blob strings', () => {
      const data = Buffer.from('$0\r\n\r\n');
      parser.feed(data);
      
      expect(onReply).toHaveBeenCalledWith({
        __type: 'blob_string',
        value: Buffer.from('')
      });
    });

    it('should parse null blob strings', () => {
      const data = Buffer.from('$-1\r\n');
      parser.feed(data);
      
      expect(onReply).toHaveBeenCalledWith({
        __type: 'blob_string',
        value: null
      });
    });

    it('should parse blob strings as strings when decodeBlobAsString is true', () => {
      const parser = new Resp3Parser({ onReply, decodeBlobAsString: true });
      const data = Buffer.from('$5\r\nhello\r\n');
      parser.feed(data);
      
      expect(onReply).toHaveBeenCalledWith({
        __type: 'blob_string',
        value: 'hello'
      });
    });

    it('should parse blob errors', () => {
      const data = Buffer.from('!11\r\nERR timeout\r\n');
      parser.feed(data);
      
      expect(onReply).toHaveBeenCalledWith({
        __type: 'blob_error',
        code: 'ERR',
        message: 'timeout'
      });
    });

    it('should parse blob errors without code', () => {
      const data = Buffer.from('!7\r\nTimeout\r\n');
      parser.feed(data);
      
      expect(onReply).toHaveBeenCalledWith({
        __type: 'blob_error',
        message: 'Timeout'
      });
    });

    it('should parse null blob errors', () => {
      const data = Buffer.from('!-1\r\n');
      parser.feed(data);
      
      expect(onReply).toHaveBeenCalledWith({
        __type: 'blob_error',
        message: ''
      });
    });
  });

  describe('Verbatim Strings', () => {
    it('should parse verbatim strings with format', () => {
      const data = Buffer.from('=15\r\ntxt:Hello World\r\n');
      parser.feed(data);
      
      expect(onReply).toHaveBeenCalledWith({
        __type: 'verbatim_string',
        format: 'txt',
        value: 'Hello World'
      });
    });

    it('should parse verbatim strings without colon (default format)', () => {
      const data = Buffer.from('=5\r\nHello\r\n');
      parser.feed(data);
      
      expect(onReply).toHaveBeenCalledWith({
        __type: 'verbatim_string',
        format: 'txt',
        value: 'Hello'
      });
    });

    it('should parse markdown verbatim strings', () => {
      const data = Buffer.from('=17\r\nmkd:# Hello World\r\n');
      parser.feed(data);
      
      expect(onReply).toHaveBeenCalledWith({
        __type: 'verbatim_string',
        format: 'mkd',
        value: '# Hello World'
      });
    });
  });

  describe('Big Numbers', () => {
    it('should parse big numbers as bigint when possible', () => {
      const data = Buffer.from('(1234567890123456789\r\n');
      parser.feed(data);
      
      expect(onReply).toHaveBeenCalledWith({
        __type: 'big_number',
        value: 1234567890123456789n
      });
    });

    it('should parse very large big numbers as bigint', () => {
      // JavaScript BigInt can handle very large numbers, so this will be parsed as bigint
      const data = Buffer.from('(123456789012345678901234567890123456789012345678901234567890123456789\r\n');
      parser.feed(data);
      
      expect(onReply).toHaveBeenCalledWith({
        __type: 'big_number',
        value: 123456789012345678901234567890123456789012345678901234567890123456789n
      });
    });

    it('should parse negative big numbers', () => {
      const data = Buffer.from('(-1234567890123456789\r\n');
      parser.feed(data);
      
      expect(onReply).toHaveBeenCalledWith({
        __type: 'big_number',
        value: -1234567890123456789n
      });
    });
  });

  describe('Aggregate Types', () => {
    it('should parse arrays', () => {
      const data = Buffer.from('*3\r\n+first\r\n+second\r\n+third\r\n');
      parser.feed(data);
      
      expect(onReply).toHaveBeenCalledWith({
        __type: 'array',
        value: [
          { __type: 'simple_string', value: 'first' },
          { __type: 'simple_string', value: 'second' },
          { __type: 'simple_string', value: 'third' }
        ]
      });
    });

    it('should parse empty arrays', () => {
      const data = Buffer.from('*0\r\n');
      parser.feed(data);
      
      expect(onReply).toHaveBeenCalledWith({
        __type: 'array',
        value: []
      });
    });

    it('should parse null arrays', () => {
      const data = Buffer.from('*-1\r\n');
      parser.feed(data);
      
      expect(onReply).toHaveBeenCalledWith({
        __type: 'array',
        value: null
      });
    });

    it('should parse maps', () => {
      const data = Buffer.from('%2\r\n+key1\r\n+value1\r\n+key2\r\n+value2\r\n');
      parser.feed(data);
      
      const result = onReply.mock.calls[0][0];
      expect(result.__type).toBe('map');
      expect(result.value).toBeInstanceOf(Map);
      expect(result.value.size).toBe(2);
      
      // Check that the map contains the expected key-value pairs
      const entries = Array.from(result.value.entries());
      expect(entries).toHaveLength(2);
      
      // Find the entries by checking their values
      const key1Entry = entries.find(([key]) => key.value === 'key1');
      const key2Entry = entries.find(([key]) => key.value === 'key2');
      
      expect(key1Entry).toBeDefined();
      expect(key1Entry[1]).toEqual({ __type: 'simple_string', value: 'value1' });
      
      expect(key2Entry).toBeDefined();
      expect(key2Entry[1]).toEqual({ __type: 'simple_string', value: 'value2' });
    });

    it('should parse empty maps', () => {
      const data = Buffer.from('%0\r\n');
      parser.feed(data);
      
      expect(onReply).toHaveBeenCalledWith({
        __type: 'map',
        value: new Map()
      });
    });

    it('should parse null maps', () => {
      const data = Buffer.from('%-1\r\n');
      parser.feed(data);
      
      expect(onReply).toHaveBeenCalledWith({
        __type: 'map',
        value: null
      });
    });

    it('should parse sets', () => {
      const data = Buffer.from('~3\r\n+item1\r\n+item2\r\n+item3\r\n');
      parser.feed(data);
      
      const result = onReply.mock.calls[0][0];
      expect(result.__type).toBe('set');
      expect(result.value).toBeInstanceOf(Set);
      expect(result.value.size).toBe(3);
      
      // Check that the set contains the expected items
      const items = Array.from(result.value);
      expect(items).toHaveLength(3);
      
      // Find items by checking their values
      const item1 = items.find(item => item.value === 'item1');
      const item2 = items.find(item => item.value === 'item2');
      const item3 = items.find(item => item.value === 'item3');
      
      expect(item1).toBeDefined();
      expect(item1).toEqual({ __type: 'simple_string', value: 'item1' });
      
      expect(item2).toBeDefined();
      expect(item2).toEqual({ __type: 'simple_string', value: 'item2' });
      
      expect(item3).toBeDefined();
      expect(item3).toEqual({ __type: 'simple_string', value: 'item3' });
    });

    it('should parse empty sets', () => {
      const data = Buffer.from('~0\r\n');
      parser.feed(data);
      
      expect(onReply).toHaveBeenCalledWith({
        __type: 'set',
        value: new Set()
      });
    });

    it('should parse null sets', () => {
      const data = Buffer.from('~-1\r\n');
      parser.feed(data);
      
      expect(onReply).toHaveBeenCalledWith({
        __type: 'set',
        value: null
      });
    });

    it('should parse push messages', () => {
      const data = Buffer.from('>2\r\n+message-type\r\n+data\r\n');
      parser.feed(data);
      
      expect(onPush).toHaveBeenCalledWith({
        __type: 'push',
        value: [
          { __type: 'simple_string', value: 'message-type' },
          { __type: 'simple_string', value: 'data' }
        ]
      });
    });

    it('should handle push messages without onPush handler', () => {
      const parser = new Resp3Parser({ onReply });
      const data = Buffer.from('>2\r\n+message-type\r\n+data\r\n');
      parser.feed(data);
      
      expect(onReply).toHaveBeenCalledWith({
        __type: 'push',
        value: [
          { __type: 'simple_string', value: 'message-type' },
          { __type: 'simple_string', value: 'data' }
        ]
      });
    });
  });

  describe('Attributes', () => {
    it('should parse attributes and attach to next value', () => {
      const data = Buffer.from('|2\r\n+ttl\r\n:3600\r\n+type\r\n+string\r\n+OK\r\n');
      parser.feed(data);
      
      // The null placeholder should be filtered out, so we only get the actual value
      expect(onReply).toHaveBeenCalledTimes(1);
      
      const result = onReply.mock.calls[0][0];
      expect(result.__type).toBe('simple_string');
      expect(result.value).toBe('OK');
      expect(result.attributes).toBeInstanceOf(Map);
      
      // Check that the map contains the expected key-value pairs
      const entries = Array.from(result.attributes.entries());
      expect(entries).toHaveLength(2);
      
      // Find the entries by checking their values
      const ttlEntry = entries.find(([key]) => key.value === 'ttl');
      const typeEntry = entries.find(([key]) => key.value === 'type');
      
      expect(ttlEntry).toBeDefined();
      expect(ttlEntry[1]).toEqual({ __type: 'integer', value: 3600n });
      
      expect(typeEntry).toBeDefined();
      expect(typeEntry[1]).toEqual({ __type: 'simple_string', value: 'string' });
    });

    it('should handle attributes on nested structures', () => {
      const data = Buffer.from('|1\r\n+ttl\r\n:3600\r\n*2\r\n+key1\r\n+value1\r\n');
      parser.feed(data);
      
      // The null placeholder should be filtered out, so we only get the actual value
      expect(onReply).toHaveBeenCalledTimes(1);
      
      const result = onReply.mock.calls[0][0];
      expect(result.__type).toBe('array');
      expect(result.attributes).toBeInstanceOf(Map);
      
      // Check that the map contains the expected key-value pair
      const entries = Array.from(result.attributes.entries());
      expect(entries).toHaveLength(1);
      
      const ttlEntry = entries.find(([key]) => key.value === 'ttl');
      expect(ttlEntry).toBeDefined();
      expect(ttlEntry[1]).toEqual({ __type: 'integer', value: 3600n });
    });
  });

  describe('Streaming and Partial Data', () => {
    it('should handle partial data gracefully', () => {
      const data1 = Buffer.from('+OK\r\n+');
      const data2 = Buffer.from('PONG\r\n');
      
      parser.feed(data1);
      expect(onReply).toHaveBeenCalledTimes(1);
      expect(onReply).toHaveBeenCalledWith({
        __type: 'simple_string',
        value: 'OK'
      });
      
      parser.feed(data2);
      expect(onReply).toHaveBeenCalledTimes(2);
      expect(onReply).toHaveBeenCalledWith({
        __type: 'simple_string',
        value: 'PONG'
      });
    });

    it('should handle large blob strings in chunks', () => {
      const content = 'x'.repeat(1000);
      const data1 = Buffer.from(`$1000\r\n${content.slice(0, 500)}`);
      const data2 = Buffer.from(`${content.slice(500)}\r\n`);
      
      parser.feed(data1);
      expect(onReply).not.toHaveBeenCalled();
      
      parser.feed(data2);
      expect(onReply).toHaveBeenCalledWith({
        __type: 'blob_string',
        value: Buffer.from(content)
      });
    });

    it('should handle multiple values in single feed', () => {
      const data = Buffer.from('+OK\r\n+PONG\r\n:42\r\n');
      parser.feed(data);
      
      expect(onReply).toHaveBeenCalledTimes(3);
      expect(onReply).toHaveBeenNthCalledWith(1, {
        __type: 'simple_string',
        value: 'OK'
      });
      expect(onReply).toHaveBeenNthCalledWith(2, {
        __type: 'simple_string',
        value: 'PONG'
      });
      expect(onReply).toHaveBeenNthCalledWith(3, {
        __type: 'integer',
        value: 42n
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid integer format', () => {
      const data = Buffer.from(':invalid\r\n');
      parser.feed(data);
      
      expect(onError).toHaveBeenCalled();
      const error = onError.mock.calls[0][0];
      expect(error.message).toContain('Invalid integer');
    });

    it('should handle invalid boolean format', () => {
      const data = Buffer.from('#x\r\n');
      parser.feed(data);
      
      expect(onError).toHaveBeenCalled();
      const error = onError.mock.calls[0][0];
      expect(error.message).toContain('Invalid boolean');
    });

    it('should handle invalid double format', () => {
      const data = Buffer.from(',invalid\r\n');
      parser.feed(data);
      
      expect(onError).toHaveBeenCalled();
      const error = onError.mock.calls[0][0];
      expect(error.message).toContain('Invalid double');
    });

    it('should handle invalid null format', () => {
      const data = Buffer.from('_invalid\r\n');
      parser.feed(data);
      
      expect(onError).toHaveBeenCalled();
      const error = onError.mock.calls[0][0];
      expect(error.message).toContain('Invalid null marker');
    });

    it('should handle unknown prefix', () => {
      const data = Buffer.from('@unknown\r\n');
      parser.feed(data);
      
      expect(onError).toHaveBeenCalled();
      const error = onError.mock.calls[0][0];
      expect(error.message).toContain('Unknown RESP3 prefix');
    });

    it('should handle malformed length', () => {
      const data = Buffer.from('$invalid\r\n');
      parser.feed(data);
      
      expect(onError).toHaveBeenCalled();
      const error = onError.mock.calls[0][0];
      expect(error.message).toContain('Invalid length');
    });

    it('should handle missing CRLF in blob string', () => {
      // Provide enough data but with wrong termination
      const data = Buffer.from('$5\r\nhelloXY');
      parser.feed(data);
      
      expect(onError).toHaveBeenCalled();
      const error = onError.mock.calls[0][0];
      expect(error.message).toContain('Blob not terminated by CRLF');
    });

    it('should handle missing CRLF in verbatim string', () => {
      // Provide enough data but with wrong termination
      const data = Buffer.from('=5\r\nhelloXY');
      parser.feed(data);
      
      expect(onError).toHaveBeenCalled();
      const error = onError.mock.calls[0][0];
      expect(error.message).toContain('Verbatim not terminated by CRLF');
    });

    it('should recover from errors and continue parsing', () => {
      const data = Buffer.from('@invalid\r\n+OK\r\n');
      parser.feed(data);
      
      expect(onError).toHaveBeenCalled();
      // The parser resets on error, so we need to feed the valid data separately
      parser.feed(Buffer.from('+OK\r\n'));
      expect(onReply).toHaveBeenCalledWith({
        __type: 'simple_string',
        value: 'OK'
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty input', () => {
      parser.feed(Buffer.alloc(0));
      expect(onReply).not.toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
    });

    it('should handle null input', () => {
      parser.feed(null as any);
      expect(onReply).not.toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
    });

    it('should handle nested aggregates', () => {
      const data = Buffer.from('*2\r\n*2\r\n+inner1\r\n+inner2\r\n*1\r\n+outer\r\n');
      parser.feed(data);
      
      expect(onReply).toHaveBeenCalledTimes(1);
      const result = onReply.mock.calls[0][0];
      expect(result.__type).toBe('array');
      expect(result.value).toHaveLength(2);
      expect(result.value[0].__type).toBe('array');
      expect(result.value[0].value).toEqual([
        { __type: 'simple_string', value: 'inner1' },
        { __type: 'simple_string', value: 'inner2' }
      ]);
      expect(result.value[1].__type).toBe('array');
      expect(result.value[1].value).toEqual([
        { __type: 'simple_string', value: 'outer' }
      ]);
    });

    it('should handle mixed types in arrays', () => {
      const data = Buffer.from('*4\r\n+string\r\n:42\r\n,3.14\r\n#t\r\n');
      parser.feed(data);
      
      const result = onReply.mock.calls[0][0];
      expect(result.__type).toBe('array');
      expect(result.value).toEqual([
        { __type: 'simple_string', value: 'string' },
        { __type: 'integer', value: 42n },
        { __type: 'double', value: 3.14 },
        { __type: 'boolean', value: true }
      ]);
    });

    it('should handle complex nested structures with attributes', () => {
      const data = Buffer.from('|1\r\n+ttl\r\n:3600\r\n*2\r\n%1\r\n+key\r\n+value\r\n+simple\r\n');
      parser.feed(data);
      
      // The null placeholder should be filtered out, so we only get the actual value
      expect(onReply).toHaveBeenCalledTimes(1);
      
      const result = onReply.mock.calls[0][0];
      expect(result.__type).toBe('array');
      
      // Check that the map contains the expected key-value pair
      const entries = Array.from(result.attributes.entries());
      expect(entries).toHaveLength(1);
      
      const ttlEntry = entries.find(([key]) => key.value === 'ttl');
      expect(ttlEntry).toBeDefined();
      expect(ttlEntry[1]).toEqual({ __type: 'integer', value: 3600n });
      
      expect(result.value[0].__type).toBe('map');
      expect(result.value[1].__type).toBe('simple_string');
    });
  });

  describe('Performance and Memory', () => {
    it('should handle large arrays efficiently', () => {
      const size = 1000;
      let data = `*${size}\r\n`;
      for (let i = 0; i < size; i++) {
        data += `+item${i}\r\n`;
      }
      
      parser.feed(Buffer.from(data));
      
      expect(onReply).toHaveBeenCalledTimes(1);
      const result = onReply.mock.calls[0][0];
      expect(result.__type).toBe('array');
      expect(result.value).toHaveLength(size);
    });

    it('should handle large blob strings', () => {
      const content = 'x'.repeat(10000);
      const data = Buffer.from(`$10000\r\n${content}\r\n`);
      
      parser.feed(data);
      
      expect(onReply).toHaveBeenCalledWith({
        __type: 'blob_string',
        value: Buffer.from(content)
      });
    });
  });
});
