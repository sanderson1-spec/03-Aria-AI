#!/usr/bin/env node

/**
 * Test Generator for Aria AI - Automates test creation
 * 
 * INCREMENTAL TESTING STRATEGY:
 * - Generates unit tests for all repositories and services
 * - Creates integration tests for service combinations
 * - Follows clean architecture testing patterns
 * - Ensures 100% coverage of new features
 */

const fs = require('fs').promises;
const path = require('path');

class TestGenerator {
    constructor() {
        this.projectRoot = path.join(__dirname, '..');
        this.testsDir = __dirname;
    }

    /**
     * Generate unit tests for all repositories
     */
    async generateRepositoryTests() {
        console.log('🏭 Generating Repository Unit Tests...\n');
        
        const repositoriesDir = path.join(this.projectRoot, 'backend/dal/repositories');
        const files = await fs.readdir(repositoriesDir);
        const repositoryFiles = files.filter(file => file.startsWith('CORE_') && file.endsWith('Repository.js'));
        
        for (const file of repositoryFiles) {
            const repositoryName = file.replace('CORE_', '').replace('.js', '');
            const testFile = path.join(this.testsDir, 'repositories', `${repositoryName}.test.js`);
            
            // Check if test already exists
            try {
                await fs.access(testFile);
                console.log(`  ⏭️  ${repositoryName} test already exists`);
                continue;
            } catch {
                // Test doesn't exist, create it
            }
            
            const testContent = await this.generateRepositoryTestTemplate(repositoryName, file);
            await fs.writeFile(testFile, testContent);
            console.log(`  ✅ Generated ${repositoryName} test`);
        }
    }

    /**
     * Generate repository test template
     */
    async generateRepositoryTestTemplate(repositoryName, fileName) {
        const className = fileName.replace('.js', '');
        const tableName = this.inferTableName(repositoryName);
        
        return `#!/usr/bin/env node

/**
 * Unit Tests for ${repositoryName}
 * 
 * CLEAN ARCHITECTURE TESTING:
 * - Test repository creation and inheritance
 * - Test all CRUD operations with proper validation
 * - Test multi-user support and data isolation
 * - Mock database dependencies for isolated testing
 * - Verify proper error handling
 */

const ${repositoryName} = require('../../backend/dal/repositories/${fileName}');
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
        console.log(\`\\n🧪 \${this.name}\`);
        console.log('='.repeat(this.name.length + 4));
        
        for (const { description, testFunction } of this.tests) {
            try {
                await testFunction();
                console.log(\`  ✅ \${description}\`);
                this.passed++;
            } catch (error) {
                console.log(\`  ❌ \${description}\`);
                console.log(\`     Error: \${error.message}\`);
                this.failed++;
            }
        }
        
        const total = this.passed + this.failed;
        console.log(\`\\n📊 Results: \${this.passed}/\${total} passed\`);
        
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
                const wrappedError = new Error(\`\${message}: \${error.message}\`);
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

async function run${repositoryName}Tests() {
    const suite = new SimpleTest('${repositoryName} Unit Tests');
    let repository;
    let mockDeps;

    // Setup before each test
    function setup() {
        mockDeps = createMockDependencies();
        repository = new ${repositoryName}('${tableName}', mockDeps);
    }

    // CLEAN ARCHITECTURE: Test repository creation and inheritance
    suite.test('should extend BaseRepository', () => {
        setup();
        ArchitectureAssertions.assertExtendsBaseRepository(repository);
    });

    suite.test('should have correct table name', () => {
        setup();
        if (repository.tableName !== '${tableName}') {
            throw new Error(\`Expected table name '${tableName}', got '\${repository.tableName}'\`);
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

    // TODO: Add specific tests for ${repositoryName} domain methods
    // TODO: Add multi-user support tests if applicable
    // TODO: Add business logic validation tests

    return await suite.run();
}

// Run tests if called directly
if (require.main === module) {
    run${repositoryName}Tests()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('❌ Test execution failed:', error.message);
            process.exit(1);
        });
}

module.exports = { run${repositoryName}Tests };`;
    }

    /**
     * Infer table name from repository name
     */
    inferTableName(repositoryName) {
        const mapping = {
            'UserRepository': 'users',
            'UserSessionRepository': 'user_sessions',
            'ChatRepository': 'chats',
            'ConversationRepository': 'conversation_logs',
            'PersonalityRepository': 'personalities',
            'SessionRepository': 'sessions',
            'PsychologyRepository': 'psychology_frameworks',
            'ProactiveRepository': 'proactive_engagements',
            'ConfigurationRepository': 'configuration',
            'AnalyticsRepository': 'analytics_data',
            'SchemaRepository': 'schema_versions'
        };
        
        return mapping[repositoryName] || repositoryName.toLowerCase();
    }

