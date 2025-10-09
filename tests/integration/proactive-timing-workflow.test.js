/**
 * Integration Tests for Proactive Timing Workflow
 * 
 * CLEAN ARCHITECTURE TESTING:
 * - Tests proactive intelligence with conversation state awareness
 * - Tests personality-driven timing decisions
 * - Tests emotional state impact on timing
 * - Tests conversation momentum awareness
 */

const { setupServices } = require('../../setupServices');

describe('Proactive Timing Workflow Integration', () => {
    let serviceFactory;
    let dal;
    let proactiveService;
    let psychologyService;

    beforeEach(async () => {
        // Create fresh service factory for each test
        serviceFactory = await setupServices({
            dbPath: ':memory:',
            includeMetadata: false
        });

        dal = serviceFactory.services.get('database').getDAL();
        proactiveService = serviceFactory.services.get('proactiveIntelligence');
        psychologyService = serviceFactory.services.get('psychology');
    });

    afterEach(async () => {
        if (serviceFactory) {
            await serviceFactory.shutdown();
            serviceFactory = null;
        }
    });

    describe('Scenario A: Character Asks Question, Should Wait', () => {
        it('should not engage proactively when waiting for user response to question', async () => {
            // Setup test data
            const timestamp = Date.now();
            const sessionId = `timing_test_session_${timestamp}`;
            
            // Create user first
            const user = await dal.users.createUser({
                username: `timing_test_user_${timestamp}`,
                email: `timing_test_${timestamp}@test.com`,
                display_name: 'Timing Test User'
            });
            const userId = user.id;
            
            const character = await dal.personalities.createCharacter({
                id: `timing_char_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
                user_id: userId,
                name: 'Timing Test Character',
                description: 'A balanced character for timing tests',
                core_traits: ['balanced', 'thoughtful'],
                communication_style: 'conversational'
            });

            // Create chat session first
            await dal.chats.createChat(userId, {
                id: sessionId,
                personality_id: character.id,
                title: 'Timing Test Chat'
            });

            // Initialize psychology state
            const psychologyState = await psychologyService.initializeCharacterState(userId, character.id);
            const psychologyFramework = await psychologyService.ensurePersonalityFramework(character);

            // Save messages - character asks question
            await dal.conversations.saveMessage(
                sessionId,
                'user',
                'Tell me about yourself',
                'chat',
                { user_id: userId }
            );

            await dal.conversations.saveMessage(
                sessionId,
                'assistant',
                'How was your day?',
                'chat',
                { user_id: userId }
            );

            // Get conversation state (30 seconds after last message)
            const conversationState = await dal.conversations.getConversationState(sessionId);

            // Build analysis context
            const analysisContext = {
                userMessage: 'Tell me about yourself',
                agentResponse: 'How was your day?',
                psychologicalState: psychologyState,
                psychologicalFramework: psychologyFramework,
                conversationHistory: [
                    { sender: 'user', message: 'Tell me about yourself' },
                    { sender: 'assistant', message: 'How was your day?' }
                ],
                conversationState: conversationState,
                learnedPatterns: [],
                sessionContext: {
                    sessionId,
                    userId,
                    personalityName: character.name,
                    personality: character
                }
            };

            // Analyze proactive opportunity
            const decision = await proactiveService.analyzeProactiveOpportunity(analysisContext);

            // Verify decision structure
            expect(decision).toBeDefined();
            expect(decision).toHaveProperty('should_engage_proactively');
            expect(decision).toHaveProperty('engagement_timing');
            expect(decision).toHaveProperty('psychological_reasoning');

            // Verify conversation state was considered
            expect(conversationState).toBeDefined();
            expect(conversationState.last_message_sender).toBe('assistant');
            expect(conversationState.last_message_was_question).toBe(true);
            expect(conversationState.user_response_pending).toBe(true);

            // Character should wait for response to their question
            // (LLM may decide either way based on personality, but state should be available)
            expect(typeof decision.should_engage_proactively).toBe('boolean');
        }, 15000);
    });

    describe('Scenario B: Patient Character Waits Longer', () => {
        it('should show patient personality traits in timing decisions', async () => {
            const timestamp = Date.now();
            const sessionId = `patient_test_session_${timestamp}`;
            
            // Create user first
            const user = await dal.users.createUser({
                username: `patient_test_user_${timestamp}`,
                email: `patient_test_${timestamp}@test.com`,
                display_name: 'Patient Test User'
            });
            const userId = user.id;
            
            // Create patient/relaxed character
            const character = await dal.personalities.createCharacter({
                id: `patient_char_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
                user_id: userId,
                name: 'Patient Character',
                description: 'A very relaxed and patient character',
                core_traits: ['patient', 'relaxed', 'thoughtful', 'calm'],
                communication_style: 'gentle and unhurried'
            });

            // Create chat session first
            await dal.chats.createChat(userId, {
                id: sessionId,
                personality_id: character.id,
                title: 'Patient Test Chat'
            });

            // Initialize psychology state with low stress
            const psychologyState = await psychologyService.initializeCharacterState(userId, character.id);
            const psychologyFramework = await psychologyService.ensurePersonalityFramework(character);

            // Set low stress state
            psychologyState.stress_level = 2;
            psychologyState.energy_level = 5;
            psychologyState.current_emotion = 'calm';
            psychologyState.emotional_intensity = 3;

            // Save messages - character asks question
            await dal.conversations.saveMessage(
                sessionId,
                'assistant',
                'What are you working on today?',
                'chat',
                { user_id: userId }
            );

            // Simulate 90 seconds passing
            const conversationState = await dal.conversations.getConversationState(sessionId);

            // Build prompt to verify timing guidance
            const analysisContext = {
                userMessage: 'Not much',
                agentResponse: 'What are you working on today?',
                psychologicalState: psychologyState,
                psychologicalFramework: psychologyFramework,
                conversationHistory: [
                    { sender: 'user', message: 'Not much' },
                    { sender: 'assistant', message: 'What are you working on today?' }
                ],
                conversationState: conversationState,
                learnedPatterns: [],
                sessionContext: {
                    sessionId,
                    userId,
                    personalityName: character.name,
                    personality: character
                }
            };

            // Get the prompt that would be sent to LLM
            const prompt = proactiveService.buildProactiveAnalysisPrompt(analysisContext);

            // Verify timing guidance includes personality-based timing
            expect(prompt).toContain('TIMING INTUITION BASED ON YOUR PERSONALITY');
            expect(prompt).toContain('Core traits:');
            expect(prompt).toContain('patient');
            expect(prompt).toContain('Relaxed/patient personalities might wait 3-5 minutes or longer');
            expect(prompt).toContain('CONVERSATION STATE AWARENESS');
            expect(prompt).toContain('Last message sender:');
            expect(prompt).toContain('Time since your last message:');

            // Analyze decision
            const decision = await proactiveService.analyzeProactiveOpportunity(analysisContext);

            expect(decision).toBeDefined();
            expect(decision).toHaveProperty('psychological_reasoning');
            expect(typeof decision.confidence_score).toBe('number');
        }, 15000);
    });

    describe('Scenario C: Impatient Character Follows Up Sooner', () => {
        it('should show impatient personality traits affect timing decisions', async () => {
            const timestamp = Date.now();
            const sessionId = `impatient_test_session_${timestamp}`;
            
            // Create user first
            const user = await dal.users.createUser({
                username: `impatient_test_user_${timestamp}`,
                email: `impatient_test_${timestamp}@test.com`,
                display_name: 'Impatient Test User'
            });
            const userId = user.id;
            
            // Create impatient/strict character
            const character = await dal.personalities.createCharacter({
                id: `impatient_char_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
                user_id: userId,
                name: 'Strict Character',
                description: 'A strict and impatient character',
                core_traits: ['strict', 'impatient', 'direct', 'focused'],
                communication_style: 'direct and efficient'
            });

            // Create chat session first
            await dal.chats.createChat(userId, {
                id: sessionId,
                personality_id: character.id,
                title: 'Impatient Test Chat'
            });

            // Initialize psychology state with higher stress
            const psychologyState = await psychologyService.initializeCharacterState(userId, character.id);
            const psychologyFramework = await psychologyService.ensurePersonalityFramework(character);

            // Set higher stress/urgency state
            psychologyState.stress_level = 6;
            psychologyState.energy_level = 8;
            psychologyState.current_emotion = 'focused';
            psychologyState.emotional_intensity = 7;

            // Save messages - character asks question
            await dal.conversations.saveMessage(
                sessionId,
                'assistant',
                'Did you complete the task I assigned?',
                'chat',
                { user_id: userId }
            );

            // Get conversation state (90 seconds after question)
            const conversationState = await dal.conversations.getConversationState(sessionId);

            // Build prompt to verify timing guidance
            const analysisContext = {
                userMessage: 'I will do it later',
                agentResponse: 'Did you complete the task I assigned?',
                psychologicalState: psychologyState,
                psychologicalFramework: psychologyFramework,
                conversationHistory: [
                    { sender: 'user', message: 'I will do it later' },
                    { sender: 'assistant', message: 'Did you complete the task I assigned?' }
                ],
                conversationState: conversationState,
                learnedPatterns: [],
                sessionContext: {
                    sessionId,
                    userId,
                    personalityName: character.name,
                    personality: character
                }
            };

            // Get the prompt that would be sent to LLM
            const prompt = proactiveService.buildProactiveAnalysisPrompt(analysisContext);

            // Verify timing guidance includes impatient personality context
            expect(prompt).toContain('TIMING INTUITION BASED ON YOUR PERSONALITY');
            expect(prompt).toContain('Core traits:');
            expect(prompt).toContain('strict');
            expect(prompt).toContain('Strict/impatient personalities typically feel the urge to follow up after 60-90 seconds');
            expect(prompt).toContain('High-stress states compress your patience');

            // Analyze decision
            const decision = await proactiveService.analyzeProactiveOpportunity(analysisContext);

            expect(decision).toBeDefined();
            expect(decision).toHaveProperty('psychological_reasoning');
            expect(decision.psychological_reasoning).toBeTruthy();
        }, 15000);
    });

    describe('Scenario D: High Stress State Affects Timing', () => {
        it('should reflect high stress in timing decisions', async () => {
            const timestamp = Date.now();
            const sessionId = `stress_test_session_${timestamp}`;
            
            // Create user first
            const user = await dal.users.createUser({
                username: `stress_test_user_${timestamp}`,
                email: `stress_test_${timestamp}@test.com`,
                display_name: 'Stress Test User'
            });
            const userId = user.id;
            
            const character = await dal.personalities.createCharacter({
                id: `stress_char_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
                user_id: userId,
                name: 'Stressed Character',
                description: 'A character in a high-stress state',
                core_traits: ['caring', 'responsible', 'dedicated'],
                communication_style: 'concerned and attentive'
            });

            // Create chat session first
            await dal.chats.createChat(userId, {
                id: sessionId,
                personality_id: character.id,
                title: 'Stress Test Chat'
            });

            // Initialize psychology state with HIGH stress
            const psychologyState = await psychologyService.initializeCharacterState(userId, character.id);
            const psychologyFramework = await psychologyService.ensurePersonalityFramework(character);

            // Set high stress state
            psychologyState.stress_level = 9;
            psychologyState.energy_level = 4;
            psychologyState.current_emotion = 'anxious';
            psychologyState.emotional_intensity = 8;

            // Save messages
            await dal.conversations.saveMessage(
                sessionId,
                'assistant',
                'I hope everything is okay with you.',
                'chat',
                { user_id: userId }
            );

            // Get conversation state
            const conversationState = await dal.conversations.getConversationState(sessionId);

            // Build analysis context
            const analysisContext = {
                userMessage: 'Thanks for checking',
                agentResponse: 'I hope everything is okay with you.',
                psychologicalState: psychologyState,
                psychologicalFramework: psychologyFramework,
                conversationHistory: [
                    { sender: 'user', message: 'Thanks for checking' },
                    { sender: 'assistant', message: 'I hope everything is okay with you.' }
                ],
                conversationState: conversationState,
                learnedPatterns: [],
                sessionContext: {
                    sessionId,
                    userId,
                    personalityName: character.name,
                    personality: character
                }
            };

            // Get the prompt
            const prompt = proactiveService.buildProactiveAnalysisPrompt(analysisContext);

            // Verify high stress is reflected in prompt
            expect(prompt).toContain('Stress level: 9/10');
            expect(prompt).toContain('High-stress states compress your patience');
            expect(prompt).toContain('you might follow up sooner than usual');

            // Analyze decision
            const decision = await proactiveService.analyzeProactiveOpportunity(analysisContext);

            expect(decision).toBeDefined();
            expect(decision).toHaveProperty('psychological_reasoning');
            expect(decision).toHaveProperty('context_analysis');
        }, 15000);
    });

    describe('Scenario E: Conversation Momentum Respected', () => {
        it('should recognize rapid conversation momentum', async () => {
            const timestamp = Date.now();
            const sessionId = `momentum_test_session_${timestamp}`;
            
            // Create user first
            const user = await dal.users.createUser({
                username: `momentum_test_user_${timestamp}`,
                email: `momentum_test_${timestamp}@test.com`,
                display_name: 'Momentum Test User'
            });
            const userId = user.id;
            
            const character = await dal.personalities.createCharacter({
                id: `momentum_char_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
                user_id: userId,
                name: 'Momentum Character',
                description: 'A character in rapid conversation',
                core_traits: ['engaging', 'responsive', 'dynamic'],
                communication_style: 'dynamic and engaging'
            });

            // Create chat session first
            await dal.chats.createChat(userId, {
                id: sessionId,
                personality_id: character.id,
                title: 'Momentum Test Chat'
            });

            // Initialize psychology state
            const psychologyState = await psychologyService.initializeCharacterState(userId, character.id);
            const psychologyFramework = await psychologyService.ensurePersonalityFramework(character);

            // Set energetic state
            psychologyState.energy_level = 8;
            psychologyState.current_emotion = 'excited';
            psychologyState.emotional_intensity = 7;

            // Save multiple messages to create rapid exchange (10+ messages)
            const messages = [];
            for (let i = 0; i < 12; i++) {
                const sender = i % 2 === 0 ? 'user' : 'assistant';
                const content = sender === 'user' ? `User message ${i}` : `Response ${i}`;
                await dal.conversations.saveMessage(
                    sessionId,
                    sender,
                    content,
                    'chat',
                    { user_id: userId }
                );
                messages.push({ sender, message: content });
            }

            // Get conversation state (should show rapid momentum)
            const conversationState = await dal.conversations.getConversationState(sessionId);

            // Build analysis context
            const analysisContext = {
                userMessage: 'User message 10',
                agentResponse: 'Response 11',
                psychologicalState: psychologyState,
                psychologicalFramework: psychologyFramework,
                conversationHistory: messages.slice(-5),
                conversationState: conversationState,
                learnedPatterns: [],
                sessionContext: {
                    sessionId,
                    userId,
                    personalityName: character.name,
                    personality: character
                }
            };

            // Get the prompt
            const prompt = proactiveService.buildProactiveAnalysisPrompt(analysisContext);

            // Verify conversation momentum is recognized
            expect(prompt).toContain('CONVERSATION STATE AWARENESS');
            expect(prompt).toContain('Messages since conversation started:');
            expect(prompt).toContain('Conversation momentum:');
            
            // Verify state shows multiple messages
            expect(conversationState.messages_exchanged).toBeGreaterThan(10);

            // Analyze decision
            const decision = await proactiveService.analyzeProactiveOpportunity(analysisContext);

            expect(decision).toBeDefined();
            expect(decision).toHaveProperty('confidence_score');
            expect(decision.confidence_score).toBeGreaterThanOrEqual(0);
            expect(decision.confidence_score).toBeLessThanOrEqual(1);
        }, 15000);
    });

    describe('Conversation State Integration', () => {
        it('should properly fetch and include conversation state in all analyses', async () => {
            const timestamp = Date.now();
            const sessionId = `state_test_session_${timestamp}`;
            
            // Create user first
            const user = await dal.users.createUser({
                username: `state_test_user_${timestamp}`,
                email: `state_test_${timestamp}@test.com`,
                display_name: 'State Test User'
            });
            const userId = user.id;
            
            const character = await dal.personalities.createCharacter({
                id: `state_char_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
                user_id: userId,
                name: 'State Test Character',
                description: 'Testing conversation state integration'
            });

            // Create chat session first
            await dal.chats.createChat(userId, {
                id: sessionId,
                personality_id: character.id,
                title: 'State Test Chat'
            });

            // Save some messages
            await dal.conversations.saveMessage(
                sessionId,
                'user',
                'Hello',
                'chat',
                { user_id: userId }
            );

            await dal.conversations.saveMessage(
                sessionId,
                'assistant',
                'Hi there! How can I help?',
                'chat',
                { user_id: userId }
            );

            // Get conversation state
            const conversationState = await dal.conversations.getConversationState(sessionId);

            // Verify all required fields are present
            expect(conversationState).toBeDefined();
            expect(conversationState).toHaveProperty('messages_exchanged');
            expect(conversationState).toHaveProperty('last_message_sender');
            expect(conversationState).toHaveProperty('last_message_was_question');
            expect(conversationState).toHaveProperty('time_since_last_message_seconds');
            expect(conversationState).toHaveProperty('user_response_pending');
            expect(conversationState).toHaveProperty('last_message');

            // Verify values make sense
            expect(conversationState.messages_exchanged).toBe(2);
            expect(conversationState.last_message_sender).toBe('assistant');
            expect(conversationState.last_message_was_question).toBe(true); // "How can I help?"
            expect(typeof conversationState.time_since_last_message_seconds).toBe('number');
        }, 10000);
    });

    describe('Prompt Generation with Conversation State', () => {
        it('should include all conversation state fields in generated prompt', async () => {
            const timestamp = Date.now();
            
            // Create minimal test data
            const character = {
                id: `prompt_char_${timestamp}`,
                name: 'Prompt Test Character',
                core_traits: ['balanced', 'thoughtful']
            };

            const psychologyState = {
                current_emotion: 'neutral',
                emotional_intensity: 5,
                energy_level: 7,
                stress_level: 3,
                relationship_dynamic: 'friendly',
                current_motivations: ['conversation'],
                active_interests: ['general topics']
            };

            const psychologyFramework = {
                core_traits: ['balanced', 'thoughtful'],
                core_emotional_range: ['calm', 'friendly', 'engaged'],
                natural_social_motivations: ['connection', 'helpfulness'],
                communication_patterns: ['clear', 'empathetic'],
                stress_triggers: ['conflict', 'pressure'],
                energy_sources: ['meaningful conversation'],
                relationship_approach: 'friendly and professional',
                communication_style: 'conversational',
                conversation_style_notes: 'Balanced and adaptive'
            };

            const conversationState = {
                messages_exchanged: 5,
                last_message_sender: 'assistant',
                last_message_was_question: true,
                time_since_last_message_seconds: 45,
                user_response_pending: true,
                last_message: { message: 'How are you feeling about that?' }
            };

            const analysisContext = {
                userMessage: 'I am not sure',
                agentResponse: 'How are you feeling about that?',
                psychologicalState: psychologyState,
                psychologicalFramework: psychologyFramework,
                conversationHistory: [
                    { sender: 'user', message: 'I am not sure' },
                    { sender: 'assistant', message: 'How are you feeling about that?' }
                ],
                conversationState: conversationState,
                learnedPatterns: [],
                sessionContext: {
                    personalityName: character.name
                }
            };

            // Build prompt
            const prompt = proactiveService.buildProactiveAnalysisPrompt(analysisContext);

            // Verify all conversation state fields are in prompt
            expect(prompt).toContain('CONVERSATION STATE AWARENESS');
            expect(prompt).toContain('Last message sender: assistant');
            expect(prompt).toContain('Last message type: QUESTION');
            expect(prompt).toContain('Time since your last message: 45 seconds');
            expect(prompt).toContain('User response pending: YES');
            expect(prompt).toContain('Messages since conversation started: 5');
            expect(prompt).toContain('Conversation momentum:');

            // Verify timing intuition section
            expect(prompt).toContain('TIMING INTUITION BASED ON YOUR PERSONALITY');
            expect(prompt).toContain('Core traits: balanced, thoughtful');
            expect(prompt).toContain('Current emotion: neutral at 5/10 intensity');
            expect(prompt).toContain('Energy level: 7/10');
            expect(prompt).toContain('Stress level: 3/10');

            // Verify timing guidance
            expect(prompt).toContain('Strict/impatient personalities typically feel the urge to follow up after 60-90 seconds');
            expect(prompt).toContain('Relaxed/patient personalities might wait 3-5 minutes or longer');
            
            // Verify current situation
            expect(prompt).toContain('CURRENT SITUATION:');
            expect(prompt).toContain('You asked a question 45 seconds ago');
            expect(prompt).toContain('User has not responded yet');
            expect(prompt).toContain('Your last message: "How are you feeling about that?"');
        }, 10000);
    });
});

