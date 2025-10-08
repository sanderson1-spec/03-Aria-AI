/**
 * Background Analysis Service
 * 
 * Handles all post-message background processing including:
 * - Psychology analysis and state updates
 * - Conversation flow analysis  
 * - Proactive intelligence analysis and delivery
 * - Learning pattern extraction
 * 
 * Follows clean architecture principles with proper dependency injection
 * and single responsibility.
 */

const AbstractService = require('../base/CORE_AbstractService');

class BackgroundAnalysisService extends AbstractService {
    constructor(dependencies) {
        super('BackgroundAnalysis', dependencies); // Fixed: Use short name pattern
        
        // Initialize dependencies as null (following established pattern)
        this.dal = null;
        this.logger = null;
        this.psychology = null;
        this.conversationAnalyzer = null;
        this.proactiveIntelligence = null;
        this.proactiveDelivery = null;
        this.proactiveLearning = null;
        this.errorHandler = null;
        this.configuration = null;
    }

    /**
     * FOLLOWS PROJECT PATTERN: Proper dependency initialization
     */
    async onInitialize() {
        try {
            // Initialize logger first (from AbstractService pattern)
            this.logger = this.dependencies.logger;
            if (!this.logger) {
                this.logger = {
                    debug: (msg, ctx, meta) => console.debug(`[${ctx || 'BackgroundAnalysis'}] ${msg}`),
                    info: (msg, ctx, meta) => console.info(`[${ctx || 'BackgroundAnalysis'}] ${msg}`),
                    warn: (msg, ctx, meta) => console.warn(`[${ctx || 'BackgroundAnalysis'}] ${msg}`),
                    error: (msg, ctx, meta) => console.error(`[${ctx || 'BackgroundAnalysis'}] ${msg}`, meta?.error || '')
                };
            }
            
            // Extract dependencies following CORE service pattern
            this.database = this.dependencies.database;
            this.psychology = this.dependencies.psychology;
            this.conversationAnalyzer = this.dependencies.conversationAnalyzer;
            this.proactiveIntelligence = this.dependencies.proactiveIntelligence;
            this.proactiveDelivery = this.dependencies.proactiveDelivery;
            this.proactiveLearning = this.dependencies.proactiveLearning;
            this.errorHandler = this.dependencies.errorHandling;
            this.configuration = this.dependencies.configuration;
            
            // Get DAL from database service (CORE pattern)
            if (!this.database) {
                throw new Error('Database service is required');
            }
            this.dal = this.database.getDAL();
            if (!this.psychology) {
                throw new Error('Psychology service is required');
            }
            
            this.logger.info('BackgroundAnalysisService initialized', 'BackgroundAnalysis');
            
        } catch (error) {
            throw this.errorHandler?.wrapDomainError(error, 
                'Failed to initialize BackgroundAnalysisService') || error;
        }
    }

    /**
     * Process all background analysis for a completed message exchange
     * @param {Object} context - Message context
     * @param {string} context.sessionId - Chat session ID
     * @param {string} context.userId - User ID
     * @param {string} context.characterId - Character/personality ID
     * @param {string} context.userMessage - User's message
     * @param {string} context.aiResponse - AI's response
     * @param {Object} context.psychologyState - Current psychology state
     * @param {Object} context.character - Character configuration
     */
    async processMessageAnalysis(context) {
        const { sessionId, userId, characterId, userMessage, aiResponse, psychologyState, character } = context;
        
        try {
            this.logger.info('Starting background analysis', 'BackgroundAnalysisService', { sessionId });

            // Get conversation history for all analyses
            const conversationHistory = await this.dal.conversations.getSessionHistory(sessionId, 10, 0);

            // Run all background analyses concurrently (non-blocking)
            const analysisPromises = [
                this._runPsychologyAnalysis(sessionId, conversationHistory, userMessage, character),
                this._runConversationAnalysis(conversationHistory, userMessage),
                this._runProactiveAnalysis(sessionId, userId, characterId, userMessage, aiResponse, psychologyState, character, conversationHistory),
                this._runLearningExtraction(sessionId, userId, characterId, userMessage, aiResponse)
            ];

            // Wait for all analyses to complete (or fail gracefully)
            await Promise.allSettled(analysisPromises);

            this.logger.info('Background analysis completed', 'BackgroundAnalysisService', { sessionId });

        } catch (error) {
            // Log error but don't throw - background processing should never fail the main request
            this.logger.error('Background analysis failed', 'BackgroundAnalysisService', { 
                sessionId, 
                error: error.message 
            });
        }
    }

