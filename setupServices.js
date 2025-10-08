/**
 * Service Registration and Initialization
 * 
 * CLEAN ARCHITECTURE DESIGN:
 * - Centralized service wiring with dependency injection
 * - Proper initialization order based on dependencies
 * - Database and repository setup
 * - Health monitoring and graceful shutdown
 * 
 * This file orchestrates the entire application service ecosystem:
 * - Foundation services (logging, error handling, configuration)
 * - Infrastructure services (database, repositories)
 * - Intelligence services (LLM, structured response)
 * - Domain services (psychology, conversation analysis, proactive intelligence)
 */

const ServiceFactory = require('./backend/services/CORE_ServiceFactory');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Foundation Services
const LoggerService = require('./backend/services/foundation/CORE_LoggerService');
const ErrorHandlingService = require('./backend/services/foundation/CORE_ErrorHandlingService');
const ConfigurationService = require('./backend/services/foundation/CORE_ConfigurationService');

// Infrastructure Services
const DataAccessLayer = require('./backend/dal/CORE_DataAccessLayer');
const MessageDeliveryService = require('./backend/services/infrastructure/CORE_MessageDeliveryService');
const SchedulingService = require('./backend/services/infrastructure/CORE_SchedulingService');
const LLMConfigService = require('./backend/services/infrastructure/CORE_LLMConfigService');
const EventSchedulerService = require('./backend/services/infrastructure/CORE_EventSchedulerService');
const AuthService = require('./backend/services/infrastructure/AuthService');

// Intelligence Services  
const LLMService = require('./backend/services/intelligence/CORE_LLMService');
const StructuredResponseService = require('./backend/services/intelligence/CORE_StructuredResponseService');

// Domain Services
const PsychologyService = require('./backend/services/domain/CORE_PsychologyService');
const TaskVerificationService = require('./backend/services/domain/CORE_TaskVerificationService');
const ConversationAnalyzer = require('./backend/services/domain/CORE_ConversationAnalyzer');
const ProactiveIntelligenceService = require('./backend/services/domain/CORE_ProactiveIntelligenceService');
const ProactiveLearningService = require('./backend/services/domain/CORE_ProactiveLearningService');
const ProactiveDeliveryService = require('./backend/services/domain/ProactiveDeliveryService');
const BackgroundAnalysisService = require('./backend/services/domain/BackgroundAnalysisService');
const ContextBuilderService = require('./backend/services/domain/CORE_ContextBuilderService');
const MemorySearchService = require('./backend/services/domain/CORE_MemorySearchService');

// Repository Classes
const ChatRepository = require('./backend/dal/repositories/CORE_ChatRepository');
const ConversationRepository = require('./backend/dal/repositories/CORE_ConversationRepository');
const PersonalityRepository = require('./backend/dal/repositories/CORE_PersonalityRepository');
const PsychologyRepository = require('./backend/dal/repositories/CORE_PsychologyRepository');
const ProactiveRepository = require('./backend/dal/repositories/CORE_ProactiveRepository');
const SessionRepository = require('./backend/dal/repositories/CORE_SessionRepository');
// New repositories for unified schema
const UserRepository = require('./backend/dal/repositories/CORE_UserRepository');
const UserSessionRepository = require('./backend/dal/repositories/CORE_UserSessionRepository');
const AnalyticsRepository = require('./backend/dal/repositories/CORE_AnalyticsRepository');
const ConfigurationRepository = require('./backend/dal/repositories/CORE_ConfigurationRepository');
const SchemaRepository = require('./backend/dal/repositories/CORE_SchemaRepository');
const CommitmentsRepository = require('./backend/dal/repositories/CORE_CommitmentsRepository');
const EventsRepository = require('./backend/dal/repositories/CORE_EventsRepository');
const AuthRepository = require('./backend/dal/repositories/AuthRepository');

/**
 * Database Service - Infrastructure Layer
 * 
 * CLEAN ARCHITECTURE DESIGN:
 * - Infrastructure layer database connection management
 * - Repository pattern implementation
 * - Data Access Layer (DAL) coordination
 * - Database lifecycle management
 */
