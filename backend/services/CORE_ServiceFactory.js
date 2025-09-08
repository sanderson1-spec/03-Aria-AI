/**
 * Service Factory - Centralized Service Management
 * 
 * CLEAN ARCHITECTURE DESIGN:
 * - Dependency Injection Container: Manages service dependencies and lifecycle
 * - Service Registry: Centralized service registration and discovery
 * - Lifecycle Management: Coordinated initialization and shutdown
 * - Health Monitoring: Global health checking across all services
 * - Configuration Integration: Unified configuration management
 * 
 * This factory provides:
 * - Service registration with dependency mapping
 * - Lazy initialization of services in proper dependency order
 * - Centralized service discovery and access
 * - Global health checking and monitoring
 * - Coordinated graceful shutdown
 * - Service lifecycle event management
 */
class ServiceFactory {
    constructor() {
        // CLEAN ARCHITECTURE: Service registry and dependency management
        this.services = new Map();
        this.serviceConfigs = new Map();
        this.initializationOrder = [];
        this.initialized = false;
        
        // CLEAN ARCHITECTURE: Service lifecycle state
        this.lifecycleState = 'created';
        this.initializationPromises = new Map();
        
        // CLEAN ARCHITECTURE: Health monitoring
        this.healthCheckInterval = null;
        this.healthStatus = new Map();
        
        // CLEAN ARCHITECTURE: Event handling
        this.eventListeners = new Map();
        
        console.log('🏭 ServiceFactory created');
    }

    /**
     * CLEAN ARCHITECTURE: Register a service with its dependencies
     * This method defines services and their dependency relationships
     */
    registerService(name, serviceClass, dependencies = [], config = {}) {
        if (this.initialized) {
            throw new Error('Cannot register services after initialization');
        }
        
        if (this.serviceConfigs.has(name)) {
            throw new Error(`Service '${name}' is already registered`);
        }
        
        // CLEAN ARCHITECTURE: Store service configuration
        this.serviceConfigs.set(name, {
            name,
            serviceClass,
            dependencies,
            config,
            instance: null,
            initialized: false,
            healthy: false
        });
        
        console.log(`📝 Registered service '${name}' with dependencies: [${dependencies.join(', ')}]`);
        
        return this;
    }

    /**
     * CLEAN ARCHITECTURE: Initialize all services in dependency order
     * Template method that orchestrates the entire initialization process
     */
    async initializeServices(globalConfig = {}) {
        if (this.initialized) {
            console.log('⚠️  Services already initialized');
            return;
        }
        
        try {
            this.lifecycleState = 'initializing';
            console.log('🚀 Starting service initialization...');
            
            // CLEAN ARCHITECTURE: Calculate initialization order based on dependencies
            this.calculateInitializationOrder();
            
            // CLEAN ARCHITECTURE: Initialize services in proper order
            await this.initializeServicesInOrder(globalConfig);
            
            // CLEAN ARCHITECTURE: Setup health monitoring
            await this.setupHealthMonitoring();
            
            // CLEAN ARCHITECTURE: Setup event listeners
            this.setupEventListeners();
            
            this.initialized = true;
            this.lifecycleState = 'running';
            
            console.log('✅ All services initialized successfully');
            this.emitEvent('servicesInitialized');
            
        } catch (error) {
            this.lifecycleState = 'failed';
            console.error('❌ Service initialization failed:', error.message);
            this.emitEvent('initializationFailed', error);
            throw error;
        }
    }

    /**
     * CLEAN ARCHITECTURE: Calculate proper initialization order using topological sort
     */
    calculateInitializationOrder() {
        const visited = new Set();
        const visiting = new Set();
        const order = [];

        const visit = (serviceName) => {
            if (visiting.has(serviceName)) {
                throw new Error(`Circular dependency detected involving service '${serviceName}'`);
            }
            
            if (visited.has(serviceName)) {
                return;
            }

            visiting.add(serviceName);
            
            const serviceConfig = this.serviceConfigs.get(serviceName);
            if (serviceConfig) {
                // Visit all dependencies first
                for (const dependency of serviceConfig.dependencies) {
                    visit(dependency);
                }
            }
            
            visiting.delete(serviceName);
            visited.add(serviceName);
            order.push(serviceName);
        };

        // Visit all services
        for (const serviceName of this.serviceConfigs.keys()) {
            visit(serviceName);
        }

        this.initializationOrder = order;
        console.log(`📋 Calculated initialization order: [${order.join(' → ')}]`);
    }