    /**
     * Run psychology analysis and state updates
     */
    async _runPsychologyAnalysis(sessionId, conversationHistory, userMessage, character) {
        try {
            await this.psychology.analyzeAndUpdateState(sessionId, conversationHistory, userMessage, character);
        } catch (error) {
            this.logger.error('Psychology analysis failed', 'BackgroundAnalysisService', { 
                sessionId, 
                error: error.message 
            });
        }
    }

    /**
     * Run conversation flow analysis
     */
    async _runConversationAnalysis(conversationHistory, userMessage) {
        try {
            await this.conversationAnalyzer.analyzeConversationFlow(conversationHistory, userMessage);
        } catch (error) {
            this.logger.error('Conversation analysis failed', 'BackgroundAnalysisService', { 
                error: error.message 
            });
        }
    }

    /**
     * Run proactive intelligence analysis and delivery
     */
    async _runProactiveAnalysis(sessionId, userId, characterId, userMessage, aiResponse, psychologyState, character, conversationHistory) {
        try {
            // Analyze proactive opportunity
            const decision = await this.proactiveIntelligence.analyzeProactiveOpportunity({
                userMessage,
                agentResponse: aiResponse,
                psychologicalState: psychologyState,
                psychologicalFramework: character,
                conversationHistory,
                learnedPatterns: [], // TODO: Implement pattern retrieval
                sessionContext: {
                    sessionId,
                    userId,
                    personalityId: characterId,
                    personalityName: character.name
                }
            });

            // Check if a commitment was detected and create commitment record
            if (decision && decision.commitment_detected && decision.commitment_detected.has_commitment) {
                try {
                    const commitmentData = decision.commitment_detected.commitment;
                    const confidence = decision.commitment_detected.confidence || 0.0;
                    
                    // Get confidence threshold from configuration (default 0.8)
                    const confidenceThreshold = this.configuration 
                        ? this.configuration.get('commitment_confidence_threshold', 0.8)
                        : 0.8;
                    
                    // Only create commitment if confidence exceeds threshold
                    if (confidence > confidenceThreshold) {
                        this.logger.info('Creating commitment record', 'BackgroundAnalysisService', {
                            sessionId,
                            userId,
                            commitmentType: commitmentData?.commitment_type,
                            confidence: confidence,
                            threshold: confidenceThreshold
                        });

                        // Create commitment record
                        const commitmentId = await this.dal.commitments.createCommitment({
                            user_id: userId,
                            chat_id: sessionId,
                            character_id: characterId,
                            description: commitmentData?.description || 'No description provided',
                            commitment_type: commitmentData?.commitment_type || 'task',
                            context: commitmentData?.context || null,
                            character_notes: commitmentData?.character_notes || null,
                            due_at: commitmentData?.due_at || null,
                            status: 'active'
                        });

                        this.logger.info('Commitment created successfully', 'BackgroundAnalysisService', {
                            commitmentId,
                            sessionId,
                            userId
                        });

                        // Schedule proactive follow-up if due date is set
                        if (commitmentData?.due_at && this.proactiveDelivery) {
                            try {
                                // Calculate reminder time (1 hour before due date)
                                const dueDate = new Date(commitmentData.due_at);
                                const reminderTime = new Date(dueDate.getTime() - (60 * 60 * 1000)); // 1 hour before
                                const now = new Date();
                                
                                // Only schedule if reminder time is in the future
                                if (reminderTime > now) {
                                    const delaySeconds = Math.floor((reminderTime.getTime() - now.getTime()) / 1000);
                                    
                                    // Schedule follow-up using ProactiveDeliveryService
                                    this.proactiveDelivery.scheduleProactiveMessage({
                                        sessionId,
                                        userId,
                                        personalityId: characterId,
                                        personalityName: character.name,
                                        messageContent: `Just checking in about your commitment: "${commitmentData.description}". How is it going?`,
                                        delaySeconds,
                                        metadata: {
                                            type: 'commitment_reminder',
                                            commitmentId,
                                            dueDate: commitmentData.due_at
                                        }
                                    });

                                    this.logger.info('Commitment follow-up scheduled', 'BackgroundAnalysisService', {
                                        commitmentId,
                                        reminderTime: reminderTime.toISOString(),
                                        delaySeconds
                                    });
                                } else {
                                    this.logger.debug('Reminder time is in the past, not scheduling', 'BackgroundAnalysisService', {
                                        commitmentId,
                                        reminderTime: reminderTime.toISOString()
                                    });
                                }
                            } catch (scheduleError) {
                                this.logger.error('Failed to schedule commitment follow-up', 'BackgroundAnalysisService', {
                                    commitmentId,
                                    error: scheduleError.message
                                });
                                // Continue processing - scheduling failure shouldn't block commitment creation
                            }
                        }
                    } else {
                        // Log low-confidence detection for monitoring
                        this.logger.info('Low-confidence commitment not created', 'BackgroundAnalysisService', {
                            sessionId,
                            userId,
                            confidence: confidence,
                            threshold: confidenceThreshold,
                            description: commitmentData?.description
                        });
                    }
                } catch (commitmentError) {
                    this.logger.error('Failed to create commitment record', 'BackgroundAnalysisService', {
                        sessionId,
                        userId,
                        error: commitmentError.message
                    });
                    // Continue processing - commitment creation failure shouldn't block proactive messages
                }
            }

            // Check if an event was detected and create event record
            if (decision && decision.event_detected && decision.event_detected.has_event) {
                try {
                    const eventData = decision.event_detected.event;
                    
                    this.logger.info('Creating event record', 'BackgroundAnalysisService', {
                        sessionId,
                        userId,
                        eventTitle: eventData?.title,
                        recurrenceType: eventData?.recurrence_type
                    });

                    // Parse starts_at and calculate initial next_occurrence
                    const startsAt = this._parseStartTime(eventData.starts_at);
                    const nextOccurrence = this._calculateInitialNextOccurrence(eventData, startsAt);

                    // Create event record
                    const eventId = this.generateId();
                    await this.dal.events.createEvent({
                        id: eventId,
                        user_id: userId,
                        chat_id: sessionId,
                        character_id: characterId,
                        title: eventData?.title || 'Scheduled Event',
                        description: eventData?.description || '',
                        recurrence_type: eventData?.recurrence_type || 'once',
                        recurrence_data: JSON.stringify(eventData?.recurrence_data || {}),
                        starts_at: startsAt,
                        next_occurrence: nextOccurrence,
                        is_active: 1,
                        status: 'scheduled'
                    });

                    this.logger.info('Event created successfully', 'BackgroundAnalysisService', {
                        eventId,
                        sessionId,
                        userId,
                        title: eventData?.title,
                        nextOccurrence
                    });

                } catch (eventError) {
                    this.logger.error('Failed to create event record', 'BackgroundAnalysisService', {
                        sessionId,
                        userId,
                        error: eventError.message
                    });
                    // Continue processing - event creation failure shouldn't block other operations
                }
            }

            // Process the decision for delivery if proactive engagement is recommended
            this.logger.info('Checking proactive decision condition', 'BackgroundAnalysisService', {
                sessionId,
                hasProactiveDelivery: !!this.proactiveDelivery,
                hasDecision: !!decision,
                shouldEngage: decision?.should_engage_proactively,
                hasContent: !!decision?.proactive_message_content,
                content: decision?.proactive_message_content
            });
            
            if (this.proactiveDelivery && decision && decision.should_engage_proactively) {
                this.logger.info('Calling ProactiveDeliveryService', 'BackgroundAnalysisService', { 
                    sessionId,
                    decisionKeys: Object.keys(decision)
                });
                
                try {
                    await this.proactiveDelivery.processProactiveDecision(decision, {
                        sessionId,
                        userId,
                        personality: {
                            id: characterId,
                            name: character.name
                        },
                        psychologyState
                    });

                    this.logger.info('Proactive engagement processed successfully', 'BackgroundAnalysisService', { 
                        sessionId, 
                        shouldEngage: decision.should_engage_proactively 
                    });
                } catch (error) {
                    this.logger.error('Error in ProactiveDeliveryService', 'BackgroundAnalysisService', {
                        sessionId,
                        error: error.message
                    });
                }
            } else {
                this.logger.info('Proactive delivery condition not met', 'BackgroundAnalysisService', {
                    sessionId,
                    hasProactiveDelivery: !!this.proactiveDelivery,
                    hasDecision: !!decision,
                    shouldEngage: decision?.should_engage_proactively
                });
            }

        } catch (error) {
            this.logger.error('Proactive analysis failed', 'BackgroundAnalysisService', { 
                sessionId, 
                error: error.message 
            });
        }
    }