class DatabaseService {
    constructor(dependencies = {}) {
        this.logger = dependencies.logger;
        this.errorHandler = dependencies.errorHandling;
        
        // Database configuration (unified database)
        this.dbPath = dependencies.dbPath || path.join(__dirname, 'database', 'aria.db');
        this.db = null;
        this.dal = null;
        this.repositories = new Map();
        this.initialized = false;
    }

    /**
     * Initialize database connection and repositories
     */
    async initialize() {
        if (this.initialized) {
            return;
        }

        try {
            if (this.logger) {
                this.logger.info('Initializing database service', 'DatabaseService', {
                    dbPath: this.dbPath
                });
            }

            // Create SQLite connection with proper error handling
            this.db = await this.createDatabaseConnection();

            // Create DatabaseAccess instance
            this.dal = new DataAccessLayer(this.db, this.errorHandler);
            await this.dal.initialize();

            // Initialize all repositories
            await this.initializeRepositories();

            this.initialized = true;
            
            if (this.logger) {
                this.logger.info('Database service initialized successfully', 'DatabaseService', {
                    repositoriesCount: this.repositories.size
                });
            }

        } catch (error) {
            const wrappedError = this.errorHandler?.wrapInfrastructureError(error, 'Database service initialization failed') || error;
            if (this.logger) {
                this.logger.error('Database initialization failed', 'DatabaseService', {
                    error: wrappedError.message
                });
            }
            throw wrappedError;
        }
    }

