const fetch = require('node-fetch');

/**
 * LLM Orchestrator - Manages dual LLM architecture
 * Uses one model for conversation and another for structured data extraction
 * 
 * CLEAN ARCHITECTURE: Utility class for LLM model routing
 * Compatible with our CORE services architecture
 */
class LLMOrchestrator {
    constructor(dependencies = {}) {
        this.logger = dependencies.logger || this.createFallbackLogger();
        this.configuration = dependencies.configuration;
        this.llmService = dependencies.llm;
        
        this.initialized = false;
        this.conversationModel = null;
        this.structuredModel = null;
        
        this.initializeModels();
    }

    /**
     * Create fallback logger if not provided
     */
    createFallbackLogger() {
        return {
            info: () => {},
            debug: () => {},
            warn: () => {},
            error: () => {}
        };
    }

    /**
     * Initialize model configurations
     */
    initializeModels() {
        // Default configuration
        const endpoint = process.env.LLM_ENDPOINT || 'http://localhost:1234/v1/chat/completions';
        const timeout = parseInt(process.env.LLM_TIMEOUT) || 30000;

        this.conversationModel = {
            endpoint: endpoint,
            model: process.env.LLM_MODEL || 'auto',
            timeout: timeout,
            maxTokens: parseInt(process.env.LLM_MAX_TOKENS) || 2048,
            temperature: parseFloat(process.env.LLM_TEMPERATURE) || 0.7
        };

        this.structuredModel = {
            endpoint: endpoint,
            model: process.env.LLM_STRUCTURED_MODEL || process.env.LLM_MODEL || 'auto',
            timeout: timeout,
            maxTokens: parseInt(process.env.LLM_STRUCTURED_MAX_TOKENS) || 500,
            temperature: parseFloat(process.env.LLM_STRUCTURED_TEMPERATURE) || 0.1
        };

        this.initialized = true;
        this.logger.info('LLM Orchestrator initialized', 'LLMOrchestrator', {
            conversationModel: this.conversationModel.model,
            structuredModel: this.structuredModel.model
        });
    }

    /**
     * Get conversational response using conversation-optimized model
     */
    async getConversationResponse(prompt, context = [], options = {}) {
        if (!this.initialized) {
            throw new Error('LLM Orchestrator not initialized');
        }

        // Use our existing LLM service if available
        if (this.llmService) {
            return await this.llmService.generateResponse(prompt, context, {
                ...this.conversationModel,
                ...options
            });
        }

        // Fallback to direct model call
        return await this.makeModelRequest('conversation', prompt, context, {
            ...this.conversationModel,
            ...options
        });
    }

    /**
     * Get structured response using JSON-optimized model
     */
    async getStructuredResponse(prompt, schema = null, options = {}) {
        if (!this.initialized) {
            throw new Error('LLM Orchestrator not initialized');
        }

        // Enhanced prompt for JSON generation
        const jsonPrompt = this.enhancePromptForJSON(prompt, schema);

        // Use our existing LLM service if available
        if (this.llmService) {
            return await this.llmService.generateResponse(jsonPrompt, [], {
                ...this.structuredModel,
                ...options
            });
        }

        // Fallback to direct model call
        const response = await this.makeModelRequest('structured', jsonPrompt, [], {
            ...this.structuredModel,
            ...options
        });

        // Try to parse as JSON
        if (response && response.content) {
            try {
                const jsonMatch = response.content.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    return {
                        ...response,
                        content: jsonMatch[0],
                        parsed: parsed
                    };
                }
            } catch (error) {
                this.logger.warn('Failed to parse structured response as JSON', 'LLMOrchestrator', {
                    error: error.message
                });
            }
        }

        return response;
    }

    /**
     * Enhance prompt for better JSON generation
     */
    enhancePromptForJSON(prompt, schema) {
        let enhanced = prompt;
        
        enhanced += '\n\n=== CRITICAL JSON REQUIREMENTS ===';
        enhanced += '\n1. Respond with ONLY valid JSON - no explanations or markdown';
        enhanced += '\n2. Start immediately with { and end with }';
        enhanced += '\n3. Use proper JSON syntax: double quotes, no trailing commas';
        
        if (schema) {
            enhanced += '\n\n=== REQUIRED SCHEMA ===';
            enhanced += '\n' + JSON.stringify(schema, null, 2);
        }
        
        enhanced += '\n\nGenerate the JSON response now:';
        
        return enhanced;
    }

    /**
     * Make direct model request (fallback when LLM service not available)
     */
    async makeModelRequest(type, prompt, context = [], options = {}) {
        const modelConfig = type === 'conversation' ? this.conversationModel : this.structuredModel;
        
        const messages = [];
        
        // Add context messages
        if (context && context.length > 0) {
            for (const contextMessage of context.slice(-5)) {
                if (typeof contextMessage === 'string') {
                    messages.push({ role: 'user', content: contextMessage });
                } else if (contextMessage.role && contextMessage.content) {
                    messages.push(contextMessage);
                }
            }
        }
        
        // Add main prompt
        messages.push({ role: 'user', content: prompt });

        const requestBody = {
            model: modelConfig.model,
            messages: messages,
            max_tokens: options.maxTokens || modelConfig.maxTokens,
            temperature: options.temperature || modelConfig.temperature
        };

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), options.timeout || modelConfig.timeout);

            const response = await fetch(modelConfig.endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            
            if (!data.choices || data.choices.length === 0) {
                throw new Error('No response from LLM');
            }

            return {
                content: data.choices[0].message.content.trim(),
                usage: data.usage,
                model: data.model || modelConfig.model,
                timestamp: Date.now()
            };

        } catch (error) {
            this.logger.error(`LLM ${type} request failed`, 'LLMOrchestrator', {
                error: error.message,
                endpoint: modelConfig.endpoint
            });
            throw error;
        }
    }

    /**
     * Check if both models are available
     */
    async checkAvailability() {
        const results = {
            conversation: false,
            structured: false,
            details: {}
        };

        try {
            const conversationTest = await this.testModelConnection(this.conversationModel);
            results.conversation = conversationTest.available;
            results.details.conversation = conversationTest;
        } catch (error) {
            results.details.conversation = { available: false, error: error.message };
        }

        try {
            const structuredTest = await this.testModelConnection(this.structuredModel);
            results.structured = structuredTest.available;
            results.details.structured = structuredTest;
        } catch (error) {
            results.details.structured = { available: false, error: error.message };
        }

        return results;
    }

    /**
     * Test connection to a specific model configuration
     */
    async testModelConnection(modelConfig) {
        try {
            const modelsEndpoint = modelConfig.endpoint.replace('/chat/completions', '/models');
            const response = await fetch(modelsEndpoint, {
                method: 'GET',
                timeout: 5000
            });

            return {
                available: response.ok,
                endpoint: modelConfig.endpoint,
                model: modelConfig.model,
                status: response.status
            };
        } catch (error) {
            return {
                available: false,
                endpoint: modelConfig.endpoint,
                model: modelConfig.model,
                error: error.message
            };
        }
    }

    /**
     * Get current configuration
     */
    getConfiguration() {
        return {
            initialized: this.initialized,
            conversationModel: { ...this.conversationModel },
            structuredModel: { ...this.structuredModel }
        };
    }
}

module.exports = LLMOrchestrator;