const AbstractService = require('../base/AbstractService');

/**
 * Error Handling Service Foundation
 * 
 * CLEAN ARCHITECTURE DESIGN:
 * - Single Responsibility: Centralized error wrapping and enhancement
 * - Dependency Injection: Logger service injected through constructor
 * - Layer Separation: Different error types for each architectural layer
 * - Template Method Pattern: Follows AbstractService lifecycle
 * 
 * This service provides structured error wrapping for different architectural layers:
 * - Domain Layer: Business logic errors
 * - Application Layer: Use case and service orchestration errors
 * - Infrastructure Layer: External system and framework errors
 * - Repository Layer: Data access and persistence errors
 * 
 * Each wrapped error includes:
 * - Enhanced message with layer context
 * - Original error preservation
 * - Additional context metadata
 * - Layer identification
 * - Timestamp for debugging
 */
class ErrorHandlingService extends AbstractService {
    constructor(dependencies = {}) {
        super('ErrorHandlingService', dependencies);
        
        // CLEAN ARCHITECTURE: Dependency injection
        this.logger = dependencies.logger;
        
        // CLEAN ARCHITECTURE: Service-specific configuration
        this.maxContextSize = dependencies.maxContextSize || 1000;
        this.includeStackTrace = dependencies.includeStackTrace !== false;
    }

    /**
     * TEMPLATE METHOD: Initialize the error handling service
     */
    async onInitialize() {
        // CLEAN ARCHITECTURE: Validate required dependencies
        this.validateDependencies(['logger']);
        
        // CLEAN ARCHITECTURE: Log service initialization
        if (this.logger) {
            this.logger.info('Error handling service initialized', 'ErrorHandlingService', {
                maxContextSize: this.maxContextSize,
                includeStackTrace: this.includeStackTrace
            });
        }
    }

    /**
     * SINGLE RESPONSIBILITY: Sanitize context to prevent oversized error objects
     */
    _sanitizeContext(context) {
        if (!context || typeof context !== 'object') {
            return {};
        }

        try {
            const serialized = JSON.stringify(context);
            if (serialized.length > this.maxContextSize) {
                return {
                    _truncated: true,
                    _originalSize: serialized.length,
                    _maxSize: this.maxContextSize,
                    summary: 'Context truncated due to size limit'
                };
            }
            return context;
        } catch (error) {
            return {
                _serializationError: true,
                error: error.message,
                summary: 'Context could not be serialized'
            };
        }
    }

    /**
     * SINGLE RESPONSIBILITY: Create enhanced error with consistent structure
     */
    _createEnhancedError(originalError, message, context, layer) {
        // CLEAN ARCHITECTURE: Ensure we have an Error object
        const baseError = originalError instanceof Error ? originalError : new Error(String(originalError));
        
        // CLEAN ARCHITECTURE: Create enhanced message with layer context
        const enhancedMessage = `[${layer.toUpperCase()}] ${message}: ${baseError.message}`;
        
        // CLEAN ARCHITECTURE: Create new error with enhanced information
        const enhancedError = new Error(enhancedMessage);
        
        // CLEAN ARCHITECTURE: Preserve original error information
        enhancedError.originalError = baseError;
        enhancedError.context = this._sanitizeContext(context);
        enhancedError.layer = layer;
        enhancedError.timestamp = new Date().toISOString();
        
        // CLEAN ARCHITECTURE: Preserve stack trace if enabled
        if (this.includeStackTrace) {
            enhancedError.originalStack = baseError.stack;
            enhancedError.stack = `${enhancedError.stack}\n\nOriginal Error Stack:\n${baseError.stack}`;
        }
        
        // CLEAN ARCHITECTURE: Add error metadata
        enhancedError.errorId = this._generateErrorId();
        enhancedError.serviceName = this.name;
        
        return enhancedError;
    }

