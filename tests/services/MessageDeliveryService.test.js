/**
 * Unit Tests for MessageDeliveryService
 * 
 * CLEAN ARCHITECTURE TESTING:
 * - Test service creation and inheritance
 * - Test WebSocket connection management
 * - Test message delivery mechanisms
 * - Mock external dependencies for isolated testing
 */

const MessageDeliveryService = require('../../backend/services/infrastructure/CORE_MessageDeliveryService');

describe('MessageDeliveryService', () => {
    let messageDeliveryService;
    let mockDeps;
    let mockDAL;
    let mockWebSocket;

    beforeEach(() => {
        mockDeps = createMockDependencies();
        
        // Create mock DAL
        mockDAL = {
            execute: jest.fn().mockResolvedValue({ lastID: 1, changes: 1 })
        };
        
        // Add database service mock with getDAL method
        mockDeps.database = {
            getDAL: jest.fn().mockReturnValue(mockDAL)
        };

        // Add LLM service mock
        mockDeps.llm = {
            generateResponse: jest.fn().mockResolvedValue({
                content: 'Generated proactive message'
            })
        };

        // Create mock WebSocket
        mockWebSocket = {
            send: jest.fn(),
            readyState: 1, // 1 = OPEN
            close: jest.fn(),
            on: jest.fn()
        };
        
        messageDeliveryService = new MessageDeliveryService(mockDeps);
    });

    describe('Architecture Compliance', () => {
        test('should extend AbstractService', () => {
            expect(messageDeliveryService.constructor.name).toBe('MessageDeliveryService');
            expect(messageDeliveryService.name).toBe('MessageDeliveryService');
            expect(messageDeliveryService.logger).toBeDefined();
            expect(messageDeliveryService.errorHandler).toBeDefined();
        });

        test('should have proper dependencies injected', () => {
            expect(messageDeliveryService.dal).toBeDefined();
            expect(messageDeliveryService.logger).toBeDefined();
            expect(messageDeliveryService.errorHandler).toBeDefined();
        });

        test('should initialize with empty connections map', () => {
            expect(messageDeliveryService.connections).toBeDefined();
            expect(messageDeliveryService.connections instanceof Map).toBe(true);
            expect(messageDeliveryService.connections.size).toBe(0);
        });

        test('should implement required service interface', () => {
            const requiredMethods = ['initialize', 'shutdown', 'checkHealth'];
            requiredMethods.forEach(method => {
                expect(typeof messageDeliveryService[method]).toBe('function');
            });
        });

        test('should implement message delivery methods', () => {
            const deliveryMethods = [
                'registerConnection',
                'unregisterConnection',
                'deliverScheduledMessage',
                'deliverMessageToUser',
                'isUserConnected',
                'getConnectionCount'
            ];
            deliveryMethods.forEach(method => {
                expect(typeof messageDeliveryService[method]).toBe('function');
            });
        });
    });

    describe('Connection Management', () => {
        test('should register user connection', async () => {
            await messageDeliveryService.registerConnection('user-123', mockWebSocket);
            
            expect(messageDeliveryService.connections.has('user-123')).toBe(true);
            expect(messageDeliveryService.connections.get('user-123')).toBe(mockWebSocket);
            expect(mockDeps.logger.info).toHaveBeenCalledWith(
                'User connection registered',
                'MessageDeliveryService',
                expect.objectContaining({ userId: 'user-123' })
            );
        });

        test('should set up disconnect handler on registration', async () => {
            await messageDeliveryService.registerConnection('user-123', mockWebSocket);
            
            expect(mockWebSocket.on).toHaveBeenCalledWith('close', expect.any(Function));
        });

        test('should replace existing connection for same user', async () => {
            const oldWebSocket = {
                send: jest.fn(),
                readyState: 1,
                close: jest.fn(),
                on: jest.fn()
            };
            
            await messageDeliveryService.registerConnection('user-123', oldWebSocket);
            await messageDeliveryService.registerConnection('user-123', mockWebSocket);
            
            expect(oldWebSocket.close).toHaveBeenCalled();
            expect(messageDeliveryService.connections.get('user-123')).toBe(mockWebSocket);
        });

        test('should unregister user connection', async () => {
            await messageDeliveryService.registerConnection('user-123', mockWebSocket);
            expect(messageDeliveryService.connections.has('user-123')).toBe(true);
            
            await messageDeliveryService.unregisterConnection('user-123');
            
            expect(messageDeliveryService.connections.has('user-123')).toBe(false);
            expect(mockDeps.logger.info).toHaveBeenCalledWith(
                'User connection unregistered',
                'MessageDeliveryService',
                expect.objectContaining({ userId: 'user-123' })
            );
        });

        test('should handle unregister for non-existent connection', async () => {
            await messageDeliveryService.unregisterConnection('non-existent-user');
            
            // Should not throw error and should not log unregistration
            expect(messageDeliveryService.connections.has('non-existent-user')).toBe(false);
        });

        test('should handle multiple user connections', async () => {
            const ws1 = { ...mockWebSocket };
            const ws2 = { ...mockWebSocket };
            const ws3 = { ...mockWebSocket };
            
            await messageDeliveryService.registerConnection('user-1', ws1);
            await messageDeliveryService.registerConnection('user-2', ws2);
            await messageDeliveryService.registerConnection('user-3', ws3);
            
            expect(messageDeliveryService.connections.size).toBe(3);
            expect(messageDeliveryService.connections.has('user-1')).toBe(true);
            expect(messageDeliveryService.connections.has('user-2')).toBe(true);
            expect(messageDeliveryService.connections.has('user-3')).toBe(true);
        });
    });

    describe('Message Delivery', () => {
        test('should deliver message to connected user', async () => {
            await messageDeliveryService.registerConnection('user-123', mockWebSocket);
            
            const message = {
                id: 'msg-1',
                type: 'proactive',
                content: 'Test message',
                timestamp: new Date().toISOString()
            };
            
            const result = await messageDeliveryService.deliverMessageToUser('user-123', message);
            
            expect(result).toBe(true);
            expect(mockWebSocket.send).toHaveBeenCalledWith(JSON.stringify(message));
            expect(mockDeps.logger.debug).toHaveBeenCalledWith(
                'Message delivered to user',
                'MessageDeliveryService',
                expect.objectContaining({ userId: 'user-123' })
            );
        });

        test('should fail to deliver to disconnected user', async () => {
            const result = await messageDeliveryService.deliverMessageToUser('user-123', {
                type: 'proactive',
                content: 'Test'
            });
            
            expect(result).toBe(false);
            expect(mockWebSocket.send).not.toHaveBeenCalled();
            expect(mockDeps.logger.warn).toHaveBeenCalledWith(
                'Cannot deliver message - user not connected',
                'MessageDeliveryService',
                expect.objectContaining({ userId: 'user-123' })
            );
        });

        test('should fail to deliver if WebSocket not open', async () => {
            const closedWebSocket = { ...mockWebSocket, readyState: 3 }; // 3 = CLOSED
            await messageDeliveryService.registerConnection('user-123', closedWebSocket);
            
            const result = await messageDeliveryService.deliverMessageToUser('user-123', {
                type: 'proactive',
                content: 'Test'
            });
            
            expect(result).toBe(false);
        });

        test('should deliver scheduled message to online user', async () => {
            await messageDeliveryService.registerConnection('user-123', mockWebSocket);
            
            const engagement = {
                id: 'engagement-1',
                user_id: 'user-123',
                session_id: 'session-1',
                engagement_content: 'Proactive message content',
                trigger_context: 'Test context'
            };
            
            jest.spyOn(messageDeliveryService, 'saveProactiveMessage').mockResolvedValue('msg-1');
            
            const result = await messageDeliveryService.deliverScheduledMessage(engagement);
            
            expect(result.delivered).toBe(true);
            expect(result.messageId).toBe('msg-1');
            expect(mockWebSocket.send).toHaveBeenCalled();
        });

        test('should save proactive message to database', async () => {
            await messageDeliveryService.registerConnection('user-123', mockWebSocket);
            
            const engagement = {
                id: 'engagement-1',
                user_id: 'user-123',
                session_id: 'session-1',
                chat_id: 'chat-1',
                engagement_content: 'Test message'
            };
            
            await messageDeliveryService.saveProactiveMessage(engagement, 'Test message');
            
            expect(mockDAL.execute).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO conversation_logs'),
                expect.arrayContaining([
                    expect.any(String), // messageId
                    'user-123',
                    'chat-1',
                    'session-1',
                    'Test message',
                    'assistant',
                    1, // is_proactive
                    'engagement-1'
                ])
            );
        });
    });

    describe('Offline Handling', () => {
        test('should return not delivered when user is offline', async () => {
            const engagement = {
                id: 'engagement-1',
                user_id: 'offline-user',
                session_id: 'session-1',
                engagement_content: 'Test message'
            };
            
            const result = await messageDeliveryService.deliverScheduledMessage(engagement);
            
            expect(result.delivered).toBe(false);
            expect(result.reason).toBe('user_offline');
            expect(mockDeps.logger.info).toHaveBeenCalledWith(
                'User offline, message will remain pending',
                'MessageDeliveryService',
                expect.objectContaining({ userId: 'offline-user' })
            );
        });

        test('should not save message to database when user offline', async () => {
            const engagement = {
                id: 'engagement-1',
                user_id: 'offline-user',
                session_id: 'session-1',
                engagement_content: 'Test message'
            };
            
            await messageDeliveryService.deliverScheduledMessage(engagement);
            
            expect(mockDAL.execute).not.toHaveBeenCalled();
        });

        test('should not send WebSocket message when user offline', async () => {
            const engagement = {
                id: 'engagement-1',
                user_id: 'offline-user',
                session_id: 'session-1',
                engagement_content: 'Test message'
            };
            
            await messageDeliveryService.deliverScheduledMessage(engagement);
            
            expect(mockWebSocket.send).not.toHaveBeenCalled();
        });
    });

    describe('Error Handling', () => {
        test('should handle WebSocket send error gracefully', async () => {
            mockWebSocket.send.mockImplementation(() => {
                throw new Error('WebSocket send failed');
            });
            
            await messageDeliveryService.registerConnection('user-123', mockWebSocket);
            
            const result = await messageDeliveryService.deliverMessageToUser('user-123', {
                type: 'test',
                content: 'Test'
            });
            
            expect(result).toBe(false);
            expect(mockDeps.logger.error).toHaveBeenCalledWith(
                'Failed to deliver message to user',
                'MessageDeliveryService',
                expect.objectContaining({ error: 'WebSocket send failed' })
            );
        });

        test('should handle registration error', async () => {
            const brokenWebSocket = null;
            
            await expect(
                messageDeliveryService.registerConnection('user-123', brokenWebSocket)
            ).rejects.toThrow();
        });

        test('should handle unregister error gracefully', async () => {
            // Register user first
            await messageDeliveryService.registerConnection('user-123', mockWebSocket);
            
            // Force an error by mocking connections.has to throw
            const originalHas = messageDeliveryService.connections.has;
            messageDeliveryService.connections.has = jest.fn(() => {
                throw new Error('Delete failed');
            });
            
            // Should not throw - error is caught
            await messageDeliveryService.unregisterConnection('user-123');
            
            expect(mockDeps.logger.error).toHaveBeenCalledWith(
                'Error unregistering connection',
                'MessageDeliveryService',
                expect.objectContaining({ error: 'Delete failed' })
            );
            
            // Restore
            messageDeliveryService.connections.has = originalHas;
        });

        test('should handle database error when saving message', async () => {
            mockDAL.execute.mockRejectedValue(new Error('Database error'));
            
            const engagement = {
                id: 'engagement-1',
                user_id: 'user-123',
                session_id: 'session-1',
                engagement_content: 'Test'
            };
            
            await expect(
                messageDeliveryService.saveProactiveMessage(engagement, 'Test message')
            ).rejects.toThrow();
        });

        test('should use fallback if LLM generation fails', async () => {
            await messageDeliveryService.registerConnection('user-123', mockWebSocket);
            
            mockDeps.llm.generateResponse.mockRejectedValue(new Error('LLM error'));
            
            const engagement = {
                id: 'engagement-1',
                user_id: 'user-123',
                session_id: 'session-1',
                trigger_context: 'Fallback message'
            };
            
            jest.spyOn(messageDeliveryService, 'saveProactiveMessage').mockResolvedValue('msg-1');
            
            await messageDeliveryService.deliverScheduledMessage(engagement);
            
            expect(mockDeps.logger.error).toHaveBeenCalledWith(
                'Error generating proactive message',
                'MessageDeliveryService',
                expect.objectContaining({ error: 'LLM error' })
            );
        });
    });

    describe('Connection Status', () => {
        test('should correctly report user as connected', async () => {
            await messageDeliveryService.registerConnection('user-123', mockWebSocket);
            
            const isConnected = await messageDeliveryService.isUserConnected('user-123');
            
            expect(isConnected).toBe(true);
        });

        test('should correctly report user as not connected', async () => {
            const isConnected = await messageDeliveryService.isUserConnected('user-123');
            
            expect(isConnected).toBeFalsy();
        });

        test('should report user as not connected if WebSocket closed', async () => {
            const closedWebSocket = { ...mockWebSocket, readyState: 3 }; // CLOSED
            await messageDeliveryService.registerConnection('user-123', closedWebSocket);
            
            const isConnected = await messageDeliveryService.isUserConnected('user-123');
            
            expect(isConnected).toBe(false);
        });

        test('should get connection count', async () => {
            const ws1 = { ...mockWebSocket };
            const ws2 = { ...mockWebSocket };
            
            await messageDeliveryService.registerConnection('user-1', ws1);
            await messageDeliveryService.registerConnection('user-2', ws2);
            
            const count = await messageDeliveryService.getConnectionCount();
            
            expect(count).toBe(2);
        });

        test('should return zero for empty connections', async () => {
            const count = await messageDeliveryService.getConnectionCount();
            
            expect(count).toBe(0);
        });
    });

    describe('Health Check', () => {
        test('should report healthy when initialized', async () => {
            messageDeliveryService.initialized = true;
            
            const healthy = await messageDeliveryService.isHealthy();
            
            expect(healthy).toBe(true);
        });

        test('should report unhealthy when not initialized', async () => {
            messageDeliveryService.initialized = false;
            
            const healthy = await messageDeliveryService.isHealthy();
            
            expect(healthy).toBe(false);
        });

        test('should provide connection statistics', () => {
            messageDeliveryService.initialized = true;
            messageDeliveryService.connections.set('user-1', mockWebSocket);
            messageDeliveryService.connections.set('user-2', mockWebSocket);
            
            const stats = messageDeliveryService.getConnectionStats();
            
            expect(stats).toEqual({
                totalConnections: 2,
                initialized: true
            });
        });
    });

    describe('Shutdown', () => {
        test('should close all connections on shutdown', async () => {
            const ws1 = { send: jest.fn(), readyState: 1, close: jest.fn(), on: jest.fn() };
            const ws2 = { send: jest.fn(), readyState: 1, close: jest.fn(), on: jest.fn() };
            
            await messageDeliveryService.registerConnection('user-1', ws1);
            await messageDeliveryService.registerConnection('user-2', ws2);
            
            await messageDeliveryService.onShutdown();
            
            expect(ws1.close).toHaveBeenCalledWith(1001, 'Server shutting down');
            expect(ws2.close).toHaveBeenCalledWith(1001, 'Server shutting down');
            expect(messageDeliveryService.connections.size).toBe(0);
        });

        test('should handle errors during shutdown gracefully', async () => {
            const brokenWebSocket = {
                send: jest.fn(),
                readyState: 1,
                close: jest.fn(() => { throw new Error('Close failed'); }),
                on: jest.fn()
            };
            
            await messageDeliveryService.registerConnection('user-1', brokenWebSocket);
            
            await messageDeliveryService.onShutdown();
            
            expect(mockDeps.logger.error).toHaveBeenCalledWith(
                'Error closing connection during shutdown',
                'MessageDeliveryService',
                expect.objectContaining({ error: 'Close failed' })
            );
        });
    });
});

