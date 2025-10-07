/**
 * CLEAN ARCHITECTURE: Infrastructure Layer Service
 * MessageDeliveryService - Manages WebSocket connections and message delivery
 * 
 * FOLLOWS CLEAN ARCHITECTURE PATTERNS:
 * - Extends AbstractService
 * - Uses dependency injection pattern
 * - Integrates with DAL for database access
 * - Uses central logger and error handling
 * - Manages real-time connections
 */

const AbstractService = require('../base/CORE_AbstractService');

class MessageDeliveryService extends AbstractService {
    constructor(dependencies) {
        super('MessageDeliveryService', dependencies);
        
        this.dal = dependencies.database.getDAL();
        this.logger = dependencies.logger;
        this.errorHandler = dependencies.errorHandling;
        this.llm = dependencies.llm;
        
        // Map of userId -> WebSocket connection
        this.connections = new Map();
    }

    /**
     * LIFECYCLE: Initialize service
     */
    async onInitialize() {
        try {
            this.logger.info('MessageDeliveryService initializing', 'MessageDeliveryService');
            
            // Validate required dependencies
            if (!this.dal) {
                throw new Error('Database service is required');
            }
            if (!this.logger) {
                throw new Error('Logger service is required');
            }
            if (!this.errorHandler) {
                throw new Error('ErrorHandling service is required');
            }
            
            this.logger.info('MessageDeliveryService initialized successfully', 'MessageDeliveryService');
            
        } catch (error) {
            throw this.errorHandler.wrapDomainError(error, 
                'Failed to initialize MessageDeliveryService');
        }
    }

    /**
     * INFRASTRUCTURE LAYER: Register user's WebSocket connection
     */
    async registerConnection(userId, websocket) {
        try {
            // Clean up any existing connection for this user
            if (this.connections.has(userId)) {
                const oldConnection = this.connections.get(userId);
                if (oldConnection && oldConnection.readyState === 1) { // OPEN
                    oldConnection.close();
                }
            }
            
            // Register new connection
            this.connections.set(userId, websocket);
            
            this.logger.info('User connection registered', 'MessageDeliveryService', {
                userId,
                totalConnections: this.connections.size
            });
            
            // Set up cleanup on disconnect
            websocket.on('close', () => {
                this.unregisterConnection(userId);
            });
            
        } catch (error) {
            throw this.errorHandler.wrapInfrastructureError(error, 
                'Failed to register connection', { userId });
        }
    }

    /**
     * INFRASTRUCTURE LAYER: Unregister user's WebSocket connection
     */
    async unregisterConnection(userId) {
        try {
            if (this.connections.has(userId)) {
                this.connections.delete(userId);
                
                this.logger.info('User connection unregistered', 'MessageDeliveryService', {
                    userId,
                    totalConnections: this.connections.size
                });
            }
        } catch (error) {
            this.logger.error('Error unregistering connection', 'MessageDeliveryService', {
                userId,
                error: error.message
            });
        }
    }

    /**
     * DOMAIN LAYER: Check if user is connected
     */
    async isUserConnected(userId) {
        const connection = this.connections.get(userId);
        return connection && connection.readyState === 1; // 1 = OPEN
    }

    /**
     * DOMAIN LAYER: Get count of active connections
     */
    async getConnectionCount() {
        return this.connections.size;
    }

    /**
     * DOMAIN LAYER: Deliver scheduled message to user
     */
    async deliverScheduledMessage(engagement) {
        try {
            this.logger.info('Delivering scheduled message', 'MessageDeliveryService', {
                engagementId: engagement.id,
                userId: engagement.user_id
            });

            // Check if user is connected
            const isConnected = await this.isUserConnected(engagement.user_id);
            
            if (!isConnected) {
                this.logger.info('User offline, message will remain pending', 'MessageDeliveryService', {
                    engagementId: engagement.id,
                    userId: engagement.user_id
                });
                return { delivered: false, reason: 'user_offline' };
            }

            // Generate message content if needed
            let messageContent = engagement.engagement_content;
            
            if (!messageContent && this.llm) {
                // Generate content using LLM
                try {
                    messageContent = await this.generateProactiveMessage(engagement);
                } catch (llmError) {
                    this.logger.error('Failed to generate message content', 'MessageDeliveryService', {
                        error: llmError.message
                    });
                    messageContent = engagement.trigger_context || 'Proactive message';
                }
            }

            // Save to conversation_logs with is_proactive=true
            const messageId = await this.saveProactiveMessage(engagement, messageContent);

            // Deliver via WebSocket
            const delivered = await this.deliverMessageToUser(engagement.user_id, {
                id: messageId,
                type: 'proactive',
                content: messageContent,
                engagementId: engagement.id,
                timestamp: new Date().toISOString()
            });

            if (delivered) {
                this.logger.info('Successfully delivered scheduled message', 'MessageDeliveryService', {
                    engagementId: engagement.id,
                    messageId
                });
            }

            return { delivered, messageId };

        } catch (error) {
            throw this.errorHandler.wrapDomainError(error, 
                'Failed to deliver scheduled message', {
                    engagementId: engagement.id
                });
        }
    }

