/**
 * Integration Tests for Events Workflow
 * 
 * CLEAN ARCHITECTURE TESTING:
 * - Tests complete event lifecycle with real services
 * - Tests event creation, reminders, and completion
 * - Tests chat isolation for multi-user support
 * - Tests LLM-driven personality-based decisions
 * - Tests time-based event scheduling and recurrence
 */

const { setupServices } = require('../../setupServices');

describe('Events Workflow Integration', () => {
    let serviceFactory;

    beforeEach(async () => {
        // Create fresh service factory for each test
        serviceFactory = await setupServices({
            dbPath: ':memory:',
            includeMetadata: false
        });
    });

    afterEach(async () => {
        if (serviceFactory) {
            await serviceFactory.shutdown();
            serviceFactory = null;
        }
    });

    describe('Scenario A: One-Time Event Creation', () => {
        it('should create one-time event with correct next_occurrence', async () => {
            const dal = serviceFactory.services.get('database').getDAL();

            // Step 1: Create test user and character
            const timestamp = Date.now();
            const user = await dal.users.createUser({
                username: `event_user_${timestamp}`,
                email: `event_${timestamp}@test.com`,
                display_name: 'Event Test User'
            });

            const character = await dal.personalities.createCharacter({
                id: `event_char_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
                name: 'Event Test Character',
                description: 'A character that schedules meetings and events'
            });

            const chatId = `event_chat_${timestamp}`;

            // Step 2: Create one-time event
            const startsAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(); // 2 hours from now
            const event = await dal.events.createEvent({
                user_id: user.id,
                chat_id: chatId,
                character_id: character.id,
                title: 'One-on-One Meeting',
                description: 'Review project progress',
                recurrence_type: 'once',
                recurrence_data: {},
                starts_at: startsAt,
                next_occurrence: startsAt,
                is_active: true,
                status: 'scheduled'
            });

            // Step 3: Verify event was created correctly
            expect(event).toBeDefined();
            expect(event.id).toBeDefined();
            expect(event.user_id).toBe(user.id);
            expect(event.chat_id).toBe(chatId);
            expect(event.character_id).toBe(character.id);
            expect(event.title).toBe('One-on-One Meeting');
            expect(event.recurrence_type).toBe('once');
            expect(event.next_occurrence).toBe(startsAt);
            expect(event.status).toBe('scheduled');
            expect(event.is_active).toBe(true);

            // Step 4: Verify event appears in upcoming events
            const upcomingEvents = await dal.events.getUpcomingEvents(user.id, chatId, 10);
            expect(upcomingEvents).toHaveLength(1);
            expect(upcomingEvents[0].id).toBe(event.id);
        });
    });

    describe('Scenario B: Recurring Daily Event', () => {
        it('should create daily recurring event and update next_occurrence after trigger', async () => {
            const dal = serviceFactory.services.get('database').getDAL();

            // Step 1: Set up test data
            const timestamp = Date.now();
            const user = await dal.users.createUser({
                username: `recurring_user_${timestamp}`,
                email: `recurring_${timestamp}@test.com`
            });

            const character = await dal.personalities.createCharacter({
                id: `recurring_char_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
                name: 'Recurring Character',
                description: 'A character for recurring events'
            });

            const chatId = `recurring_chat_${timestamp}`;

            // Step 2: Create daily recurring event
            const now = new Date();
            const startsAt = new Date(now);
            startsAt.setHours(7, 0, 0, 0); // 7:00 AM today
            if (startsAt < now) {
                startsAt.setDate(startsAt.getDate() + 1); // If past, start tomorrow
            }

            const event = await dal.events.createEvent({
                user_id: user.id,
                chat_id: chatId,
                character_id: character.id,
                title: 'Daily Morning Check-in',
                description: 'Start your day right',
                recurrence_type: 'daily',
                recurrence_data: { time: '07:00' },
                starts_at: startsAt.toISOString(),
                next_occurrence: startsAt.toISOString(),
                is_active: true,
                status: 'scheduled'
            });

            expect(event.recurrence_type).toBe('daily');
            expect(event.is_active).toBe(true);

            // Step 3: Simulate event trigger (event time has passed)
            const originalNextOccurrence = new Date(event.next_occurrence);
            
            // Update event occurrence (simulate EventScheduler processing)
            const nextDay = new Date(originalNextOccurrence);
            nextDay.setDate(nextDay.getDate() + 1);
            
            await dal.events.updateEventOccurrence(
                event.id,
                originalNextOccurrence.toISOString(),
                nextDay.toISOString()
            );

            // Step 4: Verify next_occurrence updated to next day at 7am
            const updatedEvent = await dal.events.getEventById(event.id);
            expect(updatedEvent.next_occurrence).toBe(nextDay.toISOString());
            expect(updatedEvent.last_occurrence).toBe(originalNextOccurrence.toISOString());
            expect(updatedEvent.is_active).toBe(true); // Still active for recurring events
            expect(updatedEvent.status).toBe('scheduled');

            // Step 5: Verify event still appears in upcoming
            const upcomingEvents = await dal.events.getUpcomingEvents(user.id, chatId, 10);
            expect(upcomingEvents).toHaveLength(1);
            expect(upcomingEvents[0].id).toBe(event.id);
        });
    });

    describe('Scenario C: Event Reminder (LLM-driven)', () => {
        it('should use character personality to decide on event reminder', async () => {
            const dal = serviceFactory.services.get('database').getDAL();
            const proactiveIntelligence = serviceFactory.services.get('proactiveIntelligence');

            // Step 1: Set up test data
            const timestamp = Date.now();
            const user = await dal.users.createUser({
                username: `reminder_user_${timestamp}`,
                email: `reminder_${timestamp}@test.com`
            });

            const character = await dal.personalities.createCharacter({
                id: `reminder_char_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
                name: 'Strict Professional Character',
                description: 'A strict, professional character who sends timely reminders',
                definition: JSON.stringify({
                    personality_traits: ['professional', 'punctual', 'organized']
                })
            });

            const chatId = `reminder_chat_${timestamp}`;

            // Step 2: Create event that's approaching
            const eventTime = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes from now
            const event = await dal.events.createEvent({
                user_id: user.id,
                chat_id: chatId,
                character_id: character.id,
                title: 'Important Client Meeting',
                description: 'Quarterly review with client',
                recurrence_type: 'once',
                recurrence_data: {},
                starts_at: eventTime.toISOString(),
                next_occurrence: eventTime.toISOString(),
                is_active: true,
                status: 'scheduled'
            });

            // Step 3: Mock LLM response for reminder decision
            const structuredResponse = serviceFactory.services.get('structuredResponse');
            const originalGenerate = structuredResponse.generateStructuredResponse.bind(structuredResponse);
            
            structuredResponse.generateStructuredResponse = jest.fn().mockImplementation(async (prompt, schema, options) => {
                // If this is a reminder decision prompt
                if (prompt.includes('Should you remind the user about this event')) {
                    return {
                        should_remind: true,
                        reminder_timing: '15_minutes_before',
                        reminder_message: 'Hi! Just a reminder that you have the Important Client Meeting coming up in 30 minutes. Make sure you have all the quarterly review materials ready!'
                    };
                }
                // Otherwise use original implementation
                return originalGenerate(prompt, schema, options);
            });

            // Step 4: Call handleEventReminder
            const reminderDecision = await proactiveIntelligence.handleEventReminder(event);

            // Step 5: Verify LLM-driven decision
            expect(reminderDecision).toBeDefined();
            expect(reminderDecision.should_remind).toBe(true);
            expect(reminderDecision.reminder_timing).toBe('15_minutes_before');
            expect(reminderDecision.reminder_message).toContain('Important Client Meeting');
            expect(reminderDecision.reminder_message).toContain('30 minutes');

            // Restore original method
            structuredResponse.generateStructuredResponse = originalGenerate;
        });

        it('should handle casual character not reminding', async () => {
            const dal = serviceFactory.services.get('database').getDAL();
            const proactiveIntelligence = serviceFactory.services.get('proactiveIntelligence');

            // Step 1: Set up casual character
            const timestamp = Date.now();
            const user = await dal.users.createUser({
                username: `casual_user_${timestamp}`,
                email: `casual_${timestamp}@test.com`
            });

            const character = await dal.personalities.createCharacter({
                id: `casual_char_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
                name: 'Casual Flexible Character',
                description: 'A laid-back, flexible character',
                definition: JSON.stringify({
                    personality_traits: ['casual', 'flexible', 'relaxed']
                })
            });

            const chatId = `casual_chat_${timestamp}`;

            // Step 2: Create casual event
            const eventTime = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
            const event = await dal.events.createEvent({
                user_id: user.id,
                chat_id: chatId,
                character_id: character.id,
                title: 'Casual Coffee Chat',
                recurrence_type: 'once',
                recurrence_data: {},
                starts_at: eventTime.toISOString(),
                next_occurrence: eventTime.toISOString(),
                is_active: true,
                status: 'scheduled'
            });

            // Step 3: Mock LLM response - casual character doesn't remind
            const structuredResponse = serviceFactory.services.get('structuredResponse');
            const originalGenerate = structuredResponse.generateStructuredResponse.bind(structuredResponse);
            
            structuredResponse.generateStructuredResponse = jest.fn().mockImplementation(async (prompt, schema, options) => {
                if (prompt.includes('Should you remind the user about this event')) {
                    return {
                        should_remind: false,
                        reminder_timing: 'dont_remind',
                        reminder_message: ''
                    };
                }
                return originalGenerate(prompt, schema, options);
            });

            // Step 4: Call handleEventReminder
            const reminderDecision = await proactiveIntelligence.handleEventReminder(event);

            // Step 5: Verify casual character doesn't remind
            expect(reminderDecision.should_remind).toBe(false);
            expect(reminderDecision.reminder_timing).toBe('dont_remind');

            // Restore
            structuredResponse.generateStructuredResponse = originalGenerate;
        });
    });

    describe('Scenario D: Missed Event Detection (LLM-driven)', () => {
        it('should detect missed event with strict character following up quickly', async () => {
            const dal = serviceFactory.services.get('database').getDAL();
            const proactiveIntelligence = serviceFactory.services.get('proactiveIntelligence');

            // Step 1: Set up strict character
            const timestamp = Date.now();
            const user = await dal.users.createUser({
                username: `missed_user_${timestamp}`,
                email: `missed_${timestamp}@test.com`
            });

            const character = await dal.personalities.createCharacter({
                id: `missed_char_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
                name: 'Strict Accountability Character',
                description: 'A strict character who holds people accountable',
                definition: JSON.stringify({
                    personality_traits: ['strict', 'punctual', 'disciplined']
                })
            });

            const chatId = `missed_chat_${timestamp}`;

            // Step 2: Create event that has passed
            const eventTime = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago
            const event = await dal.events.createEvent({
                user_id: user.id,
                chat_id: chatId,
                character_id: character.id,
                title: 'Morning Workout Session',
                recurrence_type: 'once',
                recurrence_data: {},
                starts_at: eventTime.toISOString(),
                next_occurrence: eventTime.toISOString(),
                is_active: true,
                status: 'scheduled'
            });

            // Step 3: Mock LLM response - strict character checks after 10 minutes
            const structuredResponse = serviceFactory.services.get('structuredResponse');
            const originalGenerate = structuredResponse.generateStructuredResponse.bind(structuredResponse);
            
            structuredResponse.generateStructuredResponse = jest.fn().mockImplementation(async (prompt, schema, options) => {
                if (prompt.includes('Should you check on the user')) {
                    return {
                        consider_missed: true,
                        follow_up_message: 'Hey, I noticed the Morning Workout Session was scheduled 10 minutes ago. Is everything okay? Did you manage to start your workout?'
                    };
                }
                return originalGenerate(prompt, schema, options);
            });

            // Step 4: Check if event is missed
            const currentTime = new Date().toISOString();
            const missedDecision = await proactiveIntelligence.checkMissedEvent(event, currentTime);

            // Step 5: Verify strict character considers it missed
            expect(missedDecision).toBeDefined();
            expect(missedDecision.consider_missed).toBe(true);
            expect(missedDecision.follow_up_message).toContain('Morning Workout Session');
            expect(missedDecision.follow_up_message).toContain('10 minutes ago');

            // Restore
            structuredResponse.generateStructuredResponse = originalGenerate;
        });

        it('should handle flexible character waiting longer before checking', async () => {
            const dal = serviceFactory.services.get('database').getDAL();
            const proactiveIntelligence = serviceFactory.services.get('proactiveIntelligence');

            // Step 1: Set up flexible character
            const timestamp = Date.now();
            const user = await dal.users.createUser({
                username: `flexible_user_${timestamp}`,
                email: `flexible_${timestamp}@test.com`
            });

            const character = await dal.personalities.createCharacter({
                id: `flexible_char_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
                name: 'Flexible Understanding Character',
                description: 'A flexible, understanding character',
                definition: JSON.stringify({
                    personality_traits: ['flexible', 'understanding', 'patient']
                })
            });

            const chatId = `flexible_chat_${timestamp}`;

            // Step 2: Create event that passed 5 minutes ago
            const eventTime = new Date(Date.now() - 5 * 60 * 1000);
            const event = await dal.events.createEvent({
                user_id: user.id,
                chat_id: chatId,
                character_id: character.id,
                title: 'Casual Study Session',
                recurrence_type: 'once',
                recurrence_data: {},
                starts_at: eventTime.toISOString(),
                next_occurrence: eventTime.toISOString(),
                is_active: true,
                status: 'scheduled'
            });

            // Step 3: Mock LLM response - flexible character doesn't check yet
            const structuredResponse = serviceFactory.services.get('structuredResponse');
            const originalGenerate = structuredResponse.generateStructuredResponse.bind(structuredResponse);
            
            structuredResponse.generateStructuredResponse = jest.fn().mockImplementation(async (prompt, schema, options) => {
                if (prompt.includes('Should you check on the user')) {
                    return {
                        consider_missed: false,
                        follow_up_message: ''
                    };
                }
                return originalGenerate(prompt, schema, options);
            });

            // Step 4: Check if event is missed
            const currentTime = new Date().toISOString();
            const missedDecision = await proactiveIntelligence.checkMissedEvent(event, currentTime);

            // Step 5: Verify flexible character doesn't consider it missed yet
            expect(missedDecision.consider_missed).toBe(false);

            // Restore
            structuredResponse.generateStructuredResponse = originalGenerate;
        });
    });

    describe('Scenario E: Event Completion', () => {
        it('should mark one-time event as completed and deactivate', async () => {
            const dal = serviceFactory.services.get('database').getDAL();

            // Step 1: Set up test data
            const timestamp = Date.now();
            const user = await dal.users.createUser({
                username: `complete_user_${timestamp}`,
                email: `complete_${timestamp}@test.com`
            });

            const character = await dal.personalities.createCharacter({
                id: `complete_char_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
                name: 'Completion Character',
                description: 'A character for completion testing'
            });

            const chatId = `complete_chat_${timestamp}`;

            // Step 2: Create one-time event
            const eventTime = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago
            const event = await dal.events.createEvent({
                user_id: user.id,
                chat_id: chatId,
                character_id: character.id,
                title: 'Project Review Meeting',
                recurrence_type: 'once',
                recurrence_data: {},
                starts_at: eventTime.toISOString(),
                next_occurrence: eventTime.toISOString(),
                is_active: true,
                status: 'scheduled'
            });

            expect(event.status).toBe('scheduled');
            expect(event.is_active).toBe(true);

            // Step 3: User attends event - mark as completed
            await dal.events.updateEventStatus(event.id, 'completed');

            // Step 4: Deactivate one-time event after completion
            await dal.events.deactivateEvent(event.id);

            // Step 5: Verify event is completed and deactivated
            const completedEvent = await dal.events.getEventById(event.id);
            expect(completedEvent.status).toBe('completed');
            expect(completedEvent.is_active).toBe(false);

            // Step 6: Verify event no longer appears in upcoming
            const upcomingEvents = await dal.events.getUpcomingEvents(user.id, chatId, 10);
            expect(upcomingEvents).toHaveLength(0);
        });

        it('should complete recurring event and calculate next occurrence', async () => {
            const dal = serviceFactory.services.get('database').getDAL();

            // Step 1: Set up test data
            const timestamp = Date.now();
            const user = await dal.users.createUser({
                username: `recurring_complete_user_${timestamp}`,
                email: `recurring_complete_${timestamp}@test.com`
            });

            const character = await dal.personalities.createCharacter({
                id: `recurring_complete_char_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
                name: 'Recurring Completion Character',
                description: 'Testing recurring completion'
            });

            const chatId = `recurring_complete_chat_${timestamp}`;

            // Step 2: Create daily recurring event
            const now = new Date();
            const startsAt = new Date(now);
            startsAt.setHours(14, 0, 0, 0); // 2:00 PM
            if (startsAt < now) {
                startsAt.setDate(startsAt.getDate() + 1);
            }

            const event = await dal.events.createEvent({
                user_id: user.id,
                chat_id: chatId,
                character_id: character.id,
                title: 'Daily Team Standup',
                recurrence_type: 'daily',
                recurrence_data: { time: '14:00' },
                starts_at: startsAt.toISOString(),
                next_occurrence: startsAt.toISOString(),
                is_active: true,
                status: 'scheduled'
            });

            const originalNextOccurrence = event.next_occurrence;

            // Step 3: User attends event - update occurrence
            const nextDay = new Date(startsAt);
            nextDay.setDate(nextDay.getDate() + 1);

            await dal.events.updateEventOccurrence(
                event.id,
                originalNextOccurrence,
                nextDay.toISOString()
            );

            // Step 4: Mark this occurrence as completed
            await dal.events.updateEventStatus(event.id, 'completed');

            // Step 5: Reset to scheduled for next occurrence
            await dal.events.updateEventStatus(event.id, 'scheduled');

            // Step 6: Verify next occurrence is calculated
            const updatedEvent = await dal.events.getEventById(event.id);
            expect(updatedEvent.next_occurrence).toBe(nextDay.toISOString());
            expect(updatedEvent.last_occurrence).toBe(originalNextOccurrence);
            expect(updatedEvent.is_active).toBe(true); // Still active for recurring
            expect(updatedEvent.status).toBe('scheduled'); // Ready for next occurrence

            // Step 7: Verify event still appears in upcoming
            const upcomingEvents = await dal.events.getUpcomingEvents(user.id, chatId, 10);
            expect(upcomingEvents).toHaveLength(1);
        });
    });

    describe('Event Isolation and Data Integrity', () => {
        it('should maintain chat isolation for events', async () => {
            const dal = serviceFactory.services.get('database').getDAL();

            // Step 1: Create user and two characters
            const timestamp = Date.now();
            const user = await dal.users.createUser({
                username: `isolation_user_${timestamp}`,
                email: `isolation_${timestamp}@test.com`
            });

            const characterA = await dal.personalities.createCharacter({
                id: `isolation_char_a_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
                name: 'Character A'
            });

            const characterB = await dal.personalities.createCharacter({
                id: `isolation_char_b_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
                name: 'Character B'
            });

            const chatA = `isolation_chat_a_${timestamp}`;
            const chatB = `isolation_chat_b_${timestamp}`;

            // Step 2: Create events in Chat A
            const eventA1 = await dal.events.createEvent({
                user_id: user.id,
                chat_id: chatA,
                character_id: characterA.id,
                title: 'Team Meeting A',
                recurrence_type: 'once',
                recurrence_data: {},
                starts_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
                next_occurrence: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
                is_active: true,
                status: 'scheduled'
            });

            // Step 3: Create events in Chat B
            const eventB1 = await dal.events.createEvent({
                user_id: user.id,
                chat_id: chatB,
                character_id: characterB.id,
                title: 'Team Meeting B',
                recurrence_type: 'once',
                recurrence_data: {},
                starts_at: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
                next_occurrence: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
                is_active: true,
                status: 'scheduled'
            });

            // Step 4: Verify Chat A only sees its events
            const eventsInA = await dal.events.getUpcomingEvents(user.id, chatA, 10);
            expect(eventsInA).toHaveLength(1);
            expect(eventsInA[0].id).toBe(eventA1.id);
            expect(eventsInA[0].chat_id).toBe(chatA);

            // Step 5: Verify Chat B only sees its events
            const eventsInB = await dal.events.getUpcomingEvents(user.id, chatB, 10);
            expect(eventsInB).toHaveLength(1);
            expect(eventsInB[0].id).toBe(eventB1.id);
            expect(eventsInB[0].chat_id).toBe(chatB);
        });

        it('should handle error recovery gracefully', async () => {
            const dal = serviceFactory.services.get('database').getDAL();

            // Test getting non-existent event
            const nonExistent = await dal.events.getEventById('non-existent-id');
            expect(nonExistent).toBeUndefined();

            // Test getting upcoming events for user with no events
            const noEvents = await dal.events.getUpcomingEvents('fake-user', 'fake-chat', 10);
            expect(noEvents).toEqual([]);

            // Verify system remains functional after errors
            const timestamp = Date.now();
            const user = await dal.users.createUser({
                username: `error_recovery_${timestamp}`,
                email: `error_${timestamp}@test.com`
            });

            expect(user).toBeDefined();
        });
    });
});
