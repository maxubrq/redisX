import { Buffer } from 'buffer';
import type { Resp3, Resp3Attributes } from './parser';

/**
 * Interface for encoding RESP3 values to wire format
 */
export interface IResp3Writer {
    /**
     * Encode a RESP3 value to Buffer
     */
    encode(value: Resp3): Buffer;
    
    /**
     * Encode multiple RESP3 values to a single Buffer
     */
    encodeArray(values: Resp3[]): Buffer;
    
    /**
     * Encode a command array (for sending commands to Redis)
     */
    encodeCommand(command: string, ...args: (string | number | Buffer)[]): Buffer;
}

/**
 * Writer options for customizing encoding behavior
 */
export interface WriterOptions {
    /**
     * Whether to encode strings as UTF-8 by default (default: true)
     */
    encodeStringsAsUtf8?: boolean;
    
    /**
     * Custom buffer size for initial allocation (default: 1024)
     */
    initialBufferSize?: number;
}

/**
 * RESP3 Writer implementation
 * 
 * Encodes RESP3 values to the wire format according to the RESP3 specification.
 * Supports all RESP3 types including simple strings, errors, integers, doubles,
 * big numbers, booleans, nulls, blob strings, verbatim strings, arrays, maps,
 * sets, pushes, and attributes.
 */
export class Resp3Writer implements IResp3Writer {
    private readonly options: Required<WriterOptions>;
    private _buffer: Buffer;
    private _offset: number;

    constructor(options: WriterOptions = {}) {
        this.options = {
            encodeStringsAsUtf8: options.encodeStringsAsUtf8 ?? true,
            initialBufferSize: options.initialBufferSize ?? 1024,
        };
        this._buffer = Buffer.alloc(this.options.initialBufferSize);
        this._offset = 0;
    }

    /**
     * Encode a single RESP3 value to Buffer
     */
    encode(value: Resp3): Buffer {
        this.reset();
        this.writeValue(value);
        return this._buffer.subarray(0, this._offset);
    }

    /**
     * Encode multiple RESP3 values to a single Buffer
     */
    encodeArray(values: Resp3[]): Buffer {
        this.reset();
        this.writeArray(values);
        return this._buffer.subarray(0, this._offset);
    }

    /**
     * Encode a command array for sending to Redis
     */
    encodeCommand(command: string, ...args: (string | number | Buffer)[]): Buffer {
        this.reset();
        this.writeArrayHeader(args.length + 1);
        this.writeBulkString(command);
        for (const arg of args) {
            if (typeof arg === 'string') {
                this.writeBulkString(arg);
            } else if (typeof arg === 'number') {
                this.writeBulkString(arg.toString());
            } else if (Buffer.isBuffer(arg)) {
                this.writeBulkString(arg);
            } else {
                this.writeBulkString(String(arg));
            }
        }
        return this._buffer.subarray(0, this._offset);
    }

    private reset(): void {
        this._offset = 0;
        // Ensure we have enough capacity for the initial buffer size
        if (this._buffer.length < this.options.initialBufferSize) {
            this._buffer = Buffer.alloc(this.options.initialBufferSize);
        }
    }

    private ensureCapacity(needed: number): void {
        const required = this._offset + needed;
        if (required > this._buffer.length) {
            const newSize = Math.max(required, this._buffer.length * 2);
            const newBuffer = Buffer.alloc(newSize);
            this._buffer.copy(newBuffer, 0, 0, this._offset);
            this._buffer = newBuffer;
        }
    }

    private writeByte(byte: number): void {
        this.ensureCapacity(1);
        this._buffer[this._offset++] = byte;
    }

    private writeBytes(data: Buffer | Uint8Array): void {
        this.ensureCapacity(data.length);
        this._buffer.set(data, this._offset);
        this._offset += data.length;
    }

    private writeString(str: string): void {
        const bytes = Buffer.from(str, 'utf8');
        this.writeBytes(bytes);
    }

