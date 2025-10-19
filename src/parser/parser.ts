/* eslint-disable @typescript-eslint/ban-types */
import { Buffer } from 'buffer';

/** RESP3 value model (you can tweak to your taste/SDK) */
export type Resp3 =
    | Resp3SimpleString
    | Resp3Error
    | Resp3Integer
    | Resp3Double
    | Resp3BigNumber
    | Resp3Boolean
    | Resp3Null
    | Resp3BlobString
    | Resp3BlobError
    | Resp3VerbatimString
    | Resp3Array
    | Resp3Map
    | Resp3Set
    | Resp3Push;

export type Resp3SimpleString = {
    __type: 'simple_string';
    value: string;
    attributes?: Resp3Attributes;
};
export type Resp3Error = {
    __type: 'error';
    code?: string;
    message: string;
    attributes?: Resp3Attributes;
};
export type Resp3Integer = { __type: 'integer'; value: bigint; attributes?: Resp3Attributes };
export type Resp3Double = { __type: 'double'; value: number; attributes?: Resp3Attributes };
export type Resp3BigNumber = {
    __type: 'big_number';
    value: bigint | string;
    attributes?: Resp3Attributes;
};
export type Resp3Boolean = { __type: 'boolean'; value: boolean; attributes?: Resp3Attributes };
export type Resp3Null = { __type: 'null'; attributes?: Resp3Attributes };
export type Resp3BlobString = {
    __type: 'blob_string';
    value: Buffer | null;
    attributes?: Resp3Attributes;
};
export type Resp3BlobError = {
    __type: 'blob_error';
    code?: string;
    message: string;
    attributes?: Resp3Attributes;
};
export type Resp3VerbatimString = {
    __type: 'verbatim_string';
    format: string;
    value: string;
    attributes?: Resp3Attributes;
};
export type Resp3Array = { __type: 'array'; value: Resp3[] | null; attributes?: Resp3Attributes };
export type Resp3Map = {
    __type: 'map';
    value: Map<unknown, unknown> | null;
    attributes?: Resp3Attributes;
};
export type Resp3Set = { __type: 'set'; value: Set<unknown> | null; attributes?: Resp3Attributes };
export type Resp3Push = { __type: 'push'; value: Resp3[]; attributes?: Resp3Attributes };

export type Resp3Attributes = Map<unknown, unknown>;

type AggregateKind = 'array' | 'map' | 'set' | 'attributes' | 'push';

/** A frame on the aggregate stack while parsing nested structures */
interface FrameBase {
    kind: AggregateKind;
    remaining: number; // number of element slots left to fill (pairs for maps)
    items: unknown[]; // temp collection of child values (flat)
    attrs?: Resp3Attributes; // attributes captured *before* this aggregate (if any)
}

interface MapFrame extends FrameBase {
    kind: 'map' | 'attributes';
    // for map/attributes, items collects [k1, v1, k2, v2, ...]
}

interface ArrayFrame extends FrameBase {
    kind: 'array' | 'push' | 'set';
}

type Frame = MapFrame | ArrayFrame;

export interface ParserOptions {
    onReply?: (value: Resp3) => void; // regular replies
    onPush?: (value: Resp3Push) => void; // server >push messages
    onError?: (err: Error) => void; // decode/format errors
    /** If true, blob strings are returned as utf8 strings (when valid). Default: false (Buffer). */
    decodeBlobAsString?: boolean;
}

export interface IResp3Parser {
    feed(chunk: Buffer): void;
}

const NEED_MORE = Symbol('NEED_MORE');

export class Resp3Parser implements IResp3Parser {
    private _buffer: Buffer<ArrayBufferLike> = Buffer.alloc(0);
    private _offset: number = 0;
    private _frames: Frame[] = [];
    private _pendingAttributes: Resp3Attributes | undefined;

    constructor(private opts: ParserOptions = {}) {}

    private attachAttrs<T extends { attributes?: Resp3Attributes }>(node: T): T {
        if (this._pendingAttributes) {
            node.attributes = this._pendingAttributes;
            this._pendingAttributes = undefined;
        }
        // advance past prefix already consumed by readLine/readLen callers
        // NOTE: Most callers readLine/readLenAfterPrefix already advanced offsets correctly.
        // For leaf types, we started at prefix; readLine consumes CRLF and moves offset accordingly; OK.
        return node;
    }

