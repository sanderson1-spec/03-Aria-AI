const AbstractService = require('../base/CORE_AbstractService');

/**
 * AuthService - Handles user authentication and session management
 * 
 * CLEAN ARCHITECTURE:
 * - Extends AbstractService for service patterns
 * - Business logic for authentication workflows
 * - Uses AuthRepository for data access
 * - Handles password verification and session creation
 */
class AuthService extends AbstractService {
    constructor(dependencies) {
        super('AuthService', dependencies);
        this.logger = dependencies.logger;
        this.errorHandler = dependencies.errorHandling;
        this.database = dependencies.database;
    }

    async onInitialize() {
        // Get DAL after database service is initialized
        this.dal = this.database.getDAL();
        
        this.logger.info('AuthService initialized', 'AuthService');
        
        // Schedule periodic cleanup of expired sessions (every hour)
        this.scheduleSessionCleanup();
    }

    /**
     * Register a new user
     */
    async register(username, password, displayName = null, email = null) {
        try {
            // Validate input
            if (!username || !password) {
                throw new Error('Username and password are required');
            }

            // Trim username
            username = username.trim();

            if (username.length < 3) {
                throw new Error('Username must be at least 3 characters');
            }

            // Check if username is available
            const isAvailable = await this.dal.auth.isUsernameAvailable(username);
            if (!isAvailable) {
                throw new Error('Username already exists');
            }

            // Create user
            const user = await this.dal.auth.createUser(username, password, displayName, email);

            this.logger.info('User registered successfully', 'AuthService', {
                userId: user.id,
                username: user.username
            });

            return {
                success: true,
                user: {
                    id: user.id,
                    username: user.username,
                    displayName: user.display_name,
                    email: user.email
                }
            };
        } catch (error) {
            throw this.errorHandler.wrapDomainError(error, 'User registration failed', { username });
        }
    }

    /**
     * Login user and create session
     */
    async login(username, password, deviceInfo = {}, ipAddress = null) {
        try {
            // Validate input
            if (!username || !password) {
                throw new Error('Username and password are required');
            }

            // Find user
            const user = await this.dal.auth.findByUsername(username.trim());
            if (!user) {
                throw new Error('Invalid username or password');
            }

            // Verify password
            const isValidPassword = await this.dal.auth.verifyPassword(password, user.password_hash);
            if (!isValidPassword) {
                this.logger.warn('Failed login attempt', 'AuthService', { username });
                throw new Error('Invalid username or password');
            }

            // Create session
            const session = await this.dal.auth.createSession(user.id, deviceInfo, ipAddress);

            // Update user activity
            await this.dal.auth.updateUserActivity(user.id);

            this.logger.info('User logged in successfully', 'AuthService', {
                userId: user.id,
                username: user.username,
                chatId: session.chatId
            });

            return {
                success: true,
                sessionToken: session.sessionToken,
                user: {
                    id: user.id,
                    username: user.username,
                    displayName: user.display_name,
                    email: user.email
                },
                expiresAt: session.expiresAt
            };
        } catch (error) {
            throw this.errorHandler.wrapDomainError(error, 'Login failed', { username });
        }
    }

    /**
     * Logout user (invalidate session)
     */
    async logout(sessionToken) {
        try {
            if (!sessionToken) {
                throw new Error('Session token is required');
            }

            // Validate session first to get user info for logging
            const session = await this.dal.auth.validateSession(sessionToken);
            
            // Invalidate session
            await this.dal.auth.invalidateSession(sessionToken);

            if (session) {
                this.logger.info('User logged out', 'AuthService', {
                    userId: session.user_id,
                    username: session.username
                });
            }

            return {
                success: true,
                message: 'Logged out successfully'
            };
        } catch (error) {
            throw this.errorHandler.wrapDomainError(error, 'Logout failed');
        }
    }

    /**
     * Validate session and return user info
     */
    async validateSession(sessionToken) {
        try {
            if (!sessionToken) {
                return {
                    valid: false,
                    user: null
                };
            }

            const session = await this.dal.auth.validateSession(sessionToken);

            if (!session) {
                return {
                    valid: false,
                    user: null
                };
            }

            return {
                valid: true,
                user: {
                    id: session.user_id,
                    username: session.username,
                    displayName: session.display_name,
                    email: session.email
                },
                chatId: session.session_id
            };
        } catch (error) {
            this.logger.warn('Session validation failed', 'AuthService', { error: error.message });
            return {
                valid: false,
                user: null
            };
        }
    }

    /**
     * Get current user info from session token
     */
    async getCurrentUser(sessionToken) {
        const validation = await this.validateSession(sessionToken);
        
        if (!validation.valid) {
            throw new Error('Invalid or expired session');
        }

        return validation.user;
    }

    /**
     * Get all active sessions for a user
     */
    async getUserSessions(userId) {
        try {
            return await this.dal.auth.getUserSessions(userId);
        } catch (error) {
            throw this.errorHandler.wrapDomainError(error, 'Failed to get user sessions', { userId });
        }
    }

    /**
     * Logout from all devices (invalidate all sessions)
     */
    async logoutAllDevices(userId) {
        try {
            await this.dal.auth.invalidateAllUserSessions(userId);

            this.logger.info('User logged out from all devices', 'AuthService', { userId });

            return {
                success: true,
                message: 'Logged out from all devices'
            };
        } catch (error) {
            throw this.errorHandler.wrapDomainError(error, 'Failed to logout from all devices', { userId });
        }
    }

    /**
     * Schedule periodic cleanup of expired sessions
     */
    scheduleSessionCleanup() {
        // Run cleanup every hour
        setInterval(async () => {
            try {
                const cleaned = await this.dal.auth.cleanupExpiredSessions();
                if (cleaned > 0) {
                    this.logger.info('Cleaned up expired sessions', 'AuthService', { count: cleaned });
                }
            } catch (error) {
                this.logger.error('Session cleanup failed', 'AuthService', { error: error.message });
            }
        }, 60 * 60 * 1000); // 1 hour
    }

    /**
     * Check if username is available
     */
    async isUsernameAvailable(username) {
        try {
            if (!username || username.trim().length < 3) {
                return false;
            }

            return await this.dal.auth.isUsernameAvailable(username.trim());
        } catch (error) {
            throw this.errorHandler.wrapDomainError(error, 'Failed to check username availability', { username });
        }
    }
}

module.exports = AuthService;
