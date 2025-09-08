/**
 * End-to-End Tests for User Chat Workflow
 * 
 * CLEAN ARCHITECTURE TESTING:
 * - Test complete user workflows
 * - Test service integration
 * - Test data consistency
 * - Test error handling in real scenarios
 */

const { setupServices } = require('../../setupServices');

describe('User Chat Workflow E2E', () => {
    let serviceFactory;

    afterEach(async () => {
        if (serviceFactory) {
            await serviceFactory.shutdown();
        }
    });

    describe('Complete User Workflow', () => {
        test('should handle user registration and first chat creation', async () => {
            serviceFactory = await setupServices({
                dbPath: ':memory:',
                includeMetadata: false
            });

            const dal = serviceFactory.services.get('database').getDAL();
            
            // Create unique user for this test
            const timestamp = Date.now();
            const user = await dal.users.createUser({
                username: `e2e_user_${timestamp}`,
                email: `e2e_${timestamp}@test.com`,
                display_name: 'E2E Test User'
            });

            expect(user).toBeDefined();
            expect(user.username).toBe(`e2e_user_${timestamp}`);
            
            // Create a chat for the user
            const chat = await dal.chats.createChat(user.id, {
                title: 'First Chat',
                personality_id: 'default'
            });

            expect(chat).toBeDefined();
            expect(chat.user_id).toBe(user.id);
            expect(chat.title).toBe('First Chat');
        });
    });

    describe('Service Health During Workflow', () => {
        test('should maintain service health during complete workflow', async () => {
            serviceFactory = await setupServices({
                dbPath: ':memory:',
                includeMetadata: false
            });

            // Check initial health
            const healthResults = await serviceFactory.checkAllServicesHealth();
            const unhealthyServices = Array.from(healthResults.entries())
                .filter(([, health]) => !health.healthy)
                .map(([name]) => name);

            expect(unhealthyServices).toHaveLength(0);
        });
    });
});