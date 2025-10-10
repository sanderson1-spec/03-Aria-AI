/**
 * Enhanced Conversation Analyzer
 * 
 * CLEAN ARCHITECTURE: Domain-focused conversation analysis
 * - Direct LLM integration for real-time analysis
 * - Conversation pattern detection and insights
 * - Enhanced message analysis and context understanding
 * 
 * SIMPLIFIED: Removed caching complexity that was causing bugs
 * Analysis operations are fast enough without caching overhead
 */

const AbstractService = require('../base/CORE_AbstractService');
const DateTimeUtils = require('../../utils/datetime_utils');

class EnhancedConversationAnalyzer extends AbstractService {
    constructor(dependencies) {
        super('ConversationAnalyzer', dependencies);
        
        // Analysis configuration
        this.config = {
            analysisDepth: 'standard',
            contextWindow: 5,
            enablePatternDetection: true
        };
    }

    async onInitialize() {
        // CLEAN ARCHITECTURE: Extract dependencies
        this.logger = this.dependencies.logger;
        this.errorHandler = this.dependencies.errorHandling;
        
        // ARCHITECTURE FIX: Use centralized services instead of llmOrchestrator
        this.structuredResponseService = this.dependencies.structuredResponse || null;
        
        if (this.logger) {
            this.logger.info('⚙️ Enhanced Conversation Analyzer initialized');
        }
    }

    /**
     * Enhanced message analysis with direct LLM processing
     */
    async analyzeMessage(message, previousMessages = [], sessionContext = {}) {
        try {
            // Generate enhanced analysis directly
            const enhancedAnalysis = await this.generateEnhancedAnalysis(
                message, 
                previousMessages, 
                sessionContext
            );
            
            return enhancedAnalysis;
            
        } catch (error) {
            this.logger.error('Enhanced analysis failed:', error);
            return this.getFallbackAnalysis(message);
        }
    }

    /**
     * Dynamic context relevance scoring using LLM
     */
    async scoreContextRelevance(recentMessages, currentMessage) {
        if (!this.structuredResponseService || recentMessages.length === 0) {
            return this.fallbackRelevanceScoring(recentMessages, currentMessage);
        }

        const scoringPrompt = `
Rate the relevance (1-10) of each previous message for responding naturally to the current message.

CURRENT MESSAGE: "${currentMessage}"

PREVIOUS MESSAGES TO SCORE:
${recentMessages.map((msg, i) => `${i}: [${msg.role}] "${msg.content}"`).join('\n')}

Consider:
- Is the topic still active or was it naturally concluded?
- Would referencing this message enhance the conversation or feel repetitive?
- Does this message contain important ongoing context?
- Has the conversation naturally moved past this topic?

Respond with JSON: 
{
    "scores": [score1, score2, ...],
    "reasoning": ["reason1", "reason2", ...],
    "overallFlow": "natural/repetitive/scattered"
}

Be conservative - only give high scores (7+) to messages that would genuinely enhance the current conversation.`;

        try {
            // ARCHITECTURE FIX: Use centralized StructuredResponseService
            const schema = {
                type: 'object',
                properties: {
                    scores: { type: 'array', items: { type: 'number' } },
                    reasoning: { type: 'array', items: { type: 'string' } },
                    overallFlow: { type: 'string' }
                }
            };
            const result = await this.structuredResponseService.generateStructuredResponse(
                scoringPrompt, 
                schema, 
                {
                    maxTokens: 400,
                    temperature: 0.3
                }
            );

            return {
                scores: result.scores || recentMessages.map(() => 5),
                reasoning: result.reasoning || [],
                overallFlow: result.overallFlow || 'natural'
            };
            
        } catch (error) {
            this.logger.warn(`⚠️ LLM relevance scoring failed: ${error.message}, using fallback`);
            return this.fallbackRelevanceScoring(recentMessages, currentMessage);
        }
    }

    /**
     * Smart context selection using LLM analysis
     */
    async selectRelevantContext(conversationHistory, currentMessage, maxMessages = 8) {
        if (!this.structuredResponseService || conversationHistory.length === 0) {
            return this.fallbackRelevantContext(conversationHistory, currentMessage, maxMessages);
        }

        // First, get LLM relevance scores for all messages
        const relevanceData = await this.scoreContextRelevance(conversationHistory, currentMessage);
        
        // Enhanced selection based on LLM insights and rule-based scoring
        const scoredMessages = conversationHistory.map((msg, index) => {
            // Start with rule-based score
            let baseScore = this.scoreMessageRelevance(msg, index, conversationHistory.length, currentMessage);
            
            // Apply LLM relevance multiplier
            const llmScore = relevanceData.scores[index] || 5;
            const llmMultiplier = (llmScore / 5.0); // Normalize to 0-2 range
            
            // Calculate final score
            const finalScore = baseScore * llmMultiplier * this.llmScoringWeights.llmRelevance;
            
            return {
                ...msg,
                relevanceScore: finalScore,
                llmScore: llmScore,
                reasoning: relevanceData.reasoning[index] || 'No specific reasoning'
            };
        });

        // Sort by relevance and take top messages
        const topRelevant = scoredMessages
            .sort((a, b) => b.relevanceScore - a.relevanceScore)
            .slice(0, maxMessages);

        // Re-sort chronologically for natural flow
        const chronologicalOrder = topRelevant
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        this.logger.info(`🧠 [Enhanced] LLM-filtered ${conversationHistory.length} messages to ${chronologicalOrder.length} most relevant`);
        this.logger.info(`🎯 Overall conversation flow: ${relevanceData.overallFlow}`);

        return chronologicalOrder;
    }

