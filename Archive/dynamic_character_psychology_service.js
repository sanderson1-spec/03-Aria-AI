const { v4: uuidv4 } = require('uuid');
const AbstractService = require('./base/AbstractService');

/**
 * Enhanced Psychology Service (formerly DynamicCharacterPsychologyService)
 * 
 * CLEAN ARCHITECTURE DESIGN:
 * - Domain Layer: Psychological framework analysis and state management
 * - Application Layer: Character-specific behavior coordination
 * - Infrastructure Layer: LLM integration and data persistence
 * 
 * This service provides:
 * - LLM-derived psychological frameworks (no hardcoded attributes)
 * - Dynamic psychological state evolution based on conversations
 * - Character-specific memory weighting and significance analysis
 * - Psychology analytics and insights
 * - Psychology evolution tracking
 * 
 * SIMPLIFIED: Removed caching complexity that was causing bugs
 * SQLite is fast enough for local operations without caching overhead
 */
class PsychologyService extends AbstractService {
    constructor(dependencies) {
        super('Psychology', dependencies);
        
        // Get dependencies
        this.logger = dependencies.logger;
        this.errorHandler = dependencies.errorHandling;
        this.database = dependencies.database;
        this.psychologyRepository = dependencies.psychologyRepository;
        this.personalityRepository = dependencies.personalityRepository;
        
        // Initialize state tracking
        this.activeStates = new Map();
        this.stateConfig = {
            defaultTtl: parseInt(process.env.PSYCHOLOGY_DEFAULT_TTL) || 24 * 60 * 60 * 1000, // 24 hours
            cleanupInterval: parseInt(process.env.PSYCHOLOGY_CLEANUP_INTERVAL) || 15 * 60 * 1000,  // 15 minutes
            maxInactiveStates: parseInt(process.env.PSYCHOLOGY_MAX_INACTIVE_STATES) || 1000
        };
        
        // Psychology analytics
        this.stateAnalytics = {
            statesCreated: 0,
            statesDestroyed: 0,
            stateUpdates: 0
        };
        
        // Framework analytics
        this.analytics = {
            frameworksCreated: 0,
            statesUpdated: 0,
            analysisRequests: 0
        };
        
        // Start cleanup interval
        this.startCleanupInterval();
    }

    /**
     * CLEAN ARCHITECTURE: Implement required abstract method
     */
    async onInitialize() {
        console.log('⚙️  Initializing psychology service...');
        
        await this.loadConfiguration();
        
        // Get enhanced JSON processing services for reliable JSON handling
        this.structuredResponse = this.dependencies.enhancedStructuredResponse || this.dependencies.structuredResponse;
        this.jsonOrchestrator = this.dependencies.jsonProcessingOrchestrator;
        
        // Add method to refresh LLM service references (for model switching scenarios)
        this.refreshLLMService = async () => {
            console.log('🔄 PsychologyService refreshing LLM service references...');
            this.structuredResponse = this.dependencies.enhancedStructuredResponse || this.dependencies.structuredResponse;
            this.jsonOrchestrator = this.dependencies.jsonProcessingOrchestrator;
            
            // Wait for services to be ready after refresh
            await new Promise(resolve => setTimeout(resolve, 100));
        };
        
        console.log('✅ Psychology service initialized');
    }

    /**
     * CLEAN ARCHITECTURE: Enhanced health check
     */
    async onHealthCheck() {
        try {
            // Test DAL connectivity
            const dal = this.getDAL();
            await dal.personalities.getPersonalityCount();
            
            return {
                healthy: true,
                details: {
                    frameworksCreated: this.analytics.frameworksCreated,
                    statesUpdated: this.analytics.statesUpdated,
                    analysisRequests: this.analytics.analysisRequests
                }
            };
        } catch (error) {
            return {
                healthy: false,
                details: {
                    error: error.message
                }
            };
        }
    }

    /**
     * CLEAN ARCHITECTURE: Load configuration from environment variables
     */
    async loadConfiguration() {
        // Load configuration from environment variables
        this.stateConfig = {
            defaultTtl: parseInt(process.env.PSYCHOLOGY_DEFAULT_TTL) || this.stateConfig.defaultTtl,
            cleanupInterval: parseInt(process.env.PSYCHOLOGY_CLEANUP_INTERVAL) || this.stateConfig.cleanupInterval,
            maxInactiveStates: parseInt(process.env.PSYCHOLOGY_MAX_INACTIVE_STATES) || this.stateConfig.maxInactiveStates
        };
    }

