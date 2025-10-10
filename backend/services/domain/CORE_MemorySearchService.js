const AbstractService = require('../base/CORE_AbstractService');

/**
 * CORE_MemorySearchService
 * Provides intelligent memory search capabilities using LLM-based intent analysis
 * and semantic filtering to retrieve relevant past conversation context.
 */
class MemorySearchService extends AbstractService {
    constructor(dependencies) {
        super('MemorySearchService', dependencies);
        this.logger = dependencies.logger;
        this.errorHandler = dependencies.errorHandling;
        this.database = dependencies.database;
        this.dal = this.database.getDAL();
        this.structuredResponse = dependencies.structuredResponse;
    }

    async onInitialize() {
        this.logger.info('MemorySearchService initialized', 'MemorySearchService');
    }

    /**
     * Analyze user message to determine if deep memory search is needed
     * @param {string} userMessage - The current user message
     * @param {Array} recentContext - Recent messages for context (last 5)
     * @returns {Promise<Object>} Search intent analysis
     */
    async analyzeSearchIntent(userMessage, recentContext) {
        try {
            this.logger.debug('Analyzing search intent', 'MemorySearchService', {
                messageLength: userMessage.length,
                contextSize: recentContext.length
            });

            const recentContextText = recentContext
                .map(m => `[${m.role}]: ${m.content}`)
                .join('\n');

            const prompt = `User message: "${userMessage}"
Recent context (last 5 messages): ${recentContextText}

Does the user's message reference past information not in recent context?

Examples that NEED search:
- "Like I told you last week..."
- "Remember my ACL injury?"
- "What about that task from September?"

Examples that DON'T need search:
- "Good morning!"
- "How are you?"
- References to recent messages

Respond with JSON:
{
  "needs_search": boolean,
  "search_query": "semantic description of what to find" or null,
  "reasoning": "why search is/isn't needed"
}`;

            const schema = {
                type: 'object',
                properties: {
                    needs_search: { type: 'boolean' },
                    search_query: { type: ['string', 'null'] },
                    reasoning: { type: 'string' }
                },
                required: ['needs_search', 'reasoning']
            };

            const searchIntent = await this.structuredResponse.generateStructuredResponse(
                prompt,
                schema,
                {
                    model: 'qwen',
                    temperature: 0.1,
                    maxTokens: 200
                }
            );

            this.logger.debug('Search intent analyzed', 'MemorySearchService', {
                needsSearch: searchIntent.needs_search,
                hasQuery: !!searchIntent.search_query
            });

            return searchIntent;
        } catch (error) {
            throw this.errorHandler.wrapDomainError(
                error,
                'Failed to analyze search intent',
                { userMessage, contextSize: recentContext.length }
            );
        }
    }

    /**
     * Search for significant memories excluding recent context
     * @param {number} chatId - Chat session ID
     * @param {Array<number>} excludeMessageIds - Message IDs to exclude (recent context)
     * @param {number} significanceThreshold - Minimum significance score (1-10)
     * @returns {Promise<Array>} Array of significant memory objects
     */
    async searchSignificantMemories(chatId, excludeMessageIds, significanceThreshold) {
        try {
            this.logger.debug('Searching significant memories', 'MemorySearchService', {
                chatId,
                excludeCount: excludeMessageIds.length,
                threshold: significanceThreshold
            });

            const memories = await this.dal.memories.getSignificantMemories(
                chatId,
                excludeMessageIds,
                significanceThreshold
            );

            this.logger.debug('Significant memories retrieved', 'MemorySearchService', {
                chatId,
                memoryCount: memories.length
            });

            return memories;
        } catch (error) {
            throw this.errorHandler.wrapDomainError(
                error,
                'Failed to search significant memories',
                { chatId, excludeCount: excludeMessageIds.length, significanceThreshold }
            );
        }
    }