    /**
     * Generate conversation flow guidance for system prompts
     */
    async buildConversationFlowGuidance(recentContext, currentMessage) {
        if (!this.structuredResponseService) {
            return this.buildStaticFlowGuidance(recentContext, currentMessage);
        }

        const guidancePrompt = `
Based on this conversation flow, provide brief guidance for maintaining natural conversation.

RECENT CONTEXT: 
${recentContext.slice(-4).map(m => `${m.sender}: "${m.message}"`).join('\n')}

CURRENT MESSAGE: "${currentMessage}"

Provide guidance in this format:
{
    "flowGuidance": "string (max 2 sentences)",
    "topicStatus": "active/concluded/transitioning",
    "shouldReference": ["list", "of", "topics", "safe", "to", "reference"],
    "shouldAvoid": ["list", "of", "concluded", "topics", "to", "avoid"]
}

Focus on natural conversation flow. Only mark topics as concluded when they're truly finished and conversation has moved on.`;

        try {
            // ARCHITECTURE FIX: Use centralized StructuredResponseService
            const schema = {
                type: 'object',
                properties: {
                    flowGuidance: { type: 'string' },
                    topicStatus: { type: 'string' },
                    shouldReference: { type: 'array', items: { type: 'string' } },
                    shouldAvoid: { type: 'array', items: { type: 'string' } }
                }
            };
            const guidance = await this.structuredResponseService.generateStructuredResponse(
                guidancePrompt, 
                schema, 
                {
                    maxTokens: 200,
                    temperature: 0.4
                }
            );

            return {
                flowGuidance: guidance.flowGuidance || "Continue the conversation naturally.",
                topicStatus: guidance.topicStatus || "active",
                shouldReference: guidance.shouldReference || [],
                shouldAvoid: guidance.shouldAvoid || []
            };
            
        } catch (error) {
            this.logger.warn(`⚠️ Flow guidance generation failed: ${error.message}, using fallback`);
            return this.buildStaticFlowGuidance(recentContext, currentMessage);
        }
    }

    /**
     * Comprehensive conversation flow analysis
     */
    async analyzeConversationFlow(messages, currentMessage) {
        if (!messages || messages.length === 0) {
            return { flow: 'initial', guidance: 'Start the conversation naturally.' };
        }

        // Get recent context analysis
        const recentContext = messages.slice(-8);
        const flowGuidance = await this.buildConversationFlowGuidance(recentContext, currentMessage);
        
        // Analyze conversation segments for topic tracking
        const segments = this.segmentConversation(messages);
        const activeTopics = segments.filter(seg => !seg.concluded);
        const recentTopics = segments.slice(-3);

        return {
            flow: flowGuidance.topicStatus,
            guidance: flowGuidance.flowGuidance,
            activeTopics: activeTopics.length,
            recentTopics: recentTopics.map(t => ({
                messageCount: t.messageCount,
                concluded: t.concluded,
                timespan: this.calculateTimespan(t.startTime, t.endTime)
            })),
            shouldReference: flowGuidance.shouldReference,
            shouldAvoid: flowGuidance.shouldAvoid
        };
    }

    /**
     * Generate enhanced analysis using LLM
     */
    async generateEnhancedAnalysis(message, previousMessages, sessionContext) {
        const analysisPrompt = this.buildAnalysisPrompt(message, previousMessages, sessionContext);
        
        const llmService = this.dependencies.llm;
        if (!llmService) {
            throw new Error('LLM service not available');
        }
        
        const response = await llmService.generateResponse(analysisPrompt, [], 'system');
        
        // Parse and validate the response
        return this.parseAnalysisResponse(response.content, message);
    }

    /**
     * Build analysis prompt for LLM
     */
    buildAnalysisPrompt(message, previousMessages, sessionContext) {
        const contextStr = previousMessages.slice(-this.config.contextWindow)
            .map((msg, i) => `${msg.role}: "${msg.content}"`)
            .join('\n');
        
        const dateTimeContext = DateTimeUtils.getSystemPromptDateTime();
            
        return `
Analyze this conversation message for natural flow understanding:

${dateTimeContext}

PREVIOUS CONTEXT:
${contextStr}

CURRENT MESSAGE: 
${message.role}: "${message.content}"

Analyze and respond with JSON:
{
    "topicConclusion": boolean,
    "acknowledgment": boolean, 
    "newTopic": boolean,
    "relevanceScore": number,
    "messageType": string,
    "conversationFlow": string,
    "semanticWeight": number,
    "reasoning": string
}

Focus on natural conversation flow and semantic understanding. Consider time-based context when analyzing conversation patterns and flow.`;
    }

