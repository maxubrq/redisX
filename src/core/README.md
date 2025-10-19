# redisX Core Module

The core module provides the main Redis client API for redisX, integrating the transport layer (`net`) and protocol layer (`parser_writer`) into a cohesive, type-safe Redis client.

## Features

- **Type-Safe Commands**: Full TypeScript support with autocomplete and type checking
- **Connection Management**: Auto-connect and explicit connect modes
- **Event-Driven**: Rich event system for monitoring and debugging
- **Error Handling**: Comprehensive error hierarchy with context
- **Modular API**: Clean separation of concerns with discoverable APIs
- **RESP3 Support**: Full Redis Serialization Protocol version 3 support

## Quick Start

```typescript
import { createClient } from 'redisx';

// Create and connect to Redis
const client = await createClient({
  host: 'localhost',
  port: 6379,
});

// Use typed commands
await client.commands.set('key', 'value');
const value = await client.commands.get('key'); // string | null

// Disconnect when done
await client.disconnect();
```

## API Overview

### Client Creation

```typescript
import { createClient, RedisClient } from 'redisx';

// Factory function (recommended)
const client = await createClient({
  host: 'localhost',
  port: 6379,
  autoConnect: true, // default
});

// Direct instantiation
const client = new RedisClient({
  host: 'localhost',
  port: 6379,
  autoConnect: false,
});
await client.connect();
```

### Configuration Options

```typescript
interface ClientOptions {
  url?: string;                    // Redis URL (redis://user:pass@host:port/db)
  host?: string;                   // Redis host (default: localhost)
  port?: number;                   // Redis port (default: 6379)
  username?: string;               // Username for authentication
  password?: string;               // Password for authentication
  clientName?: string;             // Client name to identify connection
  autoConnect?: boolean;           // Auto-connect on first command (default: true)
  connectTimeout?: number;         // Connection timeout in ms (default: 5000)
  commandTimeout?: number;         // Command timeout in ms (default: 5000)
  database?: number;              // Database number (default: 0)
}
```

### Commands API

```typescript
// Basic commands with full type safety
await client.commands.ping();                    // Promise<string>
await client.commands.ping('hello');             // Promise<string>
await client.commands.echo('message');           // Promise<string>
await client.commands.get('key');                // Promise<string | null>
await client.commands.set('key', 'value');       // Promise<'OK' | string | null>
await client.commands.del('key1', 'key2');       // Promise<number>
await client.commands.exists('key1', 'key2');   // Promise<number>

// SET with options
await client.commands.set('key', 'value', {
  EX: 60,        // Expire in 60 seconds
  NX: true,      // Only if key doesn't exist
  GET: true,     // Return old value
});
```

### Connection Management

```typescript
// Explicit connection control
await client.connection.connect();
await client.connection.disconnect();

// Check connection state
console.log(client.connection.state);    // 'connected' | 'disconnected' | 'connecting' | 'disconnecting' | 'error'
console.log(client.connection.info);     // ConnectionInfo object
```

### Event Handling

```typescript
// Connection events
client.on('connect', (info) => {
  console.log('Connected to:', info.address);
});

client.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
});

client.on('error', (error) => {
  console.error('Client error:', error);
});

// Command events
client.on('command:start', (command, args) => {
  console.log('Executing:', command, args);
});

client.on('command:end', (result) => {
  console.log('Command completed in', result.duration, 'ms');
});

client.on('command:error', (command, error) => {
  console.error('Command failed:', command, error);
});

// State change events
client.on('state:change', (oldState, newState) => {
  console.log('State changed:', oldState, '->', newState);
});
```

### Generic Command Execution

```typescript
// Execute any Redis command
const result = await client.send('CUSTOM_COMMAND', 'arg1', 'arg2');
const result = await client.send<number>('INCR', 'counter');
```

### Error Handling

```typescript
import { 
  ConnectionRequiredError, 
  CommandTimeoutError, 
  ConfigurationError 
} from 'redisx';

try {
  await client.commands.get('key');
} catch (error) {
  if (error instanceof ConnectionRequiredError) {
    console.log('Need to connect first');
  } else if (error instanceof CommandTimeoutError) {
    console.log('Command timed out');
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## Advanced Usage

### Custom Command Registration

```typescript
import { createCommandRegistry, createCommandsAPI } from 'redisx';

