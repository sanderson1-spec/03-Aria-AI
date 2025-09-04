#!/usr/bin/env node

/**
 * Unit Tests for UserRepository
 * 
 * CLEAN ARCHITECTURE TESTING:
 * - Test repository creation and inheritance
 * - Test all CRUD operations with user isolation
 * - Test multi-user support and data isolation
 * - Mock database dependencies for isolated testing
 * - Verify proper error handling and validation
 */

const UserRepository = require('../../backend/dal/repositories/CORE_UserRepository');
const { MockFactory, ArchitectureAssertions } = require('../test-framework');

// Simple test framework (since we don't have Jest installed)
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

function createMockUser(overrides = {}) {
    return {
        id: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        display_name: 'Test User',
        preferences: '{}',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z',
        last_active: '2024-01-01T00:00:00.000Z',
        is_active: 1,
        ...overrides
    };
}

async function runUserRepositoryTests() {
    const suite = new SimpleTest('UserRepository Unit Tests');
    let userRepo;
    let mockDeps;

    // Setup before each test
    function setup() {
        mockDeps = createMockDependencies();
        userRepo = new UserRepository('users', mockDeps);
    }

    // CLEAN ARCHITECTURE: Test repository creation and inheritance
    suite.test('should extend BaseRepository', () => {
        setup();
        ArchitectureAssertions.assertExtendsBaseRepository(userRepo);
    });

    suite.test('should have correct table name', () => {
        setup();
        if (userRepo.tableName !== 'users') {
            throw new Error(`Expected table name 'users', got '${userRepo.tableName}'`);
        }
    });

    suite.test('should implement required repository interface', () => {
        setup();
        ArchitectureAssertions.assertRepositoryInterface(userRepo);
    });

    // CLEAN ARCHITECTURE: Test findByUsername method
    suite.test('should find user by username', async () => {
        setup();
        const mockUser = createMockUser();
        mockDeps.dbAccess.queryOne = () => Promise.resolve(mockUser);
        
        const result = await userRepo.findByUsername('testuser');
        
        if (!result || result.username !== 'testuser') {
            throw new Error('findByUsername should return user with correct username');
        }
    });

    suite.test('should return null for non-existent username', async () => {
        setup();
        mockDeps.dbAccess.queryOne = () => Promise.resolve(null);
        
        const result = await userRepo.findByUsername('nonexistent');
        
        if (result !== null) {
            throw new Error('findByUsername should return null for non-existent user');
        }
    });

    // CLEAN ARCHITECTURE: Test findByEmail method  
    suite.test('should find user by email', async () => {
        setup();
        const mockUser = createMockUser();
        mockDeps.dbAccess.queryOne = () => Promise.resolve(mockUser);
        
        const result = await userRepo.findByEmail('test@example.com');
        
        if (!result || result.email !== 'test@example.com') {
            throw new Error('findByEmail should return user with correct email');
        }
    });

    // CLEAN ARCHITECTURE: Test createUser method
    suite.test('should create new user with proper structure', async () => {
        setup();
        let createdUser = null;
        
        // Mock the create and findById methods
        userRepo.create = (userData) => {
            createdUser = userData;
            return Promise.resolve({ id: userData.id });
        };
        userRepo.findById = () => Promise.resolve(createdUser);
        
        const userData = {
            username: 'newuser',
            email: 'new@example.com',
            display_name: 'New User'
        };
        
        const result = await userRepo.createUser(userData);
        
        if (!result || result.username !== 'newuser') {
            throw new Error('createUser should return created user');
        }
        
        if (!createdUser.id || typeof createdUser.id !== 'string') {
            throw new Error('createUser should generate UUID for user');
        }
        
        if (createdUser.is_active !== 1) {
            throw new Error('createUser should set user as active');
        }
    });

    // CLEAN ARCHITECTURE: Test updatePreferences method
    suite.test('should update user preferences', async () => {
        setup();
        let updateData = null;
        
        userRepo.update = (id, data) => {
            updateData = data;
            return Promise.resolve({ changes: 1 });
        };
        
        const preferences = { theme: 'dark', language: 'en' };
        await userRepo.updatePreferences('user-123', preferences);
        
        if (!updateData || !updateData.preferences) {
            throw new Error('updatePreferences should update preferences field');
        }
        
        const savedPrefs = JSON.parse(updateData.preferences);
        if (savedPrefs.theme !== 'dark') {
            throw new Error('updatePreferences should properly serialize preferences');
        }
    });

    // CLEAN ARCHITECTURE: Test updateLastActive method
    suite.test('should update last active timestamp', async () => {
        setup();
        let updateData = null;
        
        userRepo.update = (id, data) => {
            updateData = data;
            return Promise.resolve({ changes: 1 });
        };
        
        await userRepo.updateLastActive('user-123');
        
        if (!updateData || !updateData.last_active) {
            throw new Error('updateLastActive should update last_active field');
        }
        
        // Verify it's a valid ISO date string
        const date = new Date(updateData.last_active);
        if (isNaN(date.getTime())) {
            throw new Error('updateLastActive should set valid ISO date');
        }
    });

    // CLEAN ARCHITECTURE: Test getUserStats method (complex query)
    suite.test('should get comprehensive user statistics', async () => {
        setup();
        const mockStats = {
            id: 'user-123',
            username: 'testuser',
            total_chats: 5,
            unique_personalities_used: 3,
            total_messages: 150,
            last_chat_activity: '2024-01-01T12:00:00.000Z'
        };
        
        mockDeps.dbAccess.queryOne = () => Promise.resolve(mockStats);
        
        const result = await userRepo.getUserStats('user-123');
        
        if (!result || result.total_chats !== 5) {
            throw new Error('getUserStats should return comprehensive statistics');
        }
    });

    // CLEAN ARCHITECTURE: Test error handling
    suite.test('should handle database errors gracefully', async () => {
        setup();
        mockDeps.dbAccess.queryOne = () => Promise.reject(new Error('Database connection failed'));
        
        try {
            await userRepo.findByUsername('testuser');
            throw new Error('Should have thrown an error');
        } catch (error) {
            if (!error.message.includes('Failed to find user by username')) {
                throw new Error('Should wrap database errors with context');
            }
        }
    });

    // CLEAN ARCHITECTURE: Test multi-user support validation
    suite.test('should enforce multi-user operations', () => {
        setup();
        ArchitectureAssertions.assertMultiUserSupport(userRepo, 'createUser');
        ArchitectureAssertions.assertMultiUserSupport(userRepo, 'updatePreferences');
        ArchitectureAssertions.assertMultiUserSupport(userRepo, 'getUserStats');
    });

    return await suite.run();
}

// Run tests if called directly
if (require.main === module) {
    runUserRepositoryTests()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('❌ Test execution failed:', error.message);
            process.exit(1);
        });
}

module.exports = { runUserRepositoryTests };
