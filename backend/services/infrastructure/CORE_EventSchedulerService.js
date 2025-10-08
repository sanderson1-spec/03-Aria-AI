/**
 * EventSchedulerService - Polls and triggers scheduled events
 * CLEAN ARCHITECTURE: Infrastructure layer service
 */
const AbstractService = require('../base/CORE_AbstractService');

class EventSchedulerService extends AbstractService {
    constructor(dependencies) {
        super('EventSchedulerService', dependencies);
        this.dal = dependencies.database.getDAL();
        this.logger = dependencies.logger;
        this.errorHandler = dependencies.errorHandling;
        this.proactiveIntelligence = dependencies.proactiveIntelligence;
        this.pollingInterval = null;
        this.isPolling = false;
        this.pollIntervalMs = 60000; // 1 minute
        this.lastCheckTime = null;
    }

    /**
     * Initialize service and start polling
     */
    async onInitialize() {
        this.logger.info('EventSchedulerService initializing', 'EventSchedulerService');
        await this.startPolling();
        this.logger.info('EventSchedulerService initialized', 'EventSchedulerService');
    }

    /**
     * Begin polling loop every 1 minute
     */
    async startPolling() {
        try {
            if (this.isPolling) {
                this.logger.warn('Polling already active', 'EventSchedulerService');
                return;
            }

            this.isPolling = true;
            this.logger.info(`Starting event polling (interval: ${this.pollIntervalMs}ms)`, 'EventSchedulerService');

            // Run immediately on start
            await this.checkDueEvents();

            // Then set up interval for subsequent checks
            this.pollingInterval = setInterval(async () => {
                try {
                    await this.checkDueEvents();
                } catch (error) {
                    this.logger.error('Error in polling interval', 'EventSchedulerService', { 
                        error: error.message 
                    });
                    // Continue polling even if errors occur
                }
            }, this.pollIntervalMs);

            this.logger.info('Event polling started successfully', 'EventSchedulerService');
        } catch (error) {
            throw this.errorHandler.wrapInfrastructureError(error, 'Failed to start polling');
        }
    }

    /**
     * Stop polling gracefully
     */
    async stopPolling() {
        try {
            if (!this.isPolling) {
                this.logger.warn('Polling not active', 'EventSchedulerService');
                return;
            }

            this.logger.info('Stopping event polling', 'EventSchedulerService');

            if (this.pollingInterval) {
                clearInterval(this.pollingInterval);
                this.pollingInterval = null;
            }

            this.isPolling = false;
            this.logger.info('Event polling stopped', 'EventSchedulerService');
        } catch (error) {
            throw this.errorHandler.wrapInfrastructureError(error, 'Failed to stop polling');
        }
    }

    /**
     * Check for due events and trigger them
     */
    async checkDueEvents() {
        try {
            this.lastCheckTime = new Date().toISOString();
            this.logger.debug('Checking for due events', 'EventSchedulerService', {
                timestamp: this.lastCheckTime
            });

            // Query due events via repository
            const dueEvents = await this.dal.events.getDueEvents();

            if (dueEvents.length === 0) {
                this.logger.debug('No due events found', 'EventSchedulerService');
                return;
            }

            this.logger.info(`Found ${dueEvents.length} due event(s)`, 'EventSchedulerService');

            // Process each due event
            for (const event of dueEvents) {
                try {
                    await this.processEvent(event);
                } catch (error) {
                    this.logger.error('Failed to process event', 'EventSchedulerService', {
                        eventId: event.id,
                        error: error.message
                    });
                    // Continue processing other events even if one fails
                }
            }

            this.logger.info(`Processed ${dueEvents.length} due event(s)`, 'EventSchedulerService');
        } catch (error) {
            throw this.errorHandler.wrapInfrastructureError(error, 'Failed to check due events');
        }
    }

    /**
     * Process a single due event
     */
    async processEvent(event) {
        try {
            this.logger.info('Processing due event', 'EventSchedulerService', {
                eventId: event.id,
                title: event.title,
                userId: event.user_id,
                chatId: event.chat_id
            });

            // Notify ProactiveIntelligenceService about event
            await this.proactiveIntelligence.triggerEventNotification(event);

            // Calculate next occurrence
            const nextOccurrence = await this.dal.events.calculateNextOccurrence(event);

            const now = new Date().toISOString();

            if (nextOccurrence) {
                // Update event with new occurrence timestamps
                await this.dal.events.updateEventOccurrence(
                    event.id,
                    now, // last_occurrence
                    nextOccurrence // next_occurrence
                );

                this.logger.info('Event rescheduled', 'EventSchedulerService', {
                    eventId: event.id,
                    nextOccurrence
                });
            } else {
                // One-time event or no more occurrences - deactivate
                await this.dal.events.deactivateEvent(event.id);
                await this.dal.events.updateEventStatus(event.id, 'completed');

                this.logger.info('Event completed and deactivated', 'EventSchedulerService', {
                    eventId: event.id
                });
            }
        } catch (error) {
            throw this.errorHandler.wrapInfrastructureError(error, 'Failed to process event', {
                eventId: event.id
            });
        }
    }

    /**
     * Stop polling on service shutdown
     */
    async onShutdown() {
        this.logger.info('EventSchedulerService shutting down', 'EventSchedulerService');
        await this.stopPolling();
        this.logger.info('EventSchedulerService shutdown complete', 'EventSchedulerService');
    }

    /**
     * Health check - return polling status and last check time
     */
    async onHealthCheck() {
        return {
            isPolling: this.isPolling,
            lastCheckTime: this.lastCheckTime,
            pollIntervalMs: this.pollIntervalMs,
            hasPollingInterval: this.pollingInterval !== null
        };
    }
}

module.exports = EventSchedulerService;
