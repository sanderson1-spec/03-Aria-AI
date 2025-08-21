const EventEmitter = require('events');

/**
 * Abstract Service Foundation
 * 
 * CLEAN ARCHITECTURE DESIGN:
 * - Template Method Pattern: Standardized lifecycle with customizable hooks
 * - Dependency Injection: All services receive dependencies through constructor
 * - Error Handling: Centralized error handling with context and metrics
 * - Health Monitoring: Built-in health checking capabilities
 * - Metrics Collection: Performance monitoring with operation wrapping
 * 
 * All services in the system must extend this abstract class to ensure:
 * - Consistent initialization patterns
 * - Standardized error handling
 * - Metrics collection and health monitoring
 * - Proper service lifecycle management
 * - Graceful shutdown handling
 */
class AbstractService extends EventEmitter {
    constructor(name, dependencies = {}) {
        super();
        
        if (this.constructor === AbstractService) {
            throw new Error('AbstractService is an abstract class and cannot be instantiated directly');
        }
        
        // CLEAN ARCHITECTURE: Service identification and dependency injection
        this.name = name;
        this.dependencies = dependencies;
        
        // CLEAN ARCHITECTURE: Service lifecycle state management
        this.state = 'created';
        this.initialized = false;
        this.healthy = false;
        this.lastHealthCheck = null;
        
        // CLEAN ARCHITECTURE: Metrics and monitoring
        this.metrics = {
            operationCounts: new Map(),
            operationTimes: new Map(),
            errorCounts: new Map(),
            lastOperationTime: Date.now(),
            startTime: Date.now()
        };
        
        // CLEAN ARCHITECTURE: Error handling configuration
        this.errorContext = {
            serviceName: name,
            errors: [],
            maxErrorHistory: 100
        };
        
        console.log(`🏗️  [${this.name}] Service created`);
    }

    /**
     * TEMPLATE METHOD PATTERN: Standardized initialization flow
     * This method orchestrates the initialization sequence and should NOT be overridden
     */
    async initialize() {
        if (this.initialized) {
            console.log(`⚠️  Service '${this.name}' already initialized`);
            return;
        }

        try {
            this.state = 'initializing';
            console.log(`🚀 Initializing service: ${this.name}`);

            // TEMPLATE METHOD: Pre-initialization hook
            await this.onBeforeInitialize();

            // TEMPLATE METHOD: Main initialization logic (implemented by subclasses)
            await this.onInitialize();

            // TEMPLATE METHOD: Post-initialization hook
            await this.onAfterInitialize();

            // CLEAN ARCHITECTURE: Mark as initialized and healthy
            this.initialized = true;
            this.healthy = true;
            this.state = 'running';
            this.lastHealthCheck = Date.now();

            console.log(`✅ Service '${this.name}' initialized successfully`);
            this.emit('initialized');

        } catch (error) {
            this.state = 'failed';
            this.healthy = false;
            this.recordError(error);
            
            console.error(`❌ Service '${this.name}' initialization failed:`, error.message);
            this.emit('initializationFailed', error);
            
            throw error;
        }
    }

    /**
     * TEMPLATE METHOD: Pre-initialization hook (override in subclasses if needed)
     */
    async onBeforeInitialize() {
        // Default implementation - can be overridden
    }

    /**
     * TEMPLATE METHOD: Main initialization logic (MUST be implemented by subclasses)
     */
    async onInitialize() {
        throw new Error(`Service '${this.name}' must implement onInitialize() method`);
    }

    /**
     * TEMPLATE METHOD: Post-initialization hook (override in subclasses if needed)
     */
    async onAfterInitialize() {
        // Default implementation - can be overridden
    }

    /**
     * CLEAN ARCHITECTURE: Health checking with customizable logic
     */
    async checkHealth() {
        try {
            this.lastHealthCheck = Date.now();
            
            // TEMPLATE METHOD: Custom health checking logic (override in subclasses)
            const healthStatus = await this.onHealthCheck();
            
            this.healthy = healthStatus.healthy;
            return {
                service: this.name,
                healthy: this.healthy,
                status: this.state,
                initialized: this.initialized,
                lastHealthCheck: this.lastHealthCheck,
                uptime: Date.now() - this.metrics.startTime,
                ...healthStatus
            };
            
        } catch (error) {
            this.healthy = false;
            this.recordError(error);
            
            return {
                service: this.name,
                healthy: false,
                status: 'error',
                error: error.message,
                lastHealthCheck: this.lastHealthCheck
            };
        }
    }

    /**
     * TEMPLATE METHOD: Custom health checking logic (override in subclasses)
     */
    async onHealthCheck() {
        // Default implementation - service is healthy if initialized
        return {
            healthy: this.initialized,
            details: {
                state: this.state,
                operationsCount: this.metrics.operationCounts.size,
                errorsCount: this.errorContext.errors.length
            }
        };
    }

