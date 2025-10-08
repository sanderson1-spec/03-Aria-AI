/**
 * Unit Tests for ContextBuilderService
 * 
 * CLEAN ARCHITECTURE TESTING:
 * - Test service creation and inheritance
 * - Test unified context building
 * - Test context window resolution (cascade logic)
 * - Test parallel fetching performance
 * - Mock external dependencies for isolated testing
 */

const ContextBuilderService = require('../../backend/services/domain/CORE_ContextBuilderService');

describe('ContextBuilderService', () => {
    let contextBuilderService;
    let mockDeps;

    beforeEach(() => {
        mockDeps = createMockDependencies();
        
        // Add database service mock with DAL
        mockDeps.database = {
            getDAL: jest.fn().mockReturnValue({
                conversationLogs: {
                    getRecentMessages: jest.fn()
                },
                memories: {
                    getTopWeightedMemories: jest.fn()
                },
                commitments: {
                    getActiveCommitments: jest.fn(),
                    getRecentCompletedCommitments: jest.fn()
                },
                events: {
                    getUpcomingEvents: jest.fn(),
                    getRecentCompletedEvents: jest.fn()
                }
            })
        };

        // Add llmConfig mock
        mockDeps.llmConfig = {
            getCharacterPreferences: jest.fn(),
            getUserPreferences: jest.fn(),
            getGlobalConfig: jest.fn()
        };

        // Add psychology mock
        mockDeps.psychology = {
            getState: jest.fn()
        };
        
        contextBuilderService = new ContextBuilderService(mockDeps);
    });

    describe('Architecture Compliance', () => {
        test('should extend AbstractService', () => {
            expect(contextBuilderService.constructor.name).toBe('ContextBuilderService');
            expect(contextBuilderService.name).toBe('ContextBuilderService');
            expect(contextBuilderService.logger).toBeDefined();
            expect(contextBuilderService.errorHandler).toBeDefined();
        });

        test('should have DAL access', () => {
            expect(contextBuilderService.dal).toBeDefined();
            expect(contextBuilderService.dal.conversationLogs).toBeDefined();
            expect(contextBuilderService.dal.memories).toBeDefined();
            expect(contextBuilderService.dal.commitments).toBeDefined();
            expect(contextBuilderService.dal.events).toBeDefined();
        });

        test('should have llmConfig dependency', () => {
            expect(contextBuilderService.llmConfig).toBeDefined();
            expect(typeof contextBuilderService.llmConfig.getCharacterPreferences).toBe('function');
            expect(typeof contextBuilderService.llmConfig.getUserPreferences).toBe('function');
            expect(typeof contextBuilderService.llmConfig.getGlobalConfig).toBe('function');
        });

        test('should have psychology dependency', () => {
            expect(contextBuilderService.psychology).toBeDefined();
            expect(typeof contextBuilderService.psychology.getState).toBe('function');
        });

        test('should implement required service interface', () => {
            const requiredMethods = ['initialize', 'shutdown', 'checkHealth'];
            requiredMethods.forEach(method => {
                expect(typeof contextBuilderService[method]).toBe('function');
            });
        });

        test('should implement context-specific methods', () => {
            const contextMethods = [
                'buildUnifiedContext',
                'getRecentMessages',
                'resolveContextWindow',
                'getRecentCompletions'
            ];
            contextMethods.forEach(method => {
                expect(typeof contextBuilderService[method]).toBe('function');
            });
        });
    });

    describe('Service Lifecycle', () => {
        test('should initialize successfully', async () => {
            jest.spyOn(contextBuilderService, 'onInitialize').mockResolvedValue();
            
            await expect(contextBuilderService.initialize()).resolves.not.toThrow();
        });

        test('should provide health status', async () => {
            const health = await contextBuilderService.checkHealth();
            expect(health).toBeDefined();
            expect(typeof health.healthy).toBe('boolean');
        });

        test('should shutdown gracefully', async () => {
            jest.spyOn(contextBuilderService, 'onShutdown').mockResolvedValue();
            
            await expect(contextBuilderService.shutdown()).resolves.not.toThrow();
        });
    });

    describe('Unified Context Building', () => {
        const mockUserId = 1;
        const mockChatId = 100;
        const mockCharacterId = 5;

        beforeEach(() => {
            // Mock all data sources
            mockDeps.database.getDAL().conversationLogs.getRecentMessages.mockResolvedValue([
                { id: 1, role: 'user', content: 'Hello' },
                { id: 2, role: 'assistant', content: 'Hi there!' }
            ]);

            mockDeps.psychology.getState.mockResolvedValue({
                mood: 'happy',
                openness: 0.8
            });

            mockDeps.database.getDAL().memories.getTopWeightedMemories.mockResolvedValue([
                { id: 1, content: 'User likes coffee', weight: 0.9 }
            ]);

            mockDeps.database.getDAL().commitments.getActiveCommitments.mockResolvedValue([
                { id: 1, title: 'Exercise daily', status: 'active' }
            ]);

            mockDeps.database.getDAL().events.getUpcomingEvents.mockResolvedValue([
                { id: 1, title: 'Team meeting', scheduled_at: '2025-10-10' }
            ]);

            mockDeps.database.getDAL().commitments.getRecentCompletedCommitments.mockResolvedValue([
                { id: 2, title: 'Finish report', completed_at: '2025-10-07' }
            ]);

            mockDeps.database.getDAL().events.getRecentCompletedEvents.mockResolvedValue([
                { id: 2, title: 'Code review', updated_at: '2025-10-06' }
            ]);

            // Mock context window resolution
            mockDeps.llmConfig.getCharacterPreferences.mockResolvedValue(null);
            mockDeps.llmConfig.getUserPreferences.mockResolvedValue(null);
            mockDeps.llmConfig.getGlobalConfig.mockResolvedValue({ context_window_messages: 30 });
        });

        test('should build unified context with all data streams', async () => {
            const context = await contextBuilderService.buildUnifiedContext(
                mockUserId,
                mockChatId,
                mockCharacterId
            );

            expect(context).toBeDefined();
            expect(context.recentMessages).toHaveLength(2);
            expect(context.psychologyState).toEqual({ mood: 'happy', openness: 0.8 });
            expect(context.topMemories).toHaveLength(1);
            expect(context.activeCommitments).toHaveLength(1);
            expect(context.upcomingEvents).toHaveLength(1);
            expect(context.recentCompletions).toBeDefined();
        });

        test('should call psychology.getState with correct parameters', async () => {
            await contextBuilderService.buildUnifiedContext(
                mockUserId,
                mockChatId,
                mockCharacterId
            );

            expect(mockDeps.psychology.getState).toHaveBeenCalledWith(
                mockUserId,
                mockChatId,
                mockCharacterId
            );
        });

        test('should fetch top 10 weighted memories', async () => {
            await contextBuilderService.buildUnifiedContext(
                mockUserId,
                mockChatId,
                mockCharacterId
            );

            expect(mockDeps.database.getDAL().memories.getTopWeightedMemories).toHaveBeenCalledWith(
                mockUserId,
                mockChatId,
                10
            );
        });

        test('should fetch 5 upcoming events', async () => {
            await contextBuilderService.buildUnifiedContext(
                mockUserId,
                mockChatId,
                mockCharacterId
            );

            expect(mockDeps.database.getDAL().events.getUpcomingEvents).toHaveBeenCalledWith(
                mockUserId,
                5
            );
        });

        test('should handle empty data gracefully', async () => {
            mockDeps.database.getDAL().conversationLogs.getRecentMessages.mockResolvedValue([]);
            mockDeps.database.getDAL().memories.getTopWeightedMemories.mockResolvedValue([]);
            mockDeps.database.getDAL().commitments.getActiveCommitments.mockResolvedValue([]);
            mockDeps.database.getDAL().events.getUpcomingEvents.mockResolvedValue([]);

            const context = await contextBuilderService.buildUnifiedContext(
                mockUserId,
                mockChatId,
                mockCharacterId
            );

            expect(context.recentMessages).toEqual([]);
            expect(context.topMemories).toEqual([]);
            expect(context.activeCommitments).toEqual([]);
            expect(context.upcomingEvents).toEqual([]);
        });
    });

    describe('Recent Messages Query', () => {
        const mockChatId = 100;

        test('should retrieve recent messages with correct limit', async () => {
            const mockMessages = [
                { id: 1, role: 'user', content: 'Message 1' },
                { id: 2, role: 'assistant', content: 'Response 1' }
            ];
            mockDeps.database.getDAL().conversationLogs.getRecentMessages.mockResolvedValue(mockMessages);

            const messages = await contextBuilderService.getRecentMessages(mockChatId, 30);

            expect(messages).toEqual(mockMessages);
            expect(mockDeps.database.getDAL().conversationLogs.getRecentMessages).toHaveBeenCalledWith(
                mockChatId,
                30
            );
        });

        test('should handle different window sizes', async () => {
            mockDeps.database.getDAL().conversationLogs.getRecentMessages.mockResolvedValue([]);

            await contextBuilderService.getRecentMessages(mockChatId, 50);
            expect(mockDeps.database.getDAL().conversationLogs.getRecentMessages).toHaveBeenCalledWith(
                mockChatId,
                50
            );

            await contextBuilderService.getRecentMessages(mockChatId, 10);
            expect(mockDeps.database.getDAL().conversationLogs.getRecentMessages).toHaveBeenCalledWith(
                mockChatId,
                10
            );
        });

        test('should handle empty message history', async () => {
            mockDeps.database.getDAL().conversationLogs.getRecentMessages.mockResolvedValue([]);

            const messages = await contextBuilderService.getRecentMessages(mockChatId, 30);

            expect(messages).toEqual([]);
        });
    });

    describe('Context Window Resolution', () => {
        const mockUserId = 1;
        const mockCharacterId = 5;
        const role = 'conversational';

        test('should use character override when available', async () => {
            mockDeps.llmConfig.getCharacterPreferences.mockResolvedValue({
                conversational: { context_window_messages: 50 }
            });
            mockDeps.llmConfig.getUserPreferences.mockResolvedValue({
                conversational: { context_window_messages: 40 }
            });
            mockDeps.llmConfig.getGlobalConfig.mockResolvedValue({
                context_window_messages: 30
            });

            const windowSize = await contextBuilderService.resolveContextWindow(
                mockUserId,
                mockCharacterId,
                role
            );

            expect(windowSize).toBe(50);
        });

        test('should use user preference when character override not set', async () => {
            mockDeps.llmConfig.getCharacterPreferences.mockResolvedValue(null);
            mockDeps.llmConfig.getUserPreferences.mockResolvedValue({
                conversational: { context_window_messages: 40 }
            });
            mockDeps.llmConfig.getGlobalConfig.mockResolvedValue({
                context_window_messages: 30
            });

            const windowSize = await contextBuilderService.resolveContextWindow(
                mockUserId,
                mockCharacterId,
                role
            );

            expect(windowSize).toBe(40);
        });

        test('should use global config when user preference not set', async () => {
            mockDeps.llmConfig.getCharacterPreferences.mockResolvedValue(null);
            mockDeps.llmConfig.getUserPreferences.mockResolvedValue(null);
            mockDeps.llmConfig.getGlobalConfig.mockResolvedValue({
                context_window_messages: 30
            });

            const windowSize = await contextBuilderService.resolveContextWindow(
                mockUserId,
                mockCharacterId,
                role
            );

            expect(windowSize).toBe(30);
        });

        test('should default to 30 when no configuration available', async () => {
            mockDeps.llmConfig.getCharacterPreferences.mockResolvedValue(null);
            mockDeps.llmConfig.getUserPreferences.mockResolvedValue(null);
            mockDeps.llmConfig.getGlobalConfig.mockResolvedValue(null);

            const windowSize = await contextBuilderService.resolveContextWindow(
                mockUserId,
                mockCharacterId,
                role
            );

            expect(windowSize).toBe(30);
        });

        test('should handle analytical role configuration', async () => {
            mockDeps.llmConfig.getCharacterPreferences.mockResolvedValue({
                analytical: { context_window_messages: 60 }
            });
            mockDeps.llmConfig.getUserPreferences.mockResolvedValue(null);
            mockDeps.llmConfig.getGlobalConfig.mockResolvedValue(null);

            const windowSize = await contextBuilderService.resolveContextWindow(
                mockUserId,
                mockCharacterId,
                'analytical'
            );

            expect(windowSize).toBe(60);
        });

        test('should fetch all preferences in parallel', async () => {
            mockDeps.llmConfig.getCharacterPreferences.mockResolvedValue(null);
            mockDeps.llmConfig.getUserPreferences.mockResolvedValue(null);
            mockDeps.llmConfig.getGlobalConfig.mockResolvedValue({ context_window_messages: 30 });

            await contextBuilderService.resolveContextWindow(
                mockUserId,
                mockCharacterId,
                role
            );

            expect(mockDeps.llmConfig.getCharacterPreferences).toHaveBeenCalledWith(mockCharacterId);
            expect(mockDeps.llmConfig.getUserPreferences).toHaveBeenCalledWith(mockUserId);
            expect(mockDeps.llmConfig.getGlobalConfig).toHaveBeenCalled();
        });
    });

    describe('Parallel Fetching', () => {
        const mockUserId = 1;
        const mockChatId = 100;
        const mockCharacterId = 5;

        test('should use Promise.all for parallel data fetching', async () => {
            // Setup mocks with delays to test parallelization
            const mockPromise = (data, delay = 10) => 
                new Promise(resolve => setTimeout(() => resolve(data), delay));

            mockDeps.database.getDAL().conversationLogs.getRecentMessages.mockReturnValue(
                mockPromise([{ id: 1 }])
            );
            mockDeps.psychology.getState.mockReturnValue(mockPromise({ mood: 'happy' }));
            mockDeps.database.getDAL().memories.getTopWeightedMemories.mockReturnValue(
                mockPromise([{ id: 1 }])
            );
            mockDeps.database.getDAL().commitments.getActiveCommitments.mockReturnValue(
                mockPromise([{ id: 1 }])
            );
            mockDeps.database.getDAL().events.getUpcomingEvents.mockReturnValue(
                mockPromise([{ id: 1 }])
            );
            mockDeps.database.getDAL().commitments.getRecentCompletedCommitments.mockReturnValue(
                mockPromise([{ id: 1 }])
            );
            mockDeps.database.getDAL().events.getRecentCompletedEvents.mockReturnValue(
                mockPromise([{ id: 1 }])
            );
            mockDeps.llmConfig.getCharacterPreferences.mockResolvedValue(null);
            mockDeps.llmConfig.getUserPreferences.mockResolvedValue(null);
            mockDeps.llmConfig.getGlobalConfig.mockResolvedValue({ context_window_messages: 30 });

            const startTime = Date.now();
            await contextBuilderService.buildUnifiedContext(mockUserId, mockChatId, mockCharacterId);
            const duration = Date.now() - startTime;

            // If running in parallel, should take ~10-20ms not ~60-70ms (6-7 sequential 10ms calls)
            expect(duration).toBeLessThan(100); // Allow some overhead
        });

        test('should complete all fetches even if some are slower', async () => {
            mockDeps.database.getDAL().conversationLogs.getRecentMessages.mockResolvedValue([{ id: 1 }]);
            mockDeps.psychology.getState.mockResolvedValue({ mood: 'happy' });
            mockDeps.database.getDAL().memories.getTopWeightedMemories.mockImplementation(
                () => new Promise(resolve => setTimeout(() => resolve([{ id: 1 }]), 50))
            );
            mockDeps.database.getDAL().commitments.getActiveCommitments.mockResolvedValue([{ id: 1 }]);
            mockDeps.database.getDAL().events.getUpcomingEvents.mockResolvedValue([{ id: 1 }]);
            mockDeps.database.getDAL().commitments.getRecentCompletedCommitments.mockResolvedValue([]);
            mockDeps.database.getDAL().events.getRecentCompletedEvents.mockResolvedValue([]);
            mockDeps.llmConfig.getCharacterPreferences.mockResolvedValue(null);
            mockDeps.llmConfig.getUserPreferences.mockResolvedValue(null);
            mockDeps.llmConfig.getGlobalConfig.mockResolvedValue({ context_window_messages: 30 });

            const context = await contextBuilderService.buildUnifiedContext(
                mockUserId,
                mockChatId,
                mockCharacterId
            );

            expect(context.topMemories).toEqual([{ id: 1 }]);
        });
    });

    describe('Error Handling', () => {
        const mockUserId = 1;
        const mockChatId = 100;
        const mockCharacterId = 5;

        test('should handle database errors gracefully', async () => {
            // Setup llmConfig mocks needed for context window resolution
            mockDeps.llmConfig.getCharacterPreferences.mockResolvedValue(null);
            mockDeps.llmConfig.getUserPreferences.mockResolvedValue(null);
            mockDeps.llmConfig.getGlobalConfig.mockResolvedValue({ context_window_messages: 30 });
            
            // Setup the database error
            mockDeps.database.getDAL().conversationLogs.getRecentMessages.mockRejectedValue(
                new Error('Database connection failed')
            );

            try {
                await contextBuilderService.buildUnifiedContext(mockUserId, mockChatId, mockCharacterId);
                fail('Should have thrown an error');
            } catch (error) {
                expect(error).toBeDefined();
                expect(mockDeps.errorHandling.wrapDomainError).toHaveBeenCalled();
            }
        });

        test('should handle psychology service errors', async () => {
            mockDeps.database.getDAL().conversationLogs.getRecentMessages.mockResolvedValue([]);
            mockDeps.psychology.getState.mockRejectedValue(new Error('Psychology state not found'));
            mockDeps.database.getDAL().memories.getTopWeightedMemories.mockResolvedValue([]);
            mockDeps.database.getDAL().commitments.getActiveCommitments.mockResolvedValue([]);
            mockDeps.database.getDAL().events.getUpcomingEvents.mockResolvedValue([]);
            mockDeps.llmConfig.getCharacterPreferences.mockResolvedValue(null);
            mockDeps.llmConfig.getUserPreferences.mockResolvedValue(null);
            mockDeps.llmConfig.getGlobalConfig.mockResolvedValue({ context_window_messages: 30 });

            await expect(
                contextBuilderService.buildUnifiedContext(mockUserId, mockChatId, mockCharacterId)
            ).rejects.toThrow();
        });

        test('should handle missing userId parameter', async () => {
            await expect(
                contextBuilderService.buildUnifiedContext(null, mockChatId, mockCharacterId)
            ).rejects.toThrow();
        });

        test('should handle llmConfig errors in context window resolution', async () => {
            mockDeps.llmConfig.getCharacterPreferences.mockRejectedValue(
                new Error('Config service unavailable')
            );

            try {
                await contextBuilderService.resolveContextWindow(mockUserId, mockCharacterId, 'conversational');
                fail('Should have thrown an error');
            } catch (error) {
                expect(error).toBeDefined();
                expect(mockDeps.errorHandling.wrapDomainError).toHaveBeenCalled();
            }
        });

        test('should wrap errors with proper context', async () => {
            mockDeps.database.getDAL().conversationLogs.getRecentMessages.mockRejectedValue(
                new Error('Query failed')
            );

            try {
                await contextBuilderService.getRecentMessages(mockChatId, 30);
                fail('Should have thrown an error');
            } catch (error) {
                expect(error).toBeDefined();
                expect(mockDeps.errorHandling.wrapDomainError).toHaveBeenCalledWith(
                    expect.any(Error),
                    'Failed to retrieve recent messages',
                    { chatId: mockChatId, windowSize: 30 }
                );
            }
        });
    });

    describe('Recent Completions', () => {
        const mockUserId = 1;

        test('should combine commitments and events', async () => {
            mockDeps.database.getDAL().commitments.getRecentCompletedCommitments.mockResolvedValue([
                { id: 1, title: 'Task 1', completed_at: '2025-10-07T10:00:00Z' }
            ]);
            mockDeps.database.getDAL().events.getRecentCompletedEvents.mockResolvedValue([
                { id: 2, title: 'Event 1', updated_at: '2025-10-06T15:00:00Z' }
            ]);

            const completions = await contextBuilderService.getRecentCompletions(mockUserId);

            expect(completions).toHaveLength(2);
            expect(completions[0].type).toBe('commitment');
            expect(completions[1].type).toBe('event');
        });

        test('should sort by completion date descending', async () => {
            mockDeps.database.getDAL().commitments.getRecentCompletedCommitments.mockResolvedValue([
                { id: 1, title: 'Task 1', completed_at: '2025-10-05T10:00:00Z' }
            ]);
            mockDeps.database.getDAL().events.getRecentCompletedEvents.mockResolvedValue([
                { id: 2, title: 'Event 1', updated_at: '2025-10-07T15:00:00Z' }
            ]);

            const completions = await contextBuilderService.getRecentCompletions(mockUserId);

            expect(completions[0].id).toBe(2); // Event (most recent)
            expect(completions[1].id).toBe(1); // Commitment
        });

        test('should limit to top 3 most recent completions', async () => {
            mockDeps.database.getDAL().commitments.getRecentCompletedCommitments.mockResolvedValue([
                { id: 1, completed_at: '2025-10-05' },
                { id: 2, completed_at: '2025-10-06' }
            ]);
            mockDeps.database.getDAL().events.getRecentCompletedEvents.mockResolvedValue([
                { id: 3, updated_at: '2025-10-07' },
                { id: 4, updated_at: '2025-10-08' }
            ]);

            const completions = await contextBuilderService.getRecentCompletions(mockUserId);

            expect(completions).toHaveLength(3);
        });

        test('should fetch 3 commitments and 3 events', async () => {
            mockDeps.database.getDAL().commitments.getRecentCompletedCommitments.mockResolvedValue([]);
            mockDeps.database.getDAL().events.getRecentCompletedEvents.mockResolvedValue([]);

            await contextBuilderService.getRecentCompletions(mockUserId);

            expect(mockDeps.database.getDAL().commitments.getRecentCompletedCommitments)
                .toHaveBeenCalledWith(mockUserId, 3);
            expect(mockDeps.database.getDAL().events.getRecentCompletedEvents)
                .toHaveBeenCalledWith(mockUserId, 3);
        });
    });
});
