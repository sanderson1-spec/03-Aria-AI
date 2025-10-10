const BaseRepository = require('../CORE_BaseRepository');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

/**
 * AuthRepository - Handles user authentication and session management
 * 
 * CLEAN ARCHITECTURE:
 * - Extends BaseRepository for data access patterns
 * - Manages users table (with password hashing)
 * - Manages user_sessions table for authentication
 * - All user operations include userId for data isolation
 */
class AuthRepository extends BaseRepository {
    constructor(tableName, dependencies) {
        super(tableName, dependencies);
        this.SALT_ROUNDS = 10;
        this.SESSION_DURATION_DAYS = 30; // Remember me: 30 days
    }

    /**
     * Generate unique ID
     */
    generateId() {
        return uuidv4();
    }

    /**
     * Create a new user with hashed password
     */
    async createUser(username, password, displayName = null, email = null) {
        try {
            const userId = this.generateId();
            const passwordHash = await bcrypt.hash(password, this.SALT_ROUNDS);
            
            const sql = `
                INSERT INTO users (id, username, password_hash, display_name, email, created_at, updated_at, last_active, is_active)
                VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'), datetime('now'), 1)
            `;
            
            await this.dal.execute(sql, [userId, username, passwordHash, displayName || username, email]);
            
            return {
                id: userId,
                username,
                display_name: displayName || username,
                email,
                created_at: new Date().toISOString()
            };
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to create user', { username });
        }
    }

    /**
     * Find user by username
     */
    async findByUsername(username) {
        try {
            const sql = `
                SELECT id, username, password_hash, display_name, email, created_at, last_active, is_active
                FROM users
                WHERE username = ? AND is_active = 1
            `;
            
            return await this.dal.queryOne(sql, [username]);
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to find user by username', { username });
        }
    }

    /**
     * Find user by ID (without password hash)
     */
    async findUserById(userId) {
        try {
            const sql = `
                SELECT id, username, display_name, email, created_at, last_active, is_active
                FROM users
                WHERE id = ? AND is_active = 1
            `;
            
            return await this.dal.queryOne(sql, [userId]);
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to find user by ID', { userId });
        }
    }

    /**
     * Verify password against stored hash
     */
    async verifyPassword(plainPassword, passwordHash) {
        try {
            return await bcrypt.compare(plainPassword, passwordHash);
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to verify password');
        }
    }

    /**
     * Create a new session for user
     */
    async createSession(userId, deviceInfo = {}, ipAddress = null) {
        try {
            const chatId = this.generateId();
            const sessionToken = crypto.randomBytes(32).toString('hex'); // Simple random token
            
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + this.SESSION_DURATION_DAYS);
            
            const sql = `
                INSERT INTO user_sessions (
                    id, 
                    user_id, 
                    device_info, 
                    ip_address, 
                    session_data,
                    created_at, 
                    last_active, 
                    expires_at, 
                    is_active
                )
                VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'), ?, 1)
            `;
            
            const sessionData = JSON.stringify({ token: sessionToken });
            
            await this.dal.execute(sql, [
                chatId,
                userId,
                JSON.stringify(deviceInfo),
                ipAddress,
                sessionData,
                expiresAt.toISOString()
            ]);
            
            return {
                chatId,
                sessionToken,
                userId,
                expiresAt: expiresAt.toISOString()
            };
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to create session', { userId });
        }
    }

    /**
     * Validate session token and return user info
     */
    async validateSession(sessionToken) {
        try {
            const sql = `
                SELECT 
                    us.id as session_id,
                    us.user_id,
                    us.expires_at,
                    us.is_active,
                    u.username,
                    u.display_name,
                    u.email
                FROM user_sessions us
                JOIN users u ON us.user_id = u.id
                WHERE json_extract(us.session_data, '$.token') = ?
                    AND us.is_active = 1
                    AND u.is_active = 1
                    AND datetime(us.expires_at) > datetime('now')
            `;
            
            const session = await this.dal.queryOne(sql, [sessionToken]);
            
            if (session) {
                // Update last_active timestamp
                await this.updateSessionActivity(session.session_id);
            }
            
            return session;
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to validate session');
        }
    }

    /**
     * Update session last_active timestamp
     */
    async updateSessionActivity(chatId) {
        try {
            const sql = `
                UPDATE user_sessions 
                SET last_active = datetime('now')
                WHERE id = ?
            `;
            
            await this.dal.execute(sql, [chatId]);
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to update session activity', { chatId });
        }
    }

    /**
     * Invalidate a session (logout)
     */
    async invalidateSession(sessionToken) {
        try {
            const sql = `
                UPDATE user_sessions 
                SET is_active = 0
                WHERE json_extract(session_data, '$.token') = ?
            `;
            
            await this.dal.execute(sql, [sessionToken]);
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to invalidate session');
        }
    }

    /**
     * Invalidate all sessions for a user
     */
    async invalidateAllUserSessions(userId) {
        try {
            const sql = `
                UPDATE user_sessions 
                SET is_active = 0
                WHERE user_id = ?
            `;
            
            await this.dal.execute(sql, [userId]);
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to invalidate all sessions', { userId });
        }
    }

    /**
     * Clean up expired sessions
     */
    async cleanupExpiredSessions() {
        try {
            const sql = `
                UPDATE user_sessions 
                SET is_active = 0
                WHERE datetime(expires_at) <= datetime('now')
                    AND is_active = 1
            `;
            
            const result = await this.dal.execute(sql);
            return result.changes || 0;
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to cleanup expired sessions');
        }
    }

    /**
     * Get all active sessions for a user
     */
    async getUserSessions(userId) {
        try {
            const sql = `
                SELECT 
                    id,
                    device_info,
                    ip_address,
                    created_at,
                    last_active,
                    expires_at
                FROM user_sessions
                WHERE user_id = ?
                    AND is_active = 1
                    AND datetime(expires_at) > datetime('now')
                ORDER BY last_active DESC
            `;
            
            return await this.dal.query(sql, [userId]);
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to get user sessions', { userId });
        }
    }

    /**
     * Check if username is available
     */
    async isUsernameAvailable(username) {
        try {
            const sql = `
                SELECT COUNT(*) as count
                FROM users
                WHERE username = ?
            `;
            
            const result = await this.dal.queryOne(sql, [username]);
            return result.count === 0;
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to check username availability', { username });
        }
    }

    /**
     * Update user's last_active timestamp
     */
    async updateUserActivity(userId) {
        try {
            const sql = `
                UPDATE users 
                SET last_active = datetime('now')
                WHERE id = ?
            `;
            
            await this.dal.execute(sql, [userId]);
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to update user activity', { userId });
        }
    }
}

module.exports = AuthRepository;