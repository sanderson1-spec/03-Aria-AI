const BaseRepository = require('../CORE_BaseRepository');

/**
 * UserSessionRepository - Handles user session management
 * CLEAN ARCHITECTURE: Infrastructure layer session management for multi-device support
 */
class UserSessionRepository extends BaseRepository {
    constructor(tableName, dependencies) {
        super(tableName, dependencies);
    }

    /**
     * DOMAIN LAYER: Find active sessions for user
     */
    async findActiveSessionsForUser(userId) {
        try {
            const sql = `
                SELECT * FROM ${this.tableName} 
                WHERE user_id = ? AND is_active = 1 AND (expires_at IS NULL OR expires_at > datetime('now'))
                ORDER BY last_active DESC
            `;
            return await this.dal.query(sql, [userId]);
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to find active sessions for user', { userId });
        }
    }

    /**
     * DOMAIN LAYER: Create new user session
     */
    async createSession(sessionData) {
        try {
            const chatId = require('uuid').v4();
            const now = new Date().toISOString();
            
            // Calculate expiration (24 hours from now by default)
            const expiresAt = sessionData.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
            
            const session = {
                id: chatId,
                user_id: sessionData.user_id,
                chat_id: sessionData.chat_id || null,
                device_info: JSON.stringify(sessionData.device_info || {}),
                ip_address: sessionData.ip_address || null,
                session_data: JSON.stringify(sessionData.session_data || {}),
                created_at: now,
                last_active: now,
                expires_at: expiresAt,
                is_active: 1
            };

            await this.create(session);
            return await this.findById(chatId);
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to create session', { sessionData });
        }
    }

    /**
     * DOMAIN LAYER: Update session activity
     */
    async updateLastActive(chatId) {
        try {
            const updates = {
                last_active: new Date().toISOString()
            };
            
            return await this.update(chatId, updates);
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to update session activity', { chatId });
        }
    }

    /**
     * DOMAIN LAYER: End session
     */
    async endSession(chatId) {
        try {
            const updates = {
                is_active: 0,
                last_active: new Date().toISOString()
            };
            
            return await this.update(chatId, updates);
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to end session', { chatId });
        }
    }

    /**
     * DOMAIN LAYER: Clean up expired sessions
     */
    async cleanupExpiredSessions() {
        try {
            const sql = `
                UPDATE ${this.tableName} 
                SET is_active = 0 
                WHERE expires_at IS NOT NULL AND expires_at <= datetime('now') AND is_active = 1
            `;
            
            const result = await this.dal.execute(sql, []);
            
            if (this.logger) {
                this.logger.info(`Cleaned up expired sessions`, 'UserSessionRepository', {
                    cleanedCount: result.changes || 0
                });
            }
            
            return result.changes || 0;
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to cleanup expired sessions');
        }
    }

    /**
     * DOMAIN LAYER: Get session with user info
     */
    async getSessionWithUser(chatId) {
        try {
            const sql = `
                SELECT 
                    s.*,
                    u.username,
                    u.display_name,
                    u.email
                FROM ${this.tableName} s
                JOIN users u ON s.user_id = u.id
                WHERE s.id = ? AND s.is_active = 1
            `;
            
            return await this.dal.queryOne(sql, [chatId]);
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to get session with user info', { chatId });
        }
    }

    /**
     * DOMAIN LAYER: Update session chat association
     */
    async updateSessionChat(userSessionId, chatId) {
        try {
            const updates = {
                chat_id: chatId,
                last_active: new Date().toISOString()
            };
            
            return await this.update(userSessionId, updates);
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to update session chat', { userSessionId, chatId });
        }
    }
}

module.exports = UserSessionRepository;
