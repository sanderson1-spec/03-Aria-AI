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
        // CORS is handled by main server middleware

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
         * UPDATED: Now includes automatic verification via TaskVerificationService
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

                if (commitment.status !== 'active' && commitment.status !== 'needs_revision') {
                    return res.status(400).json({
                        success: false,
                        error: `Commitment status '${commitment.status}' cannot be submitted`
                    });
                }

                // Submit commitment to database
                const submittedCommitment = await databaseService.getDAL().commitments.submitCommitment(
                    commitmentId,
                    submissionText.trim()
                );

                if (!submittedCommitment) {
                    return res.status(500).json({
                        success: false,
                        error: 'Failed to save submission to database'
                    });
                }

                // Call TaskVerificationService for immediate verification
                let verificationResult;
                try {
                    const verificationService = this.serviceFactory.get('taskVerification');
                    verificationResult = await verificationService.verifySubmission(commitmentId, userId);
                } catch (verificationError) {
                    console.error('Verification Service Error:', verificationError);
                    
                    // If verification fails, mark as pending_verification
                    try {
                        await databaseService.getDAL().commitments.updateCommitmentStatus(
                            commitmentId,
                            'pending_verification',
                            {}
                        );
                    } catch (updateError) {
                        console.error('Failed to update status to pending_verification:', updateError);
                    }

                    // Return submission success but verification failure
                    return res.json({
                        success: true,
                        message: 'Commitment submitted successfully, but verification is pending',
                        verification: {
                            decision: 'pending',
                            feedback: 'Your submission has been saved. Verification will be completed shortly.',
                            canResubmit: false
                        },
                        data: submittedCommitment
                    });
                }

                // Return successful verification result
                res.json({
                    success: true,
                    message: 'Commitment submitted and verified',
                    verification: {
                        decision: verificationResult.verification.decision,
                        feedback: verificationResult.verification.feedback,
                        canResubmit: verificationResult.verification.decision === 'needs_revision',
                        isVerifiable: verificationResult.verification.isVerifiable,
                        timingAssessment: verificationResult.verification.timingAssessment,
                        qualityAssessment: verificationResult.verification.qualityAssessment
                    },
                    data: verificationResult.commitment,
                    character: verificationResult.character
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
         * POST /api/commitments/:commitmentId/resubmit
         * Resubmit a commitment after 'needs_revision' feedback
         * Body: { userId, submissionText }
         */
        this.router.post('/:commitmentId/resubmit', async (req, res) => {
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

                if (commitment.status !== 'needs_revision') {
                    return res.status(400).json({
                        success: false,
                        error: `Commitment must have 'needs_revision' status to resubmit. Current status: '${commitment.status}'`
                    });
                }

                // Update submission with new content and increment revision_count
                const currentRevisionCount = commitment.revision_count || 0;
                const dal = databaseService.getDAL();
                
                await dal.commitments.update(
                    {
                        submission_content: submissionText.trim(),
                        submitted_at: new Date().toISOString(),
                        status: 'submitted',
                        verification_requested_at: new Date().toISOString(),
                        revision_count: currentRevisionCount + 1,
                        updated_at: new Date().toISOString()
                    },
                    { id: commitmentId }
                );

                // Call TaskVerificationService for re-verification
                let verificationResult;
                try {
                    const verificationService = this.serviceFactory.get('taskVerification');
                    verificationResult = await verificationService.verifySubmission(commitmentId, userId);
                } catch (verificationError) {
                    console.error('Resubmit Verification Error:', verificationError);
                    
                    // Return submission success but verification failure
                    return res.json({
                        success: true,
                        message: 'Commitment resubmitted successfully, but verification is pending',
                        verification: {
                            decision: 'pending',
                            feedback: 'Your resubmission has been saved. Verification will be completed shortly.',
                            canResubmit: false
                        },
                        revisionCount: currentRevisionCount + 1
                    });
                }

                // Return successful verification result
                res.json({
                    success: true,
                    message: 'Commitment resubmitted and verified',
                    verification: {
                        decision: verificationResult.verification.decision,
                        feedback: verificationResult.verification.feedback,
                        canResubmit: verificationResult.verification.decision === 'needs_revision',
                        isVerifiable: verificationResult.verification.isVerifiable,
                        timingAssessment: verificationResult.verification.timingAssessment,
                        qualityAssessment: verificationResult.verification.qualityAssessment
                    },
                    data: verificationResult.commitment,
                    character: verificationResult.character,
                    revisionCount: verificationResult.commitment.revision_count
                });

            } catch (error) {
                console.error('Resubmit Commitment API Error:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to resubmit commitment',
                    details: error.message
                });
            }
        });

        /**
         * GET /api/commitments/:commitmentId/verification-history
         * Get verification history for a commitment
         * Query params: userId
         */
        this.router.get('/:commitmentId/verification-history', async (req, res) => {
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
                const commitment = await databaseService.getDAL().commitments.getCommitmentWithContext(
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

                // Build verification history response
                const history = {
                    commitmentId: commitment.id,
                    description: commitment.description,
                    assignedAt: commitment.assigned_at,
                    dueAt: commitment.due_at,
                    status: commitment.status,
                    revisionCount: commitment.revision_count || 0,
                    character: {
                        id: commitment.character?.id,
                        name: commitment.character?.name
                    },
                    currentSubmission: {
                        content: commitment.submission_content,
                        submittedAt: commitment.submitted_at,
                        verificationRequestedAt: commitment.verification_requested_at
                    },
                    verification: {
                        decision: commitment.verification_decision,
                        result: commitment.verification_result,
                        reasoning: commitment.verification_reasoning,
                        verifiedAt: commitment.verified_at,
                        feedback: commitment.verification_feedback
                    },
                    submissionHistory: commitment.submissionHistory || [],
                    hasRevisions: commitment.hasRevisions || false
                };

                res.json({
                    success: true,
                    data: history
                });

            } catch (error) {
                console.error('Get Verification History API Error:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to get verification history',
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

