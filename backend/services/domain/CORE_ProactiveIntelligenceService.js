/**
 * CLEAN ARCHITECTURE: Domain Layer Service
 * ProactiveIntelligenceService - Core LLM-driven proactive decision making
 * Uses psychology state and conversation context to determine proactive engagement
 * 
 * FOLLOWS YOUR EXISTING SERVICE PATTERNS:
 * - Extends AbstractService
 * - Uses dependency injection pattern
 * - Integrates with StructuredResponseService
 * - Uses central logger and error handling
 */

const AbstractService = require('../base/CORE_AbstractService');
const DateTimeUtils = require('../../utils/datetime_utils');

class ProactiveIntelligenceService extends AbstractService {
    constructor(dependencies) {
        super('ProactiveIntelligence', dependencies);
        
        // Central services (from your architecture)
        this.structuredResponse = null;
        this.psychologyService = null;
        this.logger = null;
        this.errorHandler = null;
        this.dal = null;
        
        // Analysis configuration
        this.config = {
            temperature: 0.7,        // Creative for lifelike behavior
            maxTokens: 1000,
            analysisTimeout: 5000
        };
    }

    /**
     * FOLLOWS YOUR PATTERN: onInitialize() method
     */
    async onInitialize() {
        try {
            // Initialize logger first (from AbstractService pattern)
            this.logger = this.dependencies.logger;
            if (!this.logger) {
                this.logger.warn(`No logger service available for ProactiveIntelligenceService, using console fallback`);
                this.logger = {
                    debug: (msg, ctx, meta) => this.logger.debug(`[${ctx || 'ProactiveIntelligence'}] ${msg}`),
                    info: (msg, ctx, meta) => this.logger.info(`[${ctx || 'ProactiveIntelligence'}] ${msg}`),
                    warn: (msg, ctx, meta) => this.logger.warn(`[${ctx || 'ProactiveIntelligence'}] ${msg}`),
                    error: (msg, ctx, meta) => this.logger.error(`[${ctx || 'ProactiveIntelligence'}] ${msg}`, meta?.error || '')
                };
            }
            
            // Extract dependencies following your pattern
            this.structuredResponse = this.dependencies.structuredResponse;
            this.psychologyService = this.dependencies.psychology;
            this.dal = this.dependencies.database;
            this.errorHandler = this.dependencies.errorHandling;
            
            // Validate required dependencies
            if (!this.structuredResponse) {
                throw new Error('StructuredResponseService is required');
            }
            if (!this.psychologyService) {
                throw new Error('PsychologyService is required');
            }
            
            this.logger.info('ProactiveIntelligenceService initialized', 'ProactiveIntelligence');
            
        } catch (error) {
            throw this.errorHandler?.wrapDomainError(error, 
                'Failed to initialize ProactiveIntelligenceService') || error;
        }
    }

