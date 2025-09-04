const BaseRepository = require('../CORE_BaseRepository');

/**
 * ConfigurationRepository - Handles application configuration management
 * CLEAN ARCHITECTURE: Infrastructure layer configuration persistence
 */
class ConfigurationRepository extends BaseRepository {
    constructor(tableName, dependencies) {
        super(tableName, dependencies);
    }

    /**
     * DOMAIN LAYER: Get configuration value by key
     */
    async getConfigValue(key) {
        try {
            const sql = `SELECT * FROM ${this.tableName} WHERE key = ?`;
            const config = await this.dbAccess.queryOne(sql, [key]);
            
            if (!config) {
                return null;
            }
            
            // Parse value based on type
            switch (config.type) {
                case 'number':
                    return parseFloat(config.value);
                case 'boolean':
                    return config.value === 'true';
                case 'json':
                    return JSON.parse(config.value);
                default:
                    return config.value;
            }
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to get config value', { key });
        }
    }

    /**
     * DOMAIN LAYER: Set configuration value
     */
    async setConfigValue(key, value, type = 'string', description = null, category = 'general', isUserConfigurable = false) {
        try {
            // Convert value to string for storage
            let stringValue;
            switch (type) {
                case 'json':
                    stringValue = JSON.stringify(value);
                    break;
                case 'boolean':
                    stringValue = value ? 'true' : 'false';
                    break;
                default:
                    stringValue = String(value);
            }

            const config = {
                key,
                value: stringValue,
                type,
                description,
                category,
                is_user_configurable: isUserConfigurable ? 1 : 0,
                updated_at: new Date().toISOString()
            };

            // Use INSERT OR REPLACE to handle updates
            const sql = `
                INSERT OR REPLACE INTO ${this.tableName} 
                (key, value, type, description, category, is_user_configurable, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `;
            
            await this.dbAccess.run(sql, [
                config.key, config.value, config.type, config.description, 
                config.category, config.is_user_configurable, config.updated_at
            ]);
            
            return await this.getConfigValue(key);
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to set config value', { key, value, type });
        }
    }

    /**
     * DOMAIN LAYER: Get all configuration by category
     */
    async getConfigByCategory(category) {
        try {
            const sql = `SELECT * FROM ${this.tableName} WHERE category = ? ORDER BY key`;
            const configs = await this.dbAccess.queryAll(sql, [category]);
            
            // Convert to key-value object with parsed values
            const result = {};
            for (const config of configs) {
                switch (config.type) {
                    case 'number':
                        result[config.key] = parseFloat(config.value);
                        break;
                    case 'boolean':
                        result[config.key] = config.value === 'true';
                        break;
                    case 'json':
                        result[config.key] = JSON.parse(config.value);
                        break;
                    default:
                        result[config.key] = config.value;
                }
            }
            
            return result;
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to get config by category', { category });
        }
    }

    /**
     * DOMAIN LAYER: Get user-configurable settings
     */
    async getUserConfigurableSettings() {
        try {
            const sql = `
                SELECT key, value, type, description, category 
                FROM ${this.tableName} 
                WHERE is_user_configurable = 1 
                ORDER BY category, key
            `;
            
            return await this.dbAccess.queryAll(sql, []);
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to get user configurable settings');
        }
    }

    /**
     * DOMAIN LAYER: Get all configuration as key-value object
     */
    async getAllConfig() {
        try {
            const sql = `SELECT * FROM ${this.tableName} ORDER BY category, key`;
            const configs = await this.dbAccess.queryAll(sql, []);
            
            const result = {};
            for (const config of configs) {
                switch (config.type) {
                    case 'number':
                        result[config.key] = parseFloat(config.value);
                        break;
                    case 'boolean':
                        result[config.key] = config.value === 'true';
                        break;
                    case 'json':
                        result[config.key] = JSON.parse(config.value);
                        break;
                    default:
                        result[config.key] = config.value;
                }
            }
            
            return result;
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to get all configuration');
        }
    }

    /**
     * DOMAIN LAYER: Delete configuration key
     */
    async deleteConfig(key) {
        try {
            const sql = `DELETE FROM ${this.tableName} WHERE key = ?`;
            const result = await this.dbAccess.run(sql, [key]);
            
            return result.changes > 0;
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to delete config', { key });
        }
    }

    /**
     * DOMAIN LAYER: Bulk update configuration
     */
    async bulkUpdateConfig(configUpdates) {
        try {
            const timestamp = new Date().toISOString();
            
            for (const [key, value] of Object.entries(configUpdates)) {
                await this.setConfigValue(key, value, 'string', null, 'bulk_update', false);
            }
            
            if (this.logger) {
                this.logger.info(`Bulk configuration update completed`, 'ConfigurationRepository', {
                    updatedKeys: Object.keys(configUpdates),
                    count: Object.keys(configUpdates).length
                });
            }
            
            return true;
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to bulk update configuration', { configUpdates });
        }
    }
}

module.exports = ConfigurationRepository;