    /**
     * DOMAIN LAYER: Deliver message to specific user via WebSocket
     */
    async deliverMessageToUser(userId, message) {
        try {
            const connection = this.connections.get(userId);
            
            if (!connection || connection.readyState !== 1) {
                this.logger.warn('Cannot deliver message - user not connected', 'MessageDeliveryService', {
                    userId
                });
                return false;
            }

            // Send message via WebSocket
            connection.send(JSON.stringify(message));
            
            this.logger.debug('Message delivered to user', 'MessageDeliveryService', {
                userId,
                messageType: message.type
            });

            return true;

        } catch (error) {
            this.logger.error('Failed to deliver message to user', 'MessageDeliveryService', {
                userId,
                error: error.message
            });
            return false;
        }
    }

    /**
     * INFRASTRUCTURE LAYER: Generate proactive message content using LLM
     */
    async generateProactiveMessage(engagement) {
        try {
            if (!this.llm) {
                return engagement.trigger_context || 'Proactive engagement';
            }

            // Parse engagement metadata
            const metadata = typeof engagement.engagement_metadata === 'string' 
                ? JSON.parse(engagement.engagement_metadata) 
                : engagement.engagement_metadata || {};

            const prompt = `Generate a natural, engaging proactive message based on:
Context: ${engagement.trigger_context || 'general conversation'}
Type: ${engagement.engagement_type || 'check-in'}
Psychological Context: ${JSON.stringify(metadata.psychological_context || {})}

Generate a brief, friendly message (1-2 sentences).`;

            const response = await this.llm.generateResponse(prompt, {
                maxTokens: 100,
                temperature: 0.7
            });

            return response.content || engagement.trigger_context || 'Proactive message';

        } catch (error) {
            this.logger.error('Error generating proactive message', 'MessageDeliveryService', {
                error: error.message
            });
            return engagement.trigger_context || 'Proactive message';
        }
    }

    /**
     * INFRASTRUCTURE LAYER: Save proactive message to conversation_logs
     */
    async saveProactiveMessage(engagement, messageContent) {
        try {
            const messageId = require('uuid').v4();
            const now = new Date().toISOString();

            const sql = `
                INSERT INTO conversation_logs (
                    id, user_id, chat_id, session_id, message, sender, 
                    is_proactive, engagement_id, timestamp, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            await this.dal.execute(sql, [
                messageId,
                engagement.user_id,
                engagement.chat_id || null,
                engagement.session_id,
                messageContent,
                'assistant',
                1, // is_proactive = true
                engagement.id,
                now,
                now
            ]);

            this.logger.debug('Proactive message saved to conversation logs', 'MessageDeliveryService', {
                messageId,
                engagementId: engagement.id
            });

            return messageId;

        } catch (error) {
            throw this.errorHandler.wrapInfrastructureError(error, 
                'Failed to save proactive message', {
                    engagementId: engagement.id
                });
        }
    }

    /**
     * LIFECYCLE: Graceful shutdown
     */
    async onShutdown() {
        try {
            this.logger.info('MessageDeliveryService shutting down', 'MessageDeliveryService');
            
            // Close all active connections
            for (const [userId, connection] of this.connections) {
                try {
                    if (connection.readyState === 1) {
                        connection.close(1001, 'Server shutting down');
                    }
                } catch (error) {
                    this.logger.error('Error closing connection during shutdown', 'MessageDeliveryService', {
                        userId,
                        error: error.message
                    });
                }
            }
            
            this.connections.clear();
            
            this.logger.info('MessageDeliveryService shutdown complete', 'MessageDeliveryService');
            
        } catch (error) {
            this.logger.error('Error during MessageDeliveryService shutdown', 'MessageDeliveryService', {
                error: error.message
            });
            throw error;
        }
    }

    /**
     * HEALTH CHECK: Verify service is operational
     */
    async isHealthy() {
        return this.initialized && this.connections !== null;
    }

    /**
     * UTILITY: Get connection statistics
     */
    getConnectionStats() {
        return {
            totalConnections: this.connections.size,
            initialized: this.initialized
        };
    }
}

module.exports = MessageDeliveryService;

