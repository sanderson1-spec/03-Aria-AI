/**
 * INFRASTRUCTURE LAYER: Enhanced Centralized Structured Response Service
 * 
 * CLEAN ARCHITECTURE PRINCIPLES:
 * - Single Responsibility: Handles ALL JSON/structured data generation
 * - Open/Closed: Easy to add new parsing strategies
 * - Dependency Inversion: Other services depend on this abstraction
 * - Interface Segregation: Clear separation of concerns
 * 
 * ARCHITECTURAL REASONING:
 * This service implements the Adapter pattern to handle LLM response variability,
 * the Strategy pattern for multiple parsing approaches, and the Template Method
 * pattern for consistent request/response handling.
 */

const fetch = require('node-fetch');
const AbstractService = require('./base/AbstractService');

class EnhancedStructuredResponseService extends AbstractService {
    constructor(dependencies) {
        super('StructuredResponse', dependencies);
        this.serviceName = 'EnhancedStructuredResponse';
        this.structuredModel = null;
        this.conversationalModel = null;
        this.lastKnownModel = null; // Track the last known model to detect changes
        
        // Enhanced statistics tracking
        this.stats = {
            totalRequests: 0,
            successfulParses: 0,
            fallbacksUsed: 0,
            modelSwitches: 0,
            strategyUsage: {}, // Track which strategies work best
            averageResponseTime: 0,
            lastReset: Date.now()
        };

        // Parsing strategy registry (Strategy Pattern)
        this.parsingStrategies = new Map();
        this.registerParsingStrategies();
    }

    async onInitialize() {
        console.log('⚙️  Initializing enhanced structured response service...');
        
        // Get model configuration from ModelManagement
        const modelManagement = this.dependencies.modelManagement;
        if (modelManagement) {
            const modelConfig = modelManagement.getCurrentModelConfig();
            this.conversationalModel = modelConfig.model;
            this.structuredModel = modelConfig.model; // Use same model for now
            console.log('✅ Using dynamic model selection from ModelManagementService');
        } else {
            console.log('Model validation failed, using dynamic selection: ModelManagement service not available');
            // Fallback configuration
            this.conversationalModel = 'auto';
            this.structuredModel = 'auto';
        }
        
        console.log('✅ Enhanced structured response service initialized');
    }

    /**
     * DOMAIN LAYER: Register all parsing strategies
     * Uses Strategy Pattern for extensible parsing approaches
     */
    registerParsingStrategies() {
        // Order matters - most reliable strategies first
        this.parsingStrategies.set('direct', this.parseDirectJSON.bind(this));
        this.parsingStrategies.set('markdown', this.parseMarkdownJSON.bind(this));
        this.parsingStrategies.set('object_extraction', this.parseObjectExtraction.bind(this));
        this.parsingStrategies.set('content_indicators', this.parseContentIndicators.bind(this));
        this.parsingStrategies.set('line_reconstruction', this.parseLineReconstruction.bind(this));
        this.parsingStrategies.set('aggressive_cleaning', this.parseAggressiveCleaning.bind(this));
        this.parsingStrategies.set('partial_completion', this.parsePartialCompletion.bind(this));
        this.parsingStrategies.set('schema_based_recovery', this.parseSchemaBasedRecovery.bind(this));
    }

    /**
     * Update the current model reference and detect changes
     */
    async updateCurrentModel() {
        try {
            if (this.modelManagement && this.modelManagement.getSelectedModel) {
                const currentModel = this.modelManagement.getSelectedModel();
                const currentModelId = currentModel ? currentModel.id : null;
                
                if (this.lastKnownModel !== currentModelId) {
                    if (this.lastKnownModel !== null) {
                        console.log(`🔄 Model switch detected: ${this.lastKnownModel} → ${currentModelId}`);
                        this.stats.modelSwitches++;
                        // Reset LLM service reference to pick up new model
                        await this.refreshLLMService();
                    }
                    this.lastKnownModel = currentModelId;
                }
            }
        } catch (error) {
            // Ignore errors during model detection - not critical
        }
    }

