/**
 * CLEAN ARCHITECTURE: Infrastructure Layer Service
 * SchedulingService - Background polling service for scheduled message delivery
 * 
 * FOLLOWS CLEAN ARCHITECTURE PATTERNS:
 * - Extends AbstractService
 * - Uses dependency injection pattern
 * - Integrates with DAL for database access
 * - Uses central logger and error handling
 * - Implements graceful shutdown
 */

const AbstractService = require('../base/CORE_AbstractService');

class SchedulingService extends AbstractService {
    constructor(dependencies) {
        super('SchedulingService', dependencies);
        
        this.dal = dependencies.database.getDAL();
        this.logger = dependencies.logger;
        this.errorHandler = dependencies.errorHandling;
        this.messageDelivery = dependencies.messageDelivery;
        
        this.pollingInterval = null;
        this.isPolling = false;
        this.pollingFrequency = 30000; // 30 seconds
    }

    /**
     * LIFECYCLE: Initialize service and start polling
     */
    async onInitialize() {
        try {
            this.logger.info('SchedulingService initializing', 'SchedulingService');
            
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
            if (!this.messageDelivery) {
                throw new Error('MessageDelivery service is required');
            }
            
            // Start polling on initialization
            await this.startPolling();
            
            this.logger.info('SchedulingService initialized successfully', 'SchedulingService');
            
        } catch (error) {
            throw this.errorHandler.wrapDomainError(error, 
                'Failed to initialize SchedulingService');
        }
    }

    /**
     * DOMAIN LAYER: Start background polling loop
     */
    async startPolling() {
        if (this.isPolling) {
            this.logger.warn('Polling already active', 'SchedulingService');
            return;
        }

        this.isPolling = true;
        this.logger.info('Starting scheduled message polling', 'SchedulingService', {
            frequency: `${this.pollingFrequency}ms`
        });

        // Run initial check immediately
        await this.checkScheduledMessages();

        // Set up recurring polling
        this.pollingInterval = setInterval(async () => {
            await this.checkScheduledMessages();
        }, this.pollingFrequency);
    }

    /**
     * DOMAIN LAYER: Stop polling gracefully
     */
    async stopPolling() {
        if (!this.isPolling) {
            this.logger.warn('Polling not active', 'SchedulingService');
            return;
        }

        this.isPolling = false;
        
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }

        this.logger.info('Stopped scheduled message polling', 'SchedulingService');
    }

    /**
     * DOMAIN LAYER: Main polling logic - Check for scheduled messages due for delivery
     */
    async checkScheduledMessages() {
        try {
            this.logger.debug('Checking for scheduled messages', 'SchedulingService');

            // Query proactive_engagements via DAL
            const sql = `
                SELECT * FROM proactive_engagements
                WHERE status = 'pending' 
                AND optimal_timing IS NOT NULL
                AND datetime(optimal_timing) <= datetime('now')
                ORDER BY optimal_timing ASC
            `;

            const dueMessages = await this.dal.query(sql, []);

            if (dueMessages && dueMessages.length > 0) {
                this.logger.info(`Found ${dueMessages.length} scheduled message(s) due for delivery`, 'SchedulingService');

                // Process each due message
                for (const engagement of dueMessages) {
                    try {
                        await this.deliverScheduledMessage(engagement);
                    } catch (error) {
                        // Log error but continue processing other messages
                        this.logger.error('Failed to deliver scheduled message', 'SchedulingService', {
                            engagementId: engagement.id,
                            error: error.message
                        });
                        
                        // Update status to failed
                        try {
                            await this.updateEngagementStatus(engagement.id, 'failed', error.message);
                        } catch (updateError) {
                            this.logger.error('Failed to update engagement status', 'SchedulingService', {
                                engagementId: engagement.id,
                                error: updateError.message
                            });
                        }
                    }
                }
            } else {
                this.logger.debug('No scheduled messages due for delivery', 'SchedulingService');
            }

        } catch (error) {
            // Log error but don't stop polling
            this.logger.error('Error checking scheduled messages', 'SchedulingService', {
                error: error.message
            });
        }
    }

    /**
     * DOMAIN LAYER: Deliver a scheduled message
     */
    async deliverScheduledMessage(engagement) {
        try {
            this.logger.info('Delivering scheduled message', 'SchedulingService', {
                engagementId: engagement.id,
                sessionId: engagement.session_id,
                scheduledFor: engagement.optimal_timing
            });

            // Trigger message delivery via message delivery service
            await this.messageDelivery.deliverMessageToUser(engagement.user_id, {
                type: 'proactive',
                content: engagement.engagement_content,
                metadata: engagement.engagement_metadata,
                engagementId: engagement.id
            });

            // Update engagement status to delivered
            await this.updateEngagementStatus(engagement.id, 'delivered');

            this.logger.info('Successfully delivered scheduled message', 'SchedulingService', {
                engagementId: engagement.id
            });

        } catch (error) {
            throw this.errorHandler.wrapDomainError(error, 
                'Failed to deliver scheduled message', {
                    engagementId: engagement.id
                });
        }
    }

    /**
     * INFRASTRUCTURE LAYER: Update engagement status via DAL
     */
    async updateEngagementStatus(engagementId, status, errorMessage = null) {
        try {
            const sql = `
                UPDATE proactive_engagements 
                SET status = ?, 
                    actual_timing = CASE WHEN ? = 'delivered' THEN datetime('now') ELSE actual_timing END,
                    updated_at = datetime('now')
                WHERE id = ?
            `;

            await this.dal.execute(sql, [status, status, engagementId]);

            this.logger.debug('Updated engagement status', 'SchedulingService', {
                engagementId,
                status
            });

        } catch (error) {
            throw this.errorHandler.wrapInfrastructureError(error, 
                'Failed to update engagement status', {
                    engagementId,
                    status
                });
        }
    }

    /**
     * LIFECYCLE: Graceful shutdown
     */
    async onShutdown() {
        try {
            this.logger.info('SchedulingService shutting down', 'SchedulingService');
            
            await this.stopPolling();
            
            this.logger.info('SchedulingService shutdown complete', 'SchedulingService');
            
        } catch (error) {
            this.logger.error('Error during SchedulingService shutdown', 'SchedulingService', {
                error: error.message
            });
            throw error;
        }
    }

    /**
     * HEALTH CHECK: Verify polling is active
     */
    async isHealthy() {
        return this.isPolling && this.initialized;
    }

    /**
     * UTILITY: Get polling status for monitoring
     */
    getPollingStatus() {
        return {
            isPolling: this.isPolling,
            pollingFrequency: this.pollingFrequency,
            initialized: this.initialized
        };
    }
}

module.exports = SchedulingService;

