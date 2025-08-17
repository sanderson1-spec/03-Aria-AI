const AbstractService = require('../base/AbstractService');

/**
 * Logger Service Foundation
 * 
 * CLEAN ARCHITECTURE DESIGN:
 * - Single Responsibility: Centralized logging functionality
 * - Dependency Injection: Configurable through constructor dependencies
 * - Template Method Pattern: Follows AbstractService lifecycle
 * - Separation of Concerns: Only service allowed to use console.* methods
 * 
 * This service provides structured logging with consistent formatting:
 * Format: "[TIMESTAMP] [LEVEL] [CONTEXT] message {metadata}"
 * 
 * Logging Levels:
 * - info: General information (console.log)
 * - debug: Debug information (console.log) 
 * - warn: Warning messages (console.warn)
 * - error: Error messages (console.error)
 */
class LoggerService extends AbstractService {
    constructor(dependencies = {}) {
        super('LoggerService', dependencies);
        
        // CLEAN ARCHITECTURE: Service-specific configuration
        this.dateFormat = dependencies.dateFormat || 'ISO';
        this.includeMetadata = dependencies.includeMetadata !== false;
    }

    /**
     * TEMPLATE METHOD: Initialize the logger service
     */
    async onInitialize() {
        // CLEAN ARCHITECTURE: No external dependencies to initialize
        // Logger service is self-contained and ready to use immediately
        
        // Log service startup
        this.info('Logger service initialized', 'LoggerService', { 
            dateFormat: this.dateFormat,
            includeMetadata: this.includeMetadata
        });
    }

    /**
     * SINGLE RESPONSIBILITY: Format timestamp consistently
     */
    _formatTimestamp() {
        return new Date().toISOString();
    }

    /**
     * SINGLE RESPONSIBILITY: Format metadata for display
     */
    _formatMetadata(metadata) {
        if (!this.includeMetadata || !metadata || Object.keys(metadata).length === 0) {
            return '';
        }
        
        try {
            return ` {${JSON.stringify(metadata)}}`;
        } catch (error) {
            return ` {metadata_serialization_error: ${error.message}}`;
        }
    }

    /**
     * SINGLE RESPONSIBILITY: Create formatted log message
     */
    _formatMessage(level, message, context, metadata) {
        const timestamp = this._formatTimestamp();
        const contextStr = context ? `[${context}]` : '[GENERAL]';
        const metadataStr = this._formatMetadata(metadata);
        
        return `[${timestamp}] [${level.toUpperCase()}] ${contextStr} ${message}${metadataStr}`;
    }

    /**
     * CLEAN ARCHITECTURE: Info level logging
     * Uses console.log for information and debug messages
     */
    info(message, context = '', metadata = {}) {
        const formattedMessage = this._formatMessage('info', message, context, metadata);
        console.log(formattedMessage);
        
        // CLEAN ARCHITECTURE: Track metrics for this operation
        this.metrics.lastOperationTime = Date.now();
        const currentCount = this.metrics.operationCounts.get('info') || 0;
        this.metrics.operationCounts.set('info', currentCount + 1);
    }

    /**
     * CLEAN ARCHITECTURE: Debug level logging  
     * Uses console.log for information and debug messages
     */
    debug(message, context = '', metadata = {}) {
        const formattedMessage = this._formatMessage('debug', message, context, metadata);
        console.log(formattedMessage);
        
        // CLEAN ARCHITECTURE: Track metrics for this operation
        this.metrics.lastOperationTime = Date.now();
        const currentCount = this.metrics.operationCounts.get('debug') || 0;
        this.metrics.operationCounts.set('debug', currentCount + 1);
    }

    /**
     * CLEAN ARCHITECTURE: Warning level logging
     * Uses console.warn for warning messages
     */
    warn(message, context = '', metadata = {}) {
        const formattedMessage = this._formatMessage('warn', message, context, metadata);
        console.warn(formattedMessage);
        
        // CLEAN ARCHITECTURE: Track metrics for this operation
        this.metrics.lastOperationTime = Date.now();
        const currentCount = this.metrics.operationCounts.get('warn') || 0;
        this.metrics.operationCounts.set('warn', currentCount + 1);
    }

    /**
     * CLEAN ARCHITECTURE: Error level logging
     * Uses console.error for error messages
     */
    error(message, context = '', metadata = {}) {
        const formattedMessage = this._formatMessage('error', message, context, metadata);
        console.error(formattedMessage);
        
        // CLEAN ARCHITECTURE: Track metrics for this operation
        this.metrics.lastOperationTime = Date.now();
        const currentCount = this.metrics.operationCounts.get('error') || 0;
        this.metrics.operationCounts.set('error', currentCount + 1);
    }

    /**
     * TEMPLATE METHOD: Custom health check for logger service
     */
    async onHealthCheck() {
        return {
            healthy: this.initialized,
            details: {
                state: this.state,
                totalLogs: Array.from(this.metrics.operationCounts.values()).reduce((sum, count) => sum + count, 0),
                logBreakdown: Object.fromEntries(this.metrics.operationCounts),
                dateFormat: this.dateFormat,
                includeMetadata: this.includeMetadata
            }
        };
    }

    /**
     * TEMPLATE METHOD: Custom shutdown logic
     */
    async onShutdown() {
        this.info('Logger service shutting down', 'LoggerService', {
            totalLogs: Array.from(this.metrics.operationCounts.values()).reduce((sum, count) => sum + count, 0),
            uptime: Date.now() - this.metrics.startTime
        });
    }
}

module.exports = LoggerService;
