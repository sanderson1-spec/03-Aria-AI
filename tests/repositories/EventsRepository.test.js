/**
 * Unit Tests for EventsRepository
 * 
 * CLEAN ARCHITECTURE TESTING:
 * - Test event creation and occurrence calculation
 * - Test multi-user data isolation
 * - Test chat-scoped event queries
 * - Mock database dependencies for isolated testing
 */

const EventsRepository = require('../../backend/dal/repositories/CORE_EventsRepository');

describe('EventsRepository', () => {
    let eventsRepo;
    let mockDeps;

    beforeEach(() => {
        mockDeps = createMockDependencies();
        eventsRepo = new EventsRepository('events', mockDeps);
    });

    describe('Architecture Compliance', () => {
        test('should extend BaseRepository', () => {
            expect(eventsRepo.constructor.name).toBe('EventsRepository');
            expect(eventsRepo.tableName).toBe('events');
            expect(eventsRepo.dal).toBeDefined();
            expect(eventsRepo.logger).toBeDefined();
            expect(eventsRepo.errorHandler).toBeDefined();
        });

        test('should have proper dependencies injected', () => {
            expect(mockDeps.dal).toBeDefined();
            expect(mockDeps.logger).toBeDefined();
            expect(mockDeps.errorHandler).toBeDefined();
        });

        test('should implement required repository interface', () => {
            const requiredMethods = ['count', 'findById', 'create', 'update', 'delete'];
            requiredMethods.forEach(method => {
                expect(typeof eventsRepo[method]).toBe('function');
            });
        });

        test('should implement event-specific methods', () => {
            const eventMethods = [
                'createEvent',
                'getUpcomingEvents',
                'getDueEvents',
                'updateEventOccurrence',
                'getEventById',
                'updateEventStatus',
                'deactivateEvent',
                'calculateNextOccurrence'
            ];
            eventMethods.forEach(method => {
                expect(typeof eventsRepo[method]).toBe('function');
            });
        });
    });

    describe('Event Creation', () => {
        test('should create one-time event with next_occurrence equal to starts_at', async () => {
            const eventData = {
                id: 'event-1',
                user_id: 'user-123',
                chat_id: 'chat-456',
                character_id: 'char-789',
                title: 'Project Review',
                description: 'Review project milestones',
                recurrence_type: 'once',
                starts_at: '2025-10-10T14:00:00Z'
            };

            const mockCreatedEvent = { 
                ...eventData,
                next_occurrence: eventData.starts_at,
                is_active: 1,
                status: 'scheduled'
            };
            mockDeps.dal.create.mockResolvedValue(mockCreatedEvent);

            const result = await eventsRepo.createEvent(eventData);

            expect(mockDeps.dal.create).toHaveBeenCalled();
            const createCall = mockDeps.dal.create.mock.calls[0];
            expect(createCall[0]).toBe('events');
            expect(createCall[1].id).toBe('event-1');
            expect(createCall[1].recurrence_type).toBe('once');
            expect(createCall[1].next_occurrence).toBe('2025-10-10T14:00:00Z');
            expect(result).toEqual(mockCreatedEvent);
        });

        test('should create daily recurring event with calculated next_occurrence', async () => {
            const eventData = {
                id: 'event-2',
                user_id: 'user-123',
                chat_id: 'chat-456',
                character_id: 'char-789',
                title: 'Daily Check-in',
                recurrence_type: 'daily',
                recurrence_data: JSON.stringify({ time: '07:00' }),
                starts_at: '2025-10-08T00:00:00Z'
            };

            mockDeps.dal.create.mockResolvedValue({ id: 'event-2' });

            await eventsRepo.createEvent(eventData);

            const createCall = mockDeps.dal.create.mock.calls[0];
            expect(createCall[1].recurrence_type).toBe('daily');
            expect(createCall[1].next_occurrence).toBeDefined();
            expect(createCall[1].next_occurrence).toContain('2025-10-08');
        });

        test('should create weekly recurring event', async () => {
            const eventData = {
                id: 'event-3',
                user_id: 'user-123',
                chat_id: 'chat-456',
                character_id: 'char-789',
                title: 'Weekly Team Meeting',
                recurrence_type: 'weekly',
                recurrence_data: JSON.stringify({ day_of_week: 'monday', time: '10:00' }),
                starts_at: '2025-10-13T10:00:00Z'
            };

            mockDeps.dal.create.mockResolvedValue({ id: 'event-3' });

            await eventsRepo.createEvent(eventData);

            const createCall = mockDeps.dal.create.mock.calls[0];
            expect(createCall[1].recurrence_type).toBe('weekly');
            expect(createCall[1].next_occurrence).toBe('2025-10-13T10:00:00Z');
        });

        test('should create monthly recurring event', async () => {
            const eventData = {
                id: 'event-4',
                user_id: 'user-123',
                chat_id: 'chat-456',
                character_id: 'char-789',
                title: 'Monthly Report',
                recurrence_type: 'monthly',
                recurrence_data: JSON.stringify({ day_of_month: 1, time: '09:00' }),
                starts_at: '2025-11-01T09:00:00Z'
            };

            mockDeps.dal.create.mockResolvedValue({ id: 'event-4' });

            await eventsRepo.createEvent(eventData);

            const createCall = mockDeps.dal.create.mock.calls[0];
            expect(createCall[1].recurrence_type).toBe('monthly');
            expect(createCall[1].next_occurrence).toBe('2025-11-01T09:00:00Z');
        });

        test('should set default status and is_active when not specified', async () => {
            const eventData = {
                id: 'event-5',
                user_id: 'user-123',
                chat_id: 'chat-456',
                character_id: 'char-789',
                title: 'Simple Event',
                recurrence_type: 'once',
                starts_at: '2025-10-15T12:00:00Z'
            };

            mockDeps.dal.create.mockResolvedValue({ id: 'event-5' });

            await eventsRepo.createEvent(eventData);

            const createCall = mockDeps.dal.create.mock.calls[0];
            expect(createCall[1].is_active).toBe(1);
            expect(createCall[1].status).toBe('scheduled');
        });

        test('should handle empty recurrence_data', async () => {
            const eventData = {
                id: 'event-6',
                user_id: 'user-123',
                chat_id: 'chat-456',
                character_id: 'char-789',
                title: 'Event Without Recurrence Data',
                recurrence_type: 'once',
                starts_at: '2025-10-16T08:00:00Z'
            };

            mockDeps.dal.create.mockResolvedValue({ id: 'event-6' });

            await eventsRepo.createEvent(eventData);

            const createCall = mockDeps.dal.create.mock.calls[0];
            expect(createCall[1].recurrence_data).toBe('{}');
        });
    });

    describe('Upcoming Events Query', () => {
        test('should get upcoming events for specific chat', async () => {
            const mockEvents = [
                {
                    id: 'event-1',
                    user_id: 'user-123',
                    chat_id: 'chat-456',
                    character_id: 'char-789',
                    title: 'Morning Check-in',
                    next_occurrence: '2025-10-09T07:00:00Z',
                    is_active: 1
                },
                {
                    id: 'event-2',
                    user_id: 'user-123',
                    chat_id: 'chat-456',
                    character_id: 'char-789',
                    title: 'Evening Review',
                    next_occurrence: '2025-10-09T20:00:00Z',
                    is_active: 1
                }
            ];
            mockDeps.dal.query.mockResolvedValue(mockEvents);

            const result = await eventsRepo.getUpcomingEvents('user-123', 'chat-456');

            expect(result).toEqual(mockEvents);
            expect(mockDeps.dal.query).toHaveBeenCalledWith(
                expect.stringContaining('user_id = ?'),
                ['user-123', 'chat-456', expect.any(String), 10]
            );
            expect(mockDeps.dal.query).toHaveBeenCalledWith(
                expect.stringContaining('chat_id = ?'),
                ['user-123', 'chat-456', expect.any(String), 10]
            );
            expect(mockDeps.dal.query).toHaveBeenCalledWith(
                expect.stringContaining('is_active = 1'),
                ['user-123', 'chat-456', expect.any(String), 10]
            );
        });

        test('should order upcoming events by next_occurrence ASC', async () => {
            mockDeps.dal.query.mockResolvedValue([]);

            await eventsRepo.getUpcomingEvents('user-123', 'chat-456');

            expect(mockDeps.dal.query).toHaveBeenCalledWith(
                expect.stringContaining('ORDER BY next_occurrence ASC'),
                ['user-123', 'chat-456', expect.any(String), 10]
            );
        });

        test('should limit results to specified limit', async () => {
            mockDeps.dal.query.mockResolvedValue([]);

            await eventsRepo.getUpcomingEvents('user-123', 'chat-456', 5);

            expect(mockDeps.dal.query).toHaveBeenCalledWith(
                expect.stringContaining('LIMIT'),
                ['user-123', 'chat-456', expect.any(String), 5]
            );
        });

        test('should only return future events', async () => {
            mockDeps.dal.query.mockResolvedValue([]);

            await eventsRepo.getUpcomingEvents('user-123', 'chat-456');

            expect(mockDeps.dal.query).toHaveBeenCalledWith(
                expect.stringContaining('next_occurrence >= ?'),
                ['user-123', 'chat-456', expect.any(String), 10]
            );
        });

        test('should return empty array when no upcoming events exist', async () => {
            mockDeps.dal.query.mockResolvedValue([]);

            const result = await eventsRepo.getUpcomingEvents('user-123', 'chat-456');

            expect(result).toEqual([]);
        });
    });

    describe('Due Events Query', () => {
        test('should get all due events across all users', async () => {
            const mockDueEvents = [
                {
                    id: 'event-1',
                    user_id: 'user-123',
                    chat_id: 'chat-456',
                    title: 'Due Event 1',
                    next_occurrence: '2025-10-08T06:00:00Z',
                    is_active: 1
                },
                {
                    id: 'event-2',
                    user_id: 'user-456',
                    chat_id: 'chat-789',
                    title: 'Due Event 2',
                    next_occurrence: '2025-10-08T07:00:00Z',
                    is_active: 1
                }
            ];
            mockDeps.dal.query.mockResolvedValue(mockDueEvents);

            const result = await eventsRepo.getDueEvents();

            expect(result).toEqual(mockDueEvents);
            expect(mockDeps.dal.query).toHaveBeenCalledWith(
                expect.stringContaining('is_active = 1'),
                [expect.any(String)]
            );
            expect(mockDeps.dal.query).toHaveBeenCalledWith(
                expect.stringContaining('next_occurrence <= ?'),
                [expect.any(String)]
            );
        });

        test('should order due events by next_occurrence ASC', async () => {
            mockDeps.dal.query.mockResolvedValue([]);

            await eventsRepo.getDueEvents();

            expect(mockDeps.dal.query).toHaveBeenCalledWith(
                expect.stringContaining('ORDER BY next_occurrence ASC'),
                [expect.any(String)]
            );
        });

        test('should return empty array when no due events exist', async () => {
            mockDeps.dal.query.mockResolvedValue([]);

            const result = await eventsRepo.getDueEvents();

            expect(result).toEqual([]);
        });
    });

    describe('Occurrence Updates', () => {
        test('should update event occurrence timestamps', async () => {
            mockDeps.dal.update.mockResolvedValue({ changes: 1 });

            const lastOccurrence = '2025-10-08T07:00:00Z';
            const nextOccurrence = '2025-10-09T07:00:00Z';

            const result = await eventsRepo.updateEventOccurrence('event-1', lastOccurrence, nextOccurrence);

            expect(result).toBe(true);
            expect(mockDeps.dal.update).toHaveBeenCalledWith(
                'events',
                {
                    last_occurrence: lastOccurrence,
                    next_occurrence: nextOccurrence
                },
                { id: 'event-1' }
            );
        });

        test('should log occurrence update', async () => {
            mockDeps.dal.update.mockResolvedValue({ changes: 1 });

            await eventsRepo.updateEventOccurrence('event-1', '2025-10-08T07:00:00Z', '2025-10-09T07:00:00Z');

            expect(mockDeps.logger.info).toHaveBeenCalledWith(
                'Event occurrence updated',
                'EventsRepository',
                { eventId: 'event-1' }
            );
        });
    });

    describe('Get Event By ID', () => {
        test('should fetch event with character information', async () => {
            const mockEvent = {
                id: 'event-1',
                user_id: 'user-123',
                chat_id: 'chat-456',
                character_id: 'char-789',
                title: 'Morning Check-in',
                character_name: 'Aria',
                personality_description: 'Balanced and supportive'
            };
            mockDeps.dal.queryOne.mockResolvedValue(mockEvent);

            const result = await eventsRepo.getEventById('event-1');

            expect(result).toEqual(mockEvent);
            expect(mockDeps.dal.queryOne).toHaveBeenCalledWith(
                expect.stringContaining('LEFT JOIN personalities'),
                ['event-1']
            );
        });

        test('should return null when event not found', async () => {
            mockDeps.dal.queryOne.mockResolvedValue(null);

            const result = await eventsRepo.getEventById('non-existent');

            expect(result).toBeNull();
        });
    });

    describe('Status Updates', () => {
        test('should update event status', async () => {
            mockDeps.dal.update.mockResolvedValue({ changes: 1 });

            const result = await eventsRepo.updateEventStatus('event-1', 'completed');

            expect(result).toBe(true);
            expect(mockDeps.dal.update).toHaveBeenCalledWith(
                'events',
                { status: 'completed' },
                { id: 'event-1' }
            );
        });

        test('should support different status values', async () => {
            mockDeps.dal.update.mockResolvedValue({ changes: 1 });

            const statuses = ['scheduled', 'completed', 'missed', 'cancelled'];

            for (const status of statuses) {
                await eventsRepo.updateEventStatus('event-1', status);
            }

            expect(mockDeps.dal.update).toHaveBeenCalledTimes(4);
        });

        test('should log status update', async () => {
            mockDeps.dal.update.mockResolvedValue({ changes: 1 });

            await eventsRepo.updateEventStatus('event-1', 'completed');

            expect(mockDeps.logger.info).toHaveBeenCalledWith(
                'Event status updated',
                'EventsRepository',
                { eventId: 'event-1', status: 'completed' }
            );
        });
    });

    describe('Deactivation', () => {
        test('should deactivate event (soft delete)', async () => {
            mockDeps.dal.update.mockResolvedValue({ changes: 1 });

            const result = await eventsRepo.deactivateEvent('event-1');

            expect(result).toBe(true);
            expect(mockDeps.dal.update).toHaveBeenCalledWith(
                'events',
                { is_active: 0 },
                { id: 'event-1' }
            );
        });

        test('should log deactivation', async () => {
            mockDeps.dal.update.mockResolvedValue({ changes: 1 });

            await eventsRepo.deactivateEvent('event-1');

            expect(mockDeps.logger.info).toHaveBeenCalledWith(
                'Event deactivated',
                'EventsRepository',
                { eventId: 'event-1' }
            );
        });
    });

    describe('Next Occurrence Calculation', () => {
        test('should return null for one-time events', async () => {
            const event = {
                id: 'event-1',
                recurrence_type: 'once',
                starts_at: '2025-10-08T10:00:00Z',
                recurrence_data: '{}'
            };

            const result = await eventsRepo.calculateNextOccurrence(event);

            expect(result).toBeNull();
        });

        test('should calculate next occurrence for daily events', async () => {
            const event = {
                id: 'event-1',
                recurrence_type: 'daily',
                starts_at: '2025-10-08T07:00:00Z',
                last_occurrence: '2025-10-08T07:00:00Z',
                recurrence_data: JSON.stringify({ time: '07:00' })
            };

            const result = await eventsRepo.calculateNextOccurrence(event);

            expect(result).toBeDefined();
            expect(result).toContain('2025-10-09');
            // Verify it's a valid ISO date
            expect(new Date(result).toISOString()).toBe(result);
        });

        test('should calculate next occurrence for weekly events', async () => {
            const event = {
                id: 'event-1',
                recurrence_type: 'weekly',
                starts_at: '2025-10-08T10:00:00Z',
                last_occurrence: '2025-10-08T10:00:00Z',
                recurrence_data: '{}'
            };

            const result = await eventsRepo.calculateNextOccurrence(event);

            expect(result).toBeDefined();
            expect(result).toContain('2025-10-15');
        });

        test('should calculate next occurrence for monthly events', async () => {
            const event = {
                id: 'event-1',
                recurrence_type: 'monthly',
                starts_at: '2025-10-08T09:00:00Z',
                last_occurrence: '2025-10-08T09:00:00Z',
                recurrence_data: '{}'
            };

            const result = await eventsRepo.calculateNextOccurrence(event);

            expect(result).toBeDefined();
            expect(result).toContain('2025-11-08');
        });

        test('should use default time for daily events without time specified', async () => {
            const event = {
                id: 'event-1',
                recurrence_type: 'daily',
                starts_at: '2025-10-08T00:00:00Z',
                last_occurrence: '2025-10-08T00:00:00Z',
                recurrence_data: '{}'
            };

            const result = await eventsRepo.calculateNextOccurrence(event);

            expect(result).toBeDefined();
            expect(result).toContain('00:00');
        });

        test('should handle missing last_occurrence by using starts_at', async () => {
            const event = {
                id: 'event-1',
                recurrence_type: 'daily',
                starts_at: '2025-10-08T07:00:00Z',
                recurrence_data: JSON.stringify({ time: '07:00' })
            };

            const result = await eventsRepo.calculateNextOccurrence(event);

            expect(result).toBeDefined();
            // Verify it's a valid ISO date string
            expect(new Date(result).toISOString()).toBe(result);
        });

        test('should return null for unknown recurrence types', async () => {
            const event = {
                id: 'event-1',
                recurrence_type: 'unknown',
                starts_at: '2025-10-08T10:00:00Z',
                recurrence_data: '{}'
            };

            const result = await eventsRepo.calculateNextOccurrence(event);

            expect(result).toBeNull();
        });
    });

    describe('User Isolation', () => {
        test('getUpcomingEvents should filter by userId', async () => {
            mockDeps.dal.query.mockResolvedValue([]);

            await eventsRepo.getUpcomingEvents('user-123', 'chat-456');

            const queryCall = mockDeps.dal.query.mock.calls[0];
            expect(queryCall[0]).toContain('user_id = ?');
            expect(queryCall[1]).toContain('user-123');
        });

        test('createEvent should require userId in eventData', async () => {
            const eventData = {
                id: 'event-1',
                user_id: 'user-123',
                chat_id: 'chat-456',
                character_id: 'char-789',
                title: 'Test Event',
                recurrence_type: 'once',
                starts_at: '2025-10-10T12:00:00Z'
            };

            mockDeps.dal.create.mockResolvedValue({ id: 'event-1' });

            await eventsRepo.createEvent(eventData);

            const createCall = mockDeps.dal.create.mock.calls[0];
            expect(createCall[1].user_id).toBe('user-123');
        });

        test('different users should have isolated events', async () => {
            const user1Events = [
                { id: 'event-1', user_id: 'user-123', chat_id: 'chat-456' }
            ];
            const user2Events = [
                { id: 'event-2', user_id: 'user-456', chat_id: 'chat-789' }
            ];

            mockDeps.dal.query.mockResolvedValueOnce(user1Events);
            const result1 = await eventsRepo.getUpcomingEvents('user-123', 'chat-456');
            
            mockDeps.dal.query.mockResolvedValueOnce(user2Events);
            const result2 = await eventsRepo.getUpcomingEvents('user-456', 'chat-789');

            expect(result1).toEqual(user1Events);
            expect(result2).toEqual(user2Events);
            expect(mockDeps.dal.query).toHaveBeenCalledTimes(2);
        });
    });

    describe('Error Handling', () => {
        test('should handle database errors gracefully in createEvent', async () => {
            const dbError = new Error('Insert failed');
            mockDeps.dal.create.mockRejectedValue(dbError);

            await expect(
                eventsRepo.createEvent({
                    id: 'event-1',
                    user_id: 'user-123',
                    chat_id: 'chat-456',
                    character_id: 'char-789',
                    title: 'Test',
                    recurrence_type: 'once',
                    starts_at: '2025-10-10T12:00:00Z'
                })
            ).rejects.toThrow();
        });

        test('should handle database errors gracefully in getUpcomingEvents', async () => {
            const dbError = new Error('Query failed');
            mockDeps.dal.query.mockRejectedValue(dbError);

            await expect(
                eventsRepo.getUpcomingEvents('user-123', 'chat-456')
            ).rejects.toThrow();
        });

        test('should handle database errors gracefully in getDueEvents', async () => {
            const dbError = new Error('Query failed');
            mockDeps.dal.query.mockRejectedValue(dbError);

            await expect(
                eventsRepo.getDueEvents()
            ).rejects.toThrow();
        });

        test('should handle database errors gracefully in updateEventOccurrence', async () => {
            const dbError = new Error('Update failed');
            mockDeps.dal.update.mockRejectedValue(dbError);

            await expect(
                eventsRepo.updateEventOccurrence('event-1', '2025-10-08T07:00:00Z', '2025-10-09T07:00:00Z')
            ).rejects.toThrow();
        });

        test('should handle database errors gracefully in updateEventStatus', async () => {
            const dbError = new Error('Update failed');
            mockDeps.dal.update.mockRejectedValue(dbError);

            await expect(
                eventsRepo.updateEventStatus('event-1', 'completed')
            ).rejects.toThrow();
        });

        test('should handle database errors gracefully in deactivateEvent', async () => {
            const dbError = new Error('Update failed');
            mockDeps.dal.update.mockRejectedValue(dbError);

            await expect(
                eventsRepo.deactivateEvent('event-1')
            ).rejects.toThrow();
        });

        test('should handle database errors gracefully in calculateNextOccurrence', async () => {
            const dbError = new Error('Calculation failed');
            mockDeps.errorHandler.wrapRepositoryError.mockImplementation(() => {
                throw dbError;
            });

            // This should still work as calculateNextOccurrence is mostly pure logic
            const event = {
                id: 'event-1',
                recurrence_type: 'once',
                starts_at: '2025-10-08T10:00:00Z',
                recurrence_data: '{}'
            };

            const result = await eventsRepo.calculateNextOccurrence(event);
            expect(result).toBeNull();
        });
    });
});
