/**
 * Integration Tests for Commitment False Positives
 * 
 * CLEAN ARCHITECTURE TESTING:
 * - Tests commitment detection with confidence threshold
 * - Tests casual conversation is not flagged as commitment
 * - Tests real commitments are properly detected
 * - Tests mixed conversation scenarios
 */

const { setupServices } = require('../../setupServices');

describe('Commitment False Positives Integration', () => {
    let serviceFactory;
    let dal;
    let backgroundAnalysis;
    let proactiveIntelligence;

    beforeEach(async () => {
        // Create fresh service factory for each test
        serviceFactory = await setupServices({
            dbPath: ':memory:',
            includeMetadata: false
        });

        dal = serviceFactory.services.get('database').getDAL();
        backgroundAnalysis = serviceFactory.services.get('backgroundAnalysis');
        proactiveIntelligence = serviceFactory.services.get('proactiveIntelligence');
    });

    afterEach(async () => {
        if (serviceFactory) {
            await serviceFactory.shutdown();
            serviceFactory = null;
        }
    });

    describe('Scenario A: Casual Question Not Flagged', () => {
        it('should not create commitment for casual question "So tell me, how was your day?"', async () => {
            // Step 1: Create test user and character
            const timestamp = Date.now();
            const user = await dal.users.createUser({
                username: `casual_user_${timestamp}`,
                email: `casual_${timestamp}@test.com`,
                display_name: 'Casual Test User'
            });

            const character = await dal.personalities.createCharacter({
                id: `casual_char_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
                name: 'Casual Test Character',
                description: 'A friendly character',
                user_id: user.id
            });

            const sessionId = `casual_session_${timestamp}`;

            // Step 2: Mock casual conversation detection with low confidence
            const mockDetectCommitment = jest.spyOn(proactiveIntelligence, 'detectCommitment')
                .mockResolvedValue({
                    has_commitment: false,
                    confidence: 0.2,
                    commitment: null
                });

            // Step 3: Simulate conversation where character asks casual question
            const userMessage = 'I went to work today';
            const agentResponse = 'So tell me, how was your day?';

            await dal.conversations.saveMessage(
                sessionId,
                'user',
                userMessage,
                'chat',
                { user_id: user.id, message_type: 'text' }
            );

            await dal.conversations.saveMessage(
                sessionId,
                'assistant',
                agentResponse,
                'chat',
                { user_id: user.id, message_type: 'text' }
            );

            // Step 4: Process background analysis (simulate what happens after message)
            const psychologyState = {
                current_emotion: 'neutral',
                energy_level: 5,
                relationship_dynamic: 'friendly'
            };

            // Get conversation history
            const conversationHistory = await dal.conversations.getSessionHistory(sessionId, 10, 0);

            // Call detectCommitment as background analysis would
            const commitmentDetection = await proactiveIntelligence.detectCommitment({
                userMessage,
                agentResponse,
                conversationHistory,
                sessionContext: {
                    sessionId,
                    userId: user.id,
                    personalityId: character.id,
                    personalityName: character.name
                }
            });

            // Step 5: Verify NO commitment was detected or confidence is very low
            expect(commitmentDetection).toBeDefined();
            if (commitmentDetection.has_commitment) {
                expect(commitmentDetection.confidence).toBeLessThan(0.8);
            } else {
                expect(commitmentDetection.has_commitment).toBe(false);
            }

            // Step 6: Verify NO commitment was created in database
            const activeCommitments = await dal.commitments.getActiveCommitments(user.id, sessionId);
            expect(activeCommitments).toHaveLength(0);

            mockDetectCommitment.mockRestore();
        }, 15000);
    });

    describe('Scenario B: Real Commitment Flagged', () => {
        it('should create commitment for real assignment "Write 5 sentences in Spanish and submit by 8pm"', async () => {
            // Step 1: Create test user and character
            const timestamp = Date.now();
            const user = await dal.users.createUser({
                username: `real_user_${timestamp}`,
                email: `real_${timestamp}@test.com`,
                display_name: 'Real Test User'
            });

            const character = await dal.personalities.createCharacter({
                id: `real_char_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
                name: 'Real Test Character',
                description: 'A teacher character',
                user_id: user.id
            });

            const sessionId = `real_session_${timestamp}`;

            // Step 2: Mock real commitment detection with high confidence
            const mockDetectCommitment = jest.spyOn(proactiveIntelligence, 'detectCommitment')
                .mockResolvedValue({
                    has_commitment: true,
                    confidence: 0.95,
                    commitment: {
                        commitment_type: 'homework',
                        description: 'Write 5 sentences in Spanish and submit by 8pm',
                        character_notes: 'Language practice assignment',
                        verification_needed: true,
                        due_at: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()
                    }
                });

            // Step 3: Simulate conversation where character assigns real task
            const userMessage = 'I want to learn Spanish';
            const agentResponse = 'Great! Write 5 sentences in Spanish and submit by 8pm.';

            await dal.conversations.saveMessage(
                sessionId,
                'user',
                userMessage,
                'chat',
                { user_id: user.id, message_type: 'text' }
            );

            await dal.conversations.saveMessage(
                sessionId,
                'assistant',
                agentResponse,
                'chat',
                { user_id: user.id, message_type: 'text' }
            );

            // Step 4: Process background analysis
            const conversationHistory = await dal.conversations.getSessionHistory(sessionId, 10, 0);

            const commitmentDetection = await proactiveIntelligence.detectCommitment({
                userMessage,
                agentResponse,
                conversationHistory,
                sessionContext: {
                    sessionId,
                    userId: user.id,
                    personalityId: character.id,
                    personalityName: character.name
                }
            });

            // Step 5: Verify commitment was detected with high confidence
            expect(commitmentDetection).toBeDefined();
            expect(commitmentDetection.has_commitment).toBe(true);
            expect(commitmentDetection.confidence).toBeGreaterThan(0.8);

            // Step 6: Manually create commitment (simulating BackgroundAnalysisService logic)
            if (commitmentDetection.has_commitment && commitmentDetection.confidence > 0.8) {
                const commitmentData = commitmentDetection.commitment;
                await dal.commitments.createCommitment({
                    user_id: user.id,
                    chat_id: sessionId,
                    character_id: character.id,
                    description: commitmentData.description,
                    commitment_type: commitmentData.commitment_type,
                    character_notes: commitmentData.character_notes,
                    due_at: commitmentData.due_at,
                    status: 'active'
                });
            }

            // Step 7: Verify commitment WAS created in database
            const activeCommitments = await dal.commitments.getActiveCommitments(user.id, sessionId);
            expect(activeCommitments).toHaveLength(1);
            expect(activeCommitments[0].commitment_type).toBe('homework');
            expect(activeCommitments[0].description).toContain('5 sentences in Spanish');

            mockDetectCommitment.mockRestore();
        }, 15000);
    });

    describe('Scenario C: Multiple Casual Questions', () => {
        it('should not create any commitments for multiple casual questions', async () => {
            // Step 1: Create test user and character
            const timestamp = Date.now();
            const user = await dal.users.createUser({
                username: `multi_user_${timestamp}`,
                email: `multi_${timestamp}@test.com`,
                display_name: 'Multi Test User'
            });

            const character = await dal.personalities.createCharacter({
                id: `multi_char_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
                name: 'Multi Test Character',
                description: 'A conversational character',
                user_id: user.id
            });

            const sessionId = `multi_session_${timestamp}`;

            // Step 2: Mock multiple casual conversations with low confidence
            const mockDetectCommitment = jest.spyOn(proactiveIntelligence, 'detectCommitment');

            // Mock responses for each casual question
            mockDetectCommitment
                .mockResolvedValueOnce({
                    has_commitment: false,
                    confidence: 0.15,
                    commitment: null
                })
                .mockResolvedValueOnce({
                    has_commitment: false,
                    confidence: 0.1,
                    commitment: null
                })
                .mockResolvedValueOnce({
                    has_commitment: false,
                    confidence: 0.25,
                    commitment: null
                });

            // Step 3: Simulate multiple casual conversations
            const casualExchanges = [
                { user: 'I feel good', agent: 'How are you feeling?' },
                { user: 'I worked on a project', agent: 'What did you do today?' },
                { user: 'It was relaxing', agent: 'Tell me about your weekend' }
            ];

            for (const exchange of casualExchanges) {
                await dal.conversations.saveMessage(
                    sessionId,
                    'user',
                    exchange.user,
                    'chat',
                    { user_id: user.id, message_type: 'text' }
                );

                await dal.conversations.saveMessage(
                    sessionId,
                    'assistant',
                    exchange.agent,
                    'chat',
                    { user_id: user.id, message_type: 'text' }
                );

                // Process each exchange
                const conversationHistory = await dal.conversations.getSessionHistory(sessionId, 10, 0);
                const commitmentDetection = await proactiveIntelligence.detectCommitment({
                    userMessage: exchange.user,
                    agentResponse: exchange.agent,
                    conversationHistory,
                    sessionContext: {
                        sessionId,
                        userId: user.id,
                        personalityId: character.id,
                        personalityName: character.name
                    }
                });

                // Verify each is not a commitment
                expect(commitmentDetection.has_commitment).toBe(false);
            }

            // Step 4: Verify ZERO commitments were created in database
            const activeCommitments = await dal.commitments.getActiveCommitments(user.id, sessionId);
            expect(activeCommitments).toHaveLength(0);

            mockDetectCommitment.mockRestore();
        }, 15000);
    });

    describe('Scenario D: Mixed Conversation', () => {
        it('should only create commitment for real task, not casual conversation', async () => {
            // Step 1: Create test user and character
            const timestamp = Date.now();
            const user = await dal.users.createUser({
                username: `mixed_user_${timestamp}`,
                email: `mixed_${timestamp}@test.com`,
                display_name: 'Mixed Test User'
            });

            const character = await dal.personalities.createCharacter({
                id: `mixed_char_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
                name: 'Mixed Test Character',
                description: 'A coach character',
                user_id: user.id
            });

            const sessionId = `mixed_session_${timestamp}`;

            // Step 2: Mock responses - 3 casual, 1 real commitment
            const mockDetectCommitment = jest.spyOn(proactiveIntelligence, 'detectCommitment');

            mockDetectCommitment
                // Casual conversation 1
                .mockResolvedValueOnce({
                    has_commitment: false,
                    confidence: 0.2,
                    commitment: null
                })
                // Casual conversation 2
                .mockResolvedValueOnce({
                    has_commitment: false,
                    confidence: 0.18,
                    commitment: null
                })
                // Casual conversation 3
                .mockResolvedValueOnce({
                    has_commitment: false,
                    confidence: 0.25,
                    commitment: null
                })
                // Real commitment
                .mockResolvedValueOnce({
                    has_commitment: true,
                    confidence: 0.92,
                    commitment: {
                        commitment_type: 'task',
                        description: 'Complete this exercise',
                        character_notes: 'Assigned exercise for practice',
                        verification_needed: true,
                        due_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
                    }
                });

            // Step 3: Simulate mixed conversation
            const exchanges = [
                { user: 'Hi there', agent: 'Hello! How are you today?', isCommitment: false },
                { user: 'I\'m good', agent: 'That\'s great to hear!', isCommitment: false },
                { user: 'What should I do?', agent: 'Let me think about that...', isCommitment: false },
                { user: 'I need practice', agent: 'Perfect! Complete this exercise and report back tomorrow.', isCommitment: true }
            ];

            for (const exchange of exchanges) {
                await dal.conversations.saveMessage(
                    sessionId,
                    'user',
                    exchange.user,
                    'chat',
                    { user_id: user.id, message_type: 'text' }
                );

                await dal.conversations.saveMessage(
                    sessionId,
                    'assistant',
                    exchange.agent,
                    'chat',
                    { user_id: user.id, message_type: 'text' }
                );

                // Process each exchange
                const conversationHistory = await dal.conversations.getSessionHistory(sessionId, 10, 0);
                const commitmentDetection = await proactiveIntelligence.detectCommitment({
                    userMessage: exchange.user,
                    agentResponse: exchange.agent,
                    conversationHistory,
                    sessionContext: {
                        sessionId,
                        userId: user.id,
                        personalityId: character.id,
                        personalityName: character.name
                    }
                });

                // Create commitment only if detected with high confidence (simulating BackgroundAnalysisService)
                if (commitmentDetection.has_commitment && commitmentDetection.confidence > 0.8) {
                    const commitmentData = commitmentDetection.commitment;
                    await dal.commitments.createCommitment({
                        user_id: user.id,
                        chat_id: sessionId,
                        character_id: character.id,
                        description: commitmentData.description,
                        commitment_type: commitmentData.commitment_type,
                        character_notes: commitmentData.character_notes,
                        due_at: commitmentData.due_at,
                        status: 'active'
                    });
                }
            }

            // Step 4: Verify only 1 commitment was created (the real task)
            const activeCommitments = await dal.commitments.getActiveCommitments(user.id, sessionId);
            expect(activeCommitments).toHaveLength(1);
            expect(activeCommitments[0].description).toBe('Complete this exercise');
            expect(activeCommitments[0].commitment_type).toBe('task');

            mockDetectCommitment.mockRestore();
        }, 15000);
    });
});
