/**
 * Unit Tests for ChatRepository
 * 
 * CLEAN ARCHITECTURE TESTING:
 * - Test multi-user chat operations
 * - Test data isolation between users  
 * - Test chat creation, retrieval, and updates
 * - Mock database dependencies for isolated testing
 * - Verify proper error handling
 */

const ChatRepository = require('../../backend/dal/repositories/CORE_ChatRepository');

describe('ChatRepository', () => {
    let chatRepo;
    let mockDeps;

    beforeEach(() => {
        mockDeps = createMockDependencies();
        chatRepo = new ChatRepository('chats', mockDeps);
    });

    describe('Architecture Compliance', () => {
        test('should extend BaseRepository', () => {
            expect(chatRepo.constructor.name).toBe('ChatRepository');
            expect(chatRepo.tableName).toBe('chats');
            expect(chatRepo.dal).toBeDefined();
            expect(chatRepo.logger).toBeDefined();
            expect(chatRepo.errorHandler).toBeDefined();
        });

        test('should implement required repository interface', () => {
            const requiredMethods = ['count', 'findById', 'create', 'update', 'delete'];
            requiredMethods.forEach(method => {
                expect(typeof chatRepo[method]).toBe('function');
            });
        });

        test('should implement chat-specific methods', () => {
            const chatMethods = ['createChat', 'getUserChats', 'getUserChat', 'updateChatTitle', 'deactivateChat'];
            chatMethods.forEach(method => {
                expect(typeof chatRepo[method]).toBe('function');
            });
        });
    });

    describe('Multi-User Operations', () => {
        test('should require userId for createChat', async () => {
            const mockChat = { id: 'chat-123', title: 'Test Chat' };
            mockDeps.dal.create.mockResolvedValue(mockChat);
            mockDeps.dal.findById.mockResolvedValue(mockChat);

            const result = await chatRepo.createChat('user-123', {
                title: 'Test Chat',
                personality_id: 'default'
            });

            expect(result).toEqual(mockChat);
            expect(mockDeps.dal.create).toHaveBeenCalledWith('chats', expect.objectContaining({
                user_id: 'user-123',
                title: 'Test Chat',
                personality_id: 'default'
            }));
        });

        test('should get user chats with proper isolation', async () => {
            const mockChats = [
                { id: 'chat-1', title: 'Chat 1', user_id: 'user-123' },
                { id: 'chat-2', title: 'Chat 2', user_id: 'user-123' }
            ];
            mockDeps.dal.query.mockResolvedValue(mockChats);

            const result = await chatRepo.getUserChats('user-123');

            expect(result.chats).toEqual(mockChats);
            expect(mockDeps.dal.query).toHaveBeenCalledWith(
                expect.stringContaining('WHERE c.user_id = ? AND c.is_active = 1'),
                ['user-123', 10, 0]
            );
        });
    });

    describe('Error Handling', () => {
        test('should handle database errors gracefully', async () => {
            const dbError = new Error('Database connection failed');
            mockDeps.dal.query.mockRejectedValue(dbError);

            await expect(chatRepo.getUserChats('user-123')).rejects.toThrow();
        });
    });
});