/**
 * Unit Tests for CORE_LLMConfigService
 * 
 * CLEAN ARCHITECTURE TESTING:
 * - Test service creation and inheritance
 * - Test LLM configuration cascade logic
 * - Test user and character preferences
 * - Test model discovery and connection testing
 * - Mock external dependencies for isolated testing
 */

const CORE_LLMConfigService = require('../../backend/services/infrastructure/CORE_LLMConfigService');

describe('CORE_LLMConfigService', () => {
    let llmConfigService;
    let mockDeps;
    let mockFetch;

    beforeEach(() => {
        mockDeps = createMockDependencies();
        
        // Add database service mock with DAL
        mockDeps.database = {
            users: {
                findById: jest.fn(),
                updateLLMPreferences: jest.fn()
            },
            characters: {
                findById: jest.fn(),
                updateLLMPreferences: jest.fn()
            },
            configuration: {
                get: jest.fn(),
                set: jest.fn()
            }
        };
        
        // Add configuration mock
        mockDeps.configuration = {
            get: jest.fn().mockReturnValue('http://localhost:11434')
        };
        
        // Mock global fetch
        mockFetch = jest.fn();
        global.fetch = mockFetch;
        
        llmConfigService = new CORE_LLMConfigService(mockDeps);
    });

    afterEach(() => {
        delete global.fetch;
    });

    describe('Architecture Compliance', () => {
        test('should extend AbstractService', () => {
            expect(llmConfigService.constructor.name).toBe('CORE_LLMConfigService');
            expect(llmConfigService.logger).toBeDefined();
            expect(llmConfigService.errorHandler).toBeDefined();
        });

        test('should have DAL access', () => {
            expect(llmConfigService.dal).toBeDefined();
            expect(llmConfigService.dal.users).toBeDefined();
            expect(llmConfigService.dal.characters).toBeDefined();
            expect(llmConfigService.dal.configuration).toBeDefined();
        });

        test('should have configuration access', () => {
            expect(llmConfigService.config).toBeDefined();
            expect(typeof llmConfigService.config.get).toBe('function');
        });

        test('should implement required service interface', () => {
            const requiredMethods = ['initialize', 'shutdown', 'checkHealth'];
            requiredMethods.forEach(method => {
                expect(typeof llmConfigService[method]).toBe('function');
            });
        });

        test('should implement LLM config-specific methods', () => {
            const llmConfigMethods = [
                'resolveModelConfig',
                'getUserLLMPreferences',
                'setUserLLMPreferences',
                'getCharacterLLMPreferences',
                'setCharacterLLMPreferences',
                'getGlobalLLMConfig',
                'setGlobalLLMConfig',
                'getAvailableModels',
                'testConnection'
            ];
            llmConfigMethods.forEach(method => {
                expect(typeof llmConfigService[method]).toBe('function');
            });
        });
    });

    describe('Service Lifecycle', () => {
        test('should initialize successfully', async () => {
            await expect(llmConfigService.initialize()).resolves.not.toThrow();
            expect(mockDeps.logger.info).toHaveBeenCalledWith(
                'CORE_LLMConfigService initialized',
                'CORE_LLMConfigService'
            );
        });

        test('should provide health status', async () => {
            const health = await llmConfigService.checkHealth();
            expect(health).toBeDefined();
            expect(typeof health.healthy).toBe('boolean');
        });

        test('should shutdown gracefully', async () => {
            await expect(llmConfigService.shutdown()).resolves.not.toThrow();
        });
    });

    describe('Config Resolution Cascade - Conversational', () => {
        test('should resolve from character preferences first', async () => {
            const characterPrefs = { conversational: { model: 'character-model' } };
            mockDeps.database.characters.findById.mockResolvedValue({
                id: 1,
                llm_preferences: characterPrefs
            });

            const result = await llmConfigService.resolveModelConfig(1, 1, 'conversational');
            
            expect(result).toEqual({ model: 'character-model' });
            expect(mockDeps.database.characters.findById).toHaveBeenCalledWith(1);
            expect(mockDeps.logger.debug).toHaveBeenCalledWith(
                'Resolved conversational model from character preferences',
                'CORE_LLMConfigService',
                { userId: 1, characterId: 1 }
            );
        });

        test('should fall back to user preferences if character not set', async () => {
            mockDeps.database.characters.findById.mockResolvedValue({
                id: 1,
                llm_preferences: null
            });
            mockDeps.database.users.findById.mockResolvedValue({
                id: 1,
                llm_preferences: { conversational: { model: 'user-model' } }
            });

            const result = await llmConfigService.resolveModelConfig(1, 1, 'conversational');
            
            expect(result).toEqual({ model: 'user-model' });
            expect(mockDeps.database.users.findById).toHaveBeenCalledWith(1);
            expect(mockDeps.logger.debug).toHaveBeenCalledWith(
                'Resolved conversational model from user preferences',
                'CORE_LLMConfigService',
                { userId: 1 }
            );
        });

        test('should fall back to global config if user not set', async () => {
            mockDeps.database.characters.findById.mockResolvedValue({
                id: 1,
                llm_preferences: null
            });
            mockDeps.database.users.findById.mockResolvedValue({
                id: 1,
                llm_preferences: null
            });
            mockDeps.database.configuration.get.mockResolvedValue({
                value: { model: 'global-conversational-model' }
            });

            const result = await llmConfigService.resolveModelConfig(1, 1, 'conversational');
            
            expect(result).toEqual({ model: 'global-conversational-model' });
            expect(mockDeps.database.configuration.get).toHaveBeenCalledWith('llm_conversational_model');
            expect(mockDeps.logger.debug).toHaveBeenCalledWith(
                'Resolved conversational model from global config',
                'CORE_LLMConfigService',
                { userId: 1 }
            );
        });

        test('should handle character without characterId', async () => {
            mockDeps.database.users.findById.mockResolvedValue({
                id: 1,
                llm_preferences: { conversational: { model: 'user-model' } }
            });

            const result = await llmConfigService.resolveModelConfig(1, null, 'conversational');
            
            expect(result).toEqual({ model: 'user-model' });
            expect(mockDeps.database.characters.findById).not.toHaveBeenCalled();
        });
    });

    describe('Config Resolution Cascade - Analytical', () => {
        test('should skip character level and use user preferences', async () => {
            mockDeps.database.users.findById.mockResolvedValue({
                id: 1,
                llm_preferences: { analytical: { model: 'user-analytical-model' } }
            });

            const result = await llmConfigService.resolveModelConfig(1, 1, 'analytical');
            
            expect(result).toEqual({ model: 'user-analytical-model' });
            expect(mockDeps.database.characters.findById).not.toHaveBeenCalled();
            expect(mockDeps.database.users.findById).toHaveBeenCalledWith(1);
            expect(mockDeps.logger.debug).toHaveBeenCalledWith(
                'Resolved analytical model from user preferences',
                'CORE_LLMConfigService',
                { userId: 1 }
            );
        });

        test('should fall back to global config if user not set', async () => {
            mockDeps.database.users.findById.mockResolvedValue({
                id: 1,
                llm_preferences: null
            });
            mockDeps.database.configuration.get.mockResolvedValue({
                value: { model: 'global-analytical-model' }
            });

            const result = await llmConfigService.resolveModelConfig(1, 1, 'analytical');
            
            expect(result).toEqual({ model: 'global-analytical-model' });
            expect(mockDeps.database.configuration.get).toHaveBeenCalledWith('llm_analytical_model');
            expect(mockDeps.logger.debug).toHaveBeenCalledWith(
                'Resolved analytical model from global config',
                'CORE_LLMConfigService',
                { userId: 1 }
            );
        });

        test('should never check character preferences for analytical role', async () => {
            mockDeps.database.characters.findById.mockResolvedValue({
                id: 1,
                llm_preferences: { analytical: { model: 'character-analytical-model' } }
            });
            mockDeps.database.users.findById.mockResolvedValue({
                id: 1,
                llm_preferences: { analytical: { model: 'user-analytical-model' } }
            });

            const result = await llmConfigService.resolveModelConfig(1, 1, 'analytical');
            
            expect(result).toEqual({ model: 'user-analytical-model' });
            expect(mockDeps.database.characters.findById).not.toHaveBeenCalled();
        });
    });

    describe('Role Validation', () => {
        test('should reject invalid role', async () => {
            await expect(
                llmConfigService.resolveModelConfig(1, 1, 'invalid')
            ).rejects.toThrow('Failed to resolve model config');
        });

        test('should accept conversational role', async () => {
            mockDeps.database.users.findById.mockResolvedValue({
                id: 1,
                llm_preferences: { conversational: { model: 'model' } }
            });

            await expect(
                llmConfigService.resolveModelConfig(1, null, 'conversational')
            ).resolves.toBeDefined();
        });

        test('should accept analytical role', async () => {
            mockDeps.database.users.findById.mockResolvedValue({
                id: 1,
                llm_preferences: { analytical: { model: 'model' } }
            });

            await expect(
                llmConfigService.resolveModelConfig(1, null, 'analytical')
            ).resolves.toBeDefined();
        });
    });

    describe('User Preferences Management', () => {
        test('should get user LLM preferences', async () => {
            const preferences = { conversational: { model: 'test-model' } };
            mockDeps.database.users.findById.mockResolvedValue({
                id: 1,
                llm_preferences: preferences
            });

            const result = await llmConfigService.getUserLLMPreferences(1);
            
            expect(result).toEqual(preferences);
            expect(mockDeps.database.users.findById).toHaveBeenCalledWith(1);
        });

        test('should parse JSON string preferences', async () => {
            const preferences = { conversational: { model: 'test-model' } };
            mockDeps.database.users.findById.mockResolvedValue({
                id: 1,
                llm_preferences: JSON.stringify(preferences)
            });

            const result = await llmConfigService.getUserLLMPreferences(1);
            
            expect(result).toEqual(preferences);
        });

        test('should return null if user not found', async () => {
            mockDeps.database.users.findById.mockResolvedValue(null);

            const result = await llmConfigService.getUserLLMPreferences(1);
            
            expect(result).toBeNull();
            expect(mockDeps.logger.warn).toHaveBeenCalledWith(
                'User not found when fetching LLM preferences',
                'CORE_LLMConfigService',
                { userId: 1 }
            );
        });

        test('should set user LLM preferences', async () => {
            const preferences = { conversational: { model: 'new-model' } };
            mockDeps.database.users.updateLLMPreferences.mockResolvedValue({ changes: 1 });

            await llmConfigService.setUserLLMPreferences(1, preferences);
            
            expect(mockDeps.database.users.updateLLMPreferences).toHaveBeenCalledWith(1, preferences);
            expect(mockDeps.logger.info).toHaveBeenCalledWith(
                'Updated user LLM preferences',
                'CORE_LLMConfigService',
                { userId: 1 }
            );
        });

        test('should wrap errors when setting user preferences', async () => {
            mockDeps.database.users.updateLLMPreferences.mockRejectedValue(new Error('DB error'));

            await expect(
                llmConfigService.setUserLLMPreferences(1, {})
            ).rejects.toThrow('Failed to set user LLM preferences');
        });
    });

    describe('Character Preferences Management', () => {
        test('should get character LLM preferences', async () => {
            const preferences = { conversational: { model: 'character-model' } };
            mockDeps.database.characters.findById.mockResolvedValue({
                id: 1,
                llm_preferences: preferences
            });

            const result = await llmConfigService.getCharacterLLMPreferences(1);
            
            expect(result).toEqual(preferences);
            expect(mockDeps.database.characters.findById).toHaveBeenCalledWith(1);
        });

        test('should parse JSON string preferences', async () => {
            const preferences = { conversational: { model: 'character-model' } };
            mockDeps.database.characters.findById.mockResolvedValue({
                id: 1,
                llm_preferences: JSON.stringify(preferences)
            });

            const result = await llmConfigService.getCharacterLLMPreferences(1);
            
            expect(result).toEqual(preferences);
        });

        test('should return null if character not found', async () => {
            mockDeps.database.characters.findById.mockResolvedValue(null);

            const result = await llmConfigService.getCharacterLLMPreferences(1);
            
            expect(result).toBeNull();
            expect(mockDeps.logger.warn).toHaveBeenCalledWith(
                'Character not found when fetching LLM preferences',
                'CORE_LLMConfigService',
                { characterId: 1 }
            );
        });

        test('should set character LLM preferences', async () => {
            const preferences = { conversational: { model: 'new-character-model' } };
            mockDeps.database.characters.updateLLMPreferences.mockResolvedValue({ changes: 1 });

            await llmConfigService.setCharacterLLMPreferences(1, preferences);
            
            expect(mockDeps.database.characters.updateLLMPreferences).toHaveBeenCalledWith(1, preferences);
            expect(mockDeps.logger.info).toHaveBeenCalledWith(
                'Updated character LLM preferences',
                'CORE_LLMConfigService',
                { characterId: 1 }
            );
        });

        test('should wrap errors when setting character preferences', async () => {
            mockDeps.database.characters.updateLLMPreferences.mockRejectedValue(new Error('DB error'));

            await expect(
                llmConfigService.setCharacterLLMPreferences(1, {})
            ).rejects.toThrow('Failed to set character LLM preferences');
        });
    });

    describe('Global Configuration Management', () => {
        test('should get global conversational config', async () => {
            const config = { model: 'global-conversational-model' };
            mockDeps.database.configuration.get.mockResolvedValue({
                value: config
            });

            const result = await llmConfigService.getGlobalLLMConfig('conversational');
            
            expect(result).toEqual(config);
            expect(mockDeps.database.configuration.get).toHaveBeenCalledWith('llm_conversational_model');
        });

        test('should get global analytical config', async () => {
            const config = { model: 'global-analytical-model' };
            mockDeps.database.configuration.get.mockResolvedValue({
                value: config
            });

            const result = await llmConfigService.getGlobalLLMConfig('analytical');
            
            expect(result).toEqual(config);
            expect(mockDeps.database.configuration.get).toHaveBeenCalledWith('llm_analytical_model');
        });

        test('should parse JSON string config values', async () => {
            const config = { model: 'global-model' };
            mockDeps.database.configuration.get.mockResolvedValue({
                value: JSON.stringify(config)
            });

            const result = await llmConfigService.getGlobalLLMConfig('conversational');
            
            expect(result).toEqual(config);
        });

        test('should return null if config not found', async () => {
            mockDeps.database.configuration.get.mockResolvedValue(null);

            const result = await llmConfigService.getGlobalLLMConfig('conversational');
            
            expect(result).toBeNull();
            expect(mockDeps.logger.warn).toHaveBeenCalledWith(
                'Global LLM config not found',
                'CORE_LLMConfigService',
                { role: 'conversational', configKey: 'llm_conversational_model' }
            );
        });

        test('should set global LLM config', async () => {
            const value = { model: 'new-global-model' };
            mockDeps.database.configuration.set.mockResolvedValue({ changes: 1 });

            await llmConfigService.setGlobalLLMConfig('llm_conversational_model', value);
            
            expect(mockDeps.database.configuration.set).toHaveBeenCalledWith('llm_conversational_model', value);
            expect(mockDeps.logger.info).toHaveBeenCalledWith(
                'Updated global LLM config',
                'CORE_LLMConfigService',
                { key: 'llm_conversational_model' }
            );
        });
    });

    describe('Model Discovery', () => {
        test('should fetch available models from LLM server', async () => {
            const mockModels = {
                data: [
                    { id: 'model-1' },
                    { id: 'model-2' },
                    { id: 'model-3' }
                ]
            };
            mockFetch.mockResolvedValue({
                ok: true,
                json: async () => mockModels
            });

            const result = await llmConfigService.getAvailableModels();
            
            expect(result).toEqual([
                { id: 'model-1', name: 'model-1' },
                { id: 'model-2', name: 'model-2' },
                { id: 'model-3', name: 'model-3' }
            ]);
            expect(mockFetch).toHaveBeenCalledWith('http://localhost:11434/v1/models');
            expect(mockDeps.logger.info).toHaveBeenCalledWith(
                'Fetched available models from LLM server',
                'CORE_LLMConfigService',
                { count: 3 }
            );
        });

        test('should handle empty models list', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                json: async () => ({ data: [] })
            });

            const result = await llmConfigService.getAvailableModels();
            
            expect(result).toEqual([]);
        });

        test('should handle response without data field', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                json: async () => ({})
            });

            const result = await llmConfigService.getAvailableModels();
            
            expect(result).toEqual([]);
        });

        test('should throw error if LLM URL not configured', async () => {
            mockDeps.configuration.get.mockReturnValue(null);

            await expect(
                llmConfigService.getAvailableModels()
            ).rejects.toThrow('Failed to get available models');
        });

        test('should throw error on failed fetch', async () => {
            mockFetch.mockResolvedValue({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error'
            });

            await expect(
                llmConfigService.getAvailableModels()
            ).rejects.toThrow('Failed to get available models');
        });
    });

    describe('Caching Behavior', () => {
        test('should cache available models for 5 minutes', async () => {
            const mockModels = {
                data: [{ id: 'model-1' }]
            };
            mockFetch.mockResolvedValue({
                ok: true,
                json: async () => mockModels
            });

            // First call - should fetch from server
            const result1 = await llmConfigService.getAvailableModels();
            expect(mockFetch).toHaveBeenCalledTimes(1);
            expect(result1).toEqual([{ id: 'model-1', name: 'model-1' }]);

            // Second call - should use cache
            const result2 = await llmConfigService.getAvailableModels();
            expect(mockFetch).toHaveBeenCalledTimes(1); // Still 1, not called again
            expect(result2).toEqual([{ id: 'model-1', name: 'model-1' }]);
            expect(mockDeps.logger.debug).toHaveBeenCalledWith(
                'Returning cached available models',
                'CORE_LLMConfigService',
                { count: 1 }
            );
        });

        test('should refresh cache after 5 minutes', async () => {
            const mockModels1 = { data: [{ id: 'model-1' }] };
            const mockModels2 = { data: [{ id: 'model-2' }] };
            
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockModels1
            });

            // First call
            const result1 = await llmConfigService.getAvailableModels();
            expect(result1).toEqual([{ id: 'model-1', name: 'model-1' }]);
            expect(mockFetch).toHaveBeenCalledTimes(1);

            // Simulate 5 minutes passing
            const originalTimestamp = llmConfigService.modelsCacheTimestamp;
            llmConfigService.modelsCacheTimestamp = originalTimestamp - (5 * 60 * 1000 + 1);

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockModels2
            });

            // Second call - should refresh cache
            const result2 = await llmConfigService.getAvailableModels();
            expect(result2).toEqual([{ id: 'model-2', name: 'model-2' }]);
            expect(mockFetch).toHaveBeenCalledTimes(2);
        });

        test('should use cache when within 5 minutes', async () => {
            const mockModels = { data: [{ id: 'model-1' }] };
            mockFetch.mockResolvedValue({
                ok: true,
                json: async () => mockModels
            });

            // First call
            await llmConfigService.getAvailableModels();
            expect(mockFetch).toHaveBeenCalledTimes(1);

            // Simulate 4 minutes passing (within cache duration)
            llmConfigService.modelsCacheTimestamp = Date.now() - (4 * 60 * 1000);

            // Second call - should still use cache
            await llmConfigService.getAvailableModels();
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });
    });

    describe('Connection Testing', () => {
        test('should successfully test LLM server connection', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                statusText: 'OK'
            });

            const result = await llmConfigService.testConnection();
            
            expect(result).toEqual({
                success: true,
                status: 200,
                statusText: 'OK',
                url: 'http://localhost:11434'
            });
            expect(mockFetch).toHaveBeenCalledWith(
                'http://localhost:11434/v1/models',
                {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' }
                }
            );
            expect(mockDeps.logger.info).toHaveBeenCalledWith(
                'LLM server connection test successful',
                'CORE_LLMConfigService',
                { url: 'http://localhost:11434' }
            );
        });

        test('should handle failed connection', async () => {
            mockFetch.mockResolvedValue({
                ok: false,
                status: 503,
                statusText: 'Service Unavailable'
            });

            const result = await llmConfigService.testConnection();
            
            expect(result).toEqual({
                success: false,
                status: 503,
                statusText: 'Service Unavailable',
                url: 'http://localhost:11434'
            });
            expect(mockDeps.logger.warn).toHaveBeenCalledWith(
                'LLM server connection test failed',
                'CORE_LLMConfigService',
                {
                    url: 'http://localhost:11434',
                    status: 503,
                    statusText: 'Service Unavailable'
                }
            );
        });

        test('should throw error if LLM URL not configured', async () => {
            mockDeps.configuration.get.mockReturnValue(null);

            await expect(
                llmConfigService.testConnection()
            ).rejects.toThrow('Failed to test LLM connection');
        });

        test('should handle network errors', async () => {
            mockFetch.mockRejectedValue(new Error('Network error'));

            await expect(
                llmConfigService.testConnection()
            ).rejects.toThrow('Failed to test LLM connection');
            
            expect(mockDeps.logger.error).toHaveBeenCalledWith(
                'LLM server connection test error',
                'CORE_LLMConfigService',
                { error: 'Network error' }
            );
        });
    });

    describe('Error Handling', () => {
        test('should wrap errors in resolveModelConfig', async () => {
            mockDeps.database.users.findById.mockRejectedValue(new Error('DB error'));

            await expect(
                llmConfigService.resolveModelConfig(1, null, 'conversational')
            ).rejects.toThrow('Failed to resolve model config');
            
            expect(mockDeps.errorHandling.wrapDomainError).toHaveBeenCalled();
        });

        test('should wrap errors in getUserLLMPreferences', async () => {
            mockDeps.database.users.findById.mockRejectedValue(new Error('DB error'));

            await expect(
                llmConfigService.getUserLLMPreferences(1)
            ).rejects.toThrow('Failed to get user LLM preferences');
        });

        test('should wrap errors in getCharacterLLMPreferences', async () => {
            mockDeps.database.characters.findById.mockRejectedValue(new Error('DB error'));

            await expect(
                llmConfigService.getCharacterLLMPreferences(1)
            ).rejects.toThrow('Failed to get character LLM preferences');
        });

        test('should wrap errors in getGlobalLLMConfig', async () => {
            mockDeps.database.configuration.get.mockRejectedValue(new Error('DB error'));

            await expect(
                llmConfigService.getGlobalLLMConfig('conversational')
            ).rejects.toThrow('Failed to get global LLM config');
        });

        test('should wrap errors in setGlobalLLMConfig', async () => {
            mockDeps.database.configuration.set.mockRejectedValue(new Error('DB error'));

            await expect(
                llmConfigService.setGlobalLLMConfig('key', 'value')
            ).rejects.toThrow('Failed to set global LLM config');
        });

        test('should wrap errors in getAvailableModels', async () => {
            mockFetch.mockRejectedValue(new Error('Network error'));

            await expect(
                llmConfigService.getAvailableModels()
            ).rejects.toThrow('Failed to get available models');
        });
    });
});

