const express = require('express');
const { v4: uuidv4 } = require('uuid');

class CharactersRoutes {
    constructor(serviceFactory) {
        this.router = express.Router();
        this.serviceFactory = serviceFactory;
        this.setupRoutes();
    }

    /**
     * Extract userId from request (query parameter or header)
     * @param {object} req - Express request object
     * @returns {string|null} userId or null if not found
     */
    extractUserId(req) {
        return req.query.userId || req.headers['x-user-id'] || null;
    }

    setupRoutes() {
        // CORS is handled by main server middleware - no need for duplicate headers

        // Get user's characters
        this.router.get('/', async (req, res) => {
            try {
                const userId = this.extractUserId(req);
                if (!userId) {
                    return res.status(400).json({ 
                        error: 'userId required',
                        details: 'Provide userId as query parameter or x-user-id header'
                    });
                }

                const databaseService = this.serviceFactory.get('database');
                
                const characters = await databaseService.getDAL().personalities.getUserCharacters(userId);
                
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
                const userId = this.extractUserId(req);
                if (!userId) {
                    return res.status(400).json({ 
                        error: 'userId required',
                        details: 'Provide userId as query parameter or x-user-id header'
                    });
                }

                const { characterId } = req.params;
                const databaseService = this.serviceFactory.get('database');
                
                const character = await databaseService.getDAL().personalities.getCharacter(characterId);
                
                if (!character) {
                    return res.status(404).json({ 
                        error: 'Character not found' 
                    });
                }

                // Verify ownership
                if (character.user_id !== userId) {
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
                const userId = this.extractUserId(req);
                if (!userId) {
                    return res.status(400).json({ 
                        error: 'userId required',
                        details: 'Provide userId as query parameter or x-user-id header'
                    });
                }

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
                    user_id: userId,
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
                const userId = this.extractUserId(req);
                if (!userId) {
                    return res.status(400).json({ 
                        error: 'userId required',
                        details: 'Provide userId as query parameter or x-user-id header'
                    });
                }

                const { characterId } = req.params;
                const { name, description, background, avatar, llm_preferences } = req.body;
                const databaseService = this.serviceFactory.get('database');
                
                // Check if character exists
                const existingCharacter = await databaseService.getDAL().personalities.getCharacter(characterId);
                if (!existingCharacter) {
                    return res.status(404).json({ 
                        error: 'Character not found' 
                    });
                }

                // Verify ownership
                if (existingCharacter.user_id !== userId) {
                    return res.status(404).json({ 
                        error: 'Character not found' 
                    });
                }
                
                // Validate llm_preferences if provided
                if (llm_preferences !== undefined) {
                    // Must be an object or null
                    if (llm_preferences !== null && (typeof llm_preferences !== 'object' || Array.isArray(llm_preferences))) {
                        return res.status(400).json({
                            error: 'Invalid llm_preferences format',
                            details: 'llm_preferences must be an object or null'
                        });
                    }
                    
                    // If it's an object, check for disallowed keys
                    if (llm_preferences && typeof llm_preferences === 'object') {
                        // Characters can only override 'conversational', not 'analytical'
                        if (llm_preferences.analytical !== undefined) {
                            return res.status(400).json({
                                error: 'Invalid llm_preferences',
                                details: 'Characters cannot override analytical model configuration. Only conversational overrides are allowed.'
                            });
                        }
                    }
                }
                
                const updateData = {};
                
                if (name !== undefined) updateData.name = name.trim();
                if (description !== undefined) updateData.description = description.trim();
                if (background !== undefined) updateData.background = background.trim();
                if (avatar !== undefined) updateData.avatar = avatar;
                if (llm_preferences !== undefined) updateData.llm_preferences = llm_preferences;
                
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
                const userId = this.extractUserId(req);
                if (!userId) {
                    return res.status(400).json({ 
                        error: 'userId required',
                        details: 'Provide userId as query parameter or x-user-id header'
                    });
                }

                const { characterId } = req.params;
                console.log(`🗑️  Delete request for character: ${characterId}`);
                
                const databaseService = this.serviceFactory.get('database');
                
                // Check if character exists
                const existingCharacter = await databaseService.getDAL().personalities.getCharacter(characterId);
                if (!existingCharacter) {
                    console.log(`⚠️  Character not found: ${characterId}`);
                    return res.status(404).json({ 
                        success: false,
                        error: 'Character not found' 
                    });
                }

                // Verify ownership
                if (existingCharacter.user_id !== userId) {
                    console.log(`⚠️  User ${userId} attempted to delete character owned by ${existingCharacter.user_id}`);
                    return res.status(404).json({ 
                        success: false,
                        error: 'Character not found' 
                    });
                }
                
                console.log(`✅ Deleting character: ${existingCharacter.name} (${characterId})`);
                const result = await databaseService.getDAL().personalities.deleteCharacter(characterId);
                
                console.log(`✅ Character deleted successfully: ${characterId}`);
                res.json({
                    success: true,
                    data: result,
                    message: 'Character deleted successfully'
                });

            } catch (error) {
                console.error('❌ Character Delete API Error:', error);
                console.error('Error stack:', error.stack);
                res.status(500).json({ 
                    success: false,
                    error: 'Failed to delete character', 
                    details: error.message 
                });
            }
        });

        // Export a character as JSON file
        this.router.get('/:characterId/export', async (req, res) => {
            try {
                const userId = this.extractUserId(req);
                if (!userId) {
                    return res.status(400).json({ 
                        error: 'userId required',
                        details: 'Provide userId as query parameter or x-user-id header'
                    });
                }

                const { characterId } = req.params;
                const databaseService = this.serviceFactory.get('database');
                
                // Fetch character from database
                const character = await databaseService.getDAL().personalities.getCharacter(characterId);
                
                if (!character) {
                    return res.status(404).json({ 
                        error: 'Character not found' 
                    });
                }

                // Verify ownership
                if (character.user_id !== userId) {
                    return res.status(404).json({ 
                        error: 'Character not found' 
                    });
                }
                
                // Format export data with version and metadata
                const exportData = {
                    version: '1.0',
                    character: {
                        name: character.name,
                        description: character.description || '',
                        background: character.background || '',
                        traits: character.traits || '',
                        avatar: character.avatar || null,
                        llm_preferences: character.llm_preferences || null
                    },
                    exported_by: userId,
                    exported_at: new Date().toISOString()
                };
                
                // Set headers for file download
                const filename = `${character.name.replace(/[^a-zA-Z0-9]/g, '_')}_character_export.json`;
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
                
                res.json(exportData);

            } catch (error) {
                console.error('Character Export API Error:', error);
                res.status(500).json({ 
                    error: 'Failed to export character', 
                    details: error.message 
                });
            }
        });

        // Import a character from JSON file
        this.router.post('/import', async (req, res) => {
            try {
                const userId = this.extractUserId(req);
                if (!userId) {
                    return res.status(400).json({ 
                        error: 'userId required',
                        details: 'Provide userId as query parameter or x-user-id header'
                    });
                }

                const importData = req.body;
                const databaseService = this.serviceFactory.get('database');
                
                // Validate JSON structure
                if (!importData || typeof importData !== 'object') {
                    return res.status(400).json({
                        error: 'Invalid import data',
                        details: 'Import data must be a valid JSON object'
                    });
                }
                
                if (!importData.version) {
                    return res.status(400).json({
                        error: 'Invalid import format',
                        details: 'Missing version field'
                    });
                }
                
                if (!importData.character || typeof importData.character !== 'object') {
                    return res.status(400).json({
                        error: 'Invalid import format',
                        details: 'Missing or invalid character field'
                    });
                }
                
                const characterData = importData.character;
                
                // Validate required fields
                if (!characterData.name || !characterData.name.trim()) {
                    return res.status(400).json({
                        error: 'Invalid character data',
                        details: 'Character name is required'
                    });
                }
                
                // Check and validate LLM preferences if present
                let validatedLLMPreferences = characterData.llm_preferences;
                
                if (validatedLLMPreferences && typeof validatedLLMPreferences === 'object') {
                    // Validate that only conversational preferences are set
                    if (validatedLLMPreferences.analytical !== undefined) {
                        return res.status(400).json({
                            error: 'Invalid llm_preferences',
                            details: 'Characters cannot override analytical model configuration'
                        });
                    }
                    
                    // Check if the specified conversational model exists
                    if (validatedLLMPreferences.conversational?.model) {
                        try {
                            const llmConfigService = this.serviceFactory.get('llmConfig');
                            const availableModels = await llmConfigService.getAvailableModels();
                            const modelExists = availableModels.some(m => m.id === validatedLLMPreferences.conversational.model);
                            
                            if (!modelExists) {
                                console.warn('Imported character model not found, falling back to user default', {
                                    requestedModel: validatedLLMPreferences.conversational.model
                                });
                                
                                // Fall back to user default by getting user preferences
                                const userPrefs = await llmConfigService.getUserLLMPreferences(userId);
                                if (userPrefs?.conversational?.model) {
                                    validatedLLMPreferences.conversational.model = userPrefs.conversational.model;
                                } else {
                                    // If no user default, fall back to global default
                                    const globalConfig = await llmConfigService.getGlobalLLMConfig('conversational');
                                    if (globalConfig?.model) {
                                        validatedLLMPreferences.conversational.model = globalConfig.model;
                                    } else {
                                        // Remove LLM preferences if no fallback is available
                                        validatedLLMPreferences = null;
                                    }
                                }
                            }
                        } catch (llmConfigError) {
                            console.error('Error validating LLM model, removing preferences:', llmConfigError);
                            validatedLLMPreferences = null;
                        }
                    }
                }
                
                // Create character with new ID
                const characterId = uuidv4();
                const newCharacterData = {
                    id: characterId,
                    user_id: userId,
                    name: characterData.name.trim(),
                    description: characterData.description?.trim() || '',
                    background: characterData.background?.trim() || '',
                    traits: characterData.traits?.trim() || '',
                    avatar: characterData.avatar || null,
                    llm_preferences: validatedLLMPreferences
                };
                
                const result = await databaseService.getDAL().personalities.createCharacter(newCharacterData);
                
                res.json({
                    success: true,
                    data: { ...newCharacterData, ...result },
                    message: 'Character imported successfully',
                    warnings: validatedLLMPreferences !== characterData.llm_preferences 
                        ? ['LLM model preferences were adjusted due to unavailable model']
                        : []
                });

            } catch (error) {
                console.error('❌ Character Import API Error:', error);
                console.error('Error stack:', error.stack);
                res.status(500).json({ 
                    success: false,
                    error: 'Failed to import character', 
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
