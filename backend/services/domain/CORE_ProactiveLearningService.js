/**
 * CLEAN ARCHITECTURE: Domain Layer Service
 * ProactiveLearningService - Extracts patterns from proactive engagements
 * Learns what works for each personality and improves future decisions
 * 
 * FOLLOWS YOUR EXISTING SERVICE PATTERNS:
 * - Extends AbstractService
 * - Uses dependency injection pattern  
 * - Integrates with StructuredResponseService
 * - Uses central logger and error handling
 */

const AbstractService = require('../base/CORE_AbstractService');
const { DateTimeUtils } = require('../../utils/datetime_utils');

class ProactiveLearningService extends AbstractService {
    constructor(dependencies) {
        super('ProactiveLearning', dependencies);
        
        // Central services (from your architecture)
        this.dal = null;
        this.structuredResponse = null;
        this.logger = null;
        this.errorHandler = null;
        
        // Learning configuration
        this.learningConfig = {
            minSampleSize: 5,           // Minimum engagements before pattern extraction
            confidenceThreshold: 0.6,   // Minimum confidence for pattern application
            successThreshold: 0.7,      // Success rate for positive patterns
            patternExtractionBatchSize: 25
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
                this.logger.warn(`No logger service available for ProactiveLearningService, using console fallback`);
                this.logger = {
                    debug: (msg, ctx, meta) => this.logger.debug(`[${ctx || 'ProactiveLearning'}] ${msg}`),
                    info: (msg, ctx, meta) => this.logger.info(`[${ctx || 'ProactiveLearning'}] ${msg}`),
                    warn: (msg, ctx, meta) => this.logger.warn(`[${ctx || 'ProactiveLearning'}] ${msg}`),
                    error: (msg, ctx, meta) => this.logger.error(`[${ctx || 'ProactiveLearning'}] ${msg}`, meta?.error || '')
                };
            }
            
            // Extract dependencies following your pattern
            this.database = this.dependencies.database;
            this.structuredResponse = this.dependencies.structuredResponse;
            this.errorHandler = this.dependencies.errorHandling;
            
            // Validate required dependencies
            if (!this.database) {
                throw new Error('Database service is required');
            }
            
            // Get DAL from database service
            this.dal = this.database.getDAL();
            if (!this.structuredResponse) {
                throw new Error('StructuredResponseService is required');
            }
            
            this.logger.info('ProactiveLearningService initialized', 'ProactiveLearning');
            
        } catch (error) {
            throw this.errorHandler?.wrapDomainError(error, 
                'Failed to initialize ProactiveLearningService') || error;
        }
    }

    /**
     * DOMAIN LAYER: Record a proactive decision for future learning
     */
    async recordProactiveDecision(decision, context) {
        try {
            const engagementId = await this.dal.proactive.recordEngagementAttempt({
                sessionId: context.sessionId,
                personalityId: context.personality.id,
                triggerType: decision.engagement_timing === 'immediate' ? 'immediate' : 'scheduled',
                psychologicalContext: context.psychologicalState,
                decisionReasoning: decision.psychological_reasoning,
                proactiveContent: decision.proactive_message_content,
                engagementTiming: this.getDelaySeconds(decision.engagement_timing)
            });

            this.logger.info('Recorded proactive decision for learning', 'ProactiveLearning', {
                engagementId,
                sessionId: context.sessionId,
                personalityId: context.personality.id,
                shouldEngage: decision.should_engage_proactively
            });
            
            return engagementId;

        } catch (error) {
            const wrappedError = this.errorHandler?.wrapDomainError(error, 
                'Failed to record proactive decision for learning') || error;
            this.logger.error('Error recording proactive decision', 'ProactiveLearning', {
                error: wrappedError.message,
                sessionId: context.sessionId
            });
            throw wrappedError;
        }
    }

    /**
     * DOMAIN LAYER: Analyze user response to proactive engagement
     */
    async analyzeEngagementSuccess(engagementId, userResponse, responseTime) {
        try {
            // Use YOUR StructuredResponseService to calculate success score
            const successScore = await this.calculateSuccessScore(
                engagementId,
                userResponse,
                responseTime
            );

            // Determine sentiment
            const sentiment = await this.analyzeSentiment(userResponse);

            // Update engagement record
            await this.dal.proactive.updateEngagementResult(
                engagementId,
                userResponse,
                responseTime,
                sentiment,
                successScore
            );

            this.logger.info('Updated engagement success', 'ProactiveLearning', {
                engagementId,
                successScore,
                sentiment,
                responseTime
            });

            // Check if we should extract new patterns
            await this.checkForPatternExtraction(engagementId);

            return successScore;

        } catch (error) {
            const wrappedError = this.errorHandler?.wrapDomainError(error, 
                'Failed to analyze engagement success') || error;
            this.logger.error('Error analyzing engagement success', 'ProactiveLearning', {
                error: wrappedError.message,
                engagementId
            });
            throw wrappedError;
        }
    }

    /**
     * DOMAIN LAYER: Calculate success score using YOUR StructuredResponseService
     */
    async calculateSuccessScore(engagementId, userResponse, responseTime) {
        try {
            // Get the original engagement data
            const engagement = await this.getEngagementById(engagementId);
            if (!engagement) {
                this.logger.warn('Engagement not found for success analysis', 'ProactiveLearning', {
                    engagementId
                });
                return 0.5; // Neutral score
            }

            const prompt = `Analyze the success of this proactive engagement:

ORIGINAL PROACTIVE MESSAGE: "${engagement.proactive_content}"
ENGAGEMENT TIMING: ${engagement.engagement_timing} seconds delay
REASONING: "${engagement.decision_reasoning}"

USER RESPONSE: "${userResponse}"
RESPONSE TIME: ${responseTime} seconds

Evaluate success considering:
1. Did the user engage positively with the proactive message?
2. Was the timing appropriate (not too intrusive/pushy)?
3. Did it enhance or detract from the conversation flow?
4. Does the response indicate the user found value in the proactive message?

Response patterns to consider:
- Positive indicators: thanks, helpful, good timing, engagement with content
- Negative indicators: "leave me alone", "not now", ignoring, curt responses
- Neutral indicators: brief acknowledgment, topic change

Score from 0.0 (complete failure) to 1.0 (perfect success).
Respond with just the numeric score (e.g., 0.75).`;

            // Use YOUR StructuredResponseService for analysis
            const result = await this.structuredResponse.generateStructuredResponse(
                prompt,
                {
                    type: 'object',
                    properties: {
                        score: {
                            type: 'number',
                            minimum: 0.0,
                            maximum: 1.0,
                            description: 'Success score from 0.0 to 1.0'
                        }
                    },
                    fallback: { score: 0.5 }
                },
                {
                    temperature: 0.3,  // Lower temperature for consistent scoring
                    maxTokens: 100,
                    requestType: 'success_scoring'
                }
            );

            const score = result?.score ?? 0.5;
            return Math.max(0.0, Math.min(1.0, score));

        } catch (error) {
            this.logger.error('Error calculating success score', 'ProactiveLearning', {
                error: error.message,
                engagementId
            });
            return 0.5; // Default neutral score on error
        }
    }

    /**
     * DOMAIN LAYER: Analyze sentiment of user response
     */
    async analyzeSentiment(userResponse) {
        const positiveIndicators = [
            'thanks', 'helpful', 'good', 'yes', 'great', 'perfect',
            'appreciate', 'exactly', 'right', 'useful'
        ];
        
        const negativeIndicators = [
            'no', 'stop', 'leave me alone', 'not now', 'busy',
            'annoying', 'intrusive', 'don\'t', 'can\'t'
        ];

        const lowerResponse = userResponse.toLowerCase();
        
        const positiveCount = positiveIndicators.filter(indicator => 
            lowerResponse.includes(indicator)
        ).length;
        
        const negativeCount = negativeIndicators.filter(indicator =>
            lowerResponse.includes(indicator)
        ).length;

        if (positiveCount > negativeCount) return 'positive';
        if (negativeCount > positiveCount) return 'negative';
        return 'neutral';
    }

    /**
     * DOMAIN LAYER: Check if enough data exists to extract new patterns
     */
    async checkForPatternExtraction(engagementId) {
        try {
            // Get engagement data
            const engagement = await this.getEngagementById(engagementId);
            if (!engagement) return;

            // Check if we have enough recent engagements for this personality
            const recentEngagements = await this.dal.proactive.getEngagementsForLearning(
                this.learningConfig.patternExtractionBatchSize
            );

            const personalityEngagements = recentEngagements.filter(
                e => e.personality_id === engagement.personality_id
            );

            if (personalityEngagements.length >= this.learningConfig.minSampleSize) {
                await this.extractPatternsFromEngagements(personalityEngagements);
            }

        } catch (error) {
            this.logger.error('Error checking for pattern extraction', 'ProactiveLearning', {
                error: error.message,
                engagementId
            });
        }
    }

    /**
     * DOMAIN LAYER: Extract learning patterns from successful engagements
     */
    async extractPatternsFromEngagements(engagements) {
        try {
            const personalityId = engagements[0]?.personality_id;
            if (!personalityId) return;

            this.logger.info('Extracting patterns from engagements', 'ProactiveLearning', {
                personalityId,
                engagementCount: engagements.length
            });

            // Group engagements by success levels
            const successful = engagements.filter(e => e.success_score >= this.learningConfig.successThreshold);
            const unsuccessful = engagements.filter(e => e.success_score < 0.4);

            // Extract timing patterns
            await this.extractTimingPatterns(personalityId, successful, unsuccessful);

            // Extract content patterns
            await this.extractContentPatterns(personalityId, successful, unsuccessful);

            // Extract context patterns
            await this.extractContextPatterns(personalityId, successful, unsuccessful);

            // Mark engagements as processed
            for (const engagement of engagements) {
                await this.dal.proactive.markLearningExtracted(engagement.id);
            }

            this.logger.info('Pattern extraction completed', 'ProactiveLearning', {
                personalityId,
                successfulCount: successful.length,
                unsuccessfulCount: unsuccessful.length
            });

        } catch (error) {
            const wrappedError = this.errorHandler?.wrapDomainError(error, 
                'Failed to extract patterns from engagements') || error;
            this.logger.error('Error extracting patterns from engagements', 'ProactiveLearning', {
                error: wrappedError.message
            });
        }
    }

    /**
     * DOMAIN LAYER: Extract timing-related patterns
     */
    async extractTimingPatterns(personalityId, successful, unsuccessful) {
        if (successful.length < 3) return; // Need minimum sample size

        // Calculate optimal timing based on successful engagements
        const successfulTimings = successful.map(e => e.engagement_timing);
        const avgSuccessfulTiming = successfulTimings.reduce((a, b) => a + b, 0) / successfulTimings.length;

        // Calculate success rate by timing ranges
        const timingRanges = {
            immediate: successful.filter(e => e.engagement_timing === 0).length,
            short_delay: successful.filter(e => e.engagement_timing > 0 && e.engagement_timing <= 60).length,
            medium_delay: successful.filter(e => e.engagement_timing > 60 && e.engagement_timing <= 300).length,
            long_delay: successful.filter(e => e.engagement_timing > 300).length
        };

        const bestTiming = Object.entries(timingRanges).reduce((a, b) => 
            timingRanges[a[0]] > timingRanges[b[0]] ? a : b
        )[0];

        // Store timing optimization
        await this.dal.proactive.updateTimingOptimization({
            personalityId,
            contextType: 'general',
            optimalDelaySeconds: Math.round(avgSuccessfulTiming),
            confidenceLevel: Math.min(0.9, successful.length / 10), // Confidence grows with sample size
            sampleSize: successful.length,
            successRate: successful.length / (successful.length + unsuccessful.length)
        });

        // Store as learning pattern
        await this.dal.proactive.storeLearningPattern({
            personalityId,
            patternType: 'timing',
            patternContext: { type: 'general_timing' },
            patternData: {
                optimal_timing: avgSuccessfulTiming,
                best_timing_range: bestTiming,
                sample_size: successful.length,
                description: `Optimal timing for proactive messages is ${avgSuccessfulTiming} seconds`
            },
            confidenceScore: Math.min(0.9, successful.length / 10)
        });
    }

    /**
     * DOMAIN LAYER: Extract content-related patterns using YOUR StructuredResponseService
     */
    async extractContentPatterns(personalityId, successful, unsuccessful) {
        if (successful.length < 3) return;

        // Analyze common elements in successful proactive messages
        const successfulContent = successful.map(e => e.proactive_content);
        
        // Use YOUR StructuredResponseService to identify patterns
        const prompt = `Analyze these successful proactive messages to identify common patterns:

SUCCESSFUL MESSAGES:
${successfulContent.map((content, i) => `${i + 1}. "${content}"`).join('\n')}

Identify common elements that make these messages effective:
- Tone patterns (encouraging, questioning, supportive, etc.)
- Content types (check-ins, hints, reminders, encouragement)
- Communication style elements
- Structural patterns

Respond with JSON containing the analysis.`;

        try {
            const analysis = await this.structuredResponse.generateStructuredResponse(
                prompt,
                {
                    type: 'object',
                    properties: {
                        common_tone: {
                            type: 'string',
                            description: 'Description of common tone'
                        },
                        effective_content_types: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Types of effective content'
                        },
                        communication_patterns: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Communication patterns found'
                        },
                        key_phrases: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Key phrases that work well'
                        },
                        confidence: {
                            type: 'number',
                            minimum: 0.0,
                            maximum: 1.0,
                            description: 'Confidence in this analysis'
                        }
                    },
                    fallback: {
                        common_tone: 'supportive',
                        effective_content_types: ['check_in'],
                        communication_patterns: ['encouraging'],
                        key_phrases: [],
                        confidence: 0.5
                    }
                },
                {
                    temperature: 0.4,
                    maxTokens: 800,
                    requestType: 'content_pattern_extraction'
                }
            );

            if (analysis && analysis.confidence > 0.6) {
                await this.dal.proactive.storeLearningPattern({
                    personalityId,
                    patternType: 'content',
                    patternContext: { type: 'successful_content' },
                    patternData: {
                        ...analysis,
                        sample_size: successful.length,
                        description: `Effective content patterns: ${analysis.common_tone}`
                    },
                    confidenceScore: analysis.confidence
                });
            }

        } catch (error) {
            this.logger.error('Error analyzing content patterns', 'ProactiveLearning', {
                error: error.message,
                personalityId
            });
        }
    }

    /**
     * DOMAIN LAYER: Extract context-related patterns
     */
    async extractContextPatterns(personalityId, successful, unsuccessful) {
        if (successful.length < 3) return;

        // Analyze psychological contexts that lead to successful proactive engagement
        const successfulContexts = successful
            .map(e => e.psychological_context)
            .filter(context => context && typeof context === 'object');

        if (successfulContexts.length < 2) return;

        // Extract common psychological state patterns
        const emotionPatterns = {};
        const energyLevels = [];
        const motivationPatterns = {};

        successfulContexts.forEach(context => {
            if (context.current_emotion) {
                emotionPatterns[context.current_emotion] = (emotionPatterns[context.current_emotion] || 0) + 1;
            }
            if (context.energy_level) {
                energyLevels.push(context.energy_level);
            }
            if (context.current_motivations) {
                const motivations = Array.isArray(context.current_motivations) 
                    ? context.current_motivations 
                    : JSON.parse(context.current_motivations || '[]');
                motivations.forEach(motivation => {
                    motivationPatterns[motivation] = (motivationPatterns[motivation] || 0) + 1;
                });
            }
        });

        // Find most common patterns
        const topEmotion = Object.entries(emotionPatterns).reduce((a, b) => 
            a[1] > b[1] ? a : b, ['unknown', 0])[0];
        
        const avgEnergyLevel = energyLevels.length > 0 
            ? energyLevels.reduce((a, b) => a + b, 0) / energyLevels.length 
            : 5;

        const topMotivations = Object.entries(motivationPatterns)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([motivation]) => motivation);

        // Store context pattern
        await this.dal.proactive.storeLearningPattern({
            personalityId,
            patternType: 'context',
            patternContext: { type: 'psychological_state' },
            patternData: {
                favorable_emotion: topEmotion,
                optimal_energy_range: [Math.max(1, avgEnergyLevel - 2), Math.min(10, avgEnergyLevel + 2)],
                favorable_motivations: topMotivations,
                sample_size: successfulContexts.length,
                description: `Proactive engagement works best when emotion is '${topEmotion}' and energy around ${avgEnergyLevel}`
            },
            confidenceScore: Math.min(0.8, successfulContexts.length / 8)
        });
    }

    /**
     * DOMAIN LAYER: Get relevant learned patterns for decision making
     */
    async getRelevantPatterns(personalityId, sessionId, contextType = null) {
        try {
            return await this.dal.proactive.getApplicablePatterns(
                personalityId,
                contextType,
                { 
                    confidenceThreshold: this.learningConfig.confidenceThreshold,
                    limit: 5
                }
            );
        } catch (error) {
            this.logger.error('Error getting relevant patterns', 'ProactiveLearning', {
                error: error.message,
                personalityId,
                sessionId
            });
            return [];
        }
    }

    /**
     * UTILITY: Get engagement by ID
     */
    async getEngagementById(engagementId) {
        try {
            const engagements = await this.dal.proactive.getEngagementsForLearning(1000);
            return engagements.find(e => e.id === engagementId);
        } catch (error) {
            this.logger.error('Error getting engagement by ID', 'ProactiveLearning', {
                error: error.message,
                engagementId
            });
            return null;
        }
    }

    /**
     * UTILITY: Convert timing string to seconds
     */
    getDelaySeconds(timing) {
        const timingMap = {
            'immediate': 0,
            'wait_30_seconds': 30,
            'wait_2_minutes': 120,
            'wait_5_minutes': 300,
            'wait_later': 600,
            'none': null
        };
        return timingMap[timing] ?? 0;
    }

    /**
     * DOMAIN LAYER: Get learning analytics
     */
    async getLearningAnalytics(personalityId = null) {
        try {
            return await this.dal.proactive.getProactiveAnalytics(personalityId);
        } catch (error) {
            this.logger.error('Error getting learning analytics', 'ProactiveLearning', {
                error: error.message,
                personalityId
            });
            return { engagement: {}, learning: [] };
        }
    }
}

module.exports = ProactiveLearningService; 