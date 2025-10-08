/**
 * Integration Tests for User-Character Isolation
 * 
 * CLEAN ARCHITECTURE TESTING:
 * - Tests complete user-character ownership and isolation
 * - Tests that users can only access their own characters
 * - Tests API-level enforcement of character ownership
 * - Tests database-level isolation for multi-user support
 */

const { setupServices } = require('../../setupServices');
const CharactersRoutes = require('../../backend/api/charactersRoutes');

describe('User-Character Isolation Integration', () => {
    let serviceFactory;
    let charactersRoutes;

    beforeEach(async () => {
        // Create fresh service factory for each test
        serviceFactory = await setupServices({
            dbPath: ':memory:',
            includeMetadata: false
        });

        // Create characters routes instance
        charactersRoutes = new CharactersRoutes(serviceFactory);
    });

    afterEach(async () => {
        if (serviceFactory) {
            await serviceFactory.shutdown();
            serviceFactory = null;
        }
    });

    it('Scenario A: User A creates character, User B cannot see it', async () => {
        const dal = serviceFactory.services.get('database').getDAL();

        // Step 1: User A creates character "Maria"
        const timestamp = Date.now();
        const userA = await dal.users.createUser({
            username: `user_a_${timestamp}`,
            email: `user_a_${timestamp}@test.com`,
            display_name: 'User A'
        });

        const characterData = {
            id: `maria_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
            name: 'Maria',
            description: 'A helpful assistant',
            user_id: userA.id
        };

        const character = await dal.personalities.createCharacter(characterData);

        // Step 2: Verify character has user_id = user-a
        expect(character).toBeDefined();
        expect(character.created).toBe(true);
        expect(character.id).toBe(characterData.id);

        // Fetch the created character to verify user_id
        const createdCharacter = await dal.personalities.getCharacter(character.id);
        expect(createdCharacter).toBeDefined();
        expect(createdCharacter.user_id).toBe(userA.id);
        expect(createdCharacter.name).toBe('Maria');

        // Step 3: User B fetches characters
        const userB = await dal.users.createUser({
            username: `user_b_${timestamp}`,
            email: `user_b_${timestamp}@test.com`,
            display_name: 'User B'
        });

        const userBCharacters = await dal.personalities.getUserCharacters(userB.id);

        // Step 4: Verify User B does NOT see Maria
        expect(userBCharacters).toEqual([]);
        expect(userBCharacters.length).toBe(0);

        // Step 5: Verify User A CAN see Maria
        const userACharacters = await dal.personalities.getUserCharacters(userA.id);
        expect(userACharacters.length).toBe(1);
        expect(userACharacters[0].id).toBe(character.id);
        expect(userACharacters[0].name).toBe('Maria');
    }, 15000);

    it('Scenario B: User B cannot access User A\'s character by ID', async () => {
        const dal = serviceFactory.services.get('database').getDAL();

        // Step 1: User A creates character
        const timestamp = Date.now();
        const userA = await dal.users.createUser({
            username: `user_a_access_${timestamp}`,
            email: `user_a_access_${timestamp}@test.com`,
            display_name: 'User A'
        });

        const characterData = {
            id: `character_a_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
            name: 'TestCharacter',
            description: 'User A character',
            user_id: userA.id
        };

        const character = await dal.personalities.createCharacter(characterData);

        // Step 2: User B tries to get character by ID via API
        const userB = await dal.users.createUser({
            username: `user_b_access_${timestamp}`,
            email: `user_b_access_${timestamp}@test.com`,
            display_name: 'User B'
        });

        // Mock API request
        const req = {
            params: { characterId: character.id },
            query: { userId: userB.id }
        };

        const res = {
            json: jest.fn(),
            status: jest.fn().mockReturnThis()
        };

        // Get the handler
        const getHandler = charactersRoutes.router.stack.find(layer => 
            layer.route && layer.route.path === '/:characterId' && layer.route.methods.get
        );

        await getHandler.route.stack[0].handle(req, res);

        // Step 3: Verify 404 response
        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({
            error: 'Character not found'
        });

        // Step 4: Verify User A CAN access their character
        const reqUserA = {
            params: { characterId: character.id },
            query: { userId: userA.id }
        };

        const resUserA = {
            json: jest.fn(),
            status: jest.fn().mockReturnThis()
        };

        await getHandler.route.stack[0].handle(reqUserA, resUserA);

        expect(resUserA.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: true,
                data: expect.objectContaining({
                    id: character.id,
                    name: 'TestCharacter'
                })
            })
        );
    }, 15000);

    it('Scenario C: User B cannot update User A\'s character', async () => {
        const dal = serviceFactory.services.get('database').getDAL();

        // Step 1: User A creates character
        const timestamp = Date.now();
        const userA = await dal.users.createUser({
            username: `user_a_update_${timestamp}`,
            email: `user_a_update_${timestamp}@test.com`,
            display_name: 'User A'
        });

        const characterData = {
            id: `character_update_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
            name: 'OriginalName',
            description: 'Original description',
            user_id: userA.id
        };

        const character = await dal.personalities.createCharacter(characterData);

        // Step 2: User B tries to update character
        const userB = await dal.users.createUser({
            username: `user_b_update_${timestamp}`,
            email: `user_b_update_${timestamp}@test.com`,
            display_name: 'User B'
        });

        // Mock API request
        const req = {
            params: { characterId: character.id },
            query: { userId: userB.id },
            body: {
                name: 'HackedName',
                description: 'Hacked description'
            }
        };

        const res = {
            json: jest.fn(),
            status: jest.fn().mockReturnThis()
        };

        // Get the PUT handler
        const putHandler = charactersRoutes.router.stack.find(layer => 
            layer.route && layer.route.path === '/:characterId' && layer.route.methods.put
        );

        await putHandler.route.stack[0].handle(req, res);

        // Step 3: Verify 404 response
        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({
            error: 'Character not found'
        });

        // Step 4: Verify character was NOT updated
        const unchangedCharacter = await dal.personalities.getCharacter(character.id);
        expect(unchangedCharacter.name).toBe('OriginalName');
        expect(unchangedCharacter.description).toBe('Original description');

        // Step 5: Verify User A CAN update their character
        const reqUserA = {
            params: { characterId: character.id },
            query: { userId: userA.id },
            body: {
                name: 'UpdatedName',
                description: 'Updated description'
            }
        };

        const resUserA = {
            json: jest.fn(),
            status: jest.fn().mockReturnThis()
        };

        await putHandler.route.stack[0].handle(reqUserA, resUserA);

        expect(resUserA.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: true,
                message: 'Character updated successfully'
            })
        );

        const updatedCharacter = await dal.personalities.getCharacter(character.id);
        expect(updatedCharacter.name).toBe('UpdatedName');
        expect(updatedCharacter.description).toBe('Updated description');
    }, 15000);

    it('Scenario D: User B cannot delete User A\'s character', async () => {
        const dal = serviceFactory.services.get('database').getDAL();

        // Step 1: User A creates character
        const timestamp = Date.now();
        const userA = await dal.users.createUser({
            username: `user_a_delete_${timestamp}`,
            email: `user_a_delete_${timestamp}@test.com`,
            display_name: 'User A'
        });

        const characterData = {
            id: `character_delete_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
            name: 'ToBeProtected',
            description: 'Should not be deletable by User B',
            user_id: userA.id
        };

        const character = await dal.personalities.createCharacter(characterData);

        // Step 2: User B tries to delete character
        const userB = await dal.users.createUser({
            username: `user_b_delete_${timestamp}`,
            email: `user_b_delete_${timestamp}@test.com`,
            display_name: 'User B'
        });

        // Mock API request
        const req = {
            params: { characterId: character.id },
            query: { userId: userB.id }
        };

        const res = {
            json: jest.fn(),
            status: jest.fn().mockReturnThis()
        };

        // Get the DELETE handler
        const deleteHandler = charactersRoutes.router.stack.find(layer => 
            layer.route && layer.route.path === '/:characterId' && layer.route.methods.delete
        );

        await deleteHandler.route.stack[0].handle(req, res);

        // Step 3: Verify 404 response
        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: false,
                error: 'Character not found'
            })
        );

        // Step 4: Verify character still exists
        const stillExists = await dal.personalities.getCharacter(character.id);
        expect(stillExists).toBeDefined();
        expect(stillExists.name).toBe('ToBeProtected');

        // Step 5: Verify User A CAN delete their character
        const reqUserA = {
            params: { characterId: character.id },
            query: { userId: userA.id }
        };

        const resUserA = {
            json: jest.fn(),
            status: jest.fn().mockReturnThis()
        };

        await deleteHandler.route.stack[0].handle(reqUserA, resUserA);

        expect(resUserA.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: true,
                message: 'Character deleted successfully'
            })
        );

        // Verify character is now deleted (soft delete - is_active = 0)
        const deletedCharacter = await dal.personalities.getCharacter(character.id);
        expect(deletedCharacter).toBeDefined();
        expect(deletedCharacter.is_active).toBe(0); // Soft delete sets is_active to 0
    }, 15000);

    it('Scenario E: Each user has independent characters with same name', async () => {
        const dal = serviceFactory.services.get('database').getDAL();

        const timestamp = Date.now();

        // Step 1: User A creates "Maria"
        const userA = await dal.users.createUser({
            username: `user_a_independent_${timestamp}`,
            email: `user_a_independent_${timestamp}@test.com`,
            display_name: 'User A'
        });

        const mariaA = await dal.personalities.createCharacter({
            id: `maria_a_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
            name: 'Maria',
            description: 'User A\'s Maria',
            user_id: userA.id
        });

        // Step 2: User B creates "Maria" (same name, different user)
        const userB = await dal.users.createUser({
            username: `user_b_independent_${timestamp}`,
            email: `user_b_independent_${timestamp}@test.com`,
            display_name: 'User B'
        });

        const mariaB = await dal.personalities.createCharacter({
            id: `maria_b_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
            name: 'Maria',
            description: 'User B\'s Maria',
            user_id: userB.id
        });

        // Step 3: Both users can access their own Maria
        const userACharacters = await dal.personalities.getUserCharacters(userA.id);
        expect(userACharacters.length).toBe(1);
        expect(userACharacters[0].id).toBe(mariaA.id);
        expect(userACharacters[0].name).toBe('Maria');
        expect(userACharacters[0].description).toBe('User A\'s Maria');

        const userBCharacters = await dal.personalities.getUserCharacters(userB.id);
        expect(userBCharacters.length).toBe(1);
        expect(userBCharacters[0].id).toBe(mariaB.id);
        expect(userBCharacters[0].name).toBe('Maria');
        expect(userBCharacters[0].description).toBe('User B\'s Maria');

        // Step 4: Neither can access the other's Maria via ownership check
        const userACannotAccessMariaB = await dal.personalities.getCharacter(mariaB.id, userA.id);
        expect(userACannotAccessMariaB).toBeNull();

        const userBCannotAccessMariaA = await dal.personalities.getCharacter(mariaA.id, userB.id);
        expect(userBCannotAccessMariaA).toBeNull();

        // Step 5: Verify they can access their own when explicitly checking ownership
        const userAAccessesOwnMaria = await dal.personalities.getCharacter(mariaA.id, userA.id);
        expect(userAAccessesOwnMaria).toBeDefined();
        expect(userAAccessesOwnMaria.id).toBe(mariaA.id);
        expect(userAAccessesOwnMaria.description).toBe('User A\'s Maria');

        const userBAccessesOwnMaria = await dal.personalities.getCharacter(mariaB.id, userB.id);
        expect(userBAccessesOwnMaria).toBeDefined();
        expect(userBAccessesOwnMaria.id).toBe(mariaB.id);
        expect(userBAccessesOwnMaria.description).toBe('User B\'s Maria');
    }, 15000);

    it('should handle multiple characters per user with complete isolation', async () => {
        const dal = serviceFactory.services.get('database').getDAL();

        const timestamp = Date.now();

        // Step 1: Create two users
        const userA = await dal.users.createUser({
            username: `user_a_multiple_${timestamp}`,
            email: `user_a_multiple_${timestamp}@test.com`,
            display_name: 'User A'
        });

        const userB = await dal.users.createUser({
            username: `user_b_multiple_${timestamp}`,
            email: `user_b_multiple_${timestamp}@test.com`,
            display_name: 'User B'
        });

        // Step 2: User A creates multiple characters
        const charA1 = await dal.personalities.createCharacter({
            id: `char_a1_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
            name: 'Character A1',
            user_id: userA.id
        });

        const charA2 = await dal.personalities.createCharacter({
            id: `char_a2_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
            name: 'Character A2',
            user_id: userA.id
        });

        const charA3 = await dal.personalities.createCharacter({
            id: `char_a3_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
            name: 'Character A3',
            user_id: userA.id
        });

        // Step 3: User B creates multiple characters
        const charB1 = await dal.personalities.createCharacter({
            id: `char_b1_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
            name: 'Character B1',
            user_id: userB.id
        });

        const charB2 = await dal.personalities.createCharacter({
            id: `char_b2_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
            name: 'Character B2',
            user_id: userB.id
        });

        // Step 4: Verify User A sees only their characters
        const userACharacters = await dal.personalities.getUserCharacters(userA.id);
        expect(userACharacters.length).toBe(3);
        const userAIds = userACharacters.map(c => c.id);
        expect(userAIds).toContain(charA1.id);
        expect(userAIds).toContain(charA2.id);
        expect(userAIds).toContain(charA3.id);
        expect(userAIds).not.toContain(charB1.id);
        expect(userAIds).not.toContain(charB2.id);

        // Step 5: Verify User B sees only their characters
        const userBCharacters = await dal.personalities.getUserCharacters(userB.id);
        expect(userBCharacters.length).toBe(2);
        const userBIds = userBCharacters.map(c => c.id);
        expect(userBIds).toContain(charB1.id);
        expect(userBIds).toContain(charB2.id);
        expect(userBIds).not.toContain(charA1.id);
        expect(userBIds).not.toContain(charA2.id);
        expect(userBIds).not.toContain(charA3.id);

        // Step 6: Verify cross-user access is blocked
        expect(await dal.personalities.getCharacter(charB1.id, userA.id)).toBeNull();
        expect(await dal.personalities.getCharacter(charB2.id, userA.id)).toBeNull();
        expect(await dal.personalities.getCharacter(charA1.id, userB.id)).toBeNull();
        expect(await dal.personalities.getCharacter(charA2.id, userB.id)).toBeNull();
        expect(await dal.personalities.getCharacter(charA3.id, userB.id)).toBeNull();
    }, 15000);

    it('should handle error recovery for isolation violations', async () => {
        const dal = serviceFactory.services.get('database').getDAL();

        // Test getting character with non-existent user
        const nonExistentChar = await dal.personalities.getCharacter('fake-char-id', 'fake-user-id');
        expect(nonExistentChar).toBeNull();

        // Test getting characters for user with no characters
        const noCharacters = await dal.personalities.getUserCharacters('fake-user-id');
        expect(noCharacters).toEqual([]);

        // Verify system remains functional after errors
        const timestamp = Date.now();
        const user = await dal.users.createUser({
            username: `error_recovery_${timestamp}`,
            email: `error_${timestamp}@test.com`
        });

        expect(user).toBeDefined();

        // Verify character creation still works
        const character = await dal.personalities.createCharacter({
            id: `recovery_char_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
            name: 'Recovery Character',
            user_id: user.id
        });

        expect(character).toBeDefined();
        expect(character.created).toBe(true);
    }, 10000);
});
