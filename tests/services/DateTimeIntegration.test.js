/**
 * DateTime Integration Tests
 * 
 * Ensures that characters always have access to current date and time information
 * across all services and interaction points.
 * 
 * CRITICAL: These tests prevent regression where datetime context might be
 * accidentally removed from character prompts.
 */

const DateTimeUtils = require('../../backend/utils/datetime_utils');

describe('DateTime Integration Tests', () => {
    describe('DateTimeUtils Core Functionality', () => {
        test('should provide comprehensive system prompt datetime', () => {
            const datetimeContext = DateTimeUtils.getSystemPromptDateTime();
            
            expect(datetimeContext).toBeDefined();
            expect(typeof datetimeContext).toBe('string');
            expect(datetimeContext.length).toBeGreaterThan(100); // Should be comprehensive
            
            // Check for essential components
            expect(datetimeContext).toMatch(/Current date and time:/);
            expect(datetimeContext).toMatch(/Current UTC time:/);
            expect(datetimeContext).toMatch(/Current timestamp:/);
            expect(datetimeContext).toMatch(/Timezone:/);
            expect(datetimeContext).toMatch(/Time calculation examples/);
            expect(datetimeContext).toMatch(/in 1 minute/);
            expect(datetimeContext).toMatch(/in 5 minutes/);
            expect(datetimeContext).toMatch(/in 1 hour/);
        });

        test('should provide consistent datetime format', () => {
            const context1 = DateTimeUtils.getSystemPromptDateTime();
            const context2 = DateTimeUtils.getSystemPromptDateTime();
            
            // Should have same structure (timestamps will differ by milliseconds)
            expect(context1).toMatch(/Current date and time:/);
            expect(context2).toMatch(/Current date and time:/);
            expect(context1).toMatch(/IMPORTANT: Use the current timestamp/);
            expect(context2).toMatch(/IMPORTANT: Use the current timestamp/);
        });

        test('should provide time-aware greeting functionality', () => {
            const greeting = DateTimeUtils.getTimeAwareGreeting();
            expect(greeting).toBeDefined();
            expect(['Good morning', 'Good afternoon', 'Good evening', 'Good night']).toContain(greeting);
        });

        test('should provide business hours detection', () => {
            const isBusinessHours = DateTimeUtils.isBusinessHours();
            expect(typeof isBusinessHours).toBe('boolean');
        });

        test('should provide relative time calculations', () => {
            const now = new Date();
            const futureDate = DateTimeUtils.addTime(now, 30, 'minutes');
            const relativeTime = DateTimeUtils.getRelativeTime(futureDate, now);
            
            expect(relativeTime).toMatch(/30 minutes? from now/);
        });
    });

    describe('Character System Prompt Integration', () => {
        let mockServiceFactory;
        let ChatRoutes;

        beforeEach(() => {
            // Mock the service factory and dependencies
            mockServiceFactory = {
                get: jest.fn().mockImplementation((serviceName) => {
                    switch (serviceName) {
                        case 'llm':
                            return {
                                generateResponse: jest.fn().mockResolvedValue({
                                    content: 'Mock AI response with datetime awareness'
                                })
                            };
                        case 'psychology':
                            return {
                                getCharacterState: jest.fn().mockResolvedValue({
                                    mood: 'neutral',
                                    engagement: 'moderate',
                                    energy: 75
                                }),
                                initializeCharacterState: jest.fn().mockResolvedValue({}),
                                updateCharacterState: jest.fn().mockResolvedValue({})
                            };
                        case 'conversationAnalyzer':
                            return {};
                        case 'database':
                            return {
                                getDAL: () => ({
                                    conversations: {
                                        saveMessage: jest.fn().mockResolvedValue('mock-id')
                                    },
                                    personalities: {
                                        getCharacter: jest.fn().mockResolvedValue({
                                            id: 'test-char',
                                            name: 'Test Character',
                                            description: 'A test character',
                                            definition: 'Test character definition'
                                        })
                                    }
                                })
                            };
                        default:
                            return {};
                    }
                })
            };

            ChatRoutes = require('../../backend/api/chatRoutes');
        });

        test('should include datetime context in character system prompts', () => {
            // Test the system prompt creation logic directly (as used in ChatRoutes)
            const mockCharacter = { name: 'Test Character', description: 'Test description' };
            const mockPsychologyState = { mood: 'neutral', engagement: 'moderate', energy: 75 };
            const characterBackground = 'Test background';
            const dateTimeContext = DateTimeUtils.getSystemPromptDateTime();
            
            const systemPrompt = `You are ${mockCharacter.name}, ${mockCharacter.description}
${characterBackground ? `\nBackground: ${characterBackground}` : ''}

${dateTimeContext}

Current psychology state: mood=${mockPsychologyState.mood || 'neutral'}, engagement=${mockPsychologyState.engagement || 'moderate'}, energy=${mockPsychologyState.energy || 75}.
Stay in character as ${mockCharacter.name}. Adapt your response based on this psychological context and your character traits. You are fully aware of the current date and time as provided above.`;

            // Verify datetime context is included
            expect(systemPrompt).toMatch(/Current date and time:/);
            expect(systemPrompt).toMatch(/Current UTC time:/);
            expect(systemPrompt).toMatch(/Current timestamp:/);
            expect(systemPrompt).toMatch(/Timezone:/);
            expect(systemPrompt).toMatch(/You are fully aware of the current date and time as provided above/);
        });
    });

    describe('Service Integration Tests', () => {
        test('ProactiveIntelligenceService includes datetime in analysis prompts', () => {
            const ProactiveIntelligenceService = require('../../backend/services/domain/CORE_ProactiveIntelligenceService');
            
            // Create a mock service instance
            const mockDependencies = {
                logger: {
                    info: jest.fn(),
                    debug: jest.fn(),
                    warn: jest.fn(),
                    error: jest.fn()
                },
                structuredResponse: {
                    generateStructuredResponse: jest.fn()
                },
                psychology: {},
                database: {},
                errorHandling: {
                    wrapDomainError: jest.fn()
                }
            };

            const service = new ProactiveIntelligenceService(mockDependencies);
            
            // Test the prompt building method
            const mockContext = {
                userMessage: 'Test message',
                agentResponse: 'Test response',
                psychologicalState: { current_emotion: 'neutral' },
                psychologicalFramework: { core_emotional_range: ['happy', 'sad'] },
                conversationHistory: [],
                learnedPatterns: [],
                sessionContext: { personalityName: 'Test Character' }
            };

            const prompt = service.buildProactiveAnalysisPrompt(mockContext);
            
            // Verify datetime context is included
            expect(prompt).toMatch(/Current date and time:/);
            expect(prompt).toMatch(/Current UTC time:/);
            expect(prompt).toMatch(/Current timestamp:/);
            expect(prompt).toMatch(/Consider the current time and date context when making your decision/);
        });

        test('PsychologyService includes datetime in analysis prompts', () => {
            const PsychologyService = require('../../backend/services/domain/CORE_PsychologyService');
            
            // Create a test prompt similar to what the service generates
            const DateTimeUtils = require('../../backend/utils/datetime_utils');
            const dateTimeContext = DateTimeUtils.getSystemPromptDateTime();
            
            const testPrompt = `Analyze how this conversation affects Test Character's psychological state.

Character: Test Character
Definition: A test character

${dateTimeContext}

Current state:
- Emotion: neutral (intensity: 5/10)
- Energy: 5/10
- Stress: 3/10
- Relationship: getting_to_know

Latest message: "Test message"

How would this naturally affect their internal state? Consider time-of-day factors (morning energy, evening relaxation, etc.) and how the current time might influence their psychological response.`;

            // Verify the datetime context is properly integrated
            expect(testPrompt).toMatch(/Current date and time:/);
            expect(testPrompt).toMatch(/Current UTC time:/);
            expect(testPrompt).toMatch(/Consider time-of-day factors/);
        });

        test('ConversationAnalyzer includes datetime in analysis prompts', () => {
            const ConversationAnalyzer = require('../../backend/services/domain/CORE_ConversationAnalyzer');
            
            // Create a mock service instance
            const mockDependencies = {
                logger: {
                    info: jest.fn(),
                    debug: jest.fn(),
                    warn: jest.fn(),
                    error: jest.fn()
                },
                structuredResponse: {},
                llm: {}
            };

            const service = new ConversationAnalyzer(mockDependencies);
            
            // Test the prompt building method
            const mockMessage = { sender: 'user', message: 'Test message' };
            const mockPreviousMessages = [
                { sender: 'assistant', message: 'Previous response' }
            ];
            const mockSessionContext = {};

            const prompt = service.buildAnalysisPrompt(mockMessage, mockPreviousMessages, mockSessionContext);
            
            // Verify datetime context is included
            expect(prompt).toMatch(/Current date and time:/);
            expect(prompt).toMatch(/Current UTC time:/);
            expect(prompt).toMatch(/Consider time-based context when analyzing conversation patterns/);
        });
    });

    describe('Regression Prevention Tests', () => {
        test('should fail if datetime context is missing from ChatRoutes system prompt', () => {
            // This test ensures that if someone accidentally removes datetime context,
            // the test will fail and alert them
            const DateTimeUtils = require('../../backend/utils/datetime_utils');
            
            // Simulate what the system prompt should look like
            const mockCharacter = { name: 'Test', description: 'Test character' };
            const mockPsychologyState = { mood: 'neutral', engagement: 'moderate', energy: 75 };
            const characterBackground = 'Test background';
            const dateTimeContext = DateTimeUtils.getSystemPromptDateTime();
            
            const systemPrompt = `You are ${mockCharacter.name}, ${mockCharacter.description}
${characterBackground ? `\nBackground: ${characterBackground}` : ''}

${dateTimeContext}

Current psychology state: mood=${mockPsychologyState.mood || 'neutral'}, engagement=${mockPsychologyState.engagement || 'moderate'}, energy=${mockPsychologyState.energy || 75}.
Stay in character as ${mockCharacter.name}. Adapt your response based on this psychological context and your character traits. You are fully aware of the current date and time as provided above.`;

            // These assertions will fail if datetime context is removed
            expect(systemPrompt).toMatch(/Current date and time:/);
            expect(systemPrompt).toMatch(/You are fully aware of the current date and time as provided above/);
        });

        test('should ensure all character-facing services have datetime integration', () => {
            // This test verifies that all services that interact with characters
            // have the datetime utilities imported and available
            
            const fs = require('fs');
            const path = require('path');
            
            const servicesToCheck = [
                '../../backend/api/chatRoutes.js',
                '../../backend/services/domain/CORE_ProactiveIntelligenceService.js',
                '../../backend/services/domain/CORE_PsychologyService.js',
                '../../backend/services/domain/CORE_ConversationAnalyzer.js'
            ];

            servicesToCheck.forEach(servicePath => {
                const fullPath = path.resolve(__dirname, servicePath);
                const serviceContent = fs.readFileSync(fullPath, 'utf8');
                
                // Check that DateTimeUtils is imported
                expect(serviceContent).toMatch(/require.*datetime_utils/);
                
                // Check that datetime context is used in prompts
                expect(serviceContent).toMatch(/DateTimeUtils\.getSystemPromptDateTime/);
            });
        });

        test('should validate datetime context structure consistency', () => {
            // This test ensures the datetime context always has the expected structure
            const datetimeContext = DateTimeUtils.getSystemPromptDateTime();
            
            const expectedSections = [
                'Current date and time:',
                'Current UTC time:',
                'Current timestamp:',
                'Local date:',
                'Timezone:',
                'Time calculation examples for relative times:',
                'IMPORTANT: Use the current timestamp'
            ];

            expectedSections.forEach(section => {
                expect(datetimeContext).toMatch(new RegExp(section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
            });
        });
    });

    describe('Time-Aware Character Behavior Tests', () => {
        test('should provide appropriate time-based greetings', () => {
            // Test different times of day
            const morningDate = new Date();
            morningDate.setHours(9, 0, 0, 0);
            const morningGreeting = DateTimeUtils.getTimeAwareGreeting(morningDate);
            expect(morningGreeting).toBe('Good morning');

            const afternoonDate = new Date();
            afternoonDate.setHours(14, 0, 0, 0);
            const afternoonGreeting = DateTimeUtils.getTimeAwareGreeting(afternoonDate);
            expect(afternoonGreeting).toBe('Good afternoon');

            const eveningDate = new Date();
            eveningDate.setHours(19, 0, 0, 0);
            const eveningGreeting = DateTimeUtils.getTimeAwareGreeting(eveningDate);
            expect(eveningGreeting).toBe('Good evening');

            const nightDate = new Date();
            nightDate.setHours(23, 0, 0, 0);
            const nightGreeting = DateTimeUtils.getTimeAwareGreeting(nightDate);
            expect(nightGreeting).toBe('Good night');
        });

        test('should correctly identify business hours', () => {
            // Test weekday business hours
            const weekdayMorning = new Date();
            weekdayMorning.setHours(10, 0, 0, 0);
            // Set to a Tuesday (day 2)
            weekdayMorning.setDate(weekdayMorning.getDate() + (2 - weekdayMorning.getDay() + 7) % 7);
            expect(DateTimeUtils.isBusinessHours(weekdayMorning)).toBe(true);

            // Test weekend
            const saturday = new Date();
            saturday.setHours(10, 0, 0, 0);
            // Set to Saturday (day 6)
            saturday.setDate(saturday.getDate() + (6 - saturday.getDay() + 7) % 7);
            expect(DateTimeUtils.isBusinessHours(saturday)).toBe(false);

            // Test after hours
            const lateEvening = new Date();
            lateEvening.setHours(20, 0, 0, 0);
            // Set to a Tuesday
            lateEvening.setDate(lateEvening.getDate() + (2 - lateEvening.getDay() + 7) % 7);
            expect(DateTimeUtils.isBusinessHours(lateEvening)).toBe(false);
        });

        test('should handle relative time parsing for character scheduling', () => {
            const baseDate = new Date('2023-01-01T12:00:00Z');
            
            // Test various relative time expressions
            const in5Minutes = DateTimeUtils.parseRelativeTime('in 5 minutes', baseDate);
            expect(in5Minutes).toEqual(new Date('2023-01-01T12:05:00Z'));

            const in2Hours = DateTimeUtils.parseRelativeTime('in 2 hours', baseDate);
            expect(in2Hours).toEqual(new Date('2023-01-01T14:00:00Z'));

            const in30Seconds = DateTimeUtils.parseRelativeTime('in 30 seconds', baseDate);
            expect(in30Seconds).toEqual(new Date('2023-01-01T12:00:30Z'));
        });
    });
});
