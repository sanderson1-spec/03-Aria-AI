/**
 * Unit Tests for ProactiveRepository
 * 
 * CLEAN ARCHITECTURE TESTING:
 * - Test proactive intelligence data management
 * - Test engagement history operations
 * - Test learning pattern tracking
 * - Mock database dependencies for isolated testing
 */

const ProactiveRepository = require('../../backend/dal/repositories/CORE_ProactiveRepository');

describe('ProactiveRepository', () => {
    let proactiveRepo;
    let mockDeps;

    beforeEach(() => {
        mockDeps = createMockDependencies();
        proactiveRepo = new ProactiveRepository('proactive', mockDeps);
    });

    describe('Architecture Compliance', () => {
        test('should extend BaseRepository', () => {
            expect(proactiveRepo.constructor.name).toBe('ProactiveRepository');
            expect(proactiveRepo.tableName).toBe('proactive');
            expect(proactiveRepo.dal).toBeDefined();
            expect(proactiveRepo.logger).toBeDefined();
            expect(proactiveRepo.errorHandler).toBeDefined();
        });

        test('should implement required repository interface', () => {
            const requiredMethods = ['count', 'findById', 'create', 'update', 'delete'];
            requiredMethods.forEach(method => {
                expect(typeof proactiveRepo[method]).toBe('function');
            });
        });

        test('should implement proactive-specific methods', () => {
            const proactiveMethods = [
                'getEngagementHistory',
                'getLearningPatterns',
                'getTimingOptimizations'
            ];
            proactiveMethods.forEach(method => {
                expect(typeof proactiveRepo[method]).toBe('function');
            });
        });
    });

    describe('Multi-User Proactive Operations', () => {
        test('should get engagement history with user isolation', async () => {
            const mockHistory = [
                { id: 1, user_id: 'user-123', engagement_type: 'proactive_message', timestamp: '2024-01-01' }
            ];
            mockDeps.dal.query.mockResolvedValue(mockHistory);

            const result = await proactiveRepo.getEngagementHistory('user-123', 10);

            expect(result).toEqual(mockHistory);
            expect(mockDeps.dal.query).toHaveBeenCalledWith(
                expect.stringContaining('user_id = ?'),
                ['user-123', 10]
            );
        });

        test('should get learning patterns with proper filtering', async () => {
            const mockPatterns = [
                { id: 1, user_id: 'user-123', pattern_type: 'response_time', data: '{}' }
            ];
            mockDeps.dal.query.mockResolvedValue(mockPatterns);

            const result = await proactiveRepo.getLearningPatterns('user-123', 20);

            expect(result).toEqual(mockPatterns);
            expect(mockDeps.dal.query).toHaveBeenCalledWith(
                expect.stringContaining('user_id = ?'),
                ['user-123', 20, 50]
            );
        });

        test('should get timing optimizations with user scope', async () => {
            const mockOptimizations = [
                { id: 1, user_id: 'user-123', optimization_type: 'best_time', value: 14.5 }
            ];
            mockDeps.dal.query.mockResolvedValue(mockOptimizations);

            const result = await proactiveRepo.getTimingOptimizations('user-123', 15);

            expect(result).toEqual(mockOptimizations);
            expect(mockDeps.dal.query).toHaveBeenCalledWith(
                expect.stringContaining('user_id = ?'),
                ['user-123', 15]
            );
        });
    });

    describe('Error Handling', () => {
        test('should handle database errors gracefully', async () => {
            const dbError = new Error('Database connection failed');
            mockDeps.dal.query.mockRejectedValue(dbError);

            await expect(
                proactiveRepo.getEngagementHistory('user-123', 10)
            ).rejects.toThrow();
        });
    });
});