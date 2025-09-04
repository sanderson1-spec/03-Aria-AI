/**
 * Unit Tests for PsychologyRepository
 * 
 * CLEAN ARCHITECTURE TESTING:
 * - Test psychology framework and state management
 * - Test multi-user psychological data isolation
 * - Test character-specific psychology operations
 * - Mock database dependencies for isolated testing
 */

const PsychologyRepository = require('../../backend/dal/repositories/CORE_PsychologyRepository');

describe('PsychologyRepository', () => {
    let psychologyRepo;
    let mockDeps;

    beforeEach(() => {
        mockDeps = createMockDependencies();
        psychologyRepo = new PsychologyRepository('psychology', mockDeps);
    });

    describe('Architecture Compliance', () => {
        test('should extend BaseRepository', () => {
            expect(psychologyRepo.constructor.name).toBe('PsychologyRepository');
            expect(psychologyRepo.tableName).toBe('psychology');
            expect(psychologyRepo.dal).toBeDefined();
            expect(psychologyRepo.logger).toBeDefined();
            expect(psychologyRepo.errorHandler).toBeDefined();
        });

        test('should implement required repository interface', () => {
            const requiredMethods = ['count', 'findById', 'create', 'update', 'delete'];
            requiredMethods.forEach(method => {
                expect(typeof psychologyRepo[method]).toBe('function');
            });
        });

        test('should implement psychology-specific methods', () => {
            const psychologyMethods = [
                'getCharacterPsychologicalFrameworks',
                'getCharacterPsychologicalState',
                'saveCharacterPsychologicalState',
                'getPsychologyEvolutionLog',
                'logPsychologyEvolution'
            ];
            psychologyMethods.forEach(method => {
                expect(typeof psychologyRepo[method]).toBe('function');
            });
        });
    });

    describe('Multi-User Psychology Operations', () => {
        test('should get character psychological frameworks with user isolation', async () => {
            const mockFrameworks = [
                { id: 1, personality_id: 'char-1', framework_data: '{}' }
            ];
            mockDeps.dal.query.mockResolvedValue(mockFrameworks);

            const result = await psychologyRepo.getCharacterPsychologicalFrameworks('user-123', 'char-1');

            expect(result).toEqual(mockFrameworks);
            expect(mockDeps.dal.query).toHaveBeenCalledWith(
                expect.stringContaining('personality_id = ?'),
                ['char-1']
            );
        });

        test('should save character psychological state with proper data structure', async () => {
            const mockState = {
                emotional_state: { mood: 'happy' },
                cognitive_patterns: { focus: 'high' }
            };
            mockDeps.dal.execute.mockResolvedValue({ changes: 1 });

            await psychologyRepo.saveCharacterPsychologicalState('user-123', 'char-1', 'session-1', mockState);

            expect(mockDeps.dal.execute).toHaveBeenCalledWith(
                expect.stringContaining('INSERT OR REPLACE'),
                expect.arrayContaining(['user-123', 'char-1'])
            );
        });

        test('should get psychology evolution log with proper ordering', async () => {
            const mockLog = [
                { id: 1, personality_id: 'char-1', created_at: '2024-01-01' }
            ];
            mockDeps.dal.query.mockResolvedValue(mockLog);

            const result = await psychologyRepo.getPsychologyEvolutionLog('user-123', 'char-1', 10);

            expect(result).toEqual(mockLog);
            expect(mockDeps.dal.query).toHaveBeenCalledWith(
                expect.stringContaining('ORDER BY created_at DESC'),
                ['user-123', 'char-1', 10]
            );
        });
    });

    describe('Error Handling', () => {
        test('should handle database errors gracefully', async () => {
            const dbError = new Error('Database connection failed');
            mockDeps.dal.query.mockRejectedValue(dbError);

            await expect(
                psychologyRepo.getCharacterPsychologicalFrameworks('user-123', 'char-1')
            ).rejects.toThrow();
        });
    });
});