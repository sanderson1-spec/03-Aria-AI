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
 * 
 * SIMPLIFIED: Removed caching complexity and multiple orchestration layers
 */

const AbstractService = require('../base/CORE_AbstractService');

class StructuredResponseService extends AbstractService {
    constructor(dependencies) {
        super('StructuredResponse', dependencies);
        
        // CLEAN ARCHITECTURE: Extract dependencies
        this.llm = dependencies.llm;
        this.logger = dependencies.logger;
        this.errorHandler = dependencies.errorHandling;
        
        // Enhanced statistics tracking
        this.stats = {
            totalRequests: 0,
            successfulParses: 0,
            fallbacksUsed: 0,
            strategyUsage: {},
            averageResponseTime: 0,
            lastReset: Date.now()
        };

        // Parsing strategy registry (Strategy Pattern)
        this.parsingStrategies = new Map();
        this.registerParsingStrategies();
    }

    async onInitialize() {
        this.logger.info('Initializing StructuredResponseService', 'StructuredResponse');
        
        // Validate required dependencies
        if (!this.llm) {
            throw new Error('LLM service dependency is required');
        }
        
        this.logger.info('StructuredResponseService initialized', 'StructuredResponse');
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
    }

    /**
     * APPLICATION LAYER: Main entry point with enhanced error handling
     * Implements Template Method pattern for consistent processing
     */
    async generateStructuredResponse(prompt, schema = null, options = {}) {
        return await this.withMetrics(async () => {
            const startTime = Date.now();
            this.stats.totalRequests++;
            
            const config = {
                temperature: options.temperature || 0.1,
                maxTokens: options.maxTokens || 1500,
                retries: options.retries || 2,
                fallbackToConversational: options.fallbackToConversational !== false
            };

            // Enhanced prompt with stricter instructions
            const enhancedPrompt = this.createOptimalPrompt(prompt, schema, config);
            
            try {
                this.logger.debug('Generating structured response', 'StructuredResponse', {
                    promptLength: enhancedPrompt.length,
                    hasSchema: !!schema,
                    temperature: config.temperature
                });

                // Primary attempt
                const primaryResult = await this.attemptStructuredResponse(
                    enhancedPrompt, config, 'primary'
                );
                
                if (primaryResult) {
                    this.updateStats(startTime, 'primary_success');
                    return primaryResult;
                }

                // Single fallback attempt
                if (config.fallbackToConversational) {
                    this.logger.warn('Primary attempt failed, trying fallback', 'StructuredResponse');
                    
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
                this.logger.error('All parsing attempts failed, using schema fallback', 'StructuredResponse');
                this.stats.fallbacksUsed++;
                this.updateStats(startTime, 'fallback_used');
                return this.generateFallbackResponse(schema, prompt);

            } catch (error) {
                const wrappedError = this.errorHandler.wrapDomainError(
                    error, 
                    'Structured response generation failed'
                );
                this.logger.error('Structured response failed', 'StructuredResponse', {
                    error: wrappedError.message
                });
                this.updateStats(startTime, 'error');
                return this.generateFallbackResponse(schema, prompt, wrappedError);
            }
        }, 'generateStructuredResponse');
    }

    /**
     * INFRASTRUCTURE LAYER: Attempt structured response with retry logic
     */
    async attemptStructuredResponse(prompt, config, attemptType) {
        try {
            this.logger.debug(`Attempting ${attemptType} structured response`, 'StructuredResponse');
            
            // Use centralized LLM service
            const response = await this.llm.generateResponse(prompt, [], {
                temperature: config.temperature,
                maxTokens: config.maxTokens
            });
            
            if (!response || !response.content) {
                this.logger.warn(`${attemptType} attempt failed: No response content`, 'StructuredResponse');
                return null;
            }
            
            // Try to parse with all strategies
            const parsed = await this.parseWithAllStrategies(response.content);
            
            if (parsed) {
                this.logger.info(`${attemptType} attempt succeeded`, 'StructuredResponse');
                return parsed;
            } else {
                this.logger.warn(`${attemptType} attempt failed: Could not parse response`, 'StructuredResponse');
                return null;
            }
            
        } catch (error) {
            this.logger.error(`${attemptType} attempt failed`, 'StructuredResponse', {
                error: error.message
            });
            return null;
        }
    }

    /**
     * INFRASTRUCTURE LAYER: Enhanced prompt creation
     */
    createOptimalPrompt(prompt, schema, config) {
        let enhanced = prompt;
        
        enhanced += '\n\n=== JSON GENERATION OPTIMIZATION ===';
        enhanced += '\nYou are a precise JSON generator. Focus on accuracy and completeness.';
        
        enhanced += '\n\n=== CRITICAL JSON REQUIREMENTS ===';
        enhanced += '\n1. Respond with ONLY valid JSON - no explanations or markdown';
        enhanced += '\n2. Start immediately with { and end with }';
        enhanced += '\n3. Complete ALL required fields in the schema';
        enhanced += '\n4. Use proper JSON syntax: double quotes, no trailing commas';
        enhanced += '\n5. Do not truncate or abbreviate any values';
        
        if (schema) {
            enhanced += `\n\n=== REQUIRED SCHEMA ===\n${JSON.stringify(schema, null, 2)}`;
            
            if (schema.properties) {
                enhanced += '\n\n=== FIELD REQUIREMENTS ===';
                Object.entries(schema.properties).forEach(([key, prop]) => {
                    const required = schema.required?.includes(key) ? '(REQUIRED)' : '(optional)';
                    enhanced += `\n- ${key}: ${prop.type || 'any'} ${required}`;
                    if (prop.description) enhanced += ` - ${prop.description}`;
                });
            }
        }
        
        enhanced += '\n\n=== RESPONSE FORMAT ===';
        enhanced += '\nGenerate the JSON response now. Start with { and ensure complete, valid JSON:';
        
        return enhanced;
    }

    /**
     * INFRASTRUCTURE LAYER: Parse using all available strategies
     * Implements Chain of Responsibility pattern
     */
    async parseWithAllStrategies(response) {
        if (!response || typeof response !== 'string') {
            throw new Error('Invalid response format');
        }

        this.logger.debug(`Attempting to parse response`, 'StructuredResponse', {
            responseLength: response.length
        });
        
        // Try each strategy in order
        for (const [strategyName, strategyFunction] of this.parsingStrategies) {
            try {
                this.logger.debug(`Trying strategy: ${strategyName}`, 'StructuredResponse');
                const result = await strategyFunction(response);
                
                if (result && typeof result === 'object') {
                    this.logger.info(`Strategy ${strategyName} succeeded`, 'StructuredResponse');
                    
                    // Track successful strategy usage
                    this.stats.strategyUsage[strategyName] = 
                        (this.stats.strategyUsage[strategyName] || 0) + 1;
                    
                    return result;
                }
            } catch (error) {
                this.logger.debug(`Strategy ${strategyName} failed: ${error.message}`, 'StructuredResponse');
            }
        }

        throw new Error('All parsing strategies failed');
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
            
            // Normalize whitespace
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * DOMAIN LAYER: Generate fallback response
     */
    generateFallbackResponse(schema, originalPrompt, error = null) {
        this.stats.fallbacksUsed++;
        
        this.logger.warn('Generating fallback response', 'StructuredResponse', {
            hasSchema: !!schema,
            errorMessage: error?.message
        });
        
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
        
        return { error: 'JSON parsing failed', message: error?.message };
    }

    /**
     * UTILITY: Get default value for property type
     */
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

    /**
     * APPLICATION LAYER: Get service statistics
     */
    getStatistics() {
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

    async onHealthCheck() {
        try {
            const stats = this.getStatistics();
            return {
                healthy: true,
                details: {
                    status: 'healthy',
                    statistics: stats,
                    parsingStrategies: Array.from(this.parsingStrategies.keys()),
                    llmService: this.llm ? 'connected' : 'disconnected'
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

module.exports = StructuredResponseService;