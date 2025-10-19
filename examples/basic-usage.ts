/**
 * Basic usage example for redisX core module
 *
 * This example demonstrates the core functionality of the redisX client
 * including connection management, command execution, and error handling.
 */

import { createClient, RedisClient } from '../src/core';

async function basicExample() {
    console.log('🚀 redisX Basic Usage Example\n');

    // Create client with auto-connect disabled for demonstration
    const client = new RedisClient({
        host: 'localhost',
        port: 6379,
        autoConnect: false,
        connectTimeout: 5000,
        commandTimeout: 5000,
    });

    // Set up event listeners
    client.on('connect', (info) => {
        console.log(`✅ Connected to ${info.address}`);
    });

    client.on('disconnect', (reason) => {
        console.log(`❌ Disconnected: ${reason}`);
    });

    client.on('error', (error) => {
        console.error('💥 Client error:', error.message);
    });

    client.on('command:start', (command, args) => {
        console.log(`📤 Executing: ${command}(${args.join(', ')})`);
    });

    client.on('command:end', (result) => {
        console.log(`📥 Result: ${JSON.stringify(result.value)} (${result.duration}ms)`);
    });

    try {
        // Connect to Redis
        console.log('🔌 Connecting to Redis...');
        await client.connect();

        // Basic commands
        console.log('\n📋 Basic Commands:');
        
        // PING
        const pong = await client.commands.ping();
        console.log(`PING: ${pong}`);

        // ECHO
        const echo = await client.commands.echo('Hello Redis!');
        console.log(`ECHO: ${echo}`);

        // SET and GET
        await client.commands.set('example:key', 'Hello World!');
        const value = await client.commands.get('example:key');
        console.log(`GET: ${value}`);

        // SET with options
        await client.commands.set('example:expire', 'This will expire', { EX: 10 });
        console.log('SET with expiration (10 seconds)');

        // EXISTS
        const exists = await client.commands.exists('example:key', 'example:expire');
        console.log(`EXISTS: ${exists} keys exist`);

        // Generic command execution
        console.log('\n🔧 Generic Commands:');
        const info = await client.send<string>('INFO', 'server');
        console.log('INFO server:', info.substring(0, 100) + '...');

        // Connection info
        console.log('\n📊 Connection Info:');
        console.log('State:', client.connection.state);
        console.log('Address:', client.connection.info.address);
        console.log('Connected:', client.connection.info.isConnected);

    } catch (error) {
        console.error('❌ Error during execution:', error);
    } finally {
        // Clean up
        console.log('\n🧹 Cleaning up...');
        await client.disconnect();
    }
}

async function errorHandlingExample() {
    console.log('\n🛡️ Error Handling Example\n');

    const client = new RedisClient({ autoConnect: false });

    try {
        // This will throw ConnectionRequiredError
        await client.commands.get('key');
    } catch (error) {
        if (error instanceof Error) {
            console.log('Caught error:', error.message);
            console.log('Error type:', error.constructor.name);
        }
    }
}

async function configurationExample() {
    console.log('\n⚙️ Configuration Example\n');

    // URL-based configuration
    const urlClient = new RedisClient({
        url: 'redis://localhost:6379/0',
    });

    console.log('URL Client options:');
    console.log('Host:', urlClient.options.host);
    console.log('Port:', urlClient.options.port);
    console.log('Database:', urlClient.options.database);

    // Custom configuration
    const customClient = new RedisClient({
        host: 'localhost',
        port: 6379,
        clientName: 'redisx-example',
        connectTimeout: 10000,
        commandTimeout: 10000,
        autoConnect: false,
    });

    console.log('\nCustom Client options:');
    console.log('Host:', customClient.options.host);
    console.log('Client Name:', customClient.options.clientName);
    console.log('Connect Timeout:', customClient.options.connectTimeout);
    console.log('Command Timeout:', customClient.options.commandTimeout);
}

// Run examples
async function main() {
    try {
        await basicExample();
        await errorHandlingExample();
        await configurationExample();
        
        console.log('\n✨ All examples completed successfully!');
    } catch (error) {
        console.error('💥 Example failed:', error);
        process.exit(1);
    }
}

// Only run if this file is executed directly
if (require.main === module) {
    main();
}

export { basicExample, errorHandlingExample, configurationExample };