    /**
     * Filter memories for relevance using LLM-based semantic analysis
     * @param {Array} memories - Candidate memories to filter
     * @param {string} searchQuery - Semantic search query
     * @returns {Promise<Array>} Filtered relevant memories (5-10 most relevant)
     */
    async filterRelevantMemories(memories, searchQuery) {
        try {
            this.logger.debug('Filtering relevant memories', 'MemorySearchService', {
                candidateCount: memories.length,
                searchQuery
            });

            if (memories.length === 0) {
                return [];
            }

            const memoriesText = memories
                .map((m, i) => `${i + 1}. [${m.timestamp}] ${m.content}`)
                .join('\n');

            const prompt = `Search query: "${searchQuery}"

Candidate memories (${memories.length} total):
${memoriesText}

Which memories are relevant to the search query?
Return the indices of relevant memories (1-based).

Respond with JSON:
{
  "relevant_indices": [1, 5, 12, ...],
  "reasoning": "why these are relevant"
}`;

            const schema = {
                type: 'object',
                properties: {
                    relevant_indices: {
                        type: 'array',
                        items: { type: 'integer' }
                    },
                    reasoning: { type: 'string' }
                },
                required: ['relevant_indices', 'reasoning']
            };

            const filterResult = await this.structuredResponse.generateStructuredResponse(
                prompt,
                schema,
                {
                    model: 'qwen',
                    temperature: 0.1,
                    maxTokens: 300
                }
            );

            // Convert 1-based indices to actual memory objects
            const relevantMemories = filterResult.relevant_indices
                .filter(idx => idx >= 1 && idx <= memories.length)
                .map(idx => memories[idx - 1])
                .slice(0, 10); // Limit to top 10

            this.logger.debug('Memories filtered', 'MemorySearchService', {
                candidateCount: memories.length,
                relevantCount: relevantMemories.length,
                reasoning: filterResult.reasoning
            });

            return relevantMemories;
        } catch (error) {
            throw this.errorHandler.wrapDomainError(
                error,
                'Failed to filter relevant memories',
                { candidateCount: memories.length, searchQuery }
            );
        }
    }

    /**
     * Execute deep memory search with intent analysis and semantic filtering
     * @param {number} chatId - Chat session ID
     * @param {string} userMessage - Current user message
     * @param {Array<number>} recentMessageIds - Message IDs to exclude from search
     * @param {number} significanceThreshold - Minimum significance score
     * @returns {Promise<Array|null>} Relevant memories or null if search not needed
     */
    async executeDeepSearch(chatId, userMessage, recentMessageIds, significanceThreshold) {
        try {
            this.logger.debug('Executing deep search', 'MemorySearchService', {
                chatId,
                recentMessageCount: recentMessageIds.length,
                threshold: significanceThreshold
            });

            // Get recent messages for context
            const recentMessages = await this.dal.conversations.getMessagesByIds(recentMessageIds);

            // Step 1: Analyze search intent
            const searchIntent = await this.analyzeSearchIntent(userMessage, recentMessages);

            if (!searchIntent.needs_search) {
                this.logger.debug('Search not needed', 'MemorySearchService', {
                    reasoning: searchIntent.reasoning
                });
                return null;
            }

            this.logger.info('Deep search triggered', 'MemorySearchService', {
                chatId,
                searchQuery: searchIntent.search_query
            });

            // Step 2: Search significant memories
            const candidateMemories = await this.searchSignificantMemories(
                chatId,
                recentMessageIds,
                significanceThreshold
            );

            if (candidateMemories.length === 0) {
                this.logger.debug('No candidate memories found', 'MemorySearchService', { chatId });
                return [];
            }

            // Step 3: Filter for relevance
            const relevantMemories = await this.filterRelevantMemories(
                candidateMemories,
                searchIntent.search_query
            );

            this.logger.info('Deep search completed', 'MemorySearchService', {
                chatId,
                candidateCount: candidateMemories.length,
                relevantCount: relevantMemories.length
            });

            return relevantMemories;
        } catch (error) {
            throw this.errorHandler.wrapDomainError(
                error,
                'Failed to execute deep search',
                { chatId, recentMessageCount: recentMessageIds.length, significanceThreshold }
            );
        }
    }
}

module.exports = MemorySearchService;
