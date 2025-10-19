import { describe, it, expect } from 'vitest';

/**
 * Test the core module exports
 * 
 * This test ensures that all expected exports are available from the core index.ts file
 * and that they can be imported without errors.
 */
describe('Core Module Exports (src/core/index.ts)', () => {
    it('should export main client classes and functions', async () => {
        const coreModule = await import('../index');
        
        // Test main client exports
        expect(coreModule.createClient).toBeDefined();
        expect(coreModule.RedisClient).toBeDefined();
        expect(typeof coreModule.createClient).toBe('function');
        expect(typeof coreModule.RedisClient).toBe('function');
    });

    it('should export type definitions', async () => {
        const coreModule = await import('../index');
        
        // Test that the module has type exports (these won't be available at runtime
        // but the import should succeed)
        expect(coreModule).toBeDefined();
    });

    it('should export error classes', async () => {
        const coreModule = await import('../index');
        
        // Test error class exports
        expect(coreModule.RedisXError).toBeDefined();
        expect(coreModule.CommandError).toBeDefined();
        expect(coreModule.ConnectionRequiredError).toBeDefined();
        expect(coreModule.CommandTimeoutError).toBeDefined();
        expect(coreModule.InvalidArgumentsError).toBeDefined();
        expect(coreModule.InvalidStateError).toBeDefined();
        expect(coreModule.ParseError).toBeDefined();
        expect(coreModule.TransformError).toBeDefined();
        expect(coreModule.ConfigurationError).toBeDefined();
    });

    it('should export error codes and utilities', async () => {
        const coreModule = await import('../index');
        
        // Test error code exports
        expect(coreModule.CoreErrorCodes).toBeDefined();
        expect(coreModule.AllErrorCodes).toBeDefined();
        
        // Test error utility functions
        expect(coreModule.isNetworkError).toBeDefined();
        expect(coreModule.isCoreError).toBeDefined();
        expect(coreModule.isCommandError).toBeDefined();
        expect(coreModule.isConnectionRequiredError).toBeDefined();
        expect(coreModule.isTimeoutError).toBeDefined();
        
        expect(typeof coreModule.isNetworkError).toBe('function');
        expect(typeof coreModule.isCoreError).toBe('function');
        expect(typeof coreModule.isCommandError).toBe('function');
        expect(typeof coreModule.isConnectionRequiredError).toBe('function');
        expect(typeof coreModule.isTimeoutError).toBe('function');
    });

    it('should export command utilities', async () => {
        const coreModule = await import('../index');
        
        // Test command registry and API exports
        expect(coreModule.createCommandRegistry).toBeDefined();
        expect(coreModule.createCommandsAPI).toBeDefined();
        expect(typeof coreModule.createCommandRegistry).toBe('function');
        expect(typeof coreModule.createCommandsAPI).toBe('function');
    });

    it('should export connection manager', async () => {
        const coreModule = await import('../index');
        
        // Test connection manager export
        expect(coreModule.ConnectionManager).toBeDefined();
        expect(typeof coreModule.ConnectionManager).toBe('function');
    });

    it('should export network error classes', async () => {
        const coreModule = await import('../index');
        
        // Test network error re-exports
        expect(coreModule.RedisXNetError).toBeDefined();
        expect(coreModule.ConnectionError).toBeDefined();
        expect(coreModule.TimeoutError).toBeDefined();
        expect(coreModule.WriteError).toBeDefined();
        expect(coreModule.NetErrorCodes).toBeDefined();
    });

    it('should have all exports as functions or objects', async () => {
        const coreModule = await import('../index');
        
        // Verify that all exports are either functions, objects, or constructors
        const exports = Object.keys(coreModule);
        expect(exports.length).toBeGreaterThan(0);
        
        for (const exportName of exports) {
            const exportValue = coreModule[exportName as keyof typeof coreModule];
            expect(exportValue).toBeDefined();
            expect(exportValue).not.toBeNull();
        }
    });
});
