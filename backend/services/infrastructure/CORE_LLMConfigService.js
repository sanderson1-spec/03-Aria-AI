const AbstractService = require('../base/CORE_AbstractService');

class CORE_LLMConfigService extends AbstractService {
    constructor(dependencies) {
        super('LLMConfig', dependencies);
        this.dal = dependencies.database.getDAL();
        this.logger = dependencies.logger;
        this.errorHandler = dependencies.errorHandling;
        this.config = dependencies.configuration;
        
        // Cache for available models (5 minutes)
        this.modelsCache = null;
        this.modelsCacheTimestamp = null;
        this.modelsCacheDuration = 5 * 60 * 1000; // 5 minutes in milliseconds
    }
    
    async onInitialize() {
        this.logger.info('LLMConfigService initialized', 'LLMConfig');
    }
    
    /**
     * Resolves the appropriate LLM model configuration based on cascade rules
     * @param {number} userId - The user ID
     * @param {number} characterId - The character ID (optional for analytical)
     * @param {string} role - 'conversational' or 'analytical'
     * @returns {Promise<Object|null>} Model configuration object
     */
    async resolveModelConfig(userId, characterId, role) {
        try {
            // Validate role
            if (!['conversational', 'analytical'].includes(role)) {
                throw new Error(`Invalid role: ${role}. Must be 'conversational' or 'analytical'`);
            }
            
            // Get global context window for fallback
            const globalContextWindow = await this.getGlobalContextWindow(role);
            
            if (role === 'conversational') {
                // Conversational cascade: character → user → global
                this.logger.debug('🔍 Starting conversational model cascade resolution', 'LLMConfig', { userId, characterId, role });
                
                if (characterId) {
                    const charPrefs = await this.getCharacterLLMPreferences(characterId);
                    if (charPrefs && charPrefs.conversational && charPrefs.conversational.model) {
                        this.logger.info('✅ Resolved from CHARACTER preferences', 'LLMConfig', { 
                            userId, 
                            characterId,
                            model: charPrefs.conversational.model,
                            source: 'character-specific',
                            cascadeLevel: 1
                        });
                        // Add context_window_messages if not present
                        return {
                            ...charPrefs.conversational,
                            context_window_messages: charPrefs.conversational.context_window_messages || globalContextWindow
                        };
                    } else {
                        this.logger.debug('⬇️ Character has no conversational LLM override, checking user defaults', 'LLMConfig', { characterId });
                    }
                }
                
                // Check user default
                const userPrefs = await this.getUserLLMPreferences(userId);
                if (userPrefs && userPrefs.conversational && userPrefs.conversational.model) {
                    this.logger.info('✅ Resolved from USER preferences', 'LLMConfig', { 
                        userId,
                        model: userPrefs.conversational.model,
                        source: 'user-default',
                        cascadeLevel: 2
                    });
                    // Add context_window_messages if not present
                    return {
                        ...userPrefs.conversational,
                        context_window_messages: userPrefs.conversational.context_window_messages || globalContextWindow
                    };
                } else {
                    this.logger.debug('⬇️ User has no conversational LLM preferences, using global defaults', 'LLMConfig', { userId });
                }
                
                // Fall back to global default
                const globalConfig = await this.getGlobalLLMConfig(role);
                this.logger.info('✅ Resolved from GLOBAL configuration', 'LLMConfig', { 
                    userId,
                    model: globalConfig?.model,
                    source: 'global-default',
                    cascadeLevel: 3
                });
                return {
                    ...globalConfig,
                    context_window_messages: globalConfig.context_window_messages || globalContextWindow
                };
            } else {
                // Analytical cascade: user → global (no character override)
                this.logger.debug('🔍 Starting analytical model cascade resolution', 'LLMConfig', { userId, role });
                
                const userPrefs = await this.getUserLLMPreferences(userId);
                if (userPrefs && userPrefs.analytical && userPrefs.analytical.model) {
                    this.logger.info('✅ Resolved from USER preferences (analytical)', 'LLMConfig', { 
                        userId,
                        model: userPrefs.analytical.model,
                        source: 'user-default',
                        cascadeLevel: 1
                    });
                    // Add context_window_messages if not present
                    return {
                        ...userPrefs.analytical,
                        context_window_messages: userPrefs.analytical.context_window_messages || globalContextWindow
                    };
                } else {
                    this.logger.debug('⬇️ User has no analytical LLM preferences, using global defaults', 'LLMConfig', { userId });
                }
                
                // Fall back to global default
                const globalConfig = await this.getGlobalLLMConfig(role);
                this.logger.info('✅ Resolved from GLOBAL configuration (analytical)', 'LLMConfig', { 
                    userId,
                    model: globalConfig?.model,
                    source: 'global-default',
                    cascadeLevel: 2
                });
                return {
                    ...globalConfig,
                    context_window_messages: globalConfig.context_window_messages || globalContextWindow
                };
            }
        } catch (error) {
            throw this.errorHandler.wrapDomainError(error, 'Failed to resolve model config', { userId, characterId, role });
        }
    }
    
