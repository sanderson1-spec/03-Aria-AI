const AbstractService = require('./base/AbstractService');
const fetch = require('node-fetch');

/**
 * Centralized LLM Service
 * 
 * CLEAN ARCHITECTURE DESIGN:
 * - Domain Layer: LLM request processing and response handling
 * - Application Layer: Provider abstraction and request orchestration  
 * - Infrastructure Layer: Network communication and caching
 * 
 * This service provides:
 * - Single LLMStudio client instance management
 * - Request queuing and rate limiting
 * - Response caching with intelligent cache keys
 * - Health monitoring of LLM connection
 * - Unified interface for all LLM operations
 * - Provider adapter pattern for future extensibility (Ollama/OpenAI)
 */
class LLMService extends AbstractService {
    constructor(dependencies) {
        super('LLM', dependencies);
        
        // CLEAN ARCHITECTURE: LLM configuration and connection
        this.config = null;
        this.connectionHealthy = false;
        this.lastHealthCheck = null;
        
        // DYNAMIC CONTEXT: ConversationMemory integration
        this.conversationMemory = dependencies.conversationMemory;
        
        // CLEAN ARCHITECTURE: Request queue and rate limiting
        this.requestQueue = [];
        this.processingQueue = false;
        this.rateLimitConfig = {
            requestsPerMinute: parseInt(process.env.LLM_RATE_LIMIT_RPM) || 60,
            currentRequests: 0,
            windowStart: Date.now()
        };
        
        // CLEAN ARCHITECTURE: Performance and usage metrics (separate from AbstractService metrics)
        this.llmMetrics = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            averageResponseTime: 0,
            totalResponseTime: 0,
            lastRequestTime: null
        };
        
        // CLEAN ARCHITECTURE: Provider abstraction for future extensibility
        this.providers = new Map();
        this.activeProvider = null;
        