    /**
     * Run learning pattern extraction
     */
    async _runLearningExtraction(sessionId, userId, characterId, userMessage, aiResponse) {
        try {
            await this.proactiveLearning.extractPatternsFromEngagements([{
                sessionId,
                userId,
                personalityId: characterId,
                userMessage,
                agentResponse: aiResponse,
                outcome: 'success' // Assume success for completed exchanges
            }]);
        } catch (error) {
            this.logger.error('Learning extraction failed', 'BackgroundAnalysisService', { 
                sessionId, 
                error: error.message 
            });
        }
    }

    /**
     * Parse start time from relative or absolute format
     * Handles: ISO timestamps, "tomorrow 7am", "tonight", etc.
     */
    _parseStartTime(startsAt) {
        if (!startsAt) {
            return new Date().toISOString();
        }

        // If it's already an ISO timestamp, return it
        if (startsAt.match(/^\d{4}-\d{2}-\d{2}T/)) {
            return startsAt;
        }

        // Handle relative times
        const now = new Date();
        const lowerStart = startsAt.toLowerCase();

        // Tomorrow patterns
        if (lowerStart.includes('tomorrow')) {
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            
            // Extract time if specified
            const timeMatch = lowerStart.match(/(\d{1,2})\s*(am|pm)/);
            if (timeMatch) {
                let hours = parseInt(timeMatch[1]);
                if (timeMatch[2] === 'pm' && hours !== 12) hours += 12;
                if (timeMatch[2] === 'am' && hours === 12) hours = 0;
                tomorrow.setHours(hours, 0, 0, 0);
            } else {
                tomorrow.setHours(9, 0, 0, 0); // Default to 9am
            }
            
            return tomorrow.toISOString();
        }

        // Tonight pattern
        if (lowerStart.includes('tonight')) {
            const tonight = new Date(now);
            tonight.setHours(20, 0, 0, 0); // Default to 8pm
            return tonight.toISOString();
        }

        // This evening
        if (lowerStart.includes('evening')) {
            const evening = new Date(now);
            evening.setHours(18, 0, 0, 0); // Default to 6pm
            return evening.toISOString();
        }

        // Default: assume it's today at the current time or parse as date
        try {
            return new Date(startsAt).toISOString();
        } catch {
            return now.toISOString();
        }
    }

