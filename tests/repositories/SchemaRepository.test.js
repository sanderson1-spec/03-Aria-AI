/**
 * Unit Tests for SchemaRepository
 * 
 * CLEAN ARCHITECTURE TESTING:
 * - Test database schema management
 * - Test basic repository operations
 * - Test database access patterns
 * - Mock database dependencies for isolated testing
 */

const SchemaRepository = require('../../backend/dal/repositories/CORE_SchemaRepository');

describe('SchemaRepository', () => {
    let schemaRepo;
    let mockDeps;

    beforeEach(() => {
        mockDeps = createMockDependencies();
        schemaRepo = new SchemaRepository('schema_versions', mockDeps);
    });

    describe('Architecture Compliance', () => {
        test('should extend BaseRepository', () => {
            expect(schemaRepo.constructor.name).toBe('SchemaRepository');
            expect(schemaRepo.tableName).toBe('schema_versions');
            expect(schemaRepo.dal).toBeDefined();
            expect(schemaRepo.logger).toBeDefined();
            expect(schemaRepo.errorHandler).toBeDefined();
        });

        test('should implement required repository interface', () => {
            const requiredMethods = ['count', 'findById', 'create', 'update', 'delete'];
            requiredMethods.forEach(method => {
                expect(typeof schemaRepo[method]).toBe('function');
            });
        });

        test('should have getCurrentVersion method', () => {
            expect(typeof schemaRepo.getCurrentVersion).toBe('function');
        });
    });

    describe('Schema Management Operations', () => {
        test('should get current schema version', async () => {
            const mockVersion = { version: '1.0.5', applied_at: '2024-01-01' };
            mockDeps.dal.queryOne.mockResolvedValue(mockVersion);

            const result = await schemaRepo.getCurrentVersion();

            expect(result).toEqual(mockVersion);
            expect(mockDeps.dal.queryOne).toHaveBeenCalledWith(
                expect.stringContaining('ORDER BY version DESC'),
                []
            );
        });
    });

    describe('Basic Repository Operations', () => {
        test('should create schema version record', async () => {
            const mockVersion = {
                id: 'ver-1',
                version: '1.0.6',
                description: 'Add user preferences table'
            };
            mockDeps.dal.create.mockResolvedValue(mockVersion);

            const result = await schemaRepo.create(mockVersion);

            expect(result).toEqual(mockVersion);
            expect(mockDeps.dal.create).toHaveBeenCalledWith('schema_versions', mockVersion);
        });

        test('should count schema versions', async () => {
            mockDeps.dal.count.mockResolvedValue(5);

            const result = await schemaRepo.count();

            expect(result).toBe(5);
            expect(mockDeps.dal.count).toHaveBeenCalledWith('schema_versions', {});
        });

        test('should find schema version by id', async () => {
            const mockVersion = { id: 'ver-1', version: '1.0.5' };
            mockDeps.dal.findById.mockResolvedValue(mockVersion);

            const result = await schemaRepo.findById('ver-1');

            expect(result).toEqual(mockVersion);
            expect(mockDeps.dal.findById).toHaveBeenCalledWith('schema_versions', 'ver-1');
        });
    });

    describe('Error Handling', () => {
        test('should handle database errors gracefully', async () => {
            const dbError = new Error('Database connection failed');
            mockDeps.dal.queryOne.mockRejectedValue(dbError);

            await expect(schemaRepo.getCurrentVersion()).rejects.toThrow();
        });
    });
});