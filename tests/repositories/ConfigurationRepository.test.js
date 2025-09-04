/**
 * Unit Tests for ConfigurationRepository
 * 
 * CLEAN ARCHITECTURE TESTING:
 * - Test configuration data management
 * - Test basic repository operations
 * - Test database access patterns
 * - Mock database dependencies for isolated testing
 */

const ConfigurationRepository = require('../../backend/dal/repositories/CORE_ConfigurationRepository');

describe('ConfigurationRepository', () => {
    let configRepo;
    let mockDeps;

    beforeEach(() => {
        mockDeps = createMockDependencies();
        configRepo = new ConfigurationRepository('configuration', mockDeps);
    });

    describe('Architecture Compliance', () => {
        test('should extend BaseRepository', () => {
            expect(configRepo.constructor.name).toBe('ConfigurationRepository');
            expect(configRepo.tableName).toBe('configuration');
            expect(configRepo.dal).toBeDefined();
            expect(configRepo.logger).toBeDefined();
            expect(configRepo.errorHandler).toBeDefined();
        });

        test('should implement required repository interface', () => {
            const requiredMethods = ['count', 'findById', 'create', 'update', 'delete'];
            requiredMethods.forEach(method => {
                expect(typeof configRepo[method]).toBe('function');
            });
        });

        test('should have getConfigValue method', () => {
            expect(typeof configRepo.getConfigValue).toBe('function');
        });
    });

    describe('Configuration Operations', () => {
        test('should get configuration value by key', async () => {
            const mockValue = 'Aria AI';
            mockDeps.dal.queryOne.mockResolvedValue({ key: 'app_name', value: mockValue });

            const result = await configRepo.getConfigValue('app_name');

            expect(result).toBe(mockValue);
            expect(mockDeps.dal.queryOne).toHaveBeenCalledWith(
                expect.stringContaining('key = ?'),
                ['app_name']
            );
        });

        test('should set configuration value', async () => {
            mockDeps.dal.execute.mockResolvedValue({ changes: 1 });

            await configRepo.setConfigValue('theme', 'dark', 'string');

            expect(mockDeps.dal.execute).toHaveBeenCalledWith(
                expect.stringContaining('INSERT OR REPLACE'),
                expect.arrayContaining(['theme', 'dark', 'string'])
            );
        });
    });

    describe('Basic Repository Operations', () => {
        test('should create configuration record', async () => {
            const mockConfig = { key: 'new_setting', value: 'test_value', type: 'string' };
            mockDeps.dal.create.mockResolvedValue(mockConfig);

            const result = await configRepo.create(mockConfig);

            expect(result).toEqual(mockConfig);
            expect(mockDeps.dal.create).toHaveBeenCalledWith('configuration', mockConfig);
        });

        test('should count configurations', async () => {
            mockDeps.dal.count.mockResolvedValue(10);

            const result = await configRepo.count();

            expect(result).toBe(10);
            expect(mockDeps.dal.count).toHaveBeenCalledWith('configuration', {});
        });
    });

    describe('Error Handling', () => {
        test('should handle database errors gracefully', async () => {
            const dbError = new Error('Database connection failed');
            mockDeps.dal.queryOne.mockRejectedValue(dbError);

            await expect(configRepo.getConfigValue('test_key')).rejects.toThrow();
        });
    });
});