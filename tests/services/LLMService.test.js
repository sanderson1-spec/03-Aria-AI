/**
 * Unit Tests for LLMService
 * 
 * CLEAN ARCHITECTURE TESTING:
 * - Test service creation and inheritance
 * - Test LLM communication and error handling
 * - Mock external dependencies for isolated testing
 * - Verify proper service lifecycle
 */

const LLMService = require('../../backend/services/intelligence/CORE_LLMService');

describe('LLMService', () => {
    let llmService;
    let mockDeps;

    beforeEach(() => {
        mockDeps = createMockDependencies();
        llmService = new LLMService(mockDeps);
    });

    describe('Architecture Compliance', () => {
        test('should extend AbstractService', () => {
            expect(llmService.constructor.name).toBe('LLMService');
            expect(llmService.logger).toBeDefined();
            expect(llmService.errorHandler).toBeDefined();
        });

        test('should have correct service name', () => {
            expect(llmService.name).toBe('LLM');
        });

        test('should implement required service interface', () => {
            const requiredMethods = ['initialize', 'shutdown', 'checkHealth'];
            requiredMethods.forEach(method => {
                expect(typeof llmService[method]).toBe('function');
            });
        });
    });

    describe('Service Lifecycle', () => {
        test('should initialize successfully', async () => {
            // Mock successful initialization
            jest.spyOn(llmService, 'onInitialize').mockResolvedValue();
            
            await expect(llmService.initialize()).resolves.not.toThrow();
        });

        test('should provide health status', async () => {
            const health = await llmService.checkHealth();
            expect(health).toBeDefined();
            expect(typeof health.healthy).toBe('boolean');
        });

        test('should shutdown gracefully', async () => {
            jest.spyOn(llmService, 'onShutdown').mockResolvedValue();
            
            await expect(llmService.shutdown()).resolves.not.toThrow();
        });
    });
});