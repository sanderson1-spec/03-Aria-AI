const AbstractService = require('../base/CORE_AbstractService');
// Use built-in fetch in Node.js 18+
const fetch = globalThis.fetch;

/**
 * Centralized LLM Service
 * 
 * CLEAN ARCHITECTURE DESIGN:
 * - Domain Layer: LLM request processing and response handling
 * - Application Layer: Provider abstraction and request orchestration  
 * - Infrastructure Layer: Network communication and rate limiting
 * 
 * This service provides:
 * - Single LLM client instance management
 * - Request queuing and rate limiting
 * - Health monitoring of LLM connection
 * - Unified interface for all LLM operations
 * - Provider adapter pattern for future extensibility
 * 
 * SIMPLIFIED: Removed caching complexity that was causing bugs
 */
class LLMService extends AbstractService {
    constructor(dependencies) {
        super('LLM', dependencies);
        
        // CLEAN ARCHITECTURE: Extract dependencies
        this.logger = dependencies.logger;
        this.errorHandler = dependencies.errorHandling;
        this.configuration = dependencies.configuration;
        this.llmConfig = dependencies.llmConfig; // LLM Configuration Service
        
        // CLEAN ARCHITECTURE: LLM configuration and connection
        this.config = null;
        this.connectionHealthy = false;
        this.lastHealthCheck = null;
        
        // CLEAN ARCHITECTURE: Request queue and rate limiting
        this.requestQueue = [];
        this.processingQueue = false;
        this.rateLimitConfig = {
            requestsPerMinute: 60,
            currentRequests: 0,
            windowStart: Date.now()
        };
        
        // CLEAN ARCHITECTURE: Performance and usage metrics
        this.llmMetrics = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            averageResponseTime: 0,
            totalResponseTime: 0,
            lastRequestTime: null
        };
    }

    /**
     * INFRASTRUCTURE LAYER: Initialize service
     */
    async onInitialize() {
        this.logger.info('Initializing LLM service', 'LLM');
        
        // Load configuration
        await this.loadConfiguration();
        
        // Test connection
        await this.testConnection();
        
        // Start queue processor
        this.startQueueProcessor();
        
        this.logger.info('LLM service initialized', 'LLM', {
            endpoint: this.config.endpoint,
            model: this.config.model
        });
    }

    /**
     * CLEAN ARCHITECTURE: Load configuration from settings service
     * Note: Model selection is now handled by LLMConfigService cascade per-request
     */
    async loadConfiguration() {
        try {
            // First try to get configuration from the configuration service
            const configData = this.configuration.getAllConfiguration ? this.configuration.getAllConfiguration() : {};
            const llmConfig = configData?.llm || {};
            
            // Load endpoint and operational settings (NOT model - that's resolved per-request)
            this.config = {
                endpoint: llmConfig.endpoint || process.env.LLM_ENDPOINT || 'http://localhost:1234/v1/chat/completions',
                model: null, // Will be resolved per-request via LLMConfigService cascade
                temperature: llmConfig.temperature || parseFloat(process.env.LLM_TEMPERATURE) || 0.7,
                maxTokens: llmConfig.maxTokens || parseInt(process.env.LLM_MAX_TOKENS) || 2048,
                timeout: parseInt(process.env.LLM_TIMEOUT) || 30000,
                rateLimitRpm: parseInt(process.env.LLM_RATE_LIMIT_RPM) || 60
            };
            
            // Update rate limit configuration
            this.rateLimitConfig.requestsPerMinute = this.config.rateLimitRpm;
            
            this.logger.info('LLM service configuration loaded', 'LLM', {
                endpoint: this.config.endpoint,
                modelSelection: 'per-request via LLMConfigService cascade',
                timeout: this.config.timeout
            });
            
        } catch (error) {
            this.logger.warn('Failed to load configuration from service, using defaults', 'LLM', { error: error.message });
            
            // Fallback configuration if configuration service fails
            this.config = {
                endpoint: process.env.LLM_ENDPOINT || 'http://localhost:1234/v1/chat/completions',
                model: null, // Will be resolved per-request
                temperature: parseFloat(process.env.LLM_TEMPERATURE) || 0.7,
                maxTokens: parseInt(process.env.LLM_MAX_TOKENS) || 2048,
                timeout: parseInt(process.env.LLM_TIMEOUT) || 30000,
                rateLimitRpm: parseInt(process.env.LLM_RATE_LIMIT_RPM) || 60
            };
            
            this.rateLimitConfig.requestsPerMinute = this.config.rateLimitRpm;
        }
    }

    /**
     * CLEAN ARCHITECTURE: Update model configuration dynamically
     */
    async updateModelConfiguration(newConfig) {
        try {
            this.logger.info('Updating LLM model configuration', 'LLM', newConfig);
            
            // Update the configuration
            this.config = {
                ...this.config,
                ...newConfig
            };
            
            // Update rate limit if changed
            if (newConfig.rateLimitRpm) {
                this.rateLimitConfig.requestsPerMinute = newConfig.rateLimitRpm;
            }
            
            // Test the new configuration
            await this.testConnection();
            
            this.logger.info('LLM model configuration updated successfully', 'LLM', this.config);
            return true;
            
        } catch (error) {
            this.logger.error('Failed to update LLM model configuration', 'LLM', { error: error.message });
            throw error;
        }
    }

    /**
     * INFRASTRUCTURE LAYER: Test connection during initialization
     */
    async testConnection() {
        // Skip connection test in development mode
        if (process.env.SKIP_LLM_CONNECTION_TEST === 'true') {
            this.logger.warn('Skipping LLM connection test (development mode)', 'LLM');
            this.connectionHealthy = false; // Mark as unhealthy but don't fail initialization
            return true;
        }
        
        const isConnected = await this.checkConnection();
        if (!isConnected) {
            throw new Error(`Cannot connect to LLM endpoint: ${this.config.endpoint}`);
        }
        this.connectionHealthy = true;
        return true;
    }

    /**
     * INFRASTRUCTURE LAYER: Check LLM connection health
     */
    async checkConnection() {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            
            const modelsEndpoint = this.config.endpoint.replace('/chat/completions', '/models');
            const response = await fetch(modelsEndpoint, {
                method: 'GET',
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            return response.ok;
        } catch (error) {
            this.logger.warn('LLM connection check failed', 'LLM', {
                error: error.message,
                endpoint: this.config.endpoint.replace('/chat/completions', '/models')
            });
            return false;
        }
    }

    /**
     * APPLICATION LAYER: Main LLM response generation method
     */
    async generateResponse(prompt, context = [], options = {}) {
        return await this.withMetrics(async () => {
            // CLEAN ARCHITECTURE: Validate input
            if (!prompt || typeof prompt !== 'string') {
                throw new Error('Prompt is required and must be a string');
            }
            
            this.logger.debug('Generating LLM response', 'LLM', {
                promptLength: prompt.length,
                contextLength: context.length,
                temperature: options.temperature
            });
            
            // CLEAN ARCHITECTURE: Queue the request for rate limiting
            return await this.queueRequest({
                type: 'generateResponse',
                prompt,
                context,
                options
            });
            
        }, 'generateResponse');
    }

    /**
     * APPLICATION LAYER: Analyze text with LLM
     */
    async analyzeText(text, analysisType, options = {}) {
        return await this.withMetrics(async () => {
            const analysisPrompt = this.buildAnalysisPrompt(text, analysisType);
            
            return await this.generateResponse(analysisPrompt, [], {
                ...options,
                analysisType,
                temperature: 0.3 // Lower temperature for analysis
            });
            
        }, 'analyzeText');
    }

    /**
     * DOMAIN LAYER: Generate streaming response
     */
    async generateStreamingResponse(prompt, context = [], options = {}, onChunk = null) {
        const startTime = Date.now();
        
        try {
            // Check rate limiting
            if (!this.checkRateLimit()) {
                throw new Error('Rate limit exceeded. Please try again later.');
            }
            
            this.rateLimitConfig.currentRequests++;
            this.llmMetrics.totalRequests++;
            
            const requestBody = await this.prepareStreamingRequestBody(prompt, context, options);
            
            this.logger.debug('Starting streaming LLM request', 'LLM');
            
            // Use native Node.js HTTP for true streaming
            return await this.processStreamingRequestNative(requestBody, onChunk, startTime);
            
        } catch (error) {
            const responseTime = Date.now() - startTime;
            this.updateMetrics(responseTime, false);
            const wrappedError = this.errorHandler.wrapDomainError(error, 'LLM streaming request failed');
            this.logger.error('LLM streaming request failed', 'LLM', {
                error: wrappedError.message
            });
            throw wrappedError;
        }
    }

    /**
     * INFRASTRUCTURE LAYER: Prepare streaming request body
     */
    async prepareStreamingRequestBody(prompt, context, options) {
        const messages = await this.buildConversationMessages(prompt, context, options);
        
        // Resolve model configuration with cascade: character → user → global
        let resolvedConfig = null;
        let model = null;
        let temperature = options?.temperature || this.config?.temperature || 0.7;
        let maxTokens = options?.maxTokens || this.config?.maxTokens || 2048;
        let configSource = 'unknown';
        
        // Determine role based on options (default to conversational)
        const role = options?.role || 'conversational';
        
        // Try to resolve config if llmConfig service is available and we have user context
        if (this.llmConfig && (options?.userId || options?.characterId)) {
            try {
                resolvedConfig = await this.llmConfig.resolveModelConfig(
                    options.userId,
                    options.characterId,
                    role
                );
                
                if (resolvedConfig && resolvedConfig.model) {
                    // Use resolved config values from cascade
                    model = resolvedConfig.model;
                    temperature = resolvedConfig.temperature !== undefined ? resolvedConfig.temperature : temperature;
                    maxTokens = resolvedConfig.max_tokens !== undefined ? resolvedConfig.max_tokens : maxTokens;
                    
                    // Determine configuration source for logging
                    if (options.characterId) {
                        configSource = 'character-specific';
                    } else {
                        configSource = 'user-default';
                    }
                    
                    this.logger.info('✅ Model resolved via LLMConfigService cascade', 'LLM', { 
                        model, 
                        role,
                        source: configSource,
                        userId: options.userId,
                        characterId: options.characterId,
                        temperature,
                        maxTokens
                    });
                } else {
                    this.logger.warn('⚠️ LLMConfigService returned null - check database configuration', 'LLM', {
                        userId: options.userId,
                        characterId: options.characterId,
                        role
                    });
                }
            } catch (error) {
                this.logger.error('❌ Failed to resolve model config for streaming', 'LLM', { 
                    error: error.message,
                    userId: options.userId,
                    characterId: options.characterId,
                    role
                });
            }
        } else {
            this.logger.warn('⚠️ Model resolution skipped - missing LLMConfigService or user context', 'LLM', {
                hasLLMConfig: !!this.llmConfig,
                hasUserId: !!options?.userId,
                hasCharacterId: !!options?.characterId
            });
        }
        
        // Final validation - model MUST be set
        if (!model) {
            const errorMsg = 'No model configured. Please set global LLM configuration in database.';
            this.logger.error('❌ CRITICAL: No model available for streaming request', 'LLM', {
                userId: options?.userId,
                characterId: options?.characterId,
                role
            });
            throw new Error(errorMsg);
        }
        
        // Get server type from configuration
        const serverType = this.config?.serverType || 'lmstudio';
        
        // Build base config
        const baseConfig = {
            model: model,
            messages: messages,
            max_tokens: maxTokens,
            temperature: temperature,
            stream: true // Enable streaming
        };
        
        // Adapt parameters for server type
        const adaptedConfig = this.adaptParameters(baseConfig, serverType);
        
        this.logger.debug('Prepared streaming request body', 'LLM', {
            model: adaptedConfig.model,
            temperature: adaptedConfig.temperature,
            maxTokens: adaptedConfig.max_tokens || adaptedConfig.num_predict,
            messagesCount: adaptedConfig.messages?.length,
            endpoint: this.config.endpoint
        });
        
        return adaptedConfig;
    }

    /**
     * INFRASTRUCTURE LAYER: Process streaming request with native Node.js HTTP
     */
    async processStreamingRequestNative(requestBody, onChunk, startTime) {
        const https = require('https');
        const http = require('http');
        const url = require('url');
        
        return new Promise((resolve, reject) => {
            const streamStartTime = Date.now();
            let fullContent = '';
            let buffer = '';
            let chunkCount = 0;
            let firstChunkReceived = false;
            
            // Parse the endpoint URL
            const parsedUrl = url.parse(this.config.endpoint);
            const isHttps = parsedUrl.protocol === 'https:';
            const client = isHttps ? https : http;
            
            const requestOptions = {
                hostname: parsedUrl.hostname,
                port: parsedUrl.port || (isHttps ? 443 : 80),
                path: parsedUrl.path,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'text/event-stream',
                    'Connection': 'keep-alive',
                    'Cache-Control': 'no-cache'
                }
            };
            
            this.logger.debug('Making streaming HTTP request', 'LLM', {
                hostname: requestOptions.hostname,
                port: requestOptions.port,
                path: requestOptions.path,
                model: requestBody.model,
                messagesCount: requestBody.messages?.length
            });
            
            const req = client.request(requestOptions, (res) => {
                if (res.statusCode !== 200) {
                    reject(new Error(`LLM request failed: ${res.statusCode} ${res.statusMessage}`));
                    return;
                }
                
                // Process data immediately as it arrives
                res.on('data', (chunk) => {
                    if (!firstChunkReceived) {
                        this.logger.debug(`LLM: First chunk received after ${Date.now() - streamStartTime}ms`, 'LLM');
                        firstChunkReceived = true;
                    }
                    
                    // Decode chunk immediately
                    const chunkText = chunk.toString('utf8');
                    buffer += chunkText;
                    
                    // Process ALL lines immediately
                    const lines = buffer.split('\n');
                    
                    // Keep the last potentially incomplete line in buffer
                    if (buffer.endsWith('\n')) {
                        buffer = '';
                    } else {
                        buffer = lines.pop() || '';
                    }
                    
                    // Process all complete lines immediately
                    for (const line of lines) {
                        if (line.trim() === '') continue;
                        if (line.startsWith('data: ')) {
                            const data = line.slice(6);
                            
                            if (data === '[DONE]') {
                                this.logger.debug(`LLM: Stream ended after ${chunkCount} chunks in ${Date.now() - streamStartTime}ms`, 'LLM');
                                const responseTime = Date.now() - startTime;
                                this.updateMetrics(responseTime, true);
                                resolve({
                                    content: fullContent,
                                    usage: null,
                                    model: this.config.model,
                                    timestamp: Date.now(),
                                    cached: false,
                                    streaming: true
                                });
                                return;
                            }
                            
                            try {
                                const parsed = JSON.parse(data);
                                const content = parsed.choices?.[0]?.delta?.content;
                                
                                if (content) {
                                    fullContent += content;
                                    chunkCount++;
                                    
                                    // Call the chunk callback immediately for real-time streaming
                                    if (onChunk && typeof onChunk === 'function') {
                                        this.logger.debug(`LLM: Streaming chunk #${chunkCount} (${content.length} chars)`, 'LLM');
                                        onChunk(content, fullContent);
                                    }
                                }
                            } catch (parseError) {
                                // Silently skip malformed chunks to maintain stream flow
                            }
                        }
                    }
                });
                
                res.on('end', () => {
                    this.logger.debug(`Streaming LLM response completed (${Date.now() - startTime}ms)`, 'LLM');
                    const responseTime = Date.now() - startTime;
                    this.updateMetrics(responseTime, true);
                    resolve({
                        content: fullContent,
                        usage: null,
                        model: this.config.model,
                        timestamp: Date.now(),
                        cached: false,
                        streaming: true
                    });
                });
                
                res.on('error', (error) => {
                    this.logger.error('Streaming response error', 'LLM', {
                        error: error.message
                    });
                    const responseTime = Date.now() - startTime;
                    this.updateMetrics(responseTime, false);
                    reject(error);
                });
            });
            
            req.on('error', (error) => {
                this.logger.error('Streaming request error', 'LLM', {
                    error: error.message
                });
                const responseTime = Date.now() - startTime;
                this.updateMetrics(responseTime, false);
                reject(error);
            });
            
            // Send the request body
            req.write(JSON.stringify(requestBody));
            req.end();
        });
    }

    /**
     * INFRASTRUCTURE LAYER: Queue request for processing
     */
    async queueRequest(request) {
        return new Promise((resolve, reject) => {
            // Add timestamp and promise resolvers to request
            request.timestamp = Date.now();
            request.resolve = resolve;
            request.reject = reject;
            
            this.requestQueue.push(request);
            
            // Start processing if not already running
            if (!this.processingQueue) {
                this.processQueue();
            }
        });
    }

    /**
     * INFRASTRUCTURE LAYER: Process request queue with rate limiting
     */
    async processQueue() {
        if (this.processingQueue || this.requestQueue.length === 0) {
            return;
        }
        
        this.processingQueue = true;
        
        while (this.requestQueue.length > 0) {
            // Check rate limits
            if (!this.checkRateLimit()) {
                this.logger.debug('Rate limit reached, waiting', 'LLM');
                await this.sleep(1000); // Wait 1 second
                continue;
            }
            
            const request = this.requestQueue.shift();
            
            try {
                const result = await this.processLLMRequest(request);
                request.resolve(result);
            } catch (error) {
                const wrappedError = this.errorHandler.wrapDomainError(
                    error,
                    'LLM request processing failed',
                    { requestType: request.type }
                );
                request.reject(wrappedError);
            }
        }
        
        this.processingQueue = false;
    }

    /**
     * INFRASTRUCTURE LAYER: Process individual LLM request
     */
    async processLLMRequest(request) {
        const startTime = Date.now();
        
        try {
            // Increment request counters
            this.llmMetrics.totalRequests++;
            this.rateLimitConfig.currentRequests++;
            
            // Check connection before processing
            if (!await this.checkConnection()) {
                throw new Error('LLM service not available - connection failed');
            }
            
            // Prepare request body
            const requestBody = await this.prepareRequestBody(request);
            
            // Make HTTP request to LLM with timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);
            
            this.logger.debug('Making LLM request', 'LLM', {
                endpoint: this.config.endpoint
            });
            
            const response = await fetch(this.config.endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`LLM request failed: ${response.status} ${response.statusText}`);
            }
            
            const result = await this.processLLMResponse(response, request);
            
            const responseTime = Date.now() - startTime;
            this.updateMetrics(responseTime, true);
            this.llmMetrics.successfulRequests++;
            
            this.logger.debug('LLM response generated', 'LLM', {
                tokens: result.usage?.total_tokens || 'unknown',
                responseTime: responseTime
            });
            
            return result;
            
        } catch (error) {
            const responseTime = Date.now() - startTime;
            this.updateMetrics(responseTime, false);
            this.llmMetrics.failedRequests++;
            
            // Enhanced error handling for different error types
            if (error.name === 'AbortError') {
                throw new Error('LLM request timed out - the model may be overloaded');
            } else if (error.code === 'ECONNRESET' || error.code === 'ECONNREFUSED') {
                throw new Error('LLM connection was reset - server may be overloaded or restarting');
            } else if (error.message.includes('fetch')) {
                throw new Error('LLM service unavailable - please check if LLM server is running');
            }
            
            throw error;
        }
    }

    /**
     * INFRASTRUCTURE LAYER: Prepare request body
     */
    async prepareRequestBody(request) {
        const messages = await this.buildConversationMessages(
            request.prompt, 
            request.context, 
            request.options
        );
        
        // Resolve model configuration with cascade: character → user → global
        let resolvedConfig = null;
        let model = null;
        let temperature = request.options?.temperature || this.config?.temperature || 0.7;
        let maxTokens = request.options?.maxTokens || this.config?.maxTokens || 2048;
        let configSource = 'unknown';
        
        // Determine role based on request options (default to conversational)
        const role = request.options?.role || 'conversational';
        
        // Try to resolve config if llmConfig service is available and we have user context
        if (this.llmConfig && (request.options?.userId || request.options?.characterId)) {
            try {
                resolvedConfig = await this.llmConfig.resolveModelConfig(
                    request.options.userId,
                    request.options.characterId,
                    role
                );
                
                if (resolvedConfig && resolvedConfig.model) {
                    // Use resolved config values from cascade
                    model = resolvedConfig.model;
                    temperature = resolvedConfig.temperature !== undefined ? resolvedConfig.temperature : temperature;
                    maxTokens = resolvedConfig.max_tokens !== undefined ? resolvedConfig.max_tokens : maxTokens;
                    
                    // Determine configuration source for logging
                    if (request.options.characterId) {
                        configSource = 'character-specific';
                    } else {
                        configSource = 'user-default';
                    }
                    
                    this.logger.info('✅ Model resolved via LLMConfigService cascade', 'LLM', { 
                        model, 
                        role,
                        source: configSource,
                        userId: request.options.userId,
                        characterId: request.options.characterId,
                        temperature,
                        maxTokens
                    });
                } else {
                    this.logger.warn('⚠️ LLMConfigService returned null - check database configuration', 'LLM', {
                        userId: request.options.userId,
                        characterId: request.options.characterId,
                        role
                    });
                }
            } catch (error) {
                this.logger.error('❌ Failed to resolve model config', 'LLM', { 
                    error: error.message,
                    userId: request.options?.userId,
                    characterId: request.options?.characterId,
                    role
                });
            }
        } else {
            this.logger.warn('⚠️ Model resolution skipped - missing LLMConfigService or user context', 'LLM', {
                hasLLMConfig: !!this.llmConfig,
                hasUserId: !!request.options?.userId,
                hasCharacterId: !!request.options?.characterId
            });
        }
        
        // Final validation - model MUST be set
        if (!model) {
            const errorMsg = 'No model configured. Please set global LLM configuration in database.';
            this.logger.error('❌ CRITICAL: No model available for request', 'LLM', {
                userId: request.options?.userId,
                characterId: request.options?.characterId,
                role
            });
            throw new Error(errorMsg);
        }
        
        // Get server type from configuration
        const serverType = this.config?.serverType || 'lmstudio';
        
        // Build base config
        const baseConfig = {
            model: model,
            messages: messages,
            max_tokens: maxTokens,
            temperature: temperature,
            stream: false
        };
        
        // Adapt parameters for server type
        const adaptedConfig = this.adaptParameters(baseConfig, serverType);
        
        return adaptedConfig;
    }

    /**
     * DOMAIN LAYER: Build conversation messages for LLM
     */
    async buildConversationMessages(prompt, context, options) {
        const messages = [];
        
        // Add system message if provided
        if (options.systemPrompt) {
            messages.push({
                role: 'system',
                content: options.systemPrompt
            });
        }
        
        // Add context messages
        if (context && context.length > 0) {
            // Limit context to last 5 messages to prevent memory issues
            const limitedContext = context.slice(-5);
            
            for (const contextMessage of limitedContext) {
                const processedMessage = this.processContextMessage(contextMessage);
                if (processedMessage) {
                    messages.push(processedMessage);
                }
            }
        }
        
        // Add the main prompt
        messages.push({
            role: 'user',
            content: prompt
        });
        
        this.logger.debug(`Building conversation with ${messages.length} messages`, 'LLM');
        
        return messages;
    }

    /**
     * DOMAIN LAYER: Process individual context message
     */
    processContextMessage(contextMessage) {
        let content;
        let role = 'user';
        
        if (typeof contextMessage === 'string') {
            content = contextMessage;
        } else if (contextMessage && typeof contextMessage === 'object') {
            if (contextMessage.content) {
                content = contextMessage.content;
            } else if (contextMessage.message) {
                content = contextMessage.message;
            } else {
                content = JSON.stringify(contextMessage);
            }
            
            if (contextMessage.role) {
                role = contextMessage.role;
            } else if (contextMessage.sender === 'agent') {
                role = 'assistant';
            }
        } else {
            content = String(contextMessage);
        }
        
        // Only return if we have valid content and it's not too long
        if (content && content.trim() && content.length < 2000) {
            return {
                role: role,
                content: content.trim()
            };
        }
        
        return null;
    }

    /**
     * INFRASTRUCTURE LAYER: Process LLM response
     */
    async processLLMResponse(response, request) {
        const data = await response.json();
        
        if (!data.choices || data.choices.length === 0) {
            throw new Error('No response from LLM');
        }
        
        const choice = data.choices[0];
        let llmResponse = '';
        
        // Handle different response formats from various models
        if (choice.message.content && choice.message.content.trim()) {
            llmResponse = choice.message.content.trim();
        } else if (choice.message.reasoning_content && choice.message.reasoning_content.trim()) {
            // Some models put the actual response in reasoning_content
            llmResponse = choice.message.reasoning_content.trim();
        } else {
            throw new Error('No content found in LLM response');
        }
        
        this.logger.debug('LLM response processed', 'LLM', {
            tokens: data.usage?.total_tokens || 'unknown',
            model: data.model
        });
        
        return {
            content: llmResponse,
            usage: data.usage,
            model: data.model || this.config.model,
            timestamp: Date.now(),
            cached: false
        };
    }

    /**
     * DOMAIN LAYER: Build analysis prompt
     */
    buildAnalysisPrompt(text, analysisType) {
        const prompts = {
            sentiment: `Analyze the sentiment of the following text: "${text}". Respond with JSON: {"sentiment": "positive|negative|neutral", "confidence": 0-1, "explanation": "brief explanation"}`,
            
            topics: `Extract the main topics from the following text: "${text}". Respond with JSON: {"topics": ["topic1", "topic2"], "confidence": 0-1}`,
            
            intent: `Determine the intent of the following text: "${text}". Respond with JSON: {"intent": "question|request|complaint|compliment|other", "confidence": 0-1}`,
            
            summary: `Provide a concise summary of the following text: "${text}". Keep it under 100 words.`,
            
            keywords: `Extract key terms and phrases from: "${text}". Respond with JSON: {"keywords": ["term1", "term2"], "phrases": ["phrase1", "phrase2"]}`
        };
        
        return prompts[analysisType] || `Analyze the following text: "${text}"`;
    }

    /**
     * INFRASTRUCTURE LAYER: Adapt parameters for different server types
     * Ollama uses 'num_predict', OpenAI/LMStudio use 'max_tokens'
     */
    adaptParameters(config, serverType) {
        if (!config) return {};
        
        const adapted = { ...config };
        
        // Handle max_tokens vs num_predict based on server type
        if (serverType === 'ollama' && adapted.max_tokens) {
            adapted.num_predict = adapted.max_tokens;
            delete adapted.max_tokens;
        } else if ((serverType === 'lmstudio' || serverType === 'openai') && adapted.num_predict) {
            adapted.max_tokens = adapted.num_predict;
            delete adapted.num_predict;
        }
        // For 'custom' server type, pass as-is
        
        return adapted;
    }

    /**
     * INFRASTRUCTURE LAYER: Rate limiting
     */
    checkRateLimit() {
        const now = Date.now();
        const windowDuration = 60000; // 1 minute
        
        // Reset window if needed
        if (now - this.rateLimitConfig.windowStart > windowDuration) {
            this.rateLimitConfig.currentRequests = 0;
            this.rateLimitConfig.windowStart = now;
        }
        
        return this.rateLimitConfig.currentRequests < this.rateLimitConfig.requestsPerMinute;
    }

    /**
     * INFRASTRUCTURE LAYER: Start queue processor
     */
    startQueueProcessor() {
        // Start processing queue every 100ms
        setInterval(() => {
            if (!this.processingQueue && this.requestQueue.length > 0) {
                this.processQueue();
            }
        }, 100);
    }

    /**
     * INFRASTRUCTURE LAYER: Update performance metrics
     */
    updateMetrics(responseTime, success) {
        this.llmMetrics.lastRequestTime = Date.now();
        this.llmMetrics.totalResponseTime += responseTime;
        
        if (success) {
            this.llmMetrics.successfulRequests++;
        } else {
            this.llmMetrics.failedRequests++;
        }
        
        // Calculate average response time
        const totalRequests = this.llmMetrics.successfulRequests + this.llmMetrics.failedRequests;
        if (totalRequests > 0) {
            this.llmMetrics.averageResponseTime = Math.round(this.llmMetrics.totalResponseTime / totalRequests);
        }
    }

    /**
     * APPLICATION LAYER: Get success rate
     */
    getSuccessRate() {
        const total = this.llmMetrics.successfulRequests + this.llmMetrics.failedRequests;
        if (total === 0) return 100;
        return Math.round((this.llmMetrics.successfulRequests / total) * 100);
    }

    /**
     * UTILITY: Sleep function
     */
    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * CLEAN ARCHITECTURE: Enhanced health check
     */
    async onHealthCheck() {
        try {
            const healthCheckStart = Date.now();
            const isConnected = await this.checkConnection();
            const responseTime = Date.now() - healthCheckStart;
            
            this.connectionHealthy = isConnected;
            this.lastHealthCheck = Date.now();
            
            return {
                healthy: isConnected && responseTime < 5000, // 5 second threshold
                details: {
                    connected: isConnected,
                    responseTime,
                    endpoint: this.config?.endpoint,
                    queueLength: this.requestQueue.length,
                    totalRequests: this.llmMetrics.totalRequests,
                    successRate: this.getSuccessRate(),
                    averageResponseTime: this.llmMetrics.averageResponseTime
                }
            };
        } catch (error) {
            return {
                healthy: false,
                details: {
                    error: error.message,
                    connected: false
                }
            };
        }
    }

    /**
     * APPLICATION LAYER: Get service metrics
     */
    getServiceMetrics() {
        return {
            ...this.llmMetrics,
            queueLength: this.requestQueue.length,
            connectionHealthy: this.connectionHealthy,
            rateLimitStatus: {
                requestsPerMinute: this.rateLimitConfig.requestsPerMinute,
                currentRequests: this.rateLimitConfig.currentRequests,
                windowStart: this.rateLimitConfig.windowStart
            }
        };
    }
}

module.exports = LLMService;