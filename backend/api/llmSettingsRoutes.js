const express = require('express');

/**
 * LLM Settings Routes
 * 
 * CLEAN ARCHITECTURE DESIGN:
 * - API Layer: Handles HTTP requests/responses for LLM configuration
 * - Uses LLMConfigService for all configuration operations
 * - Provides endpoints for model discovery, configuration management, and connection testing
 */
class LLMSettingsRoutes {
    constructor(serviceFactory) {
        this.router = express.Router();
        this.serviceFactory = serviceFactory;
        this.setupRoutes();
    }

    setupRoutes() {
        // CORS is handled by main server middleware

        /**
         * GET /api/llm/models
         * Get available LLM models from server
         */
        this.router.get('/models', async (req, res) => {
            try {
                const llmConfigService = this.serviceFactory.get('llmConfig');
                
                if (!llmConfigService) {
                    return res.status(503).json({
                        success: false,
                        error: 'LLM configuration service not available'
                    });
                }

                const models = await llmConfigService.getAvailableModels();

                res.json({
                    success: true,
                    data: models
                });

            } catch (error) {
                console.error('Get Models API Error:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to fetch available models',
                    details: error.message
                });
            }
        });

        /**
         * GET /api/llm/config
         * Get LLM configuration (global and user-specific)
         * Query params: userId (optional)
         */
        this.router.get('/config', async (req, res) => {
            try {
                const { userId } = req.query;
                const llmConfigService = this.serviceFactory.get('llmConfig');
                
                if (!llmConfigService) {
                    return res.status(503).json({
                        success: false,
                        error: 'LLM configuration service not available'
                    });
                }

                // Get global configurations
                const globalConversational = await llmConfigService.getGlobalLLMConfig('conversational');
                const globalAnalytical = await llmConfigService.getGlobalLLMConfig('analytical');

                const responseData = {
                    global: {
                        conversational: globalConversational,
                        analytical: globalAnalytical
                    }
                };

                // Get user preferences if userId provided
                if (userId) {
                    const userPreferences = await llmConfigService.getUserLLMPreferences(parseInt(userId));
                    responseData.user = userPreferences;
                }

                res.json({
                    success: true,
                    data: responseData
                });

            } catch (error) {
                console.error('Get Config API Error:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to fetch LLM configuration',
                    details: error.message
                });
            }
        });

        /**
         * PUT /api/llm/config/global
         * Update global LLM configuration
         * Body: { key: 'llm_conversational_model', value: {...} }
         */
        this.router.put('/config/global', async (req, res) => {
            try {
                const { key, value } = req.body;

                if (!key || value === undefined) {
                    return res.status(400).json({
                        success: false,
                        error: 'Missing required fields: key and value'
                    });
                }

                const llmConfigService = this.serviceFactory.get('llmConfig');
                
                if (!llmConfigService) {
                    return res.status(503).json({
                        success: false,
                        error: 'LLM configuration service not available'
                    });
                }

                await llmConfigService.setGlobalLLMConfig(key, value);

                res.json({
                    success: true,
                    message: 'Global LLM configuration updated successfully'
                });

            } catch (error) {
                console.error('Update Global Config API Error:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to update global LLM configuration',
                    details: error.message
                });
            }
        });

        /**
         * PUT /api/llm/config/user
         * Update user-specific LLM preferences
         * Body: { userId: 1, preferences: {...} }
         */
        this.router.put('/config/user', async (req, res) => {
            try {
                const { userId, preferences } = req.body;

                if (!userId || !preferences) {
                    return res.status(400).json({
                        success: false,
                        error: 'Missing required fields: userId and preferences'
                    });
                }

                const llmConfigService = this.serviceFactory.get('llmConfig');
                
                if (!llmConfigService) {
                    return res.status(503).json({
                        success: false,
                        error: 'LLM configuration service not available'
                    });
                }

                await llmConfigService.setUserLLMPreferences(parseInt(userId), preferences);

                res.json({
                    success: true,
                    message: 'User LLM preferences updated successfully'
                });

            } catch (error) {
                console.error('Update User Config API Error:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to update user LLM preferences',
                    details: error.message
                });
            }
        });

        /**
         * PUT /api/llm/config/character
         * Update character-specific LLM preferences
         * Body: { characterId: 1, preferences: {...} }
         */
        this.router.put('/config/character', async (req, res) => {
            try {
                const { characterId, preferences } = req.body;

                if (!characterId || !preferences) {
                    return res.status(400).json({
                        success: false,
                        error: 'Missing required fields: characterId and preferences'
                    });
                }

                const llmConfigService = this.serviceFactory.get('llmConfig');
                
                if (!llmConfigService) {
                    return res.status(503).json({
                        success: false,
                        error: 'LLM configuration service not available'
                    });
                }

                await llmConfigService.setCharacterLLMPreferences(parseInt(characterId), preferences);

                res.json({
                    success: true,
                    message: 'Character LLM preferences updated successfully'
                });

            } catch (error) {
                console.error('Update Character Config API Error:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to update character LLM preferences',
                    details: error.message
                });
            }
        });

        /**
         * POST /api/llm/test-connection
         * Test connection to LLM server
         */
        this.router.post('/test-connection', async (req, res) => {
            try {
                const llmConfigService = this.serviceFactory.get('llmConfig');
                
                if (!llmConfigService) {
                    return res.status(503).json({
                        success: false,
                        error: 'LLM configuration service not available'
                    });
                }

                const connectionResult = await llmConfigService.testConnection();

                res.json({
                    success: true,
                    connected: connectionResult.success,
                    message: connectionResult.success 
                        ? 'Successfully connected to LLM server'
                        : `Connection failed: ${connectionResult.statusText}`,
                    details: connectionResult
                });

            } catch (error) {
                console.error('Test Connection API Error:', error);
                res.status(500).json({
                    success: false,
                    connected: false,
                    error: 'Failed to test LLM connection',
                    message: error.message,
                    details: error.message
                });
            }
        });

        /**
         * GET /api/llm/config/character/:characterId
         * Get character-specific LLM preferences
         */
        this.router.get('/config/character/:characterId', async (req, res) => {
            try {
                const { characterId } = req.params;

                if (!characterId) {
                    return res.status(400).json({
                        success: false,
                        error: 'Character ID is required'
                    });
                }

                const llmConfigService = this.serviceFactory.get('llmConfig');
                
                if (!llmConfigService) {
                    return res.status(503).json({
                        success: false,
                        error: 'LLM configuration service not available'
                    });
                }

                const preferences = await llmConfigService.getCharacterLLMPreferences(parseInt(characterId));

                res.json({
                    success: true,
                    data: preferences
                });

            } catch (error) {
                console.error('Get Character Config API Error:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to fetch character LLM preferences',
                    details: error.message
                });
            }
        });
    }

    getRouter() {
        return this.router;
    }
}

module.exports = LLMSettingsRoutes;

