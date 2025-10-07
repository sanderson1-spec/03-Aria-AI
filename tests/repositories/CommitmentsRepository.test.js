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
                commitment_text: 'Exercise for 30 minutes',
                due_date: '2025-10-08T10:00:00Z',
                priority: 'high'
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
            expect(createCall[1].commitment_text).toBe('Exercise for 30 minutes');
            expect(createCall[1].status).toBe('active');
            expect(createCall[1].priority).toBe('high');
            expect(createCall[1].created_at).toBeDefined();
            expect(result).toEqual(mockCreatedCommitment);
        });

        test('should create commitment with default priority if not specified', async () => {
            const commitmentData = {
                user_id: 'user-123',
                chat_id: 'chat-456',
                commitment_text: 'Complete project',
                due_date: '2025-10-09T15:00:00Z'
            };

            mockDeps.dal.create.mockResolvedValue({ id: 'commitment-2' });
            mockDeps.dal.findById.mockResolvedValue({ id: 'commitment-2', priority: 'medium' });

            await commitmentsRepo.createCommitment(commitmentData);

            // BaseRepository calls dal.create(tableName, data)
            const createCall = mockDeps.dal.create.mock.calls[0];
            expect(createCall[1].priority).toBe('medium');
            expect(createCall[1].status).toBe('active');
        });

        test('should get commitment by ID', async () => {
            const mockCommitment = {
                id: 'commitment-1',
                user_id: 'user-123',
                chat_id: 'chat-456',
                commitment_text: 'Exercise daily',
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

        test('should update commitment status with additional data', async () => {
            mockDeps.dal.update.mockResolvedValue({ changes: 1 });

            const updateData = {
                completion_notes: 'Successfully completed',
                metadata: { performance: 'excellent' }
            };

            await commitmentsRepo.updateCommitmentStatus('commitment-1', 'completed', updateData);

            // BaseRepository calls dal.update(tableName, data, conditions)
            const updateCall = mockDeps.dal.update.mock.calls[0];
            expect(updateCall[0]).toBe('commitments'); // tableName
            expect(updateCall[1].status).toBe('completed');
            expect(updateCall[1].completion_notes).toBe('Successfully completed');
            expect(updateCall[1].commitment_metadata).toContain('excellent');
        });
    });

    describe('Chat-Scoped Queries', () => {
        test('should get active commitments for specific chat with user isolation', async () => {
            const mockCommitments = [
                {
                    id: 'commitment-1',
                    user_id: 'user-123',
                    chat_id: 'chat-456',
                    commitment_text: 'Daily exercise',
                    status: 'active',
                    due_date: '2025-10-08T10:00:00Z'
                },
                {
                    id: 'commitment-2',
                    user_id: 'user-123',
                    chat_id: 'chat-456',
                    commitment_text: 'Read 30 pages',
                    status: 'active',
                    due_date: '2025-10-09T12:00:00Z'
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

        test('should order active commitments by due_date ASC', async () => {
            mockDeps.dal.query.mockResolvedValue([]);

            await commitmentsRepo.getActiveCommitments('user-123', 'chat-456');

            expect(mockDeps.dal.query).toHaveBeenCalledWith(
                expect.stringContaining('ORDER BY due_date ASC'),
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
                    commitment_text: 'Submit report',
                    due_date: '2025-10-08T10:00:00Z',
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

        test('should filter commitments with due_date IS NOT NULL', async () => {
            mockDeps.dal.query.mockResolvedValue([]);

            await commitmentsRepo.getCommitmentsDueSoon('user-123', 24);

            expect(mockDeps.dal.query).toHaveBeenCalledWith(
                expect.stringContaining('due_date IS NOT NULL'),
                ['user-123', 24]
            );
        });

        test('should order commitments due soon by due_date ASC', async () => {
            mockDeps.dal.query.mockResolvedValue([]);

            await commitmentsRepo.getCommitmentsDueSoon('user-123', 24);

            expect(mockDeps.dal.query).toHaveBeenCalledWith(
                expect.stringContaining('ORDER BY due_date ASC'),
                ['user-123', 24]
            );
        });

        test('should only return future commitments', async () => {
            mockDeps.dal.query.mockResolvedValue([]);

            await commitmentsRepo.getCommitmentsDueSoon('user-123', 24);

            expect(mockDeps.dal.query).toHaveBeenCalledWith(
                expect.stringContaining("datetime(due_date) >= datetime('now')"),
                ['user-123', 24]
            );
        });
    });

    describe('Submission Flow', () => {
        test('should submit commitment with content and update status', async () => {
            mockDeps.dal.update.mockResolvedValue({ changes: 1 });

            const submissionContent = 'Completed 30 minutes of exercise at the gym';
            const result = await commitmentsRepo.submitCommitment('commitment-1', submissionContent);

            expect(result).toEqual({ submitted: true });
            // BaseRepository calls dal.update(tableName, data, conditions)
            expect(mockDeps.dal.update).toHaveBeenCalledWith(
                'commitments',
                expect.objectContaining({
                    submission_content: submissionContent,
                    submitted_at: expect.any(String),
                    status: 'submitted',
                    updated_at: expect.any(String)
                }),
                { id: 'commitment-1' }
            );
        });

        test('should return false when submission fails', async () => {
            mockDeps.dal.update.mockResolvedValue({ changes: 0 });

            const result = await commitmentsRepo.submitCommitment('commitment-999', 'Content');

            expect(result).toEqual({ submitted: false });
        });

        test('should include timestamp when submitting', async () => {
            mockDeps.dal.update.mockResolvedValue({ changes: 1 });

            await commitmentsRepo.submitCommitment('commitment-1', 'Submission content');

            // BaseRepository calls dal.update(tableName, data, conditions)
            const updateCall = mockDeps.dal.update.mock.calls[0];
            expect(updateCall[1].submitted_at).toBeDefined();
            expect(typeof updateCall[1].submitted_at).toBe('string');
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
                commitment_text: 'Test commitment',
                due_date: '2025-10-10T12:00:00Z'
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
                    commitment_text: 'Test'
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
});

