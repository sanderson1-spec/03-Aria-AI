const ConfigurationService = require('../../backend/services/foundation/CORE_ConfigurationService');
const fs = require('fs').promises;
const path = require('path');

// Mock fs module
jest.mock('fs', () => ({
    promises: {
        readFile: jest.fn(),
        writeFile: jest.fn(),
        mkdir: jest.fn()
    }
}));

// Mock path module for consistent testing
jest.mock('path');

/**
 * Unit Tests for ConfigurationService
 * 
 * CLEAN ARCHITECTURE TESTING:
 * - Test service creation and initialization with dependencies
 * - Test all configuration management methods
 * - Test file system operations with mocked fs module
 * - Test error handling and edge cases
 * - Test JSON parsing and serialization
 * 
 * Testing Strategy:
 * - Isolated unit tests with mocked file system
 * - Behavior verification for all configuration operations
 * - Error condition testing for file system failures
 * - Default value handling validation
 * - Auto-save functionality testing
 */

describe('ConfigurationService', () => {
    let configurationService;
    let mockLogger;
    let mockErrorHandler;
    let mockDependencies;

    // CLEAN ARCHITECTURE: Setup and teardown for isolated testing
    beforeEach(() => {
        // Mock logger dependency
        mockLogger = {
            info: jest.fn(),
            debug: jest.fn(),
            warn: jest.fn(),
            error: jest.fn()
        };

        // Mock error handler dependency
        mockErrorHandler = {
            wrapInfrastructureError: jest.fn((error, message, context) => {
                const wrappedError = new Error(`[INFRASTRUCTURE] ${message}: ${error.message}`);
                wrappedError.originalError = error;
                wrappedError.context = context;
                return wrappedError;
            }),
            wrapApplicationError: jest.fn((error, message, context) => {
                const wrappedError = new Error(`[APPLICATION] ${message}: ${error.message}`);
                wrappedError.originalError = error;
                wrappedError.context = context;
                return wrappedError;
            })
        };

        // Mock dependencies object
        mockDependencies = {
            logger: mockLogger,
            errorHandling: mockErrorHandler,
            autoSave: true,
            createMissingDirectories: true
        };

        // Create service instance
        configurationService = new ConfigurationService(mockDependencies);

        // Mock path.resolve to return predictable paths
        path.resolve.mockImplementation((inputPath) => `/absolute${inputPath}`);
        path.dirname.mockImplementation((inputPath) => `/absolute/config`);

        // Clear all mocks
        jest.clearAllMocks();
    });

    afterEach(() => {
        // CLEAN ARCHITECTURE: Clean up after each test
        configurationService.clearMetrics();
        jest.clearAllMocks();
    });

    // CLEAN ARCHITECTURE: Test service creation and inheritance
    describe('Service Creation', () => {
        test('should extend AbstractService', () => {
            expect(configurationService).toBeInstanceOf(require('../../backend/services/base/CORE_AbstractService'));
        });

        test('should create with correct service name', () => {
            expect(configurationService.name).toBe('ConfigurationService');
        });

        test('should accept dependencies in constructor', () => {
            expect(configurationService.dependencies).toEqual(mockDependencies);
            expect(configurationService.logger).toBe(mockLogger);
            expect(configurationService.errorHandler).toBe(mockErrorHandler);
            expect(configurationService.autoSave).toBe(true);
            expect(configurationService.createMissingDirectories).toBe(true);
        });

        test('should have default dependency values', () => {
            const defaultService = new ConfigurationService();
            expect(defaultService.autoSave).toBe(true);
            expect(defaultService.createMissingDirectories).toBe(true);
            expect(defaultService.configuration).toBeInstanceOf(Map);
            expect(defaultService.currentConfigPath).toBeNull();
        });

        test('should accept custom configuration', () => {
            const customDependencies = {
                logger: mockLogger,
                autoSave: false,
                createMissingDirectories: false
            };
            
            const customService = new ConfigurationService(customDependencies);
            expect(customService.autoSave).toBe(false);
            expect(customService.createMissingDirectories).toBe(false);
        });
    });

    // CLEAN ARCHITECTURE: Test service initialization
    describe('Service Initialization', () => {
        test('should initialize successfully with logger', async () => {
            await configurationService.initialize();
            
            expect(configurationService.initialized).toBe(true);
            expect(configurationService.healthy).toBe(true);
            expect(configurationService.state).toBe('running');
        });

        test('should log initialization message', async () => {
            await configurationService.initialize();
            
            expect(mockLogger.info).toHaveBeenCalledWith(
                'Configuration service initialized',
                'ConfigurationService',
                {
                    autoSave: true,
                    createMissingDirectories: true,
                    configurationSize: 0
                }
            );
        });

        test('should fail initialization without logger dependency', async () => {
            const serviceWithoutLogger = new ConfigurationService({});
            
            await expect(serviceWithoutLogger.initialize()).rejects.toThrow(
                'missing required dependencies: logger'
            );
        });

        test('should clear configuration on initialization', async () => {
            configurationService.configuration.set('test', 'value');
            expect(configurationService.configuration.size).toBe(1);
            
            await configurationService.initialize();
            
            expect(configurationService.configuration.size).toBe(0);
        });
    });

    // CLEAN ARCHITECTURE: Test loadConfiguration method
    describe('loadConfiguration() method', () => {
        test('should load valid JSON configuration file', async () => {
            const mockConfigData = { key1: 'value1', key2: 'value2', nested: { prop: 'value' } };
            const mockJsonContent = JSON.stringify(mockConfigData);
            
            fs.readFile.mockResolvedValue(mockJsonContent);
            
            const result = await configurationService.loadConfiguration('/test/config.json');
            
            expect(fs.readFile).toHaveBeenCalledWith('/absolute/test/config.json', 'utf8');
            expect(result).toBe(3); // Number of keys loaded
            expect(configurationService.configuration.get('key1')).toBe('value1');
            expect(configurationService.configuration.get('key2')).toBe('value2');
            expect(configurationService.configuration.get('nested')).toEqual({ prop: 'value' });
            expect(configurationService.currentConfigPath).toBe('/absolute/test/config.json');
        });

        test('should log loading progress', async () => {
            const mockConfigData = { key1: 'value1' };
            fs.readFile.mockResolvedValue(JSON.stringify(mockConfigData));
            
            await configurationService.loadConfiguration('/test/config.json');
            
            expect(mockLogger.info).toHaveBeenCalledWith(
                'Loading configuration from file',
                'ConfigurationService',
                { configPath: '/absolute/test/config.json' }
            );
            
            expect(mockLogger.info).toHaveBeenCalledWith(
                'Configuration loaded successfully',
                'ConfigurationService',
                { configPath: '/absolute/test/config.json', keysLoaded: 1 }
            );
        });

        test('should track metrics for load operations', async () => {
            const mockConfigData = { key1: 'value1' };
            fs.readFile.mockResolvedValue(JSON.stringify(mockConfigData));
            
            await configurationService.loadConfiguration('/test/config.json');
            
            expect(configurationService.metrics.operationCounts.get('loadConfiguration')).toBe(1);
            expect(configurationService.metrics.lastOperationTime).toBeDefined();
        });

        test('should clear existing configuration before loading', async () => {
            configurationService.configuration.set('existing', 'value');
            
            const mockConfigData = { new: 'data' };
            fs.readFile.mockResolvedValue(JSON.stringify(mockConfigData));
            
            await configurationService.loadConfiguration('/test/config.json');
            
            expect(configurationService.configuration.has('existing')).toBe(false);
            expect(configurationService.configuration.get('new')).toBe('data');
        });

        test('should handle file read errors', async () => {
            const fileError = new Error('File not found');
            fs.readFile.mockRejectedValue(fileError);
            
            await expect(configurationService.loadConfiguration('/nonexistent/config.json'))
                .rejects.toThrow('[INFRASTRUCTURE] Configuration loading failed: File not found');
            
            expect(mockErrorHandler.wrapInfrastructureError).toHaveBeenCalledWith(
                fileError,
                'Configuration loading failed',
                { configPath: '/nonexistent/config.json' }
            );
        });

        test('should handle invalid JSON content', async () => {
            fs.readFile.mockResolvedValue('invalid json content');
            
            await expect(configurationService.loadConfiguration('/test/config.json'))
                .rejects.toThrow('[INFRASTRUCTURE] Failed to parse configuration file');
            
            expect(mockErrorHandler.wrapInfrastructureError).toHaveBeenCalled();
        });

        test('should handle non-object JSON content', async () => {
            fs.readFile.mockResolvedValue('["array", "not", "object"]');
            
            await expect(configurationService.loadConfiguration('/test/config.json'))
                .rejects.toThrow('[INFRASTRUCTURE] Failed to parse configuration file');
        });

        test('should validate configuration path parameter', async () => {
            await expect(configurationService.loadConfiguration(''))
                .rejects.toThrow('Configuration path must be a non-empty string');
            
            await expect(configurationService.loadConfiguration(null))
                .rejects.toThrow('Configuration path must be a non-empty string');
            
            await expect(configurationService.loadConfiguration(123))
                .rejects.toThrow('Configuration path must be a non-empty string');
        });
    });

    // CLEAN ARCHITECTURE: Test getConfiguration method
    describe('getConfiguration() method', () => {
        beforeEach(() => {
            configurationService.configuration.set('existingKey', 'existingValue');
            configurationService.configuration.set('numberKey', 42);
            configurationService.configuration.set('booleanKey', true);
            configurationService.configuration.set('objectKey', { nested: 'value' });
        });

        test('should return existing configuration value', () => {
            const result = configurationService.getConfiguration('existingKey');
            
            expect(result).toBe('existingValue');
        });

        test('should return default value for missing key', () => {
            const result = configurationService.getConfiguration('missingKey', 'defaultValue');
            
            expect(result).toBe('defaultValue');
        });

        test('should return null for missing key without default', () => {
            const result = configurationService.getConfiguration('missingKey');
            
            expect(result).toBeNull();
        });

        test('should handle different value types', () => {
            expect(configurationService.getConfiguration('numberKey')).toBe(42);
            expect(configurationService.getConfiguration('booleanKey')).toBe(true);
            expect(configurationService.getConfiguration('objectKey')).toEqual({ nested: 'value' });
        });

        test('should log configuration access', () => {
            configurationService.getConfiguration('existingKey');
            
            expect(mockLogger.debug).toHaveBeenCalledWith(
                'Configuration value retrieved',
                'ConfigurationService',
                {
                    key: 'existingKey',
                    hasValue: true,
                    usedDefault: false
                }
            );
        });

        test('should track metrics for get operations', () => {
            configurationService.getConfiguration('existingKey');
            
            expect(configurationService.metrics.operationCounts.get('getConfiguration')).toBe(1);
            expect(configurationService.metrics.lastOperationTime).toBeDefined();
        });

        test('should handle null and undefined keys', () => {
            expect(() => configurationService.getConfiguration(null))
                .toThrow('Configuration key cannot be null or undefined');
            
            expect(() => configurationService.getConfiguration(undefined))
                .toThrow('Configuration key cannot be null or undefined');
        });

        test('should convert non-string keys to strings', () => {
            configurationService.configuration.set('123', 'numericKey');
            
            const result = configurationService.getConfiguration(123);
            expect(result).toBe('numericKey');
        });

        test('should handle errors with error handler', () => {
            // Force an error by mocking Map.has to throw
            const originalHas = configurationService.configuration.has;
            configurationService.configuration.has = jest.fn(() => {
                throw new Error('Map error');
            });
            
            expect(() => configurationService.getConfiguration('test'))
                .toThrow('[APPLICATION] Configuration retrieval failed: Map error');
            
            expect(mockErrorHandler.wrapApplicationError).toHaveBeenCalled();
            
            // Restore original method
            configurationService.configuration.has = originalHas;
        });
    });

    // CLEAN ARCHITECTURE: Test setConfiguration method
    describe('setConfiguration() method', () => {
        test('should set new configuration value', () => {
            const result = configurationService.setConfiguration('newKey', 'newValue');
            
            expect(configurationService.configuration.get('newKey')).toBe('newValue');
            expect(result).toBeUndefined(); // No previous value
        });

        test('should return previous value when updating existing key', () => {
            configurationService.configuration.set('existingKey', 'oldValue');
            
            const result = configurationService.setConfiguration('existingKey', 'newValue');
            
            expect(configurationService.configuration.get('existingKey')).toBe('newValue');
            expect(result).toBe('oldValue');
        });

        test('should handle different value types', () => {
            configurationService.setConfiguration('stringKey', 'string');
            configurationService.setConfiguration('numberKey', 42);
            configurationService.setConfiguration('booleanKey', false);
            configurationService.setConfiguration('objectKey', { test: 'object' });
            configurationService.setConfiguration('nullKey', null);
            
            expect(configurationService.configuration.get('stringKey')).toBe('string');
            expect(configurationService.configuration.get('numberKey')).toBe(42);
            expect(configurationService.configuration.get('booleanKey')).toBe(false);
            expect(configurationService.configuration.get('objectKey')).toEqual({ test: 'object' });
            expect(configurationService.configuration.get('nullKey')).toBeNull();
        });

        test('should log configuration changes', () => {
            configurationService.setConfiguration('testKey', 'testValue');
            
            expect(mockLogger.info).toHaveBeenCalledWith(
                'Configuration value set',
                'ConfigurationService',
                {
                    key: 'testKey',
                    hadPreviousValue: false,
                    valueType: 'string'
                }
            );
        });

        test('should track metrics for set operations', () => {
            configurationService.setConfiguration('testKey', 'testValue');
            
            expect(configurationService.metrics.operationCounts.get('setConfiguration')).toBe(1);
            expect(configurationService.metrics.lastOperationTime).toBeDefined();
        });

        test('should trigger auto-save when enabled and path exists', async () => {
            configurationService.currentConfigPath = '/test/config.json';
            configurationService.autoSave = true;
            
            // Mock saveConfiguration method
            const saveConfigSpy = jest.spyOn(configurationService, 'saveConfiguration')
                .mockResolvedValue('/test/config.json');
            
            configurationService.setConfiguration('testKey', 'testValue');
            
            // Wait a tick for async auto-save
            await new Promise(resolve => setImmediate(resolve));
            
            expect(saveConfigSpy).toHaveBeenCalledWith('/test/config.json');
            
            saveConfigSpy.mockRestore();
        });

        test('should handle auto-save errors gracefully', async () => {
            configurationService.currentConfigPath = '/test/config.json';
            configurationService.autoSave = true;
            
            // Mock saveConfiguration to reject
            const saveConfigSpy = jest.spyOn(configurationService, 'saveConfiguration')
                .mockRejectedValue(new Error('Save failed'));
            
            configurationService.setConfiguration('testKey', 'testValue');
            
            // Wait a tick for async auto-save
            await new Promise(resolve => setImmediate(resolve));
            
            expect(mockLogger.warn).toHaveBeenCalledWith(
                'Auto-save failed after configuration change',
                'ConfigurationService',
                expect.objectContaining({
                    key: 'testKey',
                    configPath: '/test/config.json',
                    error: 'Save failed'
                })
            );
            
            saveConfigSpy.mockRestore();
        });

        test('should validate key parameter', () => {
            expect(() => configurationService.setConfiguration(null, 'value'))
                .toThrow('Configuration key cannot be null or undefined');
            
            expect(() => configurationService.setConfiguration(undefined, 'value'))
                .toThrow('Configuration key cannot be null or undefined');
        });

        test('should convert non-string keys to strings', () => {
            configurationService.setConfiguration(123, 'numericKey');
            
            expect(configurationService.configuration.get('123')).toBe('numericKey');
        });
    });

    // CLEAN ARCHITECTURE: Test getAllConfiguration method
    describe('getAllConfiguration() method', () => {
        test('should return all configuration as plain object', () => {
            configurationService.configuration.set('key1', 'value1');
            configurationService.configuration.set('key2', 42);
            configurationService.configuration.set('key3', { nested: 'object' });
            
            const result = configurationService.getAllConfiguration();
            
            expect(result).toEqual({
                key1: 'value1',
                key2: 42,
                key3: { nested: 'object' }
            });
        });

        test('should return empty object for empty configuration', () => {
            const result = configurationService.getAllConfiguration();
            
            expect(result).toEqual({});
        });

        test('should log configuration access', () => {
            configurationService.configuration.set('key1', 'value1');
            configurationService.configuration.set('key2', 'value2');
            
            configurationService.getAllConfiguration();
            
            expect(mockLogger.debug).toHaveBeenCalledWith(
                'All configuration retrieved',
                'ConfigurationService',
                {
                    keyCount: 2,
                    keys: ['key1', 'key2']
                }
            );
        });

        test('should track metrics for getAllConfiguration operations', () => {
            configurationService.getAllConfiguration();
            
            expect(configurationService.metrics.operationCounts.get('getAllConfiguration')).toBe(1);
            expect(configurationService.metrics.lastOperationTime).toBeDefined();
        });

        test('should handle errors with error handler', () => {
            // Force an error by mocking Object.fromEntries to throw
            const originalFromEntries = Object.fromEntries;
            Object.fromEntries = jest.fn(() => {
                throw new Error('Conversion error');
            });
            
            expect(() => configurationService.getAllConfiguration())
                .toThrow('[APPLICATION] Configuration retrieval failed: Conversion error');
            
            expect(mockErrorHandler.wrapApplicationError).toHaveBeenCalled();
            
            // Restore original method
            Object.fromEntries = originalFromEntries;
        });
    });

    // CLEAN ARCHITECTURE: Test saveConfiguration method
    describe('saveConfiguration() method', () => {
        test('should save configuration to JSON file', async () => {
            configurationService.configuration.set('key1', 'value1');
            configurationService.configuration.set('key2', 42);
            
            fs.mkdir.mockResolvedValue();
            fs.writeFile.mockResolvedValue();
            
            const result = await configurationService.saveConfiguration('/test/config.json');
            
            expect(fs.mkdir).toHaveBeenCalledWith('/absolute/config', { recursive: true });
            expect(fs.writeFile).toHaveBeenCalledWith(
                '/absolute/test/config.json',
                '{\n  "key1": "value1",\n  "key2": 42\n}',
                'utf8'
            );
            expect(result).toBe('/absolute/test/config.json');
            expect(configurationService.currentConfigPath).toBe('/absolute/test/config.json');
        });

        test('should log saving progress', async () => {
            configurationService.configuration.set('key1', 'value1');
            
            fs.mkdir.mockResolvedValue();
            fs.writeFile.mockResolvedValue();
            
            await configurationService.saveConfiguration('/test/config.json');
            
            expect(mockLogger.info).toHaveBeenCalledWith(
                'Saving configuration to file',
                'ConfigurationService',
                { configPath: '/absolute/test/config.json', keyCount: 1 }
            );
            
            expect(mockLogger.info).toHaveBeenCalledWith(
                'Configuration saved successfully',
                'ConfigurationService',
                expect.objectContaining({
                    configPath: '/absolute/test/config.json',
                    keysSaved: 1,
                    fileSize: expect.any(Number)
                })
            );
        });

        test('should track metrics for save operations', async () => {
            fs.mkdir.mockResolvedValue();
            fs.writeFile.mockResolvedValue();
            
            await configurationService.saveConfiguration('/test/config.json');
            
            expect(configurationService.metrics.operationCounts.get('saveConfiguration')).toBe(1);
            expect(configurationService.metrics.lastOperationTime).toBeDefined();
        });

        test('should handle file write errors', async () => {
            const writeError = new Error('Permission denied');
            fs.mkdir.mockResolvedValue();
            fs.writeFile.mockRejectedValue(writeError);
            
            await expect(configurationService.saveConfiguration('/test/config.json'))
                .rejects.toThrow('[INFRASTRUCTURE] Configuration saving failed: Permission denied');
            
            expect(mockErrorHandler.wrapInfrastructureError).toHaveBeenCalledWith(
                writeError,
                'Configuration saving failed',
                { configPath: '/test/config.json' }
            );
        });

        test('should handle directory creation errors', async () => {
            const mkdirError = new Error('Cannot create directory');
            fs.mkdir.mockRejectedValue(mkdirError);
            
            await expect(configurationService.saveConfiguration('/test/config.json'))
                .rejects.toThrow('[INFRASTRUCTURE] Failed to create configuration directory: Cannot create directory');
            
            expect(mockErrorHandler.wrapInfrastructureError).toHaveBeenCalledWith(
                mkdirError,
                'Failed to create configuration directory',
                expect.objectContaining({
                    filePath: '/test/config.json',
                    directory: '/absolute/config'
                })
            );
        });

        test('should validate configuration path parameter', async () => {
            await expect(configurationService.saveConfiguration(''))
                .rejects.toThrow('Configuration path must be a non-empty string');
            
            await expect(configurationService.saveConfiguration(null))
                .rejects.toThrow('Configuration path must be a non-empty string');
            
            await expect(configurationService.saveConfiguration(123))
                .rejects.toThrow('Configuration path must be a non-empty string');
        });

        test('should skip directory creation when createMissingDirectories is false', async () => {
            const serviceNoMkdir = new ConfigurationService({
                logger: mockLogger,
                createMissingDirectories: false
            });
            
            fs.writeFile.mockResolvedValue();
            
            await serviceNoMkdir.saveConfiguration('/test/config.json');
            
            expect(fs.mkdir).not.toHaveBeenCalled();
            expect(fs.writeFile).toHaveBeenCalled();
        });
    });

    // CLEAN ARCHITECTURE: Test health check functionality
    describe('Health Check', () => {
        test('should return healthy status when initialized', async () => {
            await configurationService.initialize();
            configurationService.configuration.set('key1', 'value1');
            configurationService.currentConfigPath = '/test/config.json';
            
            const health = await configurationService.checkHealth();
            
            expect(health.healthy).toBe(true);
            expect(health.service).toBe('ConfigurationService');
            expect(health.details.state).toBe('running');
            expect(health.details.configurationSize).toBe(1);
            expect(health.details.currentConfigPath).toBe('/test/config.json');
            expect(health.details.autoSave).toBe(true);
            expect(health.details.createMissingDirectories).toBe(true);
            expect(health.details.hasConfiguration).toBe(true);
        });

        test('should include operation counts in health details', async () => {
            await configurationService.initialize();
            
            configurationService.getConfiguration('test');
            configurationService.setConfiguration('test', 'value');
            
            const health = await configurationService.checkHealth();
            
            expect(health.details.operationCounts.getConfiguration).toBe(1);
            expect(health.details.operationCounts.setConfiguration).toBe(1);
        });
    });

    // CLEAN ARCHITECTURE: Test service shutdown
    describe('Service Shutdown', () => {
        test('should log shutdown message with statistics', async () => {
            await configurationService.initialize();
            
            configurationService.configuration.set('key1', 'value1');
            configurationService.currentConfigPath = '/test/config.json';
            configurationService.getConfiguration('key1');
            
            await configurationService.shutdown();
            
            expect(mockLogger.info).toHaveBeenCalledWith(
                'Configuration service shutting down',
                'ConfigurationService',
                expect.objectContaining({
                    configurationSize: 1,
                    currentConfigPath: '/test/config.json',
                    uptime: expect.any(Number),
                    operationCounts: expect.any(Object)
                })
            );
            
            expect(configurationService.configuration.size).toBe(0);
            expect(configurationService.currentConfigPath).toBeNull();
        });
    });

    // CLEAN ARCHITECTURE: Test service without dependencies
    describe('Service Without Dependencies', () => {
        test('should work without error handler', async () => {
            const serviceWithoutErrorHandler = new ConfigurationService({
                logger: mockLogger
            });
            
            fs.readFile.mockRejectedValue(new Error('File error'));
            
            await expect(serviceWithoutErrorHandler.loadConfiguration('/test/config.json'))
                .rejects.toThrow('File error');
        });

        test('should work without logger but not log', () => {
            const serviceWithoutLogger = new ConfigurationService({});
            
            expect(() => {
                serviceWithoutLogger.setConfiguration('test', 'value');
                serviceWithoutLogger.getConfiguration('test');
            }).not.toThrow();
            
            expect(serviceWithoutLogger.configuration.get('test')).toBe('value');
        });
    });
});
