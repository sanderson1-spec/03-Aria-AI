/**
 * Unit Tests for EventSchedulerService
 * 
 * CLEAN ARCHITECTURE TESTING:
 * - Test service creation and inheritance
 * - Test polling mechanism with fake timers
 * - Test event detection and triggering
 * - Mock external dependencies for isolated testing
 */

const EventSchedulerService = require('../../backend/services/infrastructure/CORE_EventSchedulerService');

// Use fake timers for testing polling intervals
jest.useFakeTimers();

describe('EventSchedulerService', () => {
    let eventSchedulerService;
    let mockDeps;
    let mockEventsRepo;

    beforeEach(() => {
        jest.clearAllTimers();
        mockDeps = createMockDependencies();
        
        // Create mock events repository
        mockEventsRepo = {
            getDueEvents: jest.fn().mockResolvedValue([]),
            calculateNextOccurrence: jest.fn().mockResolvedValue(null),
            updateEventOccurrence: jest.fn().mockResolvedValue(true),
            deactivateEvent: jest.fn().mockResolvedValue(true),
            updateEventStatus: jest.fn().mockResolvedValue(true)
        };
        
        // Add database service mock with getDAL() method
        mockDeps.database = {
            getDAL: jest.fn().mockReturnValue({
                events: mockEventsRepo
            })
        };

        // Add proactiveIntelligence service mock
        mockDeps.proactiveIntelligence = {
            triggerEventNotification: jest.fn().mockResolvedValue(true)
        };
        
        eventSchedulerService = new EventSchedulerService(mockDeps);
    });

    afterEach(async () => {
        // Stop polling to clean up timers
        if (eventSchedulerService.isPolling) {
            await eventSchedulerService.stopPolling();
        }
        jest.clearAllTimers();
    });

    describe('Architecture Compliance', () => {
        test('should extend AbstractService', () => {
            expect(eventSchedulerService.constructor.name).toBe('EventSchedulerService');
            expect(eventSchedulerService.name).toBe('EventSchedulerService');
            expect(eventSchedulerService.logger).toBeDefined();
            expect(eventSchedulerService.errorHandler).toBeDefined();
        });

        test('should have proper dependencies injected', () => {
            expect(eventSchedulerService.dal).toBeDefined();
            expect(eventSchedulerService.proactiveIntelligence).toBeDefined();
            expect(eventSchedulerService.logger).toBeDefined();
            expect(eventSchedulerService.errorHandler).toBeDefined();
        });

        test('should initialize with polling state', () => {
            expect(eventSchedulerService.pollingInterval).toBeNull();
            expect(eventSchedulerService.isPolling).toBe(false);
            expect(eventSchedulerService.pollIntervalMs).toBe(60000);
        });

        test('should implement required service interface', () => {
            const requiredMethods = ['initialize', 'shutdown', 'checkHealth'];
            requiredMethods.forEach(method => {
                expect(typeof eventSchedulerService[method]).toBe('function');
            });
        });

        test('should implement event scheduler-specific methods', () => {
            const schedulerMethods = [
                'startPolling',
                'stopPolling',
                'checkDueEvents',
                'processEvent'
            ];
            schedulerMethods.forEach(method => {
                expect(typeof eventSchedulerService[method]).toBe('function');
            });
        });
    });

    describe('Polling Mechanism', () => {
        test('should start polling on initialization', async () => {
            jest.spyOn(eventSchedulerService, 'startPolling');
            jest.spyOn(eventSchedulerService, 'checkDueEvents').mockResolvedValue();
            
            await eventSchedulerService.onInitialize();
            
            expect(eventSchedulerService.startPolling).toHaveBeenCalled();
            expect(eventSchedulerService.isPolling).toBe(true);
        });

        test('should stop polling on shutdown', async () => {
            await eventSchedulerService.startPolling();
            expect(eventSchedulerService.isPolling).toBe(true);
            
            await eventSchedulerService.onShutdown();
            
            expect(eventSchedulerService.isPolling).toBe(false);
            expect(eventSchedulerService.pollingInterval).toBeNull();
        });

        test('should poll every 60 seconds', async () => {
            jest.spyOn(eventSchedulerService, 'checkDueEvents').mockResolvedValue();
            
            await eventSchedulerService.startPolling();
            
            // Initial call on start
            expect(eventSchedulerService.checkDueEvents).toHaveBeenCalledTimes(1);
            
            // Advance timer by 60 seconds
            jest.advanceTimersByTime(60000);
            await Promise.resolve(); // Let promises resolve
            
            expect(eventSchedulerService.checkDueEvents).toHaveBeenCalledTimes(2);
            
            // Advance another 60 seconds
            jest.advanceTimersByTime(60000);
            await Promise.resolve();
            
            expect(eventSchedulerService.checkDueEvents).toHaveBeenCalledTimes(3);
        });

        test('should not start polling if already polling', async () => {
            await eventSchedulerService.startPolling();
            const firstInterval = eventSchedulerService.pollingInterval;
            
            await eventSchedulerService.startPolling();
            
            expect(eventSchedulerService.pollingInterval).toBe(firstInterval);
            expect(mockDeps.logger.warn).toHaveBeenCalledWith(
                'Polling already active',
                'EventSchedulerService'
            );
        });

        test('should handle stop polling when not polling', async () => {
            expect(eventSchedulerService.isPolling).toBe(false);
            
            await eventSchedulerService.stopPolling();
            
            expect(mockDeps.logger.warn).toHaveBeenCalledWith(
                'Polling not active',
                'EventSchedulerService'
            );
        });

        test('should continue polling even if checkDueEvents throws error', async () => {
            jest.spyOn(eventSchedulerService, 'checkDueEvents')
                .mockResolvedValueOnce() // First call succeeds
                .mockRejectedValueOnce(new Error('Check failed')) // Second call fails
                .mockResolvedValueOnce(); // Third call succeeds
            
            await eventSchedulerService.startPolling();
            
            // Initial call
            expect(eventSchedulerService.checkDueEvents).toHaveBeenCalledTimes(1);
            
            // Advance timer - second call will fail
            jest.advanceTimersByTime(60000);
            await Promise.resolve();
            
            expect(eventSchedulerService.checkDueEvents).toHaveBeenCalledTimes(2);
            expect(mockDeps.logger.error).toHaveBeenCalledWith(
                'Error in polling interval',
                'EventSchedulerService',
                expect.objectContaining({ error: 'Check failed' })
            );
            
            // Advance timer again - should still poll despite previous error
            jest.advanceTimersByTime(60000);
            await Promise.resolve();
            
            expect(eventSchedulerService.checkDueEvents).toHaveBeenCalledTimes(3);
            expect(eventSchedulerService.isPolling).toBe(true);
        });
    });

    describe('Due Event Detection', () => {
        test('should find events where next_occurrence <= now', async () => {
            const dueEvents = [
                {
                    id: 'event-1',
                    user_id: 'user-123',
                    chat_id: 'chat-456',
                    character_id: 'char-789',
                    title: 'Morning Check-in',
                    recurrence_type: 'daily',
                    next_occurrence: '2025-10-08T07:00:00Z'
                },
                {
                    id: 'event-2',
                    user_id: 'user-456',
                    chat_id: 'chat-789',
                    character_id: 'char-abc',
                    title: 'Weekly Review',
                    recurrence_type: 'weekly',
                    next_occurrence: '2025-10-08T08:00:00Z'
                }
            ];
            
            mockEventsRepo.getDueEvents.mockResolvedValue(dueEvents);
            jest.spyOn(eventSchedulerService, 'processEvent').mockResolvedValue();
            
            await eventSchedulerService.checkDueEvents();
            
            expect(mockEventsRepo.getDueEvents).toHaveBeenCalled();
            expect(eventSchedulerService.processEvent).toHaveBeenCalledTimes(2);
        });

        test('should log when no events are due', async () => {
            mockEventsRepo.getDueEvents.mockResolvedValue([]);
            
            await eventSchedulerService.checkDueEvents();
            
            expect(mockDeps.logger.debug).toHaveBeenCalledWith(
                'No due events found',
                'EventSchedulerService'
            );
        });

        test('should log when events are found', async () => {
            const dueEvents = [
                { id: 'event-1', user_id: 'user-123', title: 'Test Event' }
            ];
            mockEventsRepo.getDueEvents.mockResolvedValue(dueEvents);
            jest.spyOn(eventSchedulerService, 'processEvent').mockResolvedValue();
            
            await eventSchedulerService.checkDueEvents();
            
            expect(mockDeps.logger.info).toHaveBeenCalledWith(
                'Found 1 due event(s)',
                'EventSchedulerService'
            );
        });

        test('should update lastCheckTime when checking events', async () => {
            mockEventsRepo.getDueEvents.mockResolvedValue([]);
            
            const beforeCheck = eventSchedulerService.lastCheckTime;
            await eventSchedulerService.checkDueEvents();
            const afterCheck = eventSchedulerService.lastCheckTime;
            
            expect(beforeCheck).not.toBe(afterCheck);
            expect(afterCheck).toBeDefined();
        });
    });

    describe('Event Triggering', () => {
        test('should notify ProactiveIntelligenceService about event', async () => {
            const event = {
                id: 'event-1',
                user_id: 'user-123',
                chat_id: 'chat-456',
                character_id: 'char-789',
                title: 'Morning Check-in',
                recurrence_type: 'once',
                next_occurrence: '2025-10-08T07:00:00Z'
            };
            
            mockEventsRepo.calculateNextOccurrence.mockResolvedValue(null);
            
            await eventSchedulerService.processEvent(event);
            
            expect(mockDeps.proactiveIntelligence.triggerEventNotification).toHaveBeenCalledWith(event);
        });

        test('should log event processing', async () => {
            const event = {
                id: 'event-1',
                user_id: 'user-123',
                chat_id: 'chat-456',
                title: 'Test Event',
                recurrence_type: 'once'
            };
            
            mockEventsRepo.calculateNextOccurrence.mockResolvedValue(null);
            
            await eventSchedulerService.processEvent(event);
            
            expect(mockDeps.logger.info).toHaveBeenCalledWith(
                'Processing due event',
                'EventSchedulerService',
                expect.objectContaining({
                    eventId: 'event-1',
                    title: 'Test Event',
                    userId: 'user-123',
                    chatId: 'chat-456'
                })
            );
        });
    });

    describe('Occurrence Updates', () => {
        test('should update last_occurrence and next_occurrence for recurring events', async () => {
            const event = {
                id: 'event-1',
                user_id: 'user-123',
                chat_id: 'chat-456',
                title: 'Daily Check-in',
                recurrence_type: 'daily',
                recurrence_data: JSON.stringify({ time: '07:00' })
            };
            
            const nextOccurrence = '2025-10-09T07:00:00Z';
            mockEventsRepo.calculateNextOccurrence.mockResolvedValue(nextOccurrence);
            
            await eventSchedulerService.processEvent(event);
            
            expect(mockEventsRepo.updateEventOccurrence).toHaveBeenCalledWith(
                'event-1',
                expect.any(String), // last_occurrence (now)
                nextOccurrence
            );
        });

        test('should log when event is rescheduled', async () => {
            const event = {
                id: 'event-1',
                recurrence_type: 'daily',
                title: 'Daily Event'
            };
            
            const nextOccurrence = '2025-10-09T07:00:00Z';
            mockEventsRepo.calculateNextOccurrence.mockResolvedValue(nextOccurrence);
            
            await eventSchedulerService.processEvent(event);
            
            expect(mockDeps.logger.info).toHaveBeenCalledWith(
                'Event rescheduled',
                'EventSchedulerService',
                expect.objectContaining({
                    eventId: 'event-1',
                    nextOccurrence
                })
            );
        });

        test('should pass correct last_occurrence timestamp', async () => {
            const event = {
                id: 'event-1',
                recurrence_type: 'weekly'
            };
            
            const nextOccurrence = '2025-10-15T10:00:00Z';
            mockEventsRepo.calculateNextOccurrence.mockResolvedValue(nextOccurrence);
            
            await eventSchedulerService.processEvent(event);
            
            const updateCall = mockEventsRepo.updateEventOccurrence.mock.calls[0];
            expect(updateCall[0]).toBe('event-1');
            expect(updateCall[1]).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/); // ISO format
            expect(updateCall[2]).toBe(nextOccurrence);
        });
    });

    describe('One-Time Event Handling', () => {
        test('should deactivate one-time events after triggering', async () => {
            const event = {
                id: 'event-1',
                user_id: 'user-123',
                chat_id: 'chat-456',
                title: 'Project Review',
                recurrence_type: 'once',
                next_occurrence: '2025-10-10T14:00:00Z'
            };
            
            mockEventsRepo.calculateNextOccurrence.mockResolvedValue(null);
            
            await eventSchedulerService.processEvent(event);
            
            expect(mockEventsRepo.deactivateEvent).toHaveBeenCalledWith('event-1');
        });

        test('should update status to completed for one-time events', async () => {
            const event = {
                id: 'event-1',
                recurrence_type: 'once'
            };
            
            mockEventsRepo.calculateNextOccurrence.mockResolvedValue(null);
            
            await eventSchedulerService.processEvent(event);
            
            expect(mockEventsRepo.updateEventStatus).toHaveBeenCalledWith('event-1', 'completed');
        });

        test('should log when event is completed and deactivated', async () => {
            const event = {
                id: 'event-1',
                recurrence_type: 'once'
            };
            
            mockEventsRepo.calculateNextOccurrence.mockResolvedValue(null);
            
            await eventSchedulerService.processEvent(event);
            
            expect(mockDeps.logger.info).toHaveBeenCalledWith(
                'Event completed and deactivated',
                'EventSchedulerService',
                expect.objectContaining({ eventId: 'event-1' })
            );
        });

        test('should deactivate recurring events when no more occurrences', async () => {
            const event = {
                id: 'event-2',
                recurrence_type: 'daily',
                ends_at: '2025-10-08T23:59:59Z'
            };
            
            // calculateNextOccurrence returns null when event has ended
            mockEventsRepo.calculateNextOccurrence.mockResolvedValue(null);
            
            await eventSchedulerService.processEvent(event);
            
            expect(mockEventsRepo.deactivateEvent).toHaveBeenCalledWith('event-2');
            expect(mockEventsRepo.updateEventStatus).toHaveBeenCalledWith('event-2', 'completed');
        });
    });

    describe('Error Handling', () => {
        test('should continue processing other events if one fails', async () => {
            const dueEvents = [
                { id: 'event-1', user_id: 'user-123', recurrence_type: 'once' },
                { id: 'event-2', user_id: 'user-456', recurrence_type: 'daily' }
            ];
            
            mockEventsRepo.getDueEvents.mockResolvedValue(dueEvents);
            
            // First event fails, second succeeds
            jest.spyOn(eventSchedulerService, 'processEvent')
                .mockRejectedValueOnce(new Error('Processing failed'))
                .mockResolvedValueOnce();
            
            await eventSchedulerService.checkDueEvents();
            
            expect(eventSchedulerService.processEvent).toHaveBeenCalledTimes(2);
            expect(mockDeps.logger.error).toHaveBeenCalledWith(
                'Failed to process event',
                'EventSchedulerService',
                expect.objectContaining({ 
                    eventId: 'event-1',
                    error: 'Processing failed'
                })
            );
        });

        test('should handle error when ProactiveIntelligence fails', async () => {
            const event = {
                id: 'event-1',
                recurrence_type: 'once'
            };
            
            mockDeps.proactiveIntelligence.triggerEventNotification
                .mockRejectedValue(new Error('Notification failed'));
            
            await expect(
                eventSchedulerService.processEvent(event)
            ).rejects.toThrow();
        });

        test('should handle error when updateEventOccurrence fails', async () => {
            const event = {
                id: 'event-1',
                recurrence_type: 'daily'
            };
            
            mockEventsRepo.calculateNextOccurrence.mockResolvedValue('2025-10-09T07:00:00Z');
            mockEventsRepo.updateEventOccurrence.mockRejectedValue(new Error('Update failed'));
            
            await expect(
                eventSchedulerService.processEvent(event)
            ).rejects.toThrow();
        });

        test('should handle error when deactivateEvent fails', async () => {
            const event = {
                id: 'event-1',
                recurrence_type: 'once'
            };
            
            mockEventsRepo.calculateNextOccurrence.mockResolvedValue(null);
            mockEventsRepo.deactivateEvent.mockRejectedValue(new Error('Deactivate failed'));
            
            await expect(
                eventSchedulerService.processEvent(event)
            ).rejects.toThrow();
        });

        test('should wrap errors with errorHandler in checkDueEvents', async () => {
            const error = new Error('Database error');
            const wrappedError = new Error('Failed to check due events');
            
            mockEventsRepo.getDueEvents.mockRejectedValue(error);
            mockDeps.errorHandler.wrapInfrastructureError.mockReturnValue(wrappedError);
            
            await expect(
                eventSchedulerService.checkDueEvents()
            ).rejects.toThrow('Failed to check due events');
        });

        test('should wrap errors with errorHandler in processEvent', async () => {
            const event = { id: 'event-1' };
            const error = new Error('Processing error');
            const wrappedError = new Error('Failed to process event');
            
            mockDeps.proactiveIntelligence.triggerEventNotification.mockRejectedValue(error);
            mockDeps.errorHandler.wrapInfrastructureError.mockReturnValue(wrappedError);
            
            await expect(
                eventSchedulerService.processEvent(event)
            ).rejects.toThrow('Failed to process event');
        });
    });

    describe('Health Check', () => {
        test('should return polling status', async () => {
            await eventSchedulerService.startPolling();
            
            const health = await eventSchedulerService.onHealthCheck();
            
            expect(health).toEqual({
                isPolling: true,
                lastCheckTime: expect.any(String),
                pollIntervalMs: 60000,
                hasPollingInterval: true
            });
        });

        test('should report not polling when stopped', async () => {
            const health = await eventSchedulerService.onHealthCheck();
            
            expect(health.isPolling).toBe(false);
            expect(health.hasPollingInterval).toBe(false);
        });

        test('should include lastCheckTime after checking events', async () => {
            mockEventsRepo.getDueEvents.mockResolvedValue([]);
            
            await eventSchedulerService.checkDueEvents();
            const health = await eventSchedulerService.onHealthCheck();
            
            expect(health.lastCheckTime).toBeDefined();
            expect(typeof health.lastCheckTime).toBe('string');
        });

        test('should report null lastCheckTime before first check', async () => {
            const health = await eventSchedulerService.onHealthCheck();
            
            expect(health.lastCheckTime).toBeNull();
        });
    });
});
