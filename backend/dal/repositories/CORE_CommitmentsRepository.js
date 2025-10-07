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
     */
    async submitCommitment(commitmentId, submissionContent) {
        try {
            const now = this.getCurrentTimestamp();
            
            const updates = {
                submission_content: submissionContent,
                submitted_at: now,
                status: 'submitted',
                updated_at: now
            };

            const result = await this.update(updates, { id: commitmentId });
            return { submitted: result.changes > 0 };
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to submit commitment', { commitmentId, submissionContent });
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
}

module.exports = CommitmentsRepository;

