import { describe, it, expect, beforeEach } from 'vitest';
import { Buffer } from 'buffer';
import { Resp3Parser, type Resp3, type Resp3Push } from '../parser';

function mkParser(opts: Partial<ConstructorParameters<typeof Resp3Parser>[0]> = {}) {
  const replies: Resp3[] = [];
  const pushes: Resp3Push[] = [];
  const errors: Error[] = [];
  const parser = new Resp3Parser({
    onReply: (v) => replies.push(v),
    onPush: (p) => pushes.push(p),
    onError: (e) => errors.push(e),
    ...opts,
  });
  return { parser, replies, pushes, errors };
}

function B(s: string) {
  return Buffer.from(s, 'utf8');
}

describe('Resp3Parser', () => {
  describe('leaf types', () => {
    it('parses simple string (+)', () => {
      const { parser, replies } = mkParser();
      parser.feed(B('+OK\r\n'));
      expect(replies).toHaveLength(1);
      expect(replies[0]).toEqual({ __type: 'simple_string', value: 'OK' });
    });

    it('parses error (-) with/without code', () => {
      const { parser, replies } = mkParser();
      parser.feed(B('-ERR something bad\r\n'));
      parser.feed(B('-oops\r\n'));
      expect(replies[0]).toEqual({ __type: 'error', code: 'ERR', message: 'something bad' });
      expect(replies[1]).toEqual({ __type: 'error', message: 'oops' });
    });

    it('parses integer (:)', () => {
      const { parser, replies } = mkParser();
      parser.feed(B(':42\r\n'));
      expect(replies[0]).toEqual({ __type: 'integer', value: 42n });
    });

    it('parses double (,) including inf/-inf/nan', () => {
      const { parser, replies } = mkParser();
      parser.feed(B(',3.14\r\n'));
      parser.feed(B(',inf\r\n'));
      parser.feed(B(',-inf\r\n'));
      parser.feed(B(',nan\r\n'));
      expect(replies[0]).toEqual({ __type: 'double', value: 3.14 });
      expect(replies[1]).toEqual({ __type: 'double', value: Infinity });
      expect(replies[2]).toEqual({ __type: 'double', value: -Infinity });
      expect(Number.isNaN((replies[3] as any).value)).toBe(true);
    });

    it('parses big number (() with bigint fallback to string when invalid for BigInt', () => {
      const { parser, replies } = mkParser();
      // valid BigInt
      parser.feed(B('(123456789012345678901234567890\r\n'));
      // invalid for JS BigInt due to explicit '+' sign -> should fall back to string
      parser.feed(B('(+123\r\n'));
      expect(replies[0]).toEqual({ __type: 'big_number', value: 123456789012345678901234567890n });
      expect(replies[1]).toEqual({ __type: 'big_number', value: '+123' });
    });

    it('parses boolean (#)', () => {
      const { parser, replies } = mkParser();
      parser.feed(B('#t\r\n'));
      parser.feed(B('#f\r\n'));
      expect(replies[0]).toEqual({ __type: 'boolean', value: true });
      expect(replies[1]).toEqual({ __type: 'boolean', value: false });
    });

    it('parses null (_)', () => {
      const { parser, replies } = mkParser();
      parser.feed(B('_\r\n'));
      expect(replies[0]).toEqual({ __type: 'null' });
    });

    it('parses blob string ($) as Buffer by default and as utf8 string with option', () => {
      const a = mkParser();
      a.parser.feed(B('$5\r\nhello\r\n'));
      expect(a.replies[0]!.__type).toBe('blob_string');
      expect(Buffer.isBuffer((a.replies[0] as any).value)).toBe(true);
      expect((a.replies[0] as any).value.toString()).toBe('hello');

      const b = mkParser({ decodeBlobAsString: true });
      b.parser.feed(B('$5\r\nhello\r\n'));
      expect(typeof (b.replies[0] as any).value).toBe('string');
      expect((b.replies[0] as any).value).toBe('hello');
    });

    it('parses null blob string ($-1)', () => {
      const { parser, replies } = mkParser();
      parser.feed(B('$-1\r\n'));
      expect(replies[0]).toEqual({ __type: 'blob_string', value: null });
    });

    it('parses blob error (!)', () => {
      const { parser, replies } = mkParser();
      parser.feed(B('!11\r\nERR message\r\n'));
      expect(replies[0]).toEqual({ __type: 'blob_error', code: 'ERR', message: 'message' });
    });

    it('parses verbatim string (=)', () => {
      const { parser, replies } = mkParser();
      parser.feed(B('=11\r\ntxt:hello!\r\n'));
      expect(replies[0]).toEqual({ __type: 'verbatim_string', format: 'txt', value: 'hello!' });
    });
  });

  describe('aggregates', () => {
    it('parses arrays (*) with nested items', () => {
      const { parser, replies } = mkParser();
      parser.feed(B('*3\r\n+hi\r\n:2\r\n$5\r\nworld\r\n'));
      const arr = replies[0];
      expect(arr!.__type).toBe('array');
      const value = (arr as any).value as Resp3[];
      expect(value[0]).toEqual({ __type: 'simple_string', value: 'hi' });
      expect(value[1]).toEqual({ __type: 'integer', value: 2n });
      expect((value[2] as any).value.toString()).toBe('world');
    });

    it('parses set (~) and map (%)', () => {
      const { parser, replies } = mkParser();
      parser.feed(
        B(
          // set of 2 items: "a", 1
          '~2\r\n+a\r\n:1\r\n' +
            // map of 2 pairs
            '%2\r\n+key\r\n+val\r\n:7\r\n+seven\r\n',
        ),
      );
      expect(replies).toHaveLength(2);

      const set = replies[0];
      expect(set!.__type).toBe('set');
      const s = (set as any).value as Set<unknown>;
      // Sets hold child nodes; we’ll check presence by serializing
      const setAsArray = Array.from(s) as Resp3[];
      expect(setAsArray[0]).toEqual({ __type: 'simple_string', value: 'a' });
      expect(setAsArray[1]).toEqual({ __type: 'integer', value: 1n });

      const map = replies[1];
      expect(map!.__type).toBe('map');
      const m = (map as any).value as Map<unknown, unknown>;
      // Keys/values are Resp3 nodes
      const entries = Array.from(m.entries()) as [Resp3, Resp3][];
      expect(entries[0]![0]).toEqual({ __type: 'simple_string', value: 'key' });
      expect(entries[0]![1]).toEqual({ __type: 'simple_string', value: 'val' });
      expect(entries[1]![0]).toEqual({ __type: 'integer', value: 7n });
      expect(entries[1]![1]).toEqual({ __type: 'simple_string', value: 'seven' });
    });

    it('supports RESP2-style null aggregates (*-1, %-1, ~-1)', () => {
      const { parser, replies } = mkParser();
      parser.feed(B('*-1\r\n%-1\r\n~-1\r\n'));
      expect(replies[0]).toEqual({ __type: 'array', value: null });
      expect(replies[1]).toEqual({ __type: 'map', value: null });
      expect(replies[2]).toEqual({ __type: 'set', value: null });
    });

    it('parses push (>) and routes to onPush by default', () => {
      const { parser, replies, pushes } = mkParser();
      parser.feed(B('>2\r\n+message\r\n+payload\r\n'));
      expect(replies).toHaveLength(0);
      expect(pushes).toHaveLength(1);
      expect(pushes[0]).toEqual({
        __type: 'push',
        value: [
          { __type: 'simple_string', value: 'message' },
          { __type: 'simple_string', value: 'payload' },
        ],
      });
    });

    it('if no onPush, push is surfaced via onReply', () => {
      const replies: Resp3[] = [];
      const parser = new Resp3Parser({ onReply: (v) => replies.push(v) });
      parser.feed(B('>1\r\n+note\r\n'));
      expect(replies).toHaveLength(1);
      expect(replies[0]!.__type).toBe('push');
    });
  });

  describe('attributes (|) attachment', () => {
    it('attaches attributes to the very next node (scalar)', () => {
      const { parser, replies } = mkParser();
      // |1 { +k => +v }, then +OK
      parser.feed(B('|1\r\n+k\r\n+v\r\n+OK\r\n'));
      expect(replies).toHaveLength(1);
      expect(replies[0]!.__type).toBe('simple_string');
      const attrs = (replies[0] as any).attributes as Map<any, any>;
      expect(attrs).toBeDefined();
      const kv = Array.from(attrs.entries());
      expect(kv[0]![0]).toEqual({ __type: 'simple_string', value: 'k' });
      expect(kv[0]![1]).toEqual({ __type: 'simple_string', value: 'v' });
    });

    it('attaches attributes to the entire aggregate when attributes precede the aggregate marker', () => {
      const { parser, replies } = mkParser();
      // Attributes before array
      parser.feed(B('|1\r\n+meta\r\n+yes\r\n*2\r\n+hi\r\n:1\r\n'));
      expect(replies).toHaveLength(1);
      const arr = replies[0];
      expect(arr!.__type).toBe('array');
      const attrs = (arr as any).attributes as Map<any, any>;
      expect(attrs).toBeDefined();
      const kv = Array.from(attrs.entries());
      expect(kv[0]![0]).toEqual({ __type: 'simple_string', value: 'meta' });
      expect(kv[0]![1]).toEqual({ __type: 'simple_string', value: 'yes' });
    });

    it('does not leak attributes to later nodes', () => {
      const { parser, replies } = mkParser();
      parser.feed(B('|1\r\n+a\r\n+b\r\n+first\r\n+second\r\n'));
      expect((replies[0] as any).attributes).toBeDefined();
      expect((replies[1] as any).attributes).toBeUndefined();
    });

    it('can decorate nested child values inside aggregates', () => {
      const { parser, replies } = mkParser();
      // Array of 2: (attributes -> +X), +Y
      parser.feed(B('*2\r\n|1\r\n+k\r\n+v\r\n+X\r\n+Y\r\n'));
      const arr = replies[0];
      const items = (arr as any).value as Resp3[];
      const first = items[0] as any;
      const second = items[1] as any;
      expect(first.attributes).toBeDefined();
      expect(second.attributes).toBeUndefined();
    });
  });

  describe('streaming / partial chunks', () => {
    it('handles split frames across arbitrary chunk boundaries', () => {
      const { parser, replies } = mkParser();

      // Push data in small pieces, splitting CRLF and payload boundaries deliberately
      const chunks = [
        '+O', 'K\r', '\n', // simple string
        ':4', '2', '\r', '\n', // integer
        '$5', '\r', '\n', 'he', 'l', 'l', 'o', '\r', '\n', // blob string
        '*2', '\r', '\n', '+a', '\r', '\n', ':1', '\r', '\n', // array
      ];
      chunks.forEach((s) => parser.feed(B(s)));

      expect(replies).toHaveLength(4);

      expect(replies[0]).toEqual({ __type: 'simple_string', value: 'OK' });
      expect(replies[1]).toEqual({ __type: 'integer', value: 42n });

      const b = replies[2] as any;
      expect(b.__type).toBe('blob_string');
      expect(Buffer.isBuffer(b.value)).toBe(true);
      expect(b.value.toString()).toBe('hello');

      const arr = replies[3] as any;
      expect(arr.__type).toBe('array');
      expect((arr.value as Resp3[])[0]).toEqual({ __type: 'simple_string', value: 'a' });
      expect((arr.value as Resp3[])[1]).toEqual({ __type: 'integer', value: 1n });
    });

    it('waits for complete blob payload including trailing CRLF', () => {
      const { parser, replies } = mkParser();
      parser.feed(B('$5\r\nhe'));
      expect(replies).toHaveLength(0);
      parser.feed(B('llo'));
      expect(replies).toHaveLength(0);
      parser.feed(B('\r\n'));
      expect(replies).toHaveLength(1);
      expect((replies[0] as any).value.toString()).toBe('hello');
    });

    it('handles nested aggregates with deep partial splits', () => {
      const { parser, replies } = mkParser();
      // Array of 2: Map(1) { +k => :1 }, and Set(1) { +x }
      const msg = '*2\r\n%1\r\n+k\r\n:1\r\n~1\r\n+x\r\n';
      for (const ch of msg.split('')) {
        parser.feed(B(ch)); // byte-by-byte
      }
      expect(replies).toHaveLength(1);
      const arr = replies[0] as any;
      expect(arr.__type).toBe('array');

      const [mapNode, setNode] = arr.value as Resp3[];
      expect(mapNode!.__type).toBe('map');
      expect(setNode!.__type).toBe('set');
    });
  });

  describe('errors & recovery', () => {
    it('reports error on invalid prefix and recovers after reset', () => {
      const { parser, replies, errors } = mkParser();
      parser.feed(B('?invalid\r\n'));
      expect(errors.length).toBeGreaterThan(0);

      // after error, the parser resets; next good input should parse
      parser.feed(B('+OK\r\n'));
      expect(replies).toHaveLength(1);
      expect(replies[0]).toEqual({ __type: 'simple_string', value: 'OK' });
    });

    it('error on invalid double, then parse next', () => {
      const { parser, replies, errors } = mkParser();
      parser.feed(B(',not-a-number\r\n'));
      expect(errors).toHaveLength(1);
      parser.feed(B(':1\r\n'));
      expect(replies[0]).toEqual({ __type: 'integer', value: 1n });
    });

    it('error on invalid boolean marker', () => {
      const { parser, errors } = mkParser();
      parser.feed(B('#x\r\n'));
      expect(errors).toHaveLength(1);
    });

    it('error when blob not terminated by CRLF', () => {
      const { parser, errors } = mkParser();
      // Says length=3 but then gives "ab" + wrong ending
      parser.feed(B('$3\r\nab\rx'));
      expect(errors).toHaveLength(1);
    });

    it('error when null marker has extra payload', () => {
      const { parser, errors } = mkParser();
      parser.feed(B('_oops\r\n'));
      expect(errors).toHaveLength(1);
    });
  });

  describe('misc edge cases', () => {
    it('push with -1 length becomes empty push', () => {
      const { parser, pushes } = mkParser();
      parser.feed(B('>-1\r\n'));
      expect(pushes).toHaveLength(1);
      expect(pushes[0]).toEqual({ __type: 'push', value: [] });
    });

    it('attributes precede aggregate and do not apply to later siblings', () => {
      const { parser, replies } = mkParser();
      // | {a:b} then array [OK], then simple string "later"
      parser.feed(B('|1\r\n+a\r\n+b\r\n*1\r\n+OK\r\n+later\r\n'));

      const arr = replies[0] as any;
      const later = replies[1] as any;

      expect(arr.__type).toBe('array');
      expect(arr.attributes).toBeDefined();
      expect(later.__type).toBe('simple_string');
      expect(later.attributes).toBeUndefined();
    });

    it('handles long blob, split across many chunks', () => {
      const { parser, replies } = mkParser();
      const payload = 'x'.repeat(8192);
      const frame = `$${payload.length}\r\n${payload}\r\n`;
      for (let i = 0; i < frame.length; i += 7) {
        parser.feed(B(frame.slice(i, i + 7)));
      }
      expect(replies).toHaveLength(1);
      const v = replies[0] as any;
      expect(v.__type).toBe('blob_string');
      expect((v.value as Buffer).length).toBe(8192);
      expect((v.value as Buffer).toString()).toBe(payload);
    });

    it('multiple top-level replies in one chunk', () => {
      const { parser, replies } = mkParser();
      parser.feed(B('+A\r\n+B\r\n+C\r\n'));
      expect(replies.map((r) => (r as any).value)).toEqual(['A', 'B', 'C']);
    });

    it('map/attributes length 0 resolves immediately', () => {
      const { parser, replies } = mkParser();
      parser.feed(B('%0\r\n')); // empty map
      parser.feed(B('|0\r\n+OK\r\n')); // attributes empty then simple string
      expect(replies[0]).toEqual({ __type: 'map', value: new Map() });
      const s = replies[1] as any;
      expect(s.__type).toBe('null');
      expect(s.attributes).toEqual(new Map());
    });
  });
});