const registry = createCommandRegistry();

// Register custom command
registry.register('mycommand', {
  execute: async (context, command, ...args) => {
    return context.connection.sendCommand('MYCOMMAND', ...args);
  },
});

// Use in commands API
const commandsAPI = createCommandsAPI(context, registry);
```

### Connection Manager (Advanced)

```typescript
import { ConnectionManager } from 'redisx';

const manager = new ConnectionManager({
  host: 'localhost',
  port: 6379,
  connectTimeout: 5000,
  commandTimeout: 5000,
});

await manager.connect();
const result = await manager.sendCommand('PING');
await manager.disconnect();
```

## Type Safety

The core module provides comprehensive type safety:

- **Command Arguments**: Type-checked command parameters
- **Response Types**: Strongly typed return values
- **Error Types**: Typed error hierarchy with context
- **Configuration**: Type-safe client options
- **Events**: Typed event handlers

## Examples

### Basic Usage

```typescript
import { createClient } from 'redisx';

async function main() {
  const client = await createClient();
  
  // Set and get values
  await client.commands.set('user:1', JSON.stringify({ name: 'John', age: 30 }));
  const user = await client.commands.get('user:1');
  console.log('User:', user); // string | null
  
  // Check if key exists
  const exists = await client.commands.exists('user:1');
  console.log('User exists:', exists > 0);
  
  // Delete key
  const deleted = await client.commands.del('user:1');
  console.log('Deleted keys:', deleted);
  
  await client.disconnect();
}

main().catch(console.error);
```

### Error Handling

```typescript
import { createClient, ConnectionRequiredError } from 'redisx';

async function robustExample() {
  const client = createClient({ autoConnect: false });
  
  try {
    // This will throw ConnectionRequiredError
    await client.commands.get('key');
  } catch (error) {
    if (error instanceof ConnectionRequiredError) {
      console.log('Connecting first...');
      await client.connect();
      
      // Now it will work
      const value = await client.commands.get('key');
      console.log('Value:', value);
    }
  } finally {
    await client.disconnect();
  }
}
```

### Event Monitoring

```typescript
import { createClient } from 'redisx';

async function monitoredExample() {
  const client = await createClient();
  
  // Monitor all commands
  client.on('command:start', (command, args) => {
    console.log(`→ ${command}(${args.join(', ')})`);
  });
  
  client.on('command:end', (result) => {
    console.log(`← ${result.command} = ${result.value} (${result.duration}ms)`);
  });
  
  // Execute commands
  await client.commands.ping();
  await client.commands.set('test', 'value');
  await client.commands.get('test');
  
  await client.disconnect();
}
```

## Architecture

The core module integrates three layers:

1. **Transport Layer** (`net`): TCP connection management
2. **Protocol Layer** (`parser_writer`): RESP3 parsing and encoding
3. **Client Layer** (`core`): High-level API and command execution

```
┌─────────────────┐
│   RedisClient   │ ← Public API
├─────────────────┤
│ ConnectionManager│ ← Connection orchestration
├─────────────────┤
│  TcpTransport   │ ← Network layer
│  Resp3Parser    │ ← Protocol parsing
│  Resp3Writer    │ ← Protocol encoding
└─────────────────┘
```

## Performance

- **Connection Pooling**: Single connection with efficient reuse
- **Command Batching**: FIFO command/response correlation
- **Memory Efficient**: Minimal allocations and buffer reuse
- **Type Safety**: Zero runtime overhead for type checking

## Testing

The core module includes comprehensive tests:

- **Unit Tests**: Individual component testing
- **Integration Tests**: End-to-end functionality
- **Type Tests**: TypeScript type checking
- **Error Tests**: Error handling scenarios

Run tests with:

```bash
npm test
```

## Contributing

The core module follows the redisX DX Manifesto principles:

- **Feel Instant Mastery**: Intuitive API design
- **Every API is a Promise Kept**: Consistent behavior
- **Errors Should Teach**: Helpful error messages
- **Types Are the New Docs**: Comprehensive type definitions
- **Flow, Don't Fight**: Smooth development experience
- **Joy in the Details**: Delightful developer experience
