const BaseRepository = require('../CORE_BaseRepository');

/**
 * SchemaRepository - Handles database schema versioning
 * CLEAN ARCHITECTURE: Infrastructure layer schema management
 */
class SchemaRepository extends BaseRepository {
    constructor(tableName, dependencies) {
        super(tableName, dependencies);
    }

    /**
     * INFRASTRUCTURE LAYER: Get current schema version
     */
    async getCurrentVersion() {
        try {
            const sql = `
                SELECT version, applied_at 
                FROM ${this.tableName} 
                ORDER BY version DESC 
                LIMIT 1
            `;
            return await this.dal.queryOne(sql, []);
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to get current schema version');
        }
    }

    /**
     * INFRASTRUCTURE LAYER: Record schema version
     */
    async recordVersion(version, description = null) {
        try {
            const versionId = require('uuid').v4();
            const now = new Date().toISOString();
            
            const record = {
                id: versionId,
                version,
                description,
                applied_at: now
            };

            const sql = `
                INSERT INTO ${this.tableName} (id, version, description, applied_at)
                VALUES (?, ?, ?, ?)
            `;
            
            await this.dal.execute(sql, [record.id, record.version, record.description, record.applied_at]);
            return versionId;
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to record schema version', { version, description });
        }
    }

    /**
     * INFRASTRUCTURE LAYER: Get schema history
     */
    async getSchemaHistory() {
        try {
            const sql = `
                SELECT * FROM ${this.tableName} 
                ORDER BY version DESC
            `;
            return await this.dal.query(sql, []);
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to get schema history');
        }
    }
}

module.exports = SchemaRepository;
