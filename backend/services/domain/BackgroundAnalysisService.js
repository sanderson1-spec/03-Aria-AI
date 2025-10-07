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
            await this.proactiveLearning.extractPatternsFromEngagement({
                sessionId,
                userId,
                personalityId: characterId,
                userMessage,
                agentResponse: aiResponse,
                outcome: 'success' // Assume success for completed exchanges
            });
        } catch (error) {
            this.logger.error('Learning extraction failed', 'BackgroundAnalysisService', { 
                sessionId, 
                error: error.message 
            });
        }
    }
}

module.exports = BackgroundAnalysisService;