    /**
     * Calculate initial next_occurrence based on event type
     * For 'once': next_occurrence = starts_at
     * For recurring: calculate first trigger time based on recurrence_data
     */
    _calculateInitialNextOccurrence(eventData, startsAt) {
        const recurrenceType = eventData.recurrence_type || 'once';
        const recurrenceData = eventData.recurrence_data || {};

        // For one-time events, next_occurrence is starts_at
        if (recurrenceType === 'once') {
            return startsAt;
        }

        // For recurring events, calculate first occurrence
        const startDate = new Date(startsAt);

        if (recurrenceType === 'daily' && recurrenceData.time) {
            // Daily events: use specified time
            const [hours, minutes] = recurrenceData.time.split(':').map(Number);
            const nextDate = new Date(startDate);
            nextDate.setHours(hours, minutes, 0, 0);
            
            // If the time has passed today, schedule for tomorrow
            if (nextDate <= new Date()) {
                nextDate.setDate(nextDate.getDate() + 1);
            }
            
            return nextDate.toISOString();
        }

        if (recurrenceType === 'weekly') {
            // Weekly events: use starts_at as first occurrence
            return startDate.toISOString();
        }

        if (recurrenceType === 'monthly') {
            // Monthly events: use starts_at as first occurrence
            return startDate.toISOString();
        }

        if (recurrenceType === 'yearly') {
            // Yearly events: use starts_at as first occurrence
            return startDate.toISOString();
        }

        // Default: return starts_at
        return startsAt;
    }

    /**
     * Generate unique ID for events
     */
    generateId() {
        const { v4: uuidv4 } = require('uuid');
        return uuidv4();
    }
}

module.exports = BackgroundAnalysisService;