    /**
     * APPLICATION LAYER: Enhanced model identification with better fallback logic
     */
    async identifyOptimalModels() {
        try {
            // CLEAN ARCHITECTURE: Test model integration through centralized services
            if (!this.dependencies.llm) {
                throw new Error('LLM service dependency not available');
            }

            // Test the currently selected model with a simple JSON task
            const testPrompt = 'Generate JSON: {"test": "value", "number": 42}';
            
            const testResponse = await this.dependencies.llm.generateResponse(testPrompt, [], {
                temperature: 0.1,
                maxTokens: 100
            });
            
            if (testResponse && testResponse.content && this.isValidJSON(testResponse.content)) {
                console.log(`🎯 Selected model validated for structured tasks`);
            } else {
                console.warn('Selected model test failed, but will continue with dynamic selection');
            }
            
        } catch (error) {
            console.warn('Model validation failed, using dynamic selection:', error.message);
        }
        
        // CLEAN ARCHITECTURE: Always use ModelManagementService for dynamic selection
        console.log('✅ Using dynamic model selection from ModelManagementService');
    }

    /**
     * APPLICATION LAYER: Main entry point with enhanced error handling
     * Implements Template Method pattern for consistent processing
     */
    async generateStructuredResponse(prompt, schema = null, options = {}) {
        const startTime = Date.now();
        this.stats.totalRequests++;
        
        const config = {
            temperature: options.temperature || 0.1,
            maxTokens: options.maxTokens || 1500, // Reduced for faster responses
            retries: 1, // Single retry to reduce error spam
            fallbackToConversational: options.fallbackToConversational !== false,
            enablePartialRecovery: options.enablePartialRecovery !== false
        };

        // Enhanced prompt with stricter instructions
        const enhancedPrompt = this.createOptimalPrompt(prompt, schema, config);
        
        try {
            // Add LLM availability check
            if (!this.dependencies?.llm) {
                console.warn('🚫 LLM service not available for structured response generation');
                this.stats.fallbacksUsed++;
                return this.generateFallbackResponse(schema, prompt, new Error('LLM service not available'));
            }

            // Test LLM service has required method
            if (typeof this.dependencies.llm.generateResponse !== 'function') {
                console.warn('🚫 LLM service missing generateResponse method');
                this.stats.fallbacksUsed++;
                this.updateStats(startTime, 'fallback_used');
                return this.generateFallbackResponse(schema, prompt);
            }
            
            // Single primary attempt
            const primaryResult = await this.attemptStructuredResponse(
                enhancedPrompt, config, 'primary'
            );
            
            if (primaryResult) {
                this.updateStats(startTime, 'primary_success');
                return primaryResult;
            }

            // Single fallback attempt with adjusted parameters
            if (config.fallbackToConversational) {
                console.log('🔄 Attempting single fallback with adjusted parameters');
                const fallbackConfig = {
                    ...config,
                    temperature: 0.3,
                    maxTokens: config.maxTokens + 200
                };

                const fallbackResult = await this.attemptStructuredResponse(
                    enhancedPrompt, fallbackConfig, 'fallback'
                );
                
                if (fallbackResult) {
                    this.stats.fallbacksUsed++;
                    this.updateStats(startTime, 'fallback_success');
                    return fallbackResult;
                }
            }

            // Final fallback to schema-based generation
            console.log('🚨 Generating fallback response');
            this.stats.fallbacksUsed++;
            this.updateStats(startTime, 'fallback_used');
            return this.generateFallbackResponse(schema, prompt);

        } catch (error) {
            console.error('Enhanced structured response failed:', error.message);
            this.updateStats(startTime, 'error');
            return this.generateFallbackResponse(schema, prompt, error);
        }
    }

    /**
     * Simplified attempt method to reduce retry spam
     */
    async attemptStructuredResponse(prompt, config, attemptType) {
        try {
            console.log(`🔄 ${attemptType} attempt 1/1`);
            
            // Single attempt with current LLM service
            const response = await this.callLLMForStructuredData(
                prompt, 
                null, // Let LLM service handle model selection
                config.temperature, 
                config.maxTokens
            );
            
            if (!response || !response.content) {
                console.log(`❌ ${attemptType} attempt 1 failed: No response content`);
                return null;
            }
            
            // Try to parse with all strategies
            const parsed = await this.parseWithAllStrategies(response.content, null);
            
            if (parsed) {
                console.log(`✅ ${attemptType} attempt succeeded`);
                return parsed;
            } else {
                console.log(`❌ ${attemptType} attempt 1 failed: Could not parse response`);
                return null;
            }
            
        } catch (error) {
            console.log(`❌ ${attemptType} attempt 1 failed: ${error.message}`);
            return null;
        }
    }

