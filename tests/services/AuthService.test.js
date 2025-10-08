const { setupServices } = require('../../setupServices');

describe('AuthService', () => {
    let serviceFactory;
    let authService;
    let testUsers = [];

    beforeAll(async () => {
        // Setup services with in-memory database
        serviceFactory = await setupServices({
            dbPath: ':memory:'
        });
        authService = serviceFactory.get('auth');
    });

    afterAll(async () => {
        await serviceFactory.shutdown();
    });

    afterEach(async () => {
        // Cleanup test users
        for (const user of testUsers) {
            try {
                const dal = serviceFactory.get('database').getDAL();
                await dal.execute('DELETE FROM users WHERE username = ?', [user.username]);
                await dal.execute('DELETE FROM user_sessions WHERE user_id = ?', [user.id]);
            } catch (error) {
                // Ignore cleanup errors
            }
        }
        testUsers = [];
    });

    describe('User Registration', () => {
        test('should successfully register a new user', async () => {
            const result = await authService.register('testuser', 'testpass', 'Test User');

            expect(result.success).toBe(true);
            expect(result.user).toBeDefined();
            expect(result.user.username).toBe('testuser');
            expect(result.user.displayName).toBe('Test User');
            expect(result.user.id).toBeDefined();

            testUsers.push(result.user);
        });

        test('should use username as displayName if not provided', async () => {
            const result = await authService.register('testuser2', 'testpass');

            expect(result.success).toBe(true);
            expect(result.user.displayName).toBe('testuser2');

            testUsers.push(result.user);
        });

        test('should fail with username less than 3 characters', async () => {
            await expect(
                authService.register('ab', 'testpass')
            ).rejects.toThrow('Username must be at least 3 characters');
        });

        test('should fail if username already exists', async () => {
            const firstResult = await authService.register('duplicate', 'pass1');
            testUsers.push(firstResult.user);

            await expect(
                authService.register('duplicate', 'pass2')
            ).rejects.toThrow('Username already exists');
        });

        test('should fail if username is empty', async () => {
            await expect(
                authService.register('', 'testpass')
            ).rejects.toThrow('Username and password are required');
        });

        test('should fail if password is empty', async () => {
            await expect(
                authService.register('testuser', '')
            ).rejects.toThrow('Username and password are required');
        });

        test('should trim whitespace from username', async () => {
            const result = await authService.register('  spacey  ', 'testpass');

            expect(result.user.username).toBe('spacey');

            testUsers.push(result.user);
        });
    });

    describe('User Login', () => {
        let registeredUser;

        beforeEach(async () => {
            const result = await authService.register('logintest', 'correctpass', 'Login Test');
            registeredUser = result.user;
            testUsers.push(registeredUser);
        });

        test('should successfully login with correct credentials', async () => {
            const result = await authService.login('logintest', 'correctpass');

            expect(result.success).toBe(true);
            expect(result.sessionToken).toBeDefined();
            expect(result.user).toBeDefined();
            expect(result.user.username).toBe('logintest');
            expect(result.expiresAt).toBeDefined();
        });

        test('should fail with incorrect password', async () => {
            await expect(
                authService.login('logintest', 'wrongpass')
            ).rejects.toThrow('Invalid username or password');
        });

        test('should fail with non-existent username', async () => {
            await expect(
                authService.login('nonexistent', 'anypass')
            ).rejects.toThrow('Invalid username or password');
        });

        test('should fail with empty username', async () => {
            await expect(
                authService.login('', 'pass')
            ).rejects.toThrow('Username and password are required');
        });

        test('should fail with empty password', async () => {
            await expect(
                authService.login('logintest', '')
            ).rejects.toThrow('Username and password are required');
        });

        test('should create session with device info', async () => {
            const deviceInfo = { userAgent: 'Test Browser', platform: 'Test OS' };
            const result = await authService.login('logintest', 'correctpass', deviceInfo, '127.0.0.1');

            expect(result.sessionToken).toBeDefined();
            
            // Verify session was created with device info
            const sessions = await authService.getUserSessions(registeredUser.id);
            expect(sessions.length).toBeGreaterThan(0);
        });
    });

    describe('Session Management', () => {
        let user;
        let sessionToken;

        beforeEach(async () => {
            const registerResult = await authService.register('sessiontest', 'testpass');
            user = registerResult.user;
            testUsers.push(user);

            const loginResult = await authService.login('sessiontest', 'testpass');
            sessionToken = loginResult.sessionToken;
        });

        test('should validate a valid session', async () => {
            const validation = await authService.validateSession(sessionToken);

            expect(validation.valid).toBe(true);
            expect(validation.user).toBeDefined();
            expect(validation.user.username).toBe('sessiontest');
        });

        test('should reject invalid session token', async () => {
            const validation = await authService.validateSession('invalid-token');

            expect(validation.valid).toBe(false);
            expect(validation.user).toBeNull();
        });

        test('should reject empty session token', async () => {
            const validation = await authService.validateSession('');

            expect(validation.valid).toBe(false);
        });

        test('should get current user from session', async () => {
            const currentUser = await authService.getCurrentUser(sessionToken);

            expect(currentUser).toBeDefined();
            expect(currentUser.username).toBe('sessiontest');
        });

        test('should fail to get current user with invalid token', async () => {
            await expect(
                authService.getCurrentUser('invalid-token')
            ).rejects.toThrow('Invalid or expired session');
        });

        test('should logout and invalidate session', async () => {
            const logoutResult = await authService.logout(sessionToken);

            expect(logoutResult.success).toBe(true);

            // Verify session is now invalid
            const validation = await authService.validateSession(sessionToken);
            expect(validation.valid).toBe(false);
        });

        test('should get user sessions', async () => {
            const sessions = await authService.getUserSessions(user.id);

            expect(Array.isArray(sessions)).toBe(true);
            expect(sessions.length).toBeGreaterThan(0);
        });

        test('should logout from all devices', async () => {
            // Create multiple sessions
            await authService.login('sessiontest', 'testpass');
            await authService.login('sessiontest', 'testpass');

            const sessions = await authService.getUserSessions(user.id);
            expect(sessions.length).toBeGreaterThanOrEqual(3);

            // Logout from all
            await authService.logoutAllDevices(user.id);

            // Verify all sessions are invalid
            const validation = await authService.validateSession(sessionToken);
            expect(validation.valid).toBe(false);

            const remainingSessions = await authService.getUserSessions(user.id);
            expect(remainingSessions.length).toBe(0);
        });
    });

    describe('Username Availability', () => {
        test('should return true for available username', async () => {
            const isAvailable = await authService.isUsernameAvailable('newuser');

            expect(isAvailable).toBe(true);
        });

        test('should return false for taken username', async () => {
            const result = await authService.register('takenuser', 'pass');
            testUsers.push(result.user);

            const isAvailable = await authService.isUsernameAvailable('takenuser');

            expect(isAvailable).toBe(false);
        });

        test('should return false for username less than 3 chars', async () => {
            const isAvailable = await authService.isUsernameAvailable('ab');

            expect(isAvailable).toBe(false);
        });

        test('should return false for empty username', async () => {
            const isAvailable = await authService.isUsernameAvailable('');

            expect(isAvailable).toBe(false);
        });
    });
});