    private writeCRLF(): void {
        this.ensureCapacity(2);
        this._buffer[this._offset++] = 0x0d; // \r
        this._buffer[this._offset++] = 0x0a; // \n
    }

    private writeValue(value: Resp3): void {
        // Write attributes first if they exist
        if (value.attributes && value.attributes.size > 0) {
            this.writeAttributes(value.attributes);
        }

        switch (value.__type) {
            case 'simple_string':
                this.writeSimpleString(value.value);
                break;
            case 'error':
                this.writeError(value.code, value.message);
                break;
            case 'integer':
                this.writeInteger(value.value);
                break;
            case 'double':
                this.writeDouble(value.value);
                break;
            case 'big_number':
                this.writeBigNumber(value.value);
                break;
            case 'boolean':
                this.writeBoolean(value.value);
                break;
            case 'null':
                this.writeNull();
                break;
            case 'blob_string':
                this.writeBlobString(value.value);
                break;
            case 'blob_error':
                this.writeBlobError(value.code, value.message);
                break;
            case 'verbatim_string':
                this.writeVerbatimString(value.format, value.value);
                break;
            case 'array':
                this.writeArray(value.value);
                break;
            case 'map':
                this.writeMap(value.value);
                break;
            case 'set':
                this.writeSet(value.value);
                break;
            case 'push':
                this.writePush(value.value);
                break;
            default:
                throw new Error(`Unknown RESP3 type: ${(value as any).__type}`);
        }
    }

    private writeSimpleString(str: string): void {
        this.writeByte(0x2b); // '+'
        this.writeString(str);
        this.writeCRLF();
    }

    private writeError(code: string | undefined, message: string): void {
        this.writeByte(0x2d); // '-'
        if (code) {
            this.writeString(`${code} ${message}`);
        } else {
            this.writeString(message);
        }
        this.writeCRLF();
    }

    private writeInteger(value: bigint): void {
        this.writeByte(0x3a); // ':'
        this.writeString(value.toString());
        this.writeCRLF();
    }

    private writeDouble(value: number): void {
        this.writeByte(0x2c); // ','
        if (Number.isFinite(value)) {
            this.writeString(value.toString());
        } else if (Number.isNaN(value)) {
            this.writeString('nan');
        } else if (value === Infinity) {
            this.writeString('inf');
        } else if (value === -Infinity) {
            this.writeString('-inf');
        } else {
            this.writeString(value.toString());
        }
        this.writeCRLF();
    }

    private writeBigNumber(value: bigint | string): void {
        this.writeByte(0x28); // '('
        this.writeString(value.toString());
        this.writeCRLF();
    }

    private writeBoolean(value: boolean): void {
        this.writeByte(0x23); // '#'
        this.writeString(value ? 't' : 'f');
        this.writeCRLF();
    }

    private writeNull(): void {
        this.writeByte(0x5f); // '_'
        this.writeCRLF();
    }

    private writeBlobString(value: Buffer | null): void {
        this.writeByte(0x24); // '$'
        if (value === null) {
            this.writeString('-1');
            this.writeCRLF();
        } else {
            this.writeString(value.length.toString());
            this.writeCRLF();
            this.writeBytes(value);
            this.writeCRLF();
        }
    }

    private writeBlobError(code: string | undefined, message: string): void {
        this.writeByte(0x21); // '!'
        const content = code ? `${code} ${message}` : message;
        const contentBytes = Buffer.from(content, 'utf8');
        this.writeString(contentBytes.length.toString());
        this.writeCRLF();
        this.writeBytes(contentBytes);
        this.writeCRLF();
    }

    private writeVerbatimString(format: string, value: string): void {
        this.writeByte(0x3d); // '='
        const content = `${format}:${value}`;
        const contentBytes = Buffer.from(content, 'utf8');
        this.writeString(contentBytes.length.toString());
        this.writeCRLF();
        this.writeBytes(contentBytes);
        this.writeCRLF();
    }