    /**
     * CLEAN ARCHITECTURE: Get DAL instance through database service
     */
    getDAL() {
        if (!this.dal) {
            this.dal = this.dependencies.database.getDAL();
        }
        return this.dal;
    }

    /**
     * DOMAIN LAYER: Analyze personality definition to create psychological framework
     * Uses LLM to derive character-specific psychological attributes from personality definition
     */
    async analyzePersonalityFramework(personalityDefinition, personalityName = '') {
        return await this.withMetrics(async () => {
            this.analytics.frameworksCreated++;
            
            const prompt = `Analyze this personality definition and create a psychological framework:

Personality: ${personalityName}
Definition: ${personalityDefinition}

Create a comprehensive psychological framework that captures the character's core traits, emotional patterns, and behavioral tendencies.`;

            const schema = {
                type: 'object',
                required: ['core_emotional_range', 'natural_social_motivations', 'stress_triggers'],
                properties: {
                    core_emotional_range: {
                        type: 'array',
                        description: 'Primary emotions this character naturally experiences'
                    },
                    natural_social_motivations: {
                        type: 'array', 
                        description: 'What drives this character in social interactions'
                    },
                    stress_triggers: {
                        type: 'array',
                        description: 'Situations that cause stress for this character'
                    },
                    communication_style: {
                        type: 'string',
                        description: 'How this character typically communicates'
                    },
                    relationship_approach: {
                        type: 'string',
                        description: 'How this character approaches relationships'
                    }
                },
                fallback: this.getGenericFramework()
            };

            try {
                let framework;
                
                // Use enhanced orchestrator if available, otherwise fallback to structured response
                if (this.jsonOrchestrator) {
                    framework = await this.jsonOrchestrator.processJSONRequest(prompt, schema, {
                        temperature: 0.15,
                        maxTokens: 2000, // Increased for better framework analysis
                        schemaTemplate: 'psychology',
                        retries: 3,
                        enablePartialRecovery: true
                    });
                } else {
                    framework = await this.structuredResponse.generateStructuredResponse(prompt, schema, {
                        temperature: 0.2,
                        maxTokens: 2000 // Increased from 800
                    });
                }
                
                console.log(`🧠 Created psychological framework for ${personalityName}`);
                return framework;
                
            } catch (error) {
                console.error('Failed to analyze personality framework:', error);
                return this.getGenericFramework();
            }
            
        }, 'analyzePersonalityFramework');
    }

    /**
     * DOMAIN LAYER: Fallback framework for when LLM analysis fails
     * Ensures system reliability with reasonable defaults
     */
    getGenericFramework() {
        return {
            core_emotional_range: ["neutral", "curious", "helpful"],
            natural_social_motivations: ["assist_user", "understand_needs"],
            relationship_tendencies: ["professional_but_friendly"],
            stress_triggers: ["unclear_requests"],
            energy_sources: ["helping_successfully"],
            communication_patterns: ["clear", "supportive"],
            interest_inclinations: ["user_interests"],
            behavioral_defaults: {
                default_emotional_state: "neutral",
                default_energy_level: 6,
                default_openness: 6,
                default_social_initiative: 5,
                default_stress_baseline: 3
            },
            character_specific_traits: ["helpful", "adaptive"],
            conversation_style_notes: "Professional but warm assistant style"
        };
    }

    /**
     * APPLICATION LAYER: Store personality framework - direct DAL access
     */
    async storePersonalityFramework(personalityId, framework) {
        return await this.withMetrics(async () => {
            // CLEAN ARCHITECTURE: Store through DAL - Use psychology repository
            const dal = this.getDAL();
            await dal.psychology.updatePsychologyFramework(personalityId, framework);
            
            console.log(`✅ Stored psychology framework for personality: ${personalityId}`);
        }, 'storePersonalityFramework');
    }

