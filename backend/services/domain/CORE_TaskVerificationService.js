const AbstractService = require('../base/CORE_AbstractService');

/**
 * TaskVerificationService - Handles commitment/task verification with character psychology
 * CLEAN ARCHITECTURE: Domain layer service for character-driven task verification
 * 
 * This service coordinates:
 * - Commitment context retrieval
 * - Character psychology state
 * - Conversation memory
 * - LLM-based verification analysis
 * - Verification result persistence
 */
class TaskVerificationService extends AbstractService {
    constructor(dependencies) {
        super('TaskVerificationService', dependencies);
        this.database = dependencies.database;
        this.structuredResponse = dependencies.structuredResponse;
        this.psychology = dependencies.psychology;
        this.logger = dependencies.logger;
        this.errorHandler = dependencies.errorHandling;
    }

    async onInitialize() {
        this.dal = this.database.getDAL();
        this.logger.info('TaskVerificationService initialized', 'TaskVerificationService');
    }

    /**
     * Verify a task submission with character psychology and context
     * CLEAN ARCHITECTURE: Domain layer orchestration
     * 
     * @param {string} commitmentId - Commitment to verify
     * @param {string} userId - User who submitted (for isolation)
     * @returns {Promise<Object>} Verification response with character feedback
     */
    async verifySubmission(commitmentId, userId) {
        try {
            this.logger.info('Starting task verification', { commitmentId, userId });

            // Step 1: Fetch commitment with full context
            this.logger.debug('Fetching commitment with context', { commitmentId });
            const commitment = await this.dal.commitments.getCommitmentWithContext(commitmentId);

            if (!commitment) {
                throw new Error(`Commitment not found: ${commitmentId}`);
            }

            // Validate user ownership
            if (commitment.user_id !== userId) {
                throw new Error(`User ${userId} does not own commitment ${commitmentId}`);
            }

            // Validate submission exists
            if (!commitment.submission_content) {
                throw new Error(`No submission content found for commitment ${commitmentId}`);
            }

            // Step 2: Get character's psychological state
            this.logger.debug('Fetching character psychological state', { 
                characterId: commitment.character_id,
                userId,
                chatId: commitment.chat_id
            });

            const psychologyState = await this.psychology.getCharacterState(commitment.chat_id);

            // Step 3: Get recent conversation history (last 20 messages)
            this.logger.debug('Fetching recent conversation history', { chatId: commitment.chat_id });
            const recentMessages = await this.dal.conversations.getRecentMessages(
                commitment.chat_id,
                20
            );

            // Step 4: Build verification prompt with all context
            const verificationPrompt = this._buildVerificationPrompt(
                commitment,
                psychologyState,
                recentMessages
            );

            this.logger.debug('Built verification prompt', { 
                promptLength: verificationPrompt.length,
                characterId: commitment.character_id
            });

            // Step 5: Define verification schema for structured response
            const verificationSchema = {
                is_verifiable: { type: 'boolean' },
                verification_decision: { 
                    type: 'string', 
                    enum: ['approved', 'needs_revision', 'rejected', 'not_verifiable']
                },
                character_feedback: { type: 'string' },
                reasoning: { type: 'string' },
                timing_assessment: { 
                    type: 'string',
                    enum: ['plausible', 'suspicious', 'too_fast', 'too_slow']
                },
                quality_assessment: {
                    type: 'string',
                    enum: ['excellent', 'good', 'acceptable', 'poor', 'unacceptable']
                },
                detected_ai_generation: { type: 'boolean' }
            };

            // Step 6: Call analytical LLM for structured verification analysis
            this.logger.info('Requesting LLM verification analysis (analytical model)', { 
                commitmentId,
                userId,
                role: 'analytical'
            });

            const verificationResult = await this.structuredResponse.generateStructuredResponse(
                verificationPrompt,
                verificationSchema,
                { 
                    userId: userId,
                    role: 'analytical',
                    temperature: 0.1  // Low temperature for analytical verification
                }
            );

            this.logger.debug('Received verification result', { 
                decision: verificationResult.verification_decision,
                isVerifiable: verificationResult.is_verifiable,
                timingAssessment: verificationResult.timing_assessment
            });

            // Step 7: Record verification result in database
            this.logger.debug('Recording verification result', { commitmentId });

            const verificationData = {
                verification_decision: verificationResult.verification_decision,
                verification_result: verificationResult.character_feedback,
                verification_reasoning: verificationResult.reasoning,
                verified_at: this._getCurrentTimestamp()
            };

            const updatedCommitment = await this.dal.commitments.recordVerification(
                commitmentId,
                verificationData
            );

            if (!updatedCommitment) {
                this.logger.warn('Failed to record verification in database', { commitmentId });
                throw new Error('Failed to persist verification result');
            }

            this.logger.info('Task verification completed successfully', { 
                commitmentId,
                decision: verificationResult.verification_decision,
                revisionCount: updatedCommitment.revision_count || 0
            });

            // Step 8: Return verification response for immediate display
            return {
                success: true,
                commitment: updatedCommitment,
                verification: {
                    decision: verificationResult.verification_decision,
                    feedback: verificationResult.character_feedback,
                    isVerifiable: verificationResult.is_verifiable,
                    timingAssessment: verificationResult.timing_assessment,
                    qualityAssessment: verificationResult.quality_assessment,
                    detectedAiGeneration: verificationResult.detected_ai_generation
                },
                character: {
                    id: commitment.character.id,
                    name: commitment.character.name,
                    currentMood: psychologyState?.current_emotion || 'neutral'
                }
            };

        } catch (error) {
            throw this.errorHandler.wrapDomainError(error, 'Task verification failed', { 
                commitmentId, 
                userId 
            });
        }
    }