    private writeArray(values: Resp3[] | null): void {
        this.writeByte(0x2a); // '*'
        if (values === null) {
            this.writeString('-1');
            this.writeCRLF();
        } else {
            this.writeString(values.length.toString());
            this.writeCRLF();
            for (const value of values) {
                this.writeValue(value);
            }
        }
    }

    private writeMap(map: Map<unknown, unknown> | null): void {
        this.writeByte(0x25); // '%'
        if (map === null) {
            this.writeString('-1');
            this.writeCRLF();
        } else {
            this.writeString(map.size.toString());
            this.writeCRLF();
            for (const [key, value] of map) {
                // Convert key and value to proper RESP3 types
                const keyResp3 = this.convertToResp3(key);
                const valueResp3 = this.convertToResp3(value);
                this.writeValue(keyResp3);
                this.writeValue(valueResp3);
            }
        }
    }

    private writeSet(set: Set<unknown> | null): void {
        this.writeByte(0x7e); // '~'
        if (set === null) {
            this.writeString('-1');
            this.writeCRLF();
        } else {
            this.writeString(set.size.toString());
            this.writeCRLF();
            for (const value of set) {
                this.writeValue(value as Resp3);
            }
        }
    }

    private writePush(values: Resp3[]): void {
        this.writeByte(0x3e); // '>'
        this.writeString(values.length.toString());
        this.writeCRLF();
        for (const value of values) {
            this.writeValue(value);
        }
    }

    private writeAttributes(attributes: Resp3Attributes): void {
        this.writeByte(0x7c); // '|'
        this.writeString(attributes.size.toString());
        this.writeCRLF();
        for (const [key, value] of attributes) {
            // Convert key and value to proper RESP3 types
            const keyResp3 = this.convertToResp3(key);
            const valueResp3 = this.convertToResp3(value);
            this.writeValue(keyResp3);
            this.writeValue(valueResp3);
        }
    }

    private writeArrayHeader(length: number): void {
        this.writeByte(0x2a); // '*'
        this.writeString(length.toString());
        this.writeCRLF();
    }

    private writeBulkString(value: string | Buffer): void {
        this.writeByte(0x24); // '$'
        if (typeof value === 'string') {
            const bytes = Buffer.from(value, 'utf8');
            this.writeString(bytes.length.toString());
            this.writeCRLF();
            this.writeBytes(bytes);
        } else {
            this.writeString(value.length.toString());
            this.writeCRLF();
            this.writeBytes(value);
        }
        this.writeCRLF();
    }

    private convertToResp3(value: unknown): Resp3 {
        // If it's already a Resp3 object, return it
        if (value && typeof value === 'object' && '__type' in value) {
            return value as Resp3;
        }
        
        if (value === null || value === undefined) {
            return { __type: 'null' };
        }
        
        if (typeof value === 'string') {
            return { __type: 'simple_string', value };
        }
        
        if (typeof value === 'number') {
            if (Number.isInteger(value)) {
                return { __type: 'integer', value: BigInt(value) };
            } else {
                return { __type: 'double', value };
            }
        }
        
        if (typeof value === 'bigint') {
            return { __type: 'integer', value };
        }
        
        if (typeof value === 'boolean') {
            return { __type: 'boolean', value };
        }
        
        if (Buffer.isBuffer(value)) {
            return { __type: 'blob_string', value };
        }
        
        if (Array.isArray(value)) {
            const resp3Array = value.map(item => this.convertToResp3(item));
            return { __type: 'array', value: resp3Array };
        }
        
        if (value instanceof Map) {
            return { __type: 'map', value };
        }
        
        if (value instanceof Set) {
            return { __type: 'set', value };
        }
        
        // For objects, try to convert to simple string
        return { __type: 'simple_string', value: String(value) };
    }
}