    /**
     * APPLICATION LAYER: Get personality framework - direct DAL access
     */
    async getPersonalityFramework(personalityId) {
        return await this.withMetrics(async () => {
            try {
                const dal = this.getDAL();
                return await dal.psychology.getPsychologyFramework(personalityId);
            } catch (error) {
                console.error('Error getting personality framework via DAL:', error);
                return null;
            }
        }, 'getPersonalityFramework');
    }

    /**
     * APPLICATION LAYER: Get current psychological state - direct DAL access
     */
    async getCharacterState(sessionId) {
        return await this.withMetrics(async () => {
            try {
                const dal = this.getDAL();
                const state = await dal.psychology.getPsychologicalState(sessionId);
                
                if (state) {
                    // Clean up any malformed JSON fields using centralized service
                    return await this.cleanupStateJsonFields(state);
                }
                
                return state || null;
            } catch (error) {
                console.error('Error getting character state:', error);
                throw error;
            }
        }, 'getCharacterState');
    }

    /**
     * INFRASTRUCTURE LAYER: Clean up malformed JSON fields using centralized service
     */
    async cleanupStateJsonFields(state) {
        const cleanedState = { ...state };
        
        // Clean up current_motivations if it's a string (should be array)
        if (state.current_motivations && typeof state.current_motivations === 'string') {
            console.log(`🔧 Fixing malformed current_motivations: "${state.current_motivations}"`);
            const fixedMotivations = await this.fixMalformedJsonField(
                state.current_motivations, 
                'array of motivations',
                ['maintain_conversation']
            );
            cleanedState.current_motivations = fixedMotivations;
            
            // Update the database with the fixed value
            await this.updateDatabaseJsonField(state.session_id, 'current_motivations', fixedMotivations);
        }
        
        // Clean up active_interests if it's a string (should be array)
        if (state.active_interests && typeof state.active_interests === 'string') {
            console.log(`🔧 Fixing malformed active_interests: "${state.active_interests}"`);
            const fixedInterests = await this.fixMalformedJsonField(
                state.active_interests, 
                'array of interests',
                ['general_topics']
            );
            cleanedState.active_interests = fixedInterests;
            
            // Update the database with the fixed value
            await this.updateDatabaseJsonField(state.session_id, 'active_interests', fixedInterests);
        }
        
        return cleanedState;
    }

    /**
     * INFRASTRUCTURE LAYER: Fix malformed JSON field using centralized service
     */
    async fixMalformedJsonField(malformedValue, expectedType, fallback) {
        try {
            const prompt = `Convert this malformed data into a proper JSON ${expectedType}:

Malformed data: "${malformedValue}"
Expected format: ${expectedType}

Convert to proper JSON format.`;

            const schema = {
                type: 'object',
                required: ['fixed_value'],
                properties: {
                    fixed_value: { 
                        type: 'array', 
                        description: `Properly formatted ${expectedType}` 
                    }
                },
                fallback: {
                    fixed_value: fallback
                }
            };

            let result;
            
            // Use enhanced orchestrator if available
            if (this.jsonOrchestrator) {
                result = await this.jsonOrchestrator.processJSONRequest(prompt, schema, {
                    temperature: 0.05, // Very low for consistent fixes
                    maxTokens: 400, // Increased for better cleanup
                    retries: 2,
                    enablePartialRecovery: true
                });
            } else {
                result = await this.structuredResponse.generateStructuredResponse(prompt, schema, {
                    temperature: 0.1,
                    maxTokens: 400 // Increased from 200
                });
            }

            return result.fixed_value || fallback;
        } catch (error) {
            console.warn(`Failed to fix malformed JSON field "${malformedValue}":`, error.message);
            return fallback;
        }
    }

    /**
     * INFRASTRUCTURE LAYER: Update a specific JSON field in the database
     */
    async updateDatabaseJsonField(sessionId, fieldName, value) {
        try {
            const dal = this.getDAL();
            const currentState = await dal.psychology.getPsychologicalState(sessionId);
            if (currentState) {
                const updatedState = { ...currentState };
                updatedState[fieldName] = value;
                await dal.psychology.updatePsychologicalState(
                    sessionId, 
                    currentState.personality_id, 
                    updatedState
                );
                console.log(`✅ Fixed database field ${fieldName} for session ${sessionId}`);
            }
        } catch (error) {
            console.warn(`Failed to update database field ${fieldName}:`, error.message);
        }
    }

