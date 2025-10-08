/**
 * Unit Tests for ProactiveIntelligenceService
 * 
 * CLEAN ARCHITECTURE TESTING:
 * - Test proactive decision making logic
 * - Test psychology integration for user context
 * - Test LLM-driven engagement analysis
 * - Mock external dependencies for isolated testing
 */

const ProactiveIntelligenceService = require('../../backend/services/domain/CORE_ProactiveIntelligenceService');

describe('ProactiveIntelligenceService', () => {
    let proactiveService;
    let mockDeps;

    beforeEach(() => {
        mockDeps = createMockDependencies();
        // Add required service mocks
        mockDeps.structuredResponse = {
            generateStructuredResponse: jest.fn(),
            isHealthy: jest.fn().mockResolvedValue(true)
        };
        mockDeps.psychology = {
            getCharacterState: jest.fn(),
            analyzeUserContext: jest.fn(),
            isHealthy: jest.fn().mockResolvedValue(true)
        };
        mockDeps.database = {
            getDAL: jest.fn().mockReturnValue({
                proactive: {
                    getEngagementHistory: jest.fn(),
                    recordEngagement: jest.fn()
                }
            })
        };
        
        proactiveService = new ProactiveIntelligenceService(mockDeps);
    });

    describe('Architecture Compliance', () => {
        test('should extend AbstractService', () => {
            expect(proactiveService.constructor.name).toBe('ProactiveIntelligenceService');
            expect(proactiveService.name).toBe('ProactiveIntelligence');
            expect(proactiveService.logger).toBeDefined();
            expect(proactiveService.errorHandler).toBeDefined();
        });

        test('should implement required service interface', () => {
            const requiredMethods = ['initialize', 'shutdown', 'checkHealth'];
            requiredMethods.forEach(method => {
                expect(typeof proactiveService[method]).toBe('function');
            });
        });

        test('should implement proactive intelligence methods', () => {
            const proactiveMethods = [
                'analyzeProactiveOpportunity'
            ];
            proactiveMethods.forEach(method => {
                expect(typeof proactiveService[method]).toBe('function');
            });
        });
    });

    describe('Service Lifecycle', () => {
        test('should initialize successfully', async () => {
            jest.spyOn(proactiveService, 'onInitialize').mockResolvedValue();
            
            await expect(proactiveService.initialize()).resolves.not.toThrow();
        });

        test('should provide health status', async () => {
            const health = await proactiveService.checkHealth();
            expect(health).toBeDefined();
            expect(typeof health.healthy).toBe('boolean');
        });

        test('should shutdown gracefully', async () => {
            jest.spyOn(proactiveService, 'onShutdown').mockResolvedValue();
            
            await expect(proactiveService.shutdown()).resolves.not.toThrow();
        });
    });

    describe('Proactive Analysis', () => {
        test('should analyze proactive opportunity with context', async () => {
            const mockAnalysisContext = {
                userId: 'user-123',
                sessionId: 'session-456',
                conversationHistory: ['user: Hello', 'ai: Hi!'],
                psychologyState: { mood: 'neutral', engagement: 'moderate' }
            };
            
            // Initialize the service first to set up dependencies
            await proactiveService.initialize();
            
            const result = await proactiveService.analyzeProactiveOpportunity(mockAnalysisContext);

            expect(result).toBeDefined();
        });

        test('should have service methods available', () => {
            expect(typeof proactiveService.analyzeProactiveOpportunity).toBe('function');
        });
    });

    describe('Service Integration', () => {
        test('should have required dependencies', () => {
            expect(proactiveService.logger).toBeDefined();
            expect(proactiveService.errorHandler).toBeDefined();
        });

        test('should have configuration settings', () => {
            expect(proactiveService.config).toBeDefined();
            expect(proactiveService.config.temperature).toBeDefined();
            expect(proactiveService.config.maxTokens).toBeDefined();
        });
    });

    describe('Commitment Confidence Scoring', () => {
        beforeEach(async () => {
            await proactiveService.initialize();
        });

        test('should detect high-confidence commitment (0.9)', async () => {
            const mockContext = {
                userMessage: 'I want to learn Spanish',
                agentResponse: 'Great! Write 5 sentences in Spanish and submit by 8pm.',
                conversationHistory: [],
                sessionContext: {
                    sessionId: 'session-123',
                    userId: 'user-123',
                    personalityId: 'char-123',
                    personalityName: 'Aria'
                }
            };

            // Mock high-confidence commitment response
            mockDeps.structuredResponse.generateStructuredResponse.mockResolvedValue({
                has_commitment: true,
                confidence: 0.9,
                commitment: {
                    commitment_type: 'homework',
                    description: 'Write 5 sentences in Spanish and submit by 8pm',
                    character_notes: 'Will review the sentences',
                    verification_needed: true,
                    due_at: null
                }
            });

            const result = await proactiveService.detectCommitment(mockContext);

            expect(result).toBeDefined();
            expect(result.has_commitment).toBe(true);
            expect(result.confidence).toBeGreaterThanOrEqual(0.9);
            expect(result.commitment).toBeDefined();
            expect(result.commitment.commitment_type).toBe('homework');
        });

        test('should detect medium-confidence commitment (0.7)', async () => {
            const mockContext = {
                userMessage: 'I should exercise more',
                agentResponse: 'Yes! Try doing 20 push-ups today.',
                conversationHistory: [],
                sessionContext: {
                    sessionId: 'session-123',
                    userId: 'user-123',
                    personalityId: 'char-123',
                    personalityName: 'Aria'
                }
            };

            // Mock medium-confidence commitment response
            mockDeps.structuredResponse.generateStructuredResponse.mockResolvedValue({
                has_commitment: true,
                confidence: 0.7,
                commitment: {
                    commitment_type: 'task',
                    description: 'Try doing 20 push-ups today',
                    character_notes: 'Suggested exercise',
                    verification_needed: false,
                    due_at: null
                }
            });

            const result = await proactiveService.detectCommitment(mockContext);

            expect(result).toBeDefined();
            expect(result.has_commitment).toBe(true);
            expect(result.confidence).toBeLessThan(0.9);
            expect(result.confidence).toBeGreaterThanOrEqual(0.7);
        });

        test('should not flag casual question "How was your day?" as commitment', async () => {
            const mockContext = {
                userMessage: 'I had a busy day',
                agentResponse: 'So tell me, how was your day?',
                conversationHistory: [],
                sessionContext: {
                    sessionId: 'session-123',
                    userId: 'user-123',
                    personalityId: 'char-123',
                    personalityName: 'Aria'
                }
            };

            // Mock low-confidence or no commitment response
            mockDeps.structuredResponse.generateStructuredResponse.mockResolvedValue({
                has_commitment: false,
                confidence: 0.2,
                commitment: null
            });

            const result = await proactiveService.detectCommitment(mockContext);

            expect(result).toBeDefined();
            // Either no commitment OR very low confidence
            if (result.has_commitment) {
                expect(result.confidence).toBeLessThan(0.5);
            } else {
                expect(result.has_commitment).toBe(false);
            }
        });

        test('should not flag casual question "Tell me about yourself" as commitment', async () => {
            const mockContext = {
                userMessage: 'I like to code',
                agentResponse: 'That\'s interesting! Tell me about yourself.',
                conversationHistory: [],
                sessionContext: {
                    sessionId: 'session-123',
                    userId: 'user-123',
                    personalityId: 'char-123',
                    personalityName: 'Aria'
                }
            };

            // Mock low-confidence or no commitment response
            mockDeps.structuredResponse.generateStructuredResponse.mockResolvedValue({
                has_commitment: false,
                confidence: 0.1,
                commitment: null
            });

            const result = await proactiveService.detectCommitment(mockContext);

            expect(result).toBeDefined();
            // Either no commitment OR very low confidence
            if (result.has_commitment) {
                expect(result.confidence).toBeLessThan(0.5);
            } else {
                expect(result.has_commitment).toBe(false);
            }
        });

        test('should not flag casual question "What are you up to?" as commitment', async () => {
            const mockContext = {
                userMessage: 'Just relaxing',
                agentResponse: 'Nice! What are you up to?',
                conversationHistory: [],
                sessionContext: {
                    sessionId: 'session-123',
                    userId: 'user-123',
                    personalityId: 'char-123',
                    personalityName: 'Aria'
                }
            };

            // Mock low-confidence or no commitment response
            mockDeps.structuredResponse.generateStructuredResponse.mockResolvedValue({
                has_commitment: false,
                confidence: 0.15,
                commitment: null
            });

            const result = await proactiveService.detectCommitment(mockContext);

            expect(result).toBeDefined();
            // Either no commitment OR very low confidence
            if (result.has_commitment) {
                expect(result.confidence).toBeLessThan(0.5);
            } else {
                expect(result.has_commitment).toBe(false);
            }
        });

        test('should include confidence score in all commitment detection responses', async () => {
            const mockContext = {
                userMessage: 'I need to study',
                agentResponse: 'Read chapter 3 and we\'ll discuss it tomorrow.',
                conversationHistory: [],
                sessionContext: {
                    sessionId: 'session-123',
                    userId: 'user-123',
                    personalityId: 'char-123',
                    personalityName: 'Aria'
                }
            };

            // Mock commitment response with confidence
            mockDeps.structuredResponse.generateStructuredResponse.mockResolvedValue({
                has_commitment: true,
                confidence: 0.85,
                commitment: {
                    commitment_type: 'homework',
                    description: 'Read chapter 3',
                    character_notes: 'Will discuss tomorrow',
                    verification_needed: true,
                    due_at: null
                }
            });

            const result = await proactiveService.detectCommitment(mockContext);

            expect(result).toBeDefined();
            expect(result.confidence).toBeDefined();
            expect(typeof result.confidence).toBe('number');
            expect(result.confidence).toBeGreaterThanOrEqual(0.0);
            expect(result.confidence).toBeLessThanOrEqual(1.0);
        });
    });
});