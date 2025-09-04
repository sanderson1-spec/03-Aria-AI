#!/usr/bin/env node

/**
 * Integration Tests for Database Service + Repositories
 * 
 * INTEGRATION TESTING STRATEGY:
 * - Test real service interactions (not mocked)
 * - Use isolated test database
 * - Verify complete workflows work end-to-end
 * - Test multi-user data isolation
 * - Verify repository registration and DAL access
 * - Test cross-repository operations
 */

const { setupServices } = require('../../setupServices');
const { TestDatabaseHelper } = require('../test-framework');
const path = require('path');

class IntegrationTest {
    constructor(name) {
        this.name = name;
        this.tests = [];
        this.passed = 0;
        this.failed = 0;
        this.serviceFactory = null;
        this.dbHelper = new TestDatabaseHelper();
    }

    test(description, testFunction) {
        this.tests.push({ description, testFunction });
    }

    async setup() {
        // Create isolated test database
        await this.dbHelper.createTestDatabase();
        
        // Initialize services with test database
        this.serviceFactory = await setupServices({
            dbPath: this.dbHelper.getTestDbPath(),
            includeMetadata: false // Reduce noise in tests
        });
    }

    async teardown() {
        if (this.serviceFactory) {
            await this.serviceFactory.shutdown();
        }
        await this.dbHelper.cleanupTestDatabase();
    }

    async run() {
        console.log(`\n🔗 ${this.name}`);
        console.log('='.repeat(this.name.length + 4));
        
        try {
            await this.setup();
            
            for (const { description, testFunction } of this.tests) {
                try {
                    await testFunction.call(this);
                    console.log(`  ✅ ${description}`);
                    this.passed++;
                } catch (error) {
                    console.log(`  ❌ ${description}`);
                    console.log(`     Error: ${error.message}`);
                    this.failed++;
                }
            }
            
            await this.teardown();
            
        } catch (setupError) {
            console.log(`  ❌ Test setup failed: ${setupError.message}`);
            this.failed++;
        }
        
        const total = this.passed + this.failed;
        console.log(`\n📊 Integration Results: ${this.passed}/${total} passed`);
        
        return this.failed === 0;
    }

    // Helper to get database service
    getDatabaseService() {
        return this.serviceFactory.services.get('database');
    }

    // Helper to get DAL
    getDAL() {
        return this.getDatabaseService().getDAL();
    }
}

