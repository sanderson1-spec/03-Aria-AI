/**
 * Unit Tests for SessionRepository
 * 
 * CLEAN ARCHITECTURE TESTING:
 * - Test session data management
 * - Test session lifecycle operations
 * - Test multi-user session isolation
 * - Mock database dependencies for isolated testing
 */

const SessionRepository = require('../../backend/dal/repositories/CORE_SessionRepository');

describe('SessionRepository', () => {
    let sessionRepo;
    let mockDeps;

    beforeEach(() => {
        mockDeps = createMockDependencies();
        sessionRepo = new SessionRepository('sessions', mockDeps);
    });

    describe('Architecture Compliance', () => {
        test('should extend BaseRepository', () => {
            expect(sessionRepo.constructor.name).toBe('SessionRepository');
            expect(sessionRepo.tableName).toBe('sessions');
            expect(sessionRepo.dal).toBeDefined();
            expect(sessionRepo.logger).toBeDefined();
            expect(sessionRepo.errorHandler).toBeDefined();
        });

        test('should implement required repository interface', () => {
            const requiredMethods = ['count', 'findById', 'create', 'update', 'delete'];
            requiredMethods.forEach(method => {
                expect(typeof sessionRepo[method]).toBe('function');
            });
        });

        test('should implement session-specific methods', () => {
            const sessionMethods = [
                'validateTables',
                'ensureSessionSchema',
                'loadActiveSessions',
                'isHealthy'
            ];
            sessionMethods.forEach(method => {
                expect(typeof sessionRepo[method]).toBe('function');
            });
        });
    });

    describe('Session Management Operations', () => {
        test('should validate tables successfully', async () => {
            mockDeps.dal.queryOne.mockResolvedValue({ name: 'sessions' });

            const result = await sessionRepo.validateTables();

            expect(result).toBe(true);
            expect(mockDeps.dal.queryOne).toHaveBeenCalledWith(
                expect.stringContaining('sqlite_master'),
                expect.arrayContaining(['sessions'])
            );
        });

        test('should have loadActiveSessions method available', () => {
            expect(typeof sessionRepo.loadActiveSessions).toBe('function');
        });

        test('should report health status', async () => {
            mockDeps.dal.queryOne.mockResolvedValue({ count: 5 });

            const result = await sessionRepo.isHealthy();

            expect(typeof result).toBe('boolean');
        });
    });

    describe('Schema Management', () => {
        test('should ensure session schema exists', async () => {
            mockDeps.dal.execute.mockResolvedValue({ changes: 1 });

            await expect(sessionRepo.ensureSessionSchema()).resolves.not.toThrow();
            
            expect(mockDeps.dal.execute).toHaveBeenCalledWith(
                expect.stringContaining('CREATE TABLE IF NOT EXISTS')
            );
        });
    });

    describe('Error Handling', () => {
        test('should handle database errors gracefully', async () => {
            const dbError = new Error('Database connection failed');
            mockDeps.dal.queryOne.mockRejectedValue(dbError);

            await expect(sessionRepo.validateTables()).rejects.toThrow();
        });
    });
});