    /**
     * Create database connection with proper error handling
     */
    async createDatabaseConnection() {
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    reject(this.errorHandler?.wrapInfrastructureError(err, 'Failed to connect to database') || err);
                } else {
                    resolve(db);
                }
            });
        });
    }

    /**
     * Initialize all repositories with proper dependencies
     */
    async initializeRepositories() {
        const repositoryConfigs = [
            // Core repositories
            { name: 'users', class: UserRepository, table: 'users' },
            { name: 'userSessions', class: UserSessionRepository, table: 'user_sessions' },
            { name: 'auth', class: AuthRepository, table: 'users' }, // Auth repository uses users table
            { name: 'chats', class: ChatRepository, table: 'chats' },
            { name: 'conversations', class: ConversationRepository, table: 'conversation_logs' },
            { name: 'personalities', class: PersonalityRepository, table: 'personalities' },
            { name: 'sessions', class: SessionRepository, table: 'sessions' },
            // Psychology repositories  
            { name: 'psychology', class: PsychologyRepository, table: 'psychology_frameworks' },
            // Proactive intelligence repositories
            { name: 'proactive', class: ProactiveRepository, table: 'proactive_engagements' },
            { name: 'commitments', class: CommitmentsRepository, table: 'commitments' },
            { name: 'events', class: EventsRepository, table: 'events' },
            // Configuration and analytics
            { name: 'configuration', class: ConfigurationRepository, table: 'configuration' },
            { name: 'analytics', class: AnalyticsRepository, table: 'analytics_data' },
            // System tables
            { name: 'schema', class: SchemaRepository, table: 'schema_versions' }
        ];

        const repositoryDependencies = {
            logger: this.logger,
            errorHandling: this.errorHandler,
            dal: this.dal
        };

        for (const config of repositoryConfigs) {
            try {
                const repository = new config.class(config.table, repositoryDependencies);
                await repository.initialize();
                this.repositories.set(config.name, repository);
                
                if (this.logger) {
                    this.logger.info(`Repository initialized: ${config.name}`, 'DatabaseService');
                }
            } catch (error) {
                const wrappedError = this.errorHandler?.wrapInfrastructureError(error, `Failed to initialize ${config.name} repository`) || error;
                if (this.logger) {
                    this.logger.error(`Repository initialization failed: ${config.name}`, 'DatabaseService', {
                        error: wrappedError.message
                    });
                }
                throw wrappedError;
            }
        }
    }

    /**
     * Get Data Access Layer with repositories
     */
    getDAL() {
        if (!this.initialized) {
            throw new Error('Database service not initialized');
        }

        return {
            // Raw database access
            query: this.dal.query.bind(this.dal),
            queryOne: this.dal.queryOne.bind(this.dal),
            execute: this.dal.execute.bind(this.dal),
            executeInTransaction: this.dal.executeInTransaction.bind(this.dal),
            
            // Repository access - All tables covered
            users: this.repositories.get('users'),
            userSessions: this.repositories.get('userSessions'),
            auth: this.repositories.get('auth'),
            chats: this.repositories.get('chats'),
            conversations: this.repositories.get('conversations'),
            conversationLogs: this.repositories.get('conversations'),  // Alias for conversation operations
            personalities: this.repositories.get('personalities'),
            sessions: this.repositories.get('sessions'),
            psychology: this.repositories.get('psychology'),
            proactive: this.repositories.get('proactive'),
            commitments: this.repositories.get('commitments'),
            events: this.repositories.get('events'),
            configuration: this.repositories.get('configuration'),
            analytics: this.repositories.get('analytics'),
            schema: this.repositories.get('schema'),
            
            // Psychology-related table access through psychology repository
            psychologyFrameworks: this.repositories.get('psychology'),
            characterPsychologicalFrameworks: this.repositories.get('psychology'),
            characterPsychologicalState: this.repositories.get('psychology'),
            psychologyEvolutionLog: this.repositories.get('psychology'),
            characterMemoryWeights: this.repositories.get('psychology'),
            memories: this.repositories.get('psychology'),  // Memory operations (weights, search) handled by psychology repository
            
            // Proactive-related table access through proactive repository
            proactiveEngagements: this.repositories.get('proactive'),
            proactiveEngagementHistory: this.repositories.get('proactive'),
            proactiveLearningPatterns: this.repositories.get('proactive'),
            proactiveTimingOptimizations: this.repositories.get('proactive')
        };
    }

    /**
     * Health check
     */
    async checkHealth() {
        try {
            if (!this.initialized || !this.dal) {
                return { healthy: false, details: { error: 'Not initialized' } };
            }

            const isConnected = await this.dal.isConnected();
            const repositoryCount = this.repositories.size;

            return {
                healthy: isConnected,
                details: {
                    connected: isConnected,
                    repositoriesInitialized: repositoryCount,
                    dbPath: this.dbPath
                }
            };
        } catch (error) {
            return {
                healthy: false,
                details: {
                    error: error.message
                }
            };
        }
    }

    /**
     * Graceful shutdown
     */
    async shutdown() {
        if (this.db) {
            return new Promise((resolve) => {
                this.db.close((err) => {
                    if (err && this.logger) {
                        this.logger.error('Error closing database', 'DatabaseService', {
                            error: err.message
                        });
                    } else if (this.logger) {
                        this.logger.info('Database connection closed', 'DatabaseService');
                    }
                    resolve();
                });
            });
        }
    }
}

/**
 * Setup and configure all services with proper dependency injection
 * 
 * CLEAN ARCHITECTURE: This function implements the Composition Root pattern,
 * where all dependencies are wired together at the application's entry point
 */