    /**
     * SINGLE RESPONSIBILITY: Generate unique error identifier
     */
    _generateErrorId() {
        return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * CLEAN ARCHITECTURE: Domain layer error wrapping
     * For business logic and domain rule violations
     */
    wrapDomainError(error, message, context = {}) {
        const enhancedError = this._createEnhancedError(error, message, context, 'domain');
        
        // CLEAN ARCHITECTURE: Log domain errors for business intelligence
        if (this.logger) {
            this.logger.error('Domain error occurred', 'ErrorHandlingService', {
                errorId: enhancedError.errorId,
                originalMessage: error.message,
                enhancedMessage: message,
                context: enhancedError.context,
                layer: 'domain'
            });
        }
        
        // CLEAN ARCHITECTURE: Track metrics for domain errors
        this.metrics.lastOperationTime = Date.now();
        const currentCount = this.metrics.operationCounts.get('domainError') || 0;
        this.metrics.operationCounts.set('domainError', currentCount + 1);
        
        return enhancedError;
    }

    /**
     * CLEAN ARCHITECTURE: Application layer error wrapping
     * For use case orchestration and service coordination errors
     */
    wrapApplicationError(error, message, context = {}) {
        const enhancedError = this._createEnhancedError(error, message, context, 'application');
        
        // CLEAN ARCHITECTURE: Log application errors for service monitoring
        if (this.logger) {
            this.logger.error('Application error occurred', 'ErrorHandlingService', {
                errorId: enhancedError.errorId,
                originalMessage: error.message,
                enhancedMessage: message,
                context: enhancedError.context,
                layer: 'application'
            });
        }
        
        // CLEAN ARCHITECTURE: Track metrics for application errors
        this.metrics.lastOperationTime = Date.now();
        const currentCount = this.metrics.operationCounts.get('applicationError') || 0;
        this.metrics.operationCounts.set('applicationError', currentCount + 1);
        
        return enhancedError;
    }

    /**
     * CLEAN ARCHITECTURE: Infrastructure layer error wrapping
     * For external system, network, and framework errors
     */
    wrapInfrastructureError(error, message, context = {}) {
        const enhancedError = this._createEnhancedError(error, message, context, 'infrastructure');
        
        // CLEAN ARCHITECTURE: Log infrastructure errors for system monitoring
        if (this.logger) {
            this.logger.error('Infrastructure error occurred', 'ErrorHandlingService', {
                errorId: enhancedError.errorId,
                originalMessage: error.message,
                enhancedMessage: message,
                context: enhancedError.context,
                layer: 'infrastructure'
            });
        }
        
        // CLEAN ARCHITECTURE: Track metrics for infrastructure errors
        this.metrics.lastOperationTime = Date.now();
        const currentCount = this.metrics.operationCounts.get('infrastructureError') || 0;
        this.metrics.operationCounts.set('infrastructureError', currentCount + 1);
        
        return enhancedError;
    }

    /**
     * CLEAN ARCHITECTURE: Repository layer error wrapping
     * For data access, persistence, and database errors
     */
    wrapRepositoryError(error, message, context = {}) {
        const enhancedError = this._createEnhancedError(error, message, context, 'repository');
        
        // CLEAN ARCHITECTURE: Log repository errors for data layer monitoring
        if (this.logger) {
            this.logger.error('Repository error occurred', 'ErrorHandlingService', {
                errorId: enhancedError.errorId,
                originalMessage: error.message,
                enhancedMessage: message,
                context: enhancedError.context,
                layer: 'repository'
            });
        }
        
        // CLEAN ARCHITECTURE: Track metrics for repository errors
        this.metrics.lastOperationTime = Date.now();
        const currentCount = this.metrics.operationCounts.get('repositoryError') || 0;
        this.metrics.operationCounts.set('repositoryError', currentCount + 1);
        
        return enhancedError;
    }

    /**
     * TEMPLATE METHOD: Custom health check for error handling service
     */
    async onHealthCheck() {
        const errorCounts = {
            domain: this.metrics.operationCounts.get('domainError') || 0,
            application: this.metrics.operationCounts.get('applicationError') || 0,
            infrastructure: this.metrics.operationCounts.get('infrastructureError') || 0,
            repository: this.metrics.operationCounts.get('repositoryError') || 0
        };

        const totalErrors = Object.values(errorCounts).reduce((sum, count) => sum + count, 0);

        return {
            healthy: this.initialized,
            details: {
                state: this.state,
                totalErrorsHandled: totalErrors,
                errorsByLayer: errorCounts,
                maxContextSize: this.maxContextSize,
                includeStackTrace: this.includeStackTrace,
                hasLogger: !!this.logger
            }
        };
    }

    /**
     * TEMPLATE METHOD: Custom shutdown logic
     */
    async onShutdown() {
        if (this.logger) {
            const errorCounts = {
                domain: this.metrics.operationCounts.get('domainError') || 0,
                application: this.metrics.operationCounts.get('applicationError') || 0,
                infrastructure: this.metrics.operationCounts.get('infrastructureError') || 0,
                repository: this.metrics.operationCounts.get('repositoryError') || 0
            };

            const totalErrors = Object.values(errorCounts).reduce((sum, count) => sum + count, 0);

            this.logger.info('Error handling service shutting down', 'ErrorHandlingService', {
                totalErrorsHandled: totalErrors,
                errorsByLayer: errorCounts,
                uptime: Date.now() - this.metrics.startTime
            });
        }
    }
}

module.exports = ErrorHandlingService;
