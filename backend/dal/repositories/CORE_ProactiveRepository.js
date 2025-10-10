/**
 * CLEAN ARCHITECTURE: Infrastructure Layer Repository
 * ProactiveRepository - Database operations for proactive messaging and learning
 * 
 * FOLLOWS YOUR EXISTING REPOSITORY PATTERNS:
 * - Extends BaseRepository
 * - Uses proper SQL with parameter binding
 * - Handles user data isolation
 * - Includes comprehensive error handling
 */

const BaseRepository = require('../CORE_BaseRepository');

class ProactiveRepository extends BaseRepository {
    constructor(database, logger) {
        super(database, logger, 'ProactiveRepository');
    }

    /**
     * DOMAIN: Record a proactive engagement attempt for learning
     */
    async recordEngagementAttempt(engagementData) {
        const {
            chatId,
            personalityId,
            triggerType,
            psychologicalContext,
            decisionReasoning,
            proactiveContent,
            engagementTiming
        } = engagementData;

        // Get user_id from chat (chatId is actually chatId)
        const chat = await this.dal.queryOne('SELECT user_id FROM chats WHERE id = ?', [chatId]);
        
        if (!chat) {
            throw this.errorHandler.wrapRepositoryError(
                new Error('Chat not found'),
                'Cannot record engagement attempt for non-existent chat',
                { chatId }
            );
        }

        // Generate UUID for engagement
        const engagementId = `proactive-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        const sql = `
            INSERT INTO proactive_engagements (
                id, user_id, session_id, personality_id, engagement_type, 
                trigger_context, engagement_content, engagement_metadata,
                optimal_timing, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
        `;

        const metadata = {
            psychological_context: psychologicalContext,
            decision_reasoning: decisionReasoning,
            engagement_timing_seconds: engagementTiming
        };

        const params = [
            engagementId,
            chat.user_id,
            chatId,
            personalityId,
            triggerType || 'intelligence_driven',
            decisionReasoning || 'Proactive engagement opportunity identified',
            proactiveContent,
            JSON.stringify(metadata),
            engagementTiming ? new Date(Date.now() + (engagementTiming * 1000)).toISOString() : null
        ];

        try {
            await this.dal.execute(sql, params);
            this.logger.info('Recorded proactive engagement attempt', 'ProactiveRepository', {
                engagementId,
                chatId,
                personalityId
            });
            return engagementId;
        } catch (error) {
            this.logger.error('Failed to record proactive engagement attempt', 'ProactiveRepository', {
                error: error.message,
                chatId,
                personalityId
            });
            throw error;
        }
    }

    /**
     * DOMAIN: Update engagement result after user response
     */
    async updateEngagementResult(engagementId, userResponse, responseTime, sentiment, successScore) {
        const sql = `
            UPDATE proactive_engagements 
            SET user_response_type = ?, engagement_success_score = ?, 
                status = 'responded', updated_at = datetime('now')
            WHERE id = ?
        `;

        const params = [sentiment, successScore, engagementId];

        try {
            await this.dal.execute(sql, params);
            this.logger.info('Updated engagement result', 'ProactiveRepository', {
                engagementId,
                successScore,
                sentiment
            });
        } catch (error) {
            this.logger.error('Failed to update engagement result', 'ProactiveRepository', {
                error: error.message,
                engagementId
            });
            throw error;
        }
    }

    /**
     * DOMAIN: Get engagements for pattern learning
     */
    async getEngagementsForLearning(limit = 50) {
        const sql = `
            SELECT id, user_id, session_id, personality_id, engagement_type,
                   trigger_context, engagement_content, engagement_metadata,
                   user_response_type, engagement_success_score,
                   status, created_at, updated_at
            FROM proactive_engagements 
            WHERE engagement_success_score IS NOT NULL
            ORDER BY created_at DESC 
            LIMIT ?
        `;

        try {
            const engagements = await this.dal.query(sql, [limit]);
            
            // Parse JSON fields and map to expected format
            return engagements.map(engagement => {
                const metadata = this.parseJsonField(engagement.engagement_metadata) || {};
                return {
                    ...engagement,
                    // Map schema fields to expected fields
                    trigger_type: engagement.engagement_type,
                    decision_reasoning: engagement.trigger_context,
                    proactive_content: engagement.engagement_content,
                    psychological_context: metadata.psychological_context,
                    engagement_timing: metadata.engagement_timing_seconds,
                    sentiment: engagement.user_response_type,
                    success_score: engagement.engagement_success_score,
                    learning_extracted: 0 // Default since schema doesn't have this field
                };
            });
        } catch (error) {
            this.logger.error('Failed to get engagements for learning', 'ProactiveRepository', {
                error: error.message,
                limit
            });
            throw error;
        }
    }

    /**
     * DOMAIN: Mark learning patterns as extracted from engagement
     */
    async markLearningExtracted(engagementId) {
        // Since the schema doesn't have learning_extracted field, we'll just log this
        // In a real implementation, you might add a metadata field or status update
        try {
            this.logger.info('Marked learning as extracted (no-op for current schema)', 'ProactiveRepository', {
                engagementId
            });
        } catch (error) {
            this.logger.error('Failed to mark learning as extracted', 'ProactiveRepository', {
                error: error.message,
                engagementId
            });
            throw error;
        }
    }

    /**
     * DOMAIN: Update timing optimization data
     */
    async updateTimingOptimization(optimizationData) {
        const {
            personalityId,
            contextType,
            optimalDelaySeconds,
            confidenceLevel,
            sampleSize,
            successRate
        } = optimizationData;

        // Get personality creator as user_id (timing optimizations are per-personality, not per-user)
        const personality = await this.dal.queryOne('SELECT user_id FROM personalities WHERE id = ?', [personalityId]);
        
        if (!personality) {
            throw this.errorHandler.wrapRepositoryError(
                new Error('Personality not found'),
                'Cannot update timing optimization for non-existent personality',
                { personalityId }
            );
        }

        // Generate UUID for optimization record
        const optimizationId = `timing-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const sql = `
            INSERT OR REPLACE INTO proactive_timing_optimizations (
                id, user_id, personality_id, context_type, optimal_delay_seconds,
                confidence_level, sample_size, success_rate
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const params = [
            optimizationId,
            personality.user_id,
            personalityId,
            contextType,
            optimalDelaySeconds,
            confidenceLevel,
            sampleSize,
            successRate
        ];

        try {
            await this.dal.execute(sql, params);
            this.logger.info('Updated timing optimization', 'ProactiveRepository', {
                personalityId,
                contextType,
                optimalDelaySeconds
            });
        } catch (error) {
            this.logger.error('Failed to update timing optimization', 'ProactiveRepository', {
                error: error.message,
                personalityId,
                contextType
            });
            throw error;
        }
    }

    /**
     * DOMAIN: Store learning pattern
     */
    async storeLearningPattern(patternData) {
        const {
            personalityId,
            patternType,
            patternContext,
            patternData: data,
            confidenceScore
        } = patternData;

        // Get personality creator as user_id (learning patterns are per-personality, not per-user)
        const personality = await this.dal.queryOne('SELECT user_id FROM personalities WHERE id = ?', [personalityId]);
        
        if (!personality) {
            throw this.errorHandler.wrapRepositoryError(
                new Error('Personality not found'),
                'Cannot store learning pattern for non-existent personality',
                { personalityId }
            );
        }

        // Generate UUID for pattern
        const patternId = `pattern-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const sql = `
            INSERT INTO proactive_learning_patterns (
                id, user_id, personality_id, pattern_type, pattern_data,
                confidence_score
            ) VALUES (?, ?, ?, ?, ?, ?)
        `;

        const params = [
            patternId,
            personality.user_id,
            personalityId,
            patternType,
            typeof data === 'object' ? JSON.stringify(data) : data,
            confidenceScore
        ];

        try {
            await this.dal.execute(sql, params);
            this.logger.info('Stored learning pattern', 'ProactiveRepository', {
                patternId,
                personalityId,
                patternType,
                confidenceScore
            });
            return patternId;
        } catch (error) {
            this.logger.error('Failed to store learning pattern', 'ProactiveRepository', {
                error: error.message,
                personalityId,
                patternType
            });
            throw error;
        }
    }

    /**
     * DOMAIN: Get applicable patterns for decision making
     */
    async getApplicablePatterns(personalityId, contextType = null, options = {}) {
        const { confidenceThreshold = 0.6, limit = 5 } = options;

        let sql = `
            SELECT id, personality_id, pattern_type, pattern_context, pattern_data,
                   confidence_score, created_at
            FROM proactive_learning_patterns 
            WHERE personality_id = ? AND confidence_score >= ?
        `;

        const params = [personalityId, confidenceThreshold];

        if (contextType) {
            sql += ` AND pattern_context LIKE ?`;
            params.push(`%${contextType}%`);
        }

        sql += ` ORDER BY confidence_score DESC, created_at DESC LIMIT ?`;
        params.push(limit);

        try {
            const patterns = await this.dal.query(sql, params);
            
            // Parse JSON fields
            return patterns.map(pattern => ({
                ...pattern,
                pattern_context: this.parseJsonField(pattern.pattern_context),
                pattern_data: this.parseJsonField(pattern.pattern_data)
            }));
        } catch (error) {
            this.logger.error('Failed to get applicable patterns', 'ProactiveRepository', {
                error: error.message,
                personalityId,
                contextType
            });
            throw error;
        }
    }

    /**
     * DOMAIN: Get proactive analytics
     */
    async getProactiveAnalytics(personalityId = null) {
        try {
            // Engagement analytics
            let engagementSql = `
                SELECT 
                    COUNT(*) as total_engagements,
                    AVG(success_score) as avg_success_score,
                    COUNT(CASE WHEN success_score >= 0.7 THEN 1 END) as successful_engagements,
                    COUNT(CASE WHEN sentiment = 'positive' THEN 1 END) as positive_responses,
                    AVG(response_time) as avg_response_time
                FROM proactive_engagements 
                WHERE success_score IS NOT NULL
            `;

            const engagementParams = [];
            if (personalityId) {
                engagementSql += ` AND personality_id = ?`;
                engagementParams.push(personalityId);
            }

            // Learning patterns analytics
            let patternsSql = `
                SELECT pattern_type, COUNT(*) as pattern_count, AVG(confidence_score) as avg_confidence
                FROM proactive_learning_patterns
                WHERE 1=1
            `;

            const patternsParams = [];
            if (personalityId) {
                patternsSql += ` AND personality_id = ?`;
                patternsParams.push(personalityId);
            }

            patternsSql += ` GROUP BY pattern_type ORDER BY pattern_count DESC`;

            const [engagementStats] = await this.dal.query(engagementSql, engagementParams);
            const learningPatterns = await this.dal.query(patternsSql, patternsParams);

            return {
                engagement: engagementStats || {
                    total_engagements: 0,
                    avg_success_score: 0,
                    successful_engagements: 0,
                    positive_responses: 0,
                    avg_response_time: 0
                },
                learning: learningPatterns
            };

        } catch (error) {
            this.logger.error('Failed to get proactive analytics', 'ProactiveRepository', {
                error: error.message,
                personalityId
            });
            throw error;
        }
    }

    /**
     * UTILITY: Parse JSON field safely
     */
    parseJsonField(field) {
        if (!field) return null;
        if (typeof field === 'object') return field;
        
        try {
            return JSON.parse(field);
        } catch (error) {
            this.logger.warn('Failed to parse JSON field', 'ProactiveRepository', {
                field: typeof field === 'string' ? field.substring(0, 100) : field,
                error: error.message
            });
            return field;
        }
    }

    /**
     * MAINTENANCE: Clean up old engagement data
     */
    async cleanupOldEngagements(daysToKeep = 90) {
        const sql = `
            DELETE FROM proactive_engagements 
            WHERE created_at < datetime('now', '-' || ? || ' days')
        `;

        try {
            const result = await this.dal.execute(sql, [daysToKeep]);
            this.logger.info('Cleaned up old proactive engagements', 'ProactiveRepository', {
                deletedCount: result.changes,
                daysToKeep
            });
            return result.changes;
        } catch (error) {
            this.logger.error('Failed to cleanup old engagements', 'ProactiveRepository', {
                error: error.message,
                daysToKeep
            });
            throw error;
        }
    }

    /**
     * MAINTENANCE: Clean up low-confidence learning patterns
     */
    async cleanupLowConfidencePatterns(confidenceThreshold = 0.3) {
        const sql = `
            DELETE FROM proactive_learning_patterns 
            WHERE confidence_score < ?
        `;

        try {
            const result = await this.dal.execute(sql, [confidenceThreshold]);
            this.logger.info('Cleaned up low-confidence patterns', 'ProactiveRepository', {
                deletedCount: result.changes,
                confidenceThreshold
            });
            return result.changes;
        } catch (error) {
            this.logger.error('Failed to cleanup low-confidence patterns', 'ProactiveRepository', {
                error: error.message,
                confidenceThreshold
            });
            throw error;
        }
    }
}

module.exports = ProactiveRepository;