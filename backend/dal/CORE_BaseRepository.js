/**
 * BaseRepository - Base class for all repositories
 * CLEAN ARCHITECTURE: Infrastructure layer base repository
 */
class BaseRepository {
    constructor(tableName, dependencies) {
        if (!dependencies.errorHandling) {
            throw new Error('Error handling service not provided to repository');
        }
        if (!dependencies.logger) {
            throw new Error('Logger service not provided to repository');
        }
        if (!dependencies.dal) {
            throw new Error('DAL not provided to repository');
        }
        
        this.tableName = tableName;
        this.logger = dependencies.logger;
        this.errorHandler = dependencies.errorHandling;
        this.dal = dependencies.dal;
    }

    /**
     * Initialize repository
     * CLEAN ARCHITECTURE: Infrastructure layer initialization
     */
    async initialize() {
        try {
            // Initialize schema if method exists
            const schemaMethod = Object.getOwnPropertyNames(Object.getPrototypeOf(this))
                .find(method => method.startsWith('ensure') && method.endsWith('Schema'));
            
            if (schemaMethod && typeof this[schemaMethod] === 'function') {
                await this[schemaMethod]();
            }
            
            // Validate table exists
            await this.validateTable();
            
            return true;
        } catch (error) {
            throw this.errorHandler.wrapInfrastructureError(error, `Failed to initialize ${this.tableName} repository`);
        }
    }

    /**
     * Validate table exists
     * CLEAN ARCHITECTURE: Infrastructure layer validation
     */
    async validateTable() {
        try {
            // Check if table exists in sqlite_master
            const result = await this.dal.queryOne(
                'SELECT sql FROM sqlite_master WHERE type = ? AND name = ?',
                ['table', this.tableName]
            );
            
            if (!result) {
                // Table doesn't exist, check if we have a schema method
                const schemaMethod = Object.getOwnPropertyNames(Object.getPrototypeOf(this))
                    .find(method => method.startsWith('ensure') && method.endsWith('Schema'));
                
                if (schemaMethod && typeof this[schemaMethod] === 'function') {
                    // Create table using schema method
                    await this[schemaMethod]();
                    return true;
                } else {
                    throw new Error(`Table ${this.tableName} does not exist and no schema method found`);
                }
            }
            
            return true;
        } catch (error) {
            throw this.errorHandler.wrapInfrastructureError(error, `Failed to validate table ${this.tableName}`);
        }
    }

    /**
     * DOMAIN LAYER: Find by ID
     */
    async findById(id) {
        try {
            return await this.dal.findById(this.tableName, id);
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, `Failed to find ${this.tableName} by ID`);
        }
    }

    /**
     * DOMAIN LAYER: Find all records
     */
    async findAll(conditions = {}, orderBy = '', limit = 1000) {
        try {
            return await this.dal.findAll(this.tableName, conditions, orderBy, limit);
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, `Failed to find all ${this.tableName}`);
        }
    }

    /**
     * DOMAIN LAYER: Create record
     */
    async create(data) {
        try {
            return await this.dal.create(this.tableName, data);
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, `Failed to create ${this.tableName}`);
        }
    }

    /**
     * DOMAIN LAYER: Update record
     */
    async update(data, conditions) {
        try {
            return await this.dal.update(this.tableName, data, conditions);
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, `Failed to update ${this.tableName}`);
        }
    }

    /**
     * DOMAIN LAYER: Delete record
     */
    async delete(conditions) {
        try {
            return await this.dal.delete(this.tableName, conditions);
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, `Failed to delete from ${this.tableName}`);
        }
    }

    /**
     * DOMAIN LAYER: Count records
     */
    async count(conditions = {}) {
        try {
            return await this.dal.count(this.tableName, conditions);
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, `Failed to count ${this.tableName}`);
        }
    }

    /**
     * DOMAIN LAYER: Count distinct values
     */
    async countDistinct(column, conditions = {}) {
        try {
            return await this.dal.countDistinct(this.tableName, column, conditions);
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, `Failed to count distinct ${column} in ${this.tableName}`);
        }
    }

    /**
     * UTILITY: Format date for database
     */
    formatDate(date = null) {
        if (!date) {
            date = new Date();
        } else if (typeof date === 'string') {
            date = new Date(date);
        }
        return date.toISOString().split('T')[0];
    }

    /**
     * UTILITY: Get current timestamp
     */
    getCurrentTimestamp() {
        return new Date().toISOString();
    }

    /**
     * UTILITY: Stringify JSON data
     */
    stringifyJSON(data) {
        try {
            return data ? JSON.stringify(data) : null;
        } catch (error) {
            throw this.errorHandler.wrapDomainError(error, 'Failed to stringify JSON data');
        }
    }

    /**
     * UTILITY: Parse JSON data
     */
    parseJSON(data) {
        try {
            return typeof data === 'string' ? JSON.parse(data) : data;
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to parse JSON data');
        }
    }


    /**
     * Health check
     */
    async isHealthy() {
        try {
            await this.validateTable();
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Validate required fields are present and not empty
     * CLEAN ARCHITECTURE: Domain layer validation helper
     */
    validateRequiredFields(data, requiredFields, operation = 'operation') {
        if (!data || typeof data !== 'object') {
            throw new Error(`Invalid data provided for ${operation}: data must be an object`);
        }

        const missingFields = [];
        const emptyFields = [];

        for (const field of requiredFields) {
            if (!(field in data)) {
                missingFields.push(field);
            } else if (data[field] === null || data[field] === undefined || data[field] === '') {
                emptyFields.push(field);
            }
        }

        if (missingFields.length > 0 || emptyFields.length > 0) {
            const errors = [];
            if (missingFields.length > 0) {
                errors.push(`Missing required fields: ${missingFields.join(', ')}`);
            }
            if (emptyFields.length > 0) {
                errors.push(`Empty required fields: ${emptyFields.join(', ')}`);
            }
            
            throw new Error(`Validation failed for ${operation}: ${errors.join('; ')}`);
        }

        return true;
    }

    /**
     * Sanitize data by removing undefined/null values and ensuring proper types
     * CLEAN ARCHITECTURE: Data validation helper
     */
    sanitizeData(data) {
        if (!data || typeof data !== 'object') {
            return data;
        }

        const sanitized = {};
        for (const [key, value] of Object.entries(data)) {
            // Skip undefined values
            if (value !== undefined) {
                // Convert null to explicit null (for database)
                sanitized[key] = value;
            }
        }

        return sanitized;
    }
}

module.exports = BaseRepository; 