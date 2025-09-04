#!/usr/bin/env node

/**
 * End-to-End Tests for Complete User Chat Workflow
 * 
 * E2E TESTING STRATEGY:
 * - Test complete user journeys from start to finish
 * - Use real services and database (isolated test environment)
 * - Verify multi-user data isolation in realistic scenarios
 * - Test psychology and proactive intelligence integration
 * - Validate error handling in complete workflows
 */

const { setupServices } = require('../../setupServices');
const { TestDatabaseHelper } = require('../test-framework');
const path = require('path');

class E2ETest {
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
        // Create isolated test database with full schema
        await this.dbHelper.createTestDatabase();
        
        // Initialize complete service architecture
        this.serviceFactory = await setupServices({
            dbPath: this.dbHelper.getTestDbPath(),
            includeMetadata: false
        });
    }

    async teardown() {
        if (this.serviceFactory) {
            await this.serviceFactory.shutdown();
        }
        await this.dbHelper.cleanupTestDatabase();
    }

    async run() {
        console.log(`\n🌐 ${this.name}`);
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
            console.log(`  ❌ E2E setup failed: ${setupError.message}`);
            this.failed++;
        }
        
        const total = this.passed + this.failed;
        console.log(`\n📊 E2E Results: ${this.passed}/${total} passed`);
        
        return this.failed === 0;
    }

    // Helper methods
    getServices() {
        return this.serviceFactory.services;
    }

    getDAL() {
        return this.getServices().get('database').getDAL();
    }

    getPsychologyService() {
        return this.getServices().get('psychology');
    }

    getProactiveService() {
        return this.getServices().get('proactiveIntelligence');
    }
}