    /**
     * CLEAN ARCHITECTURE: Initialize services in calculated order
     */
    async initializeServicesInOrder(globalConfig) {
        for (const serviceName of this.initializationOrder) {
            await this.initializeService(serviceName, globalConfig);
        }
    }

    /**
     * CLEAN ARCHITECTURE: Initialize a single service with proper dependency injection
     */
    async initializeService(serviceName, globalConfig = {}) {
        const serviceConfig = this.serviceConfigs.get(serviceName);
        if (!serviceConfig) {
            throw new Error(`Service '${serviceName}' not found in registry`);
        }

        if (serviceConfig.initialized) {
            return serviceConfig.instance;
        }

        // Check for existing initialization promise (prevents duplicate initialization)
        if (this.initializationPromises.has(serviceName)) {
            return await this.initializationPromises.get(serviceName);
        }

        const initializationPromise = this.createServiceInstance(serviceName, serviceConfig, globalConfig);
        this.initializationPromises.set(serviceName, initializationPromise);

        try {
            const serviceInstance = await initializationPromise;
            this.initializationPromises.delete(serviceName);
            return serviceInstance;
        } catch (error) {
            this.initializationPromises.delete(serviceName);
            throw error;
        }
    }

    /**
     * CLEAN ARCHITECTURE: Create and initialize service instance
     */
    async createServiceInstance(serviceName, serviceConfig, globalConfig) {
        console.log(`🔧 Initializing service: ${serviceName}`);

        // CLEAN ARCHITECTURE: Resolve dependencies
        const dependencies = {};
        for (const depName of serviceConfig.dependencies) {
            const depService = await this.initializeService(depName, globalConfig);
            dependencies[depName] = depService;
        }
        
        // CLEAN ARCHITECTURE: Create service instance with dependency injection
        const ServiceClass = serviceConfig.serviceClass;
        const serviceInstance = new ServiceClass(
            ...this.prepareConstructorArguments(serviceConfig, dependencies, globalConfig)
        );
        
        // CLEAN ARCHITECTURE: Initialize the service
        await serviceInstance.initialize();
        
        // CLEAN ARCHITECTURE: Store and mark as initialized
        this.services.set(serviceName, serviceInstance);
        serviceConfig.instance = serviceInstance;
        serviceConfig.initialized = true;
        serviceConfig.healthy = serviceInstance.healthy;
        
        console.log(`✅ Service '${serviceName}' initialized successfully`);
        this.emitEvent('serviceInitialized', serviceName, serviceInstance);
        
        return serviceInstance;
    }

    /**
     * CLEAN ARCHITECTURE: Prepare constructor arguments for dependency injection
     * FIXED: Pass dependencies as a single object to avoid order mismatches
     */
    prepareConstructorArguments(serviceConfig, dependencies, globalConfig) {
        // GENERAL SOLUTION: Pass dependencies as a single object to avoid constructor order issues
        // This allows services to access dependencies by name rather than position
        const args = [dependencies];
        
        // Add any additional config arguments
        if (serviceConfig.config && Object.keys(serviceConfig.config).length > 0) {
            args.push(serviceConfig.config);
        }
        
        return args;
    }

    /**
     * CLEAN ARCHITECTURE: Get service instance (lazy initialization)
     */
    get(serviceName) {
        if (!this.initialized) {
            throw new Error('ServiceFactory not initialized. Call initializeServices() first.');
        }
        
        const service = this.services.get(serviceName);
        if (!service) {
            const availableServices = Array.from(this.services.keys()).join(', ');
            throw new Error(`Service '${serviceName}' not found. Available services: ${availableServices}`);
        }
        
        return service;
    }

    /**
     * CLEAN ARCHITECTURE: Check if service exists
     */
    has(serviceName) {
        return this.services.has(serviceName);
    }

    /**
     * CLEAN ARCHITECTURE: Get all registered service names
     */
    getServiceNames() {
        return Array.from(this.serviceConfigs.keys());
    }

    /**
     * CLEAN ARCHITECTURE: Get service configuration
     */
    getServiceConfig(serviceName) {
        return this.serviceConfigs.get(serviceName);
    }