    private attachExplicitAttrs<T extends { attributes?: Resp3Attributes }>(
        node: T,
        attrs?: Resp3Attributes,
    ): T {
        if (attrs) node.attributes = attrs;
        return node;
    }

    private parseSimpleString(): Resp3 | typeof NEED_MORE {
        // '+<line>\r\n'
        if (this._buffer[this._offset] !== 0x2b) return NEED_MORE;
        const line = this.readLine();
        if (line === NEED_MORE) return NEED_MORE;
        return this.attachAttrs({ __type: 'simple_string', value: line } as Resp3SimpleString);
    }

    private parseError(): Resp3 | typeof NEED_MORE {
        // '-<code> <message>\r\n'   code is optional
        if (this._buffer[this._offset] !== 0x2d) return NEED_MORE;
        const line = this.readLine();
        if (line === NEED_MORE) return NEED_MORE;
        const sp = line.indexOf(' ');
        const code = sp > 0 ? line.slice(0, sp) : undefined;
        const message = sp > 0 ? line.slice(sp + 1) : line;
        return this.attachAttrs({ __type: 'error', code, message } as Resp3Error);
    }

    private parseInteger(): Resp3 | typeof NEED_MORE {
        // ':<number>\r\n' (up to 64-bit; use bigint)
        if (this._buffer[this._offset] !== 0x3a) return NEED_MORE;
        const line = this.readLine();
        if (line === NEED_MORE) return NEED_MORE;
        try {
            const v = BigInt(line);
            return this.attachAttrs({ __type: 'integer', value: v } as Resp3Integer);
        } catch {
            throw new Error(`Invalid integer "${line}"`);
        }
    }

    private parseBlobStringLike(kind: '$' | '!'): Resp3 | typeof NEED_MORE {
        // '$<len>\r\n<payload>\r\n'  (len may be -1 in RESP2 compat => treat as null blob string)
        // '!<len>\r\n<payload>\r\n'  (blob error)
        const isBlobErr = kind === '!';
        if (this._buffer[this._offset] !== (isBlobErr ? 0x21 : 0x24)) return NEED_MORE;

        const len = this.readLenAfterPrefix();
        if (len === NEED_MORE) return NEED_MORE;

        if (len === -1) {
            // null blob
            if (isBlobErr) {
                // Some servers may not send -1 for blob error; if they do, treat as empty message.
                return this.attachAttrs({ __type: 'blob_error', message: '' } as Resp3BlobError);
            }
            return this.attachAttrs({ __type: 'blob_string', value: null } as Resp3BlobString);
        }

        // need len bytes + CRLF
        if (!this.ensure(len + 2)) return NEED_MORE;
        const payload = this._buffer.subarray(this._offset, this._offset + len);
        this._offset += len;

        // expect CRLF
        if (!this.ensure(2)) return NEED_MORE;
        if (this._buffer[this._offset] !== 0x0d || this._buffer[this._offset + 1] !== 0x0a) {
            throw new Error('Blob not terminated by CRLF');
        }
        this._offset += 2;

        if (isBlobErr) {
            const text = payload.toString('utf8');
            const sp = text.indexOf(' ');
            const code = sp > 0 ? text.slice(0, sp) : undefined;
            const message = sp > 0 ? text.slice(sp + 1) : text;
            return this.attachAttrs({ __type: 'blob_error', code, message } as Resp3BlobError);
        } else {
            if (this.opts.decodeBlobAsString) {
                return this.attachAttrs({
                    __type: 'blob_string',
                    value: Buffer.from(payload).toString('utf8') as any,
                } as Resp3BlobString);
            }
            return this.attachAttrs({
                __type: 'blob_string',
                value: Buffer.from(payload),
            } as Resp3BlobString);
        }
    }

