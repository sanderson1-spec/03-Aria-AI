const BaseRepository = require('../CORE_BaseRepository');

/**
 * SessionRepository - Manages session data storage
 * CLEAN ARCHITECTURE: Infrastructure layer repository
 */
class SessionRepository extends BaseRepository {
    constructor(tableName, dependencies) {
        super(tableName, dependencies);
        this.sessionsTable = 'sessions';
        this.conversationLogsTable = 'conversation_logs';
        this.initialized = false;
    }

    /**
     * Initialize repository
     * CLEAN ARCHITECTURE: Infrastructure layer initialization
     */
    async initialize() {
        try {
            this.logger.info('Initializing SessionRepository...');
            
            // Ensure schema exists
            await this.ensureSessionSchema();
            
            // Validate tables exist
            await this.validateTables();
            
            this.initialized = true;
            return true;
        } catch (error) {
            this.initialized = false;
            throw this.errorHandler.wrapInfrastructureError(error, 'Failed to initialize SessionRepository');
        }
    }

    /**
     * Validate required tables exist
     */
    async validateTables() {
        try {
            // Check sessions table
            const sessionsExists = await this.dbAccess.queryOne(
                'SELECT 1 FROM sqlite_master WHERE type = ? AND name = ?',
                ['table', this.sessionsTable]
            );
            
            // Check conversation logs table
            const logsExists = await this.dbAccess.queryOne(
                'SELECT 1 FROM sqlite_master WHERE type = ? AND name = ?',
                ['table', this.conversationLogsTable]
            );
            
            if (!sessionsExists || !logsExists) {
                throw new Error('Required tables do not exist');
            }
            
            return true;
        } catch (error) {
            throw this.errorHandler.wrapInfrastructureError(error, 'Failed to validate session tables');
        }
    }

    /**
     * Ensure session schema exists
     * CLEAN ARCHITECTURE: Infrastructure layer schema management
     */
    async ensureSessionSchema() {
        try {
            this.logger.info('Creating session schema...');
            
            // Sessions table
            await this.dbAccess.execute(`
                CREATE TABLE IF NOT EXISTS ${this.sessionsTable} (
                    id TEXT PRIMARY KEY,
                    agent_type TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'active',
                    metadata TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
                    ended_at DATETIME
                );
                CREATE INDEX IF NOT EXISTS idx_sessions_status ON ${this.sessionsTable}(status);
                CREATE INDEX IF NOT EXISTS idx_sessions_agent_type ON ${this.sessionsTable}(agent_type);
                CREATE INDEX IF NOT EXISTS idx_sessions_last_activity ON ${this.sessionsTable}(last_activity);
            `);

            // Conversation logs table
            await this.dbAccess.execute(`
                CREATE TABLE IF NOT EXISTS ${this.conversationLogsTable} (
                    id TEXT PRIMARY KEY,
                    session_id TEXT NOT NULL,
                    agent_type TEXT NOT NULL,
                    message_type TEXT NOT NULL,
                    content TEXT,
                    metadata TEXT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (session_id) REFERENCES ${this.sessionsTable}(id) ON DELETE CASCADE
                );
                CREATE INDEX IF NOT EXISTS idx_conversation_logs_session ON ${this.conversationLogsTable}(session_id);
                CREATE INDEX IF NOT EXISTS idx_conversation_logs_agent ON ${this.conversationLogsTable}(agent_type);
                CREATE INDEX IF NOT EXISTS idx_conversation_logs_timestamp ON ${this.conversationLogsTable}(timestamp);
            `);

            return { success: true };
        } catch (error) {
            throw this.errorHandler.wrapInfrastructureError(error, 'Failed to ensure session schema');
        }
    }

    /**
     * Load active sessions
     * CLEAN ARCHITECTURE: Infrastructure layer data access
     */
    async loadActiveSessions() {
        try {
            if (!this.initialized) {
                throw new Error('SessionRepository not initialized');
            }

            const sessions = await this.dbAccess.query(
                `SELECT * FROM ${this.sessionsTable} WHERE status = ? ORDER BY last_activity DESC`,
                ['active']
            );

            return sessions || [];
        } catch (error) {
            if (error.message.includes('no such table')) {
                this.logger.warn('Sessions table does not exist, attempting to create schema...');
                await this.ensureSessionSchema();
                return [];
            }
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to load active sessions');
        }
    }

    /**
     * Check repository health
     */
    async isHealthy() {
        try {
            if (!this.initialized) {
                return false;
            }
            
            // Validate tables exist
            await this.validateTables();
            
            // Test basic operations
            const count = await this.dbAccess.queryOne(
                `SELECT COUNT(*) as count FROM ${this.sessionsTable}`
            );
            
            return count !== null;
        } catch (error) {
            this.logger.error('Session repository health check failed:', error);
            return false;
        }
    }
}

module.exports = SessionRepository; 