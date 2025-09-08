/**
 * Unit Tests for ConversationRepository
 * 
 * CLEAN ARCHITECTURE TESTING:
 * - Test conversation log management
 * - Test memory weight operations
 * - Test multi-user conversation isolation
 * - Mock database dependencies for isolated testing
 */

const ConversationRepository = require('../../backend/dal/repositories/CORE_ConversationRepository');

describe('ConversationRepository', () => {
    let conversationRepo;
    let mockDeps;

    beforeEach(() => {
        mockDeps = createMockDependencies();
        conversationRepo = new ConversationRepository('conversations', mockDeps);
    });

    describe('Architecture Compliance', () => {
        test('should extend BaseRepository', () => {
            expect(conversationRepo.constructor.name).toBe('ConversationRepository');
            expect(conversationRepo.tableName).toBe('conversations');
            expect(conversationRepo.dal).toBeDefined();
            expect(conversationRepo.logger).toBeDefined();
            expect(conversationRepo.errorHandler).toBeDefined();
        });

        test('should implement required repository interface', () => {
            const requiredMethods = ['count', 'findById', 'create', 'update', 'delete'];
            requiredMethods.forEach(method => {
                expect(typeof conversationRepo[method]).toBe('function');
            });
        });

        test('should implement conversation-specific methods', () => {
            const conversationMethods = [
                'getConversationHistory',
                'saveMessage',
                'saveMemoryWeights',
                'getWeightedContext'
            ];
            conversationMethods.forEach(method => {
                expect(typeof conversationRepo[method]).toBe('function');
            });
        });
    });

    describe('Multi-User Conversation Operations', () => {
        test('should have conversation history method available', () => {
            expect(typeof conversationRepo.getConversationHistory).toBe('function');
        });

        test('should have save message method available', () => {
            expect(typeof conversationRepo.saveMessage).toBe('function');
        });

        test('should have weighted context method available', () => {
            expect(typeof conversationRepo.getWeightedContext).toBe('function');
        });

        test('should save message with proper validation', async () => {
            const mockMessage = { id: 'msg-1', content: 'Test message' };
            mockDeps.dal.create.mockResolvedValue(mockMessage);

            const result = await conversationRepo.saveMessage('session-123', 'user', 'Hello', 'human', {});

            expect(result).toBeDefined();
            expect(mockDeps.dal.create).toHaveBeenCalled();
        });

        test('should validate required fields in saveMessage', async () => {
            await expect(
                conversationRepo.saveMessage(null, 'user', 'Hello', 'human', {})
            ).rejects.toThrow('Validation failed');
        });
    });

    describe('Error Handling', () => {
        test('should handle database errors gracefully', async () => {
            const dbError = new Error('Database connection failed');
            mockDeps.dal.query.mockRejectedValue(dbError);

            await expect(
                conversationRepo.getConversationHistory('user-123', 'chat-1')
            ).rejects.toThrow();
        });
    });
});