    /**
     * Parse LLM response into analysis object
     */
    parseAnalysisResponse(responseContent, message) {
        try {
            const analysis = JSON.parse(responseContent);
            
            // Validate and set defaults
            return {
                topicConclusion: analysis.topicConclusion || false,
                acknowledgment: analysis.acknowledgment || false,
                newTopic: analysis.newTopic || false,
                relevanceScore: Math.max(1, Math.min(10, analysis.relevanceScore || 5)),
                messageType: analysis.messageType || 'statement',
                conversationFlow: analysis.conversationFlow || 'continuing',
                semanticWeight: Math.max(0, Math.min(2, analysis.semanticWeight || 1.0)),
                reasoning: analysis.reasoning || 'Analysis completed'
            };
        } catch (error) {
            this.logger.warn('Failed to parse LLM analysis response:', error);
            return this.getFallbackAnalysis(message);
        }
    }

    /**
     * Fallback analysis when LLM fails
     */
    getFallbackAnalysis(message) {
        const text = message.content.toLowerCase();
        
        return {
            topicConclusion: false,
            acknowledgment: ['ok', 'yes', 'no', 'thanks', 'thank you'].some(word => text.includes(word)),
            newTopic: text.includes('?') || text.includes('what') || text.includes('how'),
            relevanceScore: 5,
            messageType: text.includes('?') ? 'question' : 'statement',
            conversationFlow: 'continuing',
            semanticWeight: 1.0,
            reasoning: 'Fallback rule-based analysis'
        };
    }

    // PRIVATE HELPER METHODS

    validateAndEnhanceAnalysis(analysis, message) {
        // Ensure required fields exist with defaults
        return {
            topicConclusion: analysis.topicConclusion || false,
            acknowledgment: analysis.acknowledgment || false,
            newTopic: analysis.newTopic || false,
            relevanceScore: Math.max(1, Math.min(10, analysis.relevanceScore || 5)),
            messageType: analysis.messageType || 'statement',
            conversationFlow: analysis.conversationFlow || 'continuing',
            semanticWeight: Math.max(0.1, Math.min(2.0, analysis.semanticWeight || 1.0)),
            reasoning: analysis.reasoning || 'LLM analysis completed'
        };
    }

    fallbackMessageAnalysis(message, nextMessage) {
        return {
            topicConclusion: super.isTopicConclusion(message.content, nextMessage?.content),
            acknowledgment: super.isAcknowledgment(message.content),
            newTopic: false,
            relevanceScore: 5,
            messageType: super.isQuestion(message.content) ? 'question' : 'statement',
            conversationFlow: 'continuing',
            semanticWeight: 1.0,
            reasoning: 'Fallback rule-based analysis'
        };
    }

    fallbackRelevanceScoring(messages, currentMessage) {
        return {
            scores: messages.map(() => 5),
            reasoning: messages.map(() => 'Fallback scoring'),
            overallFlow: 'natural'
        };
    }

    buildStaticFlowGuidance(recentContext, currentMessage) {
        // Simple static guidance based on patterns
        const hasQuestion = super.isQuestion(currentMessage);
        const recentQuestions = recentContext.filter(m => super.isQuestion(m.message));
        
        let guidance = "Continue the conversation naturally.";
        if (hasQuestion && recentQuestions.length === 0) {
            guidance = "Focus on answering the user's question directly.";
        } else if (recentQuestions.length > 0) {
            guidance = "Build on the current topic while addressing any questions.";
        }

        return {
            flowGuidance: guidance,
            topicStatus: "active",
            shouldReference: [],
            shouldAvoid: []
        };
    }

    calculateTimespan(startTime, endTime) {
        const diff = new Date(endTime) - new Date(startTime);
        const minutes = Math.round(diff / (1000 * 60));
        if (minutes < 60) return `${minutes}m`;
        const hours = Math.round(minutes / 60);
        return `${hours}h`;
    }

    /**
     * Fallback context selection when LLM is not available
     */
    fallbackRelevantContext(conversationHistory, currentMessage, maxMessages = 8) {
        // Simple time-based and relevance-based selection
        return conversationHistory.slice(-maxMessages);
    }

    /**
     * Segment conversation into topic-based chunks
     * Returns array of segments with concluded status
     */
    segmentConversation(messages) {
        if (!messages || messages.length === 0) {
            return [];
        }

        // Simple segmentation: group messages into segments of 4-6 exchanges
        const segments = [];
        const segmentSize = 5;
        
        for (let i = 0; i < messages.length; i += segmentSize) {
            const segmentMessages = messages.slice(i, i + segmentSize);
            segments.push({
                messages: segmentMessages,
                startIndex: i,
                endIndex: Math.min(i + segmentSize, messages.length),
                concluded: i + segmentSize < messages.length // Segments are concluded if not the last one
            });
        }

        return segments;
    }
}

module.exports = EnhancedConversationAnalyzer; 