    /**
     * DOMAIN LAYER: Core intelligence - analyze if proactive engagement is needed
     * Uses YOUR StructuredResponseService for reliable JSON responses
     */
    async analyzeProactiveOpportunity(analysisContext) {
        this.logger.info('Starting proactive opportunity analysis', 'ProactiveIntelligence', {
            characterName: analysisContext.personality?.name,
            currentEmotion: analysisContext.psychologicalState?.current_emotion,
            energyLevel: analysisContext.psychologicalState?.energy_level
        });
        
        try {
            // Build prompt
            this.logger.info('Building analysis prompt', 'ProactiveIntelligence');
            const prompt = this.buildProactiveAnalysisPrompt(analysisContext);
            
            this.logger.info('Analysis prompt built', 'ProactiveIntelligence', {
                promptLength: prompt.length,
                promptPreview: prompt.substring(0, 200) + '...'
            });
            
            // Get schema
            const proactiveSchema = this.getProactiveAnalysisSchema();
            
            // Call LLM
            this.logger.info('Calling StructuredResponse service', 'ProactiveIntelligence');
            const rawDecision = await this.structuredResponse.generateStructuredResponse(
                prompt, proactiveSchema, {
                    temperature: this.config.temperature,
                    maxTokens: this.config.maxTokens,
                    timeout: this.config.analysisTimeout
                }
            );
            
            this.logger.info('LLM analysis completed', 'ProactiveIntelligence', {
                hasResponse: !!rawDecision,
                shouldEngage: rawDecision?.should_engage_proactively,
                confidence: rawDecision?.confidence_score
            });
            
            // Validate
            const decision = this.validateAndNormalizeDecision(rawDecision);
            
            this.logger.info('Decision validated and normalized', 'ProactiveIntelligence', {
                finalShouldEngage: decision.should_engage_proactively,
                finalConfidence: decision.confidence_score,
                finalTiming: decision.engagement_timing
            });
            
            return decision;
            
        } catch (error) {
            const wrappedError = this.errorHandler?.wrapDomainError(error, 'Proactive opportunity analysis failed');
            this.logger.error('Analysis failed', 'ProactiveIntelligence', { 
                error: wrappedError || error,
                characterName: analysisContext.personality?.name 
            });
            return this.getProactiveAnalysisSchema().fallback;
        }
    }

    /**
     * DOMAIN LAYER: Define schema for proactive analysis responses
     * Ensures consistent, validated JSON responses from LLM
     */
    getProactiveAnalysisSchema() {
        return {
            type: 'object',
            required: [
                'should_engage_proactively',
                'engagement_timing', 
                'psychological_reasoning',
                'proactive_message_content',
                'confidence_score'
            ],
            properties: {
                should_engage_proactively: {
                    type: 'boolean',
                    description: 'Whether to send a proactive message right now'
                },
                engagement_timing: {
                    type: 'string',
                    enum: ['immediate', 'wait_30_seconds', 'wait_2_minutes', 'wait_5_minutes', 'wait_later', 'none'],
                    description: 'When to send the proactive message'
                },
                psychological_reasoning: {
                    type: 'string',
                    description: 'Detailed explanation of how psychology drives this decision'
                },
                proactive_message_content: {
                    type: ['string', 'null'],
                    description: 'The exact message to send (or null if no engagement)'
                },
                confidence_score: {
                    type: 'number',
                    minimum: 0.0,
                    maximum: 1.0,
                    description: 'Confidence level in this decision (0.0 to 1.0)'
                },
                context_analysis: {
                    type: 'object',
                    properties: {
                        emotional_state_influence: {
                            type: 'string',
                            description: 'How current emotions affect this decision'
                        },
                        relationship_factor: {
                            type: 'string', 
                            description: 'How relationship with user affects this'
                        },
                        conversation_flow_assessment: {
                            type: 'string',
                            description: 'Analysis of conversation momentum'
                        },
                        learned_pattern_application: {
                            type: 'string',
                            description: 'Which learned patterns apply here'
                        }
                    }
                }
            },
            fallback: {
                should_engage_proactively: false,
                engagement_timing: 'none',
                psychological_reasoning: 'Default fallback response - no proactive engagement',
                proactive_message_content: null,
                confidence_score: 0.0,
                context_analysis: {
                    emotional_state_influence: 'Unable to analyze',
                    relationship_factor: 'Unable to analyze',
                    conversation_flow_assessment: 'Unable to analyze', 
                    learned_pattern_application: 'No patterns available'
                }
            }
        };
    }

