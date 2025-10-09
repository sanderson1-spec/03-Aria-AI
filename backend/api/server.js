const express = require('express');
const cors = require('cors');
const ChatRoutes = require('./chatRoutes');
const SettingsRoutes = require('./settingsRoutes');
const CharactersRoutes = require('./charactersRoutes');
const ProactiveRoutes = require('./proactiveRoutes');
const LLMSettingsRoutes = require('./llmSettingsRoutes');
const CommitmentRoutes = require('./commitmentRoutes');
const EventRoutes = require('./eventRoutes');
const AuthRoutes = require('./authRoutes');
const UserRoutes = require('./userRoutes');
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
        // Enable CORS for frontend - allow both localhost and network access
        this.app.use(cors({
            origin: function(origin, callback) {
                // Allow requests with no origin (like mobile apps or Postman)
                if (!origin) return callback(null, true);
                
                // Allow localhost and any IP on port 5173 (Vite dev server)
                if (origin.includes('localhost:5173') || origin.includes(':5173')) {
                    return callback(null, true);
                }
                
                // Log rejected origins for debugging
                console.log(`⚠️  CORS rejected origin: ${origin}`);
                // Deny but don't throw error - just return false
                callback(null, false);
            },
            credentials: true
        }));

        // Parse JSON bodies with larger limit for character imports
        this.app.use(express.json({ limit: '10mb' }));

        // Basic logging with more details
        this.app.use((req, res, next) => {
            console.log(`[API] ${req.method} ${req.path}`);
            if (req.headers.origin) {
                console.log(`  Origin: ${req.headers.origin}`);
            }
            next();
        });

        // Error handling middleware
        this.app.use((err, req, res, next) => {
            console.error('❌ Server Error:', err);
            res.status(500).json({ 
                success: false,
                error: err.message || 'Internal server error',
                details: process.env.NODE_ENV === 'development' ? err.stack : undefined
            });
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

        // Auth routes (public - no auth middleware)
        const authRoutes = new AuthRoutes(this.serviceFactory);
        this.app.use('/api/auth', authRoutes.getRouter());

        // User routes
        const userRoutes = new UserRoutes(this.serviceFactory);
        this.app.use('/api/users', userRoutes.getRouter());

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
                // Listen on all network interfaces (0.0.0.0) to allow mobile device access
                this.server = this.app.listen(this.port, '0.0.0.0', () => {
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