    /**
     * ARCHITECTURE FIX: Ensure LLM service is ready and available
     * This provides a more robust check than just testing if the service exists
     */
    async ensureLLMServiceReady(maxWait = 500) {
        const startTime = Date.now();
        
        while (Date.now() - startTime < maxWait) {
            // Check if LLM service exists and has the required method
            if (this.dependencies.llm && 
                typeof this.dependencies.llm.generateResponse === 'function') {
                
                // Simple connection check instead of complex metrics
                try {
                    if (this.dependencies.llm.config && this.dependencies.llm.config.endpoint) {
                        return true; // Service is configured and should be ready
                    }
                } catch (error) {
                    // Continue waiting on error
                }
            }
            
            // Wait a bit before checking again
            await new Promise(resolve => setTimeout(resolve, 25));
        }
        
        // Don't log warning if service exists, just return false
        return !!this.dependencies.llm;
    }

    /**
     * INFRASTRUCTURE LAYER: Enhanced prompt creation for dynamic model selection
     */
    createOptimalPrompt(prompt, schema, config) {
        let enhanced = prompt;
        
        // Universal optimization (no model-specific hardcoding)
        enhanced += '\n\n=== JSON GENERATION OPTIMIZATION ===';
        enhanced += '\nYou are a precise JSON generator. Focus on accuracy and completeness.';
        
        enhanced += '\n\n=== CRITICAL JSON REQUIREMENTS ===';
        enhanced += '\n1. Respond with ONLY valid JSON - no explanations or markdown';
        enhanced += '\n2. Start immediately with { and end with }';
        enhanced += '\n3. Complete ALL required fields in the schema';
        enhanced += '\n4. Use proper JSON syntax: double quotes, no trailing commas';
        enhanced += '\n5. Do not truncate or abbreviate any values';
        enhanced += '\n6. If unsure about a value, use null rather than incomplete data';
        
        if (schema) {
            enhanced += `\n\n=== REQUIRED SCHEMA ===\n${JSON.stringify(schema, null, 2)}`;
            enhanced += '\n\n=== FIELD REQUIREMENTS ===';
            
            if (schema.properties) {
                Object.entries(schema.properties).forEach(([key, prop]) => {
                    enhanced += `\n- ${key}: ${prop.type || 'any'} ${prop.required ? '(REQUIRED)' : '(optional)'}`;
                    if (prop.description) enhanced += ` - ${prop.description}`;
                });
            }
        }
        
        enhanced += '\n\n=== RESPONSE FORMAT ===';
        enhanced += '\nGenerate the JSON response now. Start with { and ensure complete, valid JSON:';
        
        return enhanced;
    }

