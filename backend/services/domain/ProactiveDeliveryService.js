/**
 * CLEAN ARCHITECTURE: Domain Layer Service
 * ProactiveDeliveryService - Handles actual delivery of proactive messages to frontend
 * Bridges the gap between proactive intelligence decisions and frontend communication
 * 
 * FOLLOWS YOUR EXISTING SERVICE PATTERNS:
 * - Extends AbstractService
 * - Uses dependency injection pattern
 * - Integrates with existing services
 * - Uses central logger and error handling
 */

const AbstractService = require('../base/CORE_AbstractService');
const { EventEmitter } = require('events');

class ProactiveDeliveryService extends AbstractService {
    constructor(dependencies) {
        super('ProactiveDelivery', dependencies);
        
        // Central services (from your architecture)
        this.dal = null;
        this.proactiveIntelligence = null;
        this.proactiveLearning = null;
        this.logger = null;
        this.errorHandler = null;
        
        // Event emitter for real-time delivery
        this.messageEmitter = new EventEmitter();
        
        // Active sessions for message delivery
        this.activeSessions = new Map();
        
        // Scheduled message timers
        this.scheduledMessages = new Map();
    }

    /**
     * FOLLOWS YOUR PATTERN: onInitialize() method
     */
    async onInitialize() {
        try {
            // Initialize logger first (from AbstractService pattern)
            this.logger = this.dependencies.logger;
            if (!this.logger) {
                this.logger = {
                    debug: (msg, ctx, meta) => console.debug(`[${ctx || 'ProactiveDelivery'}] ${msg}`),
                    info: (msg, ctx, meta) => console.info(`[${ctx || 'ProactiveDelivery'}] ${msg}`),
                    warn: (msg, ctx, meta) => console.warn(`[${ctx || 'ProactiveDelivery'}] ${msg}`),
                    error: (msg, ctx, meta) => console.error(`[${ctx || 'ProactiveDelivery'}] ${msg}`, meta?.error || '')
                };
            }
            
            // Extract dependencies following your pattern
            this.dal = this.dependencies.database?.getDAL();
            this.proactiveIntelligence = this.dependencies.proactiveIntelligence;
            this.proactiveLearning = this.dependencies.proactiveLearning;
            this.errorHandler = this.dependencies.errorHandling;
            
            // Validate required dependencies
            if (!this.dal) {
                throw new Error('Database service is required');
            }
            
            this.logger.info('ProactiveDeliveryService initialized', 'ProactiveDelivery');
            
        } catch (error) {
            throw this.errorHandler?.wrapDomainError(error, 
                'Failed to initialize ProactiveDeliveryService') || error;
        }
    }

    /**
     * DOMAIN LAYER: Process proactive decision and handle delivery
     * This is the missing piece that bridges proactive analysis and frontend delivery
     */
    async processProactiveDecision(decision, context) {
        this.logger.info('Processing proactive decision', 'ProactiveDelivery', {
            chatId: context.chatId,
            shouldEngage: decision.should_engage_proactively,
            timing: decision.engagement_timing,
            hasContent: !!decision.proactive_message_content
        });

        try {
            // If no proactive engagement needed, skip
            if (!decision.should_engage_proactively || !decision.proactive_message_content) {
                this.logger.info('No proactive engagement needed', 'ProactiveDelivery', {
                    chatId: context.chatId,
                    reasoning: decision.psychological_reasoning
                });
                return null;
            }

            // Record decision for learning (existing functionality)
            const engagementId = await this.proactiveLearning?.recordProactiveDecision(decision, context);

            // Determine delivery timing
            const delaySeconds = this.getDelaySecondsFromTiming(decision.engagement_timing);
            
            if (delaySeconds === 0) {
                // Send immediately
                return await this.deliverProactiveMessage({
                    chatId: context.chatId,
                    userId: context.userId,
                    personalityId: context.personality.id,
                    personalityName: context.personality.name,
                    content: decision.proactive_message_content,
                    trigger: decision.psychological_reasoning,
                    confidence: decision.confidence_score,
                    engagementId
                });
            } else if (delaySeconds > 0) {
                // Schedule for later delivery
                return this.scheduleProactiveMessage({
                    chatId: context.chatId,
                    userId: context.userId,
                    personalityId: context.personality.id,
                    personalityName: context.personality.name,
                    content: decision.proactive_message_content,
                    trigger: decision.psychological_reasoning,
                    confidence: decision.confidence_score,
                    engagementId,
                    delaySeconds
                });
            }

            return null;

        } catch (error) {
            const wrappedError = this.errorHandler?.wrapDomainError(error, 
                'Failed to process proactive decision') || error;
            this.logger.error('Error processing proactive decision', 'ProactiveDelivery', {
                error: wrappedError.message,
                chatId: context.chatId
            });
            throw wrappedError;
        }
    }

