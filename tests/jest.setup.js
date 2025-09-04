/**
 * Jest Setup File
 * Configures test environment for Aria AI
 */

// Set test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent'; // Suppress all logging in tests
process.env.SKIP_LLM_CONNECTION_TEST = 'true'; // Skip LLM tests

// Configure Jest timeout
jest.setTimeout(10000);

// Suppress console.log during tests to reduce noise
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

beforeAll(() => {
    console.log = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
});

afterAll(() => {
    console.log = originalConsoleLog;
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;
});

// Global test utilities
global.createUniqueTestId = () => `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Database test helpers
global.testDbPath = ':memory:'; // Always use in-memory database for tests

// Mock factory for common dependencies
global.createMockDependencies = () => {
    const mockDAL = {
        query: jest.fn().mockResolvedValue([]),
        queryOne: jest.fn().mockResolvedValue(null),
        execute: jest.fn().mockResolvedValue({ lastID: 1, changes: 1 }),
        findById: jest.fn().mockResolvedValue(null),
        findAll: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({ id: 'mock-id' }),
        update: jest.fn().mockResolvedValue({ changes: 1 }),
        delete: jest.fn().mockResolvedValue({ changes: 1 }),
        count: jest.fn().mockResolvedValue(0),
        countDistinct: jest.fn().mockResolvedValue(0)
    };

    return {
        logger: {
            info: jest.fn(),
            debug: jest.fn(),
            warn: jest.fn(),
            error: jest.fn()
        },
        errorHandling: {
            wrapRepositoryError: jest.fn((error, message, context) => new Error(message)),
            wrapInfrastructureError: jest.fn((error, message) => new Error(message)),
            wrapDomainError: jest.fn((error, message, context) => new Error(message))
        },
        errorHandler: {
            wrapRepositoryError: jest.fn((error, message, context) => new Error(message)),
            wrapInfrastructureError: jest.fn((error, message) => new Error(message)),
            wrapDomainError: jest.fn((error, message, context) => new Error(message))
        },
        dal: mockDAL
    };
};

// Setup and teardown for each test
beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
});

afterEach(() => {
    // Clean up any test data
    jest.resetAllMocks();
});
