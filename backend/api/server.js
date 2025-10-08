const express = require('express');
const cors = require('cors');
const ChatRoutes = require('./chatRoutes');
const SettingsRoutes = require('./settingsRoutes');
const CharactersRoutes = require('./charactersRoutes');
const ProactiveRoutes = require('./proactiveRoutes');
const LLMSettingsRoutes = require('./llmSettingsRoutes');
const CommitmentRoutes = require('./commitmentRoutes');
const EventRoutes = require('./eventRoutes');
const { setupWebSocketServer } = require('./websocket');

class APIServer {
    constructor(serviceFactory, port = 3001) {
        this.app = express();
        this.serviceFactory = serviceFactory;
        this.port = port;
        this.server = null;
        this.wss = null;
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        // Enable CORS for frontend
        this.app.use(cors({
            origin: 'http://localhost:5173',
            credentials: true
        }));

        // Parse JSON bodies
        this.app.use(express.json());

        // Basic logging
        this.app.use((req, res, next) => {
            console.log(`[API] ${req.method} ${req.path}`);
            next();
        });
    }

    setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({ 
                status: 'healthy', 
                timestamp: new Date().toISOString(),
                services: this.serviceFactory.getServiceNames()
            });
        });

        // Chat routes
        const chatRoutes = new ChatRoutes(this.serviceFactory);
        this.app.use('/api/chat', chatRoutes.getRouter());

        // Settings routes
        const settingsRoutes = new SettingsRoutes(this.serviceFactory);
        this.app.use('/api/settings', settingsRoutes.getRouter());

        // Characters routes
        const charactersRoutes = new CharactersRoutes(this.serviceFactory);
        this.app.use('/api/characters', charactersRoutes.getRouter());

        // Proactive routes
        const proactiveRoutes = new ProactiveRoutes(this.serviceFactory);
        this.app.use('/api/proactive', proactiveRoutes.getRouter());

        // LLM Settings routes
        const llmSettingsRoutes = new LLMSettingsRoutes(this.serviceFactory);
        this.app.use('/api/llm', llmSettingsRoutes.getRouter());

        // Commitment routes
        const commitmentRoutes = new CommitmentRoutes(this.serviceFactory);
        this.app.use('/api/commitments', commitmentRoutes.getRouter());

        // Event routes
        const eventRoutes = new EventRoutes(this.serviceFactory);
        this.app.use('/api/events', eventRoutes.getRouter());

        // 404 handler
        this.app.use((req, res) => {
            res.status(404).json({ error: 'API endpoint not found' });
        });
    }

    async start() {
        return new Promise((resolve, reject) => {
            try {
                this.server = this.app.listen(this.port, () => {
                    console.log(`🌐 API Server started on http://localhost:${this.port}`);
                    console.log(`📡 Chat API available at http://localhost:${this.port}/api/chat`);
                    
                    // Setup WebSocket server on the same HTTP server
                    try {
                        this.wss = setupWebSocketServer(this.server, this.serviceFactory);
                        console.log(`🔌 WebSocket server initialized on ws://localhost:${this.port}`);
                    } catch (wsError) {
                        console.error('⚠️  Failed to initialize WebSocket server:', wsError.message);
                    }
                    
                    resolve(this.server);
                });

                this.server.on('error', (error) => {
                    if (error.code === 'EADDRINUSE') {
                        console.log(`⚠️  Port ${this.port} is in use, trying ${this.port + 1}...`);
                        this.port += 1;
                        this.start().then(resolve).catch(reject);
                    } else {
                        reject(error);
                    }
                });

            } catch (error) {
                reject(error);
            }
        });
    }

    async stop() {
        if (this.server) {
            return new Promise((resolve) => {
                // Close WebSocket server first
                if (this.wss) {
                    this.wss.close(() => {
                        console.log('🔌 WebSocket server stopped');
                        
                        // Then close HTTP server
                        this.server.close(() => {
                            console.log('🛑 API Server stopped');
                            resolve();
                        });
                    });
                } else {
                    // If no WebSocket server, just close HTTP server
                    this.server.close(() => {
                        console.log('🛑 API Server stopped');
                        resolve();
                    });
                }
            });
        }
    }
}

module.exports = APIServer;
