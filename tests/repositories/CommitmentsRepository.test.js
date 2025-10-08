/**
 * Unit Tests for CommitmentsRepository
 * 
 * CLEAN ARCHITECTURE TESTING:
 * - Test commitment tracking and verification
 * - Test multi-user data isolation
 * - Test chat-scoped commitment queries
 * - Mock database dependencies for isolated testing
 */

const CommitmentsRepository = require('../../backend/dal/repositories/CORE_CommitmentsRepository');

describe('CommitmentsRepository', () => {
    let commitmentsRepo;
    let mockDeps;

    beforeEach(() => {
        mockDeps = createMockDependencies();
        commitmentsRepo = new CommitmentsRepository('commitments', mockDeps);
    });

    describe('Architecture Compliance', () => {
        test('should extend BaseRepository', () => {
            expect(commitmentsRepo.constructor.name).toBe('CommitmentsRepository');
            expect(commitmentsRepo.tableName).toBe('commitments');
            expect(commitmentsRepo.dal).toBeDefined();
            expect(commitmentsRepo.logger).toBeDefined();
            expect(commitmentsRepo.errorHandler).toBeDefined();
        });

        test('should have proper dependencies injected', () => {
            expect(mockDeps.dal).toBeDefined();
            expect(mockDeps.logger).toBeDefined();
            expect(mockDeps.errorHandler).toBeDefined();
        });

        test('should implement required repository interface', () => {
            const requiredMethods = ['count', 'findById', 'create', 'update', 'delete'];
            requiredMethods.forEach(method => {
                expect(typeof commitmentsRepo[method]).toBe('function');
            });
        });

        test('should implement commitment-specific methods', () => {
            const commitmentMethods = [
                'getActiveCommitments',
                'getCommitmentById',
                'createCommitment',
                'updateCommitmentStatus',
                'getCommitmentsDueSoon',
                'submitCommitment',
                'verifyCommitment'
            ];
            commitmentMethods.forEach(method => {
                expect(typeof commitmentsRepo[method]).toBe('function');
            });
        });
    });

    describe('CRUD Operations', () => {
        test('should create commitment with proper structure', async () => {
            const commitmentData = {
                user_id: 'user-123',
                chat_id: 'chat-456',
                character_id: 'char-789',
                commitment_type: 'exercise',
                description: 'Exercise for 30 minutes',
                due_at: '2025-10-08T10:00:00Z'
            };

            const mockCreatedCommitment = { 
                id: 'commitment-1', 
                ...commitmentData,
                status: 'active'
            };
            mockDeps.dal.create.mockResolvedValue(mockCreatedCommitment);
            mockDeps.dal.findById.mockResolvedValue(mockCreatedCommitment);

            const result = await commitmentsRepo.createCommitment(commitmentData);

            expect(mockDeps.dal.create).toHaveBeenCalled();
            // BaseRepository calls dal.create(tableName, data)
            const createCall = mockDeps.dal.create.mock.calls[0];
            expect(createCall[0]).toBe('commitments'); // tableName
            expect(createCall[1].user_id).toBe('user-123');
            expect(createCall[1].chat_id).toBe('chat-456');
            expect(createCall[1].character_id).toBe('char-789');
            expect(createCall[1].description).toBe('Exercise for 30 minutes');
            expect(createCall[1].status).toBe('active');
            expect(createCall[1].commitment_type).toBe('exercise');
            expect(createCall[1].created_at).toBeDefined();
            expect(result).toEqual(mockCreatedCommitment);
        });

        test('should create commitment with default status if not specified', async () => {
            const commitmentData = {
                user_id: 'user-123',
                chat_id: 'chat-456',
                character_id: 'char-789',
                description: 'Complete project',
                due_at: '2025-10-09T15:00:00Z'
            };

            mockDeps.dal.create.mockResolvedValue({ id: 'commitment-2' });
            mockDeps.dal.findById.mockResolvedValue({ id: 'commitment-2', status: 'active' });

            await commitmentsRepo.createCommitment(commitmentData);

            // BaseRepository calls dal.create(tableName, data)
            const createCall = mockDeps.dal.create.mock.calls[0];
            expect(createCall[1].status).toBe('active');
        });

        test('should get commitment by ID', async () => {
            const mockCommitment = {
                id: 'commitment-1',
                user_id: 'user-123',
                chat_id: 'chat-456',
                character_id: 'char-789',
                description: 'Exercise daily',
                status: 'active'
            };
            mockDeps.dal.findById.mockResolvedValue(mockCommitment);

            const result = await commitmentsRepo.getCommitmentById('commitment-1');

            expect(result).toEqual(mockCommitment);
            // BaseRepository calls dal.findById(tableName, id)
            expect(mockDeps.dal.findById).toHaveBeenCalledWith('commitments', 'commitment-1');
        });

        test('should update commitment status', async () => {
            mockDeps.dal.update.mockResolvedValue({ changes: 1 });

            const result = await commitmentsRepo.updateCommitmentStatus('commitment-1', 'completed');

            expect(result).toEqual({ updated: true });
            // BaseRepository calls dal.update(tableName, data, conditions)
            expect(mockDeps.dal.update).toHaveBeenCalledWith(
                'commitments',
                expect.objectContaining({
                    status: 'completed',
                    updated_at: expect.any(String)
                }),
                { id: 'commitment-1' }
            );
        });

        test('should update commitment status with additional verification data', async () => {
            mockDeps.dal.update.mockResolvedValue({ changes: 1 });

            const updateData = {
                verification_result: 'verified',
                verification_reasoning: 'Successfully completed with excellent performance'
            };

            await commitmentsRepo.updateCommitmentStatus('commitment-1', 'completed', updateData);

            // BaseRepository calls dal.update(tableName, data, conditions)
            const updateCall = mockDeps.dal.update.mock.calls[0];
            expect(updateCall[0]).toBe('commitments'); // tableName
            expect(updateCall[1].status).toBe('completed');
            expect(updateCall[1].verification_result).toBe('verified');
            expect(updateCall[1].verification_reasoning).toContain('excellent');
        });
    });

    describe('Chat-Scoped Queries', () => {
        test('should get active commitments for specific chat with user isolation', async () => {
            const mockCommitments = [
                {
                    id: 'commitment-1',
                    user_id: 'user-123',
                    chat_id: 'chat-456',
                    character_id: 'char-789',
                    description: 'Daily exercise',
                    status: 'active',
                    due_at: '2025-10-08T10:00:00Z'
                },
                {
                    id: 'commitment-2',
                    user_id: 'user-123',
                    chat_id: 'chat-456',
                    character_id: 'char-789',
                    description: 'Read 30 pages',
                    status: 'active',
                    due_at: '2025-10-09T12:00:00Z'
                }
            ];
            mockDeps.dal.query.mockResolvedValue(mockCommitments);

            const result = await commitmentsRepo.getActiveCommitments('user-123', 'chat-456');

            expect(result).toEqual(mockCommitments);
            expect(mockDeps.dal.query).toHaveBeenCalledWith(
                expect.stringContaining('user_id = ?'),
                ['user-123', 'chat-456']
            );
            expect(mockDeps.dal.query).toHaveBeenCalledWith(
                expect.stringContaining('chat_id = ?'),
                ['user-123', 'chat-456']
            );
            expect(mockDeps.dal.query).toHaveBeenCalledWith(
                expect.stringContaining("status = 'active'"),
                ['user-123', 'chat-456']
            );
        });

        test('should order active commitments by due_at ASC', async () => {
            mockDeps.dal.query.mockResolvedValue([]);

            await commitmentsRepo.getActiveCommitments('user-123', 'chat-456');

            expect(mockDeps.dal.query).toHaveBeenCalledWith(
                expect.stringContaining('ORDER BY due_at ASC'),
                ['user-123', 'chat-456']
            );
        });

        test('should return empty array when no active commitments exist', async () => {
            mockDeps.dal.query.mockResolvedValue([]);

            const result = await commitmentsRepo.getActiveCommitments('user-123', 'chat-456');

            expect(result).toEqual([]);
        });
    });

    describe('Due Soon Queries', () => {
        test('should get commitments due within default 24 hours', async () => {
            const mockCommitments = [
                {
                    id: 'commitment-1',
                    user_id: 'user-123',
                    character_id: 'char-789',
                    description: 'Submit report',
                    due_at: '2025-10-08T10:00:00Z',
                    status: 'active'
                }
            ];
            mockDeps.dal.query.mockResolvedValue(mockCommitments);

            const result = await commitmentsRepo.getCommitmentsDueSoon('user-123');

            expect(result).toEqual(mockCommitments);
            expect(mockDeps.dal.query).toHaveBeenCalledWith(
                expect.stringContaining('user_id = ?'),
                ['user-123', 24]
            );
            expect(mockDeps.dal.query).toHaveBeenCalledWith(
                expect.stringContaining("status = 'active'"),
                ['user-123', 24]
            );
        });

        test('should get commitments due within custom time window', async () => {
            mockDeps.dal.query.mockResolvedValue([]);

            await commitmentsRepo.getCommitmentsDueSoon('user-123', 48);

            expect(mockDeps.dal.query).toHaveBeenCalledWith(
                expect.anything(),
                ['user-123', 48]
            );
        });

        test('should filter commitments with due_at IS NOT NULL', async () => {
            mockDeps.dal.query.mockResolvedValue([]);

            await commitmentsRepo.getCommitmentsDueSoon('user-123', 24);

            expect(mockDeps.dal.query).toHaveBeenCalledWith(
                expect.stringContaining('due_at IS NOT NULL'),
                ['user-123', 24]
            );
        });

        test('should order commitments due soon by due_at ASC', async () => {
            mockDeps.dal.query.mockResolvedValue([]);

            await commitmentsRepo.getCommitmentsDueSoon('user-123', 24);

            expect(mockDeps.dal.query).toHaveBeenCalledWith(
                expect.stringContaining('ORDER BY due_at ASC'),
                ['user-123', 24]
            );
        });

        test('should only return future commitments', async () => {
            mockDeps.dal.query.mockResolvedValue([]);

            await commitmentsRepo.getCommitmentsDueSoon('user-123', 24);

            expect(mockDeps.dal.query).toHaveBeenCalledWith(
                expect.stringContaining("datetime(due_at) >= datetime('now')"),
                ['user-123', 24]
            );
        });
    });

    describe('Submission Flow', () => {
        test('should submit commitment with content and update status', async () => {
            mockDeps.dal.update.mockResolvedValue({ changes: 1 });
            const mockCommitment = {
                id: 'commitment-1',
                submission_content: 'Completed 30 minutes of exercise at the gym',
                status: 'submitted'
            };
            mockDeps.dal.findById.mockResolvedValue(mockCommitment);

            const submissionContent = 'Completed 30 minutes of exercise at the gym';
            const result = await commitmentsRepo.submitCommitment('commitment-1', submissionContent);

            expect(result).toEqual(mockCommitment);
            // BaseRepository calls dal.update(tableName, data, conditions)
            expect(mockDeps.dal.update).toHaveBeenCalledWith(
                'commitments',
                expect.objectContaining({
                    submission_content: submissionContent,
                    submitted_at: expect.any(String),
                    status: 'submitted',
                    verification_requested_at: expect.any(String),
                    updated_at: expect.any(String)
                }),
                { id: 'commitment-1' }
            );
        });

        test('should return null when submission fails', async () => {
            mockDeps.dal.update.mockResolvedValue({ changes: 0 });

            const result = await commitmentsRepo.submitCommitment('commitment-999', 'Content');

            expect(result).toBeNull();
        });

        test('should include timestamp when submitting', async () => {
            mockDeps.dal.update.mockResolvedValue({ changes: 1 });
            mockDeps.dal.findById.mockResolvedValue({ id: 'commitment-1' });

            await commitmentsRepo.submitCommitment('commitment-1', 'Submission content');

            // BaseRepository calls dal.update(tableName, data, conditions)
            const updateCall = mockDeps.dal.update.mock.calls[0];
            expect(updateCall[1].submitted_at).toBeDefined();
            expect(typeof updateCall[1].submitted_at).toBe('string');
            expect(updateCall[1].verification_requested_at).toBeDefined();
            expect(typeof updateCall[1].verification_requested_at).toBe('string');
        });
    });

    describe('Verification Flow', () => {
        test('should verify commitment with verification result and reasoning', async () => {
            mockDeps.dal.update.mockResolvedValue({ changes: 1 });

            const result = await commitmentsRepo.verifyCommitment(
                'commitment-1',
                'verified',
                'Evidence provided matches commitment requirements'
            );

            expect(result).toEqual({ verified: true });
            // BaseRepository calls dal.update(tableName, data, conditions)
            expect(mockDeps.dal.update).toHaveBeenCalledWith(
                'commitments',
                expect.objectContaining({
                    verification_result: 'verified',
                    verification_reasoning: 'Evidence provided matches commitment requirements',
                    verified_at: expect.any(String),
                    status: 'completed',
                    updated_at: expect.any(String)
                }),
                { id: 'commitment-1' }
            );
        });

        test('should track verification request timestamp', async () => {
            mockDeps.dal.update.mockResolvedValue({ changes: 1 });

            const now = new Date().toISOString();
            await commitmentsRepo.update(
                { verification_requested_at: now },
                { id: 'commitment-1' }
            );

            // BaseRepository calls dal.update(tableName, data, conditions)
            expect(mockDeps.dal.update).toHaveBeenCalledWith(
                'commitments',
                expect.objectContaining({
                    verification_requested_at: now
                }),
                { id: 'commitment-1' }
            );
        });

        test('should store verification feedback from user', async () => {
            mockDeps.dal.update.mockResolvedValue({ changes: 1 });

            const feedback = 'Actually, I did complete all parts. Please check section B again.';
            await commitmentsRepo.update(
                { verification_feedback: feedback },
                { id: 'commitment-1' }
            );

            // BaseRepository calls dal.update(tableName, data, conditions)
            expect(mockDeps.dal.update).toHaveBeenCalledWith(
                'commitments',
                expect.objectContaining({
                    verification_feedback: feedback
                }),
                { id: 'commitment-1' }
            );
        });

        test('should update commitment with verification_decision through updateCommitmentStatus', async () => {
            mockDeps.dal.update.mockResolvedValue({ changes: 1 });

            const updateData = {
                verification_decision: 'approved',
                verification_reasoning: 'Excellent work, all requirements met'
            };

            await commitmentsRepo.updateCommitmentStatus('commitment-1', 'completed', updateData);

            // BaseRepository calls dal.update(tableName, data, conditions)
            const updateCall = mockDeps.dal.update.mock.calls[0];
            expect(updateCall[1].status).toBe('completed');
            expect(updateCall[1].verification_reasoning).toBe('Excellent work, all requirements met');
        });

        test('should track revision count when commitment is revised', async () => {
            mockDeps.dal.update.mockResolvedValue({ changes: 1 });

            await commitmentsRepo.update(
                {
                    revision_count: 2,
                    submission_content: 'Updated submission with revisions',
                    submitted_at: new Date().toISOString()
                },
                { id: 'commitment-1' }
            );

            // BaseRepository calls dal.update(tableName, data, conditions)
            expect(mockDeps.dal.update).toHaveBeenCalledWith(
                'commitments',
                expect.objectContaining({
                    revision_count: 2,
                    submission_content: 'Updated submission with revisions',
                    submitted_at: expect.any(String)
                }),
                { id: 'commitment-1' }
            );
        });

        test('should support verification_decision values: approved, needs_revision, rejected, not_verifiable', async () => {
            mockDeps.dal.update.mockResolvedValue({ changes: 1 });

            const decisions = ['approved', 'needs_revision', 'rejected', 'not_verifiable'];

            for (const decision of decisions) {
                await commitmentsRepo.update(
                    { verification_decision: decision },
                    { id: 'commitment-1' }
                );
            }

            expect(mockDeps.dal.update).toHaveBeenCalledTimes(4);
        });

        test('should handle needs_revision verification decision workflow', async () => {
            mockDeps.dal.update.mockResolvedValue({ changes: 1 });

            const updateData = {
                verification_decision: 'needs_revision',
                verification_reasoning: 'Good start, but please elaborate on section 2'
            };

            await commitmentsRepo.updateCommitmentStatus('commitment-1', 'active', updateData);

            // BaseRepository calls dal.update(tableName, data, conditions)
            const updateCall = mockDeps.dal.update.mock.calls[0];
            expect(updateCall[1].status).toBe('active'); // Back to active for revision
            expect(updateCall[1].verification_reasoning).toContain('elaborate');
        });

        test('should set status to completed when verified', async () => {
            mockDeps.dal.update.mockResolvedValue({ changes: 1 });

            await commitmentsRepo.verifyCommitment('commitment-1', 'verified', 'Looks good');

            // BaseRepository calls dal.update(tableName, data, conditions)
            const updateCall = mockDeps.dal.update.mock.calls[0];
            expect(updateCall[1].status).toBe('completed');
        });

        test('should set status to rejected when verification fails', async () => {
            mockDeps.dal.update.mockResolvedValue({ changes: 1 });

            await commitmentsRepo.verifyCommitment(
                'commitment-1',
                'rejected',
                'Evidence insufficient'
            );

            // BaseRepository calls dal.update(tableName, data, conditions)
            const updateCall = mockDeps.dal.update.mock.calls[0];
            expect(updateCall[1].status).toBe('rejected');
            expect(updateCall[1].verification_result).toBe('rejected');
        });

        test('should include timestamp when verifying', async () => {
            mockDeps.dal.update.mockResolvedValue({ changes: 1 });

            await commitmentsRepo.verifyCommitment('commitment-1', 'verified', 'Approved');

            // BaseRepository calls dal.update(tableName, data, conditions)
            const updateCall = mockDeps.dal.update.mock.calls[0];
            expect(updateCall[1].verified_at).toBeDefined();
            expect(typeof updateCall[1].verified_at).toBe('string');
        });

        test('should return false when verification update fails', async () => {
            mockDeps.dal.update.mockResolvedValue({ changes: 0 });

            const result = await commitmentsRepo.verifyCommitment(
                'commitment-999',
                'verified',
                'Test'
            );

            expect(result).toEqual({ verified: false });
        });
    });

    describe('User Isolation', () => {
        test('getActiveCommitments should filter by userId', async () => {
            mockDeps.dal.query.mockResolvedValue([]);

            await commitmentsRepo.getActiveCommitments('user-123', 'chat-456');

            const queryCall = mockDeps.dal.query.mock.calls[0];
            expect(queryCall[0]).toContain('user_id = ?');
            expect(queryCall[1]).toContain('user-123');
        });

        test('getCommitmentsDueSoon should filter by userId', async () => {
            mockDeps.dal.query.mockResolvedValue([]);

            await commitmentsRepo.getCommitmentsDueSoon('user-123', 24);

            const queryCall = mockDeps.dal.query.mock.calls[0];
            expect(queryCall[0]).toContain('user_id = ?');
            expect(queryCall[1]).toContain('user-123');
        });

        test('createCommitment should require userId in commitmentData', async () => {
            const commitmentData = {
                user_id: 'user-123',
                chat_id: 'chat-456',
                character_id: 'char-789',
                description: 'Test commitment',
                due_at: '2025-10-10T12:00:00Z'
            };

            mockDeps.dal.create.mockResolvedValue({ id: 'commitment-1' });
            mockDeps.dal.findById.mockResolvedValue({ id: 'commitment-1', user_id: 'user-123' });

            await commitmentsRepo.createCommitment(commitmentData);

            // BaseRepository calls dal.create(tableName, data)
            const createCall = mockDeps.dal.create.mock.calls[0];
            expect(createCall[1].user_id).toBe('user-123');
        });

        test('different users should have isolated commitments', async () => {
            const user1Commitments = [
                { id: 'commitment-1', user_id: 'user-123', chat_id: 'chat-456' }
            ];
            const user2Commitments = [
                { id: 'commitment-2', user_id: 'user-456', chat_id: 'chat-789' }
            ];

            // First call for user-123
            mockDeps.dal.query.mockResolvedValueOnce(user1Commitments);
            const result1 = await commitmentsRepo.getActiveCommitments('user-123', 'chat-456');
            
            // Second call for user-456
            mockDeps.dal.query.mockResolvedValueOnce(user2Commitments);
            const result2 = await commitmentsRepo.getActiveCommitments('user-456', 'chat-789');

            expect(result1).toEqual(user1Commitments);
            expect(result2).toEqual(user2Commitments);
            expect(mockDeps.dal.query).toHaveBeenCalledTimes(2);
        });
    });

    describe('Error Handling', () => {
        test('should handle database errors gracefully in getActiveCommitments', async () => {
            const dbError = new Error('Database connection failed');
            mockDeps.dal.query.mockRejectedValue(dbError);

            await expect(
                commitmentsRepo.getActiveCommitments('user-123', 'chat-456')
            ).rejects.toThrow();
        });

        test('should handle database errors gracefully in createCommitment', async () => {
            const dbError = new Error('Insert failed');
            mockDeps.dal.create.mockRejectedValue(dbError);

            await expect(
                commitmentsRepo.createCommitment({
                    user_id: 'user-123',
                    chat_id: 'chat-456',
                    character_id: 'char-789',
                    description: 'Test'
                })
            ).rejects.toThrow();
        });

        test('should handle database errors gracefully in submitCommitment', async () => {
            const dbError = new Error('Update failed');
            mockDeps.dal.update.mockRejectedValue(dbError);

            await expect(
                commitmentsRepo.submitCommitment('commitment-1', 'Content')
            ).rejects.toThrow();
        });

        test('should handle database errors gracefully in verifyCommitment', async () => {
            const dbError = new Error('Verification update failed');
            mockDeps.dal.update.mockRejectedValue(dbError);

            await expect(
                commitmentsRepo.verifyCommitment('commitment-1', 'verified', 'Reason')
            ).rejects.toThrow();
        });

        test('should handle database errors gracefully in getCommitmentsDueSoon', async () => {
            const dbError = new Error('Query failed');
            mockDeps.dal.query.mockRejectedValue(dbError);

            await expect(
                commitmentsRepo.getCommitmentsDueSoon('user-123', 24)
            ).rejects.toThrow();
        });
    });

    describe('Submission Workflow', () => {
        test('should update status to submitted when submitting commitment', async () => {
            mockDeps.dal.update.mockResolvedValue({ changes: 1 });
            const mockCommitment = {
                id: 'commitment-1',
                status: 'submitted',
                submission_content: 'My submission'
            };
            mockDeps.dal.findById.mockResolvedValue(mockCommitment);

            const result = await commitmentsRepo.submitCommitment('commitment-1', 'My submission');

            expect(result.status).toBe('submitted');
            expect(mockDeps.dal.update).toHaveBeenCalledWith(
                'commitments',
                expect.objectContaining({
                    status: 'submitted'
                }),
                { id: 'commitment-1' }
            );
        });

        test('should store submission_content correctly', async () => {
            mockDeps.dal.update.mockResolvedValue({ changes: 1 });
            const submissionContent = 'I completed the exercise for 45 minutes today';
            mockDeps.dal.findById.mockResolvedValue({
                id: 'commitment-1',
                submission_content: submissionContent
            });

            const result = await commitmentsRepo.submitCommitment('commitment-1', submissionContent);

            expect(mockDeps.dal.update).toHaveBeenCalledWith(
                'commitments',
                expect.objectContaining({
                    submission_content: submissionContent
                }),
                { id: 'commitment-1' }
            );
            expect(result.submission_content).toBe(submissionContent);
        });

        test('should set submitted_at timestamp when submitting', async () => {
            mockDeps.dal.update.mockResolvedValue({ changes: 1 });
            mockDeps.dal.findById.mockResolvedValue({
                id: 'commitment-1',
                submitted_at: '2025-10-07T12:00:00Z'
            });

            await commitmentsRepo.submitCommitment('commitment-1', 'Content');

            const updateCall = mockDeps.dal.update.mock.calls[0];
            expect(updateCall[1].submitted_at).toBeDefined();
            expect(typeof updateCall[1].submitted_at).toBe('string');
        });

        test('should set verification_requested_at timestamp when submitting', async () => {
            mockDeps.dal.update.mockResolvedValue({ changes: 1 });
            mockDeps.dal.findById.mockResolvedValue({
                id: 'commitment-1',
                verification_requested_at: '2025-10-07T12:00:00Z'
            });

            await commitmentsRepo.submitCommitment('commitment-1', 'Content');

            const updateCall = mockDeps.dal.update.mock.calls[0];
            expect(updateCall[1].verification_requested_at).toBeDefined();
            expect(typeof updateCall[1].verification_requested_at).toBe('string');
        });

        test('should return null when submission update fails', async () => {
            mockDeps.dal.update.mockResolvedValue({ changes: 0 });

            const result = await commitmentsRepo.submitCommitment('commitment-999', 'Content');

            expect(result).toBeNull();
        });
    });

    describe('Verification Recording', () => {
        test('should record verification with approved decision', async () => {
            mockDeps.dal.update.mockResolvedValue({ changes: 1 });
            const mockCommitment = {
                id: 'commitment-1',
                status: 'completed',
                verification_decision: 'approved',
                verification_result: 'Great work!',
                verification_reasoning: 'All requirements met'
            };
            mockDeps.dal.findById.mockResolvedValue(mockCommitment);

            const verificationData = {
                verification_decision: 'approved',
                verification_result: 'Great work!',
                verification_reasoning: 'All requirements met',
                verified_at: '2025-10-07T12:00:00Z'
            };

            const result = await commitmentsRepo.recordVerification('commitment-1', verificationData);

            expect(result.status).toBe('completed');
            expect(result.verification_decision).toBe('approved');
            expect(mockDeps.dal.update).toHaveBeenCalledWith(
                'commitments',
                expect.objectContaining({
                    verification_decision: 'approved',
                    verification_result: 'Great work!',
                    verification_reasoning: 'All requirements met',
                    status: 'completed'
                }),
                { id: 'commitment-1' }
            );
        });

        test('should record verification with needs_revision decision', async () => {
            mockDeps.dal.update.mockResolvedValue({ changes: 1 });
            const currentCommitment = {
                id: 'commitment-1',
                revision_count: 1
            };
            const updatedCommitment = {
                id: 'commitment-1',
                status: 'needs_revision',
                verification_decision: 'needs_revision',
                revision_count: 2
            };
            mockDeps.dal.findById.mockResolvedValueOnce(currentCommitment);
            mockDeps.dal.findById.mockResolvedValueOnce(updatedCommitment);

            const verificationData = {
                verification_decision: 'needs_revision',
                verification_result: 'Please add more detail to section 2',
                verification_reasoning: 'Section 2 lacks sufficient detail',
                verified_at: '2025-10-07T12:00:00Z'
            };

            const result = await commitmentsRepo.recordVerification('commitment-1', verificationData);

            expect(result.status).toBe('needs_revision');
            expect(result.verification_decision).toBe('needs_revision');
            expect(mockDeps.dal.update).toHaveBeenCalledWith(
                'commitments',
                expect.objectContaining({
                    verification_decision: 'needs_revision',
                    status: 'needs_revision',
                    revision_count: 2
                }),
                { id: 'commitment-1' }
            );
        });

        test('should record verification with rejected decision', async () => {
            mockDeps.dal.update.mockResolvedValue({ changes: 1 });
            const mockCommitment = {
                id: 'commitment-1',
                status: 'rejected',
                verification_decision: 'rejected'
            };
            mockDeps.dal.findById.mockResolvedValue(mockCommitment);

            const verificationData = {
                verification_decision: 'rejected',
                verification_result: 'Does not meet requirements',
                verification_reasoning: 'Missing key components',
                verified_at: '2025-10-07T12:00:00Z'
            };

            const result = await commitmentsRepo.recordVerification('commitment-1', verificationData);

            expect(result.status).toBe('rejected');
            expect(result.verification_decision).toBe('rejected');
            expect(mockDeps.dal.update).toHaveBeenCalledWith(
                'commitments',
                expect.objectContaining({
                    verification_decision: 'rejected',
                    status: 'rejected'
                }),
                { id: 'commitment-1' }
            );
        });

        test('should record verification with not_verifiable decision', async () => {
            mockDeps.dal.update.mockResolvedValue({ changes: 1 });
            const mockCommitment = {
                id: 'commitment-1',
                status: 'not_verifiable',
                verification_decision: 'not_verifiable'
            };
            mockDeps.dal.findById.mockResolvedValue(mockCommitment);

            const verificationData = {
                verification_decision: 'not_verifiable',
                verification_result: 'This is subjective and cannot be objectively verified',
                verification_reasoning: 'No measurable criteria',
                verified_at: '2025-10-07T12:00:00Z'
            };

            const result = await commitmentsRepo.recordVerification('commitment-1', verificationData);

            expect(result.status).toBe('not_verifiable');
            expect(result.verification_decision).toBe('not_verifiable');
        });

        test('should increment revision_count on needs_revision decision', async () => {
            const currentCommitment = {
                id: 'commitment-1',
                revision_count: 2
            };
            const updatedCommitment = {
                id: 'commitment-1',
                revision_count: 3,
                status: 'needs_revision'
            };

            mockDeps.dal.update.mockResolvedValue({ changes: 1 });
            mockDeps.dal.findById.mockResolvedValueOnce(currentCommitment);
            mockDeps.dal.findById.mockResolvedValueOnce(updatedCommitment);

            const verificationData = {
                verification_decision: 'needs_revision',
                verification_result: 'Needs improvement',
                verification_reasoning: 'Still missing details',
                verified_at: '2025-10-07T12:00:00Z'
            };

            const result = await commitmentsRepo.recordVerification('commitment-1', verificationData);

            expect(result.revision_count).toBe(3);
            const updateCall = mockDeps.dal.update.mock.calls[0];
            expect(updateCall[1].revision_count).toBe(3);
        });

        test('should set status correctly based on verification decision', async () => {
            const decisions = [
                { decision: 'approved', expectedStatus: 'completed' },
                { decision: 'needs_revision', expectedStatus: 'needs_revision' },
                { decision: 'rejected', expectedStatus: 'rejected' },
                { decision: 'not_verifiable', expectedStatus: 'not_verifiable' }
            ];

            for (const { decision, expectedStatus } of decisions) {
                mockDeps.dal.update.mockResolvedValue({ changes: 1 });
                mockDeps.dal.findById.mockResolvedValue({
                    id: 'commitment-1',
                    status: expectedStatus,
                    revision_count: 0
                });

                const verificationData = {
                    verification_decision: decision,
                    verification_result: 'Test result',
                    verification_reasoning: 'Test reasoning',
                    verified_at: '2025-10-07T12:00:00Z'
                };

                const result = await commitmentsRepo.recordVerification('commitment-1', verificationData);

                expect(result.status).toBe(expectedStatus);
            }
        });

        test('should return null when verification update fails', async () => {
            mockDeps.dal.update.mockResolvedValue({ changes: 0 });
            mockDeps.dal.findById.mockResolvedValue({ id: 'commitment-1' });

            const verificationData = {
                verification_decision: 'approved',
                verification_result: 'Test',
                verification_reasoning: 'Test',
                verified_at: '2025-10-07T12:00:00Z'
            };

            const result = await commitmentsRepo.recordVerification('commitment-999', verificationData);

            expect(result).toBeNull();
        });

        test('should throw error for invalid verification decision', async () => {
            mockDeps.dal.findById.mockResolvedValue({ id: 'commitment-1' });

            const verificationData = {
                verification_decision: 'invalid_decision',
                verification_result: 'Test',
                verification_reasoning: 'Test',
                verified_at: '2025-10-07T12:00:00Z'
            };

            await expect(
                commitmentsRepo.recordVerification('commitment-1', verificationData)
            ).rejects.toThrow();
        });
    });

    describe('Context Retrieval', () => {
        test('should return enriched commitment data with context', async () => {
            const mockCommitment = {
                id: 'commitment-1',
                user_id: 'user-123',
                chat_id: 'chat-456',
                character_id: 'aria',
                description: 'Exercise daily',
                assigned_at: '2025-10-07T10:00:00Z',
                revision_count: 0
            };

            const mockCharacter = {
                id: 'aria',
                name: 'Aria',
                display: 'aria.png',
                description: 'A balanced AI assistant',
                definition: 'You are Aria...',
                personality_traits: '{}',
                communication_style: '{}'
            };

            const mockAssignmentMessages = [
                {
                    id: 'msg-1',
                    role: 'assistant',
                    content: 'I want you to exercise daily',
                    timestamp: '2025-10-07T09:55:00Z'
                }
            ];

            mockDeps.dal.findById.mockResolvedValue(mockCommitment);
            mockDeps.dal.query
                .mockResolvedValueOnce([mockCharacter])  // Character query
                .mockResolvedValueOnce(mockAssignmentMessages);  // Assignment messages query

            const result = await commitmentsRepo.getCommitmentWithContext('commitment-1');

            expect(result).toBeDefined();
            expect(result.id).toBe('commitment-1');
            expect(result.character).toEqual(mockCharacter);
            expect(result.assignmentContext).toBeDefined();
            expect(result.assignmentContext.messages).toEqual(mockAssignmentMessages);
            expect(result.submissionHistory).toEqual([]);
            expect(result.hasRevisions).toBe(false);
        });

        test('should include character information in enriched data', async () => {
            const mockCommitment = {
                id: 'commitment-1',
                character_id: 'luna',
                user_id: 'user-123',
                chat_id: 'chat-456',
                assigned_at: '2025-10-07T10:00:00Z',
                revision_count: 0
            };

            const mockCharacter = {
                id: 'luna',
                name: 'Luna',
                display: 'luna.png',
                description: 'Creative and imaginative',
                definition: 'You are Luna...',
                personality_traits: '{"creative": true}',
                communication_style: '{"tone": "expressive"}'
            };

            mockDeps.dal.findById.mockResolvedValue(mockCommitment);
            mockDeps.dal.query
                .mockResolvedValueOnce([mockCharacter])
                .mockResolvedValueOnce([]);

            const result = await commitmentsRepo.getCommitmentWithContext('commitment-1');

            expect(result.character).toBeDefined();
            expect(result.character.name).toBe('Luna');
            expect(result.character.id).toBe('luna');
            expect(result.character.description).toBe('Creative and imaginative');
        });

        test('should include assignment context with messages', async () => {
            const mockCommitment = {
                id: 'commitment-1',
                user_id: 'user-123',
                chat_id: 'chat-456',
                character_id: 'aria',
                assigned_at: '2025-10-07T10:00:00Z',
                revision_count: 0
            };

            const mockMessages = [
                { id: 'msg-1', role: 'assistant', content: 'Let me give you a task', timestamp: '2025-10-07T09:58:00Z' },
                { id: 'msg-2', role: 'user', content: 'Okay', timestamp: '2025-10-07T09:59:00Z' },
                { id: 'msg-3', role: 'assistant', content: 'Exercise for 30 minutes', timestamp: '2025-10-07T10:00:00Z' }
            ];

            mockDeps.dal.findById.mockResolvedValue(mockCommitment);
            mockDeps.dal.query
                .mockResolvedValueOnce([{ id: 'aria', name: 'Aria' }])
                .mockResolvedValueOnce(mockMessages);

            const result = await commitmentsRepo.getCommitmentWithContext('commitment-1');

            expect(result.assignmentContext).toBeDefined();
            expect(result.assignmentContext.messages).toEqual(mockMessages);
            expect(result.assignmentContext.messages.length).toBe(3);
            expect(result.assignmentContext.assignedAt).toBe('2025-10-07T10:00:00Z');
        });

        test('should include submission history when revisions exist', async () => {
            const mockCommitment = {
                id: 'commitment-1',
                user_id: 'user-123',
                chat_id: 'chat-456',
                character_id: 'aria',
                assigned_at: '2025-10-07T10:00:00Z',
                updated_at: '2025-10-07T15:00:00Z',
                revision_count: 2
            };

            const mockSubmissionHistory = [
                { id: 'msg-4', role: 'user', content: 'First submission', timestamp: '2025-10-07T12:00:00Z' },
                { id: 'msg-5', role: 'assistant', content: 'Needs more detail', timestamp: '2025-10-07T12:05:00Z' },
                { id: 'msg-6', role: 'user', content: 'Second submission with details', timestamp: '2025-10-07T14:00:00Z' }
            ];

            mockDeps.dal.findById.mockResolvedValue(mockCommitment);
            mockDeps.dal.query
                .mockResolvedValueOnce([{ id: 'aria', name: 'Aria' }])
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce(mockSubmissionHistory);

            const result = await commitmentsRepo.getCommitmentWithContext('commitment-1');

            expect(result.hasRevisions).toBe(true);
            expect(result.submissionHistory).toEqual(mockSubmissionHistory);
            expect(result.submissionHistory.length).toBe(3);
        });

        test('should return null when commitment not found', async () => {
            mockDeps.dal.findById.mockResolvedValue(null);

            const result = await commitmentsRepo.getCommitmentWithContext('non-existent');

            expect(result).toBeNull();
            expect(mockDeps.dal.query).not.toHaveBeenCalled();
        });

        test('should handle missing character gracefully', async () => {
            const mockCommitment = {
                id: 'commitment-1',
                character_id: 'unknown-char',
                user_id: 'user-123',
                chat_id: 'chat-456',
                assigned_at: '2025-10-07T10:00:00Z',
                revision_count: 0
            };

            mockDeps.dal.findById.mockResolvedValue(mockCommitment);
            mockDeps.dal.query
                .mockResolvedValueOnce([])  // No character found
                .mockResolvedValueOnce([]);

            const result = await commitmentsRepo.getCommitmentWithContext('commitment-1');

            expect(result.character).toBeNull();
            expect(result).toBeDefined();
        });

        test('should handle database errors gracefully', async () => {
            mockDeps.dal.findById.mockRejectedValue(new Error('Database error'));

            await expect(
                commitmentsRepo.getCommitmentWithContext('commitment-1')
            ).rejects.toThrow();
        });
    });
});

