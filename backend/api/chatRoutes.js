const express = require('express');
const { v4: uuidv4 } = require('uuid');
const DateTimeUtils = require('../utils/datetime_utils');
const { createAuthMiddleware } = require('./authMiddleware');

class ChatRoutes {
    constructor(serviceFactory) {
        this.router = express.Router();
        this.serviceFactory = serviceFactory;
        this.authMiddleware = createAuthMiddleware(serviceFactory);
        this.setupRoutes();
    }

    // Helper function to format duration
    formatDuration(timestamp) {
        if (!timestamp) return 'just now';
        const minutes = Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000);
        if (minutes < 1) return 'just now';
        if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        const days = Math.floor(hours / 24);
        return `${days} day${days > 1 ? 's' : ''} ago`;
    }

    // Helper function to format messages for prompt
    formatMessages(messages) {
        if (!messages || messages.length === 0) return '(No recent messages)';
        return messages.map(m => `[${m.sender || m.role}]: ${m.message || m.content}`).join('\n');
    }

    // Helper function to format memories for prompt
    formatMemories(memories) {
        if (!memories || memories.length === 0) return '(No significant memories)';
        return memories.map(m => `- ${m.content || m.message} (significance: ${m.total_significance || 'N/A'})`).join('\n');
    }

    // Helper function to format commitments for prompt
    formatCommitments(commitments) {
        if (!commitments || commitments.length === 0) return '(No active commitments)';
        return commitments.map(c => `- ${c.title || c.description} (status: ${c.status})`).join('\n');
    }

    // Helper function to format events for prompt
    formatEvents(events) {
        if (!events || events.length === 0) return '(No upcoming events)';
        return events.map(e => `- ${e.title} (scheduled: ${e.scheduled_at})`).join('\n');
    }

    // Helper function to format completions for prompt
    formatCompletions(completions) {
        if (!completions || completions.length === 0) return '(No recent completions)';
        return completions.map(c => `- ${c.title} (${c.type}, completed: ${c.completed_at || c.updated_at})`).join('\n');
    }

    // Shared method to build system prompt - used by both streaming and non-streaming routes
    buildSystemPrompt(character, characterBackground, dateTimeContext, userProfile, conversationState, recentMessages, context, deepMemories) {
        return `You are ${character.name}, ${character.description}
${characterBackground ? `\nBackground: ${characterBackground}` : ''}

${dateTimeContext}

${userProfile ? `USER PROFILE:
Name: ${userProfile.name || 'Unknown'}
${userProfile.birthdate ? `Birthdate: ${userProfile.birthdate}` : ''}
${userProfile.bio ? `About them: ${userProfile.bio}` : ''}

This is baseline information about the user. Reference it naturally without asking for details already provided.

` : ''}CONVERSATION CONTEXT:
- This conversation started ${this.formatDuration(conversationState.conversation_started_at)}
- Messages exchanged: ${conversationState.messages_exchanged}
- This is an ONGOING conversation, not a fresh start
${conversationState.last_message ? `- Your last message: "${conversationState.last_message.message}"` : ''}

CONVERSATION FLOW PRINCIPLES:
- Remember what you JUST said - don't repeat yourself or contradict recent statements
- If you asked a question in your last message, you're waiting for their response
- Don't re-greet unless there's been a significant break (hours/days since last message)
- Match the natural rhythm of this specific conversation
- Stay consistent with your recent emotional tone and topics

Recent conversation flow:
${recentMessages.reverse().map(m => `${m.sender === 'user' ? 'Them' : 'You'}: ${m.message}`).join('\n')}

RECENT CONVERSATION (last ${context.recentMessages.length} messages):
${this.formatMessages(context.recentMessages)}

YOUR PSYCHOLOGICAL STATE:
- Mood: ${context.psychologyState?.current_emotion || 'neutral'}
- Energy: ${context.psychologyState?.energy_level || 5}/10
- Relationship: ${context.psychologyState?.relationship_dynamic || 'developing'}

TOP MEMORIES:
${this.formatMemories(context.topMemories)}

${deepMemories && deepMemories.length > 0 ? `RELEVANT PAST MEMORIES:
${this.formatMemories(deepMemories)}
` : ''}ACTIVE COMMITMENTS:
${this.formatCommitments(context.activeCommitments)}

UPCOMING EVENTS:
${this.formatEvents(context.upcomingEvents)}

RECENT COMPLETIONS:
${this.formatCompletions(context.recentCompletions)}

Stay in character as ${character.name}. You have complete awareness of all this context.`;
    }

    setupRoutes() {
        // CORS is handled by main server middleware

        // Get all chats for a user (protected)
        this.router.get('/user/:userId/chats', this.authMiddleware, async (req, res) => {
            try {
                const { userId } = req.params;
                const { page = 1, pageSize = 50 } = req.query;

                const databaseService = this.serviceFactory.get('database');
                const result = await databaseService.getDAL().chats.getUserChats(userId, parseInt(page), parseInt(pageSize));

                res.json({
                    success: true,
                    data: result.chats,
                    pagination: result.pagination
                });

            } catch (error) {
                console.error('Get User Chats API Error:', error);
                res.status(500).json({ 
                    error: 'Failed to get user chats', 
                    details: error.message 
                });
            }
        });

        // Get recent chats for a user (protected)
        this.router.get('/user/:userId/chats/recent', this.authMiddleware, async (req, res) => {
            try {
                const { userId } = req.params;
                const { limit = 10 } = req.query;

                const databaseService = this.serviceFactory.get('database');
                const chats = await databaseService.getDAL().chats.getRecentUserChats(userId, parseInt(limit));

                res.json({
                    success: true,
                    data: chats
                });

            } catch (error) {
                console.error('Get Recent User Chats API Error:', error);
                res.status(500).json({ 
                    error: 'Failed to get recent user chats', 
                    details: error.message 
                });
            }
        });

        // Create or update a chat (protected)
        this.router.post('/user/:userId/chats', this.authMiddleware, async (req, res) => {
            try {
                const { userId } = req.params;
                const { chatId, title, personalityId, metadata } = req.body;

                if (!personalityId) {
                    return res.status(400).json({ 
                        success: false, 
                        error: 'personalityId is required' 
                    });
                }

                const databaseService = this.serviceFactory.get('database');
                
                // Check if chat already exists
                if (chatId) {
                    const existingChat = await databaseService.getDAL().chats.getUserChat(userId, chatId);
                    if (existingChat) {
                        return res.json({
                            success: true,
                            data: existingChat,
                            message: 'Chat already exists'
                        });
                    }
                }

                // Create new chat
                const chat = await databaseService.getDAL().chats.createChat(userId, {
                    id: chatId,
                    title: title || `Chat with ${personalityId}`,
                    personality_id: personalityId,
                    metadata: metadata || {}
                });

                res.status(201).json({
                    success: true,
                    data: chat,
                    message: 'Chat created successfully'
                });

            } catch (error) {
                console.error('Create Chat API Error:', error);
                res.status(500).json({ 
                    error: 'Failed to create chat', 
                    details: error.message 
                });
            }
        });

        // Send a chat message (non-streaming)
        this.router.post('/message', async (req, res) => {
            try {
                const { message, sessionId, userId, characterId } = req.body;
                
                if (!userId) {
                    return res.status(400).json({ 
                        error: 'userId is required',
                        details: 'Provide userId in request body'
                    });
                }
                
                if (!characterId) {
                    return res.status(400).json({ 
                        error: 'characterId is required',
                        details: 'Provide characterId in request body'
                    });
                }

                if (!message || !message.trim()) {
                    return res.status(400).json({ error: 'Message is required' });
                }

                // Get services
                const llmService = this.serviceFactory.get('llm');
                const psychologyService = this.serviceFactory.get('psychology');
                const conversationService = this.serviceFactory.get('conversationAnalyzer');
                const databaseService = this.serviceFactory.get('database');
                const contextBuilder = this.serviceFactory.get('contextBuilder');
                const memorySearch = this.serviceFactory.get('memorySearch');

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
                    return res.status(404).json({ 
                        success: false, 
                        error: 'Character not found',
                        details: `Character with ID ${characterId} does not exist`
                    });
                }

                // Verify character belongs to user
                if (character.user_id !== userId) {
                    return res.status(404).json({ 
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

                // Get user profile
                const user = await databaseService.getDAL().users.findById(userId);
                let userProfile = null;
                if (user && user.user_profile) {
                    try {
                        userProfile = typeof user.user_profile === 'string' 
                            ? JSON.parse(user.user_profile) 
                            : user.user_profile;
                    } catch (parseError) {
                        // Invalid JSON, continue without profile
                        userProfile = null;
                    }
                }

                // Get conversation state for context awareness
                const conversationState = await databaseService.getDAL().conversations.getConversationState(actualSessionId);

                // Get last 5 messages for conversation flow context
                const recentMessages = await databaseService.getDAL().conversations.getSessionHistory(actualSessionId, 5);

                // Build unified context (includes recent messages, psychology, memories, commitments, events)
                const context = await contextBuilder.buildUnifiedContext(userId, actualSessionId, characterId);

                // Get recent message IDs for exclusion in deep search
                const recentMessageIds = context.recentMessages.map(m => m.id).filter(id => id);
                
                // Execute deep memory search (significance threshold from config, default 7)
                const significanceThreshold = 7;
                const deepMemories = await memorySearch.executeDeepSearch(
                    actualSessionId, 
                    message, 
                    recentMessageIds, 
                    significanceThreshold
                );

                // Prepare comprehensive context for LLM
                const characterBackground = character.definition || '';
                const dateTimeContext = DateTimeUtils.getSystemPromptDateTime();
                
                // Use shared method to build system prompt
                const systemPrompt = this.buildSystemPrompt(
                    character,
                    characterBackground,
                    dateTimeContext,
                    userProfile,
                    conversationState,
                    recentMessages,
                    context,
                    deepMemories
                );

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

                // Return response IMMEDIATELY (user sees response fast)
                res.json({
                    success: true,
                    data: {
                        sessionId: actualSessionId,
                        aiResponse: aiResponse.content || aiResponse,
                        psychologyState: psychologyState, // Send current state immediately
                        userMessageId,
                        aiMessageId,
                        contextInfo: {
                            deepSearchTriggered: deepMemories && deepMemories.length > 0,
                            memoriesFound: deepMemories ? deepMemories.length : 0
                        }
                    }
                });

                // 🎯 CLEAN BACKGROUND PROCESSING - Single service call (non-streaming version)
                setImmediate(async () => {
                    try {
                        const backgroundAnalysis = this.serviceFactory.get('backgroundAnalysis');
                        await backgroundAnalysis.processMessageAnalysis({
                            sessionId: actualSessionId,
                            userId: userId,
                            characterId: characterId,
                            userMessage: message,
                            aiResponse: aiResponse.content || aiResponse,
                            psychologyState: psychologyState,
                            character: character
                        });
                    } catch (error) {
                        console.error('Background analysis failed:', error);
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

        // Send a chat message with streaming (OPTIMIZED FOR FAST USER RESPONSE)
        this.router.post('/stream', async (req, res) => {
            try {
                const { message, sessionId, userId, characterId } = req.body;
                
                if (!userId) {
                    return res.status(400).json({ 
                        error: 'userId is required',
                        details: 'Provide userId in request body'
                    });
                }
                
                if (!characterId) {
                    return res.status(400).json({ 
                        error: 'characterId is required',
                        details: 'Provide characterId in request body'
                    });
                }

                if (!message || !message.trim()) {
                    return res.status(400).json({ error: 'Message is required' });
                }

                // Set up Server-Sent Events headers (CORS already handled by main middleware)
                res.writeHead(200, {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive'
                });

                // Get services
                const llmService = this.serviceFactory.get('llm');
                const psychologyService = this.serviceFactory.get('psychology');
                const conversationService = this.serviceFactory.get('conversationAnalyzer');
                const proactiveIntelligence = this.serviceFactory.get('proactiveIntelligence');
                const proactiveLearning = this.serviceFactory.get('proactiveLearning');
                const databaseService = this.serviceFactory.get('database');
                const contextBuilder = this.serviceFactory.get('contextBuilder');
                const memorySearch = this.serviceFactory.get('memorySearch');

                // Create or get session
                const actualSessionId = sessionId || uuidv4();

                // FAST OPERATIONS: Do these immediately
                // Save user message to database
                const userMessageId = await databaseService.getDAL().conversations.saveMessage(
                    actualSessionId, 
                    'user', 
                    message, 
                    'chat',
                    { user_id: userId, message_type: 'text' }
                );

                // Send initial session data
                res.write(`data: ${JSON.stringify({
                    type: 'session',
                    sessionId: actualSessionId,
                    userMessageId
                })}\n\n`);

                // Get character information (fast database lookup)
                const character = await databaseService.getDAL().personalities.getCharacter(characterId);
                if (!character) {
                    res.write(`data: ${JSON.stringify({
                        type: 'error',
                        error: 'Character not found',
                        details: `Character with ID ${characterId} does not exist`
                    })}\n\n`);
                    res.end();
                    return;
                }

                // Verify character belongs to user
                if (character.user_id !== userId) {
                    res.write(`data: ${JSON.stringify({
                        type: 'error',
                        error: 'Character not found',
                        details: `Character with ID ${characterId} does not exist`
                    })}\n\n`);
                    res.end();
                    return;
                }

                // Get current psychology state (fast database lookup)
                let psychologyState = await psychologyService.getCharacterState(actualSessionId);
                if (!psychologyState) {
                    // Initialize psychology state for new session (fast)
                    psychologyState = await psychologyService.initializeCharacterState(actualSessionId, characterId);
                }

                // Get user profile
                const user = await databaseService.getDAL().users.findById(userId);
                let userProfile = null;
                if (user && user.user_profile) {
                    try {
                        userProfile = typeof user.user_profile === 'string' 
                            ? JSON.parse(user.user_profile) 
                            : user.user_profile;
                    } catch (parseError) {
                        // Invalid JSON, continue without profile
                        userProfile = null;
                    }
                }

                // Get conversation state for context awareness
                let conversationState, recentMessages, context, deepMemories;
                
                try {
                    conversationState = await databaseService.getDAL().conversations.getConversationState(actualSessionId);
                    recentMessages = await databaseService.getDAL().conversations.getSessionHistory(actualSessionId, 5);
                    context = await contextBuilder.buildUnifiedContext(userId, actualSessionId, characterId);
                    
                    // Get recent message IDs for exclusion in deep search
                    const recentMessageIds = context.recentMessages.map(m => m.id).filter(id => id);
                    
                    // Execute deep memory search (significance threshold from config, default 7)
                    const significanceThreshold = 7;
                    deepMemories = await memorySearch.executeDeepSearch(
                        actualSessionId, 
                        message, 
                        recentMessageIds, 
                        significanceThreshold
                    );
                } catch (contextError) {
                    // Fallback to minimal context if full context fails
                    console.error('Failed to build full context, using minimal fallback:', contextError.message);
                    
                    conversationState = {
                        conversation_started_at: new Date().toISOString(),
                        messages_exchanged: 0,
                        last_message: null
                    };
                    
                    recentMessages = [];
                    
                    context = {
                        recentMessages: [],
                        psychologyState: psychologyState,
                        topMemories: [],
                        activeCommitments: [],
                        upcomingEvents: [],
                        recentCompletions: []
                    };
                    
                    deepMemories = [];
                }

                // Prepare comprehensive context for LLM
                const characterBackground = character.definition || '';
                const dateTimeContext = DateTimeUtils.getSystemPromptDateTime();
                
                // Use shared method to build system prompt
                const systemPrompt = this.buildSystemPrompt(
                    character,
                    characterBackground,
                    dateTimeContext,
                    userProfile,
                    conversationState,
                    recentMessages,
                    context,
                    deepMemories
                );

                let fullAiResponse = '';

                // Generate streaming AI response (USER SEES THIS IMMEDIATELY)
                const fullPrompt = `${systemPrompt}\n\nUser: ${message}\n${character.name}:`;
                
                await llmService.generateStreamingResponse(
                    fullPrompt,
                    [], // context
                    {}, // options
                    (chunk, fullContent) => {
                        // Stream each chunk to the frontend
                        res.write(`data: ${JSON.stringify({
                            type: 'chunk',
                            content: chunk,
                            fullContent: fullContent
                        })}\n\n`);
                        fullAiResponse = fullContent;
                    }
                );

                // Save AI response to database (fast)
                const aiMessageId = await databaseService.getDAL().conversations.saveMessage(
                    actualSessionId,
                    'assistant', 
                    fullAiResponse,
                    'chat',
                    { user_id: userId, message_type: 'text' }
                );

                // Send completion message IMMEDIATELY (user sees response is complete)
                res.write(`data: ${JSON.stringify({
                    type: 'complete',
                    aiMessageId,
                    psychologyState: psychologyState, // Send current state immediately
                    fullResponse: fullAiResponse
                })}\n\n`);

                res.end();

                // 🎯 CLEAN BACKGROUND PROCESSING - Single service call
                // This runs asynchronously without blocking the user experience
                setImmediate(async () => {
                    try {
                        console.log('🚀 Starting background processing for session:', actualSessionId);
                        const backgroundAnalysis = this.serviceFactory.get('backgroundAnalysis');
                        await backgroundAnalysis.processMessageAnalysis({
                            sessionId: actualSessionId,
                            userId: userId,
                            characterId: characterId,
                            userMessage: message,
                            aiResponse: fullAiResponse,
                            psychologyState: psychologyState,
                            character: character
                        });
                        console.log('✅ Background processing completed for session:', actualSessionId);
                    } catch (error) {
                        console.error('❌ Background analysis failed for session:', actualSessionId, error);
                    }
                });

            } catch (error) {
                console.error('Chat Streaming API Error:', error);
                res.write(`data: ${JSON.stringify({
                    type: 'error',
                    error: 'Failed to process message',
                    details: error.message
                })}\n\n`);
                res.end();
                return; // Don't run background processing if there was an error
            }
        });

        // Get chat history
        this.router.get('/history/:sessionId', async (req, res) => {
            try {
                const { sessionId } = req.params;
                const { userId } = req.query;
                
                // Note: userId is optional for history endpoint for backwards compatibility
                // but should be provided for proper user isolation

                const databaseService = this.serviceFactory.get('database');
                const messages = await databaseService.getDAL().conversations.getSessionHistory(sessionId, 50, 0);

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

        // Server-Sent Events endpoint for proactive messages
        this.router.get('/proactive/:sessionId', async (req, res) => {
            try {
                const { sessionId } = req.params;
                
                // Set up Server-Sent Events headers (CORS already handled by main middleware)
                res.writeHead(200, {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive'
                });

                // Send initial connection confirmation
                res.write(`data: ${JSON.stringify({
                    type: 'connected',
                    sessionId: sessionId,
                    timestamp: new Date().toISOString()
                })}\n\n`);

                // Get proactive delivery service (fix: capture serviceFactory from outer scope)
                const serviceFactory = this.serviceFactory;
                const proactiveDelivery = serviceFactory.get('proactiveDelivery');
                
                if (!proactiveDelivery) {
                    res.write(`data: ${JSON.stringify({
                        type: 'error',
                        error: 'Proactive delivery service not available'
                    })}\n\n`);
                    res.end();
                    return;
                }

                // Register session for proactive message delivery
                const cleanup = proactiveDelivery.registerSession(sessionId, (message) => {
                    try {
                        res.write(`data: ${JSON.stringify({
                            type: 'proactive-message',
                            message: message,
                            timestamp: new Date().toISOString()
                        })}\n\n`);
                    } catch (error) {
                        console.error('Error sending proactive message via SSE:', error);
                    }
                });

                // Send periodic heartbeat to keep connection alive
                const heartbeatInterval = setInterval(() => {
                    try {
                        res.write(`data: ${JSON.stringify({
                            type: 'heartbeat',
                            timestamp: new Date().toISOString()
                        })}\n\n`);
                    } catch (error) {
                        console.error('Heartbeat failed, connection likely closed:', error);
                        clearInterval(heartbeatInterval);
                        cleanup();
                    }
                }, 30000); // Every 30 seconds

                // Handle client disconnect
                req.on('close', () => {
                    if (this.logger && this.logger.debug) {
                        this.logger.debug(`Proactive SSE connection closed for session ${sessionId}`, 'ChatRoutes');
                    }
                    clearInterval(heartbeatInterval);
                    cleanup();
                });

                req.on('error', (error) => {
                    // ECONNRESET is normal when client disconnects
                    if (error.code === 'ECONNRESET' || error.message === 'aborted') {
                        if (this.logger && this.logger.debug) {
                            this.logger.debug(`Proactive SSE client disconnected: ${sessionId}`, 'ChatRoutes');
                        }
                    } else {
                        if (this.logger && this.logger.error) {
                            this.logger.error(`Proactive SSE connection error for session ${sessionId}`, 'ChatRoutes', {
                                error: error.message,
                                code: error.code
                            });
                        }
                    }
                    clearInterval(heartbeatInterval);
                    cleanup();
                });

            } catch (error) {
                this.logger.error('Proactive SSE API Error', 'ChatRoutes', {
                    error: error.message,
                    sessionId
                });
                res.status(500).json({ 
                    error: 'Failed to establish proactive message stream', 
                    details: error.message 
                });
            }
        });

        // DELETE /:chatId - Delete a chat
        this.router.delete('/:chatId', async (req, res) => {
            try {
                const { chatId } = req.params;
                const { userId } = req.query;

                if (!userId) {
                    return res.status(400).json({
                        success: false,
                        error: 'Missing required parameter: userId'
                    });
                }

                const databaseService = this.serviceFactory.get('database');
                const dal = databaseService.getDAL();

                // Verify chat belongs to user (user isolation)
                const chat = await dal.conversations.getChatById(chatId);

                if (!chat) {
                    return res.status(404).json({
                        success: false,
                        error: 'Chat not found'
                    });
                }

                if (chat.user_id !== userId) {
                    return res.status(403).json({
                        success: false,
                        error: 'Access denied: This chat does not belong to you'
                    });
                }

                // Delete chat (cascades to conversations, commitments, events, psychology state via foreign keys)
                const result = await dal.conversations.deleteChat(chatId);

                res.json({
                    success: true,
                    message: 'Chat deleted successfully',
                    data: result
                });

            } catch (error) {
                console.error('Delete Chat API Error:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to delete chat',
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