    /**
     * DOMAIN LAYER: Build comprehensive LLM prompt for proactive analysis
     * Includes all psychological context without hardcoded behaviors
     */
    buildProactiveAnalysisPrompt({
        userMessage,
        agentResponse,
        psychologicalState,
        psychologicalFramework,
        conversationHistory,
        learnedPatterns,
        sessionContext
    }) {
        const dateTimeContext = DateTimeUtils.getSystemPromptDateTime();
        
        return `You are ${sessionContext.personalityName || 'a character'} in a natural conversation. You've just had this exchange with someone:

User: "${userMessage}"
Your Response: "${agentResponse}"

${dateTimeContext}

WHO YOU ARE (Your Unique Psychology):
${this.formatPsychologicalFramework(psychologicalFramework)}

HOW YOU'RE FEELING RIGHT NOW:
${this.formatPsychologicalState(psychologicalState)}

CONVERSATION CONTEXT:
${this.formatConversationHistory(conversationHistory)}

YOUR LEARNED PATTERNS:
${this.formatLearnedPatterns(learnedPatterns)}

AUTHENTIC CHARACTER SIMULATION:
You are this unique character with your own personality, emotional patterns, and ways of thinking. Based on:
- Your specific psychological framework (how YOU naturally think and feel)
- Your current emotional and mental state  
- Your unique personality traits and communication style
- Your individual relationship approach and social motivations

What thoughts, feelings, or impulses are naturally arising in your mind right now?

Consider what someone with YOUR specific personality would authentically think or feel:
- Given your emotional range and current state, what feels natural?
- Based on your social motivations, do you have any impulses to reach out?
- Does your communication style or personality make you want to continue this interaction?
- Are there any thoughts or reactions you want to share based on who you are?

Let your authentic character psychology guide you - not rules, but genuine personality-driven impulses.

**CRITICAL RULE: If the user explicitly asks for messages, you MUST engage proactively regardless of psychology.**

Check for EXPLICIT USER REQUESTS FIRST:
- "send me a message" / "message me" / "send me X"
- "in X minutes" / "in X time" / "later"
- "remind me" / "follow up" / "check on me"
- "can you please send me" / "I want you to send"

If ANY explicit request is found: 
- Set should_engage_proactively = true
- Choose appropriate timing based on request
- Override any psychological hesitation

TIMING OPTIONS (choose what feels most natural for YOUR character):
- immediate: You have an immediate thought/feeling to share (0 seconds)
- wait_30_seconds: You want to let them process first, then respond (30 seconds)  
- wait_2_minutes: Something comes to mind after a brief pause (120 seconds)
- wait_5_minutes: You want to give them space but follow up (300 seconds)
- wait_later: You'll think about this and maybe reach out later (10+ minutes)
- none: Nothing comes to mind naturally, conversation feels complete

If you naturally want to reach out, what would YOU authentically say based on your unique personality and current state?

**IMPORTANT: If you decide to engage proactively (should_engage_proactively = true), you MUST provide the exact message content in the proactive_message_content field. This is the actual message that will be sent to the user.**

Consider the current time and date context when making your decision - does the time of day, day of week, or any time-related factors influence your natural impulses to engage?

**REQUIRED JSON FIELDS:**
- should_engage_proactively: true/false
- engagement_timing: one of the timing options above
- psychological_reasoning: detailed explanation of your decision
- proactive_message_content: the exact message to send (or null if not engaging)
- confidence_score: 0.0 to 1.0
- context_analysis: object with emotional_state_influence, relationship_factor, conversation_flow_assessment, learned_pattern_application

Respond with complete JSON. Let your individual character psychology and authentic impulses guide every decision.`;
    }

    /**
     * DOMAIN LAYER: Format psychological framework for LLM consumption
     * CHARACTER-FOCUSED: Describes who they are, not what they should do
     */
    formatPsychologicalFramework(framework) {
        if (!framework) return 'No psychological framework available';
        
        return `Your natural emotional range: ${(framework.core_emotional_range || []).join(', ')}
What naturally motivates you socially: ${(framework.natural_social_motivations || []).join(', ')}
Your typical communication patterns: ${(framework.communication_patterns || []).join(', ')}
What tends to stress you: ${(framework.stress_triggers || []).join(', ')}
What energizes you: ${(framework.energy_sources || []).join(', ')}
Your approach to relationships: ${framework.relationship_approach || 'Not specified'}
Your natural communication style: ${framework.communication_style || 'Not specified'}
Notes about how you express yourself: ${framework.conversation_style_notes || 'Not specified'}

These are your authentic psychological patterns - let them naturally influence what you feel like doing right now.`;
    }

