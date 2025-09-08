#!/usr/bin/env node

/**
 * Test Framework for Aria AI - Clean Architecture Testing
 * 
 * TESTING STRATEGY:
 * 1. Unit Tests (Many) - Individual classes in isolation
 * 2. Integration Tests (Some) - Service interactions  
 * 3. E2E Tests (Few) - Complete workflows
 * 
 * CLEAN ARCHITECTURE COMPLIANCE:
 * - Tests mirror the layered architecture
 * - Dependencies are mocked at layer boundaries
 * - Each layer is tested independently
 * - Integration tests verify cross-layer interactions
 */

const fs = require('fs').promises;
const path = require('path');
const TestDataCleanup = require('./test-cleanup');

class TestFramework {
    constructor() {
        this.testSuites = new Map();
        this.results = {
            unit: { passed: 0, failed: 0, total: 0 },
            integration: { passed: 0, failed: 0, total: 0 },
            e2e: { passed: 0, failed: 0, total: 0 }
        };
        this.verbose = process.env.TEST_VERBOSE === 'true';
    }

    /**
     * Register a test suite
     */
    registerSuite(name, type, testFunction) {
        this.testSuites.set(name, { type, testFunction });
    }

    /**
     * Run all tests
     */
    async runAll() {
        console.log('🧪 Aria AI Test Framework');
        console.log('📋 Clean Architecture Testing Strategy\n');
        
        const startTime = Date.now();
        
        try {
            // Clean up any existing test data before starting
            console.log('🧹 Pre-test cleanup...');
            const cleanup = new TestDataCleanup();
            await cleanup.cleanup();
            console.log('');
            
            // Run tests by type in order: unit -> integration -> e2e
            await this.runTestsByType('unit');
            await this.runTestsByType('integration'); 
            await this.runTestsByType('e2e');
            
            const duration = Date.now() - startTime;
            this.printSummary(duration);
            
            return this.getOverallSuccess();
            
        } finally {
            // Always clean up test data after tests, regardless of success/failure
            console.log('\n🧹 Post-test cleanup...');
            try {
                const cleanup = new TestDataCleanup();
                await cleanup.cleanup();
                console.log('✅ Test data cleanup completed\n');
            } catch (error) {
                console.warn('⚠️  Post-test cleanup failed:', error.message);
                console.warn('Please run: node tests/test-cleanup.js\n');
            }
        }
    }

    /**
     * Run tests of specific type
     */
    async runTestsByType(type) {
        const suites = Array.from(this.testSuites.entries())
            .filter(([_, suite]) => suite.type === type);
            
        if (suites.length === 0) {
            console.log(`📦 ${type.toUpperCase()} Tests: No tests found\n`);
            return;
        }
        
        console.log(`📦 ${type.toUpperCase()} Tests (${suites.length} suites):`);
        
        for (const [name, suite] of suites) {
            try {
                console.log(`  🔍 Running ${name}...`);
                await suite.testFunction();
                this.results[type].passed++;
                console.log(`  ✅ ${name} passed`);
            } catch (error) {
                this.results[type].failed++;
                console.log(`  ❌ ${name} failed: ${error.message}`);
                if (this.verbose) {
                    console.log(`     Stack: ${error.stack}`);
                }
            }
            this.results[type].total++;
        }
        
        console.log('');
    }

    /**
     * Print test summary
     */
    printSummary(duration) {
        console.log('📊 TEST SUMMARY');
        console.log('================');
        
        const totalPassed = this.results.unit.passed + this.results.integration.passed + this.results.e2e.passed;
        const totalFailed = this.results.unit.failed + this.results.integration.failed + this.results.e2e.failed;
        const totalTests = totalPassed + totalFailed;
        
        console.log(`🧪 Unit Tests:        ${this.results.unit.passed}/${this.results.unit.total} passed`);
        console.log(`🔗 Integration Tests: ${this.results.integration.passed}/${this.results.integration.total} passed`);
        console.log(`🌐 E2E Tests:         ${this.results.e2e.passed}/${this.results.e2e.total} passed`);
        console.log(`⏱️  Duration:         ${duration}ms`);
        console.log(`📈 Overall:          ${totalPassed}/${totalTests} tests passed`);
        
        if (totalFailed > 0) {
            console.log(`\n❌ ${totalFailed} test(s) failed`);
        } else {
            console.log(`\n🎉 All tests passed!`);
        }
    }

    /**
     * Check if all tests passed
     */
    getOverallSuccess() {
        const totalFailed = this.results.unit.failed + this.results.integration.failed + this.results.e2e.failed;
        return totalFailed === 0;
    }
}

/**
 * Mock Factory for creating test doubles
 */
class MockFactory {
    /**
     * Create mock dependencies for services
     */
    static createServiceMocks(serviceName) {
        const baseMocks = {
            logger: {
                info: jest.fn(),
                debug: jest.fn(), 
                warn: jest.fn(),
                error: jest.fn()
            },
            errorHandling: {
                wrapDomainError: jest.fn(error => error),
                wrapApplicationError: jest.fn(error => error),
                wrapInfrastructureError: jest.fn(error => error),
                wrapRepositoryError: jest.fn(error => error)
            }
        };
        
        // Service-specific mocks
        switch (serviceName) {
            case 'database':
                return {
                    ...baseMocks,
                    dal: MockFactory.createDALMock()
                };
                
            case 'psychology':
                return {
                    ...baseMocks,
                    database: MockFactory.createDatabaseServiceMock(),
                    structuredResponse: MockFactory.createStructuredResponseMock()
                };
                
            case 'llm':
                return {
                    ...baseMocks,
                    configuration: MockFactory.createConfigurationMock()
                };
                
            default:
                return baseMocks;
        }
    }

