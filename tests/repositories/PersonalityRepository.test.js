/**
 * Unit Tests for PersonalityRepository
 * 
 * CLEAN ARCHITECTURE TESTING:
 * - Test personality data management
 * - Test basic repository operations
 * - Test database access patterns
 * - Mock database dependencies for isolated testing
 */

const PersonalityRepository = require('../../backend/dal/repositories/CORE_PersonalityRepository');

describe('PersonalityRepository', () => {
    let personalityRepo;
    let mockDeps;

    beforeEach(() => {
        mockDeps = createMockDependencies();
        personalityRepo = new PersonalityRepository('personalities', mockDeps);
    });

    describe('Architecture Compliance', () => {
        test('should extend BaseRepository', () => {
            expect(personalityRepo.constructor.name).toBe('PersonalityRepository');
            expect(personalityRepo.tableName).toBe('personalities');
            expect(personalityRepo.dal).toBeDefined();
            expect(personalityRepo.logger).toBeDefined();
            expect(personalityRepo.errorHandler).toBeDefined();
        });

        test('should implement required repository interface', () => {
            const requiredMethods = ['count', 'findById', 'create', 'update', 'delete'];
            requiredMethods.forEach(method => {
                expect(typeof personalityRepo[method]).toBe('function');
            });
        });
    });

    describe('Basic Repository Operations', () => {
        test('should find personality by id', async () => {
            const mockPersonality = { id: 'pers-1', name: 'Assistant' };
            mockDeps.dal.findById.mockResolvedValue(mockPersonality);

            const result = await personalityRepo.findById('pers-1');

            expect(result).toEqual(mockPersonality);
            expect(mockDeps.dal.findById).toHaveBeenCalledWith('personalities', 'pers-1');
        });

        test('should count personalities', async () => {
            mockDeps.dal.count.mockResolvedValue(3);

            const result = await personalityRepo.count();

            expect(result).toBe(3);
            expect(mockDeps.dal.count).toHaveBeenCalledWith('personalities', {});
        });

        test('should have basic CRUD methods available', () => {
            expect(typeof personalityRepo.create).toBe('function');
            expect(typeof personalityRepo.update).toBe('function');
            expect(typeof personalityRepo.delete).toBe('function');
        });
    });

    describe('Error Handling', () => {
        test('should handle database errors gracefully', async () => {
            const dbError = new Error('Database connection failed');
            mockDeps.dal.findById.mockRejectedValue(dbError);

            await expect(personalityRepo.findById('pers-1')).rejects.toThrow();
        });
    });

    describe('User Isolation', () => {
        test('getUserCharacters returns only user\'s characters', async () => {
            const mockCharacters = [
                { id: 'char-1', name: 'Character 1', user_id: 'user-1', is_active: 1 },
                { id: 'char-2', name: 'Character 2', user_id: 'user-1', is_active: 1 }
            ];
            mockDeps.dal.findAll.mockResolvedValue(mockCharacters);

            const result = await personalityRepo.getUserCharacters('user-1');

            expect(result).toEqual(mockCharacters);
            expect(mockDeps.dal.findAll).toHaveBeenCalledWith(
                'personalities',
                { user_id: 'user-1', is_active: 1 },
                'created_at DESC',
                1000
            );
        });

        test('getUserCharacters with different userId returns different set', async () => {
            // First call for user-1
            const user1Characters = [
                { id: 'char-1', name: 'Character 1', user_id: 'user-1', is_active: 1 }
            ];
            mockDeps.dal.findAll.mockResolvedValueOnce(user1Characters);

            const result1 = await personalityRepo.getUserCharacters('user-1');
            expect(result1).toEqual(user1Characters);

            // Second call for user-2
            const user2Characters = [
                { id: 'char-3', name: 'Character 3', user_id: 'user-2', is_active: 1 }
            ];
            mockDeps.dal.findAll.mockResolvedValueOnce(user2Characters);

            const result2 = await personalityRepo.getUserCharacters('user-2');
            expect(result2).toEqual(user2Characters);

            // Verify both calls were made with different user IDs
            expect(mockDeps.dal.findAll).toHaveBeenNthCalledWith(1,
                'personalities',
                { user_id: 'user-1', is_active: 1 },
                'created_at DESC',
                1000
            );
            expect(mockDeps.dal.findAll).toHaveBeenNthCalledWith(2,
                'personalities',
                { user_id: 'user-2', is_active: 1 },
                'created_at DESC',
                1000
            );
        });

        test('createCharacter requires user_id', async () => {
            const characterDataWithoutUserId = {
                id: 'char-1',
                name: 'Test Character',
                description: 'Test'
            };

            // Mock validateRequiredFields to throw error when user_id is missing
            await expect(
                personalityRepo.createCharacter(characterDataWithoutUserId)
            ).rejects.toThrow();
        });

        test('createCharacter sets user_id correctly', async () => {
            const characterData = {
                id: 'char-1',
                name: 'Test Character',
                user_id: 'user-1',
                description: 'Test description'
            };

            mockDeps.dal.create.mockResolvedValue({ id: 'char-1' });

            const result = await personalityRepo.createCharacter(characterData);

            expect(result.created).toBe(true);
            expect(result.id).toBe('char-1');
            expect(mockDeps.dal.create).toHaveBeenCalled();
            
            // Verify user_id was included in the data passed to create
            const createCall = mockDeps.dal.create.mock.calls[0];
            expect(createCall[1]).toMatchObject({
                id: 'char-1',
                name: 'Test Character',
                user_id: 'user-1'
            });
        });

        test('getUserCharacters returns empty array when user has no characters', async () => {
            mockDeps.dal.findAll.mockResolvedValue([]);

            const result = await personalityRepo.getUserCharacters('user-999');

            expect(result).toEqual([]);
            expect(mockDeps.dal.findAll).toHaveBeenCalledWith(
                'personalities',
                { user_id: 'user-999', is_active: 1 },
                'created_at DESC',
                1000
            );
        });

        test('getUserCharacters validates userId parameter', async () => {
            await expect(
                personalityRepo.getUserCharacters(null)
            ).rejects.toThrow();

            await expect(
                personalityRepo.getUserCharacters(undefined)
            ).rejects.toThrow();
        });
    });

    describe('Ownership Verification', () => {
        test('getCharacter with userId check returns character if owned', async () => {
            const mockCharacter = {
                id: 'char-1',
                name: 'Test Character',
                user_id: 'user-1',
                is_active: 1
            };
            mockDeps.dal.findById.mockResolvedValue(mockCharacter);

            const result = await personalityRepo.getCharacter('char-1', 'user-1');

            expect(result).toEqual(mockCharacter);
            expect(mockDeps.dal.findById).toHaveBeenCalledWith('personalities', 'char-1');
        });

        test('getCharacter returns null if wrong user', async () => {
            const mockCharacter = {
                id: 'char-1',
                name: 'Test Character',
                user_id: 'user-1',
                is_active: 1
            };
            mockDeps.dal.findById.mockResolvedValue(mockCharacter);

            const result = await personalityRepo.getCharacter('char-1', 'user-2');

            expect(result).toBeNull();
            expect(mockDeps.dal.findById).toHaveBeenCalledWith('personalities', 'char-1');
            expect(mockDeps.logger.warn).toHaveBeenCalledWith(
                'User attempted to access character they do not own',
                'PersonalityRepository',
                expect.objectContaining({
                    characterId: 'char-1',
                    userId: 'user-2',
                    ownerId: 'user-1'
                })
            );
        });

        test('getCharacter returns null if character not found', async () => {
            mockDeps.dal.findById.mockResolvedValue(null);

            const result = await personalityRepo.getCharacter('char-999', 'user-1');

            expect(result).toBeNull();
            expect(mockDeps.dal.findById).toHaveBeenCalledWith('personalities', 'char-999');
        });

        test('getCharacter works without userId check (backwards compatibility)', async () => {
            const mockCharacter = {
                id: 'char-1',
                name: 'Test Character',
                user_id: 'user-1',
                is_active: 1
            };
            mockDeps.dal.findById.mockResolvedValue(mockCharacter);

            // Call without userId parameter
            const result = await personalityRepo.getCharacter('char-1');

            expect(result).toEqual(mockCharacter);
            expect(mockDeps.dal.findById).toHaveBeenCalledWith('personalities', 'char-1');
        });

        test('getCharacter validates characterId parameter', async () => {
            await expect(
                personalityRepo.getCharacter(null)
            ).rejects.toThrow();

            await expect(
                personalityRepo.getCharacter(undefined)
            ).rejects.toThrow();
        });
    });
});