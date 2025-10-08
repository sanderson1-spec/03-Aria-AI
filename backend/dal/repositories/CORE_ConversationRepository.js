const BaseRepository = require('../CORE_BaseRepository');

/**
 * ConversationRepository - Conversation and memory management with multi-user support
 * CLEAN ARCHITECTURE: Infrastructure layer conversation management
 * 
 * This repository handles:
 * - Message storage and retrieval with user isolation
 * - Multi-user conversation history
 * - User-specific analytics and search
 * - Performance-optimized conversation queries
 */
class ConversationRepository extends BaseRepository {
    constructor(tableName, dependencies) {
        super(tableName, dependencies);
        this.conversationTable = tableName;
        this.memoryWeightsTable = 'character_memory_weights';
    }

    /**
     * ADMIN INTERFACE: Generic findAll method for admin interface
     * Returns all conversation logs (primary table for this repository)
     */
    async findAll() {
        return await super.findAll();
    }

    /**
     * ADMIN INTERFACE: Generic findAllPaginated method for admin interface
     * Provides paginated access to conversation logs
     */
    async findAllPaginated(options = {}) {
        const limit = options.limit || 50;
        const offset = options.offset || 0;
        
        const query = `
            SELECT * FROM ${this.tableName} 
            ORDER BY timestamp DESC 
            LIMIT ? OFFSET ?
        `;
        
        const records = await this.dal.query(query, [limit, offset]);
        return { records, total: records.length };
    }

    /**
     * DOMAIN LAYER: Save a message (MULTI-USER SUPPORT)
     * Core message storage with user isolation
     */
    async saveMessage(userId, chatId, messageData) {
        try {
            const messageId = require('uuid').v4();
            const now = new Date().toISOString();
            
            const message = {
                id: messageId,
                user_id: userId,  // MULTI-USER SUPPORT
                chat_id: chatId,
                sender: messageData.sender,
                message: messageData.message,
                timestamp: now,
                analysis_data: JSON.stringify(messageData.analysis_data || {}),
                created_at: now
            };

            await this.create(message);
            return await this.findById(messageId);
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to save message', { userId, chatId, messageData });
        }
    }

    /**
     * DOMAIN LAYER: Get conversation history (alias for compatibility)
     * Retrieves messages with proper ordering and limits
     */
    async getHistory(sessionId, limit = 50, offset = 0) {
        return await this.getSessionHistory(sessionId, limit, offset);
    }

    /**
     * DOMAIN LAYER: Get conversation history (alias for API compatibility)
     * Retrieves messages with proper ordering and limits
     */
    async getConversationHistory(sessionId, limit = 50, offset = 0) {
        return await this.getSessionHistory(sessionId, limit, offset);
    }

    /**
     * DOMAIN LAYER: Search history (alias for compatibility)
     * Flexible search across message content and metadata
     */
    async searchHistory(sessionId, keywords = [], daysBack = 30, limit = 50) {
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - daysBack);
        