    /**
     * DOMAIN LAYER: Deliver proactive message immediately
     */
    async deliverProactiveMessage(messageData) {
        this.logger.info('Delivering proactive message immediately', 'ProactiveDelivery', {
            chatId: messageData.chatId,
            personalityName: messageData.personalityName
        });

        try {
            // Save proactive message to database
            const messageId = await this.dal.conversations.saveMessage(
                messageData.chatId,
                'assistant',
                messageData.content,
                'proactive',
                {
                    user_id: messageData.userId,
                    message_type: 'proactive',
                    proactive_trigger: messageData.trigger,
                    confidence_score: messageData.confidence,
                    engagement_id: messageData.engagementId
                }
            );

            // Create message object for frontend
            const frontendMessage = {
                id: messageId,
                chatId: messageData.chatId,
                content: messageData.content,
                type: 'ai',
                timestamp: new Date(),
                metadata: {
                    proactive: true,
                    psychologyTrigger: messageData.trigger,
                    confidence: messageData.confidence
                }
            };

            // Emit message for real-time delivery (WebSocket/SSE)
            this.messageEmitter.emit('proactive-message', {
                chatId: messageData.chatId,
                message: frontendMessage
            });

            this.logger.info('Proactive message delivered', 'ProactiveDelivery', {
                messageId,
                chatId: messageData.chatId
            });

            return {
                messageId,
                delivered: true,
                message: frontendMessage
            };

        } catch (error) {
            const wrappedError = this.errorHandler?.wrapDomainError(error, 
                'Failed to deliver proactive message') || error;
            this.logger.error('Error delivering proactive message', 'ProactiveDelivery', {
                error: wrappedError.message,
                chatId: messageData.chatId
            });
            throw wrappedError;
        }
    }

    /**
     * DOMAIN LAYER: Schedule proactive message for later delivery
     */
    scheduleProactiveMessage(messageData) {
        this.logger.info('Scheduling proactive message', 'ProactiveDelivery', {
            chatId: messageData.chatId,
            delaySeconds: messageData.delaySeconds,
            personalityName: messageData.personalityName
        });

        const scheduleId = `${messageData.chatId}-${Date.now()}`;
        
        const timer = setTimeout(async () => {
            try {
                await this.deliverProactiveMessage(messageData);
                this.scheduledMessages.delete(scheduleId);
            } catch (error) {
                this.logger.error('Error delivering scheduled proactive message', 'ProactiveDelivery', {
                    error: error.message,
                    scheduleId,
                    chatId: messageData.chatId
                });
                this.scheduledMessages.delete(scheduleId);
            }
        }, messageData.delaySeconds * 1000);

        // Store timer reference for potential cancellation
        this.scheduledMessages.set(scheduleId, {
            timer,
            messageData,
            scheduledAt: new Date()
        });

        this.logger.info('Proactive message scheduled', 'ProactiveDelivery', {
            scheduleId,
            chatId: messageData.chatId,
            willDeliverAt: new Date(Date.now() + (messageData.delaySeconds * 1000))
        });

        return {
            scheduleId,
            scheduled: true,
            delaySeconds: messageData.delaySeconds,
            willDeliverAt: new Date(Date.now() + (messageData.delaySeconds * 1000))
        };
    }