    /**
     * Build verification prompt with character psychology and context
     * CLEAN ARCHITECTURE: Private helper for prompt construction
     * 
     * @private
     * @param {Object} commitment - Commitment with full context
     * @param {Object} psychologyState - Character's psychological state
     * @param {Array} recentMessages - Recent conversation messages
     * @returns {string} Formatted verification prompt
     */
    _buildVerificationPrompt(commitment, psychologyState, recentMessages) {
        const character = commitment.character;
        const timeTaken = this._calculateTimeDiff(
            commitment.assigned_at,
            commitment.submitted_at
        );

        // Format recent messages for context
        const formattedMessages = recentMessages && recentMessages.length > 0
            ? recentMessages.map(msg => `[${msg.role}]: ${msg.content}`).join('\n')
            : 'No recent conversation history';

        // Handle null psychology state with defaults
        const mood = psychologyState?.current_emotion || 'neutral';
        const energy = psychologyState?.energy_level || 7;
        const relationship = psychologyState?.relationship_dynamic || 'professional';

        const prompt = `You are ${character.name}, analyzing a task submission from the user.

EXAMPLE 1 - Verifiable and Approved:
Task: "Write 5 sentences in Spanish about your day"
Submission: "Hoy me desperté temprano. Desayuné huevos con pan. Fui a trabajar en autobús. Almorcé con mis compañeros. Regresé a casa por la tarde."
Time taken: 25 minutes
Decision: APPROVED
Reasoning: Correct Spanish grammar, appropriate vocabulary, realistic completion time.
Response: {
  "is_verifiable": true,
  "verification_decision": "approved",
  "character_feedback": "¡Excelente trabajo! Your sentences are grammatically correct and show good vocabulary use.",
  "reasoning": "User submitted exactly 5 sentences in Spanish with correct grammar and realistic completion time.",
  "timing_assessment": "plausible",
  "quality_assessment": "excellent",
  "detected_ai_generation": false
}

EXAMPLE 2 - Suspicious Timing:
Task: "Write a 500-word essay on climate change"
Submission: [500 words of well-structured essay]
Time taken: 4 minutes
Decision: NEEDS_REVISION
Reasoning: Impossibly fast for human writing. Quality too polished. Likely AI-generated.
Response: {
  "is_verifiable": true,
  "verification_decision": "needs_revision",
  "character_feedback": "This is well-written, but you submitted it incredibly quickly. I'd like you to write this again, taking your time. Show me your rough draft too.",
  "reasoning": "Submission quality is good but timing is highly suspicious. 500 words in 4 minutes suggests AI generation.",
  "timing_assessment": "too_fast",
  "quality_assessment": "good",
  "detected_ai_generation": true
}

EXAMPLE 3 - Not Verifiable:
Task: "Go for a 30-minute walk outside"
Submission: "I went for a walk"
Decision: NOT_VERIFIABLE
Reasoning: I cannot verify physical activities without tracking data.
Response: {
  "is_verifiable": false,
  "verification_decision": "not_verifiable",
  "character_feedback": "I trust you completed this! Unfortunately, I can't verify walks without fitness data. Great job taking care of your health!",
  "reasoning": "Physical activity commitment cannot be verified remotely without fitness tracker data or photos.",
  "timing_assessment": "plausible",
  "quality_assessment": "acceptable",
  "detected_ai_generation": false
}

NOW ANALYZE THIS SUBMISSION:

TASK CONTEXT:
Assignment: "${commitment.description}"
Assigned at: ${commitment.assigned_at}
Due at: ${commitment.due_at || 'no deadline'}
Submitted at: ${commitment.submitted_at}
Time taken: ${timeTaken}

SUBMISSION:
"${commitment.submission_content}"

YOUR PSYCHOLOGICAL STATE:
Mood: ${mood}
Energy: ${energy}/10
Relationship dynamic: ${relationship}

CONVERSATION CONTEXT:
${formattedMessages}

VERIFICATION TASK:
1. Can you verify this submission? (Do you have the ability to check this work?)
2. If verifiable:
   - Does it meet expectations?
   - Is the timing plausible? (Could a human realistically complete this in the time taken?)
   - What's the quality level?
3. What feedback should you give? (Stay in character)
4. What's your decision?

Respond with strict JSON:
{
  "is_verifiable": boolean,
  "verification_decision": "approved|needs_revision|rejected|not_verifiable",
  "character_feedback": "Your response to the user in your voice",
  "reasoning": "Your internal analysis (not shown to user)",
  "timing_assessment": "plausible|suspicious|too_fast|too_slow",
  "quality_assessment": "excellent|good|acceptable|poor|unacceptable",
  "detected_ai_generation": boolean (if submission seems AI-generated)
}

Be authentic to your personality. Strict teachers are critical. Supportive ones encourage.`;

        return prompt;
    }

