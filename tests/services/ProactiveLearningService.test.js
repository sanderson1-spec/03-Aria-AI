#!/usr/bin/env node

/**
 * Unit Tests for ProactiveLearningService
 * 
 * CLEAN ARCHITECTURE TESTING:
 * - Test service creation and inheritance
 * - Test all public methods with various inputs
 * - Test dependency injection and initialization
 * - Mock external dependencies for isolated testing
 * - Verify proper AbstractService integration
 */

const ProactiveLearningService = require('../../backend/services/domain/CORE_ProactiveLearningService.js');
const { MockFactory, ArchitectureAssertions } = require('../test-framework');

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

async function runProactiveLearningServiceTests() {
    const suite = new SimpleTest('ProactiveLearningService Unit Tests');
    let service;
    let mockDeps;

    // Setup before each test
    function setup() {
        mockDeps = MockFactory.createServiceMocks('proactivelearningservice');
        service = new ProactiveLearningService(mockDeps);
    }

    // CLEAN ARCHITECTURE: Test service creation and inheritance
    suite.test('should extend AbstractService', () => {
        setup();
        ArchitectureAssertions.assertExtendsAbstractService(service);
    });

    suite.test('should have correct service name', () => {
        setup();
        if (service.name !== 'ProactiveLearningService') {
            throw new Error(`Expected service name 'ProactiveLearningService', got '${service.name}'`);
        }
    });

    suite.test('should implement required service interface', () => {
        setup();
        ArchitectureAssertions.assertServiceInterface(service);
    });

    // CLEAN ARCHITECTURE: Test service initialization
    suite.test('should initialize successfully', async () => {
        setup();
        await service.initialize();
        
        if (!service.initialized) {
            throw new Error('Service should be initialized');
        }
        
        if (!service.healthy) {
            throw new Error('Service should be healthy after initialization');
        }
    });

    // CLEAN ARCHITECTURE: Test health check
    suite.test('should provide health status', async () => {
        setup();
        await service.initialize();
        
        const health = await service.checkHealth();
        
        if (!health.healthy) {
            throw new Error('Initialized service should be healthy');
        }
        
        if (health.service !== 'ProactiveLearningService') {
            throw new Error('Health check should return correct service name');
        }
    });

    // CLEAN ARCHITECTURE: Test graceful shutdown
    suite.test('should shutdown gracefully', async () => {
        setup();
        await service.initialize();
        await service.shutdown();
        
        if (service.state !== 'stopped') {
            throw new Error('Service should be stopped after shutdown');
        }
    });

    // TODO: Add specific tests for ProactiveLearningService business logic
    // TODO: Add dependency interaction tests
    // TODO: Add error handling tests for ProactiveLearningService specific scenarios

    return await suite.run();
}

// Run tests if called directly
if (require.main === module) {
    runProactiveLearningServiceTests()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('❌ Test execution failed:', error.message);
            process.exit(1);
        });
}

module.exports = { runProactiveLearningServiceTests };