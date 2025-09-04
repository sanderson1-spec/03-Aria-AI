const BaseRepository = require('../CORE_BaseRepository');

/**
 * AnalyticsRepository - Handles usage analytics and event tracking
 * CLEAN ARCHITECTURE: Infrastructure layer analytics management
 */
class AnalyticsRepository extends BaseRepository {
    constructor(tableName, dependencies) {
        super(tableName, dependencies);
    }

    /**
     * DOMAIN LAYER: Record analytics event
     */
    async recordEvent(eventData) {
        try {
            const eventId = require('uuid').v4();
            
            const event = {
                id: eventId,
                user_id: eventData.user_id || null,
                event_type: eventData.event_type,
                event_data: JSON.stringify(eventData.event_data || {}),
                session_id: eventData.session_id || null,
                timestamp: new Date().toISOString()
            };

            await this.create(event);
            return eventId;
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to record analytics event', { eventData });
        }
    }

    /**
     * DOMAIN LAYER: Get events by type
     */
    async getEventsByType(eventType, userId = null, limit = 100) {
        try {
            let sql = `
                SELECT * FROM ${this.tableName} 
                WHERE event_type = ?
            `;
            const params = [eventType];
            
            if (userId) {
                sql += ` AND user_id = ?`;
                params.push(userId);
            }
            
            sql += ` ORDER BY timestamp DESC LIMIT ?`;
            params.push(limit);
            
            return await this.dbAccess.queryAll(sql, params);
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to get events by type', { eventType, userId, limit });
        }
    }

    /**
     * DOMAIN LAYER: Get analytics summary for user
     */
    async getUserAnalyticsSummary(userId, startDate = null, endDate = null) {
        try {
            let sql = `
                SELECT 
                    event_type,
                    COUNT(*) as event_count,
                    MIN(timestamp) as first_event,
                    MAX(timestamp) as last_event
                FROM ${this.tableName} 
                WHERE user_id = ?
            `;
            const params = [userId];
            
            if (startDate) {
                sql += ` AND timestamp >= ?`;
                params.push(startDate);
            }
            
            if (endDate) {
                sql += ` AND timestamp <= ?`;
                params.push(endDate);
            }
            
            sql += ` GROUP BY event_type ORDER BY event_count DESC`;
            
            return await this.dbAccess.queryAll(sql, params);
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to get user analytics summary', { userId, startDate, endDate });
        }
    }

    /**
     * DOMAIN LAYER: Get system-wide analytics summary
     */
    async getSystemAnalyticsSummary(startDate = null, endDate = null) {
        try {
            let sql = `
                SELECT 
                    event_type,
                    COUNT(*) as total_events,
                    COUNT(DISTINCT user_id) as unique_users,
                    MIN(timestamp) as first_event,
                    MAX(timestamp) as last_event
                FROM ${this.tableName} 
                WHERE 1=1
            `;
            const params = [];
            
            if (startDate) {
                sql += ` AND timestamp >= ?`;
                params.push(startDate);
            }
            
            if (endDate) {
                sql += ` AND timestamp <= ?`;
                params.push(endDate);
            }
            
            sql += ` GROUP BY event_type ORDER BY total_events DESC`;
            
            return await this.dbAccess.queryAll(sql, params);
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to get system analytics summary', { startDate, endDate });
        }
    }

    /**
     * DOMAIN LAYER: Clean up old analytics data
     */
    async cleanupOldData(retentionDays = 90) {
        try {
            const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
            
            const sql = `DELETE FROM ${this.tableName} WHERE timestamp < ?`;
            const result = await this.dbAccess.run(sql, [cutoffDate]);
            
            if (this.logger) {
                this.logger.info(`Cleaned up old analytics data`, 'AnalyticsRepository', {
                    deletedCount: result.changes || 0,
                    retentionDays,
                    cutoffDate
                });
            }
            
            return result.changes || 0;
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to cleanup old analytics data', { retentionDays });
        }
    }

    /**
     * DOMAIN LAYER: Get recent user activity
     */
    async getRecentUserActivity(userId, hours = 24, limit = 50) {
        try {
            const startTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
            
            const sql = `
                SELECT * FROM ${this.tableName} 
                WHERE user_id = ? AND timestamp >= ?
                ORDER BY timestamp DESC 
                LIMIT ?
            `;
            
            return await this.dbAccess.queryAll(sql, [userId, startTime, limit]);
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to get recent user activity', { userId, hours, limit });
        }
    }
}

module.exports = AnalyticsRepository;