    /**
     * Calculate time difference between two timestamps
     * CLEAN ARCHITECTURE: Private utility method
     * 
     * @private
     * @param {string} startTime - Start timestamp
     * @param {string} endTime - End timestamp
     * @returns {string} Human-readable time difference
     */
    _calculateTimeDiff(startTime, endTime) {
        try {
            const start = new Date(startTime);
            const end = new Date(endTime);
            const diffMs = end - start;

            if (diffMs < 0) {
                return 'negative time (data error)';
            }

            const diffMinutes = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMinutes / 60);
            const diffDays = Math.floor(diffHours / 24);

            if (diffDays > 0) {
                const remainingHours = diffHours % 24;
                return `${diffDays} day${diffDays > 1 ? 's' : ''}${remainingHours > 0 ? ` ${remainingHours} hour${remainingHours > 1 ? 's' : ''}` : ''}`;
            } else if (diffHours > 0) {
                const remainingMinutes = diffMinutes % 60;
                return `${diffHours} hour${diffHours > 1 ? 's' : ''}${remainingMinutes > 0 ? ` ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}` : ''}`;
            } else if (diffMinutes > 0) {
                return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''}`;
            } else {
                const diffSeconds = Math.floor(diffMs / 1000);
                return `${diffSeconds} second${diffSeconds > 1 ? 's' : ''}`;
            }
        } catch (error) {
            this.logger.warn('Error calculating time difference', { startTime, endTime, error: error.message });
            return 'unknown duration';
        }
    }

    /**
     * Get current timestamp in ISO format
     * CLEAN ARCHITECTURE: Private utility method
     * 
     * @private
     * @returns {string} ISO timestamp
     */
    _getCurrentTimestamp() {
        return new Date().toISOString();
    }
}

module.exports = TaskVerificationService;

