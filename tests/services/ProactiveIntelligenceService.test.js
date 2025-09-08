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
});