    /**
     * DOMAIN LAYER: Format current psychological state for LLM consumption
     * FLEXIBLE: Descriptive but not prescriptive - lets characters interpret their own feelings
     */
    formatPsychologicalState(state) {
        if (!state) return 'No current psychological state available';
        
        const motivations = Array.isArray(state.current_motivations) 
            ? state.current_motivations 
            : JSON.parse(state.current_motivations || '[]');
        
        const interests = Array.isArray(state.active_interests)
            ? state.active_interests
            : JSON.parse(state.active_interests || '[]');
        
        return `Current emotional state: ${state.current_emotion || 'neutral'} (intensity: ${state.emotional_intensity || 5}/10)
Energy level: ${state.energy_level || 5}/10
Stress level: ${state.stress_level || 3}/10
What's driving you: ${motivations.join(', ') || 'general conversation'}
How you view this relationship: ${state.relationship_dynamic || 'getting_to_know'}
Communication mode: ${state.communication_mode || 'normal'}
Current interests/focus: ${interests.join(', ') || 'open to various topics'}

Natural psychological tendencies right now: ${this.generateNaturalTendencies(state)}

IMPORTANT: Interpret these states through the lens of YOUR unique personality framework above. What do these feelings and states mean for someone with your specific psychological makeup?`;
    }

    /**
     * Generate natural psychological tendencies based on character's unique psychology
     * FLEXIBLE: Uses character's psychological framework instead of hardcoded rules
     */
    generateNaturalTendencies(state) {
        const tendencies = [];
        
        // Base energy level description (universal)
        if (state.energy_level >= 7) {
            tendencies.push('high energy');
        } else if (state.energy_level <= 3) {
            tendencies.push('low energy');
        } else {
            tendencies.push('moderate energy');
        }
        
        // Emotional intensity description (let LLM interpret what this means for the character)
        const emotion = state.current_emotion || 'neutral';
        const intensity = state.emotional_intensity || 5;
        
        if (intensity >= 7) {
            tendencies.push(`feeling ${emotion} intensely`);
        } else if (intensity >= 5) {
            tendencies.push(`experiencing ${emotion}`);
        } else if (intensity >= 3) {
            tendencies.push(`mildly ${emotion}`);
        }
        
        // Stress level description (universal)
        if (state.stress_level >= 7) {
            tendencies.push('high stress level');
        } else if (state.stress_level <= 2) {
            tendencies.push('very relaxed');
        }
        
        // Current motivations (character-specific, from their framework)
        const motivations = Array.isArray(state.current_motivations) 
            ? state.current_motivations 
            : JSON.parse(state.current_motivations || '[]');
        
        if (motivations.length > 0) {
            tendencies.push(`motivated by: ${motivations.join(', ')}`);
        }
        
        // Relationship dynamic (let character interpret what this means for their behavior)
        if (state.relationship_dynamic) {
            tendencies.push(`sees relationship as: ${state.relationship_dynamic}`);
        }
        
        return tendencies.join('; ');
    }

    /**
     * DOMAIN LAYER: Format conversation history for context
     */
    formatConversationHistory(history) {
        if (!history || !Array.isArray(history) || history.length === 0) {
            return 'No recent conversation history available';
        }
        
        return history
            .slice(-5)  // Last 5 exchanges for context
            .map(msg => `${msg.sender}: "${msg.message}"`)
            .join('\n');
    }

    /**
     * DOMAIN LAYER: Format learned patterns for LLM consideration
     */
    formatLearnedPatterns(patterns) {
        if (!patterns || patterns.length === 0) {
            return 'No learned patterns available yet';
        }
        
        return patterns
            .slice(0, 3)  // Top 3 most relevant patterns
            .map(pattern => {
                const data = pattern.pattern_data || {};
                return `${pattern.pattern_type}: ${data.description || 'Pattern data'} (confidence: ${pattern.confidence_score.toFixed(2)})`;
            })
            .join('\n');
    }

