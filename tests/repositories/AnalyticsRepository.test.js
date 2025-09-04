/**
 * Unit Tests for AnalyticsRepository
 * 
 * CLEAN ARCHITECTURE TESTING:
 * - Test analytics data management
 * - Test data aggregation operations
 * - Test multi-user analytics isolation
 * - Mock database dependencies for isolated testing
 */

const AnalyticsRepository = require('../../backend/dal/repositories/CORE_AnalyticsRepository');

describe('AnalyticsRepository', () => {
    let analyticsRepo;
    let mockDeps;

    beforeEach(() => {
        mockDeps = createMockDependencies();
        analyticsRepo = new AnalyticsRepository('analytics_data', mockDeps);
    });

    describe('Architecture Compliance', () => {
        test('should extend BaseRepository', () => {
            expect(analyticsRepo.constructor.name).toBe('AnalyticsRepository');
            expect(analyticsRepo.tableName).toBe('analytics_data');
            expect(analyticsRepo.dal).toBeDefined();
            expect(analyticsRepo.logger).toBeDefined();
            expect(analyticsRepo.errorHandler).toBeDefined();
        });

        test('should implement required repository interface', () => {
            const requiredMethods = ['count', 'findById', 'create', 'update', 'delete'];
            requiredMethods.forEach(method => {
                expect(typeof analyticsRepo[method]).toBe('function');
            });
        });

        test('should implement analytics-specific methods', () => {
            const analyticsMethods = [
                'recordEvent',
                'getEventsByType',
                'getUserAnalyticsSummary'
            ];
            analyticsMethods.forEach(method => {
                expect(typeof analyticsRepo[method]).toBe('function');
            });
        });
    });

    describe('Multi-User Analytics Operations', () => {
        test('should record event with proper data structure', async () => {
            const mockEvent = {
                user_id: 'user-123',
                event_type: 'chat_message',
                event_data: '{"message_length": 50}'
            };
            mockDeps.dal.create.mockResolvedValue({ id: 'event-1', ...mockEvent });

            const result = await analyticsRepo.recordEvent(mockEvent);

            expect(result).toBeDefined();
            expect(mockDeps.dal.create).toHaveBeenCalledWith('analytics_data', expect.objectContaining({
                user_id: 'user-123',
                event_type: 'chat_message'
            }));
        });

        test('should get events by type with user filtering', async () => {
            const mockData = [
                { id: 1, user_id: 'user-123', event_type: 'chat_message', timestamp: '2024-01-01' }
            ];
            mockDeps.dal.query.mockResolvedValue(mockData);

            const result = await analyticsRepo.getEventsByType('chat_message', 'user-123', 30);

            expect(result).toEqual(mockData);
            expect(mockDeps.dal.query).toHaveBeenCalledWith(
                expect.stringContaining('event_type = ?'),
                expect.arrayContaining(['chat_message', 'user-123', 30])
            );
        });

        test('should get user analytics summary', async () => {
            const mockSummary = {
                total_events: 100,
                event_types: { chat_message: 50, user_action: 30 }
            };
            mockDeps.dal.query.mockResolvedValue([mockSummary]);

            const result = await analyticsRepo.getUserAnalyticsSummary('user-123');

            expect(result).toEqual([mockSummary]);
            expect(mockDeps.dal.query).toHaveBeenCalledWith(
                expect.stringContaining('user_id = ?'),
                expect.arrayContaining(['user-123'])
            );
        });
    });

    describe('Error Handling', () => {
        test('should handle database errors gracefully', async () => {
            const dbError = new Error('Database connection failed');
            mockDeps.dal.create.mockRejectedValue(dbError);

            const mockEvent = { user_id: 'user-123', event_type: 'test' };
            await expect(
                analyticsRepo.recordEvent(mockEvent)
            ).rejects.toThrow();
        });
    });
});