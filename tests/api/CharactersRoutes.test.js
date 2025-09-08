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
            { id: '1', name: 'Aria', description: 'Friendly AI', is_active: true },
            { id: '2', name: 'Nova', description: 'Creative AI', is_active: true }
        ];

        const mockServiceFactory = createServiceFactory({
            database: {
                getDAL: jest.fn().mockReturnValue({
                    personalities: {
                        getAllCharacters: jest.fn().mockResolvedValue(mockCharacters)
                    }
                })
            }
        });

        const CharactersRoutes = require('../../backend/api/charactersRoutes');
        const charactersRoutes = new CharactersRoutes(mockServiceFactory);

        const req = {};
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
            definition: 'Background info'
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

        const req = { params: { characterId: 'aria-1' } };
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

        const req = { params: { characterId: 'nonexistent' } };
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
                    description: 'A test character'
                })
            })
        );
    });

    it('should validate required fields when creating character', async () => {
        const mockServiceFactory = createServiceFactory({});
        const CharactersRoutes = require('../../backend/api/charactersRoutes');
        const charactersRoutes = new CharactersRoutes(mockServiceFactory);

        const req = { body: { name: '' } }; // Empty name
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
            description: 'Original description' 
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
        const existingCharacter = { id: 'test-1', name: 'Test Character' };
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

        const req = { params: { characterId: 'test-1' } };
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

    it('should set CORS headers', () => {
        const mockServiceFactory = createServiceFactory({});
        const CharactersRoutes = require('../../backend/api/charactersRoutes');
        const charactersRoutes = new CharactersRoutes(mockServiceFactory);

        const req = { method: 'GET' };
        const res = {
            header: jest.fn(),
            sendStatus: jest.fn()
        };
        const next = jest.fn();

        // Test CORS middleware (first middleware)
        const corsHandler = charactersRoutes.router.stack[0];
        corsHandler.handle(req, res, next);

        expect(res.header).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'http://localhost:5173');
        expect(res.header).toHaveBeenCalledWith('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        expect(res.header).toHaveBeenCalledWith('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
        expect(next).toHaveBeenCalled();
    });
});