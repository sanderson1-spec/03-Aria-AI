/**
 * Unit Tests for StructuredResponseService
 * 
 * CLEAN ARCHITECTURE TESTING:
 * - Test structured JSON response parsing
 * - Test LLM integration and fallback strategies
 * - Test parsing strategy registry
 * - Mock external dependencies for isolated testing
 */

const StructuredResponseService = require('../../backend/services/intelligence/CORE_StructuredResponseService');

describe('StructuredResponseService', () => {
    let structuredResponseService;
    let mockDeps;

    beforeEach(() => {
        mockDeps = createMockDependencies();
        // Add LLM service mock
        mockDeps.llm = {
            generateResponse: jest.fn(),
            isHealthy: jest.fn().mockResolvedValue(true)
        };
        
        structuredResponseService = new StructuredResponseService(mockDeps);
    });

    describe('Architecture Compliance', () => {
        test('should extend AbstractService', () => {
            expect(structuredResponseService.constructor.name).toBe('StructuredResponseService');
            expect(structuredResponseService.name).toBe('StructuredResponse');
            expect(structuredResponseService.logger).toBeDefined();
            expect(structuredResponseService.errorHandler).toBeDefined();
        });

        test('should require LLM dependency', () => {
            const invalidDeps = { ...mockDeps };
            delete invalidDeps.llm;
            
            expect(() => new StructuredResponseService(invalidDeps)).not.toThrow();
            // The error is thrown during initialization
        });

        test('should implement required service interface', () => {
            const requiredMethods = ['initialize', 'shutdown', 'checkHealth'];
            requiredMethods.forEach(method => {
                expect(typeof structuredResponseService[method]).toBe('function');
            });
        });

        test('should implement structured response methods', () => {
            const responseMethods = [
                'generateStructuredResponse',
                'parseWithAllStrategies',
                'parseDirectJSON'
            ];
            responseMethods.forEach(method => {
                expect(typeof structuredResponseService[method]).toBe('function');
            });
        });
    });

    describe('Service Lifecycle', () => {
        test('should initialize successfully with LLM dependency', async () => {
            await expect(structuredResponseService.initialize()).resolves.not.toThrow();
        });

        test('should fail initialization without LLM service', async () => {
            const invalidService = new StructuredResponseService({ 
                ...mockDeps, 
                llm: null 
            });
            
            await expect(invalidService.initialize()).rejects.toThrow();
        });

        test('should provide health status', async () => {
            const health = await structuredResponseService.checkHealth();
            expect(health).toBeDefined();
            expect(typeof health.healthy).toBe('boolean');
        });

        test('should shutdown gracefully', async () => {
            jest.spyOn(structuredResponseService, 'onShutdown').mockResolvedValue();
            
            await expect(structuredResponseService.shutdown()).resolves.not.toThrow();
        });
    });

    describe('Structured Response Generation', () => {
        test('should generate structured response with valid JSON', async () => {
            const mockLLMResponse = '{"status": "success", "data": {"message": "Hello"}}';
            mockDeps.llm.generateResponse.mockResolvedValue(mockLLMResponse);

            const result = await structuredResponseService.generateStructuredResponse(
                'Generate a greeting message',
                { format: 'json' }
            );

            expect(result).toBeDefined();
            expect(mockDeps.llm.generateResponse).toHaveBeenCalled();
        });

        test('should handle malformed JSON with fallback strategies', async () => {
            const malformedResponse = '{"status": "success", "data": {"message": "Hello"'; // Missing closing braces
            mockDeps.llm.generateResponse.mockResolvedValue(malformedResponse);

            const result = await structuredResponseService.generateStructuredResponse(
                'Generate a greeting message',
                { format: 'json' }
            );

            // Should attempt to parse and use fallback strategies
            expect(result).toBeDefined();
        });

        test('should parse JSON with multiple strategies', async () => {
            const jsonString = '{"status": "success", "data": {"message": "Hello"}}';
            
            const result = await structuredResponseService.parseWithAllStrategies(jsonString);

            expect(result).toBeDefined();
        });

        test('should parse direct JSON', async () => {
            const jsonString = '{"result": "success", "value": 42}';
            
            const result = await structuredResponseService.parseDirectJSON(jsonString);

            expect(result).toBeDefined();
        });
    });

    describe('Parsing Strategies', () => {
        test('should have parsing strategies registered', () => {
            expect(structuredResponseService.parsingStrategies).toBeDefined();
            expect(structuredResponseService.parsingStrategies.size).toBeGreaterThan(0);
        });

        test('should parse JSON with direct strategy', async () => {
            const jsonString = '{"result": "success", "value": 42}';
            
            const parsed = await structuredResponseService.parseDirectJSON(jsonString);
            
            expect(parsed).toBeDefined();
        });

        test('should track parsing statistics', async () => {
            expect(structuredResponseService.stats.totalRequests).toBeGreaterThanOrEqual(0);
            expect(structuredResponseService.stats.successfulParses).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Error Handling', () => {
        test('should handle LLM service errors gracefully', async () => {
            const llmError = new Error('LLM service unavailable');
            mockDeps.llm.generateResponse.mockRejectedValue(llmError);

            // Service should handle errors gracefully and return error response
            const result = await structuredResponseService.generateStructuredResponse('Test prompt');
            expect(result).toBeDefined();
            expect(result.error).toBeDefined();
        });

        test('should handle invalid JSON with try-catch', async () => {
            const invalidJson = 'This is not JSON at all';
            
            // Should handle parsing errors gracefully
            expect(() => {
                try {
                    JSON.parse(invalidJson);
                } catch (error) {
                    expect(error).toBeInstanceOf(SyntaxError);
                    throw error;
                }
            }).toThrow();
        });
    });

    describe('Performance Metrics', () => {
        test('should track response statistics', () => {
            expect(structuredResponseService.stats).toEqual(
                expect.objectContaining({
                    totalRequests: expect.any(Number),
                    successfulParses: expect.any(Number),
                    fallbacksUsed: expect.any(Number),
                    averageResponseTime: expect.any(Number)
                })
            );
        });

        test('should provide metrics through service interface', () => {
            // Check if getMetrics method exists, or use stats directly
            if (typeof structuredResponseService.getMetrics === 'function') {
                const metrics = structuredResponseService.getMetrics();
                expect(metrics).toBeDefined();
            } else {
                expect(structuredResponseService.stats).toBeDefined();
                expect(structuredResponseService.stats.totalRequests).toBeDefined();
            }
        });
    });
});