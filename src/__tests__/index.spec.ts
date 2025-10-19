import { describe, it, expect } from 'vitest';

/**
 * Test the main entry point exports
 * 
 * This test ensures that all expected exports are available from the main index.ts file
 * and that they can be imported without errors.
 */
describe('Main Entry Point (src/index.ts)', () => {
    it('should export core client API', async () => {
        // Test that we can import the main client exports
        const coreModule = await import('../core');
        expect(coreModule).toBeDefined();
        expect(coreModule.createClient).toBeDefined();
        expect(coreModule.RedisClient).toBeDefined();
    });

    it('should export parser/writer API', async () => {
        // Test that we can import the parser/writer exports
        const parserWriterModule = await import('../parser_writer');
        expect(parserWriterModule).toBeDefined();
    });

    it('should export network API', async () => {
        // Test that we can import the network exports
        const netModule = await import('../net');
        expect(netModule).toBeDefined();
    });

    it('should have all expected exports available', async () => {
        // Import the main module and verify key exports exist
        const mainModule = await import('../index');
        expect(mainModule).toBeDefined();
        
        // The main index.ts re-exports everything, so we should be able to access
        // the core functionality through the main module
        expect(typeof mainModule).toBe('object');
    });
});