async function setupServices(config = {}) {
    const serviceFactory = new ServiceFactory();

    try {
        console.log('🏗️  Setting up Aria AI service architecture...');

        // ===== FOUNDATION LAYER =====
        // These services have no dependencies and form the foundation

        // Logger Service - Must be first (no dependencies)
        serviceFactory.registerService('logger', LoggerService, [], {
            dateFormat: config.dateFormat || 'ISO',
            includeMetadata: config.includeMetadata !== false
        });

        // Error Handling Service - Depends only on logger
        serviceFactory.registerService('errorHandling', ErrorHandlingService, ['logger'], {
            maxContextSize: config.maxContextSize || 1000,
            includeStackTrace: config.includeStackTrace !== false
        });

        // Configuration Service - Depends on logger and error handling
        serviceFactory.registerService('configuration', ConfigurationService, ['logger', 'errorHandling'], {
            autoSave: config.autoSave !== false,
            createMissingDirectories: config.createMissingDirectories !== false
        });

        // ===== INFRASTRUCTURE LAYER =====
        // Database and data access services

        // Database Service - Depends on foundation services (unified database)
        serviceFactory.registerService('database', DatabaseService, ['logger', 'errorHandling'], {
            dbPath: config.dbPath || path.join(__dirname, 'database', 'aria.db')
        });

        // LLM Configuration Service - Manages LLM model configuration and cascading preferences
        serviceFactory.registerService('llmConfig', LLMConfigService, [
            'database',
            'logger',
            'errorHandling',
            'configuration'
        ]);

        // Auth Service - User authentication and session management
        serviceFactory.registerService('auth', AuthService, [
            'database',
            'logger',
            'errorHandling'
        ]);

        // ===== INTELLIGENCE LAYER =====
        // LLM and AI processing services

        // LLM Service - Core AI communication
        serviceFactory.registerService('llm', LLMService, ['logger', 'errorHandling', 'configuration', 'llmConfig']);

        // Structured Response Service - JSON processing with LLM
        serviceFactory.registerService('structuredResponse', StructuredResponseService, ['llm', 'logger', 'errorHandling']);

        // ===== INFRASTRUCTURE LAYER (CONTINUED) =====
        // Real-time communication services

        // Message Delivery Service - WebSocket connection management and message delivery
        serviceFactory.registerService('messageDelivery', MessageDeliveryService, [
            'database',
            'logger',
            'errorHandling'
        ]);

        // Scheduling Service - Background polling for scheduled proactive messages
        serviceFactory.registerService('scheduling', SchedulingService, [
            'database',
            'logger',
            'errorHandling',
            'messageDelivery'
        ]);

        // Event Scheduler Service - Polls and triggers scheduled events
        serviceFactory.registerService('eventScheduler', EventSchedulerService, [
            'database',
            'logger',
            'errorHandling',
            'proactiveIntelligence'
        ]);

        // ===== DOMAIN LAYER =====
        // Business logic and domain-specific services

        // Psychology Service - Character psychology and behavior
        serviceFactory.registerService('psychology', PsychologyService, [
            'database', 'logger', 'errorHandling', 'structuredResponse'
        ]);

        // Task Verification Service - AI-driven commitment verification
        serviceFactory.registerService('taskVerification', TaskVerificationService, [
            'database', 'logger', 'errorHandling', 'structuredResponse', 'psychology'
        ]);

        // Conversation Analyzer - Conversation flow and context analysis
        serviceFactory.registerService('conversationAnalyzer', ConversationAnalyzer, [
            'structuredResponse', 'logger', 'errorHandling'
        ]);

        // Proactive Intelligence Service - AI-driven proactive behavior
        serviceFactory.registerService('proactiveIntelligence', ProactiveIntelligenceService, [
            'structuredResponse', 'psychology', 'database', 'logger', 'errorHandling'
        ]);

        // Proactive Learning Service - Learning from proactive interactions
        serviceFactory.registerService('proactiveLearning', ProactiveLearningService, [
            'database', 'structuredResponse', 'logger', 'errorHandling'
        ]);

        // Proactive Delivery Service - Handles actual delivery of proactive messages
        serviceFactory.registerService('proactiveDelivery', ProactiveDeliveryService, [
            'database', 'proactiveIntelligence', 'proactiveLearning', 'logger', 'errorHandling'
        ]);

        // Background Analysis Service - Handles all post-message background processing
        serviceFactory.registerService('backgroundAnalysis', BackgroundAnalysisService, [
            'database', 'logger', 'psychology', 'conversationAnalyzer', 'proactiveIntelligence', 
            'proactiveDelivery', 'proactiveLearning', 'configuration'
        ]);

        // Context Builder Service - Builds unified context for LLM conversations
        serviceFactory.registerService('contextBuilder', ContextBuilderService, [
            'database', 'logger', 'errorHandling', 'llmConfig', 'psychology'
        ]);

        // Memory Search Service - Intelligent deep memory search with LLM-based intent analysis
        serviceFactory.registerService('memorySearch', MemorySearchService, [
            'database', 'logger', 'errorHandling', 'structuredResponse'
        ]);

        // ===== INITIALIZE ALL SERVICES =====
        console.log('🚀 Initializing all services in dependency order...');
        
        await serviceFactory.initializeServices(config);

        console.log('✅ Service setup completed successfully');
        console.log(`📊 Initialized ${serviceFactory.getServiceNames().length} services:`);
        console.log(`   ${serviceFactory.getServiceNames().join(', ')}`);

        return serviceFactory;

    } catch (error) {
        console.error('❌ Service setup failed:', error.message);
        console.error('Stack trace:', error.stack);
        
        // Attempt graceful cleanup
        try {
            await serviceFactory.shutdown();
        } catch (shutdownError) {
            console.error('❌ Cleanup failed:', shutdownError.message);
        }
        
        throw error;
    }
}

