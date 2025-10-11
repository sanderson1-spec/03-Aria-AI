const BaseRepository = require('../CORE_BaseRepository');

/**
 * UserRepository - Handles user account management
 * CLEAN ARCHITECTURE: Infrastructure layer user management
 */
class UserRepository extends BaseRepository {
    constructor(tableName, dependencies) {
        super(tableName, dependencies);
    }

    /**
     * DOMAIN LAYER: Find user by username
     */
    async findByUsername(username) {
        try {
            const sql = `SELECT * FROM ${this.tableName} WHERE username = ? AND is_active = 1`;
            return await this.dal.queryOne(sql, [username]);
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to find user by username', { username });
        }
    }

    /**
     * DOMAIN LAYER: Find user by email
     */
    async findByEmail(email) {
        try {
            const sql = `SELECT * FROM ${this.tableName} WHERE email = ? AND is_active = 1`;
            return await this.dal.queryOne(sql, [email]);
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to find user by email', { email });
        }
    }

    /**
     * DOMAIN LAYER: Create new user
     */
    async createUser(userData) {
        try {
            const userId = require('uuid').v4();
            const now = new Date().toISOString();
            
            const user = {
                id: userId,
                username: userData.username,
                email: userData.email || null,
                password_hash: userData.password_hash || null,
                display_name: userData.display_name || userData.username,
                preferences: JSON.stringify(userData.preferences || {}),
                created_at: now,
                updated_at: now,
                last_active: now,
                is_active: 1
            };

            await this.create(user);
            return await this.findById(userId);
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to create user', { userData });
        }
    }

    /**
     * DOMAIN LAYER: Update user preferences
     */
    async updatePreferences(userId, preferences) {
        try {
            const updates = {
                preferences: JSON.stringify(preferences),
                updated_at: new Date().toISOString()
            };
            
            return await this.update(updates, { id: userId });
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to update user preferences', { userId, preferences });
        }
    }

    /**
     * DOMAIN LAYER: Update user LLM preferences
     */
    async updateLLMPreferences(userId, llmPreferences) {
        try {
            const updates = {
                llm_preferences: JSON.stringify(llmPreferences),
                updated_at: new Date().toISOString()
            };
            
            return await this.update(updates, { id: userId });
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to update user LLM preferences', { userId, llmPreferences });
        }
    }

    /**
     * DOMAIN LAYER: Update last active timestamp
     */
    async updateLastActive(userId) {
        try {
            const updates = {
                last_active: new Date().toISOString()
            };
            
            return await this.update(updates, { id: userId });
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to update last active', { userId });
        }
    }

    /**
     * DOMAIN LAYER: Get user statistics
     */
    async getUserStats(userId) {
        try {
            const sql = `
                SELECT 
                    u.*,
                    COUNT(DISTINCT c.id) as total_chats,
                    COUNT(DISTINCT c.personality_id) as unique_personalities_used,
                    COUNT(DISTINCT cl.id) as total_messages,
                    MAX(c.updated_at) as last_chat_activity
                FROM ${this.tableName} u
                LEFT JOIN chats c ON u.id = c.user_id AND c.is_active = 1
                LEFT JOIN conversation_logs cl ON u.id = cl.user_id
                WHERE u.id = ? AND u.is_active = 1
                GROUP BY u.id
            `;
            
            return await this.dal.queryOne(sql, [userId]);
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to get user stats', { userId });
        }
    }

    /**
     * DOMAIN LAYER: Get active users (for admin/analytics)
     */
    async getActiveUsers(limit = 50) {
        try {
            const sql = `
                SELECT id, username, display_name, last_active, created_at
                FROM ${this.tableName} 
                WHERE is_active = 1 
                ORDER BY last_active DESC 
                LIMIT ?
            `;
            
            return await this.dal.query(sql, [limit]);
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to get active users', { limit });
        }
    }

    /**
     * DOMAIN LAYER: Soft delete user (deactivate)
     */
    async deactivateUser(userId) {
        try {
            const updates = {
                is_active: 0,
                updated_at: new Date().toISOString()
            };
            
            return await this.update(updates, { id: userId });
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to deactivate user', { userId });
        }
    }
}

module.exports = UserRepository;
