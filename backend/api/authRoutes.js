const express = require('express');

/**
 * AuthRoutes - API endpoints for authentication
 * 
 * CLEAN ARCHITECTURE:
 * - Thin API layer that delegates to AuthService
 * - RESTful endpoint design
 * - Proper error handling and response formatting
 */
class AuthRoutes {
    constructor(serviceFactory) {
        this.router = express.Router();
        this.authService = serviceFactory.get('auth');
        this.logger = serviceFactory.get('logger');
        this.setupRoutes();
    }

    setupRoutes() {
        // Register new user
        this.router.post('/register', async (req, res) => {
            try {
                const { username, password, displayName, email } = req.body;

                const result = await this.authService.register(
                    username,
                    password,
                    displayName,
                    email
                );

                res.status(201).json({
                    success: true,
                    data: result.user,
                    message: 'User registered successfully'
                });
            } catch (error) {
                this.logger.error('Registration failed', 'AuthRoutes', { error: error.message });
                
                const statusCode = error.type === 'ConflictError' ? 409 :
                                 error.type === 'ValidationError' ? 400 : 500;
                
                res.status(statusCode).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Login
        this.router.post('/login', async (req, res) => {
            try {
                const { username, password } = req.body;
                const deviceInfo = {
                    userAgent: req.headers['user-agent'],
                    platform: req.headers['sec-ch-ua-platform']
                };
                const ipAddress = req.ip || req.connection.remoteAddress;

                const result = await this.authService.login(
                    username,
                    password,
                    deviceInfo,
                    ipAddress
                );

                res.json({
                    success: true,
                    data: {
                        sessionToken: result.sessionToken,
                        user: result.user,
                        expiresAt: result.expiresAt
                    },
                    message: 'Logged in successfully'
                });
            } catch (error) {
                this.logger.error('Login failed', 'AuthRoutes', { error: error.message });
                
                const statusCode = error.type === 'AuthenticationError' ? 401 :
                                 error.type === 'ValidationError' ? 400 : 500;
                
                res.status(statusCode).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Logout
        this.router.post('/logout', async (req, res) => {
            try {
                const sessionToken = req.headers.authorization?.replace('Bearer ', '') ||
                                   req.headers['x-session-token'] ||
                                   req.body.sessionToken;

                await this.authService.logout(sessionToken);

                res.json({
                    success: true,
                    message: 'Logged out successfully'
                });
            } catch (error) {
                this.logger.error('Logout failed', 'AuthRoutes', { error: error.message });
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Validate session
        this.router.get('/validate', async (req, res) => {
            try {
                const sessionToken = req.headers.authorization?.replace('Bearer ', '') ||
                                   req.headers['x-session-token'] ||
                                   req.query.sessionToken;

                const validation = await this.authService.validateSession(sessionToken);

                res.json({
                    success: true,
                    data: validation
                });
            } catch (error) {
                this.logger.error('Session validation failed', 'AuthRoutes', { error: error.message });
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Get current user info
        this.router.get('/me', async (req, res) => {
            try {
                const sessionToken = req.headers.authorization?.replace('Bearer ', '') ||
                                   req.headers['x-session-token'];

                if (!sessionToken) {
                    return res.status(401).json({
                        success: false,
                        error: 'No session token provided'
                    });
                }

                const user = await this.authService.getCurrentUser(sessionToken);

                res.json({
                    success: true,
                    data: user
                });
            } catch (error) {
                this.logger.error('Get current user failed', 'AuthRoutes', { error: error.message });
                
                const statusCode = error.type === 'AuthenticationError' ? 401 : 500;
                
                res.status(statusCode).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Check username availability
        this.router.get('/check-username', async (req, res) => {
            try {
                const { username } = req.query;

                if (!username) {
                    return res.status(400).json({
                        success: false,
                        error: 'Username is required'
                    });
                }

                const isAvailable = await this.authService.isUsernameAvailable(username);

                res.json({
                    success: true,
                    data: { available: isAvailable }
                });
            } catch (error) {
                this.logger.error('Check username failed', 'AuthRoutes', { error: error.message });
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Get user sessions (protected)
        this.router.get('/sessions', async (req, res) => {
            try {
                const sessionToken = req.headers.authorization?.replace('Bearer ', '') ||
                                   req.headers['x-session-token'];

                if (!sessionToken) {
                    return res.status(401).json({
                        success: false,
                        error: 'No session token provided'
                    });
                }

                const user = await this.authService.getCurrentUser(sessionToken);
                const sessions = await this.authService.getUserSessions(user.id);

                res.json({
                    success: true,
                    data: sessions
                });
            } catch (error) {
                this.logger.error('Get sessions failed', 'AuthRoutes', { error: error.message });
                
                const statusCode = error.type === 'AuthenticationError' ? 401 : 500;
                
                res.status(statusCode).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Logout from all devices
        this.router.post('/logout-all', async (req, res) => {
            try {
                const sessionToken = req.headers.authorization?.replace('Bearer ', '') ||
                                   req.headers['x-session-token'];

                if (!sessionToken) {
                    return res.status(401).json({
                        success: false,
                        error: 'No session token provided'
                    });
                }

                const user = await this.authService.getCurrentUser(sessionToken);
                await this.authService.logoutAllDevices(user.id);

                res.json({
                    success: true,
                    message: 'Logged out from all devices'
                });
            } catch (error) {
                this.logger.error('Logout all failed', 'AuthRoutes', { error: error.message });
                
                const statusCode = error.type === 'AuthenticationError' ? 401 : 500;
                
                res.status(statusCode).json({
                    success: false,
                    error: error.message
                });
            }
        });
    }

    getRouter() {
        return this.router;
    }
}

module.exports = AuthRoutes;
