/**
 * Test Configuration for Aria AI
 * 
 * Centralizes test settings and ensures consistent test environment
 */

const path = require('path');

module.exports = {
    // Test directories
    directories: {
        tests: path.join(__dirname),
        unit: {
            services: path.join(__dirname, 'services'),
            repositories: path.join(__dirname, 'repositories'),
            api: path.join(__dirname, 'api')
        },
        integration: path.join(__dirname, 'integration'),
        e2e: path.join(__dirname, 'e2e'),
        frontend: path.join(__dirname, '..', 'frontend', 'src')
    },

    // Test database settings
    database: {
        testDbPath: path.join(__dirname, '..', 'database', 'test_aria.db'),
        e2eDbPath: path.join(__dirname, '..', 'database', 'test_e2e_aria.db'),
        memoryDb: ':memory:'
    },

    // API endpoints for testing
    api: {
        baseUrl: 'http://localhost:3001',
        endpoints: {
            characters: '/api/characters',
            chat: '/api/chat',
            settings: '/api/settings'
        }
    },

    // Frontend testing settings
    frontend: {
        baseUrl: 'http://localhost:5173',
        testTimeout: 10000
    },

    // Test coverage requirements
    coverage: {
        statements: 80,
        branches: 70,
        functions: 80,
        lines: 80
    },

    // Test patterns
    patterns: {
        unit: '**/*.test.js',
        integration: '**/integration/**/*.test.js',
        e2e: '**/e2e/**/*.test.js',
        frontend: '**/*.test.{ts,tsx}'
    },

    // Mock settings
    mocks: {
        enableNetworkMocks: true,
        enableDatabaseMocks: false, // Use real database for integration tests
        mockLLMResponses: true
    },

    // Test environment variables
    environment: {
        NODE_ENV: 'test',
        TEST_MODE: 'true',
        LOG_LEVEL: 'error', // Reduce noise in tests
        DB_PATH: ':memory:'
    }
};