async function runUserChatWorkflowTests() {
    const suite = new E2ETest('Complete User Chat Workflow E2E Tests');

    // E2E TEST: Complete user registration and first chat
    suite.test('should handle complete user registration and first chat creation', async function() {
        const dal = this.getDAL();
        
        // Step 1: Create user
        const userData = {
            username: 'e2e_user',
            email: 'e2e@test.com',
            display_name: 'E2E Test User',
            preferences: { theme: 'dark', notifications: true }
        };
        
        const user = await dal.users.createUser(userData);
        
        if (!user || !user.id) {
            throw new Error('User creation failed');
        }
        
        // Step 2: Create user session
        const sessionData = {
            user_id: user.id,
            device_info: { platform: 'web', browser: 'test' },
            ip_address: '127.0.0.1'
        };
        
        const session = await dal.userSessions.createSession(sessionData);
        
        if (!session || session.user_id !== user.id) {
            throw new Error('Session creation failed');
        }
        
        // Step 3: Create first chat
        const chatData = {
            title: 'My First Chat',
            personality_id: 'default'
        };
        
        const chat = await dal.chats.createChat(user.id, chatData);
        
        if (!chat || chat.user_id !== user.id) {
            throw new Error('Chat creation failed');
        }
        
        // Step 4: Send first message
        const messageData = {
            sender: 'user',
            message: 'Hello, this is my first message!',
            analysis_data: { sentiment: 'positive', intent: 'greeting' }
        };
        
        const message = await dal.conversations.saveMessage(user.id, chat.id, messageData);
        
        if (!message || message.user_id !== user.id || message.chat_id !== chat.id) {
            throw new Error('Message creation failed');
        }
        
        // Step 5: Verify complete workflow data integrity
        const userChats = await dal.chats.getUserChats(user.id);
        const chatHistory = await dal.conversations.getUserChatHistory(user.id, chat.id);
        
        if (userChats.chats.length !== 1) {
            throw new Error('User should have exactly one chat');
        }
        
        if (chatHistory.length !== 1) {
            throw new Error('Chat should have exactly one message');
        }
        
        if (chatHistory[0].message !== 'Hello, this is my first message!') {
            throw new Error('Message content should be preserved');
        }
    });

    // E2E TEST: Multi-user data isolation in realistic scenario
    suite.test('should maintain strict data isolation between users', async function() {
        const dal = this.getDAL();
        
        // Create two users with similar data
        const user1 = await dal.users.createUser({
            username: 'alice',
            email: 'alice@test.com',
            display_name: 'Alice'
        });
        
        const user2 = await dal.users.createUser({
            username: 'bob', 
            email: 'bob@test.com',
            display_name: 'Bob'
        });
        
        // Both users create chats with same title
        const chat1 = await dal.chats.createChat(user1.id, {
            title: 'Shared Chat Title',
            personality_id: 'default'
        });
        
        const chat2 = await dal.chats.createChat(user2.id, {
            title: 'Shared Chat Title',
            personality_id: 'default'  
        });
        
        // Both users send similar messages
        await dal.conversations.saveMessage(user1.id, chat1.id, {
            sender: 'user',
            message: 'This is a test message'
        });
        
        await dal.conversations.saveMessage(user2.id, chat2.id, {
            sender: 'user', 
            message: 'This is a test message'
        });
        
        // Verify complete isolation
        const alice_chats = await dal.chats.getUserChats(user1.id);
        const bob_chats = await dal.chats.getUserChats(user2.id);
        
        const alice_messages = await dal.conversations.getUserChatHistory(user1.id, chat1.id);
        const bob_messages = await dal.conversations.getUserChatHistory(user2.id, chat2.id);
        
        // Alice should only see her data
        if (alice_chats.chats.length !== 1) {
            throw new Error('Alice should only see her own chat');
        }
        
        if (alice_chats.chats[0].id !== chat1.id) {
            throw new Error('Alice should see her correct chat ID');
        }
        
        if (alice_messages.length !== 1) {
            throw new Error('Alice should only see her own messages');
        }
        
        // Bob should only see his data  
        if (bob_chats.chats.length !== 1) {
            throw new Error('Bob should only see his own chat');
        }
        
        if (bob_chats.chats[0].id !== chat2.id) {
            throw new Error('Bob should see his correct chat ID');
        }
        
        if (bob_messages.length !== 1) {
            throw new Error('Bob should only see his own messages');
        }
        
        // Cross-user access should return empty results
        const alice_trying_bob_chat = await dal.conversations.getUserChatHistory(user1.id, chat2.id);
        const bob_trying_alice_chat = await dal.conversations.getUserChatHistory(user2.id, chat1.id);
        
        if (alice_trying_bob_chat.length > 0) {
            throw new Error('Alice should not access Bob\'s chat messages');
        }
        
        if (bob_trying_alice_chat.length > 0) {
            throw new Error('Bob should not access Alice\'s chat messages');
        }
    });

    // E2E TEST: Psychology integration workflow
    suite.test('should integrate psychology features in complete workflow', async function() {
        const dal = this.getDAL();
        const psychologyService = this.getPsychologyService();
        
        // Create user and chat
        const user = await dal.users.createUser({
            username: 'psych_user',
            email: 'psych@test.com',
            display_name: 'Psychology Test User'
        });
        
        const chat = await dal.chats.createChat(user.id, {
            title: 'Psychology Test Chat',
            personality_id: 'empathetic'
        });
        
        // Test psychology framework access
        const frameworks = await dal.psychology.getCharacterPsychologicalFrameworks(user.id, 'empathetic');
        
        if (!Array.isArray(frameworks)) {
            throw new Error('Psychology frameworks should return array');
        }
        
        // Test psychology state access
        const state = await dal.psychology.getCharacterPsychologicalState(user.id, 'empathetic');
        // State can be null if not set yet, that's fine
        
        // Test psychology evolution log
        const evolution = await dal.psychology.getPsychologyEvolutionLog(user.id, 'empathetic');
        
        if (!Array.isArray(evolution)) {
            throw new Error('Psychology evolution log should return array');
        }
        
        // Test memory weights through conversations
        const memoryWeights = await dal.conversations.getCharacterMemoryWeights(user.id, 'empathetic');
        
        if (!Array.isArray(memoryWeights)) {
            throw new Error('Character memory weights should return array');
        }
    });

    // E2E TEST: Proactive intelligence workflow
    suite.test('should integrate proactive intelligence features', async function() {
        const dal = this.getDAL();
        
        // Create user
        const user = await dal.users.createUser({
            username: 'proactive_user',
            email: 'proactive@test.com', 
            display_name: 'Proactive Test User'
        });
        
        // Test proactive domain table access
        const engagementHistory = await dal.proactive.getEngagementHistory(user.id);
        const learningPatterns = await dal.proactive.getLearningPatterns(user.id);
        const timingOptimizations = await dal.proactive.getTimingOptimizations(user.id);
        
        if (!Array.isArray(engagementHistory)) {
            throw new Error('Engagement history should return array');
        }
        
        if (!Array.isArray(learningPatterns)) {
            throw new Error('Learning patterns should return array');
        }
        
        if (!Array.isArray(timingOptimizations)) {
            throw new Error('Timing optimizations should return array');
        }
    });

    // E2E TEST: Analytics and configuration workflow
    suite.test('should handle analytics and configuration in complete workflow', async function() {
        const dal = this.getDAL();
        
        // Test configuration management
        await dal.configuration.setConfigValue('e2e_test_key', 'e2e_test_value', 'string', 'E2E test configuration');
        const configValue = await dal.configuration.getConfigValue('e2e_test_key');
        
        if (configValue !== 'e2e_test_value') {
            throw new Error('Configuration should persist values correctly');
        }
        
        // Test analytics event recording
        const eventId = await dal.analytics.recordEvent({
            user_id: 'test-user',
            event_type: 'e2e_test',
            event_data: { test: 'workflow', step: 1 }
        });
        
        if (!eventId) {
            throw new Error('Analytics should record events and return ID');
        }
        
        // Test analytics retrieval
        const events = await dal.analytics.getEventsByType('e2e_test', 'test-user');
        
        if (!Array.isArray(events) || events.length === 0) {
            throw new Error('Analytics should retrieve recorded events');
        }
    });

    // E2E TEST: Service health during workflow
    suite.test('should maintain service health during complete workflow', async function() {
        const services = this.getServices();
        
        // Check all services are healthy at start
        const initialHealth = await this.serviceFactory.checkAllServicesHealth();
        
        if (initialHealth.size === 0) {
            throw new Error('No services found in health check');
        }
        
        // Perform workflow operations
        const dal = this.getDAL();
        
        const user = await dal.users.createUser({
            username: 'health_test',
            email: 'health@test.com',
            display_name: 'Health Test User'
        });
        
        const chat = await dal.chats.createChat(user.id, {
            title: 'Health Test Chat',
            personality_id: 'default'
        });
        
        await dal.conversations.saveMessage(user.id, chat.id, {
            sender: 'user',
            message: 'Testing service health during operations'
        });
        
        // Check services are still healthy after operations
        const finalHealth = await this.serviceFactory.checkAllServicesHealth();
        
        const unhealthyServices = Array.from(finalHealth.entries())
            .filter(([name, health]) => !health.healthy);
        
        if (unhealthyServices.length > 0) {
            throw new Error(`Services became unhealthy during workflow: ${unhealthyServices.map(([name]) => name).join(', ')}`);
        }
    });

    // E2E TEST: Error recovery workflow
    suite.test('should handle errors gracefully in complete workflow', async function() {
        const dal = this.getDAL();
        
        // Test 1: Try to create chat for non-existent user (should fail)
        try {
            await dal.chats.createChat('non-existent-user', {
                title: 'Should Fail',
                personality_id: 'default'
            });
            throw new Error('Should have failed to create chat for non-existent user');
        } catch (error) {
            // This should fail, which is correct behavior
            if (!error.message.includes('Failed to create chat')) {
                throw new Error('Should provide meaningful error message');
            }
        }
        
        // Test 2: Try to access another user's data (should return empty)
        const user1 = await dal.users.createUser({
            username: 'user1_error_test',
            email: 'user1@error.test',
            display_name: 'User 1'
        });
        
        const user2 = await dal.users.createUser({
            username: 'user2_error_test', 
            email: 'user2@error.test',
            display_name: 'User 2'
        });
        
        const user1_chat = await dal.chats.createChat(user1.id, {
            title: 'User 1 Private Chat',
            personality_id: 'default'
        });
        
        // User 2 tries to access User 1's chat (should return null/empty)
        const unauthorized_access = await dal.chats.getUserChat(user2.id, user1_chat.id);
        
        if (unauthorized_access !== null) {
            throw new Error('Users should not access other users\' chats');
        }
    });

    return await suite.run();
}

// Run tests if called directly
if (require.main === module) {
    runUserChatWorkflowTests()
        .then(success => {
            console.log(success ? '\n🎉 E2E tests passed!' : '\n❌ E2E tests failed!');
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('❌ E2E test execution failed:', error.message);
            process.exit(1);
        });
}

module.exports = { runUserChatWorkflowTests };