    /**
     * CLEAN ARCHITECTURE: Graceful shutdown with cleanup
     */
    async shutdown() {
        try {
            console.log(`🔄 Shutting down service: ${this.name}`);
            this.state = 'shutting_down';

            // TEMPLATE METHOD: Custom shutdown logic (override in subclasses)
            await this.onShutdown();

            this.state = 'shutdown';
            this.healthy = false;
            this.initialized = false;

            console.log(`✅ Service '${this.name}' shutdown completed`);
            this.emit('shutdown');

        } catch (error) {
            console.error(`❌ Service '${this.name}' shutdown failed:`, error.message);
            this.recordError(error);
            throw error;
        }
    }

    /**
     * TEMPLATE METHOD: Custom shutdown logic (override in subclasses if needed)
     */
    async onShutdown() {
        // Default implementation - can be overridden
    }

    /**
     * CLEAN ARCHITECTURE: Performance monitoring wrapper
     * Wraps operations with timing and error tracking
     */
    async withMetrics(operation, operationName = 'unknown') {
        const startTime = Date.now();
        
        try {
            // Update operation count
            const currentCount = this.metrics.operationCounts.get(operationName) || 0;
            this.metrics.operationCounts.set(operationName, currentCount + 1);
            
            // Execute operation
            const result = await operation();
            
            // Record successful operation time
            const duration = Date.now() - startTime;
            this.recordOperationTime(operationName, duration);
            this.metrics.lastOperationTime = Date.now();
            
            return result;
            
        } catch (error) {
            // Record error
            this.recordError(error, operationName);
            
            // Record failed operation time
            const duration = Date.now() - startTime;
            this.recordOperationTime(operationName, duration);
            
            throw error;
        }
    }

    /**
     * CLEAN ARCHITECTURE: Error recording with context
     */
    recordError(error, context = null) {
        const errorRecord = {
            timestamp: Date.now(),
            error: error.message,
            stack: error.stack,
            context: context || 'general',
            service: this.name
        };

        // Add to error history (with size limit)
        this.errorContext.errors.push(errorRecord);
        if (this.errorContext.errors.length > this.errorContext.maxErrorHistory) {
            this.errorContext.errors.shift();
        }

        // Update error count for this context
        const currentCount = this.metrics.errorCounts.get(context || 'general') || 0;
        this.metrics.errorCounts.set(context || 'general', currentCount + 1);

        // Emit error event
        this.emit('error', errorRecord);
    }

    /**
     * CLEAN ARCHITECTURE: Operation time recording
     */
    recordOperationTime(operationName, duration) {
        const times = this.metrics.operationTimes.get(operationName) || [];
        times.push(duration);
        
        // Keep only last 100 measurements for average calculation
        if (times.length > 100) {
            times.shift();
        }
        
        this.metrics.operationTimes.set(operationName, times);
    }

    /**
     * CLEAN ARCHITECTURE: Get service metrics
     */
    getMetrics() {
        const operationAverages = new Map();
        
        // Calculate averages
        for (const [operationName, times] of this.metrics.operationTimes.entries()) {
            const average = times.reduce((sum, time) => sum + time, 0) / times.length;
            operationAverages.set(operationName, Math.round(average));
        }

        return {
            service: this.name,
            uptime: Date.now() - this.metrics.startTime,
            operationCounts: Object.fromEntries(this.metrics.operationCounts),
            operationAverages: Object.fromEntries(operationAverages),
            errorCounts: Object.fromEntries(this.metrics.errorCounts),
            totalErrors: this.errorContext.errors.length,
            lastOperationTime: this.metrics.lastOperationTime,
            state: this.state,
            healthy: this.healthy
        };
    }

    /**
     * CLEAN ARCHITECTURE: Get recent errors
     */
    getRecentErrors(limit = 10) {
        return this.errorContext.errors
            .slice(-limit)
            .reverse(); // Most recent first
    }

    /**
     * CLEAN ARCHITECTURE: Clear metrics (useful for testing)
     */
    clearMetrics() {
        this.metrics.operationCounts.clear();
        this.metrics.operationTimes.clear();
        this.metrics.errorCounts.clear();
        this.errorContext.errors = [];
    }

    /**
     * CLEAN ARCHITECTURE: Get service information
     */
    getServiceInfo() {
        return {
            name: this.name,
            state: this.state,
            initialized: this.initialized,
            healthy: this.healthy,
            dependencies: Object.keys(this.dependencies),
            lastHealthCheck: this.lastHealthCheck
        };
    }

    /**
     * CLEAN ARCHITECTURE: Check if service is ready for operations
     */
    isReady() {
        return this.initialized && this.healthy && this.state === 'running';
    }

    /**
     * CLEAN ARCHITECTURE: Validate dependencies
     */
    validateDependencies(requiredDependencies = []) {
        const missing = requiredDependencies.filter(dep => !this.dependencies[dep]);
        
        if (missing.length > 0) {
            throw new Error(`Service '${this.name}' missing required dependencies: ${missing.join(', ')}`);
        }
    }
}

module.exports = AbstractService;