/**
 * Unit Tests for PersonalityRepository
 * 
 * CLEAN ARCHITECTURE TESTING:
 * - Test personality data management
 * - Test basic repository operations
 * - Test database access patterns
 * - Mock database dependencies for isolated testing
 */

const PersonalityRepository = require('../../backend/dal/repositories/CORE_PersonalityRepository');

describe('PersonalityRepository', () => {
    let personalityRepo;
    let mockDeps;

    beforeEach(() => {
        mockDeps = createMockDependencies();
        personalityRepo = new PersonalityRepository('personalities', mockDeps);
    });

    describe('Architecture Compliance', () => {
        test('should extend BaseRepository', () => {
            expect(personalityRepo.constructor.name).toBe('PersonalityRepository');
            expect(personalityRepo.tableName).toBe('personalities');
            expect(personalityRepo.dal).toBeDefined();
            expect(personalityRepo.logger).toBeDefined();
            expect(personalityRepo.errorHandler).toBeDefined();
        });

        test('should implement required repository interface', () => {
            const requiredMethods = ['count', 'findById', 'create', 'update', 'delete'];
            requiredMethods.forEach(method => {
                expect(typeof personalityRepo[method]).toBe('function');
            });
        });
    });

    describe('Basic Repository Operations', () => {
        test('should find personality by id', async () => {
            const mockPersonality = { id: 'pers-1', name: 'Assistant' };
            mockDeps.dal.findById.mockResolvedValue(mockPersonality);

            const result = await personalityRepo.findById('pers-1');

            expect(result).toEqual(mockPersonality);
            expect(mockDeps.dal.findById).toHaveBeenCalledWith('personalities', 'pers-1');
        });

        test('should count personalities', async () => {
            mockDeps.dal.count.mockResolvedValue(3);

            const result = await personalityRepo.count();

            expect(result).toBe(3);
            expect(mockDeps.dal.count).toHaveBeenCalledWith('personalities', {});
        });

        test('should have basic CRUD methods available', () => {
            expect(typeof personalityRepo.create).toBe('function');
            expect(typeof personalityRepo.update).toBe('function');
            expect(typeof personalityRepo.delete).toBe('function');
        });
    });

    describe('Error Handling', () => {
        test('should handle database errors gracefully', async () => {
            const dbError = new Error('Database connection failed');
            mockDeps.dal.findById.mockRejectedValue(dbError);

            await expect(personalityRepo.findById('pers-1')).rejects.toThrow();
        });
    });
});