    /**
     * DOMAIN LAYER: Validate and normalize LLM decision output
     * Ensures decision structure is consistent and safe
     */
    validateAndNormalizeDecision(rawDecision) {
        const decision = {
            should_engage_proactively: false,
            engagement_timing: 'none',
            psychological_reasoning: '',
            proactive_message_content: null,
            confidence_score: 0.0,
            context_analysis: {}
        };

        if (!rawDecision || typeof rawDecision !== 'object') {
            decision.psychological_reasoning = 'Invalid LLM response format';
            return decision;
        }

        // Validate boolean fields
        decision.should_engage_proactively = Boolean(rawDecision.should_engage_proactively);
        
        // Validate timing enum - support natural language responses
        const validTimings = ['immediate', 'wait_30_seconds', 'wait_2_minutes', 'wait_5_minutes', 'wait_later', 'none'];
        const naturalLanguageTimings = {
            'later today': 'wait_later',
            'in a few hours': 'wait_later', 
            'tomorrow': 'wait_later',
            'soon': 'wait_5_minutes',
            'in a bit': 'wait_5_minutes',
            'later': 'wait_later'
        };
        
        let timing = rawDecision.engagement_timing;
        if (naturalLanguageTimings[timing]) {
            timing = naturalLanguageTimings[timing];
        }
        
        decision.engagement_timing = validTimings.includes(timing) 
            ? timing 
            : 'none';
        
        // Validate text fields
        decision.psychological_reasoning = typeof rawDecision.psychological_reasoning === 'string' 
            ? rawDecision.psychological_reasoning.trim()
            : 'No reasoning provided';
        
        decision.proactive_message_content = rawDecision.proactive_message_content || null;
        
        // Validate confidence score
        const confidence = Number(rawDecision.confidence_score);
        decision.confidence_score = isNaN(confidence) ? 0.0 : Math.max(0.0, Math.min(1.0, confidence));
        
        // Validate context analysis
        decision.context_analysis = typeof rawDecision.context_analysis === 'object' 
            ? rawDecision.context_analysis 
            : {};

        // Safety checks
        if (decision.should_engage_proactively && decision.engagement_timing === 'none') {
            decision.engagement_timing = 'immediate';
        }

        // Ensure proactive message content is present when engaging
        if (decision.should_engage_proactively && (!decision.proactive_message_content || decision.proactive_message_content.trim() === '')) {
            decision.proactive_message_content = 'I wanted to check in with you. How are you doing?';
        }

        if (!decision.should_engage_proactively) {
            decision.engagement_timing = 'none';
            decision.proactive_message_content = null;
        }

        return decision;
    }

    /**
     * DOMAIN LAYER: Convert timing decision to seconds for scheduling
     */
    getDelaySecondsFromTiming(timing) {
        const timingMap = {
            'immediate': 0,
            'wait_30_seconds': 30,
            'wait_2_minutes': 120,
            'wait_5_minutes': 300,
            'wait_later': 600,  // Default to 10 minutes for 'later'
            'none': null
        };
        
        return timingMap[timing] ?? null;
    }

    /**
     * FOLLOWS YOUR PATTERN: Enhanced health check with debug details
     */
    async onHealthCheck() {
        const servicesAvailable = {
            structuredResponse: !!this.structuredResponse,
            psychology: !!this.psychologyService,
            dal: !!this.dal,
            errorHandler: !!this.errorHandler
        };
        
        const healthyCount = Object.values(servicesAvailable).filter(Boolean).length;
        
        return {
            healthy: healthyCount >= 2, // Require at least core services
            details: {
                servicesAvailable,
                healthyServiceCount: healthyCount,
                totalServiceCount: Object.keys(servicesAvailable).length,
                configTemperature: this.config.temperature,
                configMaxTokens: this.config.maxTokens,
                configTimeout: this.config.analysisTimeout
            }
        };
    }
}

module.exports = ProactiveIntelligenceService; 