        // Initialize LMStudio provider
        this.initializeLMStudioProvider();
    }

    /**
     * INFRASTRUCTURE LAYER: Initialize service with ModelManagement integration
     */
    async onInitialize() {
        console.log('⚙️  Initializing LLM service...');
        
        // Get model configuration from ModelManagement service
        const modelManagement = this.dependencies.modelManagement;
        if (modelManagement) {
            const modelConfig = await modelManagement.getCurrentModelConfig();
            this.config = {
                endpoint: modelConfig.endpoint,
                model: modelConfig.model,
                temperature: modelConfig.temperature || 0.7,
                maxTokens: modelConfig.maxTokens || 2048,
                timeout: modelConfig.timeout || 30000
            };
            
            // Listen for model changes
            modelManagement.on('modelChanged', (newModelConfig) => {
                this.config = {
                    ...this.config,
                    endpoint: newModelConfig.endpoint,
                    model: newModelConfig.model
                };
                console.log(`🔄 LLM service updated to use model: ${newModelConfig.model}`);
            });
        } else {
            // Fallback configuration from environment variables
            this.config = {
                endpoint: process.env.LLM_ENDPOINT || 'http://localhost:1234/v1/chat/completions',
                model: process.env.LLM_MODEL || 'auto',
                temperature: parseFloat(process.env.LLM_TEMPERATURE) || 0.7,
                maxTokens: parseInt(process.env.LLM_MAX_TOKENS) || 2048,
                timeout: parseInt(process.env.LLM_TIMEOUT) || 30000
            };
        }
        
        console.log(`🔧 LLM configuration loaded: ${this.config.endpoint}`);
        
        // Test connection
        await this.testConnection();
        
        console.log(`✅ LLM connection established: ${this.config.endpoint}`);
        console.log('✅ LLM service initialized');
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
                    provider: this.activeProvider,
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
     * CLEAN ARCHITECTURE: Load configuration from environment variables
     */
    async loadConfiguration() {
        // Load configuration from environment variables
        this.config = {
            endpoint: process.env.LLM_ENDPOINT || 'http://localhost:1234/v1/chat/completions',
            model: process.env.LLM_MODEL || 'auto',
            temperature: parseFloat(process.env.LLM_TEMPERATURE) || 0.7,
            maxTokens: parseInt(process.env.LLM_MAX_TOKENS) || 2048,
            timeout: parseInt(process.env.LLM_TIMEOUT) || 30000,
            rateLimitRpm: parseInt(process.env.LLM_RATE_LIMIT_RPM) || 60
        };
        
        // Update rate limit configuration
        this.rateLimitConfig.requestsPerMinute = this.config.rateLimitRpm;
        
        console.log(`🔧 LLM configuration loaded: ${this.config.endpoint}`);
    }

    /**
     * CLEAN ARCHITECTURE: Initialize LLM connection
     */
    async initializeConnection() {
        try {
            const isConnected = await this.checkConnection();
            if (!isConnected) {
                throw new Error(`Cannot connect to LLM endpoint: ${this.config.endpoint}`);
            }
            
            this.connectionHealthy = true;
            console.log(`✅ LLM connection established: ${this.config.endpoint}`);
            
        } catch (error) {
            const enhancedError = await this.dependencies.errorHandling.handleError(
                error, 
                'LLM connection initialization failed'
            );
            throw enhancedError;
        }
    }

    /**
     * INFRASTRUCTURE LAYER: Check LLM connection health
     */
    async checkConnection() {
        try {
            const response = await fetch(this.config.endpoint.replace('/chat/completions', '/models'), {
                method: 'GET',
                timeout: 5000
            });
            
            return response.ok;
        } catch (error) {
            console.warn(`⚠️  LLM connection check failed: ${error.message}`);
            return false;
        }
    }

    /**
     * INFRASTRUCTURE LAYER: Test connection during initialization
     */
    async testConnection() {
        const isConnected = await this.checkConnection();
        if (!isConnected) {
            throw new Error(`Cannot connect to LLM endpoint: ${this.config.endpoint}`);
        }
        return true;
    }

    /**
     * ARCHITECTURE FIX: Refresh configuration when model changes
     * This fixes stale service references during model switching
     */
    async refreshConfig() {
        try {
            console.log('🔄 LLM service refreshing configuration after model change...');
            await this.loadConfiguration();
            console.log('✅ LLM service configuration refreshed');
        } catch (error) {
            console.warn('⚠️  LLM service configuration refresh failed:', error);
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
     * APPLICATION LAYER: Generate structured response with schema validation
     */
    async generateStructuredResponse(prompt, schema, options = {}) {
        return await this.withMetrics(async () => {
            const structuredPrompt = this.buildStructuredPrompt(prompt, schema);
            
            const response = await this.generateResponse(structuredPrompt, [], {
                ...options,
                structured: true,
                schema
            });
            
            // DOMAIN LAYER: Validate response against schema
            try {
                return this.validateStructuredResponse(response, schema);
            } catch (error) {
                console.warn('⚠️  Structured response validation failed, returning raw response');
                return response;
            }
            
        }, 'generateStructuredResponse');
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
            
            console.log(`🤖 Starting streaming LLM request to: ${this.config.endpoint}`);
            
            // Use native Node.js HTTP for true streaming without fetch() buffering
            return await this.processStreamingRequestNative(requestBody, onChunk, startTime);
            
        } catch (error) {
            const responseTime = Date.now() - startTime;
            this.updateMetrics(responseTime, false);
            console.error('🤖 LLM streaming request failed:', error);
            throw error;
        }
    }

    /**
     * INFRASTRUCTURE LAYER: Prepare streaming request body
     */
    async prepareStreamingRequestBody(prompt, context, options) {
        const messages = await this.buildConversationMessages(prompt, context, options);
        
        // CLEAN ARCHITECTURE: Use ModelManagement service for dynamic model selection
        const modelManagement = this.dependencies.modelManagement;
        let selectedModel = null;
        
        if (modelManagement && typeof modelManagement.getSelectedModel === 'function') {
            const model = modelManagement.getSelectedModel();
            selectedModel = model ? model.id : null;
        }
        
        // Fallback to configuration if ModelManagement not available
        if (!selectedModel) {
            selectedModel = this.config?.model || 'auto';
        }
        
        return {
            model: selectedModel,
            messages: messages,
            max_tokens: options?.maxTokens || this.config?.maxTokens || 2048,
            temperature: options?.temperature || this.config?.temperature || 0.7,
            stream: true // Enable streaming
        };
    }

    /**
     * INFRASTRUCTURE LAYER: Process streaming request with native Node.js HTTP (no buffering)
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
            
            const req = client.request(requestOptions, (res) => {
                if (res.statusCode !== 200) {
                    reject(new Error(`LLM request failed: ${res.statusCode} ${res.statusMessage}`));
                    return;
                }
                
                // Process data immediately as it arrives - no buffering
                res.on('data', (chunk) => {
                    if (!firstChunkReceived) {
                        console.log(`🚀 LLM: First raw chunk received after ${Date.now() - streamStartTime}ms`);
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
                                console.log(`🔄 LLM: Stream ended after ${chunkCount} chunks in ${Date.now() - streamStartTime}ms`);
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
                                        console.log(`🔄 LLM: Streaming chunk #${chunkCount} (${content.length} chars, ${Date.now() - streamStartTime}ms elapsed)`);
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
                    console.log(`🤖 Streaming LLM response completed (${Date.now() - startTime}ms)`);
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
                    console.error('🤖 Streaming response error:', error);
                    const responseTime = Date.now() - startTime;
                    this.updateMetrics(responseTime, false);
                    reject(error);
                });
            });
            
            req.on('error', (error) => {
                console.error('🤖 Streaming request error:', error);
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
     * INFRASTRUCTURE LAYER: Process streaming response (Node.js compatible) - DEPRECATED
     */
    async processStreamingResponse(response, onChunk, startTime) {
        const decoder = new TextDecoder();
        let fullContent = '';
        let buffer = '';
        
        try {
            let chunkCount = 0;
            const streamStartTime = Date.now();
            
            // Add timing diagnostic for first chunk
            let firstChunkReceived = false;
            
            // Use Node.js readable stream iteration - this is the correct approach for Node.js
            for await (const chunk of response.body) {
                // Log first chunk timing for diagnostics
                if (!firstChunkReceived) {
                    console.log(`🚀 LLM: First raw chunk received after ${Date.now() - streamStartTime}ms`);
                    firstChunkReceived = true;
                }
                
                // Decode chunk immediately without additional buffering
                const chunkText = decoder.decode(chunk, { stream: true });
                buffer += chunkText;
                
                // Process ALL lines immediately, including incomplete ones for maximum responsiveness
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
                            console.log(`🔄 LLM: Stream ended after ${chunkCount} chunks in ${Date.now() - streamStartTime}ms`);
                            return {
                                content: fullContent,
                                usage: null,
                                model: this.config.model,
                                timestamp: Date.now(),
                                cached: false,
                                streaming: true
                            };
                        }
                        
                        try {
                            const parsed = JSON.parse(data);
                            const content = parsed.choices?.[0]?.delta?.content;
                            
                            if (content) {
                                fullContent += content;
                                chunkCount++;
                                
                                // Call the chunk callback immediately for real-time streaming
                                if (onChunk && typeof onChunk === 'function') {
                                    console.log(`🔄 LLM: Streaming chunk #${chunkCount} (${content.length} chars, ${Date.now() - streamStartTime}ms elapsed)`);
                                    onChunk(content, fullContent);
                                }
                            }
                        } catch (parseError) {
                            // Silently skip malformed chunks to maintain stream flow
                        }
                    }
                }
            }
            
            const responseTime = Date.now() - startTime;
            this.updateMetrics(responseTime, true);
            
            console.log(`🤖 Streaming LLM response completed (${responseTime}ms)`);
            
            return {
                content: fullContent,
                usage: null, // Usage info not available in streaming mode
                model: this.config.model,
                timestamp: Date.now(),
                cached: false,
                streaming: true
            };
            
        } catch (error) {
            const responseTime = Date.now() - startTime;
            this.updateMetrics(responseTime, false);
            console.error('🤖 Streaming response processing failed:', error);
            throw error;
        }
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
            // CLEAN ARCHITECTURE: Check rate limits
            if (!this.checkRateLimit()) {
                console.log('⏳ Rate limit reached, waiting...');
                await this.sleep(1000); // Wait 1 second
                continue;
            }
            
            const request = this.requestQueue.shift();
            
            try {
                const result = await this.processLLMRequest(request);
                request.resolve(result);
            } catch (error) {
                const enhancedError = await this.dependencies.errorHandling.handleError(
                    error,
                    'LLM request processing failed',
                    { requestType: request.type }
                );
                request.reject(enhancedError);
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
            // CLEAN ARCHITECTURE: Increment request counters
            this.llmMetrics.totalRequests++;
            this.rateLimitConfig.currentRequests++;
            
            // CLEAN ARCHITECTURE: Check connection before processing
            if (!await this.checkConnection()) {
                throw new Error('LLM service not available - connection failed');
            }
            
            // CLEAN ARCHITECTURE: Prepare request body
            const requestBody = await this.prepareRequestBody(request);
            
            // INFRASTRUCTURE LAYER: Make HTTP request to LLM with timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
            
            console.log(`🤖 Making LLM request to: ${this.config.endpoint}`);
            
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
            
            console.log(`🤖 LLM response generated (${result.usage?.total_tokens || 'unknown'} tokens)`);
            
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
                throw new Error('LLM service unavailable - please check if LMStudio is running');
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
        
        // CLEAN ARCHITECTURE: Use ModelManagement service for dynamic model selection
        const modelManagement = this.dependencies.modelManagement;
        let selectedModel = null;
        
        if (modelManagement && typeof modelManagement.getSelectedModel === 'function') {
            const model = modelManagement.getSelectedModel();
            selectedModel = model ? model.id : null;
        }
        
        // Fallback to configuration if ModelManagement not available
        if (!selectedModel) {
            selectedModel = this.config?.model || 'auto';
        }
        
        return {
            model: selectedModel,
            messages: messages,
            max_tokens: request.options?.maxTokens || this.config?.maxTokens || 2048,
            temperature: request.options?.temperature || this.config?.temperature || 0.7,
            stream: false
        };
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
        
        // DYNAMIC CONTEXT: Use intelligent context building when sessionId is available
        if (options.sessionId && this.conversationMemory) {
            try {
                // Get intelligent context using ConversationMemory
                const contextStrategy = await this.conversationMemory.determineOptimalContextStrategy(
                    options.sessionId, 
                    prompt, 
                    options
                );
                
                const intelligentContext = await this.conversationMemory.buildIntelligentContext(
                    options.sessionId,
                    prompt,
                    contextStrategy.strategy,
                    contextStrategy.contextCount
                );
                
                // Add intelligent context to messages
                for (const contextMessage of intelligentContext) {
                    if (contextMessage.content && contextMessage.content.trim() && contextMessage.content.length < 2000) {
                        messages.push({
                            role: contextMessage.role,
                            content: contextMessage.content.trim()
                        });
                    }
                }
                
                // Store context metadata for response
                options._contextMetadata = {
                    strategy: contextStrategy.strategy,
                    contextCount: intelligentContext.length,
                    processingTime: contextStrategy.processingTime,
                    reasoning: contextStrategy.reasoning
                };
                
                console.log(`🧠 Intelligent context: ${contextStrategy.strategy} (${intelligentContext.length} messages)`);
                
            } catch (error) {
                console.error('❌ Error using intelligent context, falling back:', error);
                // Fallback to original context processing
                this.addFallbackContext(messages, context);
            }
        } else {
            // FALLBACK: Original context processing when ConversationMemory not available
            this.addFallbackContext(messages, context);
        }
        
        // Add the main prompt
        messages.push({
            role: 'user',
            content: prompt
        });
        
        console.log(`🔍 Building conversation with ${messages.length} messages`);
        
        return messages;
    }

    /**
     * DYNAMIC CONTEXT: Add fallback context processing
     */
    addFallbackContext(messages, context) {
        if (context && context.length > 0) {
            // Limit context to last 5 messages to prevent memory issues (original behavior)
            const limitedContext = context.slice(-5);
            
            for (const contextMessage of limitedContext) {
                const processedMessage = this.processContextMessage(contextMessage);
                if (processedMessage) {
                    messages.push(processedMessage);
                }
            }
        }
    }

    /**
     * DYNAMIC CONTEXT: Process individual context message
     */
    processContextMessage(contextMessage) {
        let content;
        let role = 'user';
        
        if (typeof contextMessage === 'string') {
            // Simple string message
            content = contextMessage;
        } else if (contextMessage && typeof contextMessage === 'object') {
            // Extract content from message object
            if (contextMessage.content) {
                content = contextMessage.content;
            } else if (contextMessage.message) {
                content = contextMessage.message;
            } else {
                content = JSON.stringify(contextMessage);
            }
            
            // Extract role if available
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
            // Some models (like Qwen) put the actual response in reasoning_content
            llmResponse = choice.message.reasoning_content.trim();
        } else {
            throw new Error('No content found in LLM response');
        }
        
        // Log the interaction
        console.log(`🤖 LLM response generated (${data.usage?.total_tokens || 'unknown'} tokens)`);
        
        const responseObject = {
            content: llmResponse,
            usage: data.usage,
            model: data.model || this.dependencies.modelManagement.getModelForRequest(),
            timestamp: Date.now(),
            cached: false
        };
        
        // DYNAMIC CONTEXT: Include context metadata if available
        if (request.options?._contextMetadata) {
            responseObject.metadata = request.options._contextMetadata;
        }
        
        return responseObject;
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
     * DOMAIN LAYER: Build structured prompt with schema
     */
    buildStructuredPrompt(prompt, schema) {
        const schemaDescription = JSON.stringify(schema, null, 2);
        
        return `${prompt}

Please respond with valid JSON that matches this exact schema:
${schemaDescription}

Important: Return only the JSON object, no additional text or formatting.`;
    }

    /**
     * DOMAIN LAYER: Validate structured response against schema
     */
    validateStructuredResponse(response, schema) {
        try {
            const parsed = JSON.parse(response.content);
            
            // Basic schema validation (could be enhanced with a proper JSON schema validator)
            for (const requiredField of Object.keys(schema)) {
                if (!(requiredField in parsed)) {
                    throw new Error(`Missing required field: ${requiredField}`);
                }
            }
            
            return {
                ...response,
                content: parsed,
                validated: true
            };
            
        } catch (error) {
            throw new Error(`Structured response validation failed: ${error.message}`);
        }
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

    setupRateLimitReset() {
        setInterval(() => {
            this.rateLimitConfig.currentRequests = 0;
            this.rateLimitConfig.windowStart = Date.now();
        }, 60000); // Reset every minute
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
     * CLEAN ARCHITECTURE: Initialize LMStudio provider
     */
    initializeLMStudioProvider() {
        this.providers.set('lmstudio', {
            name: 'LMStudio',
            endpoint: null, // Will be set from config
            healthCheck: this.checkConnection.bind(this),
            generateResponse: this.processLLMRequest.bind(this)
        });
        
        this.activeProvider = 'lmstudio';
    }

    /**
     * UTILITY: Sleep function
     */
    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * APPLICATION LAYER: Get service metrics
     */
    getServiceMetrics() {
        return {
            ...this.metrics,
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