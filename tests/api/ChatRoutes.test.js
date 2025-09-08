/**
 * Unit Tests for ChatRoutes API
 * 
 * CLEAN ARCHITECTURE TESTING:
 * - Tests API endpoint behavior
 * - Mocks service dependencies
 * - Validates request/response handling
 * - Tests error scenarios
 */

const { MockFactory } = require('../test-framework');

describe('ChatRoutes API', () => {
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

    it('should handle message endpoint successfully', async () => {
        // Create mock services
        const mockServiceFactory = createServiceFactory({
            llm: {
                generateResponse: jest.fn().mockResolvedValue({ content: 'Mock AI response' })
            },
            psychology: {
                getCharacterState: jest.fn().mockResolvedValue({ mood: 'happy', engagement: 'high', energy: 85 }),
                initializeCharacterState: jest.fn().mockResolvedValue({ mood: 'neutral', engagement: 'moderate', energy: 75 }),
                updateCharacterState: jest.fn().mockResolvedValue({ mood: 'happy', engagement: 'high', energy: 85 })
            },
            conversationAnalyzer: {},
            database: {
                getDAL: jest.fn().mockReturnValue({
                    conversations: {
                        saveMessage: jest.fn().mockResolvedValue('msg-123')
                    },
                    personalities: {
                        getCharacter: jest.fn().mockResolvedValue({
                            id: 'aria-1',
                            name: 'Aria',
                            description: 'Friendly AI assistant',
                            definition: 'Background info'
                        })
                    }
                })
            }
        });

        const ChatRoutes = require('../../backend/api/chatRoutes');
        const chatRoutes = new ChatRoutes(mockServiceFactory);

        // Mock Express request/response
        const req = {
            body: {
                message: 'Hello Aria!',
                sessionId: 'test-session-123',
                userId: 'user-1',
                characterId: 'aria-1'
            }
        };

        const res = {
            json: jest.fn(),
            status: jest.fn().mockReturnThis()
        };

        // Test the route handler
        const messageHandler = chatRoutes.router.stack.find(layer => 
            layer.route && layer.route.path === '/message' && layer.route.methods.post
        );
        
        expect(messageHandler).toBeDefined();
        
        await messageHandler.route.stack[0].handle(req, res);

        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: true,
                data: expect.objectContaining({
                    aiResponse: 'Mock AI response',
                    sessionId: 'test-session-123',
                    psychologyState: expect.any(Object)
                })
            })
        );
    });

    it('should validate message input', async () => {
        const mockServiceFactory = createServiceFactory({});
        const ChatRoutes = require('../../backend/api/chatRoutes');
        const chatRoutes = new ChatRoutes(mockServiceFactory);

        const req = { body: { message: '' } }; // Empty message
        const res = {
            json: jest.fn(),
            status: jest.fn().mockReturnThis()
        };

        const messageHandler = chatRoutes.router.stack.find(layer => 
            layer.route && layer.route.path === '/message' && layer.route.methods.post
        );

        await messageHandler.route.stack[0].handle(req, res);
        
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                error: 'Message is required'
            })
        );
    });

    it('should handle character not found error', async () => {
        const mockServiceFactory = createServiceFactory({
            database: {
                getDAL: jest.fn().mockReturnValue({
                    conversations: {
                        saveMessage: jest.fn().mockResolvedValue('msg-123')
                    },
                    personalities: {
                        getCharacter: jest.fn().mockResolvedValue(null) // Character not found
                    }
                })
            }
        });

        const ChatRoutes = require('../../backend/api/chatRoutes');
        const chatRoutes = new ChatRoutes(mockServiceFactory);

        const req = {
            body: {
                message: 'Hello!',
                characterId: 'nonexistent'
            }
        };

        const res = {
            json: jest.fn(),
            status: jest.fn().mockReturnThis()
        };

        const messageHandler = chatRoutes.router.stack.find(layer => 
            layer.route && layer.route.path === '/message' && layer.route.methods.post
        );

        await messageHandler.route.stack[0].handle(req, res);
        
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: false,
                error: 'Character not found'
            })
        );
    });

    it('should handle chat history endpoint', async () => {
        const mockMessages = [
            { id: 1, content: 'Hello', sender: 'user', timestamp: new Date() },
            { id: 2, content: 'Hi there!', sender: 'assistant', timestamp: new Date() }
        ];

        const mockServiceFactory = createServiceFactory({
            database: {
                getDAL: jest.fn().mockReturnValue({
                    conversations: {
                        query: jest.fn().mockResolvedValue(mockMessages)
                    }
                })
            }
        });

        const ChatRoutes = require('../../backend/api/chatRoutes');
        const chatRoutes = new ChatRoutes(mockServiceFactory);

        const req = {
            params: { sessionId: 'test-session' },
            query: { userId: 'user-1' }
        };

        const res = {
            json: jest.fn(),
            status: jest.fn().mockReturnThis()
        };

        const historyHandler = chatRoutes.router.stack.find(layer => 
            layer.route && layer.route.path === '/history/:sessionId' && layer.route.methods.get
        );

        await historyHandler.route.stack[0].handle(req, res);

        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: true,
                data: mockMessages
            })
        );
    });

    it('should handle psychology endpoint', async () => {
        const mockPsychology = {
            mood: 'happy',
            engagement: 'high',
            energy: 90,
            learningProgress: { patternsIdentified: 5, adaptationScore: 0.8 }
        };

        const mockServiceFactory = createServiceFactory({
            psychology: {
                getCharacterState: jest.fn().mockResolvedValue(mockPsychology)
            }
        });

        const ChatRoutes = require('../../backend/api/chatRoutes');
        const chatRoutes = new ChatRoutes(mockServiceFactory);

        const req = { params: { sessionId: 'test-session' } };
        const res = {
            json: jest.fn(),
            status: jest.fn().mockReturnThis()
        };

        const psychologyHandler = chatRoutes.router.stack.find(layer => 
            layer.route && layer.route.path === '/psychology/:sessionId' && layer.route.methods.get
        );

        await psychologyHandler.route.stack[0].handle(req, res);

        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: true,
                data: mockPsychology
            })
        );
    });

    it('should handle errors gracefully', async () => {
        const mockServiceFactory = createServiceFactory({
            llm: {
                generateResponse: jest.fn().mockRejectedValue(new Error('LLM service error'))
            },
            database: {
                getDAL: jest.fn().mockReturnValue({
                    conversations: {
                        saveMessage: jest.fn().mockResolvedValue('msg-123')
                    },
                    personalities: {
                        getCharacter: jest.fn().mockResolvedValue({ id: 'test', name: 'Test' })
                    }
                })
            },
            psychology: {
                getCharacterState: jest.fn().mockResolvedValue({ mood: 'neutral' }),
                updateCharacterState: jest.fn().mockResolvedValue({ mood: 'neutral' })
            }
        });

        const ChatRoutes = require('../../backend/api/chatRoutes');
        const chatRoutes = new ChatRoutes(mockServiceFactory);

        const req = {
            body: {
                message: 'Test message',
                sessionId: 'test-session',
                characterId: 'test'
            }
        };

        const res = {
            json: jest.fn(),
            status: jest.fn().mockReturnThis()
        };

        const messageHandler = chatRoutes.router.stack.find(layer => 
            layer.route && layer.route.path === '/message' && layer.route.methods.post
        );

        await messageHandler.route.stack[0].handle(req, res);
        
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                error: 'Failed to process message',
                details: 'LLM service error'
            })
        );
    });

    it('should set CORS headers', () => {
        const mockServiceFactory = createServiceFactory({});
        const ChatRoutes = require('../../backend/api/chatRoutes');
        const chatRoutes = new ChatRoutes(mockServiceFactory);

        const req = { method: 'GET' };
        const res = {
            header: jest.fn(),
            sendStatus: jest.fn()
        };
        const next = jest.fn();

        // Test CORS middleware (first middleware)
        const corsHandler = chatRoutes.router.stack[0];
        corsHandler.handle(req, res, next);

        expect(res.header).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'http://localhost:5173');
        expect(res.header).toHaveBeenCalledWith('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        expect(res.header).toHaveBeenCalledWith('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
        expect(next).toHaveBeenCalled();
    });
});