    private parseVerbatimString(): Resp3 | typeof NEED_MORE {
        // '=<len>\r\n<fmt>:<data>\r\n' (fmt is usually 'txt', 'mkd', 'html')
        if (this._buffer[this._offset] !== 0x3d) return NEED_MORE;
        const len = this.readLenAfterPrefix();
        if (len === NEED_MORE) return NEED_MORE;
        if (len < 0) throw new Error('Invalid verbatim length');

        if (!this.ensure(len + 2)) return NEED_MORE;
        const payload = this._buffer.subarray(this._offset, this._offset + len);
        this._offset += len;

        if (!this.ensure(2)) return NEED_MORE;
        if (this._buffer[this._offset] !== 0x0d || this._buffer[this._offset + 1] !== 0x0a) {
            throw new Error('Verbatim not terminated by CRLF');
        }
        this._offset += 2;

        const text = payload.toString('utf8');
        const colon = text.indexOf(':');
        const format = colon > 0 ? text.slice(0, colon) : 'txt';
        const value = colon > 0 ? text.slice(colon + 1) : text;
        return this.attachAttrs({
            __type: 'verbatim_string',
            format,
            value,
        } as Resp3VerbatimString);
    }

    private aggregateNull(kind: 'array' | 'map' | 'set' | 'push' | 'attributes'): Resp3 {
        switch (kind) {
            case 'array':
                return { __type: 'array', value: null };
            case 'map':
                return { __type: 'map', value: null };
            case 'set':
                return { __type: 'set', value: null };
            case 'push':
                return { __type: 'push', value: [] }; // push with -1 length is unusual; treat as empty
            case 'attributes':
                return { __type: 'null' };
        }
    }

    private stealPendingAttributes(): Resp3Attributes | undefined {
        const a = this._pendingAttributes;
        this._pendingAttributes = undefined;
        return a;
    }

    private finalizeFrameInstant(frame: Frame): Resp3 {
        switch (frame.kind) {
            case 'array': {
                const arr: Resp3[] = frame.items as Resp3[];
                return { __type: 'array', value: arr };
            }
            case 'set': {
                const set = new Set<unknown>();
                for (const it of frame.items) set.add(it);
                return { __type: 'set', value: set };
            }
            case 'map': {
                const map = new Map<unknown, unknown>();
                for (let i = 0; i < frame.items.length; i += 2) {
                    map.set(frame.items[i], frame.items[i + 1]);
                }
                return { __type: 'map', value: map };
            }
            case 'attributes': {
                // Attributes decorate the NEXT value; here we convert items into a Map and store in pendingAttributes
                const attrs = new Map<unknown, unknown>();
                for (let i = 0; i < frame.items.length; i += 2) {
                    attrs.set(frame.items[i], frame.items[i + 1]);
                }
                // store as pending and return a special placeholder (not emitted as a value)
                this._pendingAttributes = attrs;
                // Return a zero-length simple string placeholder; it will be ignored by caller (we manage it internally)
                // BUT to keep the caller flow simple, we return a Null that will be dropped in handleValue().
                return { __type: 'null' };
            }
            case 'push': {
                const arr: Resp3[] = frame.items as Resp3[];
                return { __type: 'push', value: arr };
            }
        }
    }

    private consumeNested(): Resp3 | typeof NEED_MORE | undefined {
        // Loop: keep parsing children until we either need more data or we complete 1+ frames
        while (this._frames.length > 0) {
            const start = this._offset;
            const child = this.parseOne();
            if (child === NEED_MORE) {
                this._offset = start;
                return NEED_MORE;
            }
            if (child === undefined) {
                this._offset = start;
                return NEED_MORE;
            }

            // child produced -> attach into current frame
            const top = this._frames[this._frames.length - 1]!;
            top.items.push(child);
            top.remaining -= 1;

            if (top.remaining > 0) {
                // continue to fill the same frame
                continue;
            }

            // finalize top frame
            const completed = this.finalizeFrameInstant(top);
            this._frames.pop();

            // attach attributes that were pending *before* the aggregate marker
            const withAttrs = this.attachExplicitAttrs(completed, top.attrs);

            if (this._frames.length === 0) {
                // we completed a full top-level value
                return withAttrs;
            } else {
                // This completed value becomes a child of parent frame; loop again to place it
                // but to do that, we need to push it back as a parsed node without re-parsing.
                // Easiest: emulate that we "just parsed" this completed node by pushing into parent.
                const parent = this._frames[this._frames.length - 1]!;
                parent.items.push(withAttrs);
                parent.remaining -= 1;
                if (parent.remaining === 0) {
                    // Parent also completes; keep collapsing possibly multiple levels.
                    continue;
                }
                // Otherwise keep parsing children for the current (still-incomplete) parent.
            }
        }

        // No frames means no aggregate in progress
        return undefined;
    }

