const LoggerService = require('../../backend/services/foundation/CORE_LoggerService');

/**
 * Unit Tests for LoggerService
 * 
 * CLEAN ARCHITECTURE TESTING:
 * - Test service creation and initialization
 * - Test all public methods with various inputs
 * - Test error handling and edge cases
 * - Mock external dependencies (console methods)
 * - Verify proper AbstractService integration
 * 
 * Testing Strategy:
 * - Isolated unit tests with mocked dependencies
 * - Behavior verification through spies
 * - Edge case and error condition testing
 * - Metrics and health check validation
 */

describe('LoggerService', () => {
    let loggerService;
    let mockDependencies;
    let consoleSpy;

    // CLEAN ARCHITECTURE: Setup and teardown for isolated testing
    beforeEach(() => {
        // Mock dependencies object
        mockDependencies = {
            dateFormat: 'ISO',
            includeMetadata: true
        };

        // Create service instance
        loggerService = new LoggerService(mockDependencies);

        // Mock console methods to verify calls without actual output
        consoleSpy = {
            log: jest.spyOn(console, 'log').mockImplementation(() => {}),
            warn: jest.spyOn(console, 'warn').mockImplementation(() => {}),
            error: jest.spyOn(console, 'error').mockImplementation(() => {})
        };

        // Mock Date.now for predictable timestamps in tests
        jest.spyOn(Date.prototype, 'toISOString').mockReturnValue('2024-01-01T12:00:00.000Z');
    });

    afterEach(() => {
        // CLEAN ARCHITECTURE: Clean up mocks after each test
        jest.restoreAllMocks();
        loggerService.clearMetrics();
    });

    // CLEAN ARCHITECTURE: Test service creation and inheritance
    describe('Service Creation', () => {
        test('should extend AbstractService', () => {
            expect(loggerService).toBeInstanceOf(require('../../backend/services/base/CORE_AbstractService'));
        });

        test('should create with correct service name', () => {
            expect(loggerService.name).toBe('LoggerService');
        });

        test('should accept dependencies in constructor', () => {
            const customDependencies = {
                dateFormat: 'custom',
                includeMetadata: false
            };
            
            const customLogger = new LoggerService(customDependencies);
            expect(customLogger.dependencies).toEqual(customDependencies);
            expect(customLogger.dateFormat).toBe('custom');
            expect(customLogger.includeMetadata).toBe(false);
        });

        test('should have default dependency values', () => {
            const defaultLogger = new LoggerService();
            expect(defaultLogger.dateFormat).toBe('ISO');
            expect(defaultLogger.includeMetadata).toBe(true);
        });
    });

    // CLEAN ARCHITECTURE: Test service initialization
    describe('Service Initialization', () => {
        test('should initialize successfully', async () => {
            await loggerService.initialize();
            
            expect(loggerService.initialized).toBe(true);
            expect(loggerService.healthy).toBe(true);
            expect(loggerService.state).toBe('running');
        });

        test('should log initialization message', async () => {
            await loggerService.initialize();
            
            expect(consoleSpy.log).toHaveBeenCalledWith(
                expect.stringContaining('[2024-01-01T12:00:00.000Z] [INFO] [LoggerService] Logger service initialized')
            );
        });
    });

    // CLEAN ARCHITECTURE: Test info logging method
    describe('info() method', () => {
        test('should log info message with correct format', () => {
            loggerService.info('Test message', 'TestContext');
            
            expect(consoleSpy.log).toHaveBeenCalledWith(
                '[2024-01-01T12:00:00.000Z] [INFO] [TestContext] Test message {}'
            );
        });

        test('should log info message with metadata', () => {
            const metadata = { userId: 123, action: 'test' };
            loggerService.info('Test message', 'TestContext', metadata);
            
            expect(consoleSpy.log).toHaveBeenCalledWith(
                '[2024-01-01T12:00:00.000Z] [INFO] [TestContext] Test message {"userId":123,"action":"test"}'
            );
        });

        test('should use default context when not provided', () => {
            loggerService.info('Test message');
            
            expect(consoleSpy.log).toHaveBeenCalledWith(
                '[2024-01-01T12:00:00.000Z] [INFO] [GENERAL] Test message {}'
            );
        });

        test('should track metrics for info operations', () => {
            loggerService.info('Test message');
            
            expect(loggerService.metrics.operationCounts.get('info')).toBe(1);
            expect(loggerService.metrics.lastOperationTime).toBeDefined();
        });
    });

    // CLEAN ARCHITECTURE: Test debug logging method
    describe('debug() method', () => {
        test('should log debug message with correct format', () => {
            loggerService.debug('Debug message', 'DebugContext');
            
            expect(consoleSpy.log).toHaveBeenCalledWith(
                '[2024-01-01T12:00:00.000Z] [DEBUG] [DebugContext] Debug message {}'
            );
        });

        test('should log debug message with metadata', () => {
            const metadata = { step: 1, data: 'test' };
            loggerService.debug('Debug message', 'DebugContext', metadata);
            
            expect(consoleSpy.log).toHaveBeenCalledWith(
                '[2024-01-01T12:00:00.000Z] [DEBUG] [DebugContext] Debug message {"step":1,"data":"test"}'
            );
        });

        test('should track metrics for debug operations', () => {
            loggerService.debug('Debug message');
            
            expect(loggerService.metrics.operationCounts.get('debug')).toBe(1);
        });
    });

    // CLEAN ARCHITECTURE: Test warn logging method
    describe('warn() method', () => {
        test('should log warning message with correct format', () => {
            loggerService.warn('Warning message', 'WarnContext');
            
            expect(consoleSpy.warn).toHaveBeenCalledWith(
                '[2024-01-01T12:00:00.000Z] [WARN] [WarnContext] Warning message {}'
            );
        });

        test('should log warning message with metadata', () => {
            const metadata = { code: 'WARN001', retry: true };
            loggerService.warn('Warning message', 'WarnContext', metadata);
            
            expect(consoleSpy.warn).toHaveBeenCalledWith(
                '[2024-01-01T12:00:00.000Z] [WARN] [WarnContext] Warning message {"code":"WARN001","retry":true}'
            );
        });

        test('should track metrics for warn operations', () => {
            loggerService.warn('Warning message');
            
            expect(loggerService.metrics.operationCounts.get('warn')).toBe(1);
        });
    });

    // CLEAN ARCHITECTURE: Test error logging method
    describe('error() method', () => {
        test('should log error message with correct format', () => {
            loggerService.error('Error message', 'ErrorContext');
            
            expect(consoleSpy.error).toHaveBeenCalledWith(
                '[2024-01-01T12:00:00.000Z] [ERROR] [ErrorContext] Error message {}'
            );
        });

        test('should log error message with metadata', () => {
            const metadata = { code: 'ERR001', stack: 'trace' };
            loggerService.error('Error message', 'ErrorContext', metadata);
            
            expect(consoleSpy.error).toHaveBeenCalledWith(
                '[2024-01-01T12:00:00.000Z] [ERROR] [ErrorContext] Error message {"code":"ERR001","stack":"trace"}'
            );
        });

        test('should track metrics for error operations', () => {
            loggerService.error('Error message');
            
            expect(loggerService.metrics.operationCounts.get('error')).toBe(1);
        });
    });

    // CLEAN ARCHITECTURE: Test message formatting edge cases
    describe('Message Formatting', () => {
        test('should handle empty metadata object', () => {
            loggerService.info('Test message', 'TestContext', {});
            
            expect(consoleSpy.log).toHaveBeenCalledWith(
                '[2024-01-01T12:00:00.000Z] [INFO] [TestContext] Test message {}'
            );
        });

        test('should handle undefined metadata', () => {
            loggerService.info('Test message', 'TestContext', undefined);
            
            expect(consoleSpy.log).toHaveBeenCalledWith(
                '[2024-01-01T12:00:00.000Z] [INFO] [TestContext] Test message {}'
            );
        });

        test('should handle empty context string', () => {
            loggerService.info('Test message', '');
            
            expect(consoleSpy.log).toHaveBeenCalledWith(
                '[2024-01-01T12:00:00.000Z] [INFO] [GENERAL] Test message {}'
            );
        });

        test('should handle null context', () => {
            loggerService.info('Test message', null);
            
            expect(consoleSpy.log).toHaveBeenCalledWith(
                '[2024-01-01T12:00:00.000Z] [INFO] [GENERAL] Test message {}'
            );
        });

        test('should handle metadata serialization errors', () => {
            // Create circular reference to cause JSON.stringify error
            const circularMetadata = {};
            circularMetadata.self = circularMetadata;
            
            loggerService.info('Test message', 'TestContext', circularMetadata);
            
            expect(consoleSpy.log).toHaveBeenCalledWith(
                expect.stringContaining('metadata_serialization_error')
            );
        });
    });

    // CLEAN ARCHITECTURE: Test metadata inclusion configuration
    describe('Metadata Configuration', () => {
        test('should exclude metadata when includeMetadata is false', () => {
            const noMetadataLogger = new LoggerService({ includeMetadata: false });
            const metadata = { userId: 123 };
            
            noMetadataLogger.info('Test message', 'TestContext', metadata);
            
            expect(consoleSpy.log).toHaveBeenCalledWith(
                '[2024-01-01T12:00:00.000Z] [INFO] [TestContext] Test message'
            );
        });

        test('should include metadata when includeMetadata is true (default)', () => {
            const metadata = { userId: 123 };
            loggerService.info('Test message', 'TestContext', metadata);
            
            expect(consoleSpy.log).toHaveBeenCalledWith(
                '[2024-01-01T12:00:00.000Z] [INFO] [TestContext] Test message {"userId":123}'
            );
        });
    });

    // CLEAN ARCHITECTURE: Test health check functionality
    describe('Health Check', () => {
        test('should return healthy status when initialized', async () => {
            await loggerService.initialize();
            const health = await loggerService.checkHealth();
            
            expect(health.healthy).toBe(true);
            expect(health.service).toBe('LoggerService');
            expect(health.details.state).toBe('running');
        });

        test('should include logging statistics in health details', async () => {
            await loggerService.initialize();
            
            // Generate some log entries
            loggerService.info('Test');
            loggerService.warn('Test');
            loggerService.error('Test');
            
            const health = await loggerService.checkHealth();
            
            expect(health.details.totalLogs).toBe(4); // 3 test logs + 1 initialization log
            expect(health.details.logBreakdown.info).toBe(2); // 1 test + 1 initialization
            expect(health.details.logBreakdown.warn).toBe(1);
            expect(health.details.logBreakdown.error).toBe(1);
        });
    });

    // CLEAN ARCHITECTURE: Test service shutdown
    describe('Service Shutdown', () => {
        test('should log shutdown message with statistics', async () => {
            await loggerService.initialize();
            
            // Generate some log entries
            loggerService.info('Test 1');
            loggerService.info('Test 2');
            
            await loggerService.shutdown();
            
            expect(consoleSpy.log).toHaveBeenCalledWith(
                expect.stringContaining('Logger service shutting down')
            );
            expect(consoleSpy.log).toHaveBeenCalledWith(
                expect.stringContaining('"totalLogs":3')
            );
        });
    });

    // CLEAN ARCHITECTURE: Test metrics integration
    describe('Metrics Integration', () => {
        test('should track operation counts by log level', () => {
            loggerService.info('Info 1');
            loggerService.info('Info 2');
            loggerService.debug('Debug 1');
            loggerService.warn('Warn 1');
            loggerService.error('Error 1');
            
            expect(loggerService.metrics.operationCounts.get('info')).toBe(2);
            expect(loggerService.metrics.operationCounts.get('debug')).toBe(1);
            expect(loggerService.metrics.operationCounts.get('warn')).toBe(1);
            expect(loggerService.metrics.operationCounts.get('error')).toBe(1);
        });

        test('should update lastOperationTime on each log', () => {
            const initialTime = loggerService.metrics.lastOperationTime;
            
            loggerService.info('Test');
            
            expect(loggerService.metrics.lastOperationTime).toBeGreaterThan(initialTime);
        });

        test('should provide comprehensive metrics through getMetrics', () => {
            loggerService.info('Test');
            loggerService.warn('Test');
            
            const metrics = loggerService.getMetrics();
            
            expect(metrics.service).toBe('LoggerService');
            expect(metrics.operationCounts.info).toBe(1);
            expect(metrics.operationCounts.warn).toBe(1);
            expect(metrics.state).toBe('created');
        });
    });

    // CLEAN ARCHITECTURE: Test error handling edge cases
    describe('Error Handling', () => {
        test('should handle extremely long messages', () => {
            const longMessage = 'A'.repeat(10000);
            
            expect(() => {
                loggerService.info(longMessage, 'TestContext');
            }).not.toThrow();
            
            expect(consoleSpy.log).toHaveBeenCalledWith(
                expect.stringContaining(longMessage)
            );
        });

        test('should handle special characters in messages', () => {
            const specialMessage = 'Message with 🚀 emoji and "quotes" and \n newlines';
            
            expect(() => {
                loggerService.info(specialMessage, 'TestContext');
            }).not.toThrow();
            
            expect(consoleSpy.log).toHaveBeenCalledWith(
                expect.stringContaining(specialMessage)
            );
        });

        test('should handle non-string messages', () => {
            const numberMessage = 12345;
            const booleanMessage = true;
            const objectMessage = { toString: () => 'object message' };
            
            expect(() => {
                loggerService.info(numberMessage, 'TestContext');
                loggerService.info(booleanMessage, 'TestContext');
                loggerService.info(objectMessage, 'TestContext');
            }).not.toThrow();
            
            expect(consoleSpy.log).toHaveBeenCalledTimes(3);
        });
    });

    // CLEAN ARCHITECTURE: Test service ready state
    describe('Service Ready State', () => {
        test('should not be ready before initialization', () => {
            expect(loggerService.isReady()).toBe(false);
        });

        test('should be ready after successful initialization', async () => {
            await loggerService.initialize();
            expect(loggerService.isReady()).toBe(true);
        });

        test('should not be ready after shutdown', async () => {
            await loggerService.initialize();
            await loggerService.shutdown();
            expect(loggerService.isReady()).toBe(false);
        });
    });
});
