const { setupServices } = require('../../setupServices');

describe('Authentication Workflow Integration', () => {
    let serviceFactory;
    let authService;
    let testUsers = [];

    beforeAll(async () => {
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

    test('Complete user registration and login workflow', async () => {
        // Step 1: Register new user
        const registerResult = await authService.register(
            'integrationuser',
            'integrationpass',
            'Integration Test User',
            'test@example.com'
        );

        expect(registerResult.success).toBe(true);
        expect(registerResult.user.username).toBe('integrationuser');
        expect(registerResult.user.displayName).toBe('Integration Test User');
        expect(registerResult.user.email).toBe('test@example.com');

        testUsers.push(registerResult.user);

        // Step 2: Login with registered credentials
        const loginResult = await authService.login(
            'integrationuser',
            'integrationpass',
            { userAgent: 'Test Browser' },
            '127.0.0.1'
        );

        expect(loginResult.success).toBe(true);
        expect(loginResult.sessionToken).toBeDefined();
        expect(loginResult.user.username).toBe('integrationuser');
        expect(loginResult.expiresAt).toBeDefined();

        const sessionToken = loginResult.sessionToken;

        // Step 3: Validate session
        const validation = await authService.validateSession(sessionToken);

        expect(validation.valid).toBe(true);
        expect(validation.user.username).toBe('integrationuser');

        // Step 4: Get current user
        const currentUser = await authService.getCurrentUser(sessionToken);

        expect(currentUser.username).toBe('integrationuser');
        expect(currentUser.displayName).toBe('Integration Test User');

        // Step 5: Check sessions
        const sessions = await authService.getUserSessions(registerResult.user.id);

        expect(sessions.length).toBeGreaterThan(0);

        // Step 6: Logout
        const logoutResult = await authService.logout(sessionToken);

        expect(logoutResult.success).toBe(true);

        // Step 7: Verify session is now invalid
        const postLogoutValidation = await authService.validateSession(sessionToken);

        expect(postLogoutValidation.valid).toBe(false);
    });

    test('Multiple device scenario', async () => {
        // Register user
        const registerResult = await authService.register('multideviceuser', 'password');
        testUsers.push(registerResult.user);

        // Login from desktop
        const desktopLogin = await authService.login(
            'multideviceuser',
            'password',
            { userAgent: 'Desktop Browser' },
            '192.168.1.100'
        );

        // Login from mobile
        const mobileLogin = await authService.login(
            'multideviceuser',
            'password',
            { userAgent: 'Mobile Browser' },
            '192.168.1.101'
        );

        // Both sessions should be valid
        const desktopValidation = await authService.validateSession(desktopLogin.sessionToken);
        const mobileValidation = await authService.validateSession(mobileLogin.sessionToken);

        expect(desktopValidation.valid).toBe(true);
        expect(mobileValidation.valid).toBe(true);

        // Check sessions list
        const sessions = await authService.getUserSessions(registerResult.user.id);
        expect(sessions.length).toBeGreaterThanOrEqual(2);

        // Logout from desktop
        await authService.logout(desktopLogin.sessionToken);

        // Desktop session should be invalid
        const desktopRecheck = await authService.validateSession(desktopLogin.sessionToken);
        expect(desktopRecheck.valid).toBe(false);

        // Mobile session should still be valid
        const mobileRecheck = await authService.validateSession(mobileLogin.sessionToken);
        expect(mobileRecheck.valid).toBe(true);
    });

    test('Username availability check during registration', async () => {
        // Check username is available
        const availableBefore = await authService.isUsernameAvailable('uniqueuser');
        expect(availableBefore).toBe(true);

        // Register user
        const registerResult = await authService.register('uniqueuser', 'password');
        testUsers.push(registerResult.user);

        // Check username is now taken
        const availableAfter = await authService.isUsernameAvailable('uniqueuser');
        expect(availableAfter).toBe(false);

        // Try to register with same username - should fail
        await expect(
            authService.register('uniqueuser', 'differentpass')
        ).rejects.toThrow('Username already exists');
    });

    test('Password security - hashing verification', async () => {
        // Register user
        const registerResult = await authService.register('secureuser', 'mypassword');
        testUsers.push(registerResult.user);

        // Get user from database
        const dal = serviceFactory.get('database').getDAL();
        const dbUser = await dal.auth.findByUsername('secureuser');

        // Password should be hashed (not plain text)
        expect(dbUser.password_hash).toBeDefined();
        expect(dbUser.password_hash).not.toBe('mypassword');
        expect(dbUser.password_hash.length).toBeGreaterThan(20); // Bcrypt hashes are long

        // Verify password works for login
        const loginResult = await authService.login('secureuser', 'mypassword');
        expect(loginResult.success).toBe(true);

        // Verify wrong password fails
        await expect(
            authService.login('secureuser', 'wrongpassword')
        ).rejects.toThrow('Invalid username or password');
    });
});