    private parseAggregate(
        kind: 'array' | 'map' | 'set' | 'push' | 'attributes',
    ): Resp3 | typeof NEED_MORE | undefined {
        // '*', '%', '~', '>', '|' followed by length, then that many elements (pairs for maps/attributes)
        const expectedPrefix =
            kind === 'array'
                ? 0x2a
                : kind === 'map'
                  ? 0x25
                  : kind === 'set'
                    ? 0x7e
                    : kind === 'push'
                      ? 0x3e
                      : 0x7c; // attributes '|'
        if (this._buffer[this._offset] !== expectedPrefix) return NEED_MORE;

        const length = this.readLenAfterPrefix();
        if (length === NEED_MORE) return NEED_MORE;

        // RESP3 generally uses '_' for null, but RESP2-compat can send -1 for arrays/maps/sets => treat as null aggregate.
        if (length === -1) {
            const base = this.aggregateNull(kind);
            return this.attachAttrs(base);
        }

        let frame: Frame = {
            kind: kind as any,
            remaining: kind === 'map' || kind === 'attributes' ? length * 2 : length,
            items: [],
            attrs: this.stealPendingAttributes() as any,
        };

        // If length is 0, we can finalize immediately
        if (frame.remaining === 0) {
            return this.attachAttrs(this.finalizeFrameInstant(frame));
        }

        // Push frame and continue parsing nested children
        this._frames.push(frame);
        return this.consumeNested();
    }

    private parseNull(): Resp3 | typeof NEED_MORE {
        // '_\r\n'
        if (this._buffer[this._offset] !== 0x5f) return NEED_MORE;
        const line = this.readLine();
        if (line === NEED_MORE) return NEED_MORE;
        if (line !== '') throw new Error('Invalid null marker');
        return this.attachAttrs({ __type: 'null' } as Resp3Null);
    }

    private parseBoolean(): Resp3 | typeof NEED_MORE {
        // '#t\r\n' or '#f\r\n' (RESP3)
        if (this._buffer[this._offset] !== 0x23) return NEED_MORE;
        const line = this.readLine();
        if (line === NEED_MORE) return NEED_MORE;
        if (line !== 't' && line !== 'f') throw new Error(`Invalid boolean "${line}"`);
        return this.attachAttrs({ __type: 'boolean', value: line === 't' } as Resp3Boolean);
    }

    private parseDouble(): Resp3 | typeof NEED_MORE {
        // ',<float>\r\n' supports inf, -inf, nan per RESP3
        if (this._buffer[this._offset] !== 0x2c) return NEED_MORE;
        const line = this.readLine();
        if (line === NEED_MORE) return NEED_MORE;
        const lower = line.toLowerCase();
        const v =
            lower === 'inf'
                ? Infinity
                : lower === '-inf'
                  ? -Infinity
                  : lower === 'nan'
                    ? NaN
                    : Number.parseFloat(line);
        if (Number.isNaN(v) && lower !== 'nan') {
            throw new Error(`Invalid double "${line}"`);
        }
        return this.attachAttrs({ __type: 'double', value: v } as Resp3Double);
    }

    private parseBigNumber(): Resp3 | typeof NEED_MORE {
        // '(<digits>\r\n' (arbitrary precision integer); keep as bigint if possible
        if (this._buffer[this._offset] !== 0x28) return NEED_MORE;
        const line = this.readLine();
        if (line === NEED_MORE) return NEED_MORE;
        try {
            // BigInt rejects + or leading zeros weirdness, but RESP3 big numbers are arbitrary.
            // Try BigInt, fallback to string if it fails.
            const v = BigInt(line);
            return this.attachAttrs({ __type: 'big_number', value: v } as Resp3BigNumber);
        } catch {
            return this.attachAttrs({ __type: 'big_number', value: line } as Resp3BigNumber);
        }
    }

