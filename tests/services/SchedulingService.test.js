/**
 * Unit Tests for SchedulingService
 * 
 * CLEAN ARCHITECTURE TESTING:
 * - Test service creation and inheritance
 * - Test polling mechanism with fake timers
 * - Test message detection and delivery
 * - Mock external dependencies for isolated testing
 */

const SchedulingService = require('../../backend/services/infrastructure/CORE_SchedulingService');

// Use fake timers for testing polling intervals
jest.useFakeTimers();

describe('SchedulingService', () => {
    let schedulingService;
    let mockDeps;
    let mockDAL;

    beforeEach(() => {
        jest.clearAllTimers();
        mockDeps = createMockDependencies();
        
        // Create mock DAL
        mockDAL = {
            query: jest.fn().mockResolvedValue([]),
            execute: jest.fn().mockResolvedValue({ changes: 1 })
        };
        
        // Add database service mock with getDAL method
        mockDeps.database = {
            getDAL: jest.fn().mockReturnValue(mockDAL)
        };

        // Add messageDelivery service mock
        mockDeps.messageDelivery = {
            deliverMessage: jest.fn().mockResolvedValue(true)
        };
        
        schedulingService = new SchedulingService(mockDeps);
    });

    afterEach(async () => {
        // Stop polling to clean up timers
        if (schedulingService.isPolling) {
            await schedulingService.stopPolling();
        }
        jest.clearAllTimers();
    });

    describe('Architecture Compliance', () => {
        test('should extend AbstractService', () => {
            expect(schedulingService.constructor.name).toBe('SchedulingService');
            expect(schedulingService.name).toBe('SchedulingService');
            expect(schedulingService.logger).toBeDefined();
            expect(schedulingService.errorHandler).toBeDefined();
        });

        test('should have proper dependencies injected', () => {
            expect(schedulingService.dal).toBeDefined();
            expect(schedulingService.messageDelivery).toBeDefined();
            expect(schedulingService.logger).toBeDefined();
            expect(schedulingService.errorHandler).toBeDefined();
        });

        test('should initialize with polling state', () => {
            expect(schedulingService.pollingInterval).toBeNull();
            expect(schedulingService.isPolling).toBe(false);
            expect(schedulingService.pollingFrequency).toBe(30000);
        });

        test('should implement required service interface', () => {
            const requiredMethods = ['initialize', 'shutdown', 'checkHealth'];
            requiredMethods.forEach(method => {
                expect(typeof schedulingService[method]).toBe('function');
            });
        });

        test('should implement scheduling-specific methods', () => {
            const schedulingMethods = [
                'startPolling',
                'stopPolling',
                'checkScheduledMessages',
                'deliverScheduledMessage',
                'updateEngagementStatus'
            ];
            schedulingMethods.forEach(method => {
                expect(typeof schedulingService[method]).toBe('function');
            });
        });
    });

    describe('Polling Mechanism', () => {
        test('should start polling on initialization', async () => {
            jest.spyOn(schedulingService, 'startPolling');
            jest.spyOn(schedulingService, 'checkScheduledMessages').mockResolvedValue();
            
            await schedulingService.onInitialize();
            
            expect(schedulingService.startPolling).toHaveBeenCalled();
            expect(schedulingService.isPolling).toBe(true);
        });

        test('should stop polling on shutdown', async () => {
            await schedulingService.startPolling();
            expect(schedulingService.isPolling).toBe(true);
            
            await schedulingService.onShutdown();
            
            expect(schedulingService.isPolling).toBe(false);
            expect(schedulingService.pollingInterval).toBeNull();
        });

        test('should poll every 30 seconds', async () => {
            jest.spyOn(schedulingService, 'checkScheduledMessages').mockResolvedValue();
            
            await schedulingService.startPolling();
            
            // Initial call on start
            expect(schedulingService.checkScheduledMessages).toHaveBeenCalledTimes(1);
            
            // Advance timer by 30 seconds
            jest.advanceTimersByTime(30000);
            await Promise.resolve(); // Let promises resolve
            
            expect(schedulingService.checkScheduledMessages).toHaveBeenCalledTimes(2);
            
            // Advance another 30 seconds
            jest.advanceTimersByTime(30000);
            await Promise.resolve();
            
            expect(schedulingService.checkScheduledMessages).toHaveBeenCalledTimes(3);
        });

        test('should not start polling if already polling', async () => {
            await schedulingService.startPolling();
            const firstInterval = schedulingService.pollingInterval;
            
            await schedulingService.startPolling();
            
            expect(schedulingService.pollingInterval).toBe(firstInterval);
            expect(mockDeps.logger.warn).toHaveBeenCalledWith(
                'Polling already active',
                'SchedulingService'
            );
        });

        test('should handle stop polling when not polling', async () => {
            expect(schedulingService.isPolling).toBe(false);
            
            await schedulingService.stopPolling();
            
            expect(mockDeps.logger.warn).toHaveBeenCalledWith(
                'Polling not active',
                'SchedulingService'
            );
        });
    });

    describe('Message Detection', () => {
        test('should find messages due for delivery', async () => {
            const dueMessages = [
                {
                    id: 'engagement-1',
                    session_id: 'session-123',
                    status: 'pending',
                    scheduled_for: '2025-10-07T10:00:00Z'
                },
                {
                    id: 'engagement-2',
                    session_id: 'session-456',
                    status: 'pending',
                    scheduled_for: '2025-10-07T11:00:00Z'
                }
            ];
            
            mockDAL.query.mockResolvedValue(dueMessages);
            jest.spyOn(schedulingService, 'deliverScheduledMessage').mockResolvedValue();
            
            await schedulingService.checkScheduledMessages();
            
            expect(mockDAL.query).toHaveBeenCalledWith(
                expect.stringContaining('SELECT * FROM proactive_engagements'),
                []
            );
            expect(mockDAL.query).toHaveBeenCalledWith(
                expect.stringContaining("status = 'pending'"),
                []
            );
            expect(schedulingService.deliverScheduledMessage).toHaveBeenCalledTimes(2);
        });

        test('should ignore messages not yet due', async () => {
            mockDAL.query.mockResolvedValue([]);
            jest.spyOn(schedulingService, 'deliverScheduledMessage').mockResolvedValue();
            
            await schedulingService.checkScheduledMessages();
            
            expect(mockDAL.query).toHaveBeenCalledWith(
                expect.stringContaining("datetime(scheduled_for) <= datetime('now')"),
                []
            );
            expect(schedulingService.deliverScheduledMessage).not.toHaveBeenCalled();
        });

        test('should order messages by scheduled_for ASC', async () => {
            mockDAL.query.mockResolvedValue([]);
            
            await schedulingService.checkScheduledMessages();
            
            expect(mockDAL.query).toHaveBeenCalledWith(
                expect.stringContaining('ORDER BY scheduled_for ASC'),
                []
            );
        });

        test('should log when no messages are due', async () => {
            mockDAL.query.mockResolvedValue([]);
            
            await schedulingService.checkScheduledMessages();
            
            expect(mockDeps.logger.debug).toHaveBeenCalledWith(
                'No scheduled messages due for delivery',
                'SchedulingService'
            );
        });

        test('should log when messages are found', async () => {
            const dueMessages = [
                { id: 'engagement-1', session_id: 'session-123', status: 'pending' }
            ];
            mockDAL.query.mockResolvedValue(dueMessages);
            jest.spyOn(schedulingService, 'deliverScheduledMessage').mockResolvedValue();
            
            await schedulingService.checkScheduledMessages();
            
            expect(mockDeps.logger.info).toHaveBeenCalledWith(
                'Found 1 scheduled message(s) due for delivery',
                'SchedulingService'
            );
        });
    });

    describe('Message Delivery', () => {
        test('should call messageDelivery.deliverMessage', async () => {
            const engagement = {
                id: 'engagement-1',
                session_id: 'session-123',
                status: 'pending',
                scheduled_for: '2025-10-07T10:00:00Z'
            };
            
            jest.spyOn(schedulingService, 'updateEngagementStatus').mockResolvedValue();
            
            await schedulingService.deliverScheduledMessage(engagement);
            
            expect(mockDeps.messageDelivery.deliverMessage).toHaveBeenCalledWith(engagement);
        });

        test('should log delivery attempt', async () => {
            const engagement = {
                id: 'engagement-1',
                session_id: 'session-123',
                status: 'pending',
                scheduled_for: '2025-10-07T10:00:00Z'
            };
            
            jest.spyOn(schedulingService, 'updateEngagementStatus').mockResolvedValue();
            
            await schedulingService.deliverScheduledMessage(engagement);
            
            expect(mockDeps.logger.info).toHaveBeenCalledWith(
                'Delivering scheduled message',
                'SchedulingService',
                expect.objectContaining({
                    engagementId: 'engagement-1',
                    sessionId: 'session-123'
                })
            );
        });

        test('should log successful delivery', async () => {
            const engagement = {
                id: 'engagement-1',
                session_id: 'session-123',
                status: 'pending'
            };
            
            jest.spyOn(schedulingService, 'updateEngagementStatus').mockResolvedValue();
            
            await schedulingService.deliverScheduledMessage(engagement);
            
            expect(mockDeps.logger.info).toHaveBeenCalledWith(
                'Successfully delivered scheduled message',
                'SchedulingService',
                expect.objectContaining({ engagementId: 'engagement-1' })
            );
        });
    });

    describe('Status Updates', () => {
        test('should update engagement status to delivered', async () => {
            const engagement = {
                id: 'engagement-1',
                session_id: 'session-123',
                status: 'pending'
            };
            
            jest.spyOn(schedulingService, 'updateEngagementStatus').mockResolvedValue();
            
            await schedulingService.deliverScheduledMessage(engagement);
            
            expect(schedulingService.updateEngagementStatus).toHaveBeenCalledWith(
                'engagement-1',
                'delivered'
            );
        });

        test('should update engagement status via DAL', async () => {
            await schedulingService.updateEngagementStatus('engagement-1', 'delivered');
            
            expect(mockDAL.execute).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE proactive_engagements'),
                expect.arrayContaining(['delivered', 'delivered', null, 'engagement-1'])
            );
        });

        test('should set delivered_at when status is delivered', async () => {
            await schedulingService.updateEngagementStatus('engagement-1', 'delivered');
            
            expect(mockDAL.execute).toHaveBeenCalledWith(
                expect.stringContaining("delivered_at = CASE WHEN ? = 'delivered'"),
                expect.any(Array)
            );
        });

        test('should include error_message when provided', async () => {
            const errorMessage = 'Delivery failed';
            
            await schedulingService.updateEngagementStatus('engagement-1', 'failed', errorMessage);
            
            expect(mockDAL.execute).toHaveBeenCalledWith(
                expect.stringContaining('error_message = ?'),
                expect.arrayContaining(['failed', 'failed', errorMessage, 'engagement-1'])
            );
        });

        test('should update updated_at timestamp', async () => {
            await schedulingService.updateEngagementStatus('engagement-1', 'delivered');
            
            expect(mockDAL.execute).toHaveBeenCalledWith(
                expect.stringContaining("updated_at = datetime('now')"),
                expect.any(Array)
            );
        });
    });

    describe('Error Handling', () => {
        test('should continue polling if checkScheduledMessages fails', async () => {
            mockDAL.query.mockRejectedValue(new Error('Database error'));
            
            await schedulingService.checkScheduledMessages();
            
            expect(mockDeps.logger.error).toHaveBeenCalledWith(
                'Error checking scheduled messages',
                'SchedulingService',
                expect.objectContaining({ error: 'Database error' })
            );
        });

        test('should continue processing other messages if one delivery fails', async () => {
            const dueMessages = [
                { id: 'engagement-1', session_id: 'session-123', status: 'pending' },
                { id: 'engagement-2', session_id: 'session-456', status: 'pending' }
            ];
            
            mockDAL.query.mockResolvedValue(dueMessages);
            
            // First delivery fails, second succeeds
            jest.spyOn(schedulingService, 'deliverScheduledMessage')
                .mockRejectedValueOnce(new Error('Delivery failed'))
                .mockResolvedValueOnce();
            
            jest.spyOn(schedulingService, 'updateEngagementStatus').mockResolvedValue();
            
            await schedulingService.checkScheduledMessages();
            
            expect(schedulingService.deliverScheduledMessage).toHaveBeenCalledTimes(2);
            expect(mockDeps.logger.error).toHaveBeenCalledWith(
                'Failed to deliver scheduled message',
                'SchedulingService',
                expect.objectContaining({ engagementId: 'engagement-1' })
            );
        });

        test('should update status to failed when delivery fails', async () => {
            const dueMessages = [
                { id: 'engagement-1', session_id: 'session-123', status: 'pending' }
            ];
            
            mockDAL.query.mockResolvedValue(dueMessages);
            jest.spyOn(schedulingService, 'deliverScheduledMessage')
                .mockRejectedValue(new Error('Delivery failed'));
            jest.spyOn(schedulingService, 'updateEngagementStatus').mockResolvedValue();
            
            await schedulingService.checkScheduledMessages();
            
            expect(schedulingService.updateEngagementStatus).toHaveBeenCalledWith(
                'engagement-1',
                'failed',
                expect.stringContaining('Delivery failed')
            );
        });

        test('should handle error in updateEngagementStatus', async () => {
            const dueMessages = [
                { id: 'engagement-1', session_id: 'session-123', status: 'pending' }
            ];
            
            mockDAL.query.mockResolvedValue(dueMessages);
            jest.spyOn(schedulingService, 'deliverScheduledMessage')
                .mockRejectedValue(new Error('Delivery failed'));
            jest.spyOn(schedulingService, 'updateEngagementStatus')
                .mockRejectedValue(new Error('Update failed'));
            
            await schedulingService.checkScheduledMessages();
            
            expect(mockDeps.logger.error).toHaveBeenCalledWith(
                'Failed to update engagement status',
                'SchedulingService',
                expect.objectContaining({ error: 'Update failed' })
            );
        });

        test('should wrap errors with errorHandler in deliverScheduledMessage', async () => {
            const engagement = { id: 'engagement-1' };
            const error = new Error('Delivery error');
            const wrappedError = new Error('Failed to deliver scheduled message');
            
            mockDeps.messageDelivery.deliverMessage.mockRejectedValue(error);
            mockDeps.errorHandler.wrapDomainError.mockReturnValue(wrappedError);
            
            await expect(
                schedulingService.deliverScheduledMessage(engagement)
            ).rejects.toThrow('Failed to deliver scheduled message');
        });

        test('should wrap errors with errorHandler in updateEngagementStatus', async () => {
            const error = new Error('Database error');
            const wrappedError = new Error('Failed to update engagement status');
            
            mockDAL.execute.mockRejectedValue(error);
            mockDeps.errorHandler.wrapInfrastructureError.mockReturnValue(wrappedError);
            
            await expect(
                schedulingService.updateEngagementStatus('engagement-1', 'delivered')
            ).rejects.toThrow('Failed to update engagement status');
        });
    });

    describe('Health Check', () => {
        test('should report healthy when polling is active', async () => {
            await schedulingService.startPolling();
            schedulingService.initialized = true;
            
            const healthy = await schedulingService.isHealthy();
            
            expect(healthy).toBe(true);
        });

        test('should report unhealthy when polling is not active', async () => {
            schedulingService.initialized = true;
            
            const healthy = await schedulingService.isHealthy();
            
            expect(healthy).toBe(false);
        });

        test('should report unhealthy when not initialized', async () => {
            await schedulingService.startPolling();
            schedulingService.initialized = false;
            
            const healthy = await schedulingService.isHealthy();
            
            expect(healthy).toBe(false);
        });

        test('should provide polling status', () => {
            schedulingService.isPolling = true;
            schedulingService.initialized = true;
            
            const status = schedulingService.getPollingStatus();
            
            expect(status).toEqual({
                isPolling: true,
                pollingFrequency: 30000,
                initialized: true
            });
        });
    });
});

