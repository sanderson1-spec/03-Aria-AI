/**
 * Integration Tests for Database Service
 * 
 * CLEAN ARCHITECTURE TESTING:
 * - Test database service initialization
 * - Test repository integration
 * - Test multi-user data isolation
 * - Test service health monitoring
 */

const { setupServices } = require('../../setupServices');

describe('Database Service Integration', () => {
    let serviceFactory;

    afterEach(async () => {
        if (serviceFactory) {
            await serviceFactory.shutdown();
        }
    });

    describe('Service Initialization', () => {
        test('should initialize all repositories successfully', async () => {
            serviceFactory = await setupServices({
                dbPath: ':memory:',
                includeMetadata: false
            });

            const dal = serviceFactory.services.get('database').getDAL();
            
            // Test key repository access
            const expectedRepos = ['users', 'chats', 'conversations', 'psychology', 'proactive'];
            
            for (const repo of expectedRepos) {
                expect(dal[repo]).toBeDefined();
                expect(typeof dal[repo].count).toBe('function');
            }
        });

        test('should provide DAL access to all repositories', async () => {
            serviceFactory = await setupServices({
                dbPath: ':memory:',
                includeMetadata: false
            });

            const dal = serviceFactory.services.get('database').getDAL();
            
            // Test raw database access
            expect(typeof dal.query).toBe('function');
            expect(typeof dal.queryOne).toBe('function');
            expect(typeof dal.execute).toBe('function');
        });
    });

    describe('Service Health', () => {
        test('should maintain healthy repository connections', async () => {
            serviceFactory = await setupServices({
                dbPath: ':memory:',
                includeMetadata: false
            });

            const databaseService = serviceFactory.services.get('database');
            const health = await databaseService.checkHealth();
            
            expect(health.healthy).toBe(true);
            expect(health.details.connected).toBe(true);
            expect(health.details.repositoriesInitialized).toBeGreaterThan(0);
        });
    });
});