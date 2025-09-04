#!/usr/bin/env node

/**
 * Unit Tests for SessionRepository
 * 
 * CLEAN ARCHITECTURE TESTING:
 * - Test repository creation and inheritance
 * - Test all CRUD operations with proper validation
 * - Test multi-user support and data isolation
 * - Mock database dependencies for isolated testing
 * - Verify proper error handling
 */

const SessionRepository = require('../../backend/dal/repositories/CORE_SessionRepository.js');
const { ArchitectureAssertions } = require('../test-framework');

class SimpleTest {
    constructor(name) {
        this.name = name;
        this.tests = [];
        this.passed = 0;
        this.failed = 0;
    }

    test(description, testFunction) {
        this.tests.push({ description, testFunction });
    }

    async run() {
        console.log(`\n🧪 ${this.name}`);
        console.log('='.repeat(this.name.length + 4));
        
        for (const { description, testFunction } of this.tests) {
            try {
                await testFunction();
                console.log(`  ✅ ${description}`);
                this.passed++;
            } catch (error) {
                console.log(`  ❌ ${description}`);
                console.log(`     Error: ${error.message}`);
                this.failed++;
            }
        }
        
        const total = this.passed + this.failed;
        console.log(`\n📊 Results: ${this.passed}/${total} passed`);
        
        return this.failed === 0;
    }
}

// Helper functions
function createMockDependencies() {
    return {
        logger: {
            info: () => {},
            debug: () => {},
            warn: () => {},
            error: () => {}
        },
        errorHandling: {
            wrapRepositoryError: (error, message, context) => {
                const wrappedError = new Error(`${message}: ${error.message}`);
                wrappedError.context = context;
                return wrappedError;
            }
        },
        dbAccess: {
            queryOne: () => Promise.resolve(null),
            queryAll: () => Promise.resolve([]),
            run: () => Promise.resolve({ changes: 1 })
        }
    };
}

async function runSessionRepositoryTests() {
    const suite = new SimpleTest('SessionRepository Unit Tests');
    let repository;
    let mockDeps;

    // Setup before each test
    function setup() {
        mockDeps = createMockDependencies();
        repository = new SessionRepository('sessions', mockDeps);
    }

    // CLEAN ARCHITECTURE: Test repository creation and inheritance
    suite.test('should extend BaseRepository', () => {
        setup();
        ArchitectureAssertions.assertExtendsBaseRepository(repository);
    });

    suite.test('should have correct table name', () => {
        setup();
        if (repository.tableName !== 'sessions') {
            throw new Error(`Expected table name 'sessions', got '${repository.tableName}'`);
        }
    });

    suite.test('should implement required repository interface', () => {
        setup();
        ArchitectureAssertions.assertRepositoryInterface(repository);
    });

    // CLEAN ARCHITECTURE: Test basic CRUD operations
    suite.test('should support count operations', async () => {
        setup();
        mockDeps.dbAccess.queryOne = () => Promise.resolve({ count: 5 });
        
        const count = await repository.count();
        
        if (count !== 5) {
            throw new Error('count() should return correct count');
        }
    });

    suite.test('should support findById operations', async () => {
        setup();
        const mockRecord = { id: 'test-id', name: 'test' };
        mockDeps.dbAccess.queryOne = () => Promise.resolve(mockRecord);
        
        const result = await repository.findById('test-id');
        
        if (!result || result.id !== 'test-id') {
            throw new Error('findById should return correct record');
        }
    });

    // CLEAN ARCHITECTURE: Test error handling
    suite.test('should handle database errors gracefully', async () => {
        setup();
        mockDeps.dbAccess.queryOne = () => Promise.reject(new Error('Database connection failed'));
        
        try {
            await repository.findById('test-id');
            throw new Error('Should have thrown an error');
        } catch (error) {
            if (!error.message.includes('Failed to find')) {
                throw new Error('Should wrap database errors with context');
            }
        }
    });

    // TODO: Add specific tests for SessionRepository domain methods
    // TODO: Add multi-user support tests if applicable
    // TODO: Add business logic validation tests

    return await suite.run();
}

// Run tests if called directly
if (require.main === module) {
    runSessionRepositoryTests()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('❌ Test execution failed:', error.message);
            process.exit(1);
        });
}

module.exports = { runSessionRepositoryTests };