const express = require('express');
const { v4: uuidv4 } = require('uuid');

class ChatRoutes {
    constructor(serviceFactory) {
        this.router = express.Router();
        this.serviceFactory = serviceFactory;
        this.setupRoutes();
    }

    setupRoutes() {
        // Enable CORS for frontend
        this.router.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', 'http://localhost:5173');
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
            if (req.method === 'OPTIONS') {
                res.sendStatus(200);
            } else {
                next();
            }
        });

        // Send a chat message
        this.router.post('/message', async (req, res) => {
            try {
                const { message, sessionId, userId = 'default-user', characterId = 'aria-1' } = req.body;

                if (!message || !message.trim()) {
                    return res.status(400).json({ error: 'Message is required' });
                }

                // Get services
                const llmService = this.serviceFactory.getService('llm');
                const psychologyService = this.serviceFactory.getService('psychology');
                const conversationService = this.serviceFactory.getService('conversationAnalyzer');
                const databaseService = this.serviceFactory.getService('database');

                // Create or get session
                const actualSessionId = sessionId || uuidv4();

                // Save user message to database
                const userMessageId = uuidv4();
                await databaseService.getDAL().conversations.create('conversations', {
                    id: userMessageId,
                    session_id: actualSessionId,
                    user_id: userId,
                    sender: 'user',
                    content: message,
                    timestamp: new Date().toISOString(),
                    message_type: 'text'
                });

                // Get current psychology state
                let psychologyState = await psychologyService.getCharacterState(actualSessionId);
                if (!psychologyState) {
                    // Initialize psychology state for new session
                    psychologyState = await psychologyService.initializeCharacterState(userId, characterId);
                }

                // Prepare context for LLM
                const systemPrompt = `You are Aria, a sophisticated AI assistant with advanced psychological understanding. 
Current psychology state: mood=${psychologyState.mood || 'neutral'}, engagement=${psychologyState.engagement || 'moderate'}, energy=${psychologyState.energy || 75}.
Adapt your response based on this psychological context. Be helpful, empathetic, and engaging.`;

                // Generate AI response using LLM service
                const aiResponse = await llmService.generateResponse([
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: message }
                ]);

                // Save AI response to database
                const aiMessageId = uuidv4();
                await databaseService.getDAL().conversations.create('conversations', {
                    id: aiMessageId,
                    session_id: actualSessionId,
                    user_id: userId,
                    sender: 'ai',
                    content: aiResponse.content || aiResponse,
                    timestamp: new Date().toISOString(),
                    message_type: 'text'
                });

                // Update psychology state based on interaction
                const updatedPsychology = await psychologyService.updateCharacterState(
                    actualSessionId, 
                    { 
                        lastInteraction: message,
                        responseGenerated: aiResponse.content || aiResponse 
                    }
                );

                // Return response
                res.json({
                    success: true,
                    data: {
                        sessionId: actualSessionId,
                        aiResponse: aiResponse.content || aiResponse,
                        psychologyState: updatedPsychology,
                        userMessageId,
                        aiMessageId
                    }
                });

            } catch (error) {
                console.error('Chat API Error:', error);
                res.status(500).json({ 
                    error: 'Failed to process message', 
                    details: error.message 
                });
            }
        });

        // Get chat history
        this.router.get('/history/:sessionId', async (req, res) => {
            try {
                const { sessionId } = req.params;
                const { userId = 'default-user' } = req.query;

                const databaseService = this.serviceFactory.getService('database');
                const messages = await databaseService.getDAL().conversations.query(
                    'SELECT * FROM conversations WHERE session_id = ? AND user_id = ? ORDER BY timestamp ASC',
                    [sessionId, userId]
                );

                res.json({
                    success: true,
                    data: messages
                });

            } catch (error) {
                console.error('Chat History API Error:', error);
                res.status(500).json({ 
                    error: 'Failed to get chat history', 
                    details: error.message 
                });
            }
        });

        // Get psychology state
        this.router.get('/psychology/:sessionId', async (req, res) => {
            try {
                const { sessionId } = req.params;
                
                const psychologyService = this.serviceFactory.getService('psychology');
                const psychologyState = await psychologyService.getCharacterState(sessionId);

                res.json({
                    success: true,
                    data: psychologyState || {
                        mood: 'neutral',
                        engagement: 'moderate',
                        energy: 75,
                        learningProgress: {
                            patternsIdentified: 0,
                            adaptationScore: 0.5
                        }
                    }
                });

            } catch (error) {
                console.error('Psychology API Error:', error);
                res.status(500).json({ 
                    error: 'Failed to get psychology state', 
                    details: error.message 
                });
            }
        });
    }

    getRouter() {
        return this.router;
    }
}

module.exports = ChatRoutes;
