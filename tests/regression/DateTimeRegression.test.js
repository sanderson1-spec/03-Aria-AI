/**
 * DateTime Regression Tests
 * 
 * CRITICAL: These tests prevent accidental removal of datetime context from character interactions.
 * If any of these tests fail, it means datetime awareness has been broken and must be fixed immediately.
 * 
 * These tests are designed to catch common regression scenarios:
 * - Someone removes DateTimeUtils import
 * - Someone removes datetime context from system prompts
 * - Someone modifies the datetime utilities breaking the API
 * - Someone changes service initialization breaking datetime integration
 */

const fs = require('fs');
const path = require('path');
const DateTimeUtils = require('../../backend/utils/datetime_utils');

describe('DateTime Regression Prevention', () => {
    describe('Critical File Structure Validation', () => {
        test('DateTimeUtils file must exist and be accessible', () => {
            const datetimeUtilsPath = path.resolve(__dirname, '../../backend/utils/datetime_utils.js');
            expect(fs.existsSync(datetimeUtilsPath)).toBe(true);
            
            // Verify it can be required without errors
            expect(() => require('../../backend/utils/datetime_utils')).not.toThrow();
        });

        test('All character-facing services must import DateTimeUtils', () => {
            const servicesToCheck = [
                '../../backend/api/chatRoutes.js',
                '../../backend/services/domain/CORE_ProactiveIntelligenceService.js',
                '../../backend/services/domain/CORE_PsychologyService.js',
                '../../backend/services/domain/CORE_ConversationAnalyzer.js'
            ];

            servicesToCheck.forEach(servicePath => {
                const fullPath = path.resolve(__dirname, servicePath);
                expect(fs.existsSync(fullPath)).toBe(true);
                
                const serviceContent = fs.readFileSync(fullPath, 'utf8');
                
                // CRITICAL: Must import DateTimeUtils
                expect(serviceContent).toMatch(/require.*datetime_utils/);
                expect(serviceContent).not.toMatch(/\/\/.*require.*datetime_utils/); // Not commented out
                expect(serviceContent).not.toMatch(/\/\*.*require.*datetime_utils.*\*\//); // Not in block comment
            });
        });

        test('All character-facing services must use DateTimeUtils.getSystemPromptDateTime()', () => {
            const servicesToCheck = [
                '../../backend/api/chatRoutes.js',
                '../../backend/services/domain/CORE_ProactiveIntelligenceService.js',
                '../../backend/services/domain/CORE_PsychologyService.js',
                '../../backend/services/domain/CORE_ConversationAnalyzer.js'
            ];

            servicesToCheck.forEach(servicePath => {
                const fullPath = path.resolve(__dirname, servicePath);
                const serviceContent = fs.readFileSync(fullPath, 'utf8');
                
                // CRITICAL: Must call getSystemPromptDateTime()
                expect(serviceContent).toMatch(/DateTimeUtils\.getSystemPromptDateTime\(\)/);
                expect(serviceContent).not.toMatch(/\/\/.*DateTimeUtils\.getSystemPromptDateTime/); // Not commented out
                expect(serviceContent).not.toMatch(/\/\*.*DateTimeUtils\.getSystemPromptDateTime.*\*\//); // Not in block comment
            });
        });
    });

    describe('API Contract Validation', () => {
        test('DateTimeUtils.getSystemPromptDateTime() must return expected format', () => {
            const result = DateTimeUtils.getSystemPromptDateTime();
            
            // CRITICAL: Must be a string
            expect(typeof result).toBe('string');
            expect(result.length).toBeGreaterThan(100);
            
            // CRITICAL: Must contain essential datetime information
            const requiredSections = [
                'Current date and time:',
                'Current UTC time:',
                'Current timestamp:',
                'Local date:',
                'Timezone:',
                'Time calculation examples for relative times:',
                'IMPORTANT: Use the current timestamp'
            ];

            requiredSections.forEach(section => {
                expect(result).toMatch(new RegExp(section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
            });
            
            // CRITICAL: Must contain time examples
            expect(result).toMatch(/in 1 minute.*=/);
            expect(result).toMatch(/in 5 minutes.*=/);
            expect(result).toMatch(/in 1 hour.*=/);
        });

        test('DateTimeUtils must provide all required methods', () => {
            const requiredMethods = [
                'getSystemPromptDateTime',
                'getTimeAwareGreeting',
                'isBusinessHours',
                'getRelativeTime',
                'parseRelativeTime',
                'getCurrentTimeContext',
                'getSystemContext'
            ];

            requiredMethods.forEach(method => {
                expect(typeof DateTimeUtils[method]).toBe('function');
            });
        });

        test('DateTimeUtils methods must not throw errors with default parameters', () => {
            const methodsToTest = [
                'getSystemPromptDateTime',
                'getTimeAwareGreeting',
                'isBusinessHours',
                'getCurrentTimeContext',
                'getSystemContext'
            ];

            methodsToTest.forEach(method => {
                expect(() => DateTimeUtils[method]()).not.toThrow();
            });
        });
    });

    describe('Character Prompt Integration Validation', () => {
        test('ChatRoutes system prompt must include datetime context', () => {
            // Simulate the system prompt creation from ChatRoutes
            const mockCharacter = { name: 'Test Character', description: 'Test description' };
            const mockPsychologyState = { mood: 'neutral', engagement: 'moderate', energy: 75 };
            const characterBackground = 'Test background';
            const dateTimeContext = DateTimeUtils.getSystemPromptDateTime();
            
            const systemPrompt = `You are ${mockCharacter.name}, ${mockCharacter.description}
${characterBackground ? `\nBackground: ${characterBackground}` : ''}

${dateTimeContext}

Current psychology state: mood=${mockPsychologyState.mood || 'neutral'}, engagement=${mockPsychologyState.engagement || 'moderate'}, energy=${mockPsychologyState.energy || 75}.
Stay in character as ${mockCharacter.name}. Adapt your response based on this psychological context and your character traits. You are fully aware of the current date and time as provided above.`;

            // CRITICAL: System prompt must contain datetime information
            expect(systemPrompt).toMatch(/Current date and time:/);
            expect(systemPrompt).toMatch(/Current UTC time:/);
            expect(systemPrompt).toMatch(/You are fully aware of the current date and time as provided above/);
        });

        test('ProactiveIntelligenceService prompt must include datetime context', () => {
            const ProactiveIntelligenceService = require('../../backend/services/domain/CORE_ProactiveIntelligenceService');
            
            // Create mock dependencies
            const mockDependencies = {
                logger: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
                structuredResponse: {},
                psychology: {},
                database: {},
                errorHandling: { wrapDomainError: jest.fn() }
            };

            const service = new ProactiveIntelligenceService(mockDependencies);
            
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
            
            // CRITICAL: Proactive prompt must contain datetime information
            expect(prompt).toMatch(/Current date and time:/);
            expect(prompt).toMatch(/Current UTC time:/);
            expect(prompt).toMatch(/Consider the current time and date context when making your decision/);
        });

        test('PsychologyService prompt must include datetime context', () => {
            // Test the prompt format that PsychologyService uses
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

            // CRITICAL: Psychology prompt must contain datetime information
            expect(testPrompt).toMatch(/Current date and time:/);
            expect(testPrompt).toMatch(/Current UTC time:/);
            expect(testPrompt).toMatch(/Consider time-of-day factors/);
        });

        test('ConversationAnalyzer prompt must include datetime context', () => {
            const ConversationAnalyzer = require('../../backend/services/domain/CORE_ConversationAnalyzer');
            
            const mockDependencies = {
                logger: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
                structuredResponse: {},
                llm: {}
            };

            const service = new ConversationAnalyzer(mockDependencies);
            
            const mockMessage = { sender: 'user', message: 'Test message' };
            const mockPreviousMessages = [{ sender: 'assistant', message: 'Previous response' }];
            const mockSessionContext = {};

            const prompt = service.buildAnalysisPrompt(mockMessage, mockPreviousMessages, mockSessionContext);
            
            // CRITICAL: Analysis prompt must contain datetime information
            expect(prompt).toMatch(/Current date and time:/);
            expect(prompt).toMatch(/Current UTC time:/);
            expect(prompt).toMatch(/Consider time-based context when analyzing conversation patterns/);
        });
    });

    describe('Regression Scenario Tests', () => {
        test('should detect if someone removes datetime import from ChatRoutes', () => {
            const chatRoutesPath = path.resolve(__dirname, '../../backend/api/chatRoutes.js');
            const content = fs.readFileSync(chatRoutesPath, 'utf8');
            
            // This will fail if someone removes the import
            expect(content).toMatch(/const DateTimeUtils = require\(['"].*datetime_utils['"]\)/);
        });

        test('should detect if someone removes datetime context from system prompts', () => {
            const chatRoutesPath = path.resolve(__dirname, '../../backend/api/chatRoutes.js');
            const content = fs.readFileSync(chatRoutesPath, 'utf8');
            
            // This will fail if someone removes the datetime context usage
            expect(content).toMatch(/DateTimeUtils\.getSystemPromptDateTime\(\)/);
            expect(content).toMatch(/You are fully aware of the current date and time as provided above/);
        });

        test('should detect if DateTimeUtils API changes break compatibility', () => {
            // Test that the API we depend on still works
            expect(() => {
                const result = DateTimeUtils.getSystemPromptDateTime();
                expect(typeof result).toBe('string');
                expect(result).toMatch(/Current date and time:/);
            }).not.toThrow();
            
            expect(() => {
                const greeting = DateTimeUtils.getTimeAwareGreeting();
                expect(typeof greeting).toBe('string');
            }).not.toThrow();
            
            expect(() => {
                const isBusinessHours = DateTimeUtils.isBusinessHours();
                expect(typeof isBusinessHours).toBe('boolean');
            }).not.toThrow();
        });

        test('should detect if someone modifies service files to remove datetime integration', () => {
            const servicePaths = [
                '../../backend/services/domain/CORE_ProactiveIntelligenceService.js',
                '../../backend/services/domain/CORE_PsychologyService.js',
                '../../backend/services/domain/CORE_ConversationAnalyzer.js'
            ];

            servicePaths.forEach(servicePath => {
                const fullPath = path.resolve(__dirname, servicePath);
                const content = fs.readFileSync(fullPath, 'utf8');
                
                // Each service must have these patterns
                expect(content).toMatch(/const DateTimeUtils = require\(['"].*datetime_utils['"]\)/);
                expect(content).toMatch(/DateTimeUtils\.getSystemPromptDateTime\(\)/);
                
                // Must not be commented out - check for line comments only
                expect(content).not.toMatch(/\/\/.*DateTimeUtils\.getSystemPromptDateTime/);
                
                // Verify the actual function call exists and is not disabled
                const lines = content.split('\n');
                const datetimeCallLines = lines.filter(line => 
                    line.includes('DateTimeUtils.getSystemPromptDateTime()') && 
                    !line.trim().startsWith('//') &&
                    !line.trim().startsWith('*')
                );
                expect(datetimeCallLines.length).toBeGreaterThan(0);
            });
        });
    });

    describe('Future-Proofing Tests', () => {
        test('should ensure datetime context includes timezone information', () => {
            const context = DateTimeUtils.getSystemPromptDateTime();
            expect(context).toMatch(/Timezone:/);
        });

        test('should ensure datetime context includes calculation examples', () => {
            const context = DateTimeUtils.getSystemPromptDateTime();
            expect(context).toMatch(/Time calculation examples/);
            expect(context).toMatch(/in 1 minute/);
            expect(context).toMatch(/in 5 minutes/);
            expect(context).toMatch(/in 1 hour/);
        });

        test('should ensure datetime context includes timestamp for calculations', () => {
            const context = DateTimeUtils.getSystemPromptDateTime();
            expect(context).toMatch(/Current timestamp:/);
            expect(context).toMatch(/IMPORTANT: Use the current timestamp/);
        });

        test('should ensure all datetime information is current and not cached', () => {
            const context1 = DateTimeUtils.getSystemPromptDateTime();
            
            // Wait a small amount of time
            return new Promise(resolve => setTimeout(resolve, 10)).then(() => {
                const context2 = DateTimeUtils.getSystemPromptDateTime();
                
                // Timestamps should be different (not cached)
                expect(context1).not.toBe(context2);
            });
        });
    });
});