    /**
     * DOMAIN LAYER: Register session for real-time message delivery
     * Frontend connections can register to receive proactive messages
     */
    registerSession(chatId, deliveryCallback) {
        this.logger.info('Registering session for proactive delivery', 'ProactiveDelivery', {
            chatId
        });

        this.activeSessions.set(chatId, {
            callback: deliveryCallback,
            registeredAt: new Date()
        });

        // Listen for proactive messages for this session
        const messageHandler = (data) => {
            if (data.chatId === chatId) {
                try {
                    deliveryCallback(data.message);
                } catch (error) {
                    this.logger.error('Error in proactive message callback', 'ProactiveDelivery', {
                        error: error.message,
                        chatId
                    });
                }
            }
        };

        this.messageEmitter.on('proactive-message', messageHandler);

        // Return cleanup function
        return () => {
            this.activeSessions.delete(chatId);
            this.messageEmitter.removeListener('proactive-message', messageHandler);
            this.logger.info('Unregistered session from proactive delivery', 'ProactiveDelivery', {
                chatId
            });
        };
    }

    /**
     * DOMAIN LAYER: Cancel scheduled proactive message
     */
    cancelScheduledMessage(scheduleId) {
        const scheduled = this.scheduledMessages.get(scheduleId);
        if (scheduled) {
            clearTimeout(scheduled.timer);
            this.scheduledMessages.delete(scheduleId);
            
            this.logger.info('Cancelled scheduled proactive message', 'ProactiveDelivery', {
                scheduleId,
                chatId: scheduled.messageData.chatId
            });
            
            return true;
        }
        return false;
    }

    /**
     * UTILITY: Convert timing decision to seconds (same as ProactiveIntelligenceService)
     */
    getDelaySecondsFromTiming(timing) {
        const timingMap = {
            'immediate': 0,
            'wait_30_seconds': 30,
            'wait_2_minutes': 120,
            'wait_5_minutes': 300,
            'wait_later': 600,  // Default to 10 minutes for 'later'
            'none': null
        };
        
        return timingMap[timing] ?? null;
    }

    /**
     * DOMAIN LAYER: Get proactive message analytics
     */
    async getDeliveryAnalytics(chatId = null) {
        try {
            const activeSessionCount = this.activeSessions.size;
            const scheduledMessageCount = this.scheduledMessages.size;
            
            const scheduledMessages = Array.from(this.scheduledMessages.entries()).map(([id, data]) => ({
                scheduleId: id,
                chatId: data.messageData?.chatId || 'unknown',
                scheduledAt: data.scheduledAt,
                content: (data.messageData?.content || '').substring(0, 50) + '...'
            }));

            return {
                activeSessionCount,
                scheduledMessageCount,
                scheduledMessages: chatId 
                    ? scheduledMessages.filter(msg => msg.chatId === chatId)
                    : scheduledMessages
            };

        } catch (error) {
            this.logger.error('Error getting delivery analytics', 'ProactiveDelivery', {
                error: error.message,
                chatId
            });
            return { activeSessionCount: 0, scheduledMessageCount: 0, scheduledMessages: [] };
        }
    }

    /**
     * FOLLOWS YOUR PATTERN: Enhanced health check
     */
    async onHealthCheck() {
        const analytics = await this.getDeliveryAnalytics();
        
        return {
            healthy: true,
            details: {
                activeSessionCount: analytics.activeSessionCount,
                scheduledMessageCount: analytics.scheduledMessageCount,
                hasRequiredServices: !!(this.dal && this.proactiveLearning),
                eventEmitterListenerCount: this.messageEmitter.listenerCount('proactive-message')
            }
        };
    }

    /**
     * CLEANUP: Clear all scheduled messages and sessions
     */
    async cleanup() {
        this.logger.info('Cleaning up ProactiveDeliveryService', 'ProactiveDelivery');
        
        // Clear all scheduled timers
        for (const [scheduleId, scheduled] of this.scheduledMessages) {
            clearTimeout(scheduled.timer);
        }
        this.scheduledMessages.clear();
        
        // Clear active sessions
        this.activeSessions.clear();
        
        // Remove all event listeners
        this.messageEmitter.removeAllListeners();
        
        this.logger.info('ProactiveDeliveryService cleanup completed', 'ProactiveDelivery');
    }
}

module.exports = ProactiveDeliveryService;
