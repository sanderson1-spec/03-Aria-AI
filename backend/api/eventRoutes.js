const express = require('express');

/**
 * Event Routes
 * 
 * CLEAN ARCHITECTURE DESIGN:
 * - API Layer: Handles HTTP requests/responses for event management
 * - Uses EventsRepository for data access
 * - Enforces user isolation for all operations
 */
class EventRoutes {
    constructor(serviceFactory) {
        this.router = express.Router();
        this.serviceFactory = serviceFactory;
        this.setupRoutes();
    }

    setupRoutes() {
        // CORS is handled by main server middleware

        /**
         * GET /api/events/upcoming
         * Get upcoming events for a user in a chat
         * Query params: userId, chatId, limit (optional)
         */
        this.router.get('/upcoming', async (req, res) => {
            try {
                const { userId, chatId, limit } = req.query;

                if (!userId) {
                    return res.status(400).json({
                        success: false,
                        error: 'Missing required parameter: userId'
                    });
                }

                if (!chatId) {
                    return res.status(400).json({
                        success: false,
                        error: 'Missing required parameter: chatId'
                    });
                }

                const databaseService = this.serviceFactory.get('database');
                
                // Get upcoming events (user isolation enforced by repository)
                const events = await databaseService.getDAL().events.getUpcomingEvents(
                    userId,
                    chatId,
                    parseInt(limit) || 10
                );

                res.json({
                    success: true,
                    data: events
                });

            } catch (error) {
                console.error('Get Upcoming Events API Error:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to get upcoming events',
                    details: error.message
                });
            }
        });

        /**
         * GET /api/events/:eventId
         * Get event details by ID
         * Query params: userId
         */
        this.router.get('/:eventId', async (req, res) => {
            try {
                const { eventId } = req.params;
                const { userId } = req.query;

                if (!userId) {
                    return res.status(400).json({
                        success: false,
                        error: 'Missing required parameter: userId'
                    });
                }

                const databaseService = this.serviceFactory.get('database');
                
                // Get event details
                const event = await databaseService.getDAL().events.getEventById(eventId);

                if (!event) {
                    return res.status(404).json({
                        success: false,
                        error: 'Event not found'
                    });
                }

                // Verify event belongs to user (user isolation)
                if (event.user_id !== userId) {
                    return res.status(403).json({
                        success: false,
                        error: 'Access denied: This event does not belong to you'
                    });
                }

                res.json({
                    success: true,
                    data: event
                });

            } catch (error) {
                console.error('Get Event API Error:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to get event',
                    details: error.message
                });
            }
        });

        /**
         * PUT /api/events/:eventId/status
         * Update event status
         * Body: { userId, status }
         */
        this.router.put('/:eventId/status', async (req, res) => {
            try {
                const { eventId } = req.params;
                const { userId, status } = req.body;

                if (!userId) {
                    return res.status(400).json({
                        success: false,
                        error: 'Missing required field: userId'
                    });
                }

                if (!status) {
                    return res.status(400).json({
                        success: false,
                        error: 'Missing required field: status'
                    });
                }

                // Validate status value
                const validStatuses = ['scheduled', 'completed', 'missed', 'cancelled'];
                if (!validStatuses.includes(status)) {
                    return res.status(400).json({
                        success: false,
                        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
                    });
                }

                const databaseService = this.serviceFactory.get('database');
                
                // Verify event belongs to user (user isolation)
                const event = await databaseService.getDAL().events.getEventById(eventId);

                if (!event) {
                    return res.status(404).json({
                        success: false,
                        error: 'Event not found'
                    });
                }

                if (event.user_id !== userId) {
                    return res.status(403).json({
                        success: false,
                        error: 'Access denied: This event does not belong to you'
                    });
                }

                // Update event status
                await databaseService.getDAL().events.updateEventStatus(eventId, status);

                res.json({
                    success: true,
                    message: 'Event status updated successfully'
                });

            } catch (error) {
                console.error('Update Event Status API Error:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to update event status',
                    details: error.message
                });
            }
        });

        /**
         * DELETE /api/events/:eventId
         * Deactivate an event (soft delete)
         * Query params: userId
         */
        this.router.delete('/:eventId', async (req, res) => {
            try {
                const { eventId } = req.params;
                const { userId } = req.query;

                if (!userId) {
                    return res.status(400).json({
                        success: false,
                        error: 'Missing required parameter: userId'
                    });
                }

                const databaseService = this.serviceFactory.get('database');
                
                // Verify event belongs to user (user isolation)
                const event = await databaseService.getDAL().events.getEventById(eventId);

                if (!event) {
                    return res.status(404).json({
                        success: false,
                        error: 'Event not found'
                    });
                }

                if (event.user_id !== userId) {
                    return res.status(403).json({
                        success: false,
                        error: 'Access denied: This event does not belong to you'
                    });
                }

                // Deactivate event (soft delete)
                await databaseService.getDAL().events.deactivateEvent(eventId);

                res.json({
                    success: true,
                    message: 'Event deactivated successfully'
                });

            } catch (error) {
                console.error('Delete Event API Error:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to deactivate event',
                    details: error.message
                });
            }
        });

        /**
         * POST /api/events/:eventId/reschedule
         * Reschedule an event (update next_occurrence)
         * Body: { userId, new_time }
         */
        this.router.post('/:eventId/reschedule', async (req, res) => {
            try {
                const { eventId } = req.params;
                const { userId, new_time } = req.body;

                if (!userId) {
                    return res.status(400).json({
                        success: false,
                        error: 'Missing required field: userId'
                    });
                }

                if (!new_time) {
                    return res.status(400).json({
                        success: false,
                        error: 'Missing required field: new_time'
                    });
                }

                // Validate new_time is a valid ISO timestamp
                const newTime = new Date(new_time);
                if (isNaN(newTime.getTime())) {
                    return res.status(400).json({
                        success: false,
                        error: 'Invalid new_time format. Must be a valid ISO timestamp'
                    });
                }

                const databaseService = this.serviceFactory.get('database');
                
                // Verify event belongs to user (user isolation)
                const event = await databaseService.getDAL().events.getEventById(eventId);

                if (!event) {
                    return res.status(404).json({
                        success: false,
                        error: 'Event not found'
                    });
                }

                if (event.user_id !== userId) {
                    return res.status(403).json({
                        success: false,
                        error: 'Access denied: This event does not belong to you'
                    });
                }

                // Update next_occurrence
                await databaseService.getDAL().events.updateEventOccurrence(
                    eventId,
                    event.last_occurrence || new Date().toISOString(),
                    newTime.toISOString()
                );

                res.json({
                    success: true,
                    message: 'Event rescheduled successfully',
                    data: {
                        next_occurrence: newTime.toISOString()
                    }
                });

            } catch (error) {
                console.error('Reschedule Event API Error:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to reschedule event',
                    details: error.message
                });
            }
        });
    }

    getRouter() {
        return this.router;
    }
}

module.exports = EventRoutes;
