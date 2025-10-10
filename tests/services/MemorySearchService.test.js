/**
 * Unit Tests for MemorySearchService
 * 
 * CLEAN ARCHITECTURE TESTING:
 * - Test service creation and inheritance
 * - Test search intent analysis
 * - Test significant memory queries
 * - Test LLM-based relevance filtering
 * - Test deep search execution flow
 * - Mock external dependencies for isolated testing
 */

const MemorySearchService = require('../../backend/services/domain/CORE_MemorySearchService');

describe('MemorySearchService', () => {
    let memorySearchService;
    let mockDeps;
    let mockDAL;

    beforeEach(async () => {
        mockDeps = createMockDependencies();
        
        // Add wrapDomainError to errorHandling mock
        mockDeps.errorHandling.wrapDomainError = jest.fn((error, message, context) => {
            const wrappedError = new Error(`${message}: ${error.message}`);
            wrappedError.context = context;
            return wrappedError;
        });
        
        // Mock database service with DAL
        mockDAL = {
            memories: {
                getSignificantMemories: jest.fn()
            },
            conversations: {
                getMessagesByIds: jest.fn()
            }
        };
        
        mockDeps.database = {
            getDAL: jest.fn(() => mockDAL)
        };

        // Mock structured response service
        mockDeps.structuredResponse = {
            generateStructuredResponse: jest.fn()
        };
        
        memorySearchService = new MemorySearchService(mockDeps);
        
        // Initialize the service to set up this.dal
        await memorySearchService.initialize();
    });

    describe('Architecture Compliance', () => {
        test('should extend AbstractService', () => {
            expect(memorySearchService.constructor.name).toBe('MemorySearchService');
            expect(memorySearchService.name).toBe('MemorySearchService');
            expect(memorySearchService.logger).toBeDefined();
            expect(memorySearchService.errorHandler).toBeDefined();
        });

        test('should have proper dependencies injected', () => {
            expect(memorySearchService.database).toBeDefined();
            expect(memorySearchService.dal).toBeDefined();
            expect(memorySearchService.structuredResponse).toBeDefined();
        });

        test('should implement required service interface', () => {
            const requiredMethods = ['initialize', 'shutdown', 'checkHealth'];
            requiredMethods.forEach(method => {
                expect(typeof memorySearchService[method]).toBe('function');
            });
        });

        test('should implement memory search-specific methods', () => {
            const searchMethods = [
                'analyzeSearchIntent',
                'searchSignificantMemories',
                'filterRelevantMemories',
                'executeDeepSearch'
            ];
            searchMethods.forEach(method => {
                expect(typeof memorySearchService[method]).toBe('function');
            });
        });
    });

    describe('Service Lifecycle', () => {
        test('should initialize successfully', async () => {
            expect(memorySearchService.dal).toBeDefined();
            expect(memorySearchService.database).toBeDefined();
        });

        test('should provide health status', async () => {
            const health = await memorySearchService.checkHealth();
            expect(health).toBeDefined();
            expect(typeof health.healthy).toBe('boolean');
        });

        test('should shutdown gracefully', async () => {
            jest.spyOn(memorySearchService, 'onShutdown').mockResolvedValue();
            
            await expect(memorySearchService.shutdown()).resolves.not.toThrow();
        });
    });

    describe('Search Intent Analysis', () => {
        test('should detect when search is needed for past references', async () => {
            const userMessage = 'Like I told you last week, I have an ACL injury';
            const recentContext = [
                { role: 'assistant', content: 'How are you today?' },
                { role: 'user', content: 'Good, thanks' }
            ];

            const mockIntent = {
                needs_search: true,
                search_query: 'ACL injury mentioned last week',
                reasoning: 'User references past conversation about ACL injury not in recent context'
            };

            mockDeps.structuredResponse.generateStructuredResponse.mockResolvedValue(mockIntent);

            const result = await memorySearchService.analyzeSearchIntent(userMessage, recentContext);

            expect(result.needs_search).toBe(true);
            expect(result.search_query).toBeDefined();
            expect(mockDeps.structuredResponse.generateStructuredResponse).toHaveBeenCalledWith(
                expect.stringContaining('Like I told you last week'),
                expect.objectContaining({
                    type: 'object',
                    properties: expect.objectContaining({
                        needs_search: { type: 'boolean' }
                    })
                }),
                expect.objectContaining({
                    model: 'qwen',
                    temperature: 0.1,
                    maxTokens: 200
                })
            );
        });

        test('should detect when search is NOT needed for greetings', async () => {
            const userMessage = 'Good morning!';
            const recentContext = [
                { role: 'assistant', content: 'Hello!' }
            ];

            const mockIntent = {
                needs_search: false,
                search_query: null,
                reasoning: 'Simple greeting with no reference to past information'
            };

            mockDeps.structuredResponse.generateStructuredResponse.mockResolvedValue(mockIntent);

            const result = await memorySearchService.analyzeSearchIntent(userMessage, recentContext);

            expect(result.needs_search).toBe(false);
            expect(result.search_query).toBeNull();
        });

        test('should detect when search is NOT needed for recent context', async () => {
            const userMessage = 'What did you just say about exercise?';
            const recentContext = [
                { role: 'assistant', content: 'You should exercise daily for good health' },
                { role: 'user', content: 'Tell me more' }
            ];

            const mockIntent = {
                needs_search: false,
                search_query: null,
                reasoning: 'Reference is to recent message in context, no deep search needed'
            };

            mockDeps.structuredResponse.generateStructuredResponse.mockResolvedValue(mockIntent);

            const result = await memorySearchService.analyzeSearchIntent(userMessage, recentContext);

            expect(result.needs_search).toBe(false);
        });

        test('should detect search need for temporal references', async () => {
            const userMessage = 'Remember that task from September?';
            const recentContext = [
                { role: 'assistant', content: 'How can I help?' }
            ];

            const mockIntent = {
                needs_search: true,
                search_query: 'task mentioned in September',
                reasoning: 'User references specific time period not in recent context'
            };

            mockDeps.structuredResponse.generateStructuredResponse.mockResolvedValue(mockIntent);

            const result = await memorySearchService.analyzeSearchIntent(userMessage, recentContext);

            expect(result.needs_search).toBe(true);
            expect(result.search_query).toContain('September');
        });

        test('should use Qwen model with low temperature', async () => {
            const userMessage = 'Test message';
            const recentContext = [];

            mockDeps.structuredResponse.generateStructuredResponse.mockResolvedValue({
                needs_search: false,
                search_query: null,
                reasoning: 'No search needed'
            });

            await memorySearchService.analyzeSearchIntent(userMessage, recentContext);

            const callArgs = mockDeps.structuredResponse.generateStructuredResponse.mock.calls[0];
            expect(callArgs[2].model).toBe('qwen');
            expect(callArgs[2].temperature).toBe(0.1);
        });
    });

    describe('Significant Memories Query', () => {
        test('should search memories above significance threshold', async () => {
            const chatId = 100;
            const excludeIds = [1, 2, 3];
            const threshold = 7;

            const mockMemories = [
                {
                    id: 10,
                    content: 'User has ACL injury',
                    timestamp: '2025-10-01T10:00:00Z',
                    emotional_impact: 8,
                    total_significance: 9.5
                },
                {
                    id: 11,
                    content: 'User loves coffee',
                    timestamp: '2025-10-02T11:00:00Z',
                    emotional_impact: 6,
                    total_significance: 7.8
                }
            ];

            mockDAL.memories.getSignificantMemories.mockResolvedValue(mockMemories);

            const result = await memorySearchService.searchSignificantMemories(
                chatId,
                excludeIds,
                threshold
            );

            expect(result).toEqual(mockMemories);
            expect(mockDAL.memories.getSignificantMemories).toHaveBeenCalledWith(
                chatId,
                excludeIds,
                threshold
            );
        });

        test('should exclude recent message IDs from search', async () => {
            const chatId = 100;
            const excludeIds = [5, 6, 7, 8, 9];
            const threshold = 7;

            mockDAL.memories.getSignificantMemories.mockResolvedValue([]);

            await memorySearchService.searchSignificantMemories(chatId, excludeIds, threshold);

            expect(mockDAL.memories.getSignificantMemories).toHaveBeenCalledWith(
                chatId,
                excludeIds,
                threshold
            );
        });

        test('should return all significant memories without limit', async () => {
            const chatId = 100;
            const excludeIds = [];
            const threshold = 7;

            // Mock returning many memories (no limit)
            const manyMemories = Array.from({ length: 50 }, (_, i) => ({
                id: i + 20,
                content: `Memory ${i}`,
                timestamp: '2025-10-01T10:00:00Z',
                total_significance: 7 + (i % 3)
            }));

            mockDAL.memories.getSignificantMemories.mockResolvedValue(manyMemories);

            const result = await memorySearchService.searchSignificantMemories(
                chatId,
                excludeIds,
                threshold
            );

            expect(result).toHaveLength(50);
            expect(result).toEqual(manyMemories);
        });

        test('should handle empty memory results', async () => {
            const chatId = 100;
            const excludeIds = [1, 2, 3];
            const threshold = 9;

            mockDAL.memories.getSignificantMemories.mockResolvedValue([]);

            const result = await memorySearchService.searchSignificantMemories(
                chatId,
                excludeIds,
                threshold
            );

            expect(result).toEqual([]);
        });
    });

    describe('Relevance Filtering', () => {
        test('should filter memories for relevance using LLM', async () => {
            const memories = [
                { id: 1, content: 'User has ACL injury from playing soccer', timestamp: '2025-10-01' },
                { id: 2, content: 'User likes pizza', timestamp: '2025-10-02' },
                { id: 3, content: 'User is recovering from knee surgery', timestamp: '2025-10-03' }
            ];
            const searchQuery = 'ACL injury and recovery';

            const mockFilterResult = {
                relevant_indices: [1, 3],
                reasoning: 'Memories 1 and 3 relate to ACL injury and recovery'
            };

            mockDeps.structuredResponse.generateStructuredResponse.mockResolvedValue(mockFilterResult);

            const result = await memorySearchService.filterRelevantMemories(memories, searchQuery);

            expect(result).toHaveLength(2);
            expect(result[0].id).toBe(1);
            expect(result[1].id).toBe(3);
            expect(mockDeps.structuredResponse.generateStructuredResponse).toHaveBeenCalledWith(
                expect.stringContaining('ACL injury and recovery'),
                expect.objectContaining({
                    type: 'object',
                    properties: expect.objectContaining({
                        relevant_indices: expect.any(Object)
                    })
                }),
                expect.objectContaining({
                    model: 'qwen',
                    temperature: 0.1
                })
            );
        });

        test('should limit results to top 10 memories', async () => {
            const memories = Array.from({ length: 20 }, (_, i) => ({
                id: i + 1,
                content: `Memory ${i + 1}`,
                timestamp: '2025-10-01'
            }));
            const searchQuery = 'test query';

            const mockFilterResult = {
                relevant_indices: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
                reasoning: 'All are relevant'
            };

            mockDeps.structuredResponse.generateStructuredResponse.mockResolvedValue(mockFilterResult);

            const result = await memorySearchService.filterRelevantMemories(memories, searchQuery);

            expect(result.length).toBeLessThanOrEqual(10);
        });

        test('should handle empty memory list', async () => {
            const memories = [];
            const searchQuery = 'test query';

            const result = await memorySearchService.filterRelevantMemories(memories, searchQuery);

            expect(result).toEqual([]);
            expect(mockDeps.structuredResponse.generateStructuredResponse).not.toHaveBeenCalled();
        });

        test('should handle invalid indices gracefully', async () => {
            const memories = [
                { id: 1, content: 'Memory 1', timestamp: '2025-10-01' },
                { id: 2, content: 'Memory 2', timestamp: '2025-10-02' }
            ];
            const searchQuery = 'test query';

            const mockFilterResult = {
                relevant_indices: [1, 5, 10], // 5 and 10 are out of bounds
                reasoning: 'Some indices are out of range'
            };

            mockDeps.structuredResponse.generateStructuredResponse.mockResolvedValue(mockFilterResult);

            const result = await memorySearchService.filterRelevantMemories(memories, searchQuery);

            expect(result).toHaveLength(1); // Only index 1 is valid
            expect(result[0].id).toBe(1);
        });

        test('should include memory timestamps in prompt', async () => {
            const memories = [
                { id: 1, content: 'Memory content', timestamp: '2025-10-01T10:00:00Z' }
            ];
            const searchQuery = 'test';

            mockDeps.structuredResponse.generateStructuredResponse.mockResolvedValue({
                relevant_indices: [1],
                reasoning: 'Relevant'
            });

            await memorySearchService.filterRelevantMemories(memories, searchQuery);

            const promptCall = mockDeps.structuredResponse.generateStructuredResponse.mock.calls[0][0];
            expect(promptCall).toContain('2025-10-01T10:00:00Z');
            expect(promptCall).toContain('Memory content');
        });
    });

    describe('Deep Search Execution', () => {
        test('should execute complete deep search flow', async () => {
            const chatId = 100;
            const userMessage = 'Remember my ACL injury?';
            const recentMessageIds = [1, 2, 3];
            const threshold = 7;

            const mockRecentMessages = [
                { id: 1, role: 'user', content: 'Hello' },
                { id: 2, role: 'assistant', content: 'Hi there' }
            ];

            const mockSearchIntent = {
                needs_search: true,
                search_query: 'ACL injury',
                reasoning: 'User references past injury'
            };

            const mockCandidateMemories = [
                { id: 10, content: 'User has ACL injury', timestamp: '2025-10-01' },
                { id: 11, content: 'User likes basketball', timestamp: '2025-10-02' },
                { id: 12, content: 'User is in physical therapy', timestamp: '2025-10-03' }
            ];

            const mockFilterResult = {
                relevant_indices: [1, 3],
                reasoning: 'Memories about injury and recovery'
            };

            mockDAL.conversations.getMessagesByIds.mockResolvedValue(mockRecentMessages);
            mockDeps.structuredResponse.generateStructuredResponse
                .mockResolvedValueOnce(mockSearchIntent)
                .mockResolvedValueOnce(mockFilterResult);
            mockDAL.memories.getSignificantMemories.mockResolvedValue(mockCandidateMemories);

            const result = await memorySearchService.executeDeepSearch(
                chatId,
                userMessage,
                recentMessageIds,
                threshold
            );

            expect(result).toHaveLength(2);
            expect(result[0].content).toBe('User has ACL injury');
            expect(result[1].content).toBe('User is in physical therapy');
            expect(mockDAL.conversations.getMessagesByIds).toHaveBeenCalledWith(recentMessageIds);
            expect(mockDAL.memories.getSignificantMemories).toHaveBeenCalledWith(
                chatId,
                recentMessageIds,
                threshold
            );
        });

        test('should return null when search not needed', async () => {
            const chatId = 100;
            const userMessage = 'Good morning!';
            const recentMessageIds = [1, 2];
            const threshold = 7;

            const mockRecentMessages = [
                { id: 1, role: 'assistant', content: 'Hello' }
            ];

            const mockSearchIntent = {
                needs_search: false,
                search_query: null,
                reasoning: 'Simple greeting'
            };

            mockDAL.conversations.getMessagesByIds.mockResolvedValue(mockRecentMessages);
            mockDeps.structuredResponse.generateStructuredResponse.mockResolvedValue(mockSearchIntent);

            const result = await memorySearchService.executeDeepSearch(
                chatId,
                userMessage,
                recentMessageIds,
                threshold
            );

            expect(result).toBeNull();
            expect(mockDAL.memories.getSignificantMemories).not.toHaveBeenCalled();
        });

        test('should return empty array when no candidate memories found', async () => {
            const chatId = 100;
            const userMessage = 'Remember my old injury?';
            const recentMessageIds = [1, 2];
            const threshold = 7;

            const mockRecentMessages = [
                { id: 1, role: 'user', content: 'Hello' }
            ];

            const mockSearchIntent = {
                needs_search: true,
                search_query: 'old injury',
                reasoning: 'References past event'
            };

            mockDAL.conversations.getMessagesByIds.mockResolvedValue(mockRecentMessages);
            mockDeps.structuredResponse.generateStructuredResponse.mockResolvedValue(mockSearchIntent);
            mockDAL.memories.getSignificantMemories.mockResolvedValue([]);

            const result = await memorySearchService.executeDeepSearch(
                chatId,
                userMessage,
                recentMessageIds,
                threshold
            );

            expect(result).toEqual([]);
        });

        test('should handle all memories being relevant', async () => {
            const chatId = 100;
            const userMessage = 'Tell me about my health';
            const recentMessageIds = [1];
            const threshold = 7;

            const mockRecentMessages = [{ id: 1, role: 'user', content: 'Hi' }];

            const mockSearchIntent = {
                needs_search: true,
                search_query: 'health information',
                reasoning: 'Broad health query'
            };

            const mockCandidateMemories = [
                { id: 10, content: 'User exercises daily', timestamp: '2025-10-01' },
                { id: 11, content: 'User eats healthy', timestamp: '2025-10-02' }
            ];

            const mockFilterResult = {
                relevant_indices: [1, 2],
                reasoning: 'All relate to health'
            };

            mockDAL.conversations.getMessagesByIds.mockResolvedValue(mockRecentMessages);
            mockDeps.structuredResponse.generateStructuredResponse
                .mockResolvedValueOnce(mockSearchIntent)
                .mockResolvedValueOnce(mockFilterResult);
            mockDAL.memories.getSignificantMemories.mockResolvedValue(mockCandidateMemories);

            const result = await memorySearchService.executeDeepSearch(
                chatId,
                userMessage,
                recentMessageIds,
                threshold
            );

            expect(result).toHaveLength(2);
        });
    });

    describe('Edge Cases', () => {
        test('should handle no significant memories above threshold', async () => {
            const chatId = 100;
            const excludeIds = [];
            const threshold = 9;

            mockDAL.memories.getSignificantMemories.mockResolvedValue([]);

            const result = await memorySearchService.searchSignificantMemories(
                chatId,
                excludeIds,
                threshold
            );

            expect(result).toEqual([]);
        });

        test('should handle single memory result', async () => {
            const memories = [
                { id: 1, content: 'Single memory', timestamp: '2025-10-01' }
            ];
            const searchQuery = 'test';

            const mockFilterResult = {
                relevant_indices: [1],
                reasoning: 'Only memory is relevant'
            };

            mockDeps.structuredResponse.generateStructuredResponse.mockResolvedValue(mockFilterResult);

            const result = await memorySearchService.filterRelevantMemories(memories, searchQuery);

            expect(result).toHaveLength(1);
            expect(result[0].id).toBe(1);
        });

        test('should handle no relevant memories after filtering', async () => {
            const memories = [
                { id: 1, content: 'Memory about sports', timestamp: '2025-10-01' },
                { id: 2, content: 'Memory about food', timestamp: '2025-10-02' }
            ];
            const searchQuery = 'programming languages';

            const mockFilterResult = {
                relevant_indices: [],
                reasoning: 'No memories relate to programming'
            };

            mockDeps.structuredResponse.generateStructuredResponse.mockResolvedValue(mockFilterResult);

            const result = await memorySearchService.filterRelevantMemories(memories, searchQuery);

            expect(result).toEqual([]);
        });

        test('should handle empty recent context', async () => {
            const userMessage = 'Test message';
            const recentContext = [];

            const mockIntent = {
                needs_search: false,
                search_query: null,
                reasoning: 'No context to analyze'
            };

            mockDeps.structuredResponse.generateStructuredResponse.mockResolvedValue(mockIntent);

            const result = await memorySearchService.analyzeSearchIntent(userMessage, recentContext);

            expect(result.needs_search).toBe(false);
        });
    });

    describe('Error Handling', () => {
        test('should handle database errors in memory search', async () => {
            const chatId = 100;
            const excludeIds = [];
            const threshold = 7;

            mockDAL.memories.getSignificantMemories.mockRejectedValue(
                new Error('Database connection failed')
            );

            await expect(
                memorySearchService.searchSignificantMemories(chatId, excludeIds, threshold)
            ).rejects.toThrow();
        });

        test('should handle LLM errors in intent analysis', async () => {
            const userMessage = 'Test message';
            const recentContext = [];

            mockDeps.structuredResponse.generateStructuredResponse.mockRejectedValue(
                new Error('LLM service unavailable')
            );

            await expect(
                memorySearchService.analyzeSearchIntent(userMessage, recentContext)
            ).rejects.toThrow();
        });

        test('should handle LLM errors in relevance filtering', async () => {
            const memories = [
                { id: 1, content: 'Memory', timestamp: '2025-10-01' }
            ];
            const searchQuery = 'test';

            mockDeps.structuredResponse.generateStructuredResponse.mockRejectedValue(
                new Error('LLM timeout')
            );

            await expect(
                memorySearchService.filterRelevantMemories(memories, searchQuery)
            ).rejects.toThrow();
        });

        test('should handle errors in deep search execution', async () => {
            const chatId = 100;
            const userMessage = 'Test';
            const recentMessageIds = [1];
            const threshold = 7;

            mockDAL.conversations.getMessagesByIds.mockRejectedValue(
                new Error('Failed to fetch messages')
            );

            await expect(
                memorySearchService.executeDeepSearch(chatId, userMessage, recentMessageIds, threshold)
            ).rejects.toThrow();
        });

        test('should wrap errors with proper context', async () => {
            const chatId = 100;
            const excludeIds = [1, 2, 3];
            const threshold = 7;

            mockDAL.memories.getSignificantMemories.mockRejectedValue(
                new Error('Query failed')
            );

            try {
                await memorySearchService.searchSignificantMemories(chatId, excludeIds, threshold);
                fail('Should have thrown an error');
            } catch (error) {
                expect(error.message).toContain('Failed to search significant memories');
                expect(mockDeps.errorHandling.wrapDomainError).toHaveBeenCalledWith(
                    expect.any(Error),
                    'Failed to search significant memories',
                    expect.objectContaining({ 
                        chatId, 
                        excludeCount: excludeIds.length,
                        significanceThreshold: threshold 
                    })
                );
            }
        });
    });
});
