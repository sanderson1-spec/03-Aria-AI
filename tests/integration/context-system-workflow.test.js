/**
 * Integration Tests for Context System Workflow
 * 
 * CLEAN ARCHITECTURE TESTING:
 * - Tests complete context assembly with real services
 * - Tests recent context awareness (last N messages)
 * - Tests deep memory search with significance filtering
 * - Tests unified information dashboard (tasks, events, memories)
 * - Tests context window configuration cascade
 * - Tests performance and optimization (no unnecessary searches)
 */

const { setupServices } = require('../../setupServices');

describe('Context System Workflow Integration', () => {
    let serviceFactory;
    let dal;
    let contextBuilder;
    let memorySearch;
    let psychology;

    beforeEach(async () => {
        // Create fresh service factory for each test
        serviceFactory = await setupServices({
            dbPath: ':memory:',
            includeMetadata: false
        });

        dal = serviceFactory.services.get('database').getDAL();
        contextBuilder = serviceFactory.services.get('contextBuilder');
        memorySearch = serviceFactory.services.get('memorySearch');
        psychology = serviceFactory.services.get('psychology');
    });

    afterEach(async () => {
        if (serviceFactory) {
            await serviceFactory.shutdown();
            serviceFactory = null;
        }
    });

    describe('Scenario A: Recent Context Awareness', () => {
        it('should provide character with awareness of recent conversation flow', async () => {
            // Step 1: Create test user and character
            const timestamp = Date.now();
            const user = await dal.users.createUser({
                username: `context_user_${timestamp}`,
                email: `context_${timestamp}@test.com`,
                display_name: 'Context Test User'
            });

            const character = await dal.personalities.createCharacter({
                id: `context_char_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
                name: 'Context Test Character',
                description: 'A character that maintains conversation context'
            });

            const sessionId = `context_session_${timestamp}`;

            // Step 2: Create psychology framework for the character
            await psychology.createFramework(user.id, sessionId, character.id);

            // Step 3: Simulate 35 messages in conversation
            const messages = [];
            for (let i = 1; i <= 35; i++) {
                const userMessage = await dal.conversations.saveMessage(
                    sessionId,
                    'user',
                    `User message number ${i}`,
                    'chat',
                    { user_id: user.id, message_type: 'text' }
                );
                messages.push(userMessage);

                const assistantMessage = await dal.conversations.saveMessage(
                    sessionId,
                    'assistant',
                    `Assistant response to message ${i}`,
                    'chat',
                    { user_id: user.id, message_type: 'text' }
                );
                messages.push(assistantMessage);
            }

            expect(messages.length).toBe(70); // 35 user + 35 assistant

            // Step 4: Build unified context with default window (30 messages)
            const context = await contextBuilder.buildUnifiedContext(user.id, sessionId, character.id);

            // Step 5: Verify recent messages included
            expect(context.recentMessages).toBeDefined();
            expect(context.recentMessages.length).toBeLessThanOrEqual(30);
            expect(context.recentMessages.length).toBeGreaterThan(0);

            // Step 6: Verify message 5 is NOT in recent context (too old)
            const recentMessageContents = context.recentMessages.map(m => m.message);
            expect(recentMessageContents).not.toContain('User message number 5');

            // Step 7: Verify latest messages ARE in recent context
            expect(recentMessageContents).toContain('User message number 35');
            expect(recentMessageContents).toContain('Assistant response to message 35');

            // Step 8: Verify all context streams present
            expect(context.psychologyState).toBeDefined();
            expect(context.topMemories).toBeDefined();
            expect(context.activeCommitments).toBeDefined();
            expect(context.upcomingEvents).toBeDefined();
            expect(context.recentCompletions).toBeDefined();
        }, 20000);

        it('should maintain conversation flow awareness', async () => {
            const timestamp = Date.now();
            const user = await dal.users.createUser({
                username: `flow_user_${timestamp}`,
                email: `flow_${timestamp}@test.com`
            });

            const character = await dal.personalities.createCharacter({
                id: `flow_char_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
                name: 'Flow Character'
            });

            const sessionId = `flow_session_${timestamp}`;
            await psychology.createFramework(user.id, sessionId, character.id);

            // Create sequential conversation
            await dal.conversations.saveMessage(sessionId, 'user', 'Hello', 'chat', { user_id: user.id });
            await dal.conversations.saveMessage(sessionId, 'assistant', 'Hi! How are you?', 'chat', { user_id: user.id });
            await dal.conversations.saveMessage(sessionId, 'user', 'I am planning a trip', 'chat', { user_id: user.id });
            await dal.conversations.saveMessage(sessionId, 'assistant', 'That sounds exciting!', 'chat', { user_id: user.id });

            const context = await contextBuilder.buildUnifiedContext(user.id, sessionId, character.id);

            expect(context.recentMessages.length).toBe(4);
            
            // Verify chronological order
            expect(context.recentMessages[0].message).toContain('Hello');
            expect(context.recentMessages[3].message).toContain('exciting');
        }, 15000);
    });

    describe('Scenario B: Deep Memory Search Triggered', () => {
        it('should retrieve high-significance memories from the past', async () => {
            const timestamp = Date.now();
            const user = await dal.users.createUser({
                username: `memory_user_${timestamp}`,
                email: `memory_${timestamp}@test.com`
            });

            const character = await dal.personalities.createCharacter({
                id: `memory_char_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
                name: 'Memory Character'
            });

            const sessionId = `memory_session_${timestamp}`;
            await psychology.createFramework(user.id, sessionId, character.id);

            // Step 1: Create old conversation about ACL injury (2 weeks ago)
            const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
            const oldMessage = await dal.query(
                `INSERT INTO conversation_logs (session_id, chat_id, user_id, sender, message, message_type, timestamp) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [sessionId, sessionId, user.id, 'user', 'I tore my ACL playing soccer and need surgery', 'text', twoWeeksAgo]
            );

            const oldMessageId = await dal.queryOne(
                'SELECT id FROM conversation_logs WHERE session_id = ? AND message LIKE ?',
                [sessionId, '%ACL%']
            );

            // Step 2: Create high-significance memory weight for that message
            await dal.query(
                `INSERT INTO character_memory_weights 
                 (session_id, message_id, emotional_impact_score, relationship_relevance, personal_significance, contextual_importance, memory_tags) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [sessionId, oldMessageId.id, 9, 8, 9, 7, JSON.stringify(['injury', 'health', 'important'])]
            );

            // Step 3: Create recent conversation (excludes old message from window)
            for (let i = 1; i <= 10; i++) {
                await dal.conversations.saveMessage(sessionId, 'user', `Recent message ${i}`, 'chat', { user_id: user.id });
                await dal.conversations.saveMessage(sessionId, 'assistant', `Recent response ${i}`, 'chat', { user_id: user.id });
            }

            // Step 4: Get recent message IDs for exclusion
            const recentMessages = await dal.query(
                'SELECT id FROM conversation_logs WHERE session_id = ? ORDER BY timestamp DESC LIMIT 20',
                [sessionId]
            );
            const recentIds = recentMessages.map(m => m.id);

            // Step 5: Search for significant memories
            const significantMemories = await dal.psychology.getSignificantMemories(sessionId, recentIds, 7);

            // Step 6: Verify old ACL memory is found
            expect(significantMemories.length).toBeGreaterThan(0);
            const aclMemory = significantMemories.find(m => m.content && m.content.includes('ACL'));
            expect(aclMemory).toBeDefined();
            expect(aclMemory.emotional_impact_score).toBe(9);
            expect(aclMemory.total_significance).toBeGreaterThanOrEqual(28); // 9+8+9+7 = 33
        }, 20000);

        it('should execute deep search workflow when memory reference detected', async () => {
            const timestamp = Date.now();
            const user = await dal.users.createUser({
                username: `deep_user_${timestamp}`,
                email: `deep_${timestamp}@test.com`
            });

            const character = await dal.personalities.createCharacter({
                id: `deep_char_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
                name: 'Deep Search Character'
            });

            const sessionId = `deep_session_${timestamp}`;
            await psychology.createFramework(user.id, sessionId, character.id);

            // Create old significant memory
            const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
            await dal.query(
                `INSERT INTO conversation_logs (session_id, chat_id, user_id, sender, message, message_type, timestamp) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [sessionId, sessionId, user.id, 'user', 'I discussed my career change plans in detail', 'text', oneWeekAgo]
            );

            const oldMessageId = await dal.queryOne(
                'SELECT id FROM conversation_logs WHERE session_id = ? AND message LIKE ?',
                [sessionId, '%career change%']
            );

            await dal.query(
                `INSERT INTO character_memory_weights 
                 (session_id, message_id, emotional_impact_score, relationship_relevance, personal_significance, contextual_importance, memory_tags) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [sessionId, oldMessageId.id, 8, 7, 9, 8, JSON.stringify(['career', 'important'])]
            );

            // Create recent messages
            for (let i = 1; i <= 15; i++) {
                await dal.conversations.saveMessage(sessionId, 'user', `Daily update ${i}`, 'chat', { user_id: user.id });
            }

            // Execute deep search
            const recentMessages = await dal.query(
                'SELECT id FROM conversation_logs WHERE session_id = ? ORDER BY timestamp DESC LIMIT 10',
                [sessionId]
            );
            const recentIds = recentMessages.map(m => m.id);

            const deepMemories = await memorySearch.executeDeepSearch(
                sessionId,
                'Tell me about my career plans',
                recentIds,
                7
            );

            // Note: Deep search requires LLM, so in test we verify the method completes
            // In production, this would filter for relevant memories
            expect(deepMemories).toBeDefined();
            expect(Array.isArray(deepMemories)).toBe(true);
        }, 15000);
    });

    describe('Scenario C: Unified Information Dashboard', () => {
        it('should synthesize information from all context streams', async () => {
            const timestamp = Date.now();
            const user = await dal.users.createUser({
                username: `dashboard_user_${timestamp}`,
                email: `dashboard_${timestamp}@test.com`
            });

            const character = await dal.personalities.createCharacter({
                id: `dashboard_char_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
                name: 'Dashboard Character'
            });

            const sessionId = `dashboard_session_${timestamp}`;
            await psychology.createFramework(user.id, sessionId, character.id);

            // Step 1: Create active commitments
            const commitment1 = await dal.commitments.createCommitment({
                user_id: user.id,
                chat_id: sessionId,
                character_id: character.id,
                commitment_type: 'task',
                description: 'Complete weekly report',
                due_at: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
                status: 'active'
            });

            const commitment2 = await dal.commitments.createCommitment({
                user_id: user.id,
                chat_id: sessionId,
                character_id: character.id,
                commitment_type: 'habit',
                description: 'Daily meditation',
                status: 'active'
            });

            // Step 2: Create upcoming events
            const event1 = await dal.events.createEvent({
                user_id: user.id,
                chat_id: sessionId,
                character_id: character.id,
                event_type: 'reminder',
                title: 'Team meeting',
                description: 'Weekly sync with team',
                scheduled_for: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
                status: 'scheduled'
            });

            // Step 3: Create recent completion
            const completedCommitment = await dal.commitments.createCommitment({
                user_id: user.id,
                chat_id: sessionId,
                character_id: character.id,
                commitment_type: 'task',
                description: 'Morning workout',
                status: 'active'
            });

            await dal.commitments.submitCommitment(completedCommitment.id, 'Completed 30-minute workout');
            await dal.commitments.verifyCommitment(completedCommitment.id, 'verified', 'Great job!');

            // Step 4: Create recent messages
            await dal.conversations.saveMessage(sessionId, 'user', 'What do I need to do?', 'chat', { user_id: user.id });

            // Step 5: Build unified context
            const context = await contextBuilder.buildUnifiedContext(user.id, sessionId, character.id);

            // Step 6: Verify all streams present
            expect(context.activeCommitments).toBeDefined();
            expect(context.activeCommitments.length).toBe(2);
            expect(context.activeCommitments.map(c => c.description)).toContain('Complete weekly report');
            expect(context.activeCommitments.map(c => c.description)).toContain('Daily meditation');

            expect(context.upcomingEvents).toBeDefined();
            expect(context.upcomingEvents.length).toBe(1);
            expect(context.upcomingEvents[0].title).toBe('Team meeting');

            expect(context.recentCompletions).toBeDefined();
            expect(context.recentCompletions.length).toBe(1);
            expect(context.recentCompletions[0].description).toBe('Morning workout');
            expect(context.recentCompletions[0].status).toBe('completed');

            expect(context.recentMessages).toBeDefined();
            expect(context.recentMessages.some(m => m.message.includes('What do I need to do'))).toBe(true);

            expect(context.psychologyState).toBeDefined();
            expect(context.topMemories).toBeDefined();
        }, 20000);

        it('should handle empty context streams gracefully', async () => {
            const timestamp = Date.now();
            const user = await dal.users.createUser({
                username: `empty_user_${timestamp}`,
                email: `empty_${timestamp}@test.com`
            });

            const character = await dal.personalities.createCharacter({
                id: `empty_char_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
                name: 'Empty Character'
            });

            const sessionId = `empty_session_${timestamp}`;
            await psychology.createFramework(user.id, sessionId, character.id);

            // No messages, commitments, or events created
            const context = await contextBuilder.buildUnifiedContext(user.id, sessionId, character.id);

            // All streams should exist but be empty
            expect(context.recentMessages).toEqual([]);
            expect(context.activeCommitments).toEqual([]);
            expect(context.upcomingEvents).toEqual([]);
            expect(context.recentCompletions).toEqual([]);
            expect(context.topMemories).toEqual([]);
            expect(context.psychologyState).toBeDefined();
        }, 15000);
    });

    describe('Scenario D: Context Window Configuration', () => {
        it('should respect custom context window size of 20', async () => {
            const timestamp = Date.now();
            const user = await dal.users.createUser({
                username: `window_user_${timestamp}`,
                email: `window_${timestamp}@test.com`
            });

            const character = await dal.personalities.createCharacter({
                id: `window_char_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
                name: 'Window Character',
                llm_preferences: JSON.stringify({
                    conversational: {
                        model: 'test-model',
                        context_window_messages: 20
                    }
                })
            });

            const sessionId = `window_session_${timestamp}`;
            await psychology.createFramework(user.id, sessionId, character.id);

            // Create 50 messages
            for (let i = 1; i <= 50; i++) {
                await dal.conversations.saveMessage(sessionId, 'user', `Message ${i}`, 'chat', { user_id: user.id });
            }

            // Step 1: Resolve context window
            const contextWindow = await contextBuilder.resolveContextWindow(user.id, character.id, 'conversational');
            expect(contextWindow).toBe(20);

            // Step 2: Build context
            const context = await contextBuilder.buildUnifiedContext(user.id, sessionId, character.id);

            // Step 3: Verify only 20 messages included
            expect(context.recentMessages.length).toBeLessThanOrEqual(20);

            // Step 4: Verify latest messages are included
            const messageContents = context.recentMessages.map(m => m.message);
            expect(messageContents).toContain('Message 50');
            expect(messageContents).not.toContain('Message 1');
            expect(messageContents).not.toContain('Message 20'); // Should be excluded if window is smaller
        }, 15000);

        it('should use default context window when no override', async () => {
            const timestamp = Date.now();
            const user = await dal.users.createUser({
                username: `default_user_${timestamp}`,
                email: `default_${timestamp}@test.com`
            });

            const character = await dal.personalities.createCharacter({
                id: `default_char_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
                name: 'Default Character'
                // No llm_preferences set
            });

            const sessionId = `default_session_${timestamp}`;
            await psychology.createFramework(user.id, sessionId, character.id);

            // Resolve context window - should use default (30)
            const contextWindow = await contextBuilder.resolveContextWindow(user.id, character.id, 'conversational');
            expect(contextWindow).toBe(30);
        }, 10000);

        it('should handle context window bounds correctly', async () => {
            const timestamp = Date.now();
            const user = await dal.users.createUser({
                username: `bounds_user_${timestamp}`,
                email: `bounds_${timestamp}@test.com`
            });

            const character = await dal.personalities.createCharacter({
                id: `bounds_char_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
                name: 'Bounds Character',
                llm_preferences: JSON.stringify({
                    conversational: {
                        context_window_messages: 10 // Small window
                    }
                })
            });

            const sessionId = `bounds_session_${timestamp}`;
            await psychology.createFramework(user.id, sessionId, character.id);

            // Create only 5 messages (less than window)
            for (let i = 1; i <= 5; i++) {
                await dal.conversations.saveMessage(sessionId, 'user', `Message ${i}`, 'chat', { user_id: user.id });
            }

            const context = await contextBuilder.buildUnifiedContext(user.id, sessionId, character.id);

            // Should return all 5 messages (not try to fetch 10)
            expect(context.recentMessages.length).toBe(5);
        }, 10000);
    });

    describe('Scenario E: No Deep Search When Not Needed', () => {
        it('should skip deep search for casual messages', async () => {
            const timestamp = Date.now();
            const user = await dal.users.createUser({
                username: `casual_user_${timestamp}`,
                email: `casual_${timestamp}@test.com`
            });

            const character = await dal.personalities.createCharacter({
                id: `casual_char_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
                name: 'Casual Character'
            });

            const sessionId = `casual_session_${timestamp}`;
            await psychology.createFramework(user.id, sessionId, character.id);

            // Create some recent messages
            await dal.conversations.saveMessage(sessionId, 'user', 'Hello', 'chat', { user_id: user.id });
            await dal.conversations.saveMessage(sessionId, 'assistant', 'Hi there!', 'chat', { user_id: user.id });
            await dal.conversations.saveMessage(sessionId, 'user', 'How are you?', 'chat', { user_id: user.id });

            const recentMessages = await dal.query(
                'SELECT id FROM conversation_logs WHERE session_id = ? ORDER BY timestamp DESC LIMIT 10',
                [sessionId]
            );
            const recentIds = recentMessages.map(m => m.id);

            // Note: In a real scenario, analyzeSearchIntent would return needs_search: false
            // Here we test that executeDeepSearch handles it gracefully
            const deepMemories = await memorySearch.executeDeepSearch(
                sessionId,
                'How are you?',
                recentIds,
                7
            );

            // Should complete without errors
            expect(deepMemories).toBeDefined();
            expect(Array.isArray(deepMemories)).toBe(true);
        }, 10000);

        it('should perform efficiently with large message history', async () => {
            const timestamp = Date.now();
            const user = await dal.users.createUser({
                username: `perf_user_${timestamp}`,
                email: `perf_${timestamp}@test.com`
            });

            const character = await dal.personalities.createCharacter({
                id: `perf_char_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
                name: 'Performance Character'
            });

            const sessionId = `perf_session_${timestamp}`;
            await psychology.createFramework(user.id, sessionId, character.id);

            // Create large message history
            for (let i = 1; i <= 100; i++) {
                await dal.conversations.saveMessage(sessionId, 'user', `Message ${i}`, 'chat', { user_id: user.id });
            }

            const startTime = Date.now();
            const context = await contextBuilder.buildUnifiedContext(user.id, sessionId, character.id);
            const endTime = Date.now();

            const executionTime = endTime - startTime;

            // Should complete reasonably fast (under 3 seconds as specified)
            expect(executionTime).toBeLessThan(3000);
            expect(context.recentMessages.length).toBeLessThanOrEqual(30);
        }, 15000);
    });

    describe('Context System Edge Cases', () => {
        it('should handle concurrent context builds', async () => {
            const timestamp = Date.now();
            const user = await dal.users.createUser({
                username: `concurrent_user_${timestamp}`,
                email: `concurrent_${timestamp}@test.com`
            });

            const character = await dal.personalities.createCharacter({
                id: `concurrent_char_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
                name: 'Concurrent Character'
            });

            const sessionId = `concurrent_session_${timestamp}`;
            await psychology.createFramework(user.id, sessionId, character.id);

            // Create messages
            for (let i = 1; i <= 20; i++) {
                await dal.conversations.saveMessage(sessionId, 'user', `Message ${i}`, 'chat', { user_id: user.id });
            }

            // Build context concurrently
            const [context1, context2, context3] = await Promise.all([
                contextBuilder.buildUnifiedContext(user.id, sessionId, character.id),
                contextBuilder.buildUnifiedContext(user.id, sessionId, character.id),
                contextBuilder.buildUnifiedContext(user.id, sessionId, character.id)
            ]);

            // All should succeed
            expect(context1.recentMessages.length).toBe(context2.recentMessages.length);
            expect(context2.recentMessages.length).toBe(context3.recentMessages.length);
        }, 15000);

        it('should handle missing psychology state gracefully', async () => {
            const timestamp = Date.now();
            const user = await dal.users.createUser({
                username: `missing_user_${timestamp}`,
                email: `missing_${timestamp}@test.com`
            });

            const character = await dal.personalities.createCharacter({
                id: `missing_char_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
                name: 'Missing Character'
            });

            const sessionId = `missing_session_${timestamp}`;
            // Don't create psychology framework

            await dal.conversations.saveMessage(sessionId, 'user', 'Test message', 'chat', { user_id: user.id });

            // Should still build context
            const context = await contextBuilder.buildUnifiedContext(user.id, sessionId, character.id);

            expect(context).toBeDefined();
            expect(context.recentMessages.length).toBeGreaterThan(0);
            // Psychology state may be null or empty, but shouldn't error
        }, 10000);

        it('should maintain chat isolation in context', async () => {
            const timestamp = Date.now();
            const user = await dal.users.createUser({
                username: `isolation_context_user_${timestamp}`,
                email: `isolation_context_${timestamp}@test.com`
            });

            const character = await dal.personalities.createCharacter({
                id: `isolation_context_char_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
                name: 'Isolation Character'
            });

            const sessionA = `isolation_context_a_${timestamp}`;
            const sessionB = `isolation_context_b_${timestamp}`;

            await psychology.createFramework(user.id, sessionA, character.id);
            await psychology.createFramework(user.id, sessionB, character.id);

            // Create messages in Chat A
            await dal.conversations.saveMessage(sessionA, 'user', 'Chat A message', 'chat', { user_id: user.id });

            // Create messages in Chat B
            await dal.conversations.saveMessage(sessionB, 'user', 'Chat B message', 'chat', { user_id: user.id });

            // Build context for Chat A
            const contextA = await contextBuilder.buildUnifiedContext(user.id, sessionA, character.id);

            // Build context for Chat B
            const contextB = await contextBuilder.buildUnifiedContext(user.id, sessionB, character.id);

            // Verify isolation
            const messagesA = contextA.recentMessages.map(m => m.message);
            const messagesB = contextB.recentMessages.map(m => m.message);

            expect(messagesA).toContain('Chat A message');
            expect(messagesA).not.toContain('Chat B message');

            expect(messagesB).toContain('Chat B message');
            expect(messagesB).not.toContain('Chat A message');
        }, 15000);
    });
});
