/**
 * User Chat Isolation Integration Test
 * 
 * Tests that chats are properly isolated per user and that users only see their own chats
 */

const path = require('path');
const { setupServices } = require('../../setupServices');
const { v4: uuidv4 } = require('uuid');

describe('User Chat Isolation Integration Tests', () => {
    let serviceFactory;
    let authService;
    let database;
    let dal;

    // Test users
    let user1Data;
    let user2Data;
    let user1Session;
    let user2Session;

    beforeAll(async () => {
        const dbPath = path.join(__dirname, '../../database/test-user-chat-isolation.db');
        serviceFactory = await setupServices({
            databasePath: dbPath,
            logToFile: false
        });

        authService = serviceFactory.get('auth');
        database = serviceFactory.get('database');
        dal = database.getDAL();
    });

    afterAll(async () => {
        if (serviceFactory) {
            await serviceFactory.shutdown();
        }
    });

    describe('Multi-user chat isolation', () => {
        test('Create two separate users', async () => {
            // Register user 1
            const result1 = await authService.register(
                `test-user-${uuidv4().substring(0, 8)}`,
                'password123',
                'Test User One',
                null
            );
            expect(result1.success).toBe(true);
            expect(result1.user).toBeDefined();
            user1Data = result1.user;

            // Register user 2
            const result2 = await authService.register(
                `test-user-${uuidv4().substring(0, 8)}`,
                'password123',
                'Test User Two',
                null
            );
            expect(result2.success).toBe(true);
            expect(result2.user).toBeDefined();
            user2Data = result2.user;

            // Verify users are different
            expect(user1Data.id).not.toBe(user2Data.id);
        });

        test('Login both users and get session tokens', async () => {
            // Login user 1
            const login1 = await authService.login(user1Data.username, 'password123', {}, '127.0.0.1');
            expect(login1.success).toBe(true);
            user1Session = login1.sessionToken;

            // Login user 2
            const login2 = await authService.login(user2Data.username, 'password123', {}, '127.0.0.1');
            expect(login2.success).toBe(true);
            user2Session = login2.sessionToken;

            expect(user1Session).toBeDefined();
            expect(user2Session).toBeDefined();
            expect(user1Session).not.toBe(user2Session);
        });

        test('Create chats for user 1', async () => {
            // Get or create a test personality
            const allPersonalities = await dal.personalities.findAll();
            let testPersonality = allPersonalities.find(p => p.name === 'Test Character');
            
            if (!testPersonality) {
                testPersonality = await dal.personalities.create({
                    id: uuidv4(),
                    name: 'Test Character',
                    display: 'test.png',
                    description: 'A test character',
                    definition: 'Test character definition',
                    is_active: 1
                });
            }

            // Create two chats for user 1
            const chat1 = await dal.chats.createChat(user1Data.id, {
                id: `chat1-${uuidv4()}`,
                title: 'User 1 Chat 1',
                personality_id: testPersonality.id,
                metadata: {}
            });

            const chat2 = await dal.chats.createChat(user1Data.id, {
                id: `chat2-${uuidv4()}`,
                title: 'User 1 Chat 2',
                personality_id: testPersonality.id,
                metadata: {}
            });

            expect(chat1).toBeDefined();
            expect(chat1.user_id).toBe(user1Data.id);
            expect(chat2).toBeDefined();
            expect(chat2.user_id).toBe(user1Data.id);
        });

        test('Create chats for user 2', async () => {
            // Get test personality
            const allPersonalities = await dal.personalities.findAll();
            const testPersonality = allPersonalities.find(p => p.name === 'Test Character');

            // Create two chats for user 2
            const chat1 = await dal.chats.createChat(user2Data.id, {
                id: `chat1-${uuidv4()}`,
                title: 'User 2 Chat 1',
                personality_id: testPersonality.id,
                metadata: {}
            });

            const chat2 = await dal.chats.createChat(user2Data.id, {
                id: `chat2-${uuidv4()}`,
                title: 'User 2 Chat 2',
                personality_id: testPersonality.id,
                metadata: {}
            });

            expect(chat1).toBeDefined();
            expect(chat1.user_id).toBe(user2Data.id);
            expect(chat2).toBeDefined();
            expect(chat2.user_id).toBe(user2Data.id);
        });

        test('User 1 should only see their own chats', async () => {
            const result = await dal.chats.getUserChats(user1Data.id, 1, 50);
            
            expect(result).toBeDefined();
            expect(Array.isArray(result.chats)).toBe(true);
            expect(result.chats.length).toBe(2);
            
            // All chats should belong to user 1
            result.chats.forEach(chat => {
                expect(chat.user_id).toBe(user1Data.id);
                expect(chat.title).toContain('User 1');
            });
        });

        test('User 2 should only see their own chats', async () => {
            const result = await dal.chats.getUserChats(user2Data.id, 1, 50);
            
            expect(result).toBeDefined();
            expect(Array.isArray(result.chats)).toBe(true);
            expect(result.chats.length).toBe(2);
            
            // All chats should belong to user 2
            result.chats.forEach(chat => {
                expect(chat.user_id).toBe(user2Data.id);
                expect(chat.title).toContain('User 2');
            });
        });

        test('Recent chats endpoint respects user isolation', async () => {
            const user1Chats = await dal.chats.getRecentUserChats(user1Data.id, 10);
            const user2Chats = await dal.chats.getRecentUserChats(user2Data.id, 10);

            // User 1 chats
            expect(Array.isArray(user1Chats)).toBe(true);
            expect(user1Chats.length).toBe(2);
            user1Chats.forEach(chat => {
                expect(chat.user_id).toBe(user1Data.id);
            });

            // User 2 chats
            expect(Array.isArray(user2Chats)).toBe(true);
            expect(user2Chats.length).toBe(2);
            user2Chats.forEach(chat => {
                expect(chat.user_id).toBe(user2Data.id);
            });

            // Verify no overlap
            const user1ChatIds = user1Chats.map(c => c.id);
            const user2ChatIds = user2Chats.map(c => c.id);
            user1ChatIds.forEach(id => {
                expect(user2ChatIds).not.toContain(id);
            });
        });

        test('User cannot access another user\'s chat', async () => {
            // Get a chat from user 2
            const user2Chats = await dal.chats.getUserChats(user2Data.id, 1, 1);
            expect(user2Chats.chats.length).toBeGreaterThan(0);
            const user2ChatId = user2Chats.chats[0].id;

            // Try to access it with user 1's ID
            const result = await dal.chats.getUserChat(user1Data.id, user2ChatId);
            
            // Should return null/undefined as user 1 doesn't have access
            expect(result).toBeUndefined();
        });

        test('Delete chat only affects the owner', async () => {
            // Get chats for both users
            const user1ChatsBefore = await dal.chats.getUserChats(user1Data.id, 1, 50);
            const user2ChatsBefore = await dal.chats.getUserChats(user2Data.id, 1, 50);

            expect(user1ChatsBefore.chats.length).toBe(2);
            expect(user2ChatsBefore.chats.length).toBe(2);

            // Delete one of user 1's chats
            const chatToDelete = user1ChatsBefore.chats[0].id;
            await dal.chats.deactivateChat(user1Data.id, chatToDelete);

            // Check user 1 now has 1 chat
            const user1ChatsAfter = await dal.chats.getUserChats(user1Data.id, 1, 50);
            expect(user1ChatsAfter.chats.length).toBe(1);
            expect(user1ChatsAfter.chats.find(c => c.id === chatToDelete)).toBeUndefined();

            // Check user 2 still has 2 chats
            const user2ChatsAfter = await dal.chats.getUserChats(user2Data.id, 1, 50);
            expect(user2ChatsAfter.chats.length).toBe(2);
        });
    });
});