        return await this.searchConversationHistory(sessionId, {
            keywords,
            fromDate: fromDate.toISOString(),
            limit
        });
    }

    /**
     * DOMAIN LAYER: Save memory weights (alias for compatibility)
     * Stores psychological significance weights for messages
     */
    async saveMemoryWeights(sessionId, messageId, weightData) {
        return await this.saveMemoryWeight(sessionId, messageId, weightData);
    }

    /**
     * DOMAIN LAYER: Get weighted context (alias for compatibility)
     * Retrieves messages with memory significance weighting
     */
    async getWeightedContext(sessionId, maxMessages = 10) {
        return await this.getWeightedMemories(sessionId, maxMessages);
    }

    /**
     * DOMAIN LAYER: Save a new message with analysis data
     * Core message storage with comprehensive metadata
     */
    async saveMessage(sessionId, sender, message, agentType = 'chat', analysisData = {}) {
        this.validateRequiredFields(
            { sessionId, sender, message }, 
            ['sessionId', 'sender', 'message'], 
            'save message'
        );

        const messageData = this.sanitizeData({
            chat_id: sessionId,  // Use chat_id instead of session_id
            role: sender,        // Use role instead of sender  
            content: message,    // Use content instead of message
            user_id: analysisData.user_id || 'default-user',  // Add required user_id
            metadata: JSON.stringify(analysisData || {}),  // Store analysis data as JSON metadata
            timestamp: this.getCurrentTimestamp()
        });

        const result = await super.create(messageData, 'conversation_logs');
        
        return {
            ...result,
            messageData: { ...messageData, id: result.id }
        };
    }

    /**
     * DOMAIN LAYER: Get conversation history for a session
     * Retrieves messages with proper ordering and limits
     */
    async getSessionHistory(sessionId, limit = 50, offset = 0) {
        this.validateRequiredFields({ sessionId }, ['sessionId'], 'get session history');
        
        // Use DAL query method directly
        const query = `
            SELECT * FROM ${this.tableName} 
            WHERE chat_id = ? 
            ORDER BY timestamp DESC 
            LIMIT ? OFFSET ?
        `;
        
        const records = await this.dal.query(query, [sessionId, limit, offset]);
        
        return records.reverse(); // Return in chronological order
    }

    /**
     * DOMAIN LAYER: Get recent messages for context building
     * Optimized for conversation context retrieval
     */
    async getRecentMessages(sessionId, count = 10, beforeTimestamp = null) {
        this.validateRequiredFields({ sessionId }, ['sessionId'], 'get recent messages');
        
        // Query parameters will be built dynamically
        
        let query = `
            SELECT * FROM ${this.tableName} 
            WHERE chat_id = ?
        `;
        const params = [sessionId];
        
        if (beforeTimestamp) {
            query += ` AND timestamp < ?`;
            params.push(beforeTimestamp);
        }
        
        query += ` ORDER BY timestamp DESC LIMIT ?`;
        params.push(count);
        
        const records = await this.dal.query(query, params);
        
        return records.reverse(); // Return in chronological order
    }

    /**
     * DOMAIN LAYER: Get messages by topic
     * Retrieves all messages related to a specific topic
     */
    async getMessagesByTopic(sessionId, topicId) {
        this.validateRequiredFields({ sessionId, topicId }, ['sessionId', 'topicId'], 'get messages by topic');
        
        return await super.findAll({
            chat_id: sessionId, // Fixed: use chat_id instead of session_id
            topic_id: topicId
        });
    }

    /**
     * DOMAIN LAYER: Search conversation history
     * Flexible search across message content and metadata
     */
    async searchConversationHistory(sessionId, criteria = {}) {
        this.validateRequiredFields({ sessionId }, ['sessionId'], 'search conversation');
        
        const conditions = { session_id: sessionId };
        
        if (criteria.keywords && criteria.keywords.length > 0) {
            // Note: This is a limitation of the current domain method approach
            // We'll need to enhance the DAL's findWhere to support LIKE and OR conditions
            // For now, we'll just search the first keyword
            conditions.message = { 'LIKE': `%${criteria.keywords[0]}%` };
        }
        
        if (criteria.sender) {
            conditions.sender = criteria.sender;
        }
        
        if (criteria.agentType) {
            conditions.agent_type = criteria.agentType;
        }
        
        // Message type filtering will be handled in SQL query if needed
        
        // Date filtering will be handled in SQL query
        
        let query = `
            SELECT * FROM ${this.tableName} 
            WHERE chat_id = ?
        `;
        const params = [criteria.sessionId];
        
        if (criteria.toDate) {
            query += ` AND timestamp <= ?`;
            params.push(criteria.toDate);
        }
        
        query += ` ORDER BY timestamp DESC LIMIT ?`;
        params.push(criteria.limit || 50);
        
        const records = await this.dal.query(query, params);
        
        return records;
    }

    /**
     * DOMAIN LAYER: Update message analysis data
     * Updates analysis results after processing
     */
    async updateMessageAnalysis(messageId, analysisData) {
        this.validateRequiredFields({ messageId }, ['messageId'], 'update message analysis');
        
        const updateData = this.sanitizeData({
            topic_id: analysisData.topicId,
            is_topic_conclusion: analysisData.isTopicConclusion || false,
            relevance_score: analysisData.relevanceScore,
            message_type: analysisData.messageType,
            context_tags: analysisData.contextTags ? JSON.stringify(analysisData.contextTags) : null,
            emotional_context: analysisData.emotionalContext
        });

        return await super.update(messageId, updateData);
    }

    /**
     * DOMAIN LAYER: Get conversation summary statistics
     * Provides insights into conversation patterns
     */
    async getConversationSummary(sessionId, daysBack = 7) {
        this.validateRequiredFields({ sessionId }, ['sessionId'], 'get conversation summary');
        
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysBack);
        
        const sql = `
            SELECT 
                COUNT(*) as total_messages,
                COUNT(CASE WHEN sender = 'user' THEN 1 END) as user_messages,
                COUNT(CASE WHEN sender = 'assistant' THEN 1 END) as assistant_messages,
                COUNT(DISTINCT topic_id) as unique_topics,
                COUNT(CASE WHEN is_topic_conclusion = 1 THEN 1 END) as topic_conclusions,
                AVG(relevance_score) as average_relevance,
                MIN(timestamp) as first_message,
                MAX(timestamp) as last_message,
                COUNT(CASE WHEN message_type = 'question' THEN 1 END) as questions,
                COUNT(CASE WHEN message_type = 'answer' THEN 1 END) as answers
            FROM ${this.conversationTable}
            WHERE session_id = ? AND timestamp >= ?
        `;
        
        return await super.queryOne(sql, [sessionId, cutoffDate.toISOString()]);
    }

    // ========================================================================
    // MEMORY WEIGHT MANAGEMENT
    // ========================================================================

    /**
     * DOMAIN LAYER: Save memory weights for a message
     * Stores psychological significance scoring for memory recall
     */
    async saveMemoryWeight(sessionId, messageId, weightData) {
        this.validateRequiredFields(
            { sessionId, messageId, weightData }, 
            ['sessionId', 'messageId', 'weightData'], 
            'save memory weight'
        );

        const memoryWeight = this.sanitizeData({
            id: this.generateId(),
            session_id: sessionId,
            message_id: messageId,
            emotional_impact_score: weightData.emotional_impact_score || 5,
            relationship_relevance: weightData.relationship_relevance || 5,
            personal_significance: weightData.personal_significance || 5,
            contextual_importance: weightData.contextual_importance || 5,
            memory_type: weightData.memory_type || 'conversational',
            memory_tags: weightData.memory_tags || [],
            recall_frequency: 0,
            created_at: this.getCurrentTimestamp(),
            updated_at: this.getCurrentTimestamp()
        });

        return await super.create(memoryWeight);
    }

    /**
     * DOMAIN LAYER: Get weighted memories for context building
     * Retrieves messages ordered by psychological significance
     */
    async getWeightedMemories(sessionId, maxMessages = 10, minTotalWeight = 0) {
        this.validateRequiredFields({ sessionId }, ['sessionId'], 'get weighted memories');
        
        const sql = `
            SELECT 
                cl.*,
                cmw.emotional_impact_score,
                cmw.relationship_relevance,
                cmw.personal_significance,
                cmw.contextual_importance,
                cmw.memory_type,
                cmw.memory_tags,
                cmw.recall_frequency,
                (COALESCE(cmw.emotional_impact_score, 5) + 
                 COALESCE(cmw.relationship_relevance, 5) + 
                 COALESCE(cmw.personal_significance, 5) + 
                 COALESCE(cmw.contextual_importance, 5)) as total_weight
            FROM ${this.conversationTable} cl
            LEFT JOIN ${this.memoryWeightsTable} cmw ON cl.id = cmw.message_id AND cl.session_id = cmw.session_id
            WHERE cl.session_id = ?
            ${minTotalWeight > 0 ? 'HAVING total_weight >= ?' : ''}
            ORDER BY 
                total_weight DESC,
                cmw.recall_frequency DESC,
                cl.timestamp DESC
            LIMIT ?
        `;
        
        const params = [sessionId];
        if (minTotalWeight > 0) {
            params.push(minTotalWeight);
        }
        params.push(maxMessages);
        
        return await super.query(sql, params);
    }

    /**
     * DOMAIN LAYER: Increment memory recall frequency
     * Tracks how often memories are accessed for significance tracking
     */
    async incrementMemoryRecall(sessionId, messageId) {
        this.validateRequiredFields({ sessionId, messageId }, ['sessionId', 'messageId'], 'increment recall');
        
        const sql = `
            UPDATE ${this.memoryWeightsTable} 
            SET recall_frequency = recall_frequency + 1, 
                last_recalled = ?,
                updated_at = ?
            WHERE session_id = ? AND message_id = ?
        `;
        
        const timestamp = this.getCurrentTimestamp();
        return await super.query(sql, [timestamp, timestamp, sessionId, messageId]);
    }

    /**
     * DOMAIN LAYER: Update memory weights
     * Adjusts psychological significance scores based on new insights
     */
    async updateMemoryWeights(sessionId, messageId, updates) {
        this.validateRequiredFields({ sessionId, messageId }, ['sessionId', 'messageId'], 'update memory weights');
        
        const updateData = this.sanitizeData({
            ...updates,
            updated_at: this.getCurrentTimestamp()
        });

        return await super.update(
            this.memoryWeightsTable, 
            updateData, 
            'session_id = ? AND message_id = ?', 
            [sessionId, messageId]
        );
    }

    /**
     * DOMAIN LAYER: Get memory weight statistics
     * Provides insights into memory significance patterns
     */
    async getMemoryWeightStatistics(sessionId) {
        this.validateRequiredFields({ sessionId }, ['sessionId'], 'get memory statistics');
        
        const sql = `
            SELECT 
                COUNT(*) as total_weighted_memories,
                AVG(emotional_impact_score) as avg_emotional_impact,
                AVG(relationship_relevance) as avg_relationship_relevance,
                AVG(personal_significance) as avg_personal_significance,
                AVG(contextual_importance) as avg_contextual_importance,
                MAX(recall_frequency) as max_recall_frequency,
                AVG(recall_frequency) as avg_recall_frequency,
                COUNT(CASE WHEN memory_type = 'emotional' THEN 1 END) as emotional_memories,
                COUNT(CASE WHEN memory_type = 'factual' THEN 1 END) as factual_memories,
                COUNT(CASE WHEN memory_type = 'relational' THEN 1 END) as relational_memories
            FROM ${this.memoryWeightsTable}
            WHERE session_id = ?
        `;
        
        return await super.queryOne(sql, [sessionId]);
    }

    /**
     * DOMAIN LAYER: Get top recalled memories
     * Identifies most frequently accessed memories
     */
    async getTopRecalledMemories(sessionId, limit = 10) {
        this.validateRequiredFields({ sessionId }, ['sessionId'], 'get top recalled memories');
        
        const sql = `
            SELECT 
                cl.*,
                cmw.recall_frequency,
                cmw.memory_type,
                cmw.emotional_impact_score,
                cmw.last_recalled
            FROM ${this.memoryWeightsTable} cmw
            JOIN ${this.conversationTable} cl ON cmw.message_id = cl.id AND cmw.session_id = cl.session_id
            WHERE cmw.session_id = ? AND cmw.recall_frequency > 0
            ORDER BY cmw.recall_frequency DESC, cmw.last_recalled DESC
            LIMIT ?
        `;
        
        return await super.query(sql, [sessionId, limit]);
    }

    // ========================================================================
    // ANALYTICS AND CLEANUP
    // ========================================================================

    /**
     * ANALYTICS LAYER: Get conversation analytics
     * Comprehensive conversation analysis and metrics
     */
    async getConversationAnalytics(sessionId, daysBack = 30) {
        this.validateRequiredFields({ sessionId }, ['sessionId'], 'get conversation analytics');
        
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysBack);
        
        const sql = `
            SELECT 
                DATE(timestamp) as conversation_date,
                COUNT(*) as messages_per_day,
                COUNT(CASE WHEN sender = 'user' THEN 1 END) as user_messages_per_day,
                COUNT(CASE WHEN sender = 'assistant' THEN 1 END) as assistant_messages_per_day,
                AVG(relevance_score) as avg_relevance_per_day,
                COUNT(DISTINCT topic_id) as topics_per_day,
                AVG(LENGTH(message)) as avg_message_length
            FROM ${this.conversationTable}
            WHERE session_id = ? AND timestamp >= ?
            GROUP BY DATE(timestamp)
            ORDER BY conversation_date DESC
        `;
        
        return await super.query(sql, [sessionId, cutoffDate.toISOString()]);
    }

    /**
     * ANALYTICS LAYER: Get topic distribution
     * Shows how topics are distributed across conversations
     */
    async getTopicDistribution(sessionId, limit = 20) {
        this.validateRequiredFields({ sessionId }, ['sessionId'], 'get topic distribution');
        
        const sql = `
            SELECT 
                topic_id,
                COUNT(*) as message_count,
                COUNT(CASE WHEN is_topic_conclusion = 1 THEN 1 END) as conclusions,
                AVG(relevance_score) as avg_relevance,
                MIN(timestamp) as first_mention,
                MAX(timestamp) as last_mention
            FROM ${this.conversationTable}
            WHERE session_id = ? AND topic_id IS NOT NULL
            GROUP BY topic_id
            ORDER BY message_count DESC, avg_relevance DESC
            LIMIT ?
        `;
        
        return await super.query(sql, [sessionId, limit]);
    }

    /**
     * ANALYTICS LAYER: Get memory significance analysis
     * Comprehensive analysis of memory weights and significance patterns
     */
    async getMemorySignificanceAnalysis(sessionId, options = {}) {
        this.validateRequiredFields({ sessionId }, ['sessionId'], 'get memory significance analysis');
        
        const { limit = 50, minSignificance = 20 } = options;
        
        try {
            // Get significant memories with message content
            const significantMemoriesSql = `
                SELECT 
                    cmw.*,
                    cl.message,
                    cl.timestamp,
                    cl.sender,
                    (cmw.emotional_impact_score + cmw.relationship_relevance + 
                     cmw.personal_significance + cmw.contextual_importance) as total_significance
                FROM ${this.memoryWeightsTable} cmw
                JOIN ${this.conversationTable} cl ON cmw.message_id = cl.id
                WHERE cmw.session_id = ? 
                AND (cmw.emotional_impact_score + cmw.relationship_relevance + 
                     cmw.personal_significance + cmw.contextual_importance) >= ?
                ORDER BY total_significance DESC, cmw.created_at DESC
                LIMIT ?
            `;
            
            const significantMemories = await super.query(significantMemoriesSql, [sessionId, minSignificance, limit]);
            
            // Get memory distribution statistics
            const distributionSql = `
                SELECT 
                    COUNT(*) as total_memories,
                    AVG(emotional_impact_score + relationship_relevance + 
                        personal_significance + contextual_importance) as avg_significance,
                    MAX(emotional_impact_score + relationship_relevance + 
                        personal_significance + contextual_importance) as max_significance,
                    MIN(emotional_impact_score + relationship_relevance + 
                        personal_significance + contextual_importance) as min_significance,
                    COUNT(DISTINCT memory_type) as memory_types_count
                FROM ${this.memoryWeightsTable}
                WHERE session_id = ?
            `;
            
            const distribution = await super.queryOne(distributionSql, [sessionId]);
            
            // Get memory type breakdown
            const typeBreakdownSql = `
                SELECT 
                    memory_type,
                    COUNT(*) as count,
                    AVG(emotional_impact_score + relationship_relevance + 
                        personal_significance + contextual_importance) as avg_significance
                FROM ${this.memoryWeightsTable}
                WHERE session_id = ?
                GROUP BY memory_type
                ORDER BY avg_significance DESC
            `;
            
            const typeBreakdown = await super.query(typeBreakdownSql, [sessionId]);
            
            return {
                sessionId,
                significantMemories,
                memoryDistribution: {
                    totalMemories: distribution?.total_memories || 0,
                    averageSignificance: distribution?.avg_significance || 0,
                    maxSignificance: distribution?.max_significance || 0,
                    minSignificance: distribution?.min_significance || 0,
                    memoryTypesCount: distribution?.memory_types_count || 0
                },
                typeBreakdown,
                filters: { minSignificance, limit }
            };
            
        } catch (error) {
            return {
                sessionId,
                error: error.message,
                significantMemories: [],
                memoryDistribution: {},
                typeBreakdown: [],
                totalMemories: 0,
                averageSignificance: 0
            };
        }
    }

    // ========================================================================
    // CHAT MANAGEMENT METHODS (Eliminates SQL from database.js)
    // ========================================================================

    /**
     * Create a new chat session
     * Replaces database.js createChat method
     */
    async createChat(chatData) {
        const { agentType = 'main', title = null, personalityId = null } = chatData;
        const chatId = require('uuid').v4();
        const chatTitle = title || this.generateChatTitle(agentType, personalityId);
        
        const sql = `INSERT INTO chats (id, title, agent_type, personality_id, created_at, updated_at) 
                     VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`;
        
        await super.query(sql, [chatId, chatTitle, agentType, personalityId]);
        
        return chatId;
    }

    /**
     * Update chat metadata
     * Replaces database.js updateChatMetadata method
     */
    async updateChatMetadata(chatId, updates) {
        const allowedFields = ['title', 'personality_id', 'is_archived', 'last_message_preview', 'message_count'];
        const fields = [];
        const values = [];
        
        Object.keys(updates).forEach(key => {
            if (allowedFields.includes(key) && updates[key] !== undefined) {
                fields.push(`${key} = ?`);
                values.push(updates[key]);
            }
        });
        
        if (fields.length === 0) {
            return false;
        }
        
        fields.push('updated_at = CURRENT_TIMESTAMP');
        values.push(chatId);
        
        const sql = `UPDATE chats SET ${fields.join(', ')} WHERE id = ?`;
        const result = await super.query(sql, values);
        
        return result.changes > 0;
    }

    /**
     * Get list of chats
     * Replaces database.js getChatsList method
     */
    async getChatsList(limit = 50, includeArchived = false) {
        let sql = `SELECT * FROM chats WHERE 1=1`;
        const params = [];
        
        if (!includeArchived) {
            sql += ` AND (is_archived = 0 OR is_archived IS NULL)`;
        }
        
        sql += ` ORDER BY updated_at DESC LIMIT ?`;
        params.push(limit);
        
        return await super.query(sql, params);
    }

    /**
     * Get chat by ID
     * Replaces database.js getChatById method
     */
    async getChatById(chatId) {
        const sql = `SELECT * FROM chats WHERE id = ?`;
        return await this.dal.queryOne(sql, [chatId]);
    }

    /**
     * Find chats with specific personality
     * Replaces database.js findChatsWithPersonality method
     */
    async findChatsWithPersonality(personalityId, limit = 5) {
        const sql = `SELECT * FROM chats WHERE personality_id = ? ORDER BY updated_at DESC LIMIT ?`;
        return await this.dal.query(sql, [personalityId, limit]);
    }

    /**
     * Delete a chat and all its messages
     * Replaces database.js deleteChat method
     */
    async deleteChat(chatId) {
        // Delete conversation logs
        const messagesResult = await this.dal.execute(
            `DELETE FROM conversation_logs WHERE session_id = ?`, 
            [chatId]
        );
        
        // Delete memory weights
        await this.dal.execute(
            `DELETE FROM character_memory_weights WHERE session_id = ?`, 
            [chatId]
        );

        // Delete the chat
        const chatResult = await this.dal.execute(
            `DELETE FROM chats WHERE id = ?`, 
            [chatId]
        );
        
        return {
            chatDeleted: chatResult.changes > 0,
            messagesDeleted: messagesResult.changes,
            success: chatResult.changes > 0
        };
    }

    /**
     * Update chat after message
     * Replaces database.js updateChatAfterMessage method
     */
    async updateChatAfterMessage(chatId, message, sender) {
        const preview = sender === 'user' 
            ? `You: ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`
            : message.substring(0, 100) + (message.length > 100 ? '...' : '');
        
        const sql = `UPDATE chats SET 
                     last_message_preview = ?, 
                     message_count = message_count + 1, 
                     updated_at = CURRENT_TIMESTAMP 
                     WHERE id = ?`;
        
        const result = await super.query(sql, [preview, chatId]);
        return result.changes > 0;
    }

    /**
     * Generate chat title based on agent type and personality
     */
    generateChatTitle(agentType, personalityId) {
        const timestamp = new Date().toLocaleString();
        if (personalityId && personalityId !== 'default') {
            return `Chat with ${personalityId} - ${timestamp}`;
        }
        return `${agentType.charAt(0).toUpperCase() + agentType.slice(1)} Chat - ${timestamp}`;
    }

    /**
     * INFRASTRUCTURE LAYER: Clean up old messages
     * Removes old conversation data based on retention policy
     */
    async cleanupOldMessages(daysOld = 30, preserveWeightedMemories = true) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysOld);
        
        return await super.executeInTransaction(async () => {
            let deletedMessages = 0;
            let deletedWeights = 0;
            
            if (preserveWeightedMemories) {
                // Delete only messages without memory weights
                const sql = `
                    DELETE FROM ${this.conversationTable} 
                    WHERE created_at < ? 
                    AND id NOT IN (
                        SELECT DISTINCT message_id 
                        FROM ${this.memoryWeightsTable}
                    )
                `;
                const result = await super.query(sql, [cutoffDate.toISOString()]);
                deletedMessages = result.changes;
            } else {
                // Delete all old messages and their weights
                const weightResult = await super.query(
                    `DELETE FROM ${this.memoryWeightsTable} WHERE created_at < ?`,
                    [cutoffDate.toISOString()]
                );
                deletedWeights = weightResult.changes;
                
                const messageResult = await super.query(
                    `DELETE FROM ${this.conversationTable} WHERE created_at < ?`,
                    [cutoffDate.toISOString()]
                );
                deletedMessages = messageResult.changes;
            }
            
            return {
                deletedMessages,
                deletedWeights,
                cutoffDate: cutoffDate.toISOString(),
                preservedWeightedMemories: preserveWeightedMemories
            };
        });
    }

    /**
     * INFRASTRUCTURE LAYER: Clean up session data
     * Removes all conversation data for a specific session
     */
    async cleanupSessionData(sessionId) {
        this.validateRequiredFields({ sessionId }, ['sessionId'], 'cleanup session');
        
        return await super.executeInTransaction(async () => {
            const weightResult = await super.delete(this.memoryWeightsTable, 'session_id = ?', [sessionId]);
            const messageResult = await super.delete(this.conversationTable, 'session_id = ?', [sessionId]);
            
            return {
                deletedMessages: messageResult.deletedCount,
                deletedWeights: weightResult.deletedCount,
                sessionId
            };
        });
    }

    /**
     * UTILITY: Get table names
     * Required by base repository interface
     */
    getTableName() {
        return this.conversationTable;
    }

    getMemoryWeightsTableName() {
        return this.memoryWeightsTable;
    }

    /**
     * INFRASTRUCTURE LAYER: Validate conversation data
     * Business rule validation for conversation entities
     */
    validateEntityData(data, operation = 'create') {
        super.validateEntityData(data, operation);
        
        if (operation === 'create') {
            if (!data.message || data.message.trim().length === 0) {
                throw new Error('Message content is required');
            }
            
            if (data.message.length > 10000) {
                throw new Error('Message content must be 10000 characters or less');
            }
            
            if (!['user', 'assistant', 'system'].includes(data.sender)) {
                throw new Error('Sender must be user, assistant, or system');
            }
        }
        
        if (data.relevance_score !== undefined) {
            const score = parseInt(data.relevance_score);
            if (isNaN(score) || score < 0 || score > 100) {
                throw new Error('Relevance score must be between 0 and 100');
            }
        }
    }

    /**
     * DOMAIN LAYER: Standard repository interface implementations
     */
    async findById(id) {
        return await super.findById(this.conversationTable, id);
    }

    async create(data) {
        return await this.saveMessage(
            data.session_id, 
            data.sender, 
            data.message, 
            data.agent_type, 
            data.analysisData || {}
        );
    }

    async update(id, data) {
        return await super.update(this.conversationTable, data, 'id = ?', [id]);
    }

    async delete(id) {
        return await super.delete(this.conversationTable, 'id = ?', [id]);
    }

    /**
     * DOMAIN LAYER: Get recent conversation history across all sessions
     * Used when no specific session ID is provided
     */
    async getAllRecentHistory(limit = 100) {
        const sql = `
            SELECT * FROM ${this.conversationTable} 
            ORDER BY timestamp DESC 
            LIMIT ?
        `;
        
        return await super.query(sql, [limit]);
    }

    /**
     * DOMAIN LAYER: Access character memory weights (MULTI-TABLE SUPPORT)
     */
    async getCharacterMemoryWeights(userId, characterId, limit = 50) {
        try {
            const sql = `
                SELECT * FROM character_memory_weights 
                WHERE user_id = ? AND character_id = ?
                ORDER BY updated_at DESC
                LIMIT ?
            `;
            return await this.dal.query(sql, [userId, characterId, limit]);
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to get character memory weights', { userId, characterId, limit });
        }
    }

    /**
     * DOMAIN LAYER: Save character memory weight (MULTI-TABLE SUPPORT)
     */
    async saveCharacterMemoryWeight(userId, characterId, memoryData) {
        try {
            const weightId = require('uuid').v4();
            const now = new Date().toISOString();
            
            const weight = {
                id: weightId,
                user_id: userId,
                character_id: characterId,
                message_id: memoryData.message_id,
                weight_value: memoryData.weight_value || 1.0,
                memory_type: memoryData.memory_type || 'conversational',
                context_data: JSON.stringify(memoryData.context_data || {}),
                created_at: now,
                updated_at: now
            };

            const sql = `
                INSERT INTO character_memory_weights 
                (id, user_id, character_id, message_id, weight_value, memory_type, context_data, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            await this.dal.execute(sql, [
                weight.id, weight.user_id, weight.character_id, weight.message_id,
                weight.weight_value, weight.memory_type, weight.context_data,
                weight.created_at, weight.updated_at
            ]);
            
            return weightId;
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to save character memory weight', { userId, characterId, memoryData });
        }
    }
}

module.exports = ConversationRepository; 