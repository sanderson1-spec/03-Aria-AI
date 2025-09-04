#!/usr/bin/env node

/**
 * Unit Tests for ChatRepository
 * 
 * CLEAN ARCHITECTURE TESTING:
 * - Test multi-user chat operations
 * - Test data isolation between users
 * - Test chat creation, retrieval, and updates
 * - Mock database dependencies for isolated testing
 * - Verify proper error handling
 */

const ChatRepository = require('../../backend/dal/repositories/CORE_ChatRepository');
const { ArchitectureAssertions } = require('../test-framework');

class SimpleTest {
    constructor(name) {
        this.name = name;
        this.tests = [];
        this.passed = 0;
        this.failed = 0;
    }

    test(description, testFunction) {
        this.tests.push({ description, testFunction });
    }

    async run() {
        console.log(`\n🧪 ${this.name}`);
        console.log('='.repeat(this.name.length + 4));
        
        for (const { description, testFunction } of this.tests) {
            try {
                await testFunction();
                console.log(`  ✅ ${description}`);
                this.passed++;
            } catch (error) {
                console.log(`  ❌ ${description}`);
                console.log(`     Error: ${error.message}`);
                this.failed++;
            }
        }
        
        const total = this.passed + this.failed;
        console.log(`\n📊 Results: ${this.passed}/${total} passed`);
        
        return this.failed === 0;
    }
}

// Helper functions
function createMockDependencies() {
    return {
        logger: {
            info: () => {},
            debug: () => {},
            warn: () => {},
            error: () => {}
        },
        errorHandling: {
            wrapRepositoryError: (error, message, context) => {
                const wrappedError = new Error(`${message}: ${error.message}`);
                wrappedError.context = context;
                return wrappedError;
            }
        },
        dbAccess: {
            queryOne: () => Promise.resolve(null),
            queryAll: () => Promise.resolve([]),
            run: () => Promise.resolve({ changes: 1 })
        }
    };
}

function createMockChat(overrides = {}) {
    return {
        id: 'chat-123',
        user_id: 'user-123',
        title: 'Test Chat',
        personality_id: 'default',
        chat_metadata: '{}',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z',
        is_active: 1,
        ...overrides
    };
}

