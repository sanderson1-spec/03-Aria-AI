/**
 * WebSocket Server Setup
 * Handles real-time bidirectional communication with clients
 * Integrates with MessageDeliveryService for proactive message delivery
 */

const WebSocket = require('ws');
const url = require('url');

/**
 * Setup WebSocket server on existing HTTP server
 * @param {http.Server} server - HTTP server instance
 * @param {ServiceFactory} serviceFactory - Service factory for dependency injection
 */
function setupWebSocketServer(server, serviceFactory) {
    const logger = serviceFactory.get('logger');
    const messageDelivery = serviceFactory.get('messageDelivery');
    
    if (!logger) {
        throw new Error('Logger service is required for WebSocket server');
    }
    
    if (!messageDelivery) {
        logger.error('MessageDelivery service not available', 'WebSocket');
        throw new Error('MessageDelivery service is required for WebSocket server');
    }
    
    // Create WebSocket server
    const wss = new WebSocket.Server({ server });
    
    logger.info('WebSocket server created', 'WebSocket');
    
    // Handle new connections
    wss.on('connection', async (ws, req) => {
        let userId = null;
        
        try {
            // Extract token from query params or headers
            const token = extractToken(req);
            
            if (!token) {
                logger.warn('WebSocket connection rejected - no token provided', 'WebSocket');
                ws.close(1008, 'Authentication required');
                return;
            }
            
            // Basic token validation
            if (typeof token !== 'string' || token.trim() === '') {
                logger.warn('WebSocket connection rejected - invalid token', 'WebSocket');
                ws.close(1008, 'Invalid token');
                return;
            }
            
            // Extract userId from token (simple parsing)
            userId = extractUserId(token);
            
            if (!userId) {
                logger.warn('WebSocket connection rejected - cannot extract userId', 'WebSocket');
                ws.close(1008, 'Invalid token format');
                return;
            }
            
            // Register connection with MessageDeliveryService
            await messageDelivery.registerConnection(userId, ws);
            
            logger.info('WebSocket connection established', 'WebSocket', {
                userId,
                remoteAddress: req.socket.remoteAddress
            });
            
            // Handle incoming messages
            ws.on('message', async (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    
                    logger.debug('WebSocket message received', 'WebSocket', {
                        userId,
                        messageType: message.type
                    });
                    
                    // Handle different message types
                    switch (message.type) {
                        case 'ping':
                            ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
                            break;
                            
                        case 'subscribe':
                            logger.info('Client subscribed to notifications', 'WebSocket', {
                                userId,
                                subscription: message.subscription
                            });
                            ws.send(JSON.stringify({ 
                                type: 'subscribed', 
                                subscription: message.subscription 
                            }));
                            break;
                            
                        default:
                            logger.debug('Unknown message type received', 'WebSocket', {
                                userId,
                                messageType: message.type
                            });
                    }
                    
                } catch (error) {
                    logger.error('Error handling WebSocket message', 'WebSocket', {
                        userId,
                        error: error.message
                    });
                }
            });
            
            // Handle connection close
            ws.on('close', async (code, reason) => {
                try {
                    if (userId) {
                        await messageDelivery.unregisterConnection(userId);
                        logger.info('WebSocket connection closed', 'WebSocket', {
                            userId,
                            code,
                            reason: reason.toString()
                        });
                    }
                } catch (error) {
                    logger.error('Error during WebSocket cleanup', 'WebSocket', {
                        userId,
                        error: error.message
                    });
                }
            });
            
            // Handle errors
            ws.on('error', (error) => {
                logger.error('WebSocket error occurred', 'WebSocket', {
                    userId,
                    error: error.message
                });
                
                // Graceful disconnect on error
                try {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.close(1011, 'Internal error');
                    }
                } catch (closeError) {
                    logger.error('Error closing WebSocket after error', 'WebSocket', {
                        error: closeError.message
                    });
                }
            });
            
        } catch (error) {
            logger.error('Error establishing WebSocket connection', 'WebSocket', {
                error: error.message
            });
            
            try {
                ws.close(1011, 'Connection setup failed');
            } catch (closeError) {
                logger.error('Error closing WebSocket after setup failure', 'WebSocket', {
                    error: closeError.message
                });
            }
        }
    });
    
    // Handle server-level errors
    wss.on('error', (error) => {
        logger.error('WebSocket server error', 'WebSocket', {
            error: error.message
        });
    });
    
    logger.info('WebSocket server listening for connections', 'WebSocket');
    
    return wss;
}

/**
 * Extract authentication token from request
 * Checks query params and headers
 */
function extractToken(req) {
    // Try query parameters first
    const queryParams = url.parse(req.url, true).query;
    if (queryParams.token) {
        return queryParams.token;
    }
    
    // Try Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader) {
        // Support "Bearer <token>" format
        const match = authHeader.match(/^Bearer\s+(.+)$/i);
        if (match) {
            return match[1];
        }
        return authHeader;
    }
    
    // Try custom header
    if (req.headers['x-auth-token']) {
        return req.headers['x-auth-token'];
    }
    
    return null;
}

/**
 * Extract userId from token
 * Simple parsing - splits token and extracts userId portion
 * For production, use proper JWT verification
 */
function extractUserId(token) {
    try {
        // Simple token format: "userId-timestamp" or just "userId"
        // For JWT: decode the payload and extract userId
        
        // If token looks like JWT (has dots), try to decode
        if (token.includes('.')) {
            const parts = token.split('.');
            if (parts.length === 3) {
                // JWT format: header.payload.signature
                const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
                return payload.userId || payload.sub || payload.id || null;
            }
        }
        
        // Simple token format
        const parts = token.split('-');
        if (parts.length > 0) {
            return parts[0];
        }
        
        // If all else fails, use token as userId (for development)
        return token;
        
    } catch (error) {
        return null;
    }
}

module.exports = { setupWebSocketServer };

