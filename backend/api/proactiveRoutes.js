const express = require('express');
const { v4: uuidv4 } = require('uuid');

/**
 * Proactive Messaging Routes
 * Handles proactive message scheduling, retrieval, and management
 * Follows clean architecture patterns with service factory injection
 */
class ProactiveRoutes {
    constructor(serviceFactory) {
        this.router = express.Router();
        this.serviceFactory = serviceFactory;
        this.setupRoutes();
    }

    setupRoutes() {
        // Enable CORS for frontend
        this.router.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', 'http://localhost:5173');
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
            if (req.method === 'OPTIONS') {
                res.sendStatus(200);
            } else {
                next();
            }
        });

        // POST /schedule - Schedule a proactive message
        this.router.post('/schedule', async (req, res) => {
            try {
                const { userId, chatId, characterId, message, scheduledFor } = req.body;

                // Validate required fields
                if (!userId) {
                    return res.status(400).json({ 
                        success: false, 
                        error: 'userId is required' 
                    });
                }

                if (!chatId) {
                    return res.status(400).json({ 
                        success: false, 
                        error: 'chatId is required' 
                    });
                }

                if (!characterId) {
                    return res.status(400).json({ 
                        success: false, 
                        error: 'characterId is required' 
                    });
                }

                if (!message || !message.trim()) {
                    return res.status(400).json({ 
                        success: false, 
                        error: 'message is required' 
                    });
                }

                if (!scheduledFor) {
                    return res.status(400).json({ 
                        success: false, 
                        error: 'scheduledFor is required' 
                    });
                }

                // Get services
                const databaseService = this.serviceFactory.get('database');
                const dal = databaseService.getDAL();

                // Create engagement record
                const engagementId = uuidv4();
                const sql = `
                    INSERT INTO proactive_engagements (
                        id, user_id, session_id, personality_id, engagement_type,
                        trigger_context, engagement_content, optimal_timing, status, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `;

                await dal.execute(sql, [
                    engagementId,
                    userId,
                    chatId,
                    characterId,
                    'scheduled',
                    'api_scheduled',
                    message,
                    scheduledFor,
                    'pending',
                    new Date().toISOString()
                ]);

                res.json({ 
                    success: true, 
                    engagementId 
                });

            } catch (error) {
                res.status(500).json({ 
                    success: false, 
                    error: 'Failed to schedule proactive message',
                    details: error.message 
                });
            }
        });

        // GET /pending - Get pending proactive messages for a user
        this.router.get('/pending', async (req, res) => {
            try {
                const { userId } = req.query;

                // Validate required fields
                if (!userId) {
                    return res.status(400).json({ 
                        success: false, 
                        error: 'userId is required' 
                    });
                }

                // Get services
                const databaseService = this.serviceFactory.get('database');
                const dal = databaseService.getDAL();

                // Get pending engagements for user
                const sql = `
                    SELECT * FROM proactive_engagements
                    WHERE user_id = ? AND status = 'pending'
                    ORDER BY optimal_timing ASC
                `;

                const pendingMessages = await dal.query(sql, [userId]);

                res.json({ 
                    success: true, 
                    data: pendingMessages || [] 
                });

            } catch (error) {
                res.status(500).json({ 
                    success: false, 
                    error: 'Failed to retrieve pending messages',
                    details: error.message 
                });
            }
        });

        // DELETE /:engagementId - Cancel a scheduled proactive message
        this.router.delete('/:engagementId', async (req, res) => {
            try {
                const { engagementId } = req.params;

                if (!engagementId) {
                    return res.status(400).json({ 
                        success: false, 
                        error: 'engagementId is required' 
                    });
                }

                // Get services
                const databaseService = this.serviceFactory.get('database');
                const dal = databaseService.getDAL();

                // Get engagement to verify it exists
                const checkSql = `SELECT id FROM proactive_engagements WHERE id = ?`;
                const engagement = await dal.queryOne(checkSql, [engagementId]);
                
                if (!engagement) {
                    return res.status(404).json({ 
                        success: false, 
                        error: 'Engagement not found' 
                    });
                }

                // Update status to cancelled
                const updateSql = `
                    UPDATE proactive_engagements 
                    SET status = 'cancelled', updated_at = ?
                    WHERE id = ?
                `;
                
                await dal.execute(updateSql, [new Date().toISOString(), engagementId]);

                res.json({ 
                    success: true 
                });

            } catch (error) {
                res.status(500).json({ 
                    success: false, 
                    error: 'Failed to cancel proactive message',
                    details: error.message 
                });
            }
        });

        // GET /history - Get proactive message history for a user
        this.router.get('/history', async (req, res) => {
            try {
                const { userId, limit = 50 } = req.query;

                // Validate required fields
                if (!userId) {
                    return res.status(400).json({ 
                        success: false, 
                        error: 'userId is required' 
                    });
                }

                // Validate limit
                const parsedLimit = parseInt(limit, 10);
                if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 1000) {
                    return res.status(400).json({ 
                        success: false, 
                        error: 'limit must be between 1 and 1000' 
                    });
                }

                // Get services
                const databaseService = this.serviceFactory.get('database');
                const dal = databaseService.getDAL();

                // Get engagement history for user
                const sql = `
                    SELECT * FROM proactive_engagements
                    WHERE user_id = ?
                    ORDER BY created_at DESC
                    LIMIT ?
                `;

                const history = await dal.query(sql, [userId, parsedLimit]);

                res.json({ 
                    success: true, 
                    data: history || [] 
                });

            } catch (error) {
                res.status(500).json({ 
                    success: false, 
                    error: 'Failed to retrieve message history',
                    details: error.message 
                });
            }
        });
    }

    getRouter() {
        return this.router;
    }
}

module.exports = ProactiveRoutes;

