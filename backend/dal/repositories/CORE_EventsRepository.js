/**
 * EventsRepository - Manages character-scheduled events and check-ins
 * CLEAN ARCHITECTURE: Infrastructure layer repository
 */
const BaseRepository = require('../CORE_BaseRepository');

class EventsRepository extends BaseRepository {
    constructor(tableName, dependencies) {
        super('events', dependencies);
    }

    /**
     * Create new event with calculated next_occurrence
     */
    async createEvent(eventData) {
        try {
            this.validateRequiredFields(eventData, [
                'id', 'user_id', 'chat_id', 'character_id', 
                'title', 'recurrence_type', 'starts_at'
            ], 'createEvent');

            const recurrenceData = eventData.recurrence_data || '{}';
            const parsedRecurrenceData = this.parseJSON(recurrenceData);

            // Calculate next_occurrence based on recurrence_type
            let nextOccurrence;
            if (eventData.recurrence_type === 'once') {
                nextOccurrence = eventData.starts_at;
            } else if (eventData.recurrence_type === 'daily') {
                const startsAt = new Date(eventData.starts_at);
                const time = parsedRecurrenceData.time || '00:00';
                const [hours, minutes] = time.split(':').map(Number);
                startsAt.setHours(hours, minutes, 0, 0);
                nextOccurrence = startsAt.toISOString();
            } else if (eventData.recurrence_type === 'weekly') {
                nextOccurrence = eventData.starts_at;
            } else if (eventData.recurrence_type === 'monthly') {
                nextOccurrence = eventData.starts_at;
            } else {
                nextOccurrence = eventData.starts_at;
            }

            const event = {
                ...eventData,
                recurrence_data: this.stringifyJSON(parsedRecurrenceData),
                next_occurrence: nextOccurrence,
                is_active: eventData.is_active !== undefined ? eventData.is_active : 1,
                status: eventData.status || 'scheduled'
            };

            const result = await this.create(this.sanitizeData(event));
            this.logger.info('Event created successfully', 'EventsRepository', { eventId: event.id });
            return result;
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to create event');
        }
    }

    /**
     * Get next upcoming events for specific chat
     */
    async getUpcomingEvents(userId, chatId, limit = 10) {
        try {
            const now = new Date().toISOString();
            const events = await this.dal.query(
                `SELECT * FROM events 
                 WHERE user_id = ? AND chat_id = ? AND is_active = 1 AND next_occurrence >= ?
                 ORDER BY next_occurrence ASC
                 LIMIT ?`,
                [userId, chatId, now, limit]
            );
            return events || [];
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to get upcoming events');
        }
    }

    /**
     * Get all due events across all users
     */
    async getDueEvents() {
        try {
            const now = new Date().toISOString();
            const events = await this.dal.query(
                `SELECT * FROM events 
                 WHERE is_active = 1 AND next_occurrence <= ?
                 ORDER BY next_occurrence ASC`,
                [now]
            );
            return events || [];
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to get due events');
        }
    }

    /**
     * Update last_occurrence and next_occurrence
     */
    async updateEventOccurrence(eventId, lastOccurrence, nextOccurrence) {
        try {
            const updateData = {
                last_occurrence: lastOccurrence,
                next_occurrence: nextOccurrence
            };
            await this.update(updateData, { id: eventId });
            this.logger.info('Event occurrence updated', 'EventsRepository', { eventId });
            return true;
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to update event occurrence');
        }
    }

    /**
     * Fetch single event by ID with character information
     */
    async getEventById(eventId) {
        try {
            const event = await this.dal.queryOne(
                `SELECT e.*, p.name as character_name, p.personality_description
                 FROM events e
                 LEFT JOIN personalities p ON e.character_id = p.id
                 WHERE e.id = ?`,
                [eventId]
            );
            return event;
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to get event by ID');
        }
    }

    /**
     * Update event status
     */
    async updateEventStatus(eventId, status) {
        try {
            await this.update({ status }, { id: eventId });
            this.logger.info('Event status updated', 'EventsRepository', { eventId, status });
            return true;
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to update event status');
        }
    }

    /**
     * Set is_active = 0 (soft delete)
     */
    async deactivateEvent(eventId) {
        try {
            await this.update({ is_active: 0 }, { id: eventId });
            this.logger.info('Event deactivated', 'EventsRepository', { eventId });
            return true;
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to deactivate event');
        }
    }

    /**
     * Calculate next occurrence based on recurrence_type
     */
    async calculateNextOccurrence(event) {
        try {
            if (event.recurrence_type === 'once') {
                return null;
            }

            const recurrenceData = this.parseJSON(event.recurrence_data || '{}');
            const lastOccurrence = new Date(event.last_occurrence || event.starts_at);

            if (event.recurrence_type === 'daily') {
                const time = recurrenceData.time || '00:00';
                const [hours, minutes] = time.split(':').map(Number);
                const nextDate = new Date(lastOccurrence);
                nextDate.setDate(nextDate.getDate() + 1);
                nextDate.setHours(hours, minutes, 0, 0);
                return nextDate.toISOString();
            }

            if (event.recurrence_type === 'weekly') {
                const nextDate = new Date(lastOccurrence);
                nextDate.setDate(nextDate.getDate() + 7);
                return nextDate.toISOString();
            }

            if (event.recurrence_type === 'monthly') {
                const nextDate = new Date(lastOccurrence);
                nextDate.setMonth(nextDate.getMonth() + 1);
                return nextDate.toISOString();
            }

            return null;
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to calculate next occurrence');
        }
    }
}

module.exports = EventsRepository;
