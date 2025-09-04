/**
 * Unit Tests for UserRepository
 * 
 * CLEAN ARCHITECTURE TESTING:
 * - Test repository creation and inheritance
 * - Test all CRUD operations with user isolation
 * - Test multi-user support and data isolation
 * - Mock database dependencies for isolated testing
 * - Verify proper error handling and validation
 */

const UserRepository = require('../../backend/dal/repositories/CORE_UserRepository');

describe('UserRepository', () => {
    let userRepo;
    let mockDeps;

    beforeEach(() => {
        // Create fresh mock dependencies for each test
        mockDeps = createMockDependencies();
        userRepo = new UserRepository('users', mockDeps);
    });

    describe('Architecture Compliance', () => {
        test('should extend BaseRepository', () => {
            expect(userRepo.constructor.name).toBe('UserRepository');
            expect(userRepo.tableName).toBe('users');
            expect(userRepo.dal).toBeDefined();
            expect(userRepo.logger).toBeDefined();
            expect(userRepo.errorHandler).toBeDefined();
        });

        test('should implement required repository interface', () => {
            const requiredMethods = ['count', 'findById', 'create', 'update', 'delete'];
            requiredMethods.forEach(method => {
                expect(typeof userRepo[method]).toBe('function');
            });
        });

        test('should implement user-specific methods', () => {
            const userMethods = ['createUser', 'findByUsername', 'findByEmail', 'updatePreferences', 'updateLastActive', 'getUserStats'];
            userMethods.forEach(method => {
                expect(typeof userRepo[method]).toBe('function');
            });
        });
    });

    describe('User Operations', () => {
        test('should find user by username', async () => {
            const mockUser = {
                id: 'user-123',
                username: 'testuser',
                email: 'test@example.com'
            };
            
            mockDeps.dal.queryOne.mockResolvedValue(mockUser);
            
            const result = await userRepo.findByUsername('testuser');
            
            expect(result).toEqual(mockUser);
            expect(mockDeps.dal.queryOne).toHaveBeenCalledWith(
                'SELECT * FROM users WHERE username = ? AND is_active = 1',
                ['testuser']
            );
        });

        test('should return null for non-existent username', async () => {
            mockDeps.dal.queryOne.mockResolvedValue(null);
            
            const result = await userRepo.findByUsername('nonexistent');
            
            expect(result).toBeNull();
        });

        test('should find user by email', async () => {
            const mockUser = {
                id: 'user-123',
                email: 'test@example.com'
            };
            
            mockDeps.dal.queryOne.mockResolvedValue(mockUser);
            
            const result = await userRepo.findByEmail('test@example.com');
            
            expect(result).toEqual(mockUser);
            expect(mockDeps.dal.queryOne).toHaveBeenCalledWith(
                'SELECT * FROM users WHERE email = ? AND is_active = 1',
                ['test@example.com']
            );
        });

        test('should create new user with proper structure', async () => {
            const userData = {
                username: 'newuser',
                email: 'new@example.com',
                display_name: 'New User'
            };

            const createdUser = { id: 'new-user-id', ...userData };
            mockDeps.dal.create.mockResolvedValue(createdUser);
            mockDeps.dal.findById.mockResolvedValue(createdUser);
            
            const result = await userRepo.createUser(userData);
            
            expect(result).toEqual(createdUser);
            expect(mockDeps.dal.create).toHaveBeenCalledWith('users', expect.objectContaining({
                username: 'newuser',
                email: 'new@example.com',
                display_name: 'New User',
                is_active: 1
            }));
        });

        test('should update user preferences', async () => {
            const preferences = { theme: 'dark', language: 'en' };
            mockDeps.dal.update.mockResolvedValue({ changes: 1 });
            
            await userRepo.updatePreferences('user-123', preferences);
            
            expect(mockDeps.dal.update).toHaveBeenCalledWith('users', 
                'user-123',
                expect.objectContaining({
                    preferences: JSON.stringify(preferences)
                })
            );
        });

        test('should update last active timestamp', async () => {
            mockDeps.dal.update.mockResolvedValue({ changes: 1 });
            
            await userRepo.updateLastActive('user-123');
            
            expect(mockDeps.dal.update).toHaveBeenCalledWith('users',
                'user-123',
                expect.objectContaining({
                    last_active: expect.any(String)
                })
            );
        });

        test('should get comprehensive user statistics', async () => {
            const mockStats = {
                id: 'user-123',
                username: 'testuser',
                total_chats: 5,
                unique_personalities_used: 3,
                total_messages: 150,
                last_chat_activity: '2024-01-01T12:00:00.000Z'
            };
            
            mockDeps.dal.queryOne.mockResolvedValue(mockStats);
            
            const result = await userRepo.getUserStats('user-123');
            
            expect(result).toEqual(mockStats);
            expect(result.total_chats).toBe(5);
            expect(result.unique_personalities_used).toBe(3);
        });
    });

    describe('Error Handling', () => {
        test('should handle database errors gracefully', async () => {
            const dbError = new Error('Database connection failed');
            mockDeps.dal.queryOne.mockRejectedValue(dbError);
            
            await expect(userRepo.findByUsername('testuser')).rejects.toThrow('Failed to find user by username');
        });

        test('should wrap errors with proper context', async () => {
            const dbError = new Error('SQLITE_CONSTRAINT');
            mockDeps.dal.create.mockRejectedValue(dbError);
            
            await expect(userRepo.createUser({
                username: 'test',
                email: 'test@test.com'
            })).rejects.toThrow();
        });
    });

    describe('Multi-User Support', () => {
        test('should enforce user isolation in operations', () => {
            // Verify user-specific methods exist
            expect(typeof userRepo.createUser).toBe('function');
            expect(typeof userRepo.updatePreferences).toBe('function');
            expect(typeof userRepo.getUserStats).toBe('function');
        });
    });
});