    /**
     * Gets LLM preferences for a specific user
     * @param {number} userId - The user ID
     * @returns {Promise<Object|null>} User's LLM preferences
     */
    async getUserLLMPreferences(userId) {
        try {
            const user = await this.dal.users.findById(userId);
            if (!user) {
                this.logger.warn('User not found when fetching LLM preferences', 'LLMConfig', { userId });
                return null;
            }
            
            // Parse JSON if stored as string
            const preferences = user.llm_preferences;
            if (typeof preferences === 'string') {
                return JSON.parse(preferences);
            }
            
            return preferences || null;
        } catch (error) {
            throw this.errorHandler.wrapDomainError(error, 'Failed to get user LLM preferences', { userId });
        }
    }
    
    /**
     * Sets LLM preferences for a specific user
     * @param {number} userId - The user ID
     * @param {Object} preferences - The preferences object
     */
    async setUserLLMPreferences(userId, preferences) {
        try {
            await this.dal.users.updateLLMPreferences(userId, preferences);
            this.logger.info('Updated user LLM preferences', 'LLMConfig', { userId });
        } catch (error) {
            throw this.errorHandler.wrapDomainError(error, 'Failed to set user LLM preferences', { userId });
        }
    }
    
    /**
     * Gets LLM preferences for a specific character
     * @param {number} characterId - The character ID
     * @returns {Promise<Object|null>} Character's LLM preferences
     */
    async getCharacterLLMPreferences(characterId) {
        try {
            const character = await this.dal.personalities.getCharacter(characterId);
            if (!character) {
                this.logger.warn('Character not found when fetching LLM preferences', 'LLMConfig', { characterId });
                return null;
            }
            
            // Parse JSON if stored as string
            const preferences = character.llm_preferences;
            if (typeof preferences === 'string') {
                return JSON.parse(preferences);
            }
            
            return preferences || null;
        } catch (error) {
            throw this.errorHandler.wrapDomainError(error, 'Failed to get character LLM preferences', { characterId });
        }
    }
    
    /**
     * Sets LLM preferences for a specific character
     * @param {number} characterId - The character ID
     * @param {Object} preferences - The preferences object
     */
    async setCharacterLLMPreferences(characterId, preferences) {
        try {
            await this.dal.personalities.updateCharacter(characterId, { llm_preferences: preferences });
            this.logger.info('Updated character LLM preferences', 'LLMConfig', { characterId });
        } catch (error) {
            throw this.errorHandler.wrapDomainError(error, 'Failed to set character LLM preferences', { characterId });
        }
    }
    
    /**
     * Gets global LLM configuration for a specific role
     * @param {string} role - 'conversational' or 'analytical'
     * @returns {Promise<Object|null>} Global configuration
     */
    async getGlobalLLMConfig(role) {
        try {
            const configKey = role === 'conversational' ? 'llm_conversational_model' : 'llm_analytical_model';
            const value = await this.dal.configuration.getConfigValue(configKey);
            
            if (!value) {
                this.logger.warn('Global LLM config not found, using defaults', 'LLMConfig', { role, configKey });
                // Return default configuration
                return {
                    model: process.env.LLM_MODEL || 'meta-llama-3.1-8b-instruct',
                    temperature: 0.7,
                    max_tokens: 2048
                };
            }
            
            // Value should already be parsed by getConfigValue
            return value;
        } catch (error) {
            throw this.errorHandler.wrapDomainError(error, 'Failed to get global LLM config', { role });
        }
    }
    
    /**
     * Gets global context window configuration
     * @param {string} role - 'conversational' or 'analytical'
     * @returns {Promise<number>} Context window size (default 30)
     */
    async getGlobalContextWindow(role) {
        try {
            const configKey = role === 'conversational' 
                ? 'llm_conversational_context_window' 
                : 'llm_analytical_context_window';
            
            const value = await this.dal.configuration.getConfigValue(configKey);
            
            if (!value) {
                return 30; // Default context window
            }
            
            // Parse as integer if it's a string
            const contextWindow = typeof value === 'string' ? parseInt(value, 10) : value;
            
            return contextWindow || 30;
        } catch (error) {
            // Silently default to 30 on error
            return 30;
        }
    }
    
