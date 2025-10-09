const express = require('express');
const { createAuthMiddleware } = require('./authMiddleware');

class UserRoutes {
    constructor(serviceFactory) {
        this.router = express.Router();
        this.serviceFactory = serviceFactory;
        this.authMiddleware = createAuthMiddleware(serviceFactory);
        this.setupRoutes();
    }

    setupRoutes() {
        // Get user profile
        this.router.get('/profile', this.authMiddleware, async (req, res) => {
            try {
                const userId = req.user.id;

                const databaseService = this.serviceFactory.get('database');
                const dal = databaseService.getDAL();
                
                const user = await dal.users.findById(userId);
                
                if (!user) {
                    return res.json({
                        success: true,
                        profile: {}
                    });
                }

                // Parse user_profile JSON column
                let profile = {};
                if (user.user_profile) {
                    try {
                        profile = typeof user.user_profile === 'string' 
                            ? JSON.parse(user.user_profile) 
                            : user.user_profile;
                    } catch (parseError) {
                        // Invalid JSON, return empty profile
                        profile = {};
                    }
                }

                res.json({
                    success: true,
                    profile: {
                        name: profile.name || '',
                        birthdate: profile.birthdate || '',
                        bio: profile.bio || ''
                    }
                });

            } catch (error) {
                res.status(500).json({ 
                    success: false,
                    error: 'Failed to get user profile', 
                    details: error.message 
                });
            }
        });

        // Update user profile
        this.router.put('/profile', this.authMiddleware, async (req, res) => {
            try {
                const userId = req.user.id;
                const { profile } = req.body;

                // Validation
                if (!profile) {
                    return res.status(400).json({
                        success: false,
                        error: 'Profile data is required'
                    });
                }

                if (!profile.name || profile.name.trim() === '') {
                    return res.status(400).json({
                        success: false,
                        error: 'Name is required'
                    });
                }

                const databaseService = this.serviceFactory.get('database');
                const dal = databaseService.getDAL();

                // Prepare profile object
                const profileData = {
                    name: profile.name.trim(),
                    ...(profile.birthdate && { birthdate: profile.birthdate }),
                    ...(profile.bio && { bio: profile.bio.trim() })
                };

                // Update user
                await dal.users.update(
                    { user_profile: JSON.stringify(profileData) },
                    { id: userId }
                );

                res.json({
                    success: true
                });

            } catch (error) {
                res.status(500).json({ 
                    success: false,
                    error: 'Failed to update user profile', 
                    details: error.message 
                });
            }
        });
    }

    getRouter() {
        return this.router;
    }
}

module.exports = UserRoutes;

