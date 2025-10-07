const express = require('express');

/**
 * Commitment Routes
 * 
 * CLEAN ARCHITECTURE DESIGN:
 * - API Layer: Handles HTTP requests/responses for commitment management
 * - Uses CommitmentsRepository for data access
 * - Enforces user isolation for all operations
 */
class CommitmentRoutes {
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

        /**
         * GET /api/commitments/active
         * Get active commitments for a user in a chat
         * Query params: userId, chatId
         */
        this.router.get('/active', async (req, res) => {
            try {
                const { userId, chatId } = req.query;

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
                
                // Get active commitments (user isolation enforced by repository)
                const commitments = await databaseService.getDAL().commitments.getActiveCommitments(
                    userId,
                    chatId
                );

                res.json({
                    success: true,
                    data: commitments
                });

            } catch (error) {
                console.error('Get Active Commitments API Error:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to get active commitments',
                    details: error.message
                });
            }
        });

        /**
         * POST /api/commitments/:commitmentId/submit
         * Submit a commitment for verification
         * Body: { userId, submissionText }
         */
        this.router.post('/:commitmentId/submit', async (req, res) => {
            try {
                const { commitmentId } = req.params;
                const { userId, submissionText } = req.body;

                if (!userId) {
                    return res.status(400).json({
                        success: false,
                        error: 'Missing required field: userId'
                    });
                }

                if (!submissionText || !submissionText.trim()) {
                    return res.status(400).json({
                        success: false,
                        error: 'Missing required field: submissionText'
                    });
                }

                const databaseService = this.serviceFactory.get('database');
                
                // Verify commitment belongs to user (user isolation)
                const commitment = await databaseService.getDAL().commitments.findById(
                    commitmentId
                );

                if (!commitment) {
                    return res.status(404).json({
                        success: false,
                        error: 'Commitment not found'
                    });
                }

                if (commitment.user_id !== userId) {
                    return res.status(403).json({
                        success: false,
                        error: 'Access denied: This commitment does not belong to you'
                    });
                }

                if (commitment.status !== 'active') {
                    return res.status(400).json({
                        success: false,
                        error: 'Commitment is not active and cannot be submitted'
                    });
                }

                // Submit commitment
                const result = await databaseService.getDAL().commitments.submitCommitment(
                    commitmentId,
                    submissionText.trim()
                );

                res.json({
                    success: true,
                    data: result,
                    message: 'Commitment submitted successfully'
                });

            } catch (error) {
                console.error('Submit Commitment API Error:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to submit commitment',
                    details: error.message
                });
            }
        });

        /**
         * POST /api/commitments/verify/:commitmentId
         * Verify a submitted commitment (character action)
         * Body: { userId, verificationResult, reasoning }
         */
        this.router.post('/verify/:commitmentId', async (req, res) => {
            try {
                const { commitmentId } = req.params;
                const { userId, verificationResult, reasoning } = req.body;

                if (!userId) {
                    return res.status(400).json({
                        success: false,
                        error: 'Missing required field: userId'
                    });
                }

                if (!verificationResult) {
                    return res.status(400).json({
                        success: false,
                        error: 'Missing required field: verificationResult (true/false)'
                    });
                }

                const databaseService = this.serviceFactory.get('database');
                
                // Verify commitment belongs to user (user isolation)
                const commitment = await databaseService.getDAL().commitments.findById(
                    commitmentId
                );

                if (!commitment) {
                    return res.status(404).json({
                        success: false,
                        error: 'Commitment not found'
                    });
                }

                if (commitment.user_id !== userId) {
                    return res.status(403).json({
                        success: false,
                        error: 'Access denied: This commitment does not belong to you'
                    });
                }

                if (commitment.status !== 'submitted') {
                    return res.status(400).json({
                        success: false,
                        error: 'Commitment must be submitted before verification'
                    });
                }

                // Verify commitment
                const result = await databaseService.getDAL().commitments.verifyCommitment(
                    commitmentId,
                    verificationResult === true || verificationResult === 'true',
                    reasoning || ''
                );

                res.json({
                    success: true,
                    data: result,
                    message: 'Commitment verified successfully'
                });

            } catch (error) {
                console.error('Verify Commitment API Error:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to verify commitment',
                    details: error.message
                });
            }
        });

        /**
         * DELETE /api/commitments/:commitmentId
         * Delete a commitment (user must own it)
         * Query params: userId
         */
        this.router.delete('/:commitmentId', async (req, res) => {
            try {
                const { commitmentId } = req.params;
                const { userId } = req.query;

                if (!userId) {
                    return res.status(400).json({
                        success: false,
                        error: 'Missing required parameter: userId'
                    });
                }

                const databaseService = this.serviceFactory.get('database');
                
                // Verify commitment belongs to user (user isolation)
                const commitment = await databaseService.getDAL().commitments.findById(
                    commitmentId
                );

                if (!commitment) {
                    return res.status(404).json({
                        success: false,
                        error: 'Commitment not found'
                    });
                }

                if (commitment.user_id !== userId) {
                    return res.status(403).json({
                        success: false,
                        error: 'Access denied: This commitment does not belong to you'
                    });
                }

                // Delete commitment
                const result = await databaseService.getDAL().commitments.delete(
                    commitmentId
                );

                res.json({
                    success: true,
                    data: result,
                    message: 'Commitment deleted successfully'
                });

            } catch (error) {
                console.error('Delete Commitment API Error:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to delete commitment',
                    details: error.message
                });
            }
        });

        /**
         * GET /api/commitments/history
         * Get commitment history for a user
         * Query params: userId, chatId (optional), limit (optional)
         */
        this.router.get('/history', async (req, res) => {
            try {
                const { userId, chatId, limit } = req.query;

                if (!userId) {
                    return res.status(400).json({
                        success: false,
                        error: 'Missing required parameter: userId'
                    });
                }

                const databaseService = this.serviceFactory.get('database');
                
                // Get commitment history (user isolation enforced by repository)
                const commitments = await databaseService.getDAL().commitments.getUserCommitments(
                    userId,
                    chatId || null,
                    parseInt(limit) || 50
                );

                res.json({
                    success: true,
                    data: commitments
                });

            } catch (error) {
                console.error('Get Commitment History API Error:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to get commitment history',
                    details: error.message
                });
            }
        });
    }

    getRouter() {
        return this.router;
    }
}

module.exports = CommitmentRoutes;