    /**
     * DOMAIN LAYER: Initialize psychological state for new session
     */
    async initializeCharacterState(sessionId, personalityId, framework) {
        // Ensure framework has proper structure
        const defaults = framework?.behavioral_defaults || {
            default_emotional_state: 'neutral',
            default_energy_level: 5,
            default_stress_baseline: 3
        };
        
        const socialMotivations = framework?.natural_social_motivations || ['help', 'assist'];
        const communicationPatterns = framework?.communication_patterns || ['friendly'];
        
        try {
            const dal = this.getDAL();
            const currentState = {
                current_emotion: defaults.default_emotional_state || 'neutral',
                emotional_intensity: defaults.default_energy_level || 5,
                energy_level: defaults.default_energy_level || 5,
                stress_level: defaults.default_stress_baseline || 3,
                current_motivations: socialMotivations.slice(0, 2), // Start with primary motivations
                relationship_dynamic: 'getting_to_know',
                active_interests: [],
                communication_mode: communicationPatterns[0] || 'default',
                internal_state_notes: `Starting conversation as ${defaults.default_emotional_state || 'neutral'}`
            };
            
            await dal.psychology.updatePsychologicalState(sessionId, personalityId, currentState);
            return { sessionId, personalityId };
        } catch (error) {
            console.error('Error initializing character state:', error);
            throw error;
        }
    }

    /**
     * DOMAIN LAYER: LLM-powered psychological state analysis and update using character framework
     * Core intelligence for authentic character behavior evolution
     */
    async analyzeAndUpdateState(sessionId, conversationHistory, currentMessage, personality) {
        try {
            // Ensure we have the character framework
            const framework = await this.ensurePersonalityFramework(personality);
            
            // Get current state
            let currentState = await this.getCharacterState(sessionId);
            
            // Initialize state if it doesn't exist
            if (!currentState) {
                await this.initializeCharacterState(sessionId, personality.id, framework);
                currentState = await this.getCharacterState(sessionId);
            }

            // Create simplified prompt for better JSON compliance
            const prompt = `Analyze how this conversation affects ${personality.name}'s psychological state.

Character: ${personality.name}
Definition: ${personality.definition}

Current state:
- Emotion: ${currentState.current_emotion} (intensity: ${currentState.emotional_intensity}/10)
- Energy: ${currentState.energy_level}/10
- Stress: ${currentState.stress_level}/10
- Relationship: ${currentState.relationship_dynamic}

Latest message: "${currentMessage}"

How would this naturally affect their internal state?`;

            const schema = {
                type: 'object',
                required: ['current_emotion', 'emotional_intensity', 'energy_level', 'stress_level'],
                properties: {
                    current_emotion: { type: 'string', description: 'Primary emotion' },
                    emotional_intensity: { type: 'number', minimum: 1, maximum: 10 },
                    energy_level: { type: 'number', minimum: 1, maximum: 10 },
                    stress_level: { type: 'number', minimum: 1, maximum: 10 },
                    current_motivations: { type: 'array', description: 'Current motivations' },
                    relationship_dynamic: { type: 'string', description: 'Relationship perception' },
                    active_interests: { type: 'array', description: 'Current interests' },
                    communication_mode: { type: 'string', description: 'Communication style' },
                    internal_state_notes: { type: 'string', description: 'Internal thoughts' },
                    change_reason: { type: 'string', description: 'Reason for change' }
                },
                fallback: {
                    current_emotion: currentState.current_emotion || 'neutral',
                    emotional_intensity: currentState.emotional_intensity || 5,
                    energy_level: currentState.energy_level || 5,
                    stress_level: currentState.stress_level || 3,
                    current_motivations: ['maintain_conversation'],
                    relationship_dynamic: currentState.relationship_dynamic || 'friendly',
                    active_interests: ['general_topics'],
                    communication_mode: currentState.communication_mode || 'conversational',
                    internal_state_notes: currentState.internal_state_notes || 'Processing user interaction',
                    change_reason: 'message received'
                }
            };

            let updates;
            
            // Use enhanced orchestrator if available, otherwise fallback to structured response
            try {
                if (this.jsonOrchestrator) {
                    updates = await this.jsonOrchestrator.processJSONRequest(prompt, schema, {
                        temperature: 0.2, // Lower for more consistent psychology analysis
                        maxTokens: 2500, // Increased significantly for detailed analysis
                        schemaTemplate: 'psychology',
                        retries: 2, // Reduced retries to fail faster during model switches
                        enablePartialRecovery: true
                    });
                } else {
                    updates = await this.structuredResponse.generateStructuredResponse(prompt, schema, {
                        temperature: 0.3,
                        maxTokens: 2500, // Increased from 600
                        retries: 2 // Reduced retries to fail faster during model switches
                    });
                }
            } catch (structuredResponseError) {
                console.warn('🔄 Structured response failed (likely during model switch), using fallback:', structuredResponseError.message);
                // Use the fallback schema data with minimal changes
                updates = {
                    ...schema.fallback,
                    change_reason: 'fallback_during_model_switch'
                };
            }
            
            // Log the state evolution for analytics
            await this.logStateEvolution(sessionId, personality.id, currentState, updates, currentMessage, 'structured analysis');
            
            // Apply updates to database
            await this.updateCharacterState(sessionId, updates);
            
            // Weight recent memories based on psychological impact
            await this.weightRecentMemories(sessionId, conversationHistory, updates, framework);
            
            return await this.getCharacterState(sessionId);
            
        } catch (error) {
            console.error('Error analyzing psychological state:', error);
            // Return current state unchanged on error
            return await this.getCharacterState(sessionId);
        }
    }

