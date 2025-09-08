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
                const llmService = this.serviceFactory.get('llm');
                const psychologyService = this.serviceFactory.get('psychology');
                const conversationService = this.serviceFactory.get('conversationAnalyzer');
                const databaseService = this.serviceFactory.get('database');

                // Create or get session
                const actualSessionId = sessionId || uuidv4();

                // Save user message to database
                const userMessageId = await databaseService.getDAL().conversations.saveMessage(
                    actualSessionId, 
                    'user', 
                    message, 
                    'chat',
                    { user_id: userId, message_type: 'text' }
                );

                // Get character information
                const character = await databaseService.getDAL().personalities.getCharacter(characterId);
                if (!character) {
                    return res.status(400).json({ 
                        success: false, 
                        error: 'Character not found',
                        details: `Character with ID ${characterId} does not exist`
                    });
                }

                // Get current psychology state
                let psychologyState = await psychologyService.getCharacterState(actualSessionId);
                if (!psychologyState) {
                    // Initialize psychology state for new session
                    psychologyState = await psychologyService.initializeCharacterState(userId, characterId);
                }

                // Prepare context for LLM with character-specific information
                const characterBackground = character.definition || '';
                const systemPrompt = `You are ${character.name}, ${character.description}
${characterBackground ? `\nBackground: ${characterBackground}` : ''}
Current psychology state: mood=${psychologyState.mood || 'neutral'}, engagement=${psychologyState.engagement || 'moderate'}, energy=${psychologyState.energy || 75}.
Stay in character as ${character.name}. Adapt your response based on this psychological context and your character traits.`;

                // Generate AI response using LLM service (convert to string format)
                const fullPrompt = `${systemPrompt}\n\nUser: ${message}\n${character.name}:`;
                const aiResponse = await llmService.generateResponse(fullPrompt);

                // Save AI response to database
                const aiMessageId = await databaseService.getDAL().conversations.saveMessage(
                    actualSessionId,
                    'assistant', 
                    aiResponse.content || aiResponse,
                    'chat',
                    { user_id: userId, message_type: 'text' }
                );

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

                const databaseService = this.serviceFactory.get('database');
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
                
                const psychologyService = this.serviceFactory.get('psychology');
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