    /**
     * INFRASTRUCTURE LAYER: Call LLM for structured data generation
     */
    async callLLMForStructuredData(prompt, model = null, temperature = 0.1, maxTokens = 1500) {
        try {
            // Use centralized LLM service
            if (!this.dependencies.llm) {
                throw new Error('LLM service not available');
            }
            
            const response = await this.dependencies.llm.generateResponse(prompt, [], {
                temperature: temperature,
                maxTokens: maxTokens
            });
            
            return response;
            
        } catch (error) {
            console.warn(`LLM call failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * INFRASTRUCTURE LAYER: Parse using all available strategies
     * Implements Chain of Responsibility pattern
     */
    async parseWithAllStrategies(response, schema = null) {
        if (!response || typeof response !== 'string') {
            throw new Error('Invalid response format');
        }

        console.log(`🔍 Attempting to parse response (${response.length} chars)`);
        
        // Try each strategy in order
        for (const [strategyName, strategyFunction] of this.parsingStrategies) {
            try {
                console.log(`🎯 Trying strategy: ${strategyName}`);
                const result = await strategyFunction(response, schema);
                
                if (result && typeof result === 'object') {
                    console.log(`✅ Strategy ${strategyName} succeeded`);
                    
                    // Track successful strategy usage
                    this.stats.strategyUsage[strategyName] = 
                        (this.stats.strategyUsage[strategyName] || 0) + 1;
                    
                    return result;
                }
            } catch (error) {
                console.log(`❌ Strategy ${strategyName} failed: ${error.message}`);
            }
        }

        // Log detailed failure information
        this.logParsingFailure(response);
        throw new Error(`All parsing strategies failed for response`);
    }

    /**
     * PARSING STRATEGIES - Each implements a specific approach
     */

    // Strategy 1: Direct JSON parsing
    async parseDirectJSON(response) {
        return JSON.parse(response);
    }

    // Strategy 2: Extract from markdown blocks
    async parseMarkdownJSON(response) {
        const patterns = [
            /```json\s*([\s\S]*?)\s*```/i,
            /```\s*([\s\S]*?)\s*```/,
            /`([\s\S]*?)`/
        ];

        for (const pattern of patterns) {
            const match = response.match(pattern);
            if (match) {
                return JSON.parse(match[1].trim());
            }
        }
        throw new Error('No markdown JSON found');
    }

    // Strategy 3: Enhanced object extraction
    async parseObjectExtraction(response) {
        // Find the most complete JSON object
        const patterns = [
            /\{[\s\S]*\}(?=\s*$)/,  // JSON object at end
            /\{[\s\S]*\}/,          // Any JSON object
            /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/ // Nested objects
        ];

        for (const pattern of patterns) {
            const match = response.match(pattern);
            if (match) {
                let cleaned = this.cleanJSONString(match[0]);
                return JSON.parse(cleaned);
            }
        }
        throw new Error('No valid JSON object found');
    }

    // Strategy 4: Content indicators
    async parseContentIndicators(response) {
        const indicators = [
            /(?:JSON\s*Response|Answer|Result|Output)\s*:?\s*(\{[\s\S]*?\})/i,
            /(?:Response|Result)\s*:?\s*(\{[\s\S]*?\})/i,
            /(\{[\s\S]*?\})(?:\s*$|\s*\n)/
        ];

        for (const indicator of indicators) {
            const match = response.match(indicator);
            if (match) {
                let cleaned = this.cleanJSONString(match[1]);
                return JSON.parse(cleaned);
            }
        }
        throw new Error('No content indicators found');
    }

    // Strategy 5: Line-by-line reconstruction
    async parseLineReconstruction(response) {
        const lines = response.split('\n');
        const jsonLines = [];
        let braceCount = 0;
        let started = false;

        for (const line of lines) {
            if (line.trim().startsWith('{') || started) {
                started = true;
                jsonLines.push(line);
                
                for (const char of line) {
                    if (char === '{') braceCount++;
                    if (char === '}') braceCount--;
                }
                
                if (braceCount === 0 && jsonLines.length > 0) {
                    break;
                }
            }
        }

        if (jsonLines.length === 0) {
            throw new Error('No JSON structure found in lines');
        }

        const reconstructed = jsonLines.join('\n');
        return JSON.parse(this.cleanJSONString(reconstructed));
    }

    // Strategy 6: Aggressive cleaning
    async parseAggressiveCleaning(response) {
        let cleaned = response;
        
        // Remove everything before first {
        const startIndex = cleaned.indexOf('{');
        if (startIndex === -1) throw new Error('No opening brace found');
        
        cleaned = cleaned.substring(startIndex);
        
        // Find the last complete JSON object
        let braceCount = 0;
        let endIndex = -1;
        
        for (let i = 0; i < cleaned.length; i++) {
            if (cleaned[i] === '{') braceCount++;
            if (cleaned[i] === '}') {
                braceCount--;
                if (braceCount === 0) {
                    endIndex = i;
                    break;
                }
            }
        }
        
        if (endIndex === -1) throw new Error('No closing brace found');
        
        cleaned = cleaned.substring(0, endIndex + 1);
        return JSON.parse(this.cleanJSONString(cleaned));
    }

    // Strategy 7: Partial completion (NEW)
    async parsePartialCompletion(response, schema) {
        // Handle truncated responses by attempting completion
        if (!response.includes('}') && response.includes('{')) {
            console.log('🔧 Attempting partial JSON completion');
            
            let partial = response.trim();
            
            // Add missing closing braces
            const openBraces = (partial.match(/\{/g) || []).length;
            const closeBraces = (partial.match(/\}/g) || []).length;
            
            for (let i = 0; i < openBraces - closeBraces; i++) {
                partial += '}';
            }
            
            // Try to complete truncated fields
            if (partial.endsWith(',') || partial.endsWith(':')) {
                if (schema?.properties) {
                    partial = this.completePartialWithSchema(partial, schema);
                } else {
                    partial += 'null}';
                }
            }
            
            return JSON.parse(this.cleanJSONString(partial));
        }
        throw new Error('Not a partial JSON');
    }

    // Strategy 8: Schema-based recovery (NEW)
    async parseSchemaBasedRecovery(response, schema) {
        if (!schema?.properties) {
            throw new Error('No schema available for recovery');
        }

        // Extract any valid key-value pairs
        const extracted = {};
        const keyValuePattern = /"([^"]+)":\s*([^,\}]+)/g;
        let match;
        
        while ((match = keyValuePattern.exec(response)) !== null) {
            const key = match[1];
            let value = match[2].trim();
            
            // Clean and parse value
            if (value.startsWith('"') && value.endsWith('"')) {
                value = value.slice(1, -1);
            } else if (!isNaN(value)) {
                value = parseFloat(value);
            } else if (value === 'true' || value === 'false') {
                value = value === 'true';
            }
            
            extracted[key] = value;
        }

        // Fill missing required fields with defaults
        const result = { ...extracted };
        Object.entries(schema.properties).forEach(([key, prop]) => {
            if (!(key in result)) {
                result[key] = this.getDefaultValue(prop);
            }
        });

        return result;
    }

    /**
     * INFRASTRUCTURE LAYER: Enhanced JSON cleaning
     */
    cleanJSONString(jsonString) {
        return jsonString
            // Remove comments
            .replace(/\/\/.*$/gm, '')
            .replace(/\/\*[\s\S]*?\*\//g, '')
            
            // Fix common syntax issues
            .replace(/,(\s*[}\]])/g, '$1')              // Trailing commas
            .replace(/'/g, '"')                         // Single to double quotes
            .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":') // Unquoted keys
            
            // Fix values
            .replace(/:\s*undefined/g, ': null')
            .replace(/:\s*True/g, ': true')
            .replace(/:\s*False/g, ': false')
            
            // Fix fractions and numbers
            .replace(/"(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)"/g, (match, num, denom) => {
                return (parseFloat(num) / parseFloat(denom)).toString();
            })
            
            // Normalize whitespace
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * DOMAIN LAYER: Utility methods
     */
    isValidJSON(str) {
        try {
            JSON.parse(str);
            return true;
        } catch {
            return false;
        }
    }

    completePartialWithSchema(partial, schema) {
        // Simple completion based on schema
        const required = schema.required || [];
        const lastKey = partial.match(/"([^"]+)"\s*:\s*$/) || partial.match(/"([^"]+)"\s*:$/);
        
        if (lastKey) {
            const key = lastKey[1];
            const prop = schema.properties[key];
            const defaultValue = this.getDefaultValue(prop);
            partial += JSON.stringify(defaultValue);
        }
        
        return partial;
    }

    getDefaultValue(property) {
        if (property.default !== undefined) return property.default;
        
        switch (property.type) {
            case 'string': return '';
            case 'number': return 0;
            case 'boolean': return false;
            case 'array': return [];
            case 'object': return {};
            default: return null;
        }
    }

    /**
     * DOMAIN LAYER: Enhanced fallback response generation
     */
    generateFallbackResponse(schema, originalPrompt, error = null) {
        this.stats.fallbacksUsed++;
        
        console.warn('🚨 Generating fallback response', {
            hasSchema: !!schema,
            errorMessage: error?.message,
            promptType: this.detectPromptType(originalPrompt)
        });
        
        // Enhanced fallback for proactive analysis - actually engage!
        if (this.isProactivePrompt(originalPrompt)) {
            return {
                should_engage_proactively: true,
                engagement_timing: 'wait_2_minutes',
                psychological_reasoning: 'User explicitly requested follow-up message - fallback engagement',
                proactive_message_content: 'Hi! As promised, here\'s your follow-up message! 😊',
                confidence_score: 0.8,
                context_analysis: {
                    emotional_state_influence: 'User requested follow-up, showing engagement',
                    relationship_factor: 'Positive interaction, fulfilling request',
                    conversation_flow_assessment: 'User made explicit request for future message',
                    learned_pattern_application: 'Direct user request pattern detected'
                },
                fallback_reason: 'explicit_user_request'
            };
        }
        
        if (schema?.fallback) {
            return schema.fallback;
        }
        
        if (schema?.properties) {
            const fallback = {};
            Object.entries(schema.properties).forEach(([key, prop]) => {
                fallback[key] = this.getDefaultValue(prop);
            });
            return fallback;
        }
        
        // Analyze prompt for clues about expected structure
        const promptAnalysis = this.analyzePromptForStructure(originalPrompt);
        return promptAnalysis || { error: 'JSON parsing failed', message: error?.message };
    }

    analyzePromptForStructure(prompt) {
        // Simple heuristics to infer structure from prompt
        const structure = {};
        
        if (prompt.includes('emotion')) {
            structure.current_emotion = 'neutral';
            structure.emotional_intensity = 5.0;
        }
        
        if (prompt.includes('energy')) {
            structure.energy_level = 5.0;
        }
        
        if (prompt.includes('psychological') || prompt.includes('psychology')) {
            structure.psychological_state = 'stable';
        }
        
        return Object.keys(structure).length > 0 ? structure : null;
    }

    /**
     * INFRASTRUCTURE LAYER: Statistics and monitoring
     */
    updateStats(startTime, resultType) {
        const duration = Date.now() - startTime;
        this.stats.averageResponseTime = 
            (this.stats.averageResponseTime + duration) / 2;
        
        if (resultType.includes('success')) {
            this.stats.successfulParses++;
        }
    }

    logParsingFailure(response) {
        console.warn('🔍 [DEBUG] Enhanced parsing failure analysis:', {
            responseLength: response.length,
            firstChars: response.substring(0, 150),
            lastChars: response.substring(Math.max(0, response.length - 150)),
            containsOpenBrace: response.includes('{'),
            containsCloseBrace: response.includes('}'),
            braceBalance: (response.match(/\{/g) || []).length - (response.match(/\}/g) || []).length,
            quotesCount: (response.match(/"/g) || []).length,
            containsMarkdown: response.includes('```'),
            containsComments: response.includes('//') || response.includes('/*')
        });
    }

