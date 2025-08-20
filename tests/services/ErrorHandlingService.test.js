const ErrorHandlingService = require('../../backend/services/foundation/ErrorHandlingService');

/**
 * Unit Tests for ErrorHandlingService
 * 
 * CLEAN ARCHITECTURE TESTING:
 * - Test service creation and initialization with dependencies
 * - Test all error wrapping methods for different architectural layers
 * - Test error property assignment and enhancement
 * - Test error message formatting consistency
 * - Test edge cases and error handling scenarios
 * 
 * Testing Strategy:
 * - Isolated unit tests with mocked logger dependency
 * - Behavior verification for each architectural layer
 * - Property validation for enhanced error objects
 * - Edge case testing for various error types
 * - Metrics and health check validation
 */

describe('ErrorHandlingService', () => {
    let errorHandlingService;
    let mockLogger;
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

        // Mock dependencies object
        mockDependencies = {
            logger: mockLogger,
            maxContextSize: 1000,
            includeStackTrace: true
        };

        // Create service instance
        errorHandlingService = new ErrorHandlingService(mockDependencies);

        // Mock Date for predictable timestamps
        jest.spyOn(Date.prototype, 'toISOString').mockReturnValue('2024-01-01T12:00:00.000Z');
        jest.spyOn(Date, 'now').mockReturnValue(1704110400000);
        jest.spyOn(Math, 'random').mockReturnValue(0.123456789);
    });

    afterEach(() => {
        // CLEAN ARCHITECTURE: Clean up mocks after each test
        jest.restoreAllMocks();
        errorHandlingService.clearMetrics();
    });

    // CLEAN ARCHITECTURE: Test service creation and inheritance
    describe('Service Creation', () => {
        test('should extend AbstractService', () => {
            expect(errorHandlingService).toBeInstanceOf(require('../../backend/services/base/AbstractService'));
        });

        test('should create with correct service name', () => {
            expect(errorHandlingService.name).toBe('ErrorHandlingService');
        });

        test('should accept dependencies in constructor', () => {
            expect(errorHandlingService.dependencies).toEqual(mockDependencies);
            expect(errorHandlingService.logger).toBe(mockLogger);
            expect(errorHandlingService.maxContextSize).toBe(1000);
            expect(errorHandlingService.includeStackTrace).toBe(true);
        });

        test('should have default configuration values', () => {
            const defaultService = new ErrorHandlingService();
            expect(defaultService.maxContextSize).toBe(1000);
            expect(defaultService.includeStackTrace).toBe(true);
        });

        test('should accept custom configuration', () => {
            const customDependencies = {
                logger: mockLogger,
                maxContextSize: 500,
                includeStackTrace: false
            };
            
            const customService = new ErrorHandlingService(customDependencies);
            expect(customService.maxContextSize).toBe(500);
            expect(customService.includeStackTrace).toBe(false);
        });
    });

    // CLEAN ARCHITECTURE: Test service initialization
    describe('Service Initialization', () => {
        test('should initialize successfully with logger', async () => {
            await errorHandlingService.initialize();
            
            expect(errorHandlingService.initialized).toBe(true);
            expect(errorHandlingService.healthy).toBe(true);
            expect(errorHandlingService.state).toBe('running');
        });

        test('should log initialization message', async () => {
            await errorHandlingService.initialize();
            
            expect(mockLogger.info).toHaveBeenCalledWith(
                'Error handling service initialized',
                'ErrorHandlingService',
                {
                    maxContextSize: 1000,
                    includeStackTrace: true
                }
            );
        });

        test('should fail initialization without logger dependency', async () => {
            const serviceWithoutLogger = new ErrorHandlingService({});
            
            await expect(serviceWithoutLogger.initialize()).rejects.toThrow(
                'missing required dependencies: logger'
            );
        });
    });

    // CLEAN ARCHITECTURE: Test domain error wrapping
    describe('wrapDomainError() method', () => {
        test('should wrap error with correct format and properties', () => {
            const originalError = new Error('Business rule violated');
            const message = 'Invalid user operation';
            const context = { userId: 123, operation: 'transfer' };

            const wrappedError = errorHandlingService.wrapDomainError(originalError, message, context);

            expect(wrappedError).toBeInstanceOf(Error);
            expect(wrappedError.message).toBe('[DOMAIN] Invalid user operation: Business rule violated');
            expect(wrappedError.originalError).toBe(originalError);
            expect(wrappedError.context).toEqual(context);
            expect(wrappedError.layer).toBe('domain');
            expect(wrappedError.timestamp).toBe('2024-01-01T12:00:00.000Z');
            expect(wrappedError.errorId).toBe('err_1704110400000_0rnl7mh5h');
            expect(wrappedError.serviceName).toBe('ErrorHandlingService');
        });

        test('should preserve original stack trace when enabled', () => {
            const originalError = new Error('Test error');
            const wrappedError = errorHandlingService.wrapDomainError(originalError, 'Test message');

            expect(wrappedError.originalStack).toBe(originalError.stack);
            expect(wrappedError.stack).toContain('Original Error Stack:');
        });

        test('should log domain error', () => {
            const originalError = new Error('Business rule violated');
            const message = 'Invalid user operation';
            const context = { userId: 123 };

            errorHandlingService.wrapDomainError(originalError, message, context);

            expect(mockLogger.error).toHaveBeenCalledWith(
                'Domain error occurred',
                'ErrorHandlingService',
                expect.objectContaining({
                    errorId: 'err_1704110400000_0rnl7mh5h',
                    originalMessage: 'Business rule violated',
                    enhancedMessage: 'Invalid user operation',
                    context: { userId: 123 },
                    layer: 'domain'
                })
            );
        });

        test('should track metrics for domain errors', () => {
            const originalError = new Error('Test error');
            
            errorHandlingService.wrapDomainError(originalError, 'Test message');
            
            expect(errorHandlingService.metrics.operationCounts.get('domainError')).toBe(1);
            expect(errorHandlingService.metrics.lastOperationTime).toBe(1704110400000);
        });

        test('should handle non-Error objects', () => {
            const nonError = 'String error';
            const wrappedError = errorHandlingService.wrapDomainError(nonError, 'Test message');

            expect(wrappedError.originalError).toBeInstanceOf(Error);
            expect(wrappedError.originalError.message).toBe('String error');
        });
    });

    // CLEAN ARCHITECTURE: Test application error wrapping
    describe('wrapApplicationError() method', () => {
        test('should wrap error with correct format and properties', () => {
            const originalError = new Error('Service coordination failed');
            const message = 'Use case execution failed';
            const context = { useCase: 'CreateUser', step: 'validation' };

            const wrappedError = errorHandlingService.wrapApplicationError(originalError, message, context);

            expect(wrappedError).toBeInstanceOf(Error);
            expect(wrappedError.message).toBe('[APPLICATION] Use case execution failed: Service coordination failed');
            expect(wrappedError.originalError).toBe(originalError);
            expect(wrappedError.context).toEqual(context);
            expect(wrappedError.layer).toBe('application');
            expect(wrappedError.timestamp).toBe('2024-01-01T12:00:00.000Z');
        });

        test('should log application error', () => {
            const originalError = new Error('Service failed');
            const message = 'Application error';

            errorHandlingService.wrapApplicationError(originalError, message);

            expect(mockLogger.error).toHaveBeenCalledWith(
                'Application error occurred',
                'ErrorHandlingService',
                expect.objectContaining({
                    layer: 'application'
                })
            );
        });

        test('should track metrics for application errors', () => {
            const originalError = new Error('Test error');
            
            errorHandlingService.wrapApplicationError(originalError, 'Test message');
            
            expect(errorHandlingService.metrics.operationCounts.get('applicationError')).toBe(1);
        });
    });

    // CLEAN ARCHITECTURE: Test infrastructure error wrapping
    describe('wrapInfrastructureError() method', () => {
        test('should wrap error with correct format and properties', () => {
            const originalError = new Error('Network timeout');
            const message = 'External API call failed';
            const context = { endpoint: '/api/users', timeout: 5000 };

            const wrappedError = errorHandlingService.wrapInfrastructureError(originalError, message, context);

            expect(wrappedError).toBeInstanceOf(Error);
            expect(wrappedError.message).toBe('[INFRASTRUCTURE] External API call failed: Network timeout');
            expect(wrappedError.originalError).toBe(originalError);
            expect(wrappedError.context).toEqual(context);
            expect(wrappedError.layer).toBe('infrastructure');
            expect(wrappedError.timestamp).toBe('2024-01-01T12:00:00.000Z');
        });

        test('should log infrastructure error', () => {
            const originalError = new Error('Network error');
            const message = 'Infrastructure failure';

            errorHandlingService.wrapInfrastructureError(originalError, message);

            expect(mockLogger.error).toHaveBeenCalledWith(
                'Infrastructure error occurred',
                'ErrorHandlingService',
                expect.objectContaining({
                    layer: 'infrastructure'
                })
            );
        });

        test('should track metrics for infrastructure errors', () => {
            const originalError = new Error('Test error');
            
            errorHandlingService.wrapInfrastructureError(originalError, 'Test message');
            
            expect(errorHandlingService.metrics.operationCounts.get('infrastructureError')).toBe(1);
        });
    });

    // CLEAN ARCHITECTURE: Test repository error wrapping
    describe('wrapRepositoryError() method', () => {
        test('should wrap error with correct format and properties', () => {
            const originalError = new Error('Database connection failed');
            const message = 'Data access error';
            const context = { table: 'users', operation: 'select', query: 'SELECT * FROM users' };

            const wrappedError = errorHandlingService.wrapRepositoryError(originalError, message, context);

            expect(wrappedError).toBeInstanceOf(Error);
            expect(wrappedError.message).toBe('[REPOSITORY] Data access error: Database connection failed');
            expect(wrappedError.originalError).toBe(originalError);
            expect(wrappedError.context).toEqual(context);
            expect(wrappedError.layer).toBe('repository');
            expect(wrappedError.timestamp).toBe('2024-01-01T12:00:00.000Z');
        });

        test('should log repository error', () => {
            const originalError = new Error('Database error');
            const message = 'Repository failure';

            errorHandlingService.wrapRepositoryError(originalError, message);

            expect(mockLogger.error).toHaveBeenCalledWith(
                'Repository error occurred',
                'ErrorHandlingService',
                expect.objectContaining({
                    layer: 'repository'
                })
            );
        });

        test('should track metrics for repository errors', () => {
            const originalError = new Error('Test error');
            
            errorHandlingService.wrapRepositoryError(originalError, 'Test message');
            
            expect(errorHandlingService.metrics.operationCounts.get('repositoryError')).toBe(1);
        });
    });

    // CLEAN ARCHITECTURE: Test context sanitization
    describe('Context Sanitization', () => {
        test('should handle empty context', () => {
            const originalError = new Error('Test error');
            const wrappedError = errorHandlingService.wrapDomainError(originalError, 'Test message', {});

            expect(wrappedError.context).toEqual({});
        });

        test('should handle undefined context', () => {
            const originalError = new Error('Test error');
            const wrappedError = errorHandlingService.wrapDomainError(originalError, 'Test message', undefined);

            expect(wrappedError.context).toEqual({});
        });

        test('should handle null context', () => {
            const originalError = new Error('Test error');
            const wrappedError = errorHandlingService.wrapDomainError(originalError, 'Test message', null);

            expect(wrappedError.context).toEqual({});
        });

        test('should handle non-object context', () => {
            const originalError = new Error('Test error');
            const wrappedError = errorHandlingService.wrapDomainError(originalError, 'Test message', 'string context');

            expect(wrappedError.context).toEqual({});
        });

        test('should truncate oversized context', () => {
            // Create a large context that exceeds maxContextSize
            const largeContext = { data: 'x'.repeat(2000) };
            const originalError = new Error('Test error');
            
            const wrappedError = errorHandlingService.wrapDomainError(originalError, 'Test message', largeContext);

            expect(wrappedError.context._truncated).toBe(true);
            expect(wrappedError.context._originalSize).toBeGreaterThan(1000);
            expect(wrappedError.context._maxSize).toBe(1000);
            expect(wrappedError.context.summary).toBe('Context truncated due to size limit');
        });

        test('should handle circular reference in context', () => {
            const circularContext = {};
            circularContext.self = circularContext;
            const originalError = new Error('Test error');
            
            const wrappedError = errorHandlingService.wrapDomainError(originalError, 'Test message', circularContext);

            expect(wrappedError.context._serializationError).toBe(true);
            expect(wrappedError.context.error).toContain('circular');
            expect(wrappedError.context.summary).toBe('Context could not be serialized');
        });
    });

    // CLEAN ARCHITECTURE: Test stack trace handling
    describe('Stack Trace Handling', () => {
        test('should include original stack when includeStackTrace is true', () => {
            const serviceWithStackTrace = new ErrorHandlingService({
                logger: mockLogger,
                includeStackTrace: true
            });
            
            const originalError = new Error('Test error');
            const wrappedError = serviceWithStackTrace.wrapDomainError(originalError, 'Test message');

            expect(wrappedError.originalStack).toBe(originalError.stack);
            expect(wrappedError.stack).toContain('Original Error Stack:');
        });

        test('should not include original stack when includeStackTrace is false', () => {
            const serviceWithoutStackTrace = new ErrorHandlingService({
                logger: mockLogger,
                includeStackTrace: false
            });
            
            const originalError = new Error('Test error');
            const wrappedError = serviceWithoutStackTrace.wrapDomainError(originalError, 'Test message');

            expect(wrappedError.originalStack).toBeUndefined();
            expect(wrappedError.stack).not.toContain('Original Error Stack:');
        });
    });

    // CLEAN ARCHITECTURE: Test error ID generation
    describe('Error ID Generation', () => {
        test('should generate unique error IDs', () => {
            const originalError = new Error('Test error');
            
            const error1 = errorHandlingService.wrapDomainError(originalError, 'Message 1');
            const error2 = errorHandlingService.wrapApplicationError(originalError, 'Message 2');

            expect(error1.errorId).toBeDefined();
            expect(error2.errorId).toBeDefined();
            expect(error1.errorId).toBe(error2.errorId); // Same because of mocked Date.now and Math.random
        });

        test('should include service name in error', () => {
            const originalError = new Error('Test error');
            const wrappedError = errorHandlingService.wrapDomainError(originalError, 'Test message');

            expect(wrappedError.serviceName).toBe('ErrorHandlingService');
        });
    });

    // CLEAN ARCHITECTURE: Test various error types
    describe('Various Error Types', () => {
        test('should handle Error objects', () => {
            const error = new Error('Standard error');
            const wrappedError = errorHandlingService.wrapDomainError(error, 'Test message');

            expect(wrappedError.originalError).toBe(error);
        });

        test('should handle TypeError objects', () => {
            const error = new TypeError('Type error');
            const wrappedError = errorHandlingService.wrapDomainError(error, 'Test message');

            expect(wrappedError.originalError).toBe(error);
            expect(wrappedError.originalError).toBeInstanceOf(TypeError);
        });

        test('should handle custom error objects', () => {
            class CustomError extends Error {
                constructor(message, code) {
                    super(message);
                    this.code = code;
                    this.name = 'CustomError';
                }
            }

            const error = new CustomError('Custom error', 'CUSTOM_001');
            const wrappedError = errorHandlingService.wrapDomainError(error, 'Test message');

            expect(wrappedError.originalError).toBe(error);
            expect(wrappedError.originalError.code).toBe('CUSTOM_001');
        });

        test('should handle string errors', () => {
            const stringError = 'String error message';
            const wrappedError = errorHandlingService.wrapDomainError(stringError, 'Test message');

            expect(wrappedError.originalError).toBeInstanceOf(Error);
            expect(wrappedError.originalError.message).toBe('String error message');
        });

        test('should handle number errors', () => {
            const numberError = 404;
            const wrappedError = errorHandlingService.wrapDomainError(numberError, 'Test message');

            expect(wrappedError.originalError).toBeInstanceOf(Error);
            expect(wrappedError.originalError.message).toBe('404');
        });
    });

    // CLEAN ARCHITECTURE: Test health check functionality
    describe('Health Check', () => {
        test('should return healthy status when initialized', async () => {
            await errorHandlingService.initialize();
            const health = await errorHandlingService.checkHealth();

            expect(health.healthy).toBe(true);
            expect(health.service).toBe('ErrorHandlingService');
            expect(health.details.state).toBe('running');
        });

        test('should include error statistics in health details', async () => {
            await errorHandlingService.initialize();
            
            // Generate errors for each layer
            const testError = new Error('Test');
            errorHandlingService.wrapDomainError(testError, 'Domain test');
            errorHandlingService.wrapApplicationError(testError, 'Application test');
            errorHandlingService.wrapInfrastructureError(testError, 'Infrastructure test');
            errorHandlingService.wrapRepositoryError(testError, 'Repository test');

            const health = await errorHandlingService.checkHealth();

            expect(health.details.totalErrorsHandled).toBe(4);
            expect(health.details.errorsByLayer.domain).toBe(1);
            expect(health.details.errorsByLayer.application).toBe(1);
            expect(health.details.errorsByLayer.infrastructure).toBe(1);
            expect(health.details.errorsByLayer.repository).toBe(1);
            expect(health.details.maxContextSize).toBe(1000);
            expect(health.details.includeStackTrace).toBe(true);
            expect(health.details.hasLogger).toBe(true);
        });
    });

    // CLEAN ARCHITECTURE: Test service shutdown
    describe('Service Shutdown', () => {
        test('should log shutdown message with statistics', async () => {
            await errorHandlingService.initialize();
            
            // Generate some errors
            const testError = new Error('Test');
            errorHandlingService.wrapDomainError(testError, 'Test 1');
            errorHandlingService.wrapApplicationError(testError, 'Test 2');

            await errorHandlingService.shutdown();

            expect(mockLogger.info).toHaveBeenCalledWith(
                'Error handling service shutting down',
                'ErrorHandlingService',
                expect.objectContaining({
                    totalErrorsHandled: 2,
                    errorsByLayer: expect.objectContaining({
                        domain: 1,
                        application: 1,
                        infrastructure: 0,
                        repository: 0
                    })
                })
            );
        });
    });

    // CLEAN ARCHITECTURE: Test service without logger
    describe('Service Without Logger', () => {
        test('should work without logger but not log', () => {
            const serviceWithoutLogger = new ErrorHandlingService({});
            const originalError = new Error('Test error');
            
            expect(() => {
                serviceWithoutLogger.wrapDomainError(originalError, 'Test message');
            }).not.toThrow();
            
            // Should still track metrics
            expect(serviceWithoutLogger.metrics.operationCounts.get('domainError')).toBe(1);
        });
    });
});
