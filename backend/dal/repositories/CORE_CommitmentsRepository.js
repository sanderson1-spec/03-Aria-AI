const BaseRepository = require('../CORE_BaseRepository');

/**
 * CommitmentsRepository - Handles commitment tracking and verification
 * CLEAN ARCHITECTURE: Infrastructure layer commitment management
 */
class CommitmentsRepository extends BaseRepository {
    constructor(tableName, dependencies) {
        super(tableName, dependencies);
    }

    /**
     * Get active commitments for a specific chat (MULTI-USER SUPPORT)
     * CLEAN ARCHITECTURE: Domain layer entity retrieval with user isolation
     */
    async getActiveCommitments(userId, chatId) {
        try {
            const sql = `
                SELECT *
                FROM ${this.tableName}
                WHERE user_id = ? AND chat_id = ? AND status = 'active'
                ORDER BY due_at ASC, created_at DESC
            `;
            
            return await this.dal.query(sql, [userId, chatId]);
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to get active commitments', { userId, chatId });
        }
    }

    /**
     * Get commitment by ID
     * CLEAN ARCHITECTURE: Domain layer entity retrieval
     */
    async getCommitmentById(commitmentId) {
        try {
            return await this.findById(commitmentId);
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to get commitment by ID', { commitmentId });
        }
    }

    /**
     * Create a new commitment (MULTI-USER SUPPORT)
     * CLEAN ARCHITECTURE: Domain layer entity creation
     */
    async createCommitment(commitmentData) {
        try {
            const commitmentId = commitmentData.id || require('uuid').v4();
            const now = this.getCurrentTimestamp();
            
            const commitment = {
                id: commitmentId,
                user_id: commitmentData.user_id,
                chat_id: commitmentData.chat_id,
                character_id: commitmentData.character_id,
                commitment_type: commitmentData.commitment_type,
                description: commitmentData.description,
                context: commitmentData.context || null,
                character_notes: commitmentData.character_notes || null,
                assigned_at: now,
                due_at: commitmentData.due_at || null,
                status: commitmentData.status || 'active',
                submission_content: null,
                submitted_at: null,
                verification_result: null,
                verification_reasoning: null,
                verified_at: null,
                created_at: now,
                updated_at: now
            };

            await this.create(commitment);
            return await this.findById(commitmentId);
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to create commitment', { commitmentData });
        }
    }

    /**
     * Update commitment status (MULTI-USER SUPPORT)
     * CLEAN ARCHITECTURE: Domain layer entity update
     */
    async updateCommitmentStatus(commitmentId, status, updateData = {}) {
        try {
            const now = this.getCurrentTimestamp();
            
            const updates = {
                status: status,
                updated_at: now
            };

            // Merge additional update data
            if (updateData.verification_result) {
                updates.verification_result = updateData.verification_result;
            }
            if (updateData.verification_reasoning) {
                updates.verification_reasoning = updateData.verification_reasoning;
            }

            const result = await this.update(updates, { id: commitmentId });
            return { updated: result.changes > 0 };
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to update commitment status', { commitmentId, status, updateData });
        }
    }

    /**
     * Get commitments due soon (MULTI-USER SUPPORT)
     * CLEAN ARCHITECTURE: Domain layer query with time-based filtering
     */
    async getCommitmentsDueSoon(userId, hoursAhead = 24) {
        try {
            const sql = `
                SELECT *
                FROM ${this.tableName}
                WHERE user_id = ? 
                AND status = 'active'
                AND due_at IS NOT NULL
                AND datetime(due_at) <= datetime('now', '+' || ? || ' hours')
                AND datetime(due_at) >= datetime('now')
                ORDER BY due_at ASC
            `;
            
            return await this.dal.query(sql, [userId, hoursAhead]);
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to get commitments due soon', { userId, hoursAhead });
        }
    }

    /**
     * Submit commitment evidence/completion (MULTI-USER SUPPORT)
     * CLEAN ARCHITECTURE: Domain layer entity update with submission tracking
     * Updates submission_content, submitted_at, status, and verification_requested_at
     */
    async submitCommitment(commitmentId, submissionContent) {
        try {
            this.logger.debug('Submitting commitment', { commitmentId, hasContent: !!submissionContent });
            
            const now = this.getCurrentTimestamp();
            
            const updates = {
                submission_content: submissionContent,
                submitted_at: now,
                status: 'submitted',
                verification_requested_at: now,
                updated_at: now
            };

            const result = await this.update(updates, { id: commitmentId });
            
            if (result.changes > 0) {
                this.logger.info('Commitment submitted successfully', { commitmentId });
                return await this.findById(commitmentId);
            } else {
                this.logger.warn('Commitment submission failed - no changes made', { commitmentId });
                return null;
            }
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to submit commitment', { commitmentId });
        }
    }

    /**
     * Verify commitment completion (MULTI-USER SUPPORT)
     * CLEAN ARCHITECTURE: Domain layer entity update with verification tracking
     */
    async verifyCommitment(commitmentId, verificationResult, reasoning) {
        try {
            const now = this.getCurrentTimestamp();
            
            const updates = {
                verification_result: verificationResult,
                verification_reasoning: reasoning,
                verified_at: now,
                status: verificationResult === 'verified' ? 'completed' : 'rejected',
                updated_at: now
            };

            const result = await this.update(updates, { id: commitmentId });
            return { verified: result.changes > 0 };
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to verify commitment', { commitmentId, verificationResult, reasoning });
        }
    }

