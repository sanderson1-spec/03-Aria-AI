const AbstractService = require('../base/AbstractService');
const fs = require('fs').promises;
const path = require('path');

/**
 * Configuration Service Foundation
 * 
 * CLEAN ARCHITECTURE DESIGN:
 * - Single Responsibility: Centralized configuration management
 * - Dependency Injection: Logger service injected through constructor
 * - Infrastructure Layer: File system operations for configuration persistence
 * - Template Method Pattern: Follows AbstractService lifecycle
 * 
 * This service provides structured configuration management:
 * - JSON-based configuration file loading and saving
 * - In-memory configuration storage with Map for performance
 * - Default value handling for missing configuration keys
 * - Graceful error handling for file system operations
 * - Type-safe configuration access with fallback values
 * 
 * Configuration Management Features:
 * - Load configuration from JSON files
 * - Get configuration values with default fallbacks
 * - Set configuration values in memory
 * - Save configuration changes to file system
 * - Retrieve all configuration as object
 */
class ConfigurationService extends AbstractService {
    constructor(dependencies = {}) {
        super('ConfigurationService', dependencies);
        
        // CLEAN ARCHITECTURE: Dependency injection
        this.logger = dependencies.logger;
        this.errorHandler = dependencies.errorHandling;
        
        // CLEAN ARCHITECTURE: Service-specific state management
        this.configuration = new Map();
        this.currentConfigPath = null;
        this.autoSave = dependencies.autoSave !== false;
        this.createMissingDirectories = dependencies.createMissingDirectories !== false;
    }

    /**
     * TEMPLATE METHOD: Initialize the configuration service
     */
    async onInitialize() {
        // CLEAN ARCHITECTURE: Validate required dependencies
        this.validateDependencies(['logger']);
        
        // CLEAN ARCHITECTURE: Initialize empty configuration
        this.configuration.clear();
        
        // CLEAN ARCHITECTURE: Log service initialization
        if (this.logger) {
            this.logger.info('Configuration service initialized', 'ConfigurationService', {
                autoSave: this.autoSave,
                createMissingDirectories: this.createMissingDirectories,
                configurationSize: this.configuration.size
            });
        }
    }

    /**
     * SINGLE RESPONSIBILITY: Ensure directory exists for configuration file
     */
    async _ensureDirectoryExists(filePath) {
        if (!this.createMissingDirectories) {
            return;
        }

        try {
            const directory = path.dirname(filePath);
            await fs.mkdir(directory, { recursive: true });
            
            if (this.logger) {
                this.logger.debug('Directory created for configuration', 'ConfigurationService', {
                    directory: directory
                });
            }
        } catch (error) {
            if (this.errorHandler) {
                throw this.errorHandler.wrapInfrastructureError(
                    error,
                    'Failed to create configuration directory',
                    { filePath, directory: path.dirname(filePath) }
                );
            }
            throw error;
        }
    }