    /**
     * INFRASTRUCTURE LAYER: Update character state in database
     */
    async updateCharacterState(sessionId, updates) {
        const allowedFields = [
            'current_emotion', 'emotional_intensity', 'energy_level', 'stress_level',
            'current_motivations', 'relationship_dynamic', 'active_interests', 
            'communication_mode', 'internal_state_notes'
        ];
        
        const fields = Object.keys(updates).filter(key => 
            allowedFields.includes(key) && updates[key] !== undefined
        );
        
        if (fields.length === 0) return;

        const setClause = fields.map(field => `${field} = ?`).join(', ');
        const values = fields.map(field => {
            const value = updates[field];
            return Array.isArray(value) ? JSON.stringify(value) : value;
        });
        
        try {
            const dal = this.getDAL();
            
            // Get current state first
            const currentState = await dal.psychology.getPsychologicalState(sessionId);
            if (!currentState) {
                throw new Error('No psychological state found for session');
            }
            
            // Merge updates with current state
            const updatedState = { ...currentState };
            Object.keys(updates).forEach(key => {
                if (key !== 'change_reason') {
                    updatedState[key] = Array.isArray(updates[key]) ? updates[key] : updates[key];
                }
            });
            
            // Update the state
            const result = await dal.psychology.updatePsychologicalState(
                sessionId, 
                currentState.personality_id, 
                updatedState
            );
            
            return result.changes || 1;
        } catch (error) {
            console.error('Error updating character state:', error);
            throw error;
        }
    }

