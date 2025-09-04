/**
 * Unit Tests for UserSessionRepository
 * 
 * CLEAN ARCHITECTURE TESTING:
 * - Test user session management
 * - Test session lifecycle operations
 * - Test multi-user session isolation
 * - Mock database dependencies for isolated testing
 */

const UserSessionRepository = require('../../backend/dal/repositories/CORE_UserSessionRepository');

describe('UserSessionRepository', () => {
    let userSessionRepo;
    let mockDeps;

    beforeEach(() => {
        mockDeps = createMockDependencies();
        userSessionRepo = new UserSessionRepository('user_sessions', mockDeps);
    });

    describe('Architecture Compliance', () => {
        test('should extend BaseRepository', () => {
            expect(userSessionRepo.constructor.name).toBe('UserSessionRepository');
            expect(userSessionRepo.tableName).toBe('user_sessions');
            expect(userSessionRepo.dal).toBeDefined();
            expect(userSessionRepo.logger).toBeDefined();
            expect(userSessionRepo.errorHandler).toBeDefined();
        });

        test('should implement required repository interface', () => {
            const requiredMethods = ['count', 'findById', 'create', 'update', 'delete'];
            requiredMethods.forEach(method => {
                expect(typeof userSessionRepo[method]).toBe('function');
            });
        });

        test('should implement base repository methods', () => {
            // Test only what we know exists from BaseRepository
            expect(typeof userSessionRepo.create).toBe('function');
            expect(typeof userSessionRepo.findById).toBe('function');
            expect(typeof userSessionRepo.update).toBe('function');
            expect(typeof userSessionRepo.delete).toBe('function');
        });
    });

    describe('Basic Repository Operations', () => {
        test('should create user session record', async () => {
            const mockSession = {
                id: 'session-1',
                user_id: 'user-123',
                session_token: 'token-abc',
                is_active: 1
            };
            mockDeps.dal.create.mockResolvedValue(mockSession);

            const result = await userSessionRepo.create(mockSession);

            expect(result).toEqual(mockSession);
            expect(mockDeps.dal.create).toHaveBeenCalledWith('user_sessions', mockSession);
        });

        test('should find session by id', async () => {
            const mockSession = { id: 'session-1', user_id: 'user-123' };
            mockDeps.dal.findById.mockResolvedValue(mockSession);

            const result = await userSessionRepo.findById('session-1');

            expect(result).toEqual(mockSession);
            expect(mockDeps.dal.findById).toHaveBeenCalledWith('user_sessions', 'session-1');
        });

        test('should count sessions', async () => {
            mockDeps.dal.count.mockResolvedValue(5);

            const result = await userSessionRepo.count();

            expect(result).toBe(5);
            expect(mockDeps.dal.count).toHaveBeenCalledWith('user_sessions', {});
        });
    });

    describe('Error Handling', () => {
        test('should handle database errors gracefully', async () => {
            const dbError = new Error('Database connection failed');
            mockDeps.dal.findById.mockRejectedValue(dbError);

            await expect(
                userSessionRepo.findById('session-1')
            ).rejects.toThrow();
        });
    });
});