    /**
     * SINGLE RESPONSIBILITY: Parse JSON configuration file content
     */
    _parseConfigurationContent(content, configPath) {
        try {
            const parsed = JSON.parse(content);
            
            if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
                throw new Error('Configuration file must contain a valid JSON object');
            }
            
            return parsed;
        } catch (error) {
            if (this.errorHandler) {
                throw this.errorHandler.wrapInfrastructureError(
                    error,
                    'Failed to parse configuration file',
                    { configPath, contentLength: content.length }
                );
            }
            throw error;
        }
    }

    /**
     * CLEAN ARCHITECTURE: Load configuration from JSON file
     * Infrastructure layer operation for file system access
     */
    async loadConfiguration(configPath) {
        try {
            // CLEAN ARCHITECTURE: Validate input parameters
            if (!configPath || typeof configPath !== 'string') {
                throw new Error('Configuration path must be a non-empty string');
            }

            // CLEAN ARCHITECTURE: Resolve absolute path
            const absolutePath = path.resolve(configPath);
            
            if (this.logger) {
                this.logger.info('Loading configuration from file', 'ConfigurationService', {
                    configPath: absolutePath
                });
            }

            // CLEAN ARCHITECTURE: Read configuration file
            const content = await fs.readFile(absolutePath, 'utf8');
            const configData = this._parseConfigurationContent(content, absolutePath);

            // CLEAN ARCHITECTURE: Clear existing configuration and load new data
            this.configuration.clear();
            Object.entries(configData).forEach(([key, value]) => {
                this.configuration.set(key, value);
            });

            // CLEAN ARCHITECTURE: Track current configuration path
            this.currentConfigPath = absolutePath;

            if (this.logger) {
                this.logger.info('Configuration loaded successfully', 'ConfigurationService', {
                    configPath: absolutePath,
                    keysLoaded: this.configuration.size
                });
            }

            // CLEAN ARCHITECTURE: Track metrics for this operation
            this.metrics.lastOperationTime = Date.now();
            const currentCount = this.metrics.operationCounts.get('loadConfiguration') || 0;
            this.metrics.operationCounts.set('loadConfiguration', currentCount + 1);

            return this.configuration.size;

        } catch (error) {
            if (this.logger) {
                this.logger.error('Failed to load configuration', 'ConfigurationService', {
                    configPath,
                    error: error.message
                });
            }

            if (this.errorHandler) {
                throw this.errorHandler.wrapInfrastructureError(
                    error,
                    'Configuration loading failed',
                    { configPath }
                );
            }
            throw error;
        }
    }

    /**
     * CLEAN ARCHITECTURE: Get configuration value with default fallback
     * Application layer operation for configuration access
     */
    getConfiguration(key, defaultValue = null) {
        try {
            // CLEAN ARCHITECTURE: Validate input parameters
            if (key === null || key === undefined) {
                throw new Error('Configuration key cannot be null or undefined');
            }

            const stringKey = String(key);
            const value = this.configuration.has(stringKey) 
                ? this.configuration.get(stringKey) 
                : defaultValue;

            if (this.logger) {
                this.logger.debug('Configuration value retrieved', 'ConfigurationService', {
                    key: stringKey,
                    hasValue: this.configuration.has(stringKey),
                    usedDefault: !this.configuration.has(stringKey)
                });
            }

            // CLEAN ARCHITECTURE: Track metrics for this operation
            this.metrics.lastOperationTime = Date.now();
            const currentCount = this.metrics.operationCounts.get('getConfiguration') || 0;
            this.metrics.operationCounts.set('getConfiguration', currentCount + 1);

            return value;

        } catch (error) {
            if (this.logger) {
                this.logger.error('Failed to get configuration value', 'ConfigurationService', {
                    key,
                    error: error.message
                });
            }

            if (this.errorHandler) {
                throw this.errorHandler.wrapApplicationError(
                    error,
                    'Configuration retrieval failed',
                    { key, defaultValue }
                );
            }
            throw error;
        }
    }

    /**
     * CLEAN ARCHITECTURE: Set configuration value in memory
     * Application layer operation for configuration management
     */
    setConfiguration(key, value) {
        try {
            // CLEAN ARCHITECTURE: Validate input parameters
            if (key === null || key === undefined) {
                throw new Error('Configuration key cannot be null or undefined');
            }

            const stringKey = String(key);
            const previousValue = this.configuration.get(stringKey);
            this.configuration.set(stringKey, value);

            if (this.logger) {
                this.logger.info('Configuration value set', 'ConfigurationService', {
                    key: stringKey,
                    hadPreviousValue: previousValue !== undefined,
                    valueType: typeof value
                });
            }

            // CLEAN ARCHITECTURE: Auto-save if enabled and path is available
            if (this.autoSave && this.currentConfigPath) {
                // Fire and forget async save operation
                this.saveConfiguration(this.currentConfigPath).catch(error => {
                    if (this.logger) {
                        this.logger.warn('Auto-save failed after configuration change', 'ConfigurationService', {
                            key: stringKey,
                            configPath: this.currentConfigPath,
                            error: error.message
                        });
                    }
                });
            }

            // CLEAN ARCHITECTURE: Track metrics for this operation
            this.metrics.lastOperationTime = Date.now();
            const currentCount = this.metrics.operationCounts.get('setConfiguration') || 0;
            this.metrics.operationCounts.set('setConfiguration', currentCount + 1);

            return previousValue;

        } catch (error) {
            if (this.logger) {
                this.logger.error('Failed to set configuration value', 'ConfigurationService', {
                    key,
                    error: error.message
                });
            }

            if (this.errorHandler) {
                throw this.errorHandler.wrapApplicationError(
                    error,
                    'Configuration setting failed',
                    { key, value }
                );
            }
            throw error;
        }
    }

    /**
     * CLEAN ARCHITECTURE: Get all configuration as plain object
     * Application layer operation for bulk configuration access
     */
    getAllConfiguration() {
        try {
            const configObject = Object.fromEntries(this.configuration);

            if (this.logger) {
                this.logger.debug('All configuration retrieved', 'ConfigurationService', {
                    keyCount: this.configuration.size,
                    keys: Array.from(this.configuration.keys())
                });
            }

            // CLEAN ARCHITECTURE: Track metrics for this operation
            this.metrics.lastOperationTime = Date.now();
            const currentCount = this.metrics.operationCounts.get('getAllConfiguration') || 0;
            this.metrics.operationCounts.set('getAllConfiguration', currentCount + 1);

            return configObject;

        } catch (error) {
            if (this.logger) {
                this.logger.error('Failed to get all configuration', 'ConfigurationService', {
                    error: error.message
                });
            }

            if (this.errorHandler) {
                throw this.errorHandler.wrapApplicationError(
                    error,
                    'Configuration retrieval failed',
                    { operation: 'getAllConfiguration' }
                );
            }
            throw error;
        }
    }

    /**
     * CLEAN ARCHITECTURE: Save configuration to JSON file
     * Infrastructure layer operation for file system persistence
     */
    async saveConfiguration(configPath) {
        try {
            // CLEAN ARCHITECTURE: Validate input parameters
            if (!configPath || typeof configPath !== 'string') {
                throw new Error('Configuration path must be a non-empty string');
            }

            // CLEAN ARCHITECTURE: Resolve absolute path
            const absolutePath = path.resolve(configPath);

            // CLEAN ARCHITECTURE: Ensure directory exists
            await this._ensureDirectoryExists(absolutePath);

            // CLEAN ARCHITECTURE: Convert Map to JSON string
            const configObject = Object.fromEntries(this.configuration);
            const jsonContent = JSON.stringify(configObject, null, 2);

            if (this.logger) {
                this.logger.info('Saving configuration to file', 'ConfigurationService', {
                    configPath: absolutePath,
                    keyCount: this.configuration.size
                });
            }

            // CLEAN ARCHITECTURE: Write configuration file
            await fs.writeFile(absolutePath, jsonContent, 'utf8');

            // CLEAN ARCHITECTURE: Update current configuration path
            this.currentConfigPath = absolutePath;

            if (this.logger) {
                this.logger.info('Configuration saved successfully', 'ConfigurationService', {
                    configPath: absolutePath,
                    keysSaved: this.configuration.size,
                    fileSize: jsonContent.length
                });
            }

            // CLEAN ARCHITECTURE: Track metrics for this operation
            this.metrics.lastOperationTime = Date.now();
            const currentCount = this.metrics.operationCounts.get('saveConfiguration') || 0;
            this.metrics.operationCounts.set('saveConfiguration', currentCount + 1);

            return absolutePath;

        } catch (error) {
            if (this.logger) {
                this.logger.error('Failed to save configuration', 'ConfigurationService', {
                    configPath,
                    error: error.message
                });
            }

            if (this.errorHandler) {
                throw this.errorHandler.wrapInfrastructureError(
                    error,
                    'Configuration saving failed',
                    { configPath }
                );
            }
            throw error;
        }
    }

    /**
     * TEMPLATE METHOD: Custom health check for configuration service
     */
    async onHealthCheck() {
        return {
            healthy: this.initialized,
            details: {
                state: this.state,
                configurationSize: this.configuration.size,
                currentConfigPath: this.currentConfigPath,
                autoSave: this.autoSave,
                createMissingDirectories: this.createMissingDirectories,
                operationCounts: Object.fromEntries(this.metrics.operationCounts),
                hasConfiguration: this.configuration.size > 0
            }
        };
    }

    /**
     * TEMPLATE METHOD: Custom shutdown logic
     */
    async onShutdown() {
        if (this.logger) {
            this.logger.info('Configuration service shutting down', 'ConfigurationService', {
                configurationSize: this.configuration.size,
                currentConfigPath: this.currentConfigPath,
                uptime: Date.now() - this.metrics.startTime,
                operationCounts: Object.fromEntries(this.metrics.operationCounts)
            });
        }

        // CLEAN ARCHITECTURE: Clear configuration on shutdown
        this.configuration.clear();
        this.currentConfigPath = null;
    }
}

module.exports = ConfigurationService;