    /**
     * DOMAIN LAYER: Weight recent memories based on psychological impact
     */
    async weightRecentMemories(sessionId, conversationHistory, stateUpdates, framework) {
        // Filter for user messages that have database IDs
        const recentMessages = conversationHistory.slice(-3)
            .filter(msg => msg.sender === 'user' && msg.id);
        
        if (recentMessages.length === 0) {
            console.log('🧠 No database-backed messages found for memory weighting');
            return;
        }
        
        for (const message of recentMessages) {
            const prompt = `Rate the psychological significance of this message for the character:

Message: "${message.message}"
Character state changes: ${JSON.stringify(stateUpdates)}

Rate significance (1-10) for:
- Emotional impact
- Relationship relevance  
- Personal significance
- Contextual importance`;

            const schema = {
                type: 'object',
                required: ['emotional_impact_score', 'relationship_relevance', 'personal_significance', 'contextual_importance'],
                properties: {
                    emotional_impact_score: { type: 'number', minimum: 1, maximum: 10 },
                    relationship_relevance: { type: 'number', minimum: 1, maximum: 10 },
                    personal_significance: { type: 'number', minimum: 1, maximum: 10 },
                    contextual_importance: { type: 'number', minimum: 1, maximum: 10 },
                    memory_type: { type: 'string', description: 'Type of memory' },
                    memory_tags: { type: 'array', description: 'Memory tags' }
                },
                fallback: {
                    emotional_impact_score: 5,
                    relationship_relevance: 5,
                    personal_significance: 5,
                    contextual_importance: 5,
                    memory_type: 'conversational',
                    memory_tags: ['general']
                }
            };

            try {
                let weightData;
                
                // Use enhanced orchestrator if available
                try {
                    if (this.jsonOrchestrator) {
                        weightData = await this.jsonOrchestrator.processJSONRequest(prompt, schema, {
                            temperature: 0.1, // Lower for consistent memory analysis
                            maxTokens: 800, // Increased for better memory analysis
                            retries: 2, // Reduced retries to fail faster during model switches
                            enablePartialRecovery: true
                        });
                    } else {
                        weightData = await this.structuredResponse.generateStructuredResponse(prompt, schema, {
                            temperature: 0.2,
                            maxTokens: 800, // Increased from 300
                            retries: 2 // Reduced retries to fail faster during model switches
                        });
                    }
                } catch (structuredResponseError) {
                    console.warn('🔄 Memory weighting failed (likely during model switch), using fallback weights');
                    // Use fallback memory weights  
                    weightData = schema.fallback;
                }
                
                await this.saveMemoryWeights(sessionId, message.id, weightData);
            } catch (error) {
                console.error('Error weighting memory:', error);
                // Continue processing other memories even if one fails
            }
        }
    }

    /**
     * INFRASTRUCTURE LAYER: Save memory weights to database
     */
    async saveMemoryWeights(sessionId, messageId, weightData) {
        try {
            const dal = this.getDAL();
            const result = await dal.conversations.saveMemoryWeight(sessionId, messageId, weightData);
            console.log(`💾 Saved memory weights for message ${messageId} in session ${sessionId}`);
            return result.id;
        } catch (error) {
            console.error('Error saving memory weights:', error);
            // Don't throw - memory weighting is not critical for core functionality
            return 'memory-weight-fallback-id';
        }
    }

    /**
     * APPLICATION LAYER: Get psychologically weighted conversation context
     */
    async getWeightedContext(sessionId, maxMessages = 10) {
        const dal = this.getDAL();
        return await dal.psychology.getConversationContextForPsychology(sessionId, maxMessages);
    }

    /**
     * ANALYTICS LAYER: Log state evolution for learning and improvement
     */
    async logStateEvolution(sessionId, personalityId, previousState, newUpdates, triggerMessage, reasoning) {
        // Calculate evolution metrics
        const emotionalShift = this.calculateEmotionalShift(previousState, newUpdates);
        const motivationStability = this.calculateMotivationStability(previousState, newUpdates);
        const relationshipProgression = this.calculateRelationshipProgression(previousState, newUpdates);

        const dal = this.getDAL();
        const evolutionData = {
            previousState,
            newState: newUpdates,
            triggerMessage,
            analysisReasoning: reasoning,
            emotionalShiftMagnitude: emotionalShift,
            motivationStability,
            relationshipProgression
        };
        
        const result = await dal.psychology.logPsychologyEvolution(
            sessionId, 
            personalityId, 
            'conversation_analysis', 
            evolutionData
        );
        
        return result.id;
    }

    /**
     * ANALYTICS: Calculate emotional shift magnitude
     */
    calculateEmotionalShift(previousState, newUpdates) {
        if (!newUpdates.emotional_intensity || !previousState.emotional_intensity) return 0.0;
        return Math.abs(newUpdates.emotional_intensity - previousState.emotional_intensity) / 10.0;
    }

    /**
     * ANALYTICS: Calculate motivation stability
     */
    calculateMotivationStability(previousState, newUpdates) {
        if (!newUpdates.current_motivations || !previousState.current_motivations) return 1.0;
        
        // Use arrays directly - no local JSON parsing
        const oldMotivations = Array.isArray(previousState.current_motivations) 
            ? previousState.current_motivations 
            : ['maintain_conversation']; // Fallback for malformed data
            
        const newMotivations = Array.isArray(newUpdates.current_motivations) 
            ? newUpdates.current_motivations 
            : ['maintain_conversation']; // Fallback for malformed data
        
        const overlap = oldMotivations.filter(m => newMotivations.includes(m)).length;
        const totalUnique = new Set([...oldMotivations, ...newMotivations]).size;
        
        return totalUnique > 0 ? overlap / totalUnique : 1.0;
    }