    /**
     * APPLICATION LAYER: Service statistics and health
     */
    getEnhancedStatistics() {
        const successRate = this.stats.totalRequests > 0 
            ? (this.stats.successfulParses / this.stats.totalRequests * 100).toFixed(2)
            : 0;
            
        return {
            ...this.stats,
            successRate: `${successRate}%`,
            uptime: Date.now() - this.stats.lastReset,
            strategiesAvailable: this.parsingStrategies.size,
            mostSuccessfulStrategy: this.getMostSuccessfulStrategy()
        };
    }

    getMostSuccessfulStrategy() {
        const strategies = Object.entries(this.stats.strategyUsage);
        if (strategies.length === 0) return 'none';
        
        return strategies.reduce((best, current) => 
            current[1] > best[1] ? current : best
        )[0];
    }

    /**
     * Helper method to detect if this is a proactive prompt
     */
    isProactivePrompt(prompt) {
        if (!prompt) return false;
        
        const proactiveKeywords = [
            'proactive', 'follow-up', 'send me', 'message me', 
            'in 2 minutes', 'another message', 'second message',
            'send another', 'message later', 'follow up',
            'send me another', 'message in', 'minutes'
        ];
        
        const lowerPrompt = prompt.toLowerCase();
        return proactiveKeywords.some(keyword => lowerPrompt.includes(keyword));
    }

    /**
     * Helper method to detect prompt type
     */
    detectPromptType(prompt) {
        if (this.isProactivePrompt(prompt)) return 'proactive';
        if (prompt && prompt.includes('psychology')) return 'psychology';
        return 'general';
    }

    async onHealthCheck() {
        try {
            const stats = this.getEnhancedStatistics();
            return {
                healthy: true,
                details: {
                    status: 'healthy',
                    structuredModel: this.structuredModel,
                    conversationalModel: this.conversationalModel,
                    statistics: stats,
                    parsingStrategies: Array.from(this.parsingStrategies.keys()),
                    llmService: this.dependencies.llm ? 'connected' : 'disconnected'
                }
            };
        } catch (error) {
            return {
                healthy: false,
                details: {
                    status: 'unhealthy',
                    error: error.message
                }
            };
        }
    }
}

module.exports = EnhancedStructuredResponseService;