    /**
     * CLEAN ARCHITECTURE: Global health checking
     */
    async checkAllServicesHealth() {
        const healthResults = new Map();
        
        for (const [serviceName, service] of this.services.entries()) {
            try {
                if (typeof service.checkHealth === 'function') {
                    const health = await service.checkHealth();
                    healthResults.set(serviceName, health);
                    this.healthStatus.set(serviceName, health);
                } else {
                    healthResults.set(serviceName, {
                        service: serviceName,
                        healthy: true,
                        status: 'unknown',
                        note: 'No health check method'
                    });
                }
            } catch (error) {
                const errorHealth = {
                    service: serviceName,
                    healthy: false,
                    status: 'error',
                    error: error.message
                };
                healthResults.set(serviceName, errorHealth);
                this.healthStatus.set(serviceName, errorHealth);
            }
        }
        
        return healthResults;
    }

    /**
     * CLEAN ARCHITECTURE: Setup automated health monitoring
     */
    async setupHealthMonitoring() {
        // Initial health check
        await this.checkAllServicesHealth();
        
        // Setup periodic health checks (every 30 seconds)
        this.healthCheckInterval = setInterval(async () => {
            try {
                await this.checkAllServicesHealth();
            } catch (error) {
                console.error('Health check failed:', error.message);
            }
        }, 30000);
        
        console.log('🏥 Health monitoring setup completed');
    }

    /**
     * CLEAN ARCHITECTURE: Setup event listeners for service events
     */
    setupEventListeners() {
        // Listen for service errors
        for (const [serviceName, service] of this.services.entries()) {
            if (typeof service.on === 'function') {
                service.on('error', (error) => {
                    console.error(`Service '${serviceName}' error:`, error);
                    this.emitEvent('serviceError', serviceName, error);
                });
            }
        }
    }

    /**
     * CLEAN ARCHITECTURE: Event emission
     */
    emitEvent(eventName, ...args) {
        const listeners = this.eventListeners.get(eventName) || [];
        for (const listener of listeners) {
            try {
                listener(...args);
            } catch (error) {
                console.error(`Event listener error for '${eventName}':`, error.message);
            }
        }
    }

    /**
     * CLEAN ARCHITECTURE: Event listener registration
     */
    on(eventName, listener) {
        if (!this.eventListeners.has(eventName)) {
            this.eventListeners.set(eventName, []);
        }
        this.eventListeners.get(eventName).push(listener);
    }

    /**
     * CLEAN ARCHITECTURE: Get system-wide metrics
     */
    getSystemMetrics() {
        const metrics = {
            factory: {
                state: this.lifecycleState,
                initialized: this.initialized,
                registeredServices: this.serviceConfigs.size,
                runningServices: this.services.size
            },
            services: {}
        };

        for (const [serviceName, service] of this.services.entries()) {
            if (typeof service.getMetrics === 'function') {
                metrics.services[serviceName] = service.getMetrics();
            }
        }

        return metrics;
    }

    /**
     * CLEAN ARCHITECTURE: Graceful shutdown of all services
     */
    async shutdown() {
        if (!this.initialized) {
            console.log('⚠️  ServiceFactory not initialized, nothing to shutdown');
            return;
        }

        try {
            this.lifecycleState = 'shutting_down';
            console.log('🔄 Starting graceful shutdown...');

            // Clear health monitoring
            if (this.healthCheckInterval) {
                clearInterval(this.healthCheckInterval);
                this.healthCheckInterval = null;
            }

            // Shutdown services in reverse initialization order
            const shutdownOrder = [...this.initializationOrder].reverse();
            
            for (const serviceName of shutdownOrder) {
                const service = this.services.get(serviceName);
                if (service && typeof service.shutdown === 'function') {
                    try {
                        console.log(`🔄 Shutting down service: ${serviceName}`);
                        await service.shutdown();
                    } catch (error) {
                        console.error(`❌ Failed to shutdown service '${serviceName}':`, error.message);
                    }
                }
            }

            // Clear all state
            this.services.clear();
            this.healthStatus.clear();
            this.initializationPromises.clear();
            
            this.initialized = false;
            this.lifecycleState = 'shutdown';

            console.log('✅ Graceful shutdown completed');
            this.emitEvent('shutdownCompleted');

        } catch (error) {
            this.lifecycleState = 'shutdown_failed';
            console.error('❌ Shutdown failed:', error.message);
            throw error;
        }
    }

    /**
     * CLEAN ARCHITECTURE: Get factory status
     */
    getStatus() {
        return {
            state: this.lifecycleState,
            initialized: this.initialized,
            registeredServices: Array.from(this.serviceConfigs.keys()),
            runningServices: Array.from(this.services.keys()),
            healthStatus: Object.fromEntries(this.healthStatus)
        };
    }
}

module.exports = ServiceFactory;