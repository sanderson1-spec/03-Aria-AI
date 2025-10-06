/**
 * Integration Test: Proactive Messaging End-to-End
 * Tests the complete proactive messaging flow from backend analysis to frontend delivery
 */

const { setupServices, shutdownServices } = require('../../setupServices');
const path = require('path');

describe('Proactive Messaging Integration', () => {
    let serviceFactory;
    let proactiveIntelligence;
    let proactiveDelivery;
    let proactiveLearning;
    let database;

    beforeAll(async () => {
        // Setup test database
        const testDbPath = path.join(__dirname, '..', '..', 'database', 'test-proactive.db');
        
        const config = {
            dbPath: testDbPath,
            includeMetadata: true,
            dateFormat: 'ISO',
            maxContextSize: 500,
            includeStackTrace: true,
            autoSave: false,
            createMissingDirectories: true
        };

        serviceFactory = await setupServices(config);
        
        // Get services
        proactiveIntelligence = serviceFactory.get('proactiveIntelligence');
        proactiveDelivery = serviceFactory.get('proactiveDelivery');
        proactiveLearning = serviceFactory.get('proactiveLearning');
        database = serviceFactory.get('database');
    });

    afterAll(async () => {
        if (serviceFactory) {
            await shutdownServices(serviceFactory);
        }
    });

    test('services are properly initialized', () => {
        expect(proactiveIntelligence).toBeDefined();
        expect(proactiveDelivery).toBeDefined();
        expect(proactiveLearning).toBeDefined();
        expect(database).toBeDefined();
    });

    test('proactive analysis generates valid decisions', async () => {
        const analysisContext = {
            userMessage: "I'm feeling a bit lonely today",
            agentResponse: "I understand how you're feeling. Loneliness can be difficult to deal with.",
            psychologicalState: {
                current_emotion: 'sad',
                emotional_intensity: 6,
                energy_level: 4,
                stress_level: 5,
                current_motivations: ['seeking_comfort', 'emotional_support'],
                relationship_dynamic: 'supportive',
                communication_mode: 'empathetic'
            },
            psychologicalFramework: {
                core_emotional_range: ['empathetic', 'supportive', 'caring'],
                natural_social_motivations: ['helping_others', 'emotional_connection'],
                communication_patterns: ['active_listening', 'emotional_validation']
            },
            conversationHistory: [
                { sender: 'user', message: "I'm feeling a bit lonely today" },
                { sender: 'assistant', message: "I understand how you're feeling. Loneliness can be difficult to deal with." }
            ],
            learnedPatterns: [],
            sessionContext: {
                sessionId: 'test-session-001',
                userId: 'test-user-001',
                personalityId: 'aria',
                personalityName: 'Aria'
            }
        };

        const decision = await proactiveIntelligence.analyzeProactiveOpportunity(analysisContext);

        expect(decision).toBeDefined();
        expect(typeof decision.should_engage_proactively).toBe('boolean');
        expect(typeof decision.engagement_timing).toBe('string');
        expect(typeof decision.psychological_reasoning).toBe('string');
        expect(typeof decision.confidence_score).toBe('number');
        expect(decision.confidence_score).toBeGreaterThanOrEqual(0);
        expect(decision.confidence_score).toBeLessThanOrEqual(1);
    });

    test('proactive delivery processes decisions correctly', async () => {
        const mockDecision = {
            should_engage_proactively: true,
            engagement_timing: 'wait_30_seconds',
            psychological_reasoning: 'User expressed loneliness and may benefit from supportive follow-up',
            proactive_message_content: 'I wanted to check in - how are you feeling now? Sometimes it helps to talk about what\'s on your mind.',
            confidence_score: 0.8
        };

        const context = {
            sessionId: 'test-session-002',
            userId: 'test-user-002',
            personality: {
                id: 'aria',
                name: 'Aria'
            },
            psychologicalState: {
                current_emotion: 'sad',
                energy_level: 4
            }
        };

        const result = await proactiveDelivery.processProactiveDecision(mockDecision, context);

        expect(result).toBeDefined();
        expect(result.scheduled).toBe(true);
        expect(result.delaySeconds).toBe(30);
        expect(result.scheduleId).toBeDefined();
    });

    test('immediate proactive delivery works', async () => {
        const mockDecision = {
            should_engage_proactively: true,
            engagement_timing: 'immediate',
            psychological_reasoning: 'User needs immediate support',
            proactive_message_content: 'I\'m here for you right now. What would help you feel better?',
            confidence_score: 0.9
        };

        const context = {
            sessionId: 'test-session-003',
            userId: 'test-user-003',
            personality: {
                id: 'aria',
                name: 'Aria'
            },
            psychologicalState: {
                current_emotion: 'distressed',
                energy_level: 3
            }
        };

        const result = await proactiveDelivery.processProactiveDecision(mockDecision, context);

        expect(result).toBeDefined();
        expect(result.delivered).toBe(true);
        expect(result.messageId).toBeDefined();
        expect(result.message).toBeDefined();
        expect(result.message.metadata.proactive).toBe(true);
        expect(result.message.content).toBe(mockDecision.proactive_message_content);
    });

    test('session registration for real-time delivery', (done) => {
        const testSessionId = 'test-session-004';
        let messageReceived = false;

        // Register session with callback
        const cleanup = proactiveDelivery.registerSession(testSessionId, (message) => {
            expect(message).toBeDefined();
            expect(message.metadata.proactive).toBe(true);
            messageReceived = true;
            cleanup();
            done();
        });

        // Simulate a proactive message delivery
        setTimeout(async () => {
            try {
                await proactiveDelivery.deliverProactiveMessage({
                    sessionId: testSessionId,
                    userId: 'test-user-004',
                    personalityId: 'aria',
                    personalityName: 'Aria',
                    content: 'This is a test proactive message',
                    trigger: 'Test trigger',
                    confidence: 0.7,
                    engagementId: 'test-engagement-001'
                });
            } catch (error) {
                cleanup();
                done(error);
            }
        }, 100);

        // Timeout if message not received
        setTimeout(() => {
            if (!messageReceived) {
                cleanup();
                done(new Error('Proactive message not received within timeout'));
            }
        }, 5000);
    });

    test('no proactive engagement when decision is negative', async () => {
        const mockDecision = {
            should_engage_proactively: false,
            engagement_timing: 'none',
            psychological_reasoning: 'User seems content, no proactive engagement needed',
            proactive_message_content: null,
            confidence_score: 0.3
        };

        const context = {
            sessionId: 'test-session-005',
            userId: 'test-user-005',
            personality: {
                id: 'aria',
                name: 'Aria'
            },
            psychologicalState: {
                current_emotion: 'content',
                energy_level: 7
            }
        };

        const result = await proactiveDelivery.processProactiveDecision(mockDecision, context);

        expect(result).toBeNull();
    });

    test('delivery analytics are tracked correctly', async () => {
        const analytics = await proactiveDelivery.getDeliveryAnalytics();
        
        expect(analytics).toBeDefined();
        expect(typeof analytics.activeSessionCount).toBe('number');
        expect(typeof analytics.scheduledMessageCount).toBe('number');
        expect(Array.isArray(analytics.scheduledMessages)).toBe(true);
    });

    test('service health checks pass', async () => {
        const intelligenceHealth = await proactiveIntelligence.onHealthCheck();
        const deliveryHealth = await proactiveDelivery.onHealthCheck();
        const learningHealth = await proactiveLearning.onHealthCheck();

        expect(intelligenceHealth.healthy).toBe(true);
        expect(deliveryHealth.healthy).toBe(true);
        expect(learningHealth.healthy).toBe(true);
    });
});