    /**
     * Sets global LLM configuration
     * @param {string} key - Configuration key
     * @param {any} value - Configuration value
     */
    async setGlobalLLMConfig(key, value) {
        try {
            await this.dal.configuration.setConfigValue(key, value, 'json', 'LLM configuration', 'llm', true);
            this.logger.info('Updated global LLM config', 'LLMConfig', { key });
        } catch (error) {
            throw this.errorHandler.wrapDomainError(error, 'Failed to set global LLM config', { key });
        }
    }
    
    /**
     * Gets character preferences (alias for getCharacterLLMPreferences)
     * Used by ContextBuilderService
     * @param {number} characterId - The character ID
     * @returns {Promise<Object|null>} Character's preferences
     */
    async getCharacterPreferences(characterId) {
        return await this.getCharacterLLMPreferences(characterId);
    }
    
    /**
     * Gets user preferences (alias for getUserLLMPreferences)
     * Used by ContextBuilderService
     * @param {number} userId - The user ID
     * @returns {Promise<Object|null>} User's preferences
     */
    async getUserPreferences(userId) {
        return await this.getUserLLMPreferences(userId);
    }
    
    /**
     * Gets global config (simplified version for ContextBuilderService)
     * @returns {Promise<Object>} Global configuration with context window
     */
    async getGlobalConfig() {
        try {
            const conversationalConfig = await this.getGlobalLLMConfig('conversational');
            const contextWindow = await this.getGlobalContextWindow('conversational');
            
            return {
                ...conversationalConfig,
                context_window_messages: contextWindow
            };
        } catch (error) {
            this.logger.warn('Error getting global config, using defaults', 'LLMConfig', { error: error.message });
            return {
                model: process.env.LLM_MODEL || 'meta-llama-3.1-8b-instruct',
                temperature: 0.7,
                max_tokens: 2048,
                context_window_messages: 30
            };
        }
    }
    
    /**
     * Gets available models from LLM server with 5-minute caching
     * @returns {Promise<Array>} Array of model objects with id and name
     */
    async getAvailableModels() {
        try {
            // Check cache first
            const now = Date.now();
            if (this.modelsCache && this.modelsCacheTimestamp && (now - this.modelsCacheTimestamp < this.modelsCacheDuration)) {
                this.logger.debug('Returning cached available models', 'LLMConfig', { count: this.modelsCache.length });
                return this.modelsCache;
            }
            
            // Query LLM server for available models
            // Get LLM server URL from environment or use default
            const llmBaseUrl = process.env.LLM_ENDPOINT || 'http://localhost:1234/v1/chat/completions';
            const llmUrl = llmBaseUrl.replace('/chat/completions', '').replace('/v1', '') + '/v1';
            
            const response = await fetch(`${llmUrl}/models`);
            
            if (!response.ok) {
                throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            
            // Transform to expected format: [{ id: 'model-name', name: 'Display Name' }]
            const models = data.data ? data.data.map(model => ({
                id: model.id,
                name: model.id // Use id as display name if no specific name field
            })) : [];
            
            // Update cache
            this.modelsCache = models;
            this.modelsCacheTimestamp = now;
            
            this.logger.info('Fetched available models from LLM server', 'LLMConfig', { count: models.length });
            
            return models;
        } catch (error) {
            throw this.errorHandler.wrapDomainError(error, 'Failed to get available models', {});
        }
    }
    
    /**
     * Tests connection to LLM server
     * @returns {Promise<Object>} Connection test result with success status
     */
    async testConnection() {
        try {
            const llmUrl = this.config.get('llmApiUrl');
            if (!llmUrl) {
                throw new Error('LLM API URL not configured');
            }
            
            const response = await fetch(`${llmUrl}/v1/models`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            const isAccessible = response.ok;
            
            if (isAccessible) {
                this.logger.info('LLM server connection test successful', 'LLMConfig', { url: llmUrl });
            } else {
                this.logger.warn('LLM server connection test failed', 'LLMConfig', { 
                    url: llmUrl,
                    status: response.status,
                    statusText: response.statusText
                });
            }
            
            return {
                success: isAccessible,
                status: response.status,
                statusText: response.statusText,
                url: llmUrl
            };
        } catch (error) {
            this.logger.error('LLM server connection test error', 'LLMConfig', { error: error.message });
            throw this.errorHandler.wrapDomainError(error, 'Failed to test LLM connection', {});
        }
    }
}

module.exports = CORE_LLMConfigService;

