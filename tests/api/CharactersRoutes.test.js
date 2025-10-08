/**
 * Unit Tests for CharactersRoutes API
 * 
 * CLEAN ARCHITECTURE TESTING:
 * - Tests API endpoint behavior
 * - Mocks service dependencies
 * - Validates CRUD operations
 * - Tests error scenarios
 */

const { MockFactory } = require('../test-framework');

describe('CharactersRoutes API', () => {
    let mockFactory;

    beforeEach(() => {
        mockFactory = new MockFactory();
    });

    // Helper function to create mock service factory
    const createServiceFactory = (services = {}) => {
        const mockServices = new Map();
        
        Object.keys(services).forEach(key => {
            mockServices.set(key, services[key]);
        });

        return {
            get: (serviceName) => mockServices.get(serviceName),
            services: mockServices
        };
    };

    it('should get all characters', async () => {
        const mockCharacters = [
            { id: '1', name: 'Aria', description: 'Friendly AI', is_active: true, user_id: 'test-user' },
            { id: '2', name: 'Nova', description: 'Creative AI', is_active: true, user_id: 'test-user' }
        ];

        const mockServiceFactory = createServiceFactory({
            database: {
                getDAL: jest.fn().mockReturnValue({
                    personalities: {
                        getUserCharacters: jest.fn().mockResolvedValue(mockCharacters)
                    }
                })
            }
        });

        const CharactersRoutes = require('../../backend/api/charactersRoutes');
        const charactersRoutes = new CharactersRoutes(mockServiceFactory);

        const req = {
            query: { userId: 'test-user' }
        };
        const res = {
            json: jest.fn(),
            status: jest.fn().mockReturnThis()
        };

        const getAllHandler = charactersRoutes.router.stack.find(layer => 
            layer.route && layer.route.path === '/' && layer.route.methods.get
        );

        await getAllHandler.route.stack[0].handle(req, res);

        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: true,
                data: mockCharacters
            })
        );
    });

    it('should get specific character', async () => {
        const mockCharacter = { 
            id: 'aria-1', 
            name: 'Aria', 
            description: 'Friendly AI assistant',
            definition: 'Background info',
            user_id: 'test-user'
        };

        const mockServiceFactory = createServiceFactory({
            database: {
                getDAL: jest.fn().mockReturnValue({
                    personalities: {
                        getCharacter: jest.fn().mockResolvedValue(mockCharacter)
                    }
                })
            }
        });

        const CharactersRoutes = require('../../backend/api/charactersRoutes');
        const charactersRoutes = new CharactersRoutes(mockServiceFactory);

        const req = { 
            params: { characterId: 'aria-1' },
            query: { userId: 'test-user' }
        };
        const res = {
            json: jest.fn(),
            status: jest.fn().mockReturnThis()
        };

        const getOneHandler = charactersRoutes.router.stack.find(layer => 
            layer.route && layer.route.path === '/:characterId' && layer.route.methods.get
        );

        await getOneHandler.route.stack[0].handle(req, res);

        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: true,
                data: mockCharacter
            })
        );
    });

    it('should return 404 for nonexistent character', async () => {
        const mockServiceFactory = createServiceFactory({
            database: {
                getDAL: jest.fn().mockReturnValue({
                    personalities: {
                        getCharacter: jest.fn().mockResolvedValue(null)
                    }
                })
            }
        });

        const CharactersRoutes = require('../../backend/api/charactersRoutes');
        const charactersRoutes = new CharactersRoutes(mockServiceFactory);

        const req = { 
            params: { characterId: 'nonexistent' },
            query: { userId: 'test-user' }
        };
        const res = {
            json: jest.fn(),
            status: jest.fn().mockReturnThis()
        };

        const getOneHandler = charactersRoutes.router.stack.find(layer => 
            layer.route && layer.route.path === '/:characterId' && layer.route.methods.get
        );

        await getOneHandler.route.stack[0].handle(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                error: 'Character not found'
            })
        );
    });

    it('should create new character', async () => {
        const createdCharacter = { id: 'new-char', created_at: new Date(), updated_at: new Date() };

        const mockServiceFactory = createServiceFactory({
            database: {
                getDAL: jest.fn().mockReturnValue({
                    personalities: {
                        createCharacter: jest.fn().mockResolvedValue(createdCharacter)
                    }
                })
            }
        });

        const CharactersRoutes = require('../../backend/api/charactersRoutes');
        const charactersRoutes = new CharactersRoutes(mockServiceFactory);

        const req = {
            query: { userId: 'test-user' },
            body: {
                name: 'Test Character',
                description: 'A test character',
                background: 'Test background',
                avatar: 'test-avatar.jpg'
            }
        };

        const res = {
            json: jest.fn(),
            status: jest.fn().mockReturnThis()
        };

        const createHandler = charactersRoutes.router.stack.find(layer => 
            layer.route && layer.route.path === '/' && layer.route.methods.post
        );

        await createHandler.route.stack[0].handle(req, res);

        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: true,
                message: 'Character created successfully',
                data: expect.objectContaining({
                    name: 'Test Character',
                    description: 'A test character',
                    user_id: 'test-user'
                })
            })
        );
    });

    it('should validate required fields when creating character', async () => {
        const mockServiceFactory = createServiceFactory({});
        const CharactersRoutes = require('../../backend/api/charactersRoutes');
        const charactersRoutes = new CharactersRoutes(mockServiceFactory);

        const req = { 
            query: { userId: 'test-user' },
            body: { name: '' } // Empty name
        };
        const res = {
            json: jest.fn(),
            status: jest.fn().mockReturnThis()
        };

        const createHandler = charactersRoutes.router.stack.find(layer => 
            layer.route && layer.route.path === '/' && layer.route.methods.post
        );

        await createHandler.route.stack[0].handle(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                error: 'Character name is required'
            })
        );
    });

    it('should update existing character', async () => {
        const existingCharacter = { 
            id: 'test-1', 
            name: 'Original Name', 
            description: 'Original description',
            user_id: 'test-user'
        };
        
        const updateResult = { updated_at: new Date() };

        const mockServiceFactory = createServiceFactory({
            database: {
                getDAL: jest.fn().mockReturnValue({
                    personalities: {
                        getCharacter: jest.fn().mockResolvedValue(existingCharacter),
                        updateCharacter: jest.fn().mockResolvedValue(updateResult)
                    }
                })
            }
        });

        const CharactersRoutes = require('../../backend/api/charactersRoutes');
        const charactersRoutes = new CharactersRoutes(mockServiceFactory);

        const req = {
            params: { characterId: 'test-1' },
            query: { userId: 'test-user' },
            body: {
                name: 'Updated Name',
                description: 'Updated description'
            }
        };

        const res = {
            json: jest.fn(),
            status: jest.fn().mockReturnThis()
        };

        const updateHandler = charactersRoutes.router.stack.find(layer => 
            layer.route && layer.route.path === '/:characterId' && layer.route.methods.put
        );

        await updateHandler.route.stack[0].handle(req, res);

        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: true,
                message: 'Character updated successfully'
            })
        );
    });

    it('should return 404 when updating nonexistent character', async () => {
        const mockServiceFactory = createServiceFactory({
            database: {
                getDAL: jest.fn().mockReturnValue({
                    personalities: {
                        getCharacter: jest.fn().mockResolvedValue(null)
                    }
                })
            }
        });

        const CharactersRoutes = require('../../backend/api/charactersRoutes');
        const charactersRoutes = new CharactersRoutes(mockServiceFactory);

        const req = {
            params: { characterId: 'nonexistent' },
            query: { userId: 'test-user' },
            body: { name: 'Updated Name' }
        };

        const res = {
            json: jest.fn(),
            status: jest.fn().mockReturnThis()
        };

        const updateHandler = charactersRoutes.router.stack.find(layer => 
            layer.route && layer.route.path === '/:characterId' && layer.route.methods.put
        );

        await updateHandler.route.stack[0].handle(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                error: 'Character not found'
            })
        );
    });

    it('should delete character', async () => {
        const existingCharacter = { id: 'test-1', name: 'Test Character', user_id: 'test-user' };
        const deleteResult = { deleted: true };

        const mockServiceFactory = createServiceFactory({
            database: {
                getDAL: jest.fn().mockReturnValue({
                    personalities: {
                        getCharacter: jest.fn().mockResolvedValue(existingCharacter),
                        deleteCharacter: jest.fn().mockResolvedValue(deleteResult)
                    }
                })
            }
        });

        const CharactersRoutes = require('../../backend/api/charactersRoutes');
        const charactersRoutes = new CharactersRoutes(mockServiceFactory);

        const req = { 
            params: { characterId: 'test-1' },
            query: { userId: 'test-user' }
        };
        const res = {
            json: jest.fn(),
            status: jest.fn().mockReturnThis()
        };

        const deleteHandler = charactersRoutes.router.stack.find(layer => 
            layer.route && layer.route.path === '/:characterId' && layer.route.methods.delete
        );

        await deleteHandler.route.stack[0].handle(req, res);

        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: true,
                message: 'Character deleted successfully'
            })
        );
    });

    describe('User Isolation', () => {
        it('should return only user\'s characters in GET /', async () => {
            const user1Characters = [
                { id: 'char-1', name: 'User1 Character', user_id: 'user-1' }
            ];

            const mockServiceFactory = createServiceFactory({
                database: {
                    getDAL: jest.fn().mockReturnValue({
                        personalities: {
                            getUserCharacters: jest.fn().mockResolvedValue(user1Characters)
                        }
                    })
                }
            });

            const CharactersRoutes = require('../../backend/api/charactersRoutes');
            const charactersRoutes = new CharactersRoutes(mockServiceFactory);

            const req = { query: { userId: 'user-1' } };
            const res = {
                json: jest.fn(),
                status: jest.fn().mockReturnThis()
            };

            const getAllHandler = charactersRoutes.router.stack.find(layer => 
                layer.route && layer.route.path === '/' && layer.route.methods.get
            );

            await getAllHandler.route.stack[0].handle(req, res);

            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    data: user1Characters
                })
            );
        });

        it('should return 404 when GET /:characterId with wrong user', async () => {
            const character = { id: 'char-1', name: 'Test', user_id: 'user-1' };

            const mockServiceFactory = createServiceFactory({
                database: {
                    getDAL: jest.fn().mockReturnValue({
                        personalities: {
                            getCharacter: jest.fn().mockResolvedValue(character)
                        }
                    })
                }
            });

            const CharactersRoutes = require('../../backend/api/charactersRoutes');
            const charactersRoutes = new CharactersRoutes(mockServiceFactory);

            const req = { 
                params: { characterId: 'char-1' },
                query: { userId: 'user-2' } // Different user
            };
            const res = {
                json: jest.fn(),
                status: jest.fn().mockReturnThis()
            };

            const getOneHandler = charactersRoutes.router.stack.find(layer => 
                layer.route && layer.route.path === '/:characterId' && layer.route.methods.get
            );

            await getOneHandler.route.stack[0].handle(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: 'Character not found'
                })
            );
        });

        it('should return 404 when PUT /:characterId with wrong user', async () => {
            const character = { id: 'char-1', name: 'Test', user_id: 'user-1' };

            const mockServiceFactory = createServiceFactory({
                database: {
                    getDAL: jest.fn().mockReturnValue({
                        personalities: {
                            getCharacter: jest.fn().mockResolvedValue(character)
                        }
                    })
                }
            });

            const CharactersRoutes = require('../../backend/api/charactersRoutes');
            const charactersRoutes = new CharactersRoutes(mockServiceFactory);

            const req = { 
                params: { characterId: 'char-1' },
                query: { userId: 'user-2' }, // Different user
                body: { name: 'Updated' }
            };
            const res = {
                json: jest.fn(),
                status: jest.fn().mockReturnThis()
            };

            const updateHandler = charactersRoutes.router.stack.find(layer => 
                layer.route && layer.route.path === '/:characterId' && layer.route.methods.put
            );

            await updateHandler.route.stack[0].handle(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: 'Character not found'
                })
            );
        });

        it('should return 404 when DELETE /:characterId with wrong user', async () => {
            const character = { id: 'char-1', name: 'Test', user_id: 'user-1' };

            const mockServiceFactory = createServiceFactory({
                database: {
                    getDAL: jest.fn().mockReturnValue({
                        personalities: {
                            getCharacter: jest.fn().mockResolvedValue(character)
                        }
                    })
                }
            });

            const CharactersRoutes = require('../../backend/api/charactersRoutes');
            const charactersRoutes = new CharactersRoutes(mockServiceFactory);

            const req = { 
                params: { characterId: 'char-1' },
                query: { userId: 'user-2' } // Different user
            };
            const res = {
                json: jest.fn(),
                status: jest.fn().mockReturnThis()
            };

            const deleteHandler = charactersRoutes.router.stack.find(layer => 
                layer.route && layer.route.path === '/:characterId' && layer.route.methods.delete
            );

            await deleteHandler.route.stack[0].handle(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: 'Character not found'
                })
            );
        });
    });

    describe('Missing userId', () => {
        it('should return 400 for GET / without userId', async () => {
            const mockServiceFactory = createServiceFactory({});
            const CharactersRoutes = require('../../backend/api/charactersRoutes');
            const charactersRoutes = new CharactersRoutes(mockServiceFactory);

            const req = { 
                query: {},
                headers: {} // No userId in query or headers
            };
            const res = {
                json: jest.fn(),
                status: jest.fn().mockReturnThis()
            };

            const getAllHandler = charactersRoutes.router.stack.find(layer => 
                layer.route && layer.route.path === '/' && layer.route.methods.get
            );

            await getAllHandler.route.stack[0].handle(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: 'userId required'
                })
            );
        });

        it('should return 400 for POST / without userId', async () => {
            const mockServiceFactory = createServiceFactory({});
            const CharactersRoutes = require('../../backend/api/charactersRoutes');
            const charactersRoutes = new CharactersRoutes(mockServiceFactory);

            const req = { 
                query: {},
                headers: {}, // No userId in query or headers
                body: { name: 'Test' }
            };
            const res = {
                json: jest.fn(),
                status: jest.fn().mockReturnThis()
            };

            const createHandler = charactersRoutes.router.stack.find(layer => 
                layer.route && layer.route.path === '/' && layer.route.methods.post
            );

            await createHandler.route.stack[0].handle(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: 'userId required'
                })
            );
        });
    });
});