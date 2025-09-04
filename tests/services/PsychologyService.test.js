/**
 * Unit Tests for PsychologyService
 * 
 * CLEAN ARCHITECTURE TESTING:
 * - Test service creation and inheritance
 * - Test psychology state management
 * - Test character framework operations
 * - Mock external dependencies for isolated testing
 */

const PsychologyService = require('../../backend/services/domain/CORE_PsychologyService');

describe('PsychologyService', () => {
    let psychologyService;
    let mockDeps;

    beforeEach(() => {
        mockDeps = createMockDependencies();
        // Add database service mock with DAL
        mockDeps.database = {
            getDAL: jest.fn().mockReturnValue({
                psychology: {
                    getCharacterPsychologicalFrameworks: jest.fn(),
                    getCharacterPsychologicalState: jest.fn(),
                    getPsychologicalState: jest.fn(),
                    saveCharacterPsychologicalState: jest.fn(),
                    getPsychologyEvolutionLog: jest.fn(),
                    logPsychologyEvolution: jest.fn()
                }
            })
        };
        
        psychologyService = new PsychologyService(mockDeps);
    });

    describe('Architecture Compliance', () => {
        test('should extend AbstractService', () => {
            expect(psychologyService.constructor.name).toBe('PsychologyService');
            expect(psychologyService.name).toBe('Psychology');
            expect(psychologyService.logger).toBeDefined();
            expect(psychologyService.errorHandler).toBeDefined();
        });

        test('should have DAL access', () => {
            expect(psychologyService.dal).toBeDefined();
            expect(psychologyService.dal.psychology).toBeDefined();
        });

        test('should implement required service interface', () => {
            const requiredMethods = ['initialize', 'shutdown', 'checkHealth'];
            requiredMethods.forEach(method => {
                expect(typeof psychologyService[method]).toBe('function');
            });
        });

        test('should implement psychology-specific methods', () => {
            const psychologyMethods = [
                'getPersonalityFramework',
                'getCharacterState',
                'updateCharacterState',
                'initializeCharacterState',
                'cleanupInactiveStates'
            ];
            psychologyMethods.forEach(method => {
                expect(typeof psychologyService[method]).toBe('function');
            });
        });
    });

    describe('Service Lifecycle', () => {
        test('should initialize successfully', async () => {
            jest.spyOn(psychologyService, 'onInitialize').mockResolvedValue();
            
            await expect(psychologyService.initialize()).resolves.not.toThrow();
        });

        test('should provide health status', async () => {
            const health = await psychologyService.checkHealth();
            expect(health).toBeDefined();
            expect(typeof health.healthy).toBe('boolean');
        });

        test('should shutdown gracefully', async () => {
            jest.spyOn(psychologyService, 'onShutdown').mockResolvedValue();
            
            await expect(psychologyService.shutdown()).resolves.not.toThrow();
        });
    });

    describe('Psychology Operations', () => {
        test('should manage character states', async () => {
            const mockState = { emotional_state: { mood: 'happy' } };
            mockDeps.database.getDAL().psychology.getPsychologicalState.mockResolvedValue(mockState);

            const result = await psychologyService.getCharacterState('session-123');
            expect(result).toEqual(mockState);
        });

        test('should cleanup inactive states', async () => {
            const result = await psychologyService.cleanupInactiveStates();
            expect(typeof result).toBe('number');
        });
    });
});