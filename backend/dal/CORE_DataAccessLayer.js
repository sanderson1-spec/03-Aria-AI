/**
 * DatabaseAccess - Low-level database operations
 * CLEAN ARCHITECTURE: Infrastructure layer database access
 */
class DatabaseAccess {
    constructor(database, errorHandler) {
        this.db = database;
        this.errorHandler = errorHandler;
    }

    /**
     * Initialize database connection
     * CLEAN ARCHITECTURE: Infrastructure layer initialization
     */
    async initialize() {
        try {
            // Verify database connection
            await this.execute('SELECT 1');
            return true;
        } catch (error) {
            throw this.errorHandler.wrapInfrastructureError(error, 'Failed to initialize database connection');
        }
    }

    /**
     * INFRASTRUCTURE LAYER: Execute query and return all results
     */
    async query(sql, params = []) {
        try {
            return new Promise((resolve, reject) => {
                this.db.all(sql, params, (err, rows) => {
                    if (err) {
                        reject(this.errorHandler.wrapInfrastructureError(err, 'Query execution failed'));
                    } else {
                        resolve(rows || []);
                    }
                });
            });
        } catch (error) {
            throw this.errorHandler.wrapInfrastructureError(error, 'Query execution failed');
        }
    }

    /**
     * INFRASTRUCTURE LAYER: Execute query and return first result
     */
    async queryOne(sql, params = []) {
        try {
            return new Promise((resolve, reject) => {
                this.db.get(sql, params, (err, row) => {
                    if (err) {
                        reject(this.errorHandler.wrapInfrastructureError(err, 'Query execution failed'));
                    } else {
                        resolve(row);
                    }
                });
            });
        } catch (error) {
            throw this.errorHandler.wrapInfrastructureError(error, 'Query execution failed');
        }
    }

    /**
     * INFRASTRUCTURE LAYER: Execute statement that doesn't return results
     */
    async execute(sql, params = []) {
        const errorHandler = this.errorHandler;
        try {
            return new Promise((resolve, reject) => {
                this.db.run(sql, params, function(err) {
                    if (err) {
                        reject(errorHandler.wrapInfrastructureError(err, 'Statement execution failed'));
                    } else {
                        resolve({
                            lastID: this.lastID,
                            changes: this.changes
                        });
                    }
                });
            });
        } catch (error) {
            throw this.errorHandler.wrapInfrastructureError(error, 'Statement execution failed');
        }
    }

    /**
     * INFRASTRUCTURE LAYER: Count distinct values in a column
     */
    async countDistinct(tableName, columnName) {
        try {
            const sql = `SELECT COUNT(DISTINCT ${columnName}) as count FROM ${tableName}`;
            const result = await this.queryOne(sql);
            return result ? result.count : 0;
        } catch (error) {
            throw this.errorHandler.wrapInfrastructureError(error, 'Failed to count distinct values');
        }
    }

    /**
     * INFRASTRUCTURE LAYER: Execute multiple statements in a transaction
     */
    async executeInTransaction(statements) {
        try {
            await this.beginTransaction();
            
            try {
                const results = [];
                for (const statement of statements) {
                    const { sql, params = [] } = statement;
                    const result = await this.execute(sql, params);
                    results.push(result);
                }
                
                await this.commitTransaction();
                return results;
            } catch (error) {
                await this.rollbackTransaction();
                throw error;
            }
        } catch (error) {
            throw this.errorHandler.wrapInfrastructureError(error, 'Transaction execution failed');
        }
    }

    /**
     * INFRASTRUCTURE LAYER: Begin transaction
     */
    async beginTransaction() {
        try {
            await this.execute('BEGIN TRANSACTION');
        } catch (error) {
            throw this.errorHandler.wrapInfrastructureError(error, 'Failed to begin transaction');
        }
    }

    /**
     * INFRASTRUCTURE LAYER: Commit transaction
     */
    async commitTransaction() {
        try {
            await this.execute('COMMIT');
        } catch (error) {
            throw this.errorHandler.wrapInfrastructureError(error, 'Failed to commit transaction');
        }
    }

    /**
     * INFRASTRUCTURE LAYER: Rollback transaction
     */
    async rollbackTransaction() {
        try {
            await this.execute('ROLLBACK');
        } catch (error) {
            throw this.errorHandler.wrapInfrastructureError(error, 'Failed to rollback transaction');
        }
    }

    /**
     * Check if database is connected
     * CLEAN ARCHITECTURE: Infrastructure layer health check
     */
    async isConnected() {
        try {
            await this.execute('SELECT 1');
            return true;
        } catch (error) {
            return false;
        }
    }
}

module.exports = DatabaseAccess; 