async function runDatabaseServiceIntegrationTests() {
    const suite = new IntegrationTest('Database Service + Repositories Integration Tests');

    // INTEGRATION TEST: Service initialization and repository registration
    suite.test('should initialize all repositories successfully', async function() {
        const databaseService = this.getDatabaseService();
        
        if (!databaseService.initialized) {
            throw new Error('Database service should be initialized');
        }
        
        if (databaseService.repositories.size !== 11) {
            throw new Error(`Expected 11 repositories, got ${databaseService.repositories.size}`);
        }
        
        // Verify specific repositories exist
        const expectedRepos = ['users', 'userSessions', 'chats', 'conversations', 'personalities', 
                              'sessions', 'psychology', 'proactive', 'configuration', 'analytics', 'schema'];
        
        for (const repoName of expectedRepos) {
            if (!databaseService.repositories.has(repoName)) {
                throw new Error(`Repository '${repoName}' not registered`);
            }
        }
    });

    // INTEGRATION TEST: DAL provides access to all repositories
    suite.test('should provide DAL access to all repositories', async function() {
        const dal = this.getDAL();
        
        // Test direct repository access
        const expectedDALProps = ['users', 'userSessions', 'chats', 'conversations', 'personalities',
                                 'sessions', 'psychology', 'proactive', 'configuration', 'analytics', 'schema'];
        
        for (const prop of expectedDALProps) {
            if (!dal[prop]) {
                throw new Error(`DAL missing property: ${prop}`);
            }
            
            if (typeof dal[prop].count !== 'function') {
                throw new Error(`DAL.${prop} should have count() method`);
            }
        }
    });

    // INTEGRATION TEST: Multi-user data isolation
    suite.test('should enforce multi-user data isolation', async function() {
        const dal = this.getDAL();
        
        // Create two test users
        const user1Data = {
            username: 'user1',
            email: 'user1@test.com',
            display_name: 'User One'
        };
        
        const user2Data = {
            username: 'user2', 
            email: 'user2@test.com',
            display_name: 'User Two'
        };
        
        const user1 = await dal.users.createUser(user1Data);
        const user2 = await dal.users.createUser(user2Data);
        
        // Create chats for each user
        const chat1 = await dal.chats.createChat(user1.id, {
            title: 'User 1 Chat',
            personality_id: 'default'
        });
        
        const chat2 = await dal.chats.createChat(user2.id, {
            title: 'User 2 Chat', 
            personality_id: 'default'
        });
        
        // Verify data isolation - User 1 should only see their chat
        const user1Chats = await dal.chats.getUserChats(user1.id);
        const user2Chats = await dal.chats.getUserChats(user2.id);
        
        if (user1Chats.chats.length !== 1) {
            throw new Error('User 1 should only see their own chat');
        }
        
        if (user2Chats.chats.length !== 1) {
            throw new Error('User 2 should only see their own chat');
        }
        
        if (user1Chats.chats[0].title !== 'User 1 Chat') {
            throw new Error('User 1 should see correct chat title');
        }
        
        if (user2Chats.chats[0].title !== 'User 2 Chat') {
            throw new Error('User 2 should see correct chat title');
        }
    });

    // INTEGRATION TEST: Cross-repository operations
    suite.test('should support cross-repository operations', async function() {
        const dal = this.getDAL();
        
        // Create user
        const userData = {
            username: 'crosstest',
            email: 'cross@test.com',
            display_name: 'Cross Test User'
        };
        
        const user = await dal.users.createUser(userData);
        
        // Create chat for user
        const chat = await dal.chats.createChat(user.id, {
            title: 'Cross Repository Test',
            personality_id: 'default'
        });
        
        // Create conversation message
        const message = await dal.conversations.saveMessage(user.id, chat.id, {
            sender: 'user',
            message: 'Hello, this is a test message',
            analysis_data: { sentiment: 'positive' }
        });
        
        // Verify cross-repository data consistency
        const userChats = await dal.chats.getUserChats(user.id);
        const chatHistory = await dal.conversations.getUserChatHistory(user.id, chat.id);
        
        if (userChats.chats.length !== 1) {
            throw new Error('Cross-repository: User should have one chat');
        }
        
        if (chatHistory.length !== 1) {
            throw new Error('Cross-repository: Chat should have one message');
        }
        
        if (chatHistory[0].message !== 'Hello, this is a test message') {
            throw new Error('Cross-repository: Message content should match');
        }
    });

    // INTEGRATION TEST: Psychology domain table access
    suite.test('should access psychology domain tables through psychology repository', async function() {
        const dal = this.getDAL();
        
        // Test psychology domain methods exist
        if (typeof dal.psychology.getCharacterPsychologicalFrameworks !== 'function') {
            throw new Error('Psychology repository missing getCharacterPsychologicalFrameworks method');
        }
        
        if (typeof dal.psychology.getCharacterPsychologicalState !== 'function') {
            throw new Error('Psychology repository missing getCharacterPsychologicalState method');
        }
        
        if (typeof dal.psychology.getPsychologyEvolutionLog !== 'function') {
            throw new Error('Psychology repository missing getPsychologyEvolutionLog method');
        }
        
        // Test methods can be called without errors (even with no data)
        const frameworks = await dal.psychology.getCharacterPsychologicalFrameworks('test-user', 'test-char');
        const state = await dal.psychology.getCharacterPsychologicalState('test-user', 'test-char');
        const evolution = await dal.psychology.getPsychologyEvolutionLog('test-user', 'test-char');
        
        if (!Array.isArray(frameworks)) {
            throw new Error('getCharacterPsychologicalFrameworks should return array');
        }
        
        if (!Array.isArray(evolution)) {
            throw new Error('getPsychologyEvolutionLog should return array');
        }
        
        // state can be null if no data exists, that's fine
    });

    // INTEGRATION TEST: Proactive domain table access
    suite.test('should access proactive domain tables through proactive repository', async function() {
        const dal = this.getDAL();
        
        // Test proactive domain methods exist
        if (typeof dal.proactive.getEngagementHistory !== 'function') {
            throw new Error('Proactive repository missing getEngagementHistory method');
        }
        
        if (typeof dal.proactive.getLearningPatterns !== 'function') {
            throw new Error('Proactive repository missing getLearningPatterns method');
        }
        
        if (typeof dal.proactive.getTimingOptimizations !== 'function') {
            throw new Error('Proactive repository missing getTimingOptimizations method');
        }
        
        // Test methods can be called without errors
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
    });

    // INTEGRATION TEST: Configuration and analytics integration
    suite.test('should handle configuration and analytics through dedicated repositories', async function() {
        const dal = this.getDAL();
        
        // Test configuration operations
        await dal.configuration.setConfigValue('test_key', 'test_value', 'string', 'Test configuration');
        const configValue = await dal.configuration.getConfigValue('test_key');
        
        if (configValue !== 'test_value') {
            throw new Error('Configuration repository should store and retrieve values');
        }
        
        // Test analytics operations
        const eventId = await dal.analytics.recordEvent({
            user_id: 'test-user',
            event_type: 'test_event',
            event_data: { action: 'integration_test' }
        });
        
        if (!eventId || typeof eventId !== 'string') {
            throw new Error('Analytics repository should return event ID');
        }
        
        const events = await dal.analytics.getEventsByType('test_event', 'test-user');
        
        if (!Array.isArray(events) || events.length === 0) {
            throw new Error('Analytics repository should retrieve recorded events');
        }
    });

    // INTEGRATION TEST: Repository health and connectivity
    suite.test('should maintain healthy repository connections', async function() {
        const databaseService = this.getDatabaseService();
        
        const health = await databaseService.checkHealth();
        
        if (!health.healthy) {
            throw new Error('Database service should be healthy');
        }
        
        if (health.details.repositoriesInitialized !== 11) {
            throw new Error(`Expected 11 repositories initialized, got ${health.details.repositoriesInitialized}`);
        }
        
        if (!health.details.connected) {
            throw new Error('Database should be connected');
        }
    });

    return await suite.run();
}

// Run tests if called directly
if (require.main === module) {
    runDatabaseServiceIntegrationTests()
        .then(success => {
            console.log(success ? '\n🎉 Integration tests passed!' : '\n❌ Integration tests failed!');
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('❌ Integration test execution failed:', error.message);
            process.exit(1);
        });
}

module.exports = { runDatabaseServiceIntegrationTests };