    /**
     * Record verification decision with workflow handling (MULTI-USER SUPPORT)
     * CLEAN ARCHITECTURE: Domain layer entity update with decision-based status transitions
     * 
     * @param {string} commitmentId - Commitment to verify
     * @param {Object} verificationData - Verification details
     * @param {string} verificationData.verification_decision - Decision: 'approved', 'needs_revision', 'rejected', 'not_verifiable'
     * @param {string} verificationData.verification_result - Character's feedback text
     * @param {string} verificationData.verification_reasoning - LLM's reasoning
     * @param {string} verificationData.verified_at - Verification timestamp
     * @returns {Promise<Object>} Updated commitment
     */
    async recordVerification(commitmentId, verificationData) {
        try {
            this.logger.debug('Recording verification decision', { 
                commitmentId, 
                decision: verificationData.verification_decision 
            });
            
            const now = this.getCurrentTimestamp();
            
            // Determine status based on verification decision
            let newStatus;
            switch (verificationData.verification_decision) {
                case 'approved':
                    newStatus = 'completed';
                    break;
                case 'needs_revision':
                    newStatus = 'needs_revision';
                    break;
                case 'rejected':
                    newStatus = 'rejected';
                    break;
                case 'not_verifiable':
                    newStatus = 'not_verifiable';
                    break;
                default:
                    throw new Error(`Invalid verification_decision: ${verificationData.verification_decision}`);
            }

            const updates = {
                verification_decision: verificationData.verification_decision,
                verification_result: verificationData.verification_result,
                verification_reasoning: verificationData.verification_reasoning,
                verified_at: verificationData.verified_at || now,
                status: newStatus,
                updated_at: now
            };

            // Increment revision_count if needs_revision
            if (verificationData.verification_decision === 'needs_revision') {
                // First, get current commitment to read revision_count
                const currentCommitment = await this.findById(commitmentId);
                if (currentCommitment) {
                    updates.revision_count = (currentCommitment.revision_count || 0) + 1;
                    this.logger.debug('Incrementing revision count', { 
                        commitmentId, 
                        newCount: updates.revision_count 
                    });
                }
            }

            const result = await this.update(updates, { id: commitmentId });
            
            if (result.changes > 0) {
                this.logger.info('Verification recorded successfully', { 
                    commitmentId, 
                    decision: verificationData.verification_decision,
                    newStatus 
                });
                return await this.findById(commitmentId);
            } else {
                this.logger.warn('Verification recording failed - no changes made', { commitmentId });
                return null;
            }
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to record verification', { 
                commitmentId, 
                decision: verificationData.verification_decision 
            });
        }
    }

    /**
     * Get commitment with enriched context (MULTI-USER SUPPORT)
     * CLEAN ARCHITECTURE: Domain layer entity retrieval with relationship data
     * 
     * Fetches commitment with:
     * - Character information (personality details)
     * - Assignment message from conversation logs
     * - Submission history if revision_count > 0
     * 
     * @param {string} commitmentId - Commitment ID to fetch
     * @returns {Promise<Object>} Enriched commitment object with context
     */
    async getCommitmentWithContext(commitmentId) {
        try {
            this.logger.debug('Fetching commitment with context', { commitmentId });
            
            // Fetch base commitment
            const commitment = await this.findById(commitmentId);
            
            if (!commitment) {
                this.logger.warn('Commitment not found', { commitmentId });
                return null;
            }

            // Fetch character information
            const characterSql = `
                SELECT id, name, display, description, definition, personality_traits, communication_style
                FROM personalities
                WHERE id = ?
            `;
            const characters = await this.dal.query(characterSql, [commitment.character_id]);
            const character = characters.length > 0 ? characters[0] : null;

            // Fetch assignment message from conversation logs
            // Look for messages around the assigned_at timestamp that mention assignment/commitment
            const assignmentMessageSql = `
                SELECT id, role, content, timestamp, metadata
                FROM conversation_logs
                WHERE chat_id = ?
                AND user_id = ?
                AND datetime(timestamp) <= datetime(?)
                ORDER BY datetime(timestamp) DESC
                LIMIT 5
            `;
            const assignmentMessages = await this.dal.query(assignmentMessageSql, [
                commitment.chat_id,
                commitment.user_id,
                commitment.assigned_at
            ]);

            // Fetch submission history if revisions exist
            let submissionHistory = null;
            if (commitment.revision_count > 0) {
                this.logger.debug('Fetching submission history', { 
                    commitmentId, 
                    revisionCount: commitment.revision_count 
                });
                
                // Get related conversation messages that might contain previous submissions
                const historySql = `
                    SELECT id, role, content, timestamp, metadata
                    FROM conversation_logs
                    WHERE chat_id = ?
                    AND user_id = ?
                    AND datetime(timestamp) >= datetime(?)
                    AND datetime(timestamp) <= datetime(?)
                    ORDER BY datetime(timestamp) ASC
                `;
                submissionHistory = await this.dal.query(historySql, [
                    commitment.chat_id,
                    commitment.user_id,
                    commitment.assigned_at,
                    commitment.updated_at
                ]);
            }

            // Build enriched commitment object
            const enrichedCommitment = {
                ...commitment,
                character: character,
                assignmentContext: {
                    messages: assignmentMessages,
                    assignedAt: commitment.assigned_at
                },
                submissionHistory: submissionHistory || [],
                hasRevisions: commitment.revision_count > 0
            };

            this.logger.info('Commitment with context retrieved successfully', { 
                commitmentId, 
                hasCharacter: !!character,
                messageCount: assignmentMessages.length,
                revisionCount: commitment.revision_count 
            });

            return enrichedCommitment;
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to get commitment with context', { commitmentId });
        }
    }
}

module.exports = CommitmentsRepository;

