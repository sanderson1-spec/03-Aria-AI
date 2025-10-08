/**
 * Unit Tests for TaskVerificationService
 * 
 * CLEAN ARCHITECTURE TESTING:
 * - Test service creation and inheritance
 * - Test verification workflow orchestration
 * - Test character-driven verification decisions
 * - Test timing and quality assessment
 * - Mock external dependencies for isolated testing
 */

const TaskVerificationService = require('../../backend/services/domain/CORE_TaskVerificationService');

describe('TaskVerificationService', () => {
    let verificationService;
    let mockDeps;
    let mockDAL;

    beforeEach(async () => {
        mockDeps = createMockDependencies();
        
        // Add wrapDomainError to errorHandling mock
        mockDeps.errorHandling.wrapDomainError = (error, message, context) => {
            const wrappedError = new Error(`${message}: ${error.message}`);
            wrappedError.context = context;
            return wrappedError;
        };
        
        // Mock database service with DAL
        mockDAL = {
            commitments: {
                getCommitmentWithContext: jest.fn(),
                recordVerification: jest.fn()
            },
            conversations: {
                getRecentMessages: jest.fn()
            }
        };
        
        mockDeps.database = {
            getDAL: jest.fn(() => mockDAL)
        };

        // Mock structured response service
        mockDeps.structuredResponse = {
            generateStructuredResponse: jest.fn()
        };

        // Mock psychology service
        mockDeps.psychology = {
            getCharacterState: jest.fn()
        };
        
        verificationService = new TaskVerificationService(mockDeps);
        
        // Initialize the service to set up this.dal
        await verificationService.initialize();
    });

    describe('Architecture Compliance', () => {
        test('should extend AbstractService', () => {
            expect(verificationService.constructor.name).toBe('TaskVerificationService');
            expect(verificationService.name).toBe('TaskVerificationService');
            expect(verificationService.logger).toBeDefined();
            expect(verificationService.errorHandler).toBeDefined();
        });

        test('should have proper dependencies injected', async () => {
            await verificationService.initialize();
            expect(verificationService.database).toBeDefined();
            expect(verificationService.dal).toBeDefined();
            expect(verificationService.structuredResponse).toBeDefined();
            expect(verificationService.psychology).toBeDefined();
        });

        test('should implement required service interface', () => {
            const requiredMethods = ['initialize', 'shutdown', 'checkHealth'];
            requiredMethods.forEach(method => {
                expect(typeof verificationService[method]).toBe('function');
            });
        });

        test('should implement verification-specific methods', () => {
            const verificationMethods = ['verifySubmission'];
            verificationMethods.forEach(method => {
                expect(typeof verificationService[method]).toBe('function');
            });
        });

        test('should have private helper methods', () => {
            expect(typeof verificationService._buildVerificationPrompt).toBe('function');
            expect(typeof verificationService._calculateTimeDiff).toBe('function');
            expect(typeof verificationService._getCurrentTimestamp).toBe('function');
        });
    });

    describe('Service Lifecycle', () => {
        test('should initialize successfully', async () => {
            // Service is already initialized in beforeEach
            expect(verificationService.dal).toBeDefined();
            expect(verificationService.database).toBeDefined();
        });

        test('should provide health status', async () => {
            const health = await verificationService.checkHealth();
            expect(health).toBeDefined();
            expect(typeof health.healthy).toBe('boolean');
        });

        test('should shutdown gracefully', async () => {
            jest.spyOn(verificationService, 'onShutdown').mockResolvedValue();
            
            await expect(verificationService.shutdown()).resolves.not.toThrow();
        });
    });

    describe('Verifiable Task Verification', () => {
        test('should verify and approve a good submission', async () => {
            const mockCommitment = {
                id: 'commitment-1',
                user_id: 'user-123',
                chat_id: 'chat-456',
                character_id: 'aria',
                description: 'Exercise for 30 minutes',
                assigned_at: '2025-10-07T10:00:00Z',
                submitted_at: '2025-10-07T10:45:00Z',
                due_at: '2025-10-07T18:00:00Z',
                submission_content: 'I completed 30 minutes of cardio at the gym',
                character: {
                    id: 'aria',
                    name: 'Aria',
                    description: 'Supportive AI assistant'
                }
            };

            const mockPsychologyState = {
                current_emotion: 'supportive',
                energy_level: 7,
                relationship_dynamic: 'encouraging'
            };

            const mockMessages = [
                { role: 'assistant', content: 'Please do 30 minutes of exercise today' },
                { role: 'user', content: 'Okay, I will!' }
            ];

            const mockVerificationResult = {
                is_verifiable: true,
                verification_decision: 'approved',
                character_feedback: 'Excellent work! You completed the exercise as requested.',
                reasoning: 'User provided clear evidence of completing 30 minutes of exercise. Time frame is reasonable.',
                timing_assessment: 'plausible',
                quality_assessment: 'excellent',
                detected_ai_generation: false
            };

            const mockUpdatedCommitment = {
                ...mockCommitment,
                status: 'completed',
                verification_decision: 'approved'
            };

            mockDAL.commitments.getCommitmentWithContext.mockResolvedValue(mockCommitment);
            mockDeps.psychology.getCharacterState.mockResolvedValue(mockPsychologyState);
            mockDAL.conversations.getRecentMessages.mockResolvedValue(mockMessages);
            mockDeps.structuredResponse.generateStructuredResponse.mockResolvedValue(mockVerificationResult);
            mockDAL.commitments.recordVerification.mockResolvedValue(mockUpdatedCommitment);

            const result = await verificationService.verifySubmission('commitment-1', 'user-123');

            expect(result.success).toBe(true);
            expect(result.verification.decision).toBe('approved');
            expect(result.verification.feedback).toContain('Excellent work');
            expect(result.verification.isVerifiable).toBe(true);
            expect(result.commitment.status).toBe('completed');
        });

        test('should include character psychology in verification', async () => {
            const mockCommitment = {
                id: 'commitment-1',
                user_id: 'user-123',
                chat_id: 'chat-456',
                character_id: 'alex',
                description: 'Complete math homework',
                assigned_at: '2025-10-07T10:00:00Z',
                submitted_at: '2025-10-07T11:30:00Z',
                submission_content: 'All problems solved',
                character: { id: 'alex', name: 'Alex', description: 'Analytical teacher' }
            };

            const mockPsychologyState = {
                current_emotion: 'analytical',
                energy_level: 8,
                relationship_dynamic: 'professional'
            };

            mockDAL.commitments.getCommitmentWithContext.mockResolvedValue(mockCommitment);
            mockDeps.psychology.getCharacterState.mockResolvedValue(mockPsychologyState);
            mockDAL.conversations.getRecentMessages.mockResolvedValue([]);
            mockDeps.structuredResponse.generateStructuredResponse.mockResolvedValue({
                is_verifiable: true,
                verification_decision: 'approved',
                character_feedback: 'Good work',
                reasoning: 'Acceptable',
                timing_assessment: 'plausible',
                quality_assessment: 'good',
                detected_ai_generation: false
            });
            mockDAL.commitments.recordVerification.mockResolvedValue(mockCommitment);

            await verificationService.verifySubmission('commitment-1', 'user-123');

            expect(mockDeps.psychology.getCharacterState).toHaveBeenCalledWith(
                'chat-456'
            );

            const promptCall = mockDeps.structuredResponse.generateStructuredResponse.mock.calls[0][0];
            expect(promptCall).toContain('Mood: analytical');
            expect(promptCall).toContain('Energy: 8/10');
            expect(promptCall).toContain('Relationship dynamic: professional');
        });
    });

    describe('Non-Verifiable Task Handling', () => {
        test('should handle non-verifiable subjective tasks', async () => {
            const mockCommitment = {
                id: 'commitment-1',
                user_id: 'user-123',
                chat_id: 'chat-456',
                character_id: 'luna',
                description: 'Think about your life goals',
                assigned_at: '2025-10-07T10:00:00Z',
                submitted_at: '2025-10-07T10:15:00Z',
                submission_content: 'I thought about my goals for 10 minutes',
                character: { id: 'luna', name: 'Luna', description: 'Creative mentor' }
            };

            const mockVerificationResult = {
                is_verifiable: false,
                verification_decision: 'not_verifiable',
                character_feedback: 'I appreciate you taking time to reflect. Since this is an internal process, I cannot verify it objectively, but I trust you did the work.',
                reasoning: 'This is a subjective, internal task with no observable evidence',
                timing_assessment: 'plausible',
                quality_assessment: 'acceptable',
                detected_ai_generation: false
            };

            mockDAL.commitments.getCommitmentWithContext.mockResolvedValue(mockCommitment);
            mockDeps.psychology.getCharacterState.mockResolvedValue({ current_emotion: 'thoughtful', energy_level: 6, relationship_dynamic: 'supportive' });
            mockDAL.conversations.getRecentMessages.mockResolvedValue([]);
            mockDeps.structuredResponse.generateStructuredResponse.mockResolvedValue(mockVerificationResult);
            mockDAL.commitments.recordVerification.mockResolvedValue({
                ...mockCommitment,
                status: 'not_verifiable',
                verification_decision: 'not_verifiable'
            });

            const result = await verificationService.verifySubmission('commitment-1', 'user-123');

            expect(result.success).toBe(true);
            expect(result.verification.decision).toBe('not_verifiable');
            expect(result.verification.isVerifiable).toBe(false);
            expect(result.verification.feedback).toContain('cannot verify it objectively');
        });

        test('should explain why task is not verifiable', async () => {
            const mockCommitment = {
                id: 'commitment-1',
                user_id: 'user-123',
                chat_id: 'chat-456',
                character_id: 'aria',
                description: 'Feel more confident',
                assigned_at: '2025-10-07T10:00:00Z',
                submitted_at: '2025-10-07T10:30:00Z',
                submission_content: 'I feel more confident now',
                character: { id: 'aria', name: 'Aria' }
            };

            mockDAL.commitments.getCommitmentWithContext.mockResolvedValue(mockCommitment);
            mockDeps.psychology.getCharacterState.mockResolvedValue({ current_emotion: 'empathetic', energy_level: 7 });
            mockDAL.conversations.getRecentMessages.mockResolvedValue([]);
            mockDeps.structuredResponse.generateStructuredResponse.mockResolvedValue({
                is_verifiable: false,
                verification_decision: 'not_verifiable',
                character_feedback: 'Emotional states are personal and internal',
                reasoning: 'Cannot objectively measure internal feelings',
                timing_assessment: 'plausible',
                quality_assessment: 'acceptable',
                detected_ai_generation: false
            });
            mockDAL.commitments.recordVerification.mockResolvedValue(mockCommitment);

            const result = await verificationService.verifySubmission('commitment-1', 'user-123');

            expect(result.verification.feedback).toContain('personal and internal');
        });
    });

    describe('Timing Plausibility Detection', () => {
        test('should flag suspiciously fast submissions', async () => {
            const mockCommitment = {
                id: 'commitment-1',
                user_id: 'user-123',
                chat_id: 'chat-456',
                character_id: 'alex',
                description: 'Write a 5-page essay',
                assigned_at: '2025-10-07T10:00:00Z',
                submitted_at: '2025-10-07T10:05:00Z', // Only 5 minutes!
                submission_content: 'Here is my 5-page essay on artificial intelligence...',
                character: { id: 'alex', name: 'Alex', description: 'Analytical teacher' }
            };

            const mockVerificationResult = {
                is_verifiable: true,
                verification_decision: 'rejected',
                character_feedback: 'This submission is suspiciously fast. A 5-page essay cannot be written in 5 minutes. Please provide honest work.',
                reasoning: 'Time taken (5 minutes) is impossibly short for this task',
                timing_assessment: 'too_fast',
                quality_assessment: 'unacceptable',
                detected_ai_generation: true
            };

            mockDAL.commitments.getCommitmentWithContext.mockResolvedValue(mockCommitment);
            mockDeps.psychology.getCharacterState.mockResolvedValue({ current_emotion: 'skeptical', energy_level: 7 });
            mockDAL.conversations.getRecentMessages.mockResolvedValue([]);
            mockDeps.structuredResponse.generateStructuredResponse.mockResolvedValue(mockVerificationResult);
            mockDAL.commitments.recordVerification.mockResolvedValue({
                ...mockCommitment,
                status: 'rejected'
            });

            const result = await verificationService.verifySubmission('commitment-1', 'user-123');

            expect(result.verification.decision).toBe('rejected');
            expect(result.verification.timingAssessment).toBe('too_fast');
            expect(result.verification.detectedAiGeneration).toBe(true);
            expect(result.verification.feedback).toContain('suspiciously fast');
        });

        test('should detect too slow submissions', async () => {
            const mockCommitment = {
                id: 'commitment-1',
                user_id: 'user-123',
                chat_id: 'chat-456',
                character_id: 'aria',
                description: 'Do 10 pushups',
                assigned_at: '2025-10-07T10:00:00Z',
                submitted_at: '2025-10-10T10:00:00Z', // 3 days later
                submission_content: 'I did 10 pushups',
                character: { id: 'aria', name: 'Aria' }
            };

            const mockVerificationResult = {
                is_verifiable: true,
                verification_decision: 'approved',
                character_feedback: 'You completed the task, though it took longer than expected.',
                reasoning: 'Task completed but timing is unusual',
                timing_assessment: 'too_slow',
                quality_assessment: 'acceptable',
                detected_ai_generation: false
            };

            mockDAL.commitments.getCommitmentWithContext.mockResolvedValue(mockCommitment);
            mockDeps.psychology.getCharacterState.mockResolvedValue({ current_emotion: 'curious', energy_level: 6 });
            mockDAL.conversations.getRecentMessages.mockResolvedValue([]);
            mockDeps.structuredResponse.generateStructuredResponse.mockResolvedValue(mockVerificationResult);
            mockDAL.commitments.recordVerification.mockResolvedValue(mockCommitment);

            const result = await verificationService.verifySubmission('commitment-1', 'user-123');

            expect(result.verification.timingAssessment).toBe('too_slow');
        });

        test('should accept plausible timing', async () => {
            const mockCommitment = {
                id: 'commitment-1',
                user_id: 'user-123',
                chat_id: 'chat-456',
                character_id: 'aria',
                description: 'Read 20 pages',
                assigned_at: '2025-10-07T10:00:00Z',
                submitted_at: '2025-10-07T10:40:00Z', // 40 minutes - reasonable
                submission_content: 'I read 20 pages of the book',
                character: { id: 'aria', name: 'Aria' }
            };

            const mockVerificationResult = {
                is_verifiable: true,
                verification_decision: 'approved',
                character_feedback: 'Great job completing the reading!',
                reasoning: 'Timing is reasonable for 20 pages',
                timing_assessment: 'plausible',
                quality_assessment: 'good',
                detected_ai_generation: false
            };

            mockDAL.commitments.getCommitmentWithContext.mockResolvedValue(mockCommitment);
            mockDeps.psychology.getCharacterState.mockResolvedValue({ current_emotion: 'pleased', energy_level: 7 });
            mockDAL.conversations.getRecentMessages.mockResolvedValue([]);
            mockDeps.structuredResponse.generateStructuredResponse.mockResolvedValue(mockVerificationResult);
            mockDAL.commitments.recordVerification.mockResolvedValue(mockCommitment);

            const result = await verificationService.verifySubmission('commitment-1', 'user-123');

            expect(result.verification.timingAssessment).toBe('plausible');
            expect(result.verification.decision).toBe('approved');
        });
    });

    describe('Quality Assessment', () => {
        test('should assess excellent quality submissions', async () => {
            const mockCommitment = {
                id: 'commitment-1',
                user_id: 'user-123',
                chat_id: 'chat-456',
                character_id: 'alex',
                description: 'Solve 10 math problems',
                assigned_at: '2025-10-07T10:00:00Z',
                submitted_at: '2025-10-07T11:00:00Z',
                submission_content: 'All 10 problems solved with detailed work shown: Problem 1: ...',
                character: { id: 'alex', name: 'Alex' }
            };

            const mockVerificationResult = {
                is_verifiable: true,
                verification_decision: 'approved',
                character_feedback: 'Outstanding work! Your solutions are thorough and well-explained.',
                reasoning: 'All problems completed with clear methodology',
                timing_assessment: 'plausible',
                quality_assessment: 'excellent',
                detected_ai_generation: false
            };

            mockDAL.commitments.getCommitmentWithContext.mockResolvedValue(mockCommitment);
            mockDeps.psychology.getCharacterState.mockResolvedValue({ current_emotion: 'impressed', energy_level: 8 });
            mockDAL.conversations.getRecentMessages.mockResolvedValue([]);
            mockDeps.structuredResponse.generateStructuredResponse.mockResolvedValue(mockVerificationResult);
            mockDAL.commitments.recordVerification.mockResolvedValue(mockCommitment);

            const result = await verificationService.verifySubmission('commitment-1', 'user-123');

            expect(result.verification.qualityAssessment).toBe('excellent');
            expect(result.verification.feedback).toContain('Outstanding');
        });

        test('should assess poor quality submissions', async () => {
            const mockCommitment = {
                id: 'commitment-1',
                user_id: 'user-123',
                chat_id: 'chat-456',
                character_id: 'alex',
                description: 'Write a summary of the chapter',
                assigned_at: '2025-10-07T10:00:00Z',
                submitted_at: '2025-10-07T10:30:00Z',
                submission_content: 'I read it',
                character: { id: 'alex', name: 'Alex' }
            };

            const mockVerificationResult = {
                is_verifiable: true,
                verification_decision: 'rejected',
                character_feedback: 'This is insufficient. I asked for a summary, not a confirmation that you read it. Please provide actual content.',
                reasoning: 'Response lacks substance and does not meet requirements',
                timing_assessment: 'plausible',
                quality_assessment: 'poor',
                detected_ai_generation: false
            };

            mockDAL.commitments.getCommitmentWithContext.mockResolvedValue(mockCommitment);
            mockDeps.psychology.getCharacterState.mockResolvedValue({ current_emotion: 'disappointed', energy_level: 6 });
            mockDAL.conversations.getRecentMessages.mockResolvedValue([]);
            mockDeps.structuredResponse.generateStructuredResponse.mockResolvedValue(mockVerificationResult);
            mockDAL.commitments.recordVerification.mockResolvedValue({
                ...mockCommitment,
                status: 'rejected'
            });

            const result = await verificationService.verifySubmission('commitment-1', 'user-123');

            expect(result.verification.qualityAssessment).toBe('poor');
            expect(result.verification.decision).toBe('rejected');
        });

        test('should assess acceptable quality submissions', async () => {
            const mockCommitment = {
                id: 'commitment-1',
                user_id: 'user-123',
                chat_id: 'chat-456',
                character_id: 'aria',
                description: 'Practice guitar for 20 minutes',
                assigned_at: '2025-10-07T10:00:00Z',
                submitted_at: '2025-10-07T10:25:00Z',
                submission_content: 'I practiced scales for 20 minutes',
                character: { id: 'aria', name: 'Aria' }
            };

            const mockVerificationResult = {
                is_verifiable: true,
                verification_decision: 'approved',
                character_feedback: 'Good work! You completed the practice session.',
                reasoning: 'Task completed as requested',
                timing_assessment: 'plausible',
                quality_assessment: 'acceptable',
                detected_ai_generation: false
            };

            mockDAL.commitments.getCommitmentWithContext.mockResolvedValue(mockCommitment);
            mockDeps.psychology.getCharacterState.mockResolvedValue({ current_emotion: 'satisfied', energy_level: 7 });
            mockDAL.conversations.getRecentMessages.mockResolvedValue([]);
            mockDeps.structuredResponse.generateStructuredResponse.mockResolvedValue(mockVerificationResult);
            mockDAL.commitments.recordVerification.mockResolvedValue(mockCommitment);

            const result = await verificationService.verifySubmission('commitment-1', 'user-123');

            expect(result.verification.qualityAssessment).toBe('acceptable');
        });
    });

    describe('Revision Request Flow', () => {
        test('should request revisions for incomplete work', async () => {
            const mockCommitment = {
                id: 'commitment-1',
                user_id: 'user-123',
                chat_id: 'chat-456',
                character_id: 'alex',
                description: 'Answer all 3 essay questions',
                assigned_at: '2025-10-07T10:00:00Z',
                submitted_at: '2025-10-07T11:00:00Z',
                submission_content: 'I answered question 1 and 2',
                character: { id: 'alex', name: 'Alex' },
                revision_count: 0
            };

            const mockVerificationResult = {
                is_verifiable: true,
                verification_decision: 'needs_revision',
                character_feedback: 'You only answered 2 out of 3 questions. Please complete question 3 as well.',
                reasoning: 'Task incomplete - missing question 3',
                timing_assessment: 'plausible',
                quality_assessment: 'good',
                detected_ai_generation: false
            };

            const mockUpdatedCommitment = {
                ...mockCommitment,
                status: 'needs_revision',
                verification_decision: 'needs_revision',
                revision_count: 1
            };

            mockDAL.commitments.getCommitmentWithContext.mockResolvedValue(mockCommitment);
            mockDeps.psychology.getCharacterState.mockResolvedValue({ current_emotion: 'instructive', energy_level: 7 });
            mockDAL.conversations.getRecentMessages.mockResolvedValue([]);
            mockDeps.structuredResponse.generateStructuredResponse.mockResolvedValue(mockVerificationResult);
            mockDAL.commitments.recordVerification.mockResolvedValue(mockUpdatedCommitment);

            const result = await verificationService.verifySubmission('commitment-1', 'user-123');

            expect(result.verification.decision).toBe('needs_revision');
            expect(result.commitment.revision_count).toBe(1);
            expect(result.verification.feedback).toContain('Please complete question 3');
        });

        test('should provide constructive feedback for revisions', async () => {
            const mockCommitment = {
                id: 'commitment-1',
                user_id: 'user-123',
                chat_id: 'chat-456',
                character_id: 'luna',
                description: 'Write a creative story',
                assigned_at: '2025-10-07T10:00:00Z',
                submitted_at: '2025-10-07T11:30:00Z',
                submission_content: 'Once upon a time there was a person.',
                character: { id: 'luna', name: 'Luna' }
            };

            const mockVerificationResult = {
                is_verifiable: true,
                verification_decision: 'needs_revision',
                character_feedback: 'This is a good start, but the story needs more detail. Add descriptions of the character and setting to bring it to life.',
                reasoning: 'Story lacks depth and detail',
                timing_assessment: 'plausible',
                quality_assessment: 'acceptable',
                detected_ai_generation: false
            };

            mockDAL.commitments.getCommitmentWithContext.mockResolvedValue(mockCommitment);
            mockDeps.psychology.getCharacterState.mockResolvedValue({ current_emotion: 'encouraging', energy_level: 8 });
            mockDAL.conversations.getRecentMessages.mockResolvedValue([]);
            mockDeps.structuredResponse.generateStructuredResponse.mockResolvedValue(mockVerificationResult);
            mockDAL.commitments.recordVerification.mockResolvedValue({
                ...mockCommitment,
                status: 'needs_revision',
                revision_count: 1
            });

            const result = await verificationService.verifySubmission('commitment-1', 'user-123');

            expect(result.verification.decision).toBe('needs_revision');
            expect(result.verification.feedback).toContain('Add descriptions');
        });
    });

    describe('Rejection Flow', () => {
        test('should reject dishonest submissions', async () => {
            const mockCommitment = {
                id: 'commitment-1',
                user_id: 'user-123',
                chat_id: 'chat-456',
                character_id: 'alex',
                description: 'Run 5 miles',
                assigned_at: '2025-10-07T10:00:00Z',
                submitted_at: '2025-10-07T10:05:00Z', // 5 minutes
                submission_content: 'I ran 5 miles',
                character: { id: 'alex', name: 'Alex' }
            };

            const mockVerificationResult = {
                is_verifiable: true,
                verification_decision: 'rejected',
                character_feedback: 'Running 5 miles in 5 minutes is physically impossible. Please be honest about your submissions.',
                reasoning: 'Timing makes task completion impossible',
                timing_assessment: 'too_fast',
                quality_assessment: 'unacceptable',
                detected_ai_generation: false
            };

            mockDAL.commitments.getCommitmentWithContext.mockResolvedValue(mockCommitment);
            mockDeps.psychology.getCharacterState.mockResolvedValue({ current_emotion: 'stern', energy_level: 7 });
            mockDAL.conversations.getRecentMessages.mockResolvedValue([]);
            mockDeps.structuredResponse.generateStructuredResponse.mockResolvedValue(mockVerificationResult);
            mockDAL.commitments.recordVerification.mockResolvedValue({
                ...mockCommitment,
                status: 'rejected'
            });

            const result = await verificationService.verifySubmission('commitment-1', 'user-123');

            expect(result.verification.decision).toBe('rejected');
            expect(result.verification.feedback).toContain('impossible');
            expect(result.commitment.status).toBe('rejected');
        });

        test('should reject work that does not meet requirements', async () => {
            const mockCommitment = {
                id: 'commitment-1',
                user_id: 'user-123',
                chat_id: 'chat-456',
                character_id: 'alex',
                description: 'Solve the calculus problem',
                assigned_at: '2025-10-07T10:00:00Z',
                submitted_at: '2025-10-07T10:30:00Z',
                submission_content: 'I tried but could not solve it',
                character: { id: 'alex', name: 'Alex' }
            };

            const mockVerificationResult = {
                is_verifiable: true,
                verification_decision: 'rejected',
                character_feedback: 'Trying is good, but the task was to solve the problem. Please attempt it again and show your work.',
                reasoning: 'Task not completed - no solution provided',
                timing_assessment: 'plausible',
                quality_assessment: 'poor',
                detected_ai_generation: false
            };

            mockDAL.commitments.getCommitmentWithContext.mockResolvedValue(mockCommitment);
            mockDeps.psychology.getCharacterState.mockResolvedValue({ current_emotion: 'firm', energy_level: 7 });
            mockDAL.conversations.getRecentMessages.mockResolvedValue([]);
            mockDeps.structuredResponse.generateStructuredResponse.mockResolvedValue(mockVerificationResult);
            mockDAL.commitments.recordVerification.mockResolvedValue({
                ...mockCommitment,
                status: 'rejected'
            });

            const result = await verificationService.verifySubmission('commitment-1', 'user-123');

            expect(result.verification.decision).toBe('rejected');
            expect(result.commitment.status).toBe('rejected');
        });
    });

    describe('Character Personality Integration', () => {
        test('should match strict teacher personality in verification', async () => {
            const mockCommitment = {
                id: 'commitment-1',
                user_id: 'user-123',
                chat_id: 'chat-456',
                character_id: 'strict-teacher',
                description: 'Complete homework assignment',
                assigned_at: '2025-10-07T10:00:00Z',
                submitted_at: '2025-10-07T11:00:00Z',
                submission_content: 'Here is my homework',
                character: { id: 'strict-teacher', name: 'Professor Harris', description: 'Strict and demanding teacher' }
            };

            const mockPsychologyState = {
                current_emotion: 'critical',
                energy_level: 8,
                relationship_dynamic: 'demanding'
            };

            const mockVerificationResult = {
                is_verifiable: true,
                verification_decision: 'needs_revision',
                character_feedback: 'This lacks detail. I expect thorough work with proper citations. Revise and resubmit.',
                reasoning: 'Does not meet high standards',
                timing_assessment: 'plausible',
                quality_assessment: 'acceptable',
                detected_ai_generation: false
            };

            mockDAL.commitments.getCommitmentWithContext.mockResolvedValue(mockCommitment);
            mockDeps.psychology.getCharacterState.mockResolvedValue(mockPsychologyState);
            mockDAL.conversations.getRecentMessages.mockResolvedValue([]);
            mockDeps.structuredResponse.generateStructuredResponse.mockResolvedValue(mockVerificationResult);
            mockDAL.commitments.recordVerification.mockResolvedValue(mockCommitment);

            const result = await verificationService.verifySubmission('commitment-1', 'user-123');

            expect(result.character.currentMood).toBe('critical');
            expect(result.verification.feedback).toContain('expect thorough work');
        });

        test('should match supportive personality in verification', async () => {
            const mockCommitment = {
                id: 'commitment-1',
                user_id: 'user-123',
                chat_id: 'chat-456',
                character_id: 'supportive-coach',
                description: 'Try meditation for 10 minutes',
                assigned_at: '2025-10-07T10:00:00Z',
                submitted_at: '2025-10-07T10:15:00Z',
                submission_content: 'I meditated for 10 minutes',
                character: { id: 'supportive-coach', name: 'Sarah', description: 'Encouraging wellness coach' }
            };

            const mockPsychologyState = {
                current_emotion: 'encouraging',
                energy_level: 9,
                relationship_dynamic: 'supportive'
            };

            const mockVerificationResult = {
                is_verifiable: true,
                verification_decision: 'approved',
                character_feedback: 'Wonderful! I am so proud of you for taking this step towards mindfulness. Keep it up!',
                reasoning: 'User completed the meditation practice',
                timing_assessment: 'plausible',
                quality_assessment: 'excellent',
                detected_ai_generation: false
            };

            mockDAL.commitments.getCommitmentWithContext.mockResolvedValue(mockCommitment);
            mockDeps.psychology.getCharacterState.mockResolvedValue(mockPsychologyState);
            mockDAL.conversations.getRecentMessages.mockResolvedValue([]);
            mockDeps.structuredResponse.generateStructuredResponse.mockResolvedValue(mockVerificationResult);
            mockDAL.commitments.recordVerification.mockResolvedValue(mockCommitment);

            const result = await verificationService.verifySubmission('commitment-1', 'user-123');

            expect(result.character.currentMood).toBe('encouraging');
            expect(result.verification.feedback).toContain('proud of you');
        });

        test('should include character name in returned data', async () => {
            const mockCommitment = {
                id: 'commitment-1',
                user_id: 'user-123',
                chat_id: 'chat-456',
                character_id: 'aria',
                description: 'Task',
                assigned_at: '2025-10-07T10:00:00Z',
                submitted_at: '2025-10-07T10:30:00Z',
                submission_content: 'Done',
                character: { id: 'aria', name: 'Aria' }
            };

            mockDAL.commitments.getCommitmentWithContext.mockResolvedValue(mockCommitment);
            mockDeps.psychology.getCharacterState.mockResolvedValue({ current_emotion: 'neutral', energy_level: 5 });
            mockDAL.conversations.getRecentMessages.mockResolvedValue([]);
            mockDeps.structuredResponse.generateStructuredResponse.mockResolvedValue({
                is_verifiable: true,
                verification_decision: 'approved',
                character_feedback: 'Good',
                reasoning: 'OK',
                timing_assessment: 'plausible',
                quality_assessment: 'acceptable',
                detected_ai_generation: false
            });
            mockDAL.commitments.recordVerification.mockResolvedValue(mockCommitment);

            const result = await verificationService.verifySubmission('commitment-1', 'user-123');

            expect(result.character.name).toBe('Aria');
            expect(result.character.id).toBe('aria');
        });
    });

    describe('Time Calculation Logic', () => {
        test('should calculate time difference in minutes', () => {
            const start = '2025-10-07T10:00:00Z';
            const end = '2025-10-07T10:30:00Z';
            
            const timeDiff = verificationService._calculateTimeDiff(start, end);
            
            expect(timeDiff).toBe('30 minutes');
        });

        test('should calculate time difference in hours', () => {
            const start = '2025-10-07T10:00:00Z';
            const end = '2025-10-07T13:00:00Z';
            
            const timeDiff = verificationService._calculateTimeDiff(start, end);
            
            expect(timeDiff).toBe('3 hours');
        });

        test('should calculate time difference in days', () => {
            const start = '2025-10-07T10:00:00Z';
            const end = '2025-10-09T10:00:00Z';
            
            const timeDiff = verificationService._calculateTimeDiff(start, end);
            
            expect(timeDiff).toBe('2 days');
        });

        test('should calculate mixed time differences', () => {
            const start = '2025-10-07T10:00:00Z';
            const end = '2025-10-08T13:30:00Z';
            
            const timeDiff = verificationService._calculateTimeDiff(start, end);
            
            expect(timeDiff).toContain('day');
            expect(timeDiff).toContain('hour');
        });

        test('should handle seconds for very short durations', () => {
            const start = '2025-10-07T10:00:00Z';
            const end = '2025-10-07T10:00:30Z';
            
            const timeDiff = verificationService._calculateTimeDiff(start, end);
            
            expect(timeDiff).toBe('30 seconds');
        });
    });

    describe('Error Handling', () => {
        test('should handle missing commitment', async () => {
            mockDAL.commitments.getCommitmentWithContext.mockResolvedValue(null);

            await expect(
                verificationService.verifySubmission('non-existent', 'user-123')
            ).rejects.toThrow('Commitment not found');
        });

        test('should validate user ownership', async () => {
            const mockCommitment = {
                id: 'commitment-1',
                user_id: 'user-456', // Different user!
                submission_content: 'Content'
            };

            mockDAL.commitments.getCommitmentWithContext.mockResolvedValue(mockCommitment);

            await expect(
                verificationService.verifySubmission('commitment-1', 'user-123')
            ).rejects.toThrow('does not own commitment');
        });

        test('should require submission content', async () => {
            const mockCommitment = {
                id: 'commitment-1',
                user_id: 'user-123',
                submission_content: null // No submission!
            };

            mockDAL.commitments.getCommitmentWithContext.mockResolvedValue(mockCommitment);

            await expect(
                verificationService.verifySubmission('commitment-1', 'user-123')
            ).rejects.toThrow('No submission content found');
        });

        test('should handle database errors gracefully', async () => {
            mockDAL.commitments.getCommitmentWithContext.mockRejectedValue(
                new Error('Database connection failed')
            );

            await expect(
                verificationService.verifySubmission('commitment-1', 'user-123')
            ).rejects.toThrow();
        });

        test('should handle LLM errors gracefully', async () => {
            const mockCommitment = {
                id: 'commitment-1',
                user_id: 'user-123',
                chat_id: 'chat-456',
                character_id: 'aria',
                description: 'Task',
                assigned_at: '2025-10-07T10:00:00Z',
                submitted_at: '2025-10-07T10:30:00Z',
                submission_content: 'Done',
                character: { id: 'aria', name: 'Aria' }
            };

            mockDAL.commitments.getCommitmentWithContext.mockResolvedValue(mockCommitment);
            mockDeps.psychology.getCharacterState.mockResolvedValue({ current_emotion: 'neutral', energy_level: 5 });
            mockDAL.conversations.getRecentMessages.mockResolvedValue([]);
            mockDeps.structuredResponse.generateStructuredResponse.mockRejectedValue(
                new Error('LLM service unavailable')
            );

            await expect(
                verificationService.verifySubmission('commitment-1', 'user-123')
            ).rejects.toThrow();
        });

        test('should handle verification recording failure', async () => {
            const mockCommitment = {
                id: 'commitment-1',
                user_id: 'user-123',
                chat_id: 'chat-456',
                character_id: 'aria',
                description: 'Task',
                assigned_at: '2025-10-07T10:00:00Z',
                submitted_at: '2025-10-07T10:30:00Z',
                submission_content: 'Done',
                character: { id: 'aria', name: 'Aria' }
            };

            mockDAL.commitments.getCommitmentWithContext.mockResolvedValue(mockCommitment);
            mockDeps.psychology.getCharacterState.mockResolvedValue({ current_emotion: 'neutral', energy_level: 5 });
            mockDAL.conversations.getRecentMessages.mockResolvedValue([]);
            mockDeps.structuredResponse.generateStructuredResponse.mockResolvedValue({
                is_verifiable: true,
                verification_decision: 'approved',
                character_feedback: 'Good',
                reasoning: 'OK',
                timing_assessment: 'plausible',
                quality_assessment: 'acceptable',
                detected_ai_generation: false
            });
            mockDAL.commitments.recordVerification.mockResolvedValue(null); // Failed to record!

            await expect(
                verificationService.verifySubmission('commitment-1', 'user-123')
            ).rejects.toThrow('Failed to persist verification result');
        });
    });
});

