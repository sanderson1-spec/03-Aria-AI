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

    /**
     * HIGH-LEVEL DAL: Find record by ID
     */
    async findById(tableName, id) {
        try {
            const sql = `SELECT * FROM ${tableName} WHERE id = ?`;
            return await this.queryOne(sql, [id]);
        } catch (error) {
            throw this.errorHandler.wrapInfrastructureError(error, `Failed to find record by ID in ${tableName}`);
        }
    }

    /**
     * HIGH-LEVEL DAL: Find all records with conditions
     */
    async findAll(tableName, conditions = {}, orderBy = '', limit = 1000) {
        try {
            const whereClause = Object.keys(conditions).length > 0 
                ? 'WHERE ' + Object.keys(conditions).map(key => `${key} = ?`).join(' AND ')
                : '';
            
            const orderClause = orderBy ? `ORDER BY ${orderBy}` : '';
            const limitClause = limit ? `LIMIT ${limit}` : '';
            
            const sql = `SELECT * FROM ${tableName} ${whereClause} ${orderClause} ${limitClause}`.trim();
            const params = Object.values(conditions);
            
            return await this.query(sql, params);
        } catch (error) {
            throw this.errorHandler.wrapInfrastructureError(error, `Failed to find records in ${tableName}`);
        }
    }

    /**
     * HIGH-LEVEL DAL: Create new record
     */
    async create(tableName, data) {
        try {
            const columns = Object.keys(data).join(', ');
            const placeholders = Object.keys(data).map(() => '?').join(', ');
            const values = Object.values(data);
            
            const sql = `INSERT INTO ${tableName} (${columns}) VALUES (${placeholders})`;
            const result = await this.execute(sql, values);
            
            return { id: result.lastID, ...data };
        } catch (error) {
            throw this.errorHandler.wrapInfrastructureError(error, `Failed to create record in ${tableName}`);
        }
    }

    /**
     * HIGH-LEVEL DAL: Update records
     */
    async update(tableName, data, conditions) {
        try {
            const setClause = Object.keys(data).map(key => `${key} = ?`).join(', ');
            const whereClause = Object.keys(conditions).map(key => `${key} = ?`).join(' AND ');
            
            const sql = `UPDATE ${tableName} SET ${setClause} WHERE ${whereClause}`;
            const params = [...Object.values(data), ...Object.values(conditions)];
            
            const result = await this.execute(sql, params);
            return { changes: result.changes };
        } catch (error) {
            throw this.errorHandler.wrapInfrastructureError(error, `Failed to update records in ${tableName}`);
        }
    }

    /**
     * HIGH-LEVEL DAL: Delete records
     */
    async delete(tableName, conditions) {
        try {
            const whereClause = Object.keys(conditions).map(key => `${key} = ?`).join(' AND ');
            const sql = `DELETE FROM ${tableName} WHERE ${whereClause}`;
            const params = Object.values(conditions);
            
            const result = await this.execute(sql, params);
            return { changes: result.changes };
        } catch (error) {
            throw this.errorHandler.wrapInfrastructureError(error, `Failed to delete records from ${tableName}`);
        }
    }

    /**
     * HIGH-LEVEL DAL: Count records
     */
    async count(tableName, conditions = {}) {
        try {
            const whereClause = Object.keys(conditions).length > 0 
                ? 'WHERE ' + Object.keys(conditions).map(key => `${key} = ?`).join(' AND ')
                : '';
            
            const sql = `SELECT COUNT(*) as count FROM ${tableName} ${whereClause}`;
            const params = Object.values(conditions);
            
            const result = await this.queryOne(sql, params);
            return result ? result.count : 0;
        } catch (error) {
            throw this.errorHandler.wrapInfrastructureError(error, `Failed to count records in ${tableName}`);
        }
    }

    /**
     * HIGH-LEVEL DAL: Count distinct values (enhanced version)
     */
    async countDistinct(tableName, column, conditions = {}) {
        try {
            const whereClause = Object.keys(conditions).length > 0 
                ? 'WHERE ' + Object.keys(conditions).map(key => `${key} = ?`).join(' AND ')
                : '';
            
            const sql = `SELECT COUNT(DISTINCT ${column}) as count FROM ${tableName} ${whereClause}`;
            const params = Object.values(conditions);
            
            const result = await this.queryOne(sql, params);
            return result ? result.count : 0;
        } catch (error) {
            throw this.errorHandler.wrapInfrastructureError(error, `Failed to count distinct ${column} in ${tableName}`);
        }
    }
}

module.exports = DatabaseAccess; 