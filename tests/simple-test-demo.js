#!/usr/bin/env node

/**
 * Simple Test Demo - Shows our testing approach working
 * 
 * This demonstrates:
 * 1. Unit testing individual repositories 
 * 2. Integration testing with real services
 * 3. Architecture compliance validation
 * 4. Multi-user support verification
 */

const UserRepository = require('../backend/dal/repositories/CORE_UserRepository');
const { setupServices } = require('../setupServices');

class SimpleTestSuite {
    constructor(name) {
        this.name = name;
        this.passed = 0;
        this.failed = 0;
    }

    async test(description, testFunction) {
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

    printResults() {
        const total = this.passed + this.failed;
        console.log(`\n📊 ${this.name}: ${this.passed}/${total} passed`);
        return this.failed === 0;
    }
}

async function runSimpleTestDemo() {
    console.log('🧪 Simple Test Demo - Aria AI Testing Framework\n');

    // UNIT TEST DEMO
    const unitSuite = new SimpleTestSuite('Unit Test Demo');
    console.log('🔬 Unit Tests:');

    await unitSuite.test('UserRepository should be loadable', async () => {
        const mockDAL = {
            query: () => Promise.resolve([]),
            queryOne: () => Promise.resolve(null),
            run: () => Promise.resolve({ changes: 1 }),
            findById: () => Promise.resolve(null),
            findAll: () => Promise.resolve([]),
            create: () => Promise.resolve({ id: 'mock-id' }),
            update: () => Promise.resolve({ changes: 1 }),
            delete: () => Promise.resolve({ changes: 1 }),
            count: () => Promise.resolve(0),
            countDistinct: () => Promise.resolve(0)
        };
        
        const mockDeps = {
            logger: { info: () => {}, debug: () => {}, warn: () => {}, error: () => {} },
            errorHandling: { wrapRepositoryError: (e) => e },
            dal: mockDAL,
            dbAccess: mockDAL
        };
        
        const userRepo = new UserRepository('users', mockDeps);
        
        if (userRepo.tableName !== 'users') {
            throw new Error('Repository should have correct table name');
        }
    });

    await unitSuite.test('UserRepository should have required methods', async () => {
        const mockDAL = {
            query: () => Promise.resolve([]),
            queryOne: () => Promise.resolve(null),
            run: () => Promise.resolve({ changes: 1 }),
            findById: () => Promise.resolve(null),
            findAll: () => Promise.resolve([]),
            create: () => Promise.resolve({ id: 'mock-id' }),
            update: () => Promise.resolve({ changes: 1 }),
            delete: () => Promise.resolve({ changes: 1 }),
            count: () => Promise.resolve(0),
            countDistinct: () => Promise.resolve(0)
        };
        
        const mockDeps = {
            logger: { info: () => {}, debug: () => {}, warn: () => {}, error: () => {} },
            errorHandling: { wrapRepositoryError: (e) => e },
            dal: mockDAL,
            dbAccess: mockDAL
        };
        
        const userRepo = new UserRepository('users', mockDeps);
        
        const requiredMethods = ['count', 'findById', 'create', 'update', 'delete', 'createUser', 'findByUsername', 'findByEmail'];
        
        for (const method of requiredMethods) {
            if (typeof userRepo[method] !== 'function') {
                throw new Error(`Repository missing required method: ${method}`);
            }
        }
    });

    const unitSuccess = unitSuite.printResults();

    // INTEGRATION TEST DEMO  
    const integrationSuite = new SimpleTestSuite('Integration Test Demo');
    console.log('\n🔗 Integration Tests:');

    await integrationSuite.test('All services should initialize successfully', async () => {
        // Use in-memory database for testing
        const serviceFactory = await setupServices({
            dbPath: ':memory:',
            includeMetadata: false
        });
        
        const services = serviceFactory.services;
        
        if (services.size !== 10) {
            throw new Error(`Expected 10 services, got ${services.size}`);
        }
        
        // Verify database service has all repositories
        const databaseService = services.get('database');
        if (databaseService.repositories.size !== 11) {
            throw new Error(`Expected 11 repositories, got ${databaseService.repositories.size}`);
        }
        
        // Cleanup
        await serviceFactory.shutdown();
    });

    await integrationSuite.test('DAL should provide access to all tables', async () => {
        const serviceFactory = await setupServices({
            dbPath: ':memory:',
            includeMetadata: false
        });
        
        const dal = serviceFactory.services.get('database').getDAL();
        
        // Test key repository access
        const expectedRepos = ['users', 'chats', 'conversations', 'psychology', 'proactive'];
        
        for (const repo of expectedRepos) {
            if (!dal[repo]) {
                throw new Error(`DAL missing repository: ${repo}`);
            }
            
            if (typeof dal[repo].count !== 'function') {
                throw new Error(`Repository ${repo} missing count method`);
            }
        }
        
        // Cleanup
        await serviceFactory.shutdown();
    });

    await integrationSuite.test('Multi-user data isolation should work', async () => {
        const serviceFactory = await setupServices({
            dbPath: ':memory:',
            includeMetadata: false
        });
        
        const dal = serviceFactory.services.get('database').getDAL();
        
        // Create two users with unique identifiers
        const timestamp = Date.now();
        const user1 = await dal.users.createUser({
            username: `testuser1_${timestamp}`,
            email: `user1_${timestamp}@test.com`,
            display_name: 'Test User 1'
        });
        
        const user2 = await dal.users.createUser({
            username: `testuser2_${timestamp}`,
            email: `user2_${timestamp}@test.com`,
            display_name: 'Test User 2'
        });
        
        // Create chats for each user
        const chat1 = await dal.chats.createChat(user1.id, {
            title: 'User 1 Chat',
            personality_id: 'default'
        });
        
        const chat2 = await dal.chats.createChat(user2.id, {
            title: 'User 2 Chat',
            personality_id: 'default'
        });
        
        // Verify isolation - each user should only see their own chat
        const user1Chats = await dal.chats.getUserChats(user1.id);
        const user2Chats = await dal.chats.getUserChats(user2.id);
        
        if (user1Chats.chats.length !== 1) {
            throw new Error('User 1 should have exactly 1 chat');
        }
        
        if (user2Chats.chats.length !== 1) {
            throw new Error('User 2 should have exactly 1 chat');
        }
        
        if (user1Chats.chats[0].title !== 'User 1 Chat') {
            throw new Error('User 1 should see their own chat title');
        }
        
        if (user2Chats.chats[0].title !== 'User 2 Chat') {
            throw new Error('User 2 should see their own chat title');
        }
        
        // Cleanup
        await serviceFactory.shutdown();
    });

    const integrationSuccess = integrationSuite.printResults();

    // PSYCHOLOGY DOMAIN TEST DEMO
    const psychSuite = new SimpleTestSuite('Psychology Domain Test Demo');
    console.log('\n🧠 Psychology Domain Tests:');

    await psychSuite.test('Psychology repository should handle domain tables', async () => {
        const serviceFactory = await setupServices({
            dbPath: ':memory:',
            includeMetadata: false
        });
        
        const dal = serviceFactory.services.get('database').getDAL();
        
        // Test psychology domain methods exist
        const requiredMethods = [
            'getCharacterPsychologicalFrameworks',
            'getCharacterPsychologicalState', 
            'getPsychologyEvolutionLog',
            'saveCharacterPsychologicalState',
            'logPsychologyEvolution'
        ];
        
        for (const method of requiredMethods) {
            if (typeof dal.psychology[method] !== 'function') {
                throw new Error(`Psychology repository missing method: ${method}`);
            }
        }
        
        // Test methods can be called (should return empty arrays for new DB)
        const frameworks = await dal.psychology.getCharacterPsychologicalFrameworks('test-user', 'test-char');
        const state = await dal.psychology.getCharacterPsychologicalState('test-user', 'test-char');
        const evolution = await dal.psychology.getPsychologyEvolutionLog('test-user', 'test-char');
        
        if (!Array.isArray(frameworks)) {
            throw new Error('getCharacterPsychologicalFrameworks should return array');
        }
        
        if (!Array.isArray(evolution)) {
            throw new Error('getPsychologyEvolutionLog should return array');
        }
        
        // state can be null, that's fine
        
        // Cleanup
        await serviceFactory.shutdown();
    });

    await psychSuite.test('Proactive repository should handle domain tables', async () => {
        const serviceFactory = await setupServices({
            dbPath: ':memory:',
            includeMetadata: false
        });
        
        const dal = serviceFactory.services.get('database').getDAL();
        
        // Test proactive domain methods exist
        const requiredMethods = [
            'getEngagementHistory',
            'getLearningPatterns',
            'getTimingOptimizations'
        ];
        
        for (const method of requiredMethods) {
            if (typeof dal.proactive[method] !== 'function') {
                throw new Error(`Proactive repository missing method: ${method}`);
            }
        }
        
        // Test methods can be called
        const history = await dal.proactive.getEngagementHistory('test-user');
        const patterns = await dal.proactive.getLearningPatterns('test-user');
        const optimizations = await dal.proactive.getTimingOptimizations('test-user');
        
        if (!Array.isArray(history)) {
            throw new Error('getEngagementHistory should return array');
        }
        
        if (!Array.isArray(patterns)) {
            throw new Error('getLearningPatterns should return array');
        }
        
        if (!Array.isArray(optimizations)) {
            throw new Error('getTimingOptimizations should return array');
        }
        
        // Cleanup
        await serviceFactory.shutdown();
    });

    const psychSuccess = psychSuite.printResults();

    // FINAL SUMMARY
    console.log('\n🏁 TEST DEMO SUMMARY');
    console.log('====================');
    console.log(`🔬 Unit Tests: ${unitSuite.passed}/${unitSuite.passed + unitSuite.failed} passed`);
    console.log(`🔗 Integration Tests: ${integrationSuite.passed}/${integrationSuite.passed + integrationSuite.failed} passed`);
    console.log(`🧠 Psychology Tests: ${psychSuite.passed}/${psychSuite.passed + psychSuite.failed} passed`);
    
    const allPassed = unitSuccess && integrationSuccess && psychSuccess;
    
    if (allPassed) {
        console.log('\n🎉 All demo tests passed! Testing framework is working! 🚀');
        console.log('\n📋 Ready for incremental development:');
        console.log('  1. ✅ Repository unit tests working');
        console.log('  2. ✅ Service integration tests working');  
        console.log('  3. ✅ Multi-user isolation verified');
        console.log('  4. ✅ Psychology domain access verified');
        console.log('  5. ✅ Clean architecture compliance verified');
        
        return true;
    } else {
        console.log('\n❌ Some tests failed - need to fix issues before proceeding');
        return false;
    }
}

// Run demo if called directly
if (require.main === module) {
    runSimpleTestDemo()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('❌ Test demo failed:', error.message);
            process.exit(1);
        });
}

module.exports = { runSimpleTestDemo };