    private parseOne(): Resp3 | typeof NEED_MORE | undefined {
        if (this._offset >= this._buffer.length) return undefined;

        const prefix = this._buffer[this._offset]; // Type prefix, first byte.

        // we always need at least the prefix + something
        if (prefix === undefined) return NEED_MORE;

        switch (prefix) {
            case 0x2b:
                return this.parseSimpleString(); // '+'
            case 0x2d:
                return this.parseError(); // '-'
            case 0x3a:
                return this.parseInteger(); // ':'
            case 0x24:
                return this.parseBlobStringLike('$'); // '$'
            case 0x21:
                return this.parseBlobStringLike('!'); // '!'  (blob error)
            case 0x3d:
                return this.parseVerbatimString(); // '='
            case 0x2a:
                return this.parseAggregate('array'); // '*'
            case 0x25:
                return this.parseAggregate('map'); // '%'
            case 0x7e:
                return this.parseAggregate('set'); // '~'
            case 0x3e:
                return this.parseAggregate('push'); // '>'
            case 0x7c:
                return this.parseAggregate('attributes'); // '|'
            case 0x5f:
                return this.parseNull(); // '_'
            case 0x23:
                return this.parseBoolean(); // '#'
            case 0x2c:
                return this.parseDouble(); // ','
            case 0x28:
                return this.parseBigNumber(); // '('
            default:
                throw new Error(`Unknown RESP3 prefix: 0x${prefix.toString(16)}`);
        }
    }

    private readLine(): string | typeof NEED_MORE {
        // find CRLF from current offset
        const i = this._buffer.indexOf('\r\n', this._offset, 'utf8');
        if (i === -1) return NEED_MORE;
        const line = this._buffer.toString('utf8', this._offset + 1, i); // skip prefix at [offset]
        // advance offset to just past CRLF
        this._offset = i + 2;
        return line;
    }

    private readLenAfterPrefix(): number | typeof NEED_MORE {
        const i = this._buffer.indexOf('\r\n', this._offset + 1, 'utf8');
        if (i === -1) return NEED_MORE;
        const s = this._buffer.toString('utf8', this._offset + 1, i);
        this._offset = i + 2;
        const n = Number.parseInt(s, 10);
        if (!Number.isFinite(n) || !Number.isInteger(n)) {
            throw new Error(`Invalid length "${s}"`);
        }
        return n;
    }

    private ensure(n: number): boolean {
        return this._buffer.length - this._offset >= n;
    }

    private handleValue(node: Resp3) {
        // Drop internal-null used as attributes placeholder
        if (node.__type === 'null' && node.attributes === undefined && this._frames.length > 0)
            return;

        // Push frames go to onPush if provided, else surface as normal
        if (node.__type === 'push') {
            if (this.opts.onPush) {
                this.opts.onPush(node);
                return;
            }
            // fallthrough: treat like a normal reply if no push handler
        }

        this.opts.onReply?.(node);
    }

    private reportError(error: Error) {
        this.opts.onError?.(error);
    }

    private reset() {
        this._buffer = Buffer.alloc(0);
        this._offset = 0;
        this._frames = [];
        this._pendingAttributes = undefined;
    }

    feed(chunk: Buffer): void {
        if (!chunk || chunk.length === 0) return;
        // concat with leftover buffer (slice to unread)
        if (this._offset === 0 && this._buffer.length === 0) {
            this._buffer = chunk;
        } else {
            // drop consumed part first
            if (this._offset > 0) {
                this._buffer = this._buffer.subarray(this._offset);
                this._offset = 0;
            }
            this._buffer = Buffer.concat([this._buffer, chunk]);
        }

        // parse as much as we can
        try {
            // eslint-disable-next-line no-constant-condition
            while (true) {
                const start = this._offset;
                const node = this.parseOne();
                if (node === NEED_MORE) {
                    // rollback to start of this value
                    this._offset = start;
                    break;
                }
                if (node === undefined) break; // nothing to parse
                this.handleValue(node);
            }
        } catch (err) {
            this.reportError(err as Error);
            // In case of hard decode error, drop buffer to resync on next frame.
            this.reset();
        }
    }
}
