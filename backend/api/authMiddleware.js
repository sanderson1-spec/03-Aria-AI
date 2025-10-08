/**
 * Auth Middleware - Validates session tokens and extracts user info
 * 
 * CLEAN ARCHITECTURE:
 * - Middleware layer for protecting routes
 * - Delegates validation to AuthService
 * - Attaches user info to request object
 */

/**
 * Create auth middleware with service factory
 */
function createAuthMiddleware(serviceFactory) {
    const authService = serviceFactory.get('auth');
    const logger = serviceFactory.get('logger');

    /**
     * Middleware function to validate authentication
     */
    return async function authMiddleware(req, res, next) {
        try {
            // Extract session token from various sources
            const sessionToken = req.headers.authorization?.replace('Bearer ', '') ||
                               req.headers['x-session-token'] ||
                               req.query.sessionToken;

            if (!sessionToken) {
                return res.status(401).json({
                    success: false,
                    error: 'Authentication required'
                });
            }

            // Validate session
            const validation = await authService.validateSession(sessionToken);

            if (!validation.valid) {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid or expired session'
                });
            }

            // Attach user info to request
            req.user = validation.user;
            req.sessionId = validation.sessionId;
            req.sessionToken = sessionToken;

            next();
        } catch (error) {
            logger.error('Auth middleware error', 'AuthMiddleware', { error: error.message });
            res.status(500).json({
                success: false,
                error: 'Authentication failed'
            });
        }
    };
}

/**
 * Optional auth middleware - doesn't fail if no token, but validates if present
 */
function createOptionalAuthMiddleware(serviceFactory) {
    const authService = serviceFactory.get('auth');

    return async function optionalAuthMiddleware(req, res, next) {
        try {
            const sessionToken = req.headers.authorization?.replace('Bearer ', '') ||
                               req.headers['x-session-token'] ||
                               req.query.sessionToken;

            if (sessionToken) {
                const validation = await authService.validateSession(sessionToken);
                
                if (validation.valid) {
                    req.user = validation.user;
                    req.sessionId = validation.sessionId;
                    req.sessionToken = sessionToken;
                }
            }

            next();
        } catch (error) {
            // Don't fail on error, just continue without user
            next();
        }
    };
}

module.exports = {
    createAuthMiddleware,
    createOptionalAuthMiddleware
};