    /**
     * ANALYTICS: Calculate relationship progression
     */
    calculateRelationshipProgression(previousState, newUpdates) {
        if (!newUpdates.relationship_dynamic || !previousState.relationship_dynamic) return 0.0;
        
        const progressionMap = {
            'getting_to_know': 1,
            'building_rapport': 2,
            'comfortable': 3,
            'close': 4,
            'intimate': 5
        };
        
        const oldLevel = progressionMap[previousState.relationship_dynamic] || 1;
        const newLevel = progressionMap[newUpdates.relationship_dynamic] || 1;
        
        return (newLevel - oldLevel) / 4.0; // Normalized to -1 to 1
    }

    /**
     * DOMAIN LAYER: Get existing psychology framework (fast operation)
     */
    async getPsychologyFramework(personalityId) {
        try {
            return await this.getPersonalityFramework(personalityId);
        } catch (error) {
            console.warn('Failed to get psychology framework:', error.message);
            return null;
        }
    }

    /**
     * APPLICATION LAYER: Get or create framework for a personality
     * Ensures framework exists and is cached
     */
    async ensurePersonalityFramework(personality) {
        let framework = await this.getPersonalityFramework(personality.id);
        
        if (!framework) {
            console.log(`🧠 Creating psychological framework for personality: ${personality.name}`);
            framework = await this.analyzePersonalityFramework(personality.definition, personality.name);
            await this.storePersonalityFramework(personality.id, framework);
        }
        
        return framework;
    }

    /**
     * APPLICATION LAYER: Get psychology analytics for monitoring
     */
    async getPsychologyAnalytics(sessionId = null, timeframe = '24h') {
        return await this.withMetrics(async () => {
            const analytics = {
                global: {
                    frameworksCreated: this.analytics.frameworksCreated,
                    statesUpdated: this.analytics.statesUpdated,
                    analysisRequests: this.analytics.analysisRequests
                }
            };
            
            // Add session-specific analytics if requested
            if (sessionId) {
                const sessionData = await this.getSessionAnalytics(sessionId);
                analytics.session = sessionData;
            }
            
            return analytics;
        }, 'getPsychologyAnalytics');
    }

    /**
     * APPLICATION LAYER: Get session-specific psychology analytics
     */
    async getSessionAnalytics(sessionId) {
        const currentState = await this.getCharacterState(sessionId);
        
        return {
            sessionId,
            currentState,
            lastStateUpdate: currentState?.last_updated || null,
            hasActiveState: !!currentState
        };
    }

    /**
     * APPLICATION LAYER: Reset analytics counters
     */
    resetAnalytics() {
        this.analytics = {
            frameworksCreated: 0,
            statesUpdated: 0,
            analysisRequests: 0,
            lastAnalyticsReset: Date.now()
        };
        console.log('📊 Psychology service analytics reset');
    }

    /**
     * APPLICATION LAYER: Get comprehensive service metrics
     */
    getServiceMetrics() {
        return {
            analytics: this.analytics,
            config: this.config,
            uptime: Date.now() - this.analytics.lastAnalyticsReset
        };
    }

    /**
     * ANALYTICS: Get psychology analytics for a session
     */
    async getSessionPsychologyAnalytics(sessionId) {
        // Use DAL exclusively - no direct SQL
        try {
            const dal = this.getDAL();
            const state = await dal.psychology.getPsychologicalState(sessionId);
            return state ? { sessionId, hasState: true, ...state } : null;
        } catch (error) {
            console.error('Error getting psychology analytics:', error);
            throw error;
        }
    }

    /**
     * CLEAN ARCHITECTURE: Get personality framework
     */
    async getPersonalityFramework(personalityId) {
        return await this.withMetrics(async () => {
            try {
                return await this.psychologyRepository.getFramework(personalityId);
            } catch (error) {
                this.logger.error('Error getting personality framework', 'PsychologyService', {
                    error: error.message,
                    personalityId
                });
                return null;
            }
        }, 'getPersonalityFramework');
    }

