const ServiceFactory = require('../../backend/services/CORE_ServiceFactory');
const LoggerService = require('../../backend/services/foundation/CORE_LoggerService');
const ErrorHandlingService = require('../../backend/services/foundation/CORE_ErrorHandlingService');
const ConfigurationService = require('../../backend/services/foundation/CORE_ConfigurationService');
const fs = require('fs').promises;

// Mock fs module for ConfigurationService tests
jest.mock('fs', () => ({
    promises: {
        readFile: jest.fn(),
        writeFile: jest.fn(),
        mkdir: jest.fn()
    }
}));

/**
 * Integration Tests for Foundation Services
 * 
 * CLEAN ARCHITECTURE INTEGRATION TESTING:
 * - Test ServiceFactory registration and dependency injection
 * - Test service initialization order and lifecycle management
 * - Test cross-service interactions and dependencies
 * - Test error propagation and handling across services
 * - Test configuration management integration
 * - Test health monitoring and metrics collection
 * 
 * Integration Testing Strategy:
 * - Test real service dependencies without mocking core service logic
 * - Verify proper dependency injection and service communication
 * - Test complete service lifecycle from registration to shutdown
 * - Verify error handling propagation across service boundaries
 * - Test configuration loading and sharing across services
 */

describe('Foundation Services Integration', () => {
    let serviceFactory;
    let consoleSpy;

    // CLEAN ARCHITECTURE: Setup and teardown for integration testing
    beforeEach(() => {
        // Create fresh ServiceFactory instance
        serviceFactory = new ServiceFactory();

        // Mock console methods to verify ServiceFactory logging
        consoleSpy = {
            log: jest.spyOn(console, 'log').mockImplementation(() => {}),
            error: jest.spyOn(console, 'error').mockImplementation(() => {})
        };

        // Clear fs mocks
        jest.clearAllMocks();
    });

    afterEach(async () => {
        // CLEAN ARCHITECTURE: Ensure proper cleanup after each test
        if (serviceFactory.initialized) {
            await serviceFactory.shutdown();
        }
        
        // Restore console methods
        jest.restoreAllMocks();
    });

    // CLEAN ARCHITECTURE: Test service registration with ServiceFactory
    describe('Service Registration', () => {
        test('should register LoggerService with no dependencies', () => {
            const result = serviceFactory.registerService('logger', LoggerService, []);
            
            expect(result).toBe(serviceFactory); // Should return factory for chaining
            expect(serviceFactory.getServiceNames()).toContain('logger');
            
            const config = serviceFactory.getServiceConfig('logger');
            expect(config.name).toBe('logger');
            expect(config.serviceClass).toBe(LoggerService);
            expect(config.dependencies).toEqual([]);
            expect(config.initialized).toBe(false);
        });

        test('should register ErrorHandlingService with logger dependency', () => {
            serviceFactory.registerService('logger', LoggerService, []);
            serviceFactory.registerService('errorHandling', ErrorHandlingService, ['logger']);
            
            expect(serviceFactory.getServiceNames()).toContain('errorHandling');
            
            const config = serviceFactory.getServiceConfig('errorHandling');
            expect(config.name).toBe('errorHandling');
            expect(config.serviceClass).toBe(ErrorHandlingService);
            expect(config.dependencies).toEqual(['logger']);
        });

        test('should register ConfigurationService with logger dependency', () => {
            serviceFactory.registerService('logger', LoggerService, []);
            serviceFactory.registerService('configuration', ConfigurationService, ['logger']);
            
            expect(serviceFactory.getServiceNames()).toContain('configuration');
            
            const config = serviceFactory.getServiceConfig('configuration');
            expect(config.dependencies).toEqual(['logger']);
        });

        test('should register all foundation services with proper dependencies', () => {
            serviceFactory
                .registerService('logger', LoggerService, [])
                .registerService('errorHandling', ErrorHandlingService, ['logger'])
                .registerService('configuration', ConfigurationService, ['logger']);
            
            const serviceNames = serviceFactory.getServiceNames();
            expect(serviceNames).toContain('logger');
            expect(serviceNames).toContain('errorHandling');
            expect(serviceNames).toContain('configuration');
            expect(serviceNames).toHaveLength(3);
        });

        test('should prevent duplicate service registration', () => {
            serviceFactory.registerService('logger', LoggerService, []);
            
            expect(() => {
                serviceFactory.registerService('logger', LoggerService, []);
            }).toThrow("Service 'logger' is already registered");
        });

        test('should prevent registration after initialization', async () => {
            serviceFactory.registerService('logger', LoggerService, []);
            await serviceFactory.initializeServices();
            
            expect(() => {
                serviceFactory.registerService('newService', LoggerService, []);
            }).toThrow('Cannot register services after initialization');
        });
    });

    // CLEAN ARCHITECTURE: Test service initialization order
    describe('Service Initialization Order', () => {
        test('should calculate correct initialization order for dependencies', () => {
            serviceFactory
                .registerService('logger', LoggerService, [])
                .registerService('errorHandling', ErrorHandlingService, ['logger'])
                .registerService('configuration', ConfigurationService, ['logger']);
            
            serviceFactory.calculateInitializationOrder();
            
            const order = serviceFactory.initializationOrder;
            expect(order.indexOf('logger')).toBeLessThan(order.indexOf('errorHandling'));
            expect(order.indexOf('logger')).toBeLessThan(order.indexOf('configuration'));
        });

        test('should detect circular dependencies', () => {
            // Create artificial circular dependency for testing
            serviceFactory
                .registerService('serviceA', LoggerService, ['serviceB'])
                .registerService('serviceB', ErrorHandlingService, ['serviceA']);
            
            expect(() => {
                serviceFactory.calculateInitializationOrder();
            }).toThrow('Circular dependency detected involving service');
        });

        test('should initialize services in dependency order', async () => {
            serviceFactory
                .registerService('logger', LoggerService, [])
                .registerService('errorHandling', ErrorHandlingService, ['logger'])
                .registerService('configuration', ConfigurationService, ['logger']);
            
            await serviceFactory.initializeServices();
            
            // Verify all services are initialized
            expect(serviceFactory.initialized).toBe(true);
            expect(serviceFactory.has('logger')).toBe(true);
            expect(serviceFactory.has('errorHandling')).toBe(true);
            expect(serviceFactory.has('configuration')).toBe(true);
        });
    });

    // CLEAN ARCHITECTURE: Test dependency injection
    describe('Dependency Injection', () => {
        test('should inject logger into ErrorHandlingService', async () => {
            serviceFactory
                .registerService('logger', LoggerService, [])
                .registerService('errorHandling', ErrorHandlingService, ['logger']);
            
            await serviceFactory.initializeServices();
            
            const logger = serviceFactory.get('logger');
            const errorHandler = serviceFactory.get('errorHandling');
            
            expect(errorHandler.logger).toBe(logger);
            expect(errorHandler.dependencies.logger).toBe(logger);
        });

        test('should inject logger into ConfigurationService', async () => {
            serviceFactory
                .registerService('logger', LoggerService, [])
                .registerService('configuration', ConfigurationService, ['logger']);
            
            await serviceFactory.initializeServices();
            
            const logger = serviceFactory.get('logger');
            const config = serviceFactory.get('configuration');
            
            expect(config.logger).toBe(logger);
            expect(config.dependencies.logger).toBe(logger);
        });

        test('should inject multiple dependencies correctly', async () => {
            serviceFactory
                .registerService('logger', LoggerService, [])
                .registerService('errorHandling', ErrorHandlingService, ['logger'])
                .registerService('configuration', ConfigurationService, ['logger']);
            
            await serviceFactory.initializeServices();
            
            const logger = serviceFactory.get('logger');
            const errorHandler = serviceFactory.get('errorHandling');
            const config = serviceFactory.get('configuration');
            
            // Verify each service has its dependencies
            expect(errorHandler.logger).toBe(logger);
            expect(config.logger).toBe(logger);
            
            // Verify services are properly initialized
            expect(logger.initialized).toBe(true);
            expect(errorHandler.initialized).toBe(true);
            expect(config.initialized).toBe(true);
        });

        test('should provide empty dependencies object for services with no dependencies', async () => {
            serviceFactory.registerService('logger', LoggerService, []);
            
            await serviceFactory.initializeServices();
            
            const logger = serviceFactory.get('logger');
            expect(logger.dependencies).toEqual({});
        });
    });

    // CLEAN ARCHITECTURE: Test service retrieval
    describe('Service Retrieval', () => {
        test('should retrieve services by name after initialization', async () => {
            serviceFactory
                .registerService('logger', LoggerService, [])
                .registerService('errorHandling', ErrorHandlingService, ['logger']);
            
            await serviceFactory.initializeServices();
            
            const logger = serviceFactory.get('logger');
            const errorHandler = serviceFactory.get('errorHandling');
            
            expect(logger).toBeInstanceOf(LoggerService);
            expect(errorHandler).toBeInstanceOf(ErrorHandlingService);
        });

        test('should throw error when retrieving non-existent service', async () => {
            serviceFactory.registerService('logger', LoggerService, []);
            await serviceFactory.initializeServices();
            
            expect(() => {
                serviceFactory.get('nonExistentService');
            }).toThrow("Service 'nonExistentService' not found");
        });

        test('should throw error when retrieving service before initialization', () => {
            serviceFactory.registerService('logger', LoggerService, []);
            
            expect(() => {
                serviceFactory.get('logger');
            }).toThrow('ServiceFactory not initialized. Call initializeServices() first.');
        });

        test('should check service existence with has() method', async () => {
            serviceFactory.registerService('logger', LoggerService, []);
            await serviceFactory.initializeServices();
            
            expect(serviceFactory.has('logger')).toBe(true);
            expect(serviceFactory.has('nonExistentService')).toBe(false);
        });
    });

    // CLEAN ARCHITECTURE: Test cross-service interactions
    describe('Cross-Service Interactions', () => {
        test('should allow ErrorHandlingService to use Logger for logging', async () => {
            serviceFactory
                .registerService('logger', LoggerService, [])
                .registerService('errorHandling', ErrorHandlingService, ['logger']);
            
            await serviceFactory.initializeServices();
            
            const logger = serviceFactory.get('logger');
            const errorHandler = serviceFactory.get('errorHandling');
            
            // Mock logger methods to verify they are called
            const loggerErrorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
            
            // Create an error using ErrorHandlingService
            const originalError = new Error('Test error');
            const wrappedError = errorHandler.wrapDomainError(originalError, 'Test message', { context: 'test' });
            
            // Verify error was wrapped correctly
            expect(wrappedError.message).toContain('[DOMAIN] Test message: Test error');
            expect(wrappedError.originalError).toBe(originalError);
            expect(wrappedError.layer).toBe('domain');
            
            // Verify logger was used for logging the error
            expect(loggerErrorSpy).toHaveBeenCalledWith(
                'Domain error occurred',
                'ErrorHandlingService',
                expect.objectContaining({
                    originalMessage: 'Test error',
                    enhancedMessage: 'Test message',
                    layer: 'domain'
                })
            );
            
            loggerErrorSpy.mockRestore();
        });

        test('should allow ConfigurationService to use Logger for status updates', async () => {
            serviceFactory
                .registerService('logger', LoggerService, [])
                .registerService('configuration', ConfigurationService, ['logger']);
            
            await serviceFactory.initializeServices();
            
            const logger = serviceFactory.get('logger');
            const config = serviceFactory.get('configuration');
            
            // Mock logger methods to verify they are called
            const loggerInfoSpy = jest.spyOn(logger, 'info').mockImplementation(() => {});
            
            // Use configuration service
            config.setConfiguration('testKey', 'testValue');
            const value = config.getConfiguration('testKey');
            
            expect(value).toBe('testValue');
            
            // Verify logger was used for configuration changes
            expect(loggerInfoSpy).toHaveBeenCalledWith(
                'Configuration value set',
                'ConfigurationService',
                expect.objectContaining({
                    key: 'testKey',
                    hadPreviousValue: false,
                    valueType: 'string'
                })
            );
            
            loggerInfoSpy.mockRestore();
        });

        test('should allow services to interact through shared configuration', async () => {
            serviceFactory
                .registerService('logger', LoggerService, [])
                .registerService('errorHandling', ErrorHandlingService, ['logger'])
                .registerService('configuration', ConfigurationService, ['logger']);
            
            // Mock file system for configuration loading
            const mockConfig = { maxContextSize: 500, includeStackTrace: false };
            fs.readFile.mockResolvedValue(JSON.stringify(mockConfig));
            
            await serviceFactory.initializeServices();
            
            const config = serviceFactory.get('configuration');
            const errorHandler = serviceFactory.get('errorHandling');
            
            // Load configuration
            await config.loadConfiguration('/test/config.json');
            
            // Verify configuration was loaded
            expect(config.getConfiguration('maxContextSize')).toBe(500);
            expect(config.getConfiguration('includeStackTrace')).toBe(false);
            
            // Services can use shared configuration for their behavior
            const configuredMaxSize = config.getConfiguration('maxContextSize', 1000);
            expect(configuredMaxSize).toBe(500);
        });
    });

    // CLEAN ARCHITECTURE: Test error handling integration
    describe('Error Handling Integration', () => {
        test('should handle service initialization errors gracefully', async () => {
            // Mock service that fails during initialization
            class FailingService {
                constructor(dependencies) {
                    this.dependencies = dependencies;
                    this.name = 'FailingService';
                }
                
                async initialize() {
                    throw new Error('Initialization failed');
                }
            }
            
            serviceFactory
                .registerService('logger', LoggerService, [])
                .registerService('failing', FailingService, ['logger']);
            
            await expect(serviceFactory.initializeServices()).rejects.toThrow('Initialization failed');
            expect(serviceFactory.initialized).toBe(false);
            expect(serviceFactory.lifecycleState).toBe('failed');
        });

        test('should propagate errors through ErrorHandlingService', async () => {
            serviceFactory
                .registerService('logger', LoggerService, [])
                .registerService('errorHandling', ErrorHandlingService, ['logger']);
            
            await serviceFactory.initializeServices();
            
            const errorHandler = serviceFactory.get('errorHandling');
            
            // Test different error types
            const domainError = new Error('Business rule violation');
            const wrappedDomain = errorHandler.wrapDomainError(domainError, 'Invalid operation');
            
            const infraError = new Error('Database connection failed');
            const wrappedInfra = errorHandler.wrapInfrastructureError(infraError, 'Data access failed');
            
            expect(wrappedDomain.layer).toBe('domain');
            expect(wrappedInfra.layer).toBe('infrastructure');
            expect(wrappedDomain.message).toContain('[DOMAIN]');
            expect(wrappedInfra.message).toContain('[INFRASTRUCTURE]');
        });

        test('should handle missing dependencies gracefully', async () => {
            serviceFactory.registerService('errorHandling', ErrorHandlingService, ['nonExistentLogger']);
            
            await expect(serviceFactory.initializeServices()).rejects.toThrow(
                "Service 'nonExistentLogger' not found in registry"
            );
        });
    });

    // CLEAN ARCHITECTURE: Test configuration integration
    describe('Configuration Integration', () => {
        test('should load and share configuration across services', async () => {
            const mockConfig = {
                logging: { level: 'debug', includeTimestamp: true },
                errorHandling: { maxContextSize: 2000 },
                application: { name: 'TestApp', version: '1.0.0' }
            };
            
            fs.readFile.mockResolvedValue(JSON.stringify(mockConfig));
            fs.mkdir.mockResolvedValue();
            fs.writeFile.mockResolvedValue();
            
            serviceFactory
                .registerService('logger', LoggerService, [])
                .registerService('configuration', ConfigurationService, ['logger']);
            
            await serviceFactory.initializeServices();
            
            const config = serviceFactory.get('configuration');
            
            // Load configuration from file
            await config.loadConfiguration('/test/app-config.json');
            
            // Verify configuration loading
            expect(fs.readFile).toHaveBeenCalledWith('/absolute/test/app-config.json', 'utf8');
            
            // Verify configuration access
            expect(config.getConfiguration('logging')).toEqual({ level: 'debug', includeTimestamp: true });
            expect(config.getConfiguration('application.name', 'DefaultApp')).toBe('DefaultApp'); // Nested key fallback
            
            // Test configuration modification and saving
            config.setConfiguration('newSetting', 'newValue');
            await config.saveConfiguration('/test/app-config.json');
            
            expect(fs.writeFile).toHaveBeenCalledWith(
                '/absolute/test/app-config.json',
                expect.stringContaining('newSetting'),
                'utf8'
            );
        });

        test('should handle configuration file errors gracefully', async () => {
            fs.readFile.mockRejectedValue(new Error('File not found'));
            
            serviceFactory
                .registerService('logger', LoggerService, [])
                .registerService('errorHandling', ErrorHandlingService, ['logger'])
                .registerService('configuration', ConfigurationService, ['logger']);
            
            await serviceFactory.initializeServices();
            
            const config = serviceFactory.get('configuration');
            
            await expect(config.loadConfiguration('/nonexistent/config.json'))
                .rejects.toThrow('Configuration loading failed');
        });
    });

    // CLEAN ARCHITECTURE: Test health monitoring
    describe('Health Monitoring', () => {
        test('should monitor health of all services', async () => {
            serviceFactory
                .registerService('logger', LoggerService, [])
                .registerService('errorHandling', ErrorHandlingService, ['logger'])
                .registerService('configuration', ConfigurationService, ['logger']);
            
            await serviceFactory.initializeServices();
            
            const healthResults = await serviceFactory.checkAllServicesHealth();
            
            expect(healthResults.size).toBe(3);
            expect(healthResults.get('logger').healthy).toBe(true);
            expect(healthResults.get('errorHandling').healthy).toBe(true);
            expect(healthResults.get('configuration').healthy).toBe(true);
        });

        test('should provide system metrics', async () => {
            serviceFactory
                .registerService('logger', LoggerService, [])
                .registerService('errorHandling', ErrorHandlingService, ['logger']);
            
            await serviceFactory.initializeServices();
            
            const metrics = serviceFactory.getSystemMetrics();
            
            expect(metrics.factory.initialized).toBe(true);
            expect(metrics.factory.registeredServices).toBe(2);
            expect(metrics.factory.runningServices).toBe(2);
            expect(metrics.services.logger).toBeDefined();
            expect(metrics.services.errorHandling).toBeDefined();
        });

        test('should provide factory status information', async () => {
            serviceFactory
                .registerService('logger', LoggerService, [])
                .registerService('configuration', ConfigurationService, ['logger']);
            
            await serviceFactory.initializeServices();
            
            const status = serviceFactory.getStatus();
            
            expect(status.state).toBe('running');
            expect(status.initialized).toBe(true);
            expect(status.registeredServices).toEqual(['logger', 'configuration']);
            expect(status.runningServices).toEqual(['logger', 'configuration']);
        });
    });

    // CLEAN ARCHITECTURE: Test service lifecycle management
    describe('Service Lifecycle Management', () => {
        test('should perform complete service lifecycle', async () => {
            serviceFactory
                .registerService('logger', LoggerService, [])
                .registerService('errorHandling', ErrorHandlingService, ['logger'])
                .registerService('configuration', ConfigurationService, ['logger']);
            
            // Initialize services
            await serviceFactory.initializeServices();
            
            expect(serviceFactory.initialized).toBe(true);
            expect(serviceFactory.lifecycleState).toBe('running');
            
            // Use services
            const logger = serviceFactory.get('logger');
            const errorHandler = serviceFactory.get('errorHandling');
            const config = serviceFactory.get('configuration');
            
            logger.info('Test message');
            errorHandler.wrapDomainError(new Error('Test'), 'Test error');
            config.setConfiguration('test', 'value');
            
            // Check health
            const health = await serviceFactory.checkAllServicesHealth();
            expect(health.size).toBe(3);
            
            // Shutdown services
            await serviceFactory.shutdown();
            
            expect(serviceFactory.initialized).toBe(false);
            expect(serviceFactory.lifecycleState).toBe('shutdown');
        });

        test('should handle shutdown gracefully even with service errors', async () => {
            // Mock service that fails during shutdown
            class FailingShutdownService {
                constructor(dependencies) {
                    this.dependencies = dependencies;
                    this.name = 'FailingShutdownService';
                    this.initialized = false;
                    this.healthy = false;
                }
                
                async initialize() {
                    this.initialized = true;
                    this.healthy = true;
                }
                
                async shutdown() {
                    throw new Error('Shutdown failed');
                }
            }
            
            serviceFactory
                .registerService('logger', LoggerService, [])
                .registerService('failing', FailingShutdownService, []);
            
            await serviceFactory.initializeServices();
            
            // Shutdown should complete despite service shutdown failure
            await serviceFactory.shutdown();
            
            expect(serviceFactory.initialized).toBe(false);
            expect(serviceFactory.lifecycleState).toBe('shutdown');
        });
    });
});
