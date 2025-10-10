const BaseRepository = require('../CORE_BaseRepository');

/**
 * ChatRepository - Handles chat session management with multi-user support
 * CLEAN ARCHITECTURE: Infrastructure layer chat management
 */
class ChatRepository extends BaseRepository {
    constructor(tableName, dependencies) {
        super(tableName, dependencies);
    }

    /**
     * Get image reference for personality
     * For uploaded images, return an API reference instead of full base64
     * This prevents localStorage and request headers from becoming too large
     */
    _getImageReference(personality_id, personality_display, image_type) {
        if (image_type === 'upload') {
            // Return API reference instead of base64 data
            return `character-${personality_id}`;
        }
        return personality_display;
    }

    /**
     * Get paginated chats for user (MULTI-USER SUPPORT)
     * CLEAN ARCHITECTURE: Domain layer pagination with user isolation
     */
    async getUserChats(userId, page = 1, pageSize = 10) {
        try {
            const offset = (page - 1) * pageSize;
            
            const sql = `
                SELECT c.*, p.id as personality_id_ref, p.name as personality_name, p.display as personality_display,
                       p.image_type
                FROM ${this.tableName} c
                LEFT JOIN personalities p ON c.personality_id = p.id
                WHERE c.user_id = ? AND c.is_active = 1
                ORDER BY c.updated_at DESC
                LIMIT ? OFFSET ?
            `;
            
            const chats = await this.dal.query(sql, [userId, pageSize, offset]);
            
            // Use image reference instead of full base64
            const processedChats = chats.map(chat => ({
                ...chat,
                personality_display: this._getImageReference(
                    chat.personality_id_ref || chat.personality_id,
                    chat.personality_display,
                    chat.image_type
                )
            }));
            
            const totalCount = await this.count({ user_id: userId, is_active: 1 });

            return {
                chats: processedChats,
                pagination: {
                    page,
                    pageSize,
                    totalCount,
                    totalPages: Math.ceil(totalCount / pageSize)
                }
            };
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to get user chats', { userId, page, pageSize });
        }
    }

    /**
     * Create a new chat (MULTI-USER SUPPORT)
     * CLEAN ARCHITECTURE: Domain layer entity creation
     */
    async createChat(userId, chatData) {
        try {
            const chatId = chatData.id || require('uuid').v4();
            const now = new Date().toISOString();
            
            const chat = {
                id: chatId,
                user_id: userId,  // MULTI-USER SUPPORT
                title: chatData.title,
                personality_id: chatData.personality_id,
                chat_metadata: JSON.stringify(chatData.metadata || {}),
                created_at: now,
                updated_at: now,
                is_active: 1
            };

            await this.create(chat);
            return await this.findById(chatId);
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to create chat', { userId, chatData });
        }
    }

    /**
     * Get chat by ID with user validation (MULTI-USER SUPPORT)
     * CLEAN ARCHITECTURE: Domain layer entity retrieval with access control
     */
    async getUserChat(userId, chatId) {
        try {
            const sql = `
                SELECT c.*, p.id as personality_id_ref, p.name as personality_name, p.display as personality_display,
                       p.image_type
                FROM ${this.tableName} c
                LEFT JOIN personalities p ON c.personality_id = p.id
                WHERE c.id = ? AND c.user_id = ? AND c.is_active = 1
            `;
            
            const chat = await this.dal.queryOne(sql, [chatId, userId]);
            
            if (chat) {
                // Use image reference instead of full base64
                chat.personality_display = this._getImageReference(
                    chat.personality_id_ref || chat.personality_id,
                    chat.personality_display,
                    chat.image_type
                );
                
                // Get message count
                const messageCountSql = `SELECT COUNT(*) as count FROM conversation_logs WHERE chat_id = ? AND user_id = ?`;
                const countResult = await this.dal.queryOne(messageCountSql, [chatId, userId]);
                chat.message_count = countResult ? countResult.count : 0;
            }
            
            return chat;
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to get user chat', { userId, chatId });
        }
    }

    /**
     * Get recent chats for user with personality details (MULTI-USER SUPPORT)
     * CLEAN ARCHITECTURE: Domain layer entity retrieval
     */
    async getRecentUserChats(userId, limit = 10) {
        try {
            const sql = `
                SELECT c.*, p.id as personality_id_ref, p.name as personality_name, p.display as personality_display,
                       p.image_type,
                       COUNT(cl.id) as message_count
                FROM ${this.tableName} c
                LEFT JOIN personalities p ON c.personality_id = p.id
                LEFT JOIN conversation_logs cl ON c.id = cl.chat_id
                WHERE c.user_id = ? AND c.is_active = 1
                GROUP BY c.id
                ORDER BY c.updated_at DESC
                LIMIT ?
            `;
            
            const chats = await this.dal.query(sql, [userId, limit]);
            
            // Use image reference instead of full base64
            return chats.map(chat => ({
                ...chat,
                personality_display: this._getImageReference(
                    chat.personality_id_ref || chat.personality_id,
                    chat.personality_display,
                    chat.image_type
                )
            }));
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to get recent user chats', { userId, limit });
        }
    }