async function runChatRepositoryTests() {
    const suite = new SimpleTest('ChatRepository Unit Tests');
    let chatRepo;
    let mockDeps;

    // Setup before each test
    function setup() {
        mockDeps = createMockDependencies();
        chatRepo = new ChatRepository('chats', mockDeps);
    }

    // CLEAN ARCHITECTURE: Test repository creation and inheritance
    suite.test('should extend BaseRepository', () => {
        setup();
        ArchitectureAssertions.assertExtendsBaseRepository(chatRepo);
    });

    suite.test('should have correct table name', () => {
        setup();
        if (chatRepo.tableName !== 'chats') {
            throw new Error(`Expected table name 'chats', got '${chatRepo.tableName}'`);
        }
    });

    suite.test('should implement required repository interface', () => {
        setup();
        ArchitectureAssertions.assertRepositoryInterface(chatRepo);
    });

    // CLEAN ARCHITECTURE: Test multi-user support
    suite.test('should require userId for createChat', () => {
        setup();
        ArchitectureAssertions.assertMultiUserSupport(chatRepo, 'createChat');
    });

    suite.test('should require userId for getUserChats', () => {
        setup();
        ArchitectureAssertions.assertMultiUserSupport(chatRepo, 'getUserChats');
    });

    suite.test('should require userId for getUserChat', () => {
        setup();
        ArchitectureAssertions.assertMultiUserSupport(chatRepo, 'getUserChat');
    });

    // CLEAN ARCHITECTURE: Test createChat method
    suite.test('should create chat with proper structure', async () => {
        setup();
        let createdChat = null;
        
        // Mock the create and findById methods
        chatRepo.create = (chatData) => {
            createdChat = chatData;
            return Promise.resolve({ id: chatData.id });
        };
        chatRepo.findById = () => Promise.resolve(createdChat);
        
        const chatData = {
            title: 'New Chat',
            personality_id: 'friendly'
        };
        
        const result = await chatRepo.createChat('user-123', chatData);
        
        if (!result || result.user_id !== 'user-123') {
            throw new Error('createChat should set user_id');
        }
        
        if (!createdChat.id || typeof createdChat.id !== 'string') {
            throw new Error('createChat should generate UUID');
        }
        
        if (createdChat.is_active !== 1) {
            throw new Error('createChat should set chat as active');
        }
        
        if (!createdChat.created_at || !createdChat.updated_at) {
            throw new Error('createChat should set timestamps');
        }
    });

    // CLEAN ARCHITECTURE: Test getUserChats method (pagination)
    suite.test('should get paginated user chats', async () => {
        setup();
        const mockChats = [
            createMockChat({ id: 'chat-1', title: 'Chat 1' }),
            createMockChat({ id: 'chat-2', title: 'Chat 2' })
        ];
        
        mockDeps.dbAccess.queryAll = () => Promise.resolve(mockChats);
        chatRepo.count = () => Promise.resolve(2);
        
        const result = await chatRepo.getUserChats('user-123', 1, 10);
        
        if (!result.chats || !Array.isArray(result.chats)) {
            throw new Error('getUserChats should return chats array');
        }
        
        if (!result.pagination) {
            throw new Error('getUserChats should return pagination info');
        }
        
        if (result.pagination.totalCount !== 2) {
            throw new Error('getUserChats should return correct total count');
        }
    });

    // CLEAN ARCHITECTURE: Test getUserChat method (access control)
    suite.test('should get user chat with access control', async () => {
        setup();
        const mockChat = createMockChat();
        
        mockDeps.dbAccess.queryOne = (sql, params) => {
            // Verify SQL includes user_id check
            if (!sql.includes('user_id = ?')) {
                throw new Error('getUserChat SQL should include user_id check');
            }
            
            // Verify parameters include both chatId and userId
            if (params.length < 2 || params[1] !== 'user-123') {
                throw new Error('getUserChat should verify user ownership');
            }
            
            return Promise.resolve(mockChat);
        };
        
        const result = await chatRepo.getUserChat('user-123', 'chat-123');
        
        if (!result || result.id !== 'chat-123') {
            throw new Error('getUserChat should return correct chat');
        }
    });

    // CLEAN ARCHITECTURE: Test updateChatTitle method (access control)
    suite.test('should update chat title with user verification', async () => {
        setup();
        let updateSql = '';
        let updateParams = [];
        
        mockDeps.dbAccess.run = (sql, params) => {
            updateSql = sql;
            updateParams = params;
            return Promise.resolve({ changes: 1 });
        };
        
        await chatRepo.updateChatTitle('user-123', 'chat-123', 'New Title');
        
        // Verify SQL includes user_id check
        if (!updateSql.includes('user_id = ?')) {
            throw new Error('updateChatTitle SQL should include user_id check');
        }
        
        // Verify parameters include userId
        if (!updateParams.includes('user-123')) {
            throw new Error('updateChatTitle should verify user ownership');
        }
        
        if (!updateParams.includes('New Title')) {
            throw new Error('updateChatTitle should include new title');
        }
    });

    // CLEAN ARCHITECTURE: Test searchUserChats method
    suite.test('should search user chats with proper isolation', async () => {
        setup();
        let searchSql = '';
        let searchParams = [];
        
        mockDeps.dbAccess.queryAll = (sql, params) => {
            searchSql = sql;
            searchParams = params;
            return Promise.resolve([]);
        };
        
        await chatRepo.searchUserChats('user-123', 'test search');
        
        // Verify SQL includes user_id check
        if (!searchSql.includes('user_id = ?')) {
            throw new Error('searchUserChats SQL should include user_id check');
        }
        
        // Verify search term is properly parameterized
        if (!searchParams.includes('%test search%')) {
            throw new Error('searchUserChats should use parameterized search');
        }
    });

    // CLEAN ARCHITECTURE: Test error handling
    suite.test('should handle database errors gracefully', async () => {
        setup();
        mockDeps.dbAccess.queryAll = () => Promise.reject(new Error('Database connection failed'));
        
        try {
            await chatRepo.getUserChats('user-123');
            throw new Error('Should have thrown an error');
        } catch (error) {
            if (!error.message.includes('Failed to get user chats')) {
                throw new Error('Should wrap database errors with context');
            }
        }
    });

    // INTEGRATION TEST: Test deactivateChat method (soft delete)
    suite.test('should soft delete chat with user verification', async () => {
        setup();
        let updateSql = '';
        let updateParams = [];
        
        mockDeps.dbAccess.run = (sql, params) => {
            updateSql = sql;
            updateParams = params;
            return Promise.resolve({ changes: 1 });
        };
        
        const result = await chatRepo.deactivateChat('user-123', 'chat-123');
        
        // Verify it's a soft delete (sets is_active = 0)
        if (!updateSql.includes('is_active = 0')) {
            throw new Error('deactivateChat should perform soft delete');
        }
        
        // Verify user ownership check
        if (!updateSql.includes('user_id = ?')) {
            throw new Error('deactivateChat should verify user ownership');
        }
        
        if (!result.deactivated) {
            throw new Error('deactivateChat should return deactivation status');
        }
    });

    return await suite.run();
}

// Run tests if called directly
if (require.main === module) {
    runChatRepositoryTests()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('❌ Test execution failed:', error.message);
            process.exit(1);
        });
}

module.exports = { runChatRepositoryTests };
