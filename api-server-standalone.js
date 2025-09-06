const express = require('express');
const cors = require('cors');
const { setupServices } = require('./setupServices');
const path = require('path');

const app = express();
const port = 3001;

// Enable CORS
app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true
}));

app.use(express.json());

// Logging middleware
app.use((req, res, next) => {
    console.log(`[API] ${req.method} ${req.path}`);
    next();
});

let serviceFactory = null;

// Initialize services
async function initializeServices() {
    try {
        const config = {
            dbPath: path.join(__dirname, 'database', 'aria.db'),
            includeMetadata: true,
            dateFormat: 'ISO',
            maxContextSize: 500,
            includeStackTrace: true,
            autoSave: false,
            createMissingDirectories: true
        };

        // Set LLM environment variables
        process.env.LLM_ENDPOINT = 'http://192.168.178.182:1234/v1/chat/completions';
        process.env.LLM_MODEL = 'meta-llama-3.1-8b-instruct';

        console.log('🏗️  Initializing services for API server...');
        serviceFactory = await setupServices(config);
        console.log('✅ Services initialized for API server');
        return true;
    } catch (error) {
        console.error('❌ Service initialization failed:', error.message);
        return false;
    }
}

// Health endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        services: serviceFactory ? serviceFactory.getServiceNames() : []
    });
});

// Chat message endpoint
app.post('/api/chat/message', async (req, res) => {
    try {
        if (!serviceFactory) {
            return res.status(503).json({ 
                error: 'Services not initialized', 
                success: false 
            });
        }

        const { message, sessionId = 'session-1', userId = 'default-user' } = req.body;

        if (!message || !message.trim()) {
            return res.status(400).json({ 
                error: 'Message is required', 
                success: false 
            });
        }

        console.log(`Processing message: "${message}"`);

        // Get LLM service
        const llmService = serviceFactory.get('llm');
        
        // Simple system prompt
        const systemPrompt = "You are Aria, a helpful AI assistant. Be conversational and engaging.";

        console.log('Calling LLM service...');
        
        // Convert to simple prompt format (the LLM service expects a string)
        const fullPrompt = `${systemPrompt}\n\nUser: ${message}\nAria:`;
        
        // Generate response
        const response = await llmService.generateResponse(fullPrompt);

        console.log('LLM Response received:', typeof response, response);

        // Extract the actual response content
        let aiResponse = "I'm here to help!"; // default fallback
        
        if (typeof response === 'string') {
            aiResponse = response;
        } else if (response && response.content) {
            aiResponse = response.content;
        } else if (response && response.message && response.message.content) {
            aiResponse = response.message.content;
        } else if (response && response.choices && response.choices[0] && response.choices[0].message) {
            aiResponse = response.choices[0].message.content;
        } else {
            console.log('Unexpected response format:', JSON.stringify(response, null, 2));
            aiResponse = "I received your message but had trouble formatting my response.";
        }

        console.log('Final AI response:', aiResponse);

        // Return response
        res.json({
            success: true,
            data: {
                sessionId: sessionId,
                aiResponse: aiResponse,
                psychologyState: {
                    mood: 'positive',
                    engagement: 'high',
                    energy: 80
                }
            }
        });

    } catch (error) {
        console.error('Chat API Error Details:');
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        console.error('Full error:', error);
        
        res.status(500).json({ 
            error: 'Failed to process message', 
            details: error.message,
            success: false
        });
    }
});

// Start server
async function startServer() {
    console.log('🚀 Starting Aria AI API Server...');
    
    // Initialize services first
    const servicesReady = await initializeServices();
    
    if (!servicesReady) {
        console.log('⚠️  Starting API server without full service initialization');
    }

    app.listen(port, () => {
        console.log(`🌐 API Server running on http://localhost:${port}`);
        console.log(`📡 Chat API: http://localhost:${port}/api/chat/message`);
        console.log(`🏥 Health check: http://localhost:${port}/health`);
        console.log('Press Ctrl+C to stop');
    });
}

// Handle shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down API server...');
    process.exit(0);
});

// Start the server
startServer().catch(error => {
    console.error('💥 Failed to start API server:', error);
    process.exit(1);
});