    /**
     * CLEAN ARCHITECTURE: Get psychological state
     */
    async getPsychologicalState(sessionId) {
        return await this.withMetrics(async () => {
            try {
                // Check active states first
                if (this.activeStates.has(sessionId)) {
                    return this.activeStates.get(sessionId);
                }
                
                // Get from repository
                const state = await this.psychologyRepository.getState(sessionId);
                if (!state) {
                    return null;
                }
                
                // Add to active states
                this.activeStates.set(sessionId, state);
                return state;
            } catch (error) {
                this.logger.error('Error getting psychological state', 'PsychologyService', {
                    error: error.message,
                    sessionId
                });
                return null;
            }
        }, 'getPsychologicalState');
    }

    /**
     * CLEAN ARCHITECTURE: Update psychological state
     */
    async updatePsychologicalState(sessionId, update) {
        return await this.withMetrics(async () => {
            try {
                // Get current state
                let state = await this.getPsychologicalState(sessionId);
                if (!state) {
                    state = await this.createInitialState(sessionId);
                }
                
                // Apply update
                const newState = {
                    ...state,
                    ...update,
                    lastUpdated: new Date()
                };
                
                // Save to repository
                await this.psychologyRepository.updateState(sessionId, newState);
                
                // Update active states
                this.activeStates.set(sessionId, newState);
                this.stateAnalytics.stateUpdates++;
                
                return newState;
            } catch (error) {
                this.logger.error('Error updating psychological state', 'PsychologyService', {
                    error: error.message,
                    sessionId
                });
                return null;
            }
        }, 'updatePsychologicalState');
    }

    /**
     * CLEAN ARCHITECTURE: Create initial state
     */
    async createInitialState(sessionId) {
        try {
            const initialState = {
                sessionId,
                createdAt: new Date(),
                lastUpdated: new Date(),
                mood: 'neutral',
                energy: 0.5,
                focus: 0.5,
                traits: {},
                memories: [],
                relationships: {}
            };
            
            // Save to repository
            await this.psychologyRepository.createState(sessionId, initialState);
            
            // Update active states
            this.activeStates.set(sessionId, initialState);
            this.stateAnalytics.statesCreated++;
            
            return initialState;
        } catch (error) {
            this.logger.error('Error creating initial psychological state', 'PsychologyService', {
                error: error.message,
                sessionId
            });
            return null;
        }
    }

    /**
     * CLEAN ARCHITECTURE: Get psychology analytics
     */
    async getSessionPsychologyAnalytics(sessionId) {
        try {
            const state = await this.psychologyRepository.getState(sessionId);
            return state ? { sessionId, hasState: true, ...state } : null;
        } catch (error) {
            this.logger.error('Error getting psychology analytics', 'PsychologyService', {
                error: error.message,
                sessionId
            });
            throw error;
        }
    }

    /**
     * CLEAN ARCHITECTURE: Cleanup inactive states
     */
    async cleanupInactiveStates() {
        try {
            const cutoffTime = new Date(Date.now() - this.stateConfig.defaultTtl);
            const cleared = await this.psychologyRepository.cleanupInactiveStates(cutoffTime);
            
            // Clear from active states
            for (const [sessionId, state] of this.activeStates.entries()) {
                if (new Date(state.lastUpdated) < cutoffTime) {
                    this.activeStates.delete(sessionId);
                    this.stateAnalytics.statesDestroyed++;
                }
            }
            
            return cleared;
        } catch (error) {
            this.logger.error('Error cleaning up inactive states', 'PsychologyService', {
                error: error.message
            });
            return 0;
        }
    }

    /**
     * CLEAN ARCHITECTURE: Start cleanup interval
     */
    startCleanupInterval() {
        setInterval(() => {
            this.cleanupInactiveStates().catch(error => {
                this.logger.error('Error in cleanup interval', 'PsychologyService', {
                    error: error.message
                });
            });
        }, this.stateConfig.cleanupInterval);
    }

    /**
     * CLEAN ARCHITECTURE: Get service metrics
     */
    getMetrics() {
        return {
            ...this.stateAnalytics,
            activeStates: this.activeStates.size,
            memoryUsage: process.memoryUsage().heapUsed
        };
    }
}

module.exports = PsychologyService; 