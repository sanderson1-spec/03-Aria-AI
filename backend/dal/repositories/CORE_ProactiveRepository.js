// backend/dal/repositories/ProactiveRepository.js
// CLEAN ARCHITECTURE: Infrastructure layer - Proactive messaging data access
// FOLLOWS YOUR PROJECT GUIDELINES: Uses existing advanced tables, extends BaseRepository

const BaseRepository = require('../CORE_BaseRepository');

/**
 * ProactiveRepository - Handles proactive intelligence data
 * CLEAN ARCHITECTURE: Infrastructure layer proactive management
 */
class ProactiveRepository extends BaseRepository {
    constructor(tableName, dependencies) {
        super(tableName, dependencies);
    }

    /**
     * DOMAIN LAYER: Access proactive engagement history (MULTI-TABLE SUPPORT)
     */
    async getEngagementHistory(userId, limit = 50) {
        try {
            const sql = `
                SELECT * FROM proactive_engagement_history 
                WHERE user_id = ?
                ORDER BY timestamp DESC
                LIMIT ?
            `;
            return await this.dal.query(sql, [userId, limit]);
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to get engagement history', { userId, limit });
        }
    }

    /**
     * DOMAIN LAYER: Access proactive learning patterns (MULTI-TABLE SUPPORT)
     */
    async getLearningPatterns(userId, patternType = null, limit = 50) {
        try {
            let sql = `
                SELECT * FROM proactive_learning_patterns 
                WHERE user_id = ?
            `;
            const params = [userId];
            
            if (patternType) {
                sql += ` AND pattern_type = ?`;
                params.push(patternType);
            }
            
            sql += ` ORDER BY updated_at DESC LIMIT ?`;
            params.push(limit);
            
            return await this.dal.query(sql, params);
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to get learning patterns', { userId, patternType, limit });
        }
    }

    /**
     * DOMAIN LAYER: Access proactive timing optimizations (MULTI-TABLE SUPPORT)
     */
    async getTimingOptimizations(userId, optimizationType = null) {
        try {
            let sql = `
                SELECT * FROM proactive_timing_optimizations 
                WHERE user_id = ?
            `;
            const params = [userId];
            
            if (optimizationType) {
                sql += ` AND optimization_type = ?`;
                params.push(optimizationType);
            }
            
            sql += ` ORDER BY updated_at DESC`;
            
            return await this.dal.query(sql, params);
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to get timing optimizations', { userId, optimizationType });
        }
    }

    /**
     * INFRASTRUCTURE LAYER: Ensure proactive schema exists
     */
    async ensureProactiveSchema() {
        try {
            const schema = `
                CREATE TABLE IF NOT EXISTS proactive_engagement_history (
                    id TEXT PRIMARY KEY,
                    session_id TEXT NOT NULL,
                    engagement_type TEXT NOT NULL,
                    trigger_type TEXT NOT NULL,
                    trigger_data TEXT,
                    response_data TEXT,
                    success BOOLEAN DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );

                CREATE INDEX IF NOT EXISTS idx_proactive_session ON proactive_engagement_history(session_id);
                CREATE INDEX IF NOT EXISTS idx_proactive_type ON proactive_engagement_history(engagement_type);
                CREATE INDEX IF NOT EXISTS idx_proactive_trigger ON proactive_engagement_history(trigger_type);
            `;
            
            await this.dal.execute(schema);
            return { success: true };
        } catch (error) {
            throw this.errorHandler.wrapInfrastructureError(error, 'Failed to ensure proactive schema');
        }
    }

    /**
     * INFRASTRUCTURE LAYER: Get engagement by ID
     */
    async getEngagementById(engagementId) {
        try {
            return await this.findById(engagementId);
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to get engagement by ID');
        }
    }
}

module.exports = ProactiveRepository;