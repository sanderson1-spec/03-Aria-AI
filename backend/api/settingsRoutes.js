const express = require('express');
// Use built-in fetch in Node.js 18+
const fetch = globalThis.fetch;

class SettingsRoutes {
    constructor(serviceFactory) {
        this.router = express.Router();
        this.serviceFactory = serviceFactory;
        this.setupRoutes();
    }

    setupRoutes() {
        // Enable CORS for frontend
        this.router.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', 'http://localhost:5173');
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
            if (req.method === 'OPTIONS') {
                res.sendStatus(200);
            } else {
                next();
            }
        });

        // Get available models from LMStudio
        this.router.get('/models', async (req, res) => {
            try {
                const llmService = this.serviceFactory.get('llm');
                const config = llmService.config;
                
                if (!config || !config.endpoint) {
                    return res.status(500).json({ 
                        error: 'LLM service not configured' 
                    });
                }

                // Get models from LMStudio
                const modelsEndpoint = config.endpoint.replace('/chat/completions', '/models');
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000);
                
                const response = await fetch(modelsEndpoint, {
                    method: 'GET',
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);
                
                if (!response.ok) {
                    throw new Error(`Failed to fetch models: ${response.status}`);
                }
                
                const modelsData = await response.json();
                
                res.json({
                    success: true,
                    data: {
                        models: modelsData.data || [],
                        currentModel: config.model,
                        endpoint: config.endpoint
                    }
                });

            } catch (error) {
                console.error('Settings Models API Error:', error);
                res.status(500).json({ 
                    error: 'Failed to get available models', 
                    details: error.message 
                });
            }
        });

        // Get current settings
        this.router.get('/current', async (req, res) => {
            try {
                const configService = this.serviceFactory.get('configuration');
                const llmService = this.serviceFactory.get('llm');
                
                const currentSettings = {
                    llm: {
                        model: llmService.config?.model || 'meta-llama-3.1-8b-instruct',
                        endpoint: llmService.config?.endpoint || 'http://localhost:1234/v1/chat/completions',
                        temperature: llmService.config?.temperature || 0.7,
                        maxTokens: llmService.config?.maxTokens || 2048
                    },
                    ui: {
                        theme: 'dark',
                        language: 'en'
                    }
                };

                res.json({
                    success: true,
                    data: currentSettings
                });

            } catch (error) {
                console.error('Settings Current API Error:', error);
                res.status(500).json({ 
                    error: 'Failed to get current settings', 
                    details: error.message 
                });
            }
        });

        // Update settings
        this.router.put('/update', async (req, res) => {
            try {
                const { llm, ui } = req.body;
                const configService = this.serviceFactory.get('configuration');
                
                // Update LLM settings if provided
                if (llm) {
                    const currentConfig = configService.getConfiguration();
                    const updatedLLMConfig = {
                        ...currentConfig.llm,
                        ...llm
                    };
                    
                    await configService.updateConfiguration({
                        llm: updatedLLMConfig
                    });
                    
                    // Note: LLM service would need to be restarted to pick up new settings
                    // For now, we'll just save the configuration
                }
                
                // Update UI settings if provided
                if (ui) {
                    await configService.updateConfiguration({
                        ui: ui
                    });
                }

                res.json({
                    success: true,
                    message: 'Settings updated successfully',
                    note: 'LLM settings require application restart to take effect'
                });

            } catch (error) {
                console.error('Settings Update API Error:', error);
                res.status(500).json({ 
                    error: 'Failed to update settings', 
                    details: error.message 
                });
            }
        });
    }

    getRouter() {
        return this.router;
    }
}

module.exports = SettingsRoutes;