    /**
     * Create mock DAL
     */
    static createDALMock() {
        return {
            query: jest.fn().mockResolvedValue([]),
            queryOne: jest.fn().mockResolvedValue(null),
            run: jest.fn().mockResolvedValue({ changes: 1 }),
            executeInTransaction: jest.fn().mockImplementation(callback => callback())
        };
    }

    /**
     * Create mock database service
     */
    static createDatabaseServiceMock() {
        return {
            getDAL: jest.fn().mockReturnValue(MockFactory.createDALMock()),
            repositories: new Map()
        };
    }

    /**
     * Create mock structured response service
     */
    static createStructuredResponseMock() {
        return {
            parseResponse: jest.fn().mockResolvedValue({ success: true, data: {} })
        };
    }

    /**
     * Create mock configuration service
     */
    static createConfigurationMock() {
        return {
            get: jest.fn().mockReturnValue('default-value'),
            set: jest.fn().mockResolvedValue(true)
        };
    }

    /**
     * Create mock repository
     */
    static createRepositoryMock(tableName) {
        return {
            tableName,
            count: jest.fn().mockResolvedValue(0),
            findById: jest.fn().mockResolvedValue(null),
            findAll: jest.fn().mockResolvedValue([]),
            create: jest.fn().mockResolvedValue({ id: 'mock-id' }),
            update: jest.fn().mockResolvedValue({ changes: 1 }),
            delete: jest.fn().mockResolvedValue({ changes: 1 })
        };
    }
}

/**
 * Test Database Helper - Creates isolated test databases
 */
class TestDatabaseHelper {
    constructor() {
        this.testDbPath = path.join(__dirname, '../database/test_aria.db');
    }

    /**
     * Create clean test database
     */
    async createTestDatabase() {
        const sqlite3 = require('sqlite3').verbose();
        const schemaPath = path.join(__dirname, '../database/schema.sql');
        
        // Remove existing test database
        try {
            await fs.unlink(this.testDbPath);
        } catch (error) {
            // File doesn't exist, that's fine
        }
        
        // Read schema
        const schema = await fs.readFile(schemaPath, 'utf8');
        
        // Create new test database
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(this.testDbPath, (err) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                // Execute schema
                db.exec(schema, (err) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve(db);
                });
            });
        });
    }

    /**
     * Clean up test database
     */
    async cleanupTestDatabase() {
        try {
            await fs.unlink(this.testDbPath);
        } catch (error) {
            // File doesn't exist, that's fine
        }
    }

    /**
     * Get test database path
     */
    getTestDbPath() {
        return this.testDbPath;
    }
}

/**
 * Assertion helpers for clean architecture testing
 */
class ArchitectureAssertions {
    /**
     * Assert service extends AbstractService
     */
    static assertExtendsAbstractService(serviceInstance) {
        const AbstractService = require('../backend/services/base/CORE_AbstractService');
        if (!(serviceInstance instanceof AbstractService)) {
            throw new Error(`Service must extend AbstractService`);
        }
    }

    /**
     * Assert repository extends BaseRepository
     */
    static assertExtendsBaseRepository(repositoryInstance) {
        const BaseRepository = require('../backend/dal/CORE_BaseRepository');
        if (!(repositoryInstance instanceof BaseRepository)) {
            throw new Error(`Repository must extend BaseRepository`);
        }
    }

    /**
     * Assert service has required methods
     */
    static assertServiceInterface(serviceInstance) {
        const requiredMethods = ['initialize', 'shutdown', 'checkHealth', 'getMetrics'];
        
        for (const method of requiredMethods) {
            if (typeof serviceInstance[method] !== 'function') {
                throw new Error(`Service must implement ${method}() method`);
            }
        }
    }

    /**
     * Assert repository has required methods
     */
    static assertRepositoryInterface(repositoryInstance) {
        const requiredMethods = ['count', 'findById', 'create', 'update', 'delete'];
        
        for (const method of requiredMethods) {
            if (typeof repositoryInstance[method] !== 'function') {
                throw new Error(`Repository must implement ${method}() method`);
            }
        }
    }

    /**
     * Assert multi-user support (all operations require userId)
     */
    static assertMultiUserSupport(repositoryInstance, methodName) {
        const method = repositoryInstance[methodName];
        if (typeof method !== 'function') {
            throw new Error(`Method ${methodName} does not exist`);
        }
        
        // Check method signature expects userId as first parameter
        const methodString = method.toString();
        if (!methodString.includes('userId')) {
            throw new Error(`Method ${methodName} must support multi-user operations (require userId parameter)`);
        }
    }
}

module.exports = {
    TestFramework,
    MockFactory,
    TestDatabaseHelper,
    ArchitectureAssertions
};