    /**
     * Update chat title (MULTI-USER SUPPORT)
     * CLEAN ARCHITECTURE: Domain layer entity update with access control
     */
    async updateChatTitle(userId, chatId, newTitle) {
        try {
            const sql = `
                UPDATE ${this.tableName} 
                SET title = ?, updated_at = ?
                WHERE id = ? AND user_id = ? AND is_active = 1
            `;
            
            const result = await this.dal.execute(sql, [newTitle, new Date().toISOString(), chatId, userId]);
            return { updated: result.changes > 0 };
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to update chat title', { userId, chatId, newTitle });
        }
    }

    /**
     * Update chat metadata (MULTI-USER SUPPORT)
     * CLEAN ARCHITECTURE: Domain layer entity update
     */
    async updateChatMetadata(userId, chatId, metadata) {
        try {
            const sql = `
                UPDATE ${this.tableName} 
                SET chat_metadata = ?, updated_at = ?
                WHERE id = ? AND user_id = ? AND is_active = 1
            `;
            
            const result = await this.dal.execute(sql, [
                JSON.stringify(metadata), 
                new Date().toISOString(), 
                chatId, 
                userId
            ]);
            
            return { updated: result.changes > 0 };
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to update chat metadata', { userId, chatId, metadata });
        }
    }

    /**
     * Soft delete chat (MULTI-USER SUPPORT)
     * CLEAN ARCHITECTURE: Domain layer entity deactivation
     */
    async deactivateChat(userId, chatId) {
        try {
            const sql = `
                UPDATE ${this.tableName} 
                SET is_active = 0, updated_at = ?
                WHERE id = ? AND user_id = ? AND is_active = 1
            `;
            
            const result = await this.dal.execute(sql, [new Date().toISOString(), chatId, userId]);
            return { deactivated: result.changes > 0 };
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to deactivate chat', { userId, chatId });
        }
    }

    /**
     * Get user chat statistics (MULTI-USER SUPPORT)
     * CLEAN ARCHITECTURE: Domain layer analytics with user isolation
     */
    async getUserChatStatistics(userId) {
        try {
            const sql = `
                SELECT 
                    COUNT(*) as total_chats,
                    COUNT(DISTINCT c.personality_id) as unique_personalities_used,
                    SUM(CASE WHEN cl.id IS NOT NULL THEN 1 ELSE 0 END) as total_messages,
                    MAX(c.updated_at) as last_chat_activity
                FROM ${this.tableName} c
                LEFT JOIN conversation_logs cl ON c.id = cl.chat_id
                WHERE c.user_id = ? AND c.is_active = 1
            `;
            
            const stats = await this.dal.queryOne(sql, [userId]);
            
            return {
                totalChats: stats.total_chats || 0,
                uniquePersonalitiesUsed: stats.unique_personalities_used || 0,
                totalMessages: stats.total_messages || 0,
                lastChatActivity: stats.last_chat_activity
            };
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to get user chat statistics', { userId });
        }
    }

    /**
     * Search user chats by title (MULTI-USER SUPPORT)
     * CLEAN ARCHITECTURE: Domain layer search with user isolation
     */
    async searchUserChats(userId, searchTerm, limit = 20) {
        try {
            const sql = `
                SELECT c.*, p.id as personality_id_ref, p.name as personality_name, p.display as personality_display,
                       p.image_type
                FROM ${this.tableName} c
                LEFT JOIN personalities p ON c.personality_id = p.id
                WHERE c.user_id = ? AND c.is_active = 1 
                AND (c.title LIKE ? OR p.name LIKE ?)
                ORDER BY c.updated_at DESC
                LIMIT ?
            `;
            
            const searchPattern = `%${searchTerm}%`;
            const chats = await this.dal.query(sql, [userId, searchPattern, searchPattern, limit]);
            
            // Use image reference instead of full base64
            return chats.map(chat => ({
                ...chat,
                personality_display: this._getImageReference(
                    chat.personality_id_ref || chat.personality_id,
                    chat.personality_display,
                    chat.image_type
                )
            }));
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to search user chats', { userId, searchTerm, limit });
        }
    }

    /**
     * Get chats by personality for user (MULTI-USER SUPPORT)
     * CLEAN ARCHITECTURE: Domain layer filtering with user isolation
     */
    async getUserChatsByPersonality(userId, personalityId, limit = 50) {
        try {
            const sql = `
                SELECT c.*, p.id as personality_id_ref, p.name as personality_name, p.display as personality_display,
                       p.image_type
                FROM ${this.tableName} c
                LEFT JOIN personalities p ON c.personality_id = p.id
                WHERE c.user_id = ? AND c.personality_id = ? AND c.is_active = 1
                ORDER BY c.updated_at DESC
                LIMIT ?
            `;
            
            const chats = await this.dal.query(sql, [userId, personalityId, limit]);
            
            // Use image reference instead of full base64
            return chats.map(chat => ({
                ...chat,
                personality_display: this._getImageReference(
                    chat.personality_id_ref || chat.personality_id,
                    chat.personality_display,
                    chat.image_type
                )
            }));
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to get user chats by personality', { userId, personalityId, limit });
        }
    }
}

module.exports = ChatRepository;