/**
 * Create a simple database service factory for testing
 * Useful for unit tests and development scenarios
 */
async function createTestServices(config = {}) {
    const testConfig = {
        dbPath: ':memory:', // In-memory database for testing
        includeMetadata: false,
        ...config
    };

    return await setupServices(testConfig);
}

/**
 * Graceful shutdown of all services
 * Call this during application shutdown
 */
async function shutdownServices(serviceFactory) {
    if (!serviceFactory) {
        console.log('⚠️  No service factory provided for shutdown');
        return;
    }

    try {
        console.log('🔄 Starting graceful service shutdown...');
        await serviceFactory.shutdown();
        console.log('✅ All services shut down successfully');
    } catch (error) {
        console.error('❌ Service shutdown failed:', error.message);
        throw error;
    }
}

/**
 * Health check for all services
 * Returns comprehensive health status
 */
async function checkServicesHealth(serviceFactory) {
    if (!serviceFactory || !serviceFactory.initialized) {
        return {
            healthy: false,
            error: 'Service factory not initialized'
        };
    }

    try {
        const healthResults = await serviceFactory.checkAllServicesHealth();
        const unhealthyServices = Array.from(healthResults.entries())
            .filter(([, health]) => !health.healthy)
            .map(([name]) => name);

        return {
            healthy: unhealthyServices.length === 0,
            totalServices: healthResults.size,
            healthyServices: healthResults.size - unhealthyServices.length,
            unhealthyServices,
            details: Object.fromEntries(healthResults)
        };
    } catch (error) {
        return {
            healthy: false,
            error: error.message
        };
    }
}

/**
 * Get service metrics for monitoring
 */
function getServiceMetrics(serviceFactory) {
    if (!serviceFactory || !serviceFactory.initialized) {
        return null;
    }

    return serviceFactory.getSystemMetrics();
}

// Export the main functions
module.exports = {
    setupServices,
    createTestServices,
    shutdownServices,
    checkServicesHealth,
    getServiceMetrics,
    
    // Export service factory class for advanced usage
    ServiceFactory,
    
    // Export database service for direct access if needed
    DatabaseService
};

// For direct execution (development/testing)
if (require.main === module) {
    (async () => {
        try {
            console.log('🧪 Running setupServices in development mode...');
            
            const serviceFactory = await setupServices({
                dbPath: path.join(__dirname, 'database', 'aria.db'),
                includeMetadata: true
            });
            
            // Run health check
            const health = await checkServicesHealth(serviceFactory);
            console.log('🏥 Health check results:', JSON.stringify(health, null, 2));
            
            // Get metrics
            const metrics = getServiceMetrics(serviceFactory);
            console.log('📊 Service metrics:', JSON.stringify(metrics, null, 2));
            
            // Keep running for a few seconds to test
            setTimeout(async () => {
                await shutdownServices(serviceFactory);
                process.exit(0);
            }, 5000);
            
        } catch (error) {
            console.error('❌ Development mode failed:', error.message);
            process.exit(1);
        }
    })();
}