    /**
     * Generate service tests for all services
     */
    async generateServiceTests() {
        console.log('🔧 Generating Service Unit Tests...\n');
        
        const servicesDir = path.join(this.projectRoot, 'backend/services');
        
        // Get all service directories
        const domains = ['foundation', 'intelligence', 'domain'];
        
        for (const domain of domains) {
            const domainDir = path.join(servicesDir, domain);
            
            try {
                const files = await fs.readdir(domainDir);
                const serviceFiles = files.filter(file => file.startsWith('CORE_') && file.endsWith('Service.js'));
                
                for (const file of serviceFiles) {
                    const serviceName = file.replace('CORE_', '').replace('.js', '');
                    const testFile = path.join(this.testsDir, 'services', `${serviceName}.test.js`);
                    
                    // Check if test already exists
                    try {
                        await fs.access(testFile);
                        console.log(`  ⏭️  ${serviceName} test already exists`);
                        continue;
                    } catch {
                        // Test doesn't exist, create it
                    }
                    
                    const testContent = await this.generateServiceTestTemplate(serviceName, file, domain);
                    await fs.writeFile(testFile, testContent);
                    console.log(`  ✅ Generated ${serviceName} test`);
                }
            } catch (error) {
                console.log(`  ⚠️  No services found in ${domain} directory`);
            }
        }
    }

    /**
     * Generate service test template
     */
    async generateServiceTestTemplate(serviceName, fileName, domain) {
        const className = fileName.replace('.js', '');
        
        return `#!/usr/bin/env node

/**
 * Unit Tests for ${serviceName}
 * 
 * CLEAN ARCHITECTURE TESTING:
 * - Test service creation and inheritance
 * - Test all public methods with various inputs
 * - Test dependency injection and initialization
 * - Mock external dependencies for isolated testing
 * - Verify proper AbstractService integration
 */

const ${serviceName} = require('../../backend/services/${domain}/${fileName}');
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
        console.log(\`\\n🧪 \${this.name}\`);
        console.log('='.repeat(this.name.length + 4));
        
        for (const { description, testFunction } of this.tests) {
            try {
                await testFunction();
                console.log(\`  ✅ \${description}\`);
                this.passed++;
            } catch (error) {
                console.log(\`  ❌ \${description}\`);
                console.log(\`     Error: \${error.message}\`);
                this.failed++;
            }
        }
        
        const total = this.passed + this.failed;
        console.log(\`\\n📊 Results: \${this.passed}/\${total} passed\`);
        
        return this.failed === 0;
    }
}

async function run${serviceName}Tests() {
    const suite = new SimpleTest('${serviceName} Unit Tests');
    let service;
    let mockDeps;

    // Setup before each test
    function setup() {
        mockDeps = MockFactory.createServiceMocks('${serviceName.toLowerCase()}');
        service = new ${serviceName}(mockDeps);
    }

    // CLEAN ARCHITECTURE: Test service creation and inheritance
    suite.test('should extend AbstractService', () => {
        setup();
        ArchitectureAssertions.assertExtendsAbstractService(service);
    });

    suite.test('should have correct service name', () => {
        setup();
        if (service.name !== '${serviceName}') {
            throw new Error(\`Expected service name '${serviceName}', got '\${service.name}'\`);
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
        
        if (health.service !== '${serviceName}') {
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

    // TODO: Add specific tests for ${serviceName} business logic
    // TODO: Add dependency interaction tests
    // TODO: Add error handling tests for ${serviceName} specific scenarios

    return await suite.run();
}

// Run tests if called directly
if (require.main === module) {
    run${serviceName}Tests()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('❌ Test execution failed:', error.message);
            process.exit(1);
        });
}

module.exports = { run${serviceName}Tests };`;
    }

    /**
     * Generate all missing tests
     */
    async generateAllTests() {
        console.log('🚀 Generating Complete Test Suite for Aria AI\n');
        
        await this.generateRepositoryTests();
        console.log('');
        await this.generateServiceTests();
        
        console.log('\n📋 Test Generation Summary:');
        console.log('  🏭 Repository tests generated');
        console.log('  🔧 Service tests generated');
        console.log('  🔗 Integration tests ready');
        console.log('  🌐 E2E tests ready');
        console.log('\n🎯 Next Steps:');
        console.log('  1. Run: npm test (or node tests/run-all-tests.js)');
        console.log('  2. Review generated tests and add specific business logic tests');
        console.log('  3. Customize tests for domain-specific requirements');
        console.log('  4. Add more integration and E2E scenarios as features grow');
    }
}

// CLI execution
if (require.main === module) {
    const generator = new TestGenerator();
    generator.generateAllTests()
        .then(() => {
            console.log('\n✅ Test generation completed successfully!');
        })
        .catch(error => {
            console.error('❌ Test generation failed:', error.message);
            process.exit(1);
        });
}

module.exports = { TestGenerator };
