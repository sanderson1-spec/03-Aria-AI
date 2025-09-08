const express = require('express');
const { v4: uuidv4 } = require('uuid');

class CharactersRoutes {
    constructor(serviceFactory) {
        this.router = express.Router();
        this.serviceFactory = serviceFactory;
        this.setupRoutes();
    }

    setupRoutes() {
        // Enable CORS for frontend
        this.router.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', 'http://localhost:5173');
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
            if (req.method === 'OPTIONS') {
                res.sendStatus(200);
            } else {
                next();
            }
        });

        // Get all available characters (global personalities)
        this.router.get('/', async (req, res) => {
            try {
                const databaseService = this.serviceFactory.get('database');
                
                const characters = await databaseService.getDAL().personalities.getAllCharacters();
                
                res.json({
                    success: true,
                    data: characters
                });

            } catch (error) {
                console.error('Characters List API Error:', error);
                res.status(500).json({ 
                    error: 'Failed to get characters', 
                    details: error.message 
                });
            }
        });

        // Get a specific character
        this.router.get('/:characterId', async (req, res) => {
            try {
                const { characterId } = req.params;
                const databaseService = this.serviceFactory.get('database');
                
                const character = await databaseService.getDAL().personalities.getCharacter(characterId);
                
                if (!character) {
                    return res.status(404).json({ 
                        error: 'Character not found' 
                    });
                }
                
                res.json({
                    success: true,
                    data: character
                });

            } catch (error) {
                console.error('Character Get API Error:', error);
                res.status(500).json({ 
                    error: 'Failed to get character', 
                    details: error.message 
                });
            }
        });

        // Create a new character
        this.router.post('/', async (req, res) => {
            try {
                const { name, description, background, avatar } = req.body;
                
                if (!name || !name.trim()) {
                    return res.status(400).json({ 
                        error: 'Character name is required' 
                    });
                }
                
                const databaseService = this.serviceFactory.get('database');
                const characterId = uuidv4();
                
                const characterData = {
                    id: characterId,
                    name: name.trim(),
                    description: description?.trim() || '',
                    background: background?.trim() || '',
                    avatar: avatar || null
                };
                
                const result = await databaseService.getDAL().personalities.createCharacter(characterData);
                
                res.json({
                    success: true,
                    data: { ...characterData, ...result },
                    message: 'Character created successfully'
                });

            } catch (error) {
                console.error('Character Create API Error:', error);
                res.status(500).json({ 
                    error: 'Failed to create character', 
                    details: error.message 
                });
            }
        });

        // Update a character
        this.router.put('/:characterId', async (req, res) => {
            try {
                const { characterId } = req.params;
                const { name, description, background, avatar } = req.body;
                const databaseService = this.serviceFactory.get('database');
                
                // Check if character exists
                const existingCharacter = await databaseService.getDAL().personalities.getCharacter(characterId);
                if (!existingCharacter) {
                    return res.status(404).json({ 
                        error: 'Character not found' 
                    });
                }
                
                const updateData = {};
                
                if (name !== undefined) updateData.name = name.trim();
                if (description !== undefined) updateData.description = description.trim();
                if (background !== undefined) updateData.background = background.trim();
                if (avatar !== undefined) updateData.avatar = avatar;
                
                const result = await databaseService.getDAL().personalities.updateCharacter(characterId, updateData);
                
                res.json({
                    success: true,
                    data: { ...existingCharacter, ...updateData, ...result },
                    message: 'Character updated successfully'
                });

            } catch (error) {
                console.error('Character Update API Error:', error);
                res.status(500).json({ 
                    error: 'Failed to update character', 
                    details: error.message 
                });
            }
        });

        // Delete a character (soft delete - sets is_active to 0)
        this.router.delete('/:characterId', async (req, res) => {
            try {
                const { characterId } = req.params;
                const databaseService = this.serviceFactory.get('database');
                
                // Check if character exists
                const existingCharacter = await databaseService.getDAL().personalities.getCharacter(characterId);
                if (!existingCharacter) {
                    return res.status(404).json({ 
                        error: 'Character not found' 
                    });
                }
                
                const result = await databaseService.getDAL().personalities.deleteCharacter(characterId);
                
                res.json({
                    success: true,
                    data: result,
                    message: 'Character deleted successfully'
                });

            } catch (error) {
                console.error('Character Delete API Error:', error);
                res.status(500).json({ 
                    error: 'Failed to delete character', 
                    details: error.message 
                });
            }
        });
    }

    getRouter() {
        return this.router;
    }
}

module.exports = CharactersRoutes;
