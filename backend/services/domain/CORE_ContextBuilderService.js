const AbstractService = require('../base/CORE_AbstractService');

/**
 * CORE_ContextBuilderService
 * Builds unified context for LLM conversations by gathering and organizing
 * recent messages, psychology state, memories, commitments, and events.
 */
class ContextBuilderService extends AbstractService {
    constructor(dependencies) {
        super('ContextBuilderService', dependencies);
        this.logger = dependencies.logger;
        this.errorHandler = dependencies.errorHandling;
        this.database = dependencies.database;
        this.dal = this.database.getDAL();
        this.llmConfig = dependencies.llmConfig;
        this.psychology = dependencies.psychology;
    }

    async onInitialize() {
        this.logger.info('ContextBuilderService initialized', 'ContextBuilderService');
    }

    /**
     * Build unified context for LLM conversation
     * @param {number} userId - User ID
     * @param {number} chatId - Chat ID
     * @param {number} characterId - Character ID
     * @returns {Promise<Object>} Unified context object
     */
    async buildUnifiedContext(userId, chatId, characterId) {
        try {
            this.logger.debug('Building unified context', 'ContextBuilderService', { 
                userId, 
                chatId, 
                characterId 
            });

            // Resolve context window size
            const windowSize = await this.resolveContextWindow(userId, characterId, 'conversational');

            // Gather all context in parallel
            const [
                recentMessages,
                psychologyState,
                topMemories,
                activeCommitments,
                upcomingEvents,
                recentCompletions
            ] = await Promise.all([
                this.getRecentMessages(chatId, windowSize),
                this.psychology.getState(userId, chatId, characterId),
                this.dal.memories.getTopWeightedMemories(userId, chatId, 10),
                this.dal.commitments.getActiveCommitments(userId),
                this.dal.events.getUpcomingEvents(userId, 5),
                this.getRecentCompletions(userId)
            ]);

            const context = {
                recentMessages,
                psychologyState,
                topMemories,
                activeCommitments,
                upcomingEvents,
                recentCompletions
            };

            this.logger.debug('Unified context built successfully', 'ContextBuilderService', {
                userId,
                chatId,
                messageCount: recentMessages.length,
                memoryCount: topMemories.length,
                commitmentCount: activeCommitments.length,
                eventCount: upcomingEvents.length
            });

            return context;
        } catch (error) {
            throw this.errorHandler.wrapDomainError(
                error,
                'Failed to build unified context',
                { userId, chatId, characterId }
            );
        }
    }

    /**
     * Get recent messages for a chat
     * @param {number} chatId - Chat ID
     * @param {number} windowSize - Number of messages to retrieve
     * @returns {Promise<Array>} Array of recent messages
     */
    async getRecentMessages(chatId, windowSize) {
        try {
            this.logger.debug('Retrieving recent messages', 'ContextBuilderService', { 
                chatId, 
                windowSize 
            });

            const messages = await this.dal.conversationLogs.getRecentMessages(chatId, windowSize);

            return messages;
        } catch (error) {
            throw this.errorHandler.wrapDomainError(
                error,
                'Failed to retrieve recent messages',
                { chatId, windowSize }
            );
        }
    }

    /**
     * Resolve context window size with cascade logic
     * Character override → User preference → Global config → Default 30
     * @param {number} userId - User ID
     * @param {number} characterId - Character ID
     * @param {string} role - LLM role (conversational/analytical)
     * @returns {Promise<number>} Context window size
     */
    async resolveContextWindow(userId, characterId, role) {
        try {
            this.logger.debug('Resolving context window', 'ContextBuilderService', { 
                userId, 
                characterId, 
                role 
            });

            // Get all preferences in parallel
            const [characterPrefs, userPrefs, globalConfig] = await Promise.all([
                this.llmConfig.getCharacterPreferences(characterId),
                this.llmConfig.getUserPreferences(userId),
                this.llmConfig.getGlobalConfig()
            ]);

            // Cascade resolution
            let contextWindow;

            // 1. Character override
            if (characterPrefs?.[role]?.context_window_messages) {
                contextWindow = characterPrefs[role].context_window_messages;
                this.logger.debug('Using character context window', 'ContextBuilderService', { 
                    contextWindow 
                });
            }
            // 2. User preference
            else if (userPrefs?.[role]?.context_window_messages) {
                contextWindow = userPrefs[role].context_window_messages;
                this.logger.debug('Using user context window', 'ContextBuilderService', { 
                    contextWindow 
                });
            }
            // 3. Global config
            else if (globalConfig?.context_window_messages) {
                contextWindow = globalConfig.context_window_messages;
                this.logger.debug('Using global context window', 'ContextBuilderService', { 
                    contextWindow 
                });
            }
            // 4. Default fallback
            else {
                contextWindow = 30;
                this.logger.debug('Using default context window', 'ContextBuilderService', { 
                    contextWindow 
                });
            }

            return contextWindow;
        } catch (error) {
            throw this.errorHandler.wrapDomainError(
                error,
                'Failed to resolve context window',
                { userId, characterId, role }
            );
        }
    }

    /**
     * Get recent completions (commitments and events)
     * @param {number} userId - User ID
     * @returns {Promise<Array>} Array of recent completions
     */
    async getRecentCompletions(userId) {
        try {
            const [completedCommitments, completedEvents] = await Promise.all([
                this.dal.commitments.getRecentCompletedCommitments(userId, 3),
                this.dal.events.getRecentCompletedEvents(userId, 3)
            ]);

            // Combine and sort by completion date
            const completions = [
                ...completedCommitments.map(c => ({ ...c, type: 'commitment' })),
                ...completedEvents.map(e => ({ ...e, type: 'event' }))
            ].sort((a, b) => {
                const dateA = new Date(a.completed_at || a.updated_at);
                const dateB = new Date(b.completed_at || b.updated_at);
                return dateB - dateA;
            }).slice(0, 3);

            return completions;
        } catch (error) {
            throw this.errorHandler.wrapDomainError(
                error,
                'Failed to retrieve recent completions',
                { userId }
            );
        }
    }
}

module.exports = ContextBuilderService;
