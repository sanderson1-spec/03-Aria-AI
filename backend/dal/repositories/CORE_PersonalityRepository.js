const BaseRepository = require('../CORE_BaseRepository');

/**
 * PersonalityRepository - Handles personality management
 * CLEAN ARCHITECTURE: Domain layer personality entity management
 */
class PersonalityRepository extends BaseRepository {
    constructor(tableName, dependencies) {
        super(tableName, dependencies);
    }

    /**
     * Get paginated personalities
     * CLEAN ARCHITECTURE: Domain layer pagination
     */
    async getPaginated(page = 1, pageSize = 10) {
        try {
            const offset = (page - 1) * pageSize;
            
            const personalities = await this.dal.query(
                `SELECT * FROM ${this.tableName} ORDER BY updated_at DESC LIMIT ? OFFSET ?`,
                [pageSize, offset]
            );

            const totalCount = await this.count();

            return {
                personalities,
                pagination: {
                    page,
                    pageSize,
                    totalPages: Math.ceil(totalCount / pageSize),
                    totalCount
                }
            };
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to get paginated personalities');
        }
    }

    /**
     * Create new personality
     * CLEAN ARCHITECTURE: Domain layer entity creation
     */
    async create(personality) {
        try {
            this.validateRequiredFields(personality, ['id', 'name', 'display'], 'create personality');

            const data = {
                ...personality,
                created_at: this.getCurrentTimestamp(),
                updated_at: this.getCurrentTimestamp(),
                usage_count: 0,
                is_active: 1
            };

            const result = await this.dal.create(this.tableName, data);
            return { created: true, id: result.id };
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to create personality');
        }
    }

    /**
     * Update existing personality
     * CLEAN ARCHITECTURE: Domain layer entity update
     */
    async update(personalityId, updates) {
        try {
            this.validateRequiredFields({ personalityId }, ['personalityId'], 'update personality');

            if (!updates || Object.keys(updates).length === 0) {
                throw new Error('Update data cannot be empty');
            }

            const updateData = {
                ...updates,
                updated_at: this.getCurrentTimestamp()
            };

            // Remove id from updates to prevent accidental overwrite
            delete updateData.id;

            const result = await this.dal.update(this.tableName, updateData, { id: personalityId });
            return { updated: result.changes > 0 };
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to update personality');
        }
    }

    /**
     * Hard delete personality with cascade cleanup
     * CLEAN ARCHITECTURE: Domain layer entity deletion
     */
    async delete(personalityId) {
        try {
            this.validateRequiredFields({ personalityId }, ['personalityId'], 'delete personality');

            this.logger.info(`Starting hard delete for personality: ${personalityId}`, 'PersonalityRepository');

            const deletionCounts = {};

            // Execute all deletes in a transaction
            await this.executeInTransaction(async () => {
                // CASCADE DELETE 1: Proactive message attempts
                const proactiveResult = await this.dal.delete('proactive_message_attempts', {
                    personality_id: personalityId
                });
                deletionCounts.proactiveMessages = proactiveResult.changes;

                // CASCADE DELETE 2: Assigned tasks
                const tasksResult = await this.dal.delete('assigned_tasks', {
                    personality_id: personalityId
                });
                deletionCounts.tasks = tasksResult.changes;

                // CASCADE DELETE 3: Quiz sessions
                const quizResult = await this.dal.delete('quiz_sessions', {
                    personality_id: personalityId
                });
                deletionCounts.quizSessions = quizResult.changes;

                // CASCADE DELETE 4: Training assignments
                const trainingResult = await this.dal.delete('training_assignments', {
                    personality_id: personalityId
                });
                deletionCounts.trainingAssignments = trainingResult.changes;

                // CASCADE DELETE 5: Anti-cheat analysis
                const antiCheatResult = await this.dal.delete('anti_cheat_analysis', {
                    assignment_id: {
                        IN: await this.dal.findAll('training_assignments', {
                            columns: ['id'],
                            conditions: { personality_id: personalityId }
                        }).map(row => row.id)
                    }
                });
                deletionCounts.antiCheatAnalysis = antiCheatResult.changes;

                // CASCADE DELETE 6: LLM interactions
                const llmResult = await this.dal.delete('llm_interactions', {
                    personality_id: personalityId
                });
                deletionCounts.llmInteractions = llmResult.changes;

                // CASCADE DELETE 7: Character psychological frameworks
                const frameworkResult = await this.dal.delete('character_psychological_frameworks', {
                    personality_id: personalityId
                });
                deletionCounts.psychologicalFrameworks = frameworkResult.changes;

                // CASCADE DELETE 8: Character psychological states
                const stateResult = await this.dal.delete('character_psychological_state', {
                    personality_id: personalityId
                });
                deletionCounts.psychologicalStates = stateResult.changes;

                // CASCADE DELETE 9: Character memory weights
                const memoryResult = await this.dal.delete('character_memory_weights', {
                    session_id: {
                        IN: await this.dal.findAll('character_psychological_state', {
                            columns: ['session_id'],
                            conditions: { personality_id: personalityId }
                        }).map(row => row.session_id)
                    }
                });
                deletionCounts.memoryWeights = memoryResult.changes;

                // CASCADE DELETE 10: Psychology evolution logs
                const evolutionResult = await this.dal.delete('psychology_evolution_log', {
                    personality_id: personalityId
                });
                deletionCounts.psychologyEvolution = evolutionResult.changes;

                // FINAL DELETE: Remove the personality itself
                const personalityResult = await this.dal.delete(this.tableName, {
                    id: personalityId
                });
                deletionCounts.personality = personalityResult.changes;
            });

            const totalDeleted = Object.values(deletionCounts).reduce((sum, count) => sum + count, 0);
            this.logger.info(`Hard delete completed for personality ${personalityId}`, 'PersonalityRepository', { deletionCounts, totalDeleted });

            return {
                success: true,
                deleted: true,
                cascadeDeleted: deletionCounts,
                totalDeleted: totalDeleted
            };
        } catch (error) {
            this.logger.error(`Hard delete failed for personality ${personalityId}`, 'PersonalityRepository', { error: error.message });
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to delete personality');
        }
    }

    /**
     * Get total number of personalities
     * CLEAN ARCHITECTURE: Domain layer statistics
     */
    async getPersonalityCount() {
        try {
            return await this.count();
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to get personality count');
        }
    }

    /**
     * Get active personality count
     * CLEAN ARCHITECTURE: Domain layer statistics
     */
    async getActiveCount() {
        try {
            return await this.count({ is_active: true });
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to get active personality count');
        }
    }

    /**
     * Get recently active personalities
     * CLEAN ARCHITECTURE: Domain layer entity retrieval
     */
    async getRecentlyActive(limit = 5) {
        try {
            return await this.dal.query(
                `SELECT id, name, display, description, usage_count, is_active, created_at, updated_at FROM ${this.tableName} ORDER BY updated_at DESC LIMIT ?`,
                [limit]
            );
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to get recently active personalities');
        }
    }

    /**
     * Get personality usage statistics
     * CLEAN ARCHITECTURE: Domain layer analytics
     */
    async getUsageStats() {
        try {
            const stats = await this.dal.query(
                `SELECT id, name, display, usage_count, is_active, created_at, updated_at, description, definition FROM ${this.tableName} ORDER BY usage_count DESC`
            );

            return stats.map(personality => ({
                ...personality,
                definition: JSON.parse(personality.definition || '{}')
            }));
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to get personality usage stats');
        }
    }

    /**
     * Get personality by ID with full details
     * CLEAN ARCHITECTURE: Domain layer entity retrieval
     */
    async getFullDetails(personalityId) {
        try {
            const personality = await this.dal.queryOne(
                `SELECT id, name, display, description, usage_count, is_active, created_at FROM ${this.tableName} WHERE id = ?`,
                [personalityId]
            );

            if (!personality) {
                return null;
            }

            // Get associated data
            const [
                psychologyFramework,
                psychologicalState,
                recentInteractions
            ] = await Promise.all([
                this.dal.queryOne(
                    'SELECT * FROM character_psychological_frameworks WHERE personality_id = ?',
                    [personalityId]
                ),
                this.dal.queryOne(
                    'SELECT * FROM character_psychological_state WHERE personality_id = ?',
                    [personalityId]
                ),
                this.dal.query(
                    'SELECT * FROM llm_interactions WHERE personality_id = ? ORDER BY created_at DESC LIMIT 5',
                    [personalityId]
                )
            ]);

            return {
                ...personality,
                psychologyFramework: psychologyFramework?.framework_data ? JSON.parse(psychologyFramework.framework_data) : null,
                psychologicalState: psychologicalState?.state_data ? JSON.parse(psychologicalState.state_data) : null,
                recentInteractions
            };
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to get personality full details');
        }
    }

    // === CHARACTER MANAGEMENT METHODS ===
    // Following existing architecture: personalities are global, not user-specific
    
    /**
     * Get all available characters (global personalities)
     * CLEAN ARCHITECTURE: Domain layer entity retrieval
     */
    async getAllCharacters() {
        try {
            const characters = await this.findAll({ is_active: 1 }, 'updated_at DESC');
            
            // Parse llm_preferences JSON for each character
            return characters.map(character => {
                if (character.llm_preferences) {
                    try {
                        character.llm_preferences = JSON.parse(character.llm_preferences);
                    } catch (e) {
                        // If parsing fails, leave as is
                        this.logger.warn('Failed to parse llm_preferences JSON', 'PersonalityRepository', { characterId: character.id });
                    }
                }
                return character;
            });
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to get all characters');
        }
    }

    /**
     * Get user-specific characters
     * CLEAN ARCHITECTURE: Domain layer entity retrieval with user isolation
     */
    async getUserCharacters(userId) {
        try {
            this.validateRequiredFields({ userId }, ['userId'], 'get user characters');
            
            const characters = await this.findAll(
                { user_id: userId, is_active: 1 }, 
                'created_at DESC'
            );
            
            // Parse JSON fields and handle image data for each character
            return characters.map(character => {
                // Parse llm_preferences JSON
                if (character.llm_preferences) {
                    try {
                        character.llm_preferences = JSON.parse(character.llm_preferences);
                    } catch (e) {
                        // If parsing fails, leave as is
                        this.logger.warn('Failed to parse llm_preferences JSON', 'PersonalityRepository', { characterId: character.id });
                    }
                }
                
                // Handle image data: if image_type is 'upload', convert to data URL
                if (character.image_type === 'upload' && character.image_data) {
                    try {
                        const metadata = character.image_metadata ? JSON.parse(character.image_metadata) : {};
                        const mimetype = metadata.mimetype || 'image/jpeg';
                        // Convert base64 to data URL for frontend
                        character.display = `data:${mimetype};base64,${character.image_data}`;
                    } catch (e) {
                        this.logger.warn('Failed to process image data', 'PersonalityRepository', { characterId: character.id });
                    }
                }
                
                return character;
            });
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to get user characters');
        }
    }

    /**
     * Get a specific character by ID
     * CLEAN ARCHITECTURE: Domain layer entity retrieval with optional user ownership check
     * @param {string} characterId - The character ID to retrieve
     * @param {string} [userId] - Optional user ID to verify ownership
     * @returns {object|null} Character object or null if not found/unauthorized
     */
    async getCharacter(characterId, userId = null) {
        try {
            this.validateRequiredFields({ characterId }, ['characterId'], 'get character');
            
            const character = await this.findById(characterId);
            
            // If no character found, return null
            if (!character) {
                return null;
            }
            
            // If userId provided, verify ownership
            if (userId !== null && character.user_id !== userId) {
                this.logger.warn('User attempted to access character they do not own', 'PersonalityRepository', { 
                    characterId, 
                    userId, 
                    ownerId: character.user_id 
                });
                return null;
            }
            
            // Parse llm_preferences JSON
            if (character.llm_preferences) {
                try {
                    character.llm_preferences = JSON.parse(character.llm_preferences);
                } catch (e) {
                    // If parsing fails, leave as is
                    this.logger.warn('Failed to parse llm_preferences JSON', 'PersonalityRepository', { characterId });
                }
            }
            
            // Handle image data: if image_type is 'upload', convert to data URL
            if (character.image_type === 'upload' && character.image_data) {
                try {
                    const metadata = character.image_metadata ? JSON.parse(character.image_metadata) : {};
                    const mimetype = metadata.mimetype || 'image/jpeg';
                    // Convert base64 to data URL for frontend
                    character.display = `data:${mimetype};base64,${character.image_data}`;
                } catch (e) {
                    this.logger.warn('Failed to process image data', 'PersonalityRepository', { characterId });
                }
            }
            
            return character;
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to get character');
        }
    }

    /**
     * Create a new character
     * CLEAN ARCHITECTURE: Domain layer entity creation with user isolation
     */
    async createCharacter(characterData) {
        try {
            this.validateRequiredFields(characterData, ['id', 'name', 'user_id'], 'create character');

            const data = {
                id: characterData.id,
                name: characterData.name,
                user_id: characterData.user_id,
                display: characterData.avatar || 'default.png',
                description: characterData.description || '',
                definition: characterData.background || '',
                personality_traits: JSON.stringify({
                    core_traits: [],
                    emotional_range: [],
                    learning_style: 'adaptive',
                    relationship_approach: 'friendly'
                }),
                communication_style: JSON.stringify({
                    default_tone: 'friendly',
                    adaptability: 'moderate',
                    formality_range: ['casual', 'professional'],
                    humor_level: 'moderate',
                    emotional_expression: 'authentic'
                }),
                created_at: this.getCurrentTimestamp(),
                updated_at: this.getCurrentTimestamp(),
                usage_count: 0,
                is_active: 1
            };

            // Handle image data if provided
            if (characterData.imageData) {
                data.image_data = characterData.imageData;
                data.image_type = 'upload';
                data.image_metadata = JSON.stringify({
                    filename: characterData.imageFilename || 'uploaded_image',
                    mimetype: characterData.imageMimetype || 'image/jpeg',
                    size: characterData.imageSize || 0,
                    uploadedAt: this.getCurrentTimestamp()
                });
            } else if (characterData.avatar && characterData.avatar.startsWith('http')) {
                data.image_type = 'url';
            } else {
                data.image_type = 'path';
            }

            const result = await this.create(data);
            this.logger.info('Character created successfully', 'PersonalityRepository', { 
                characterId: result.id, 
                userId: characterData.user_id,
                imageType: data.image_type
            });
            return { created: true, id: result.id };
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to create character');
        }
    }

    /**
     * Update an existing character
     * CLEAN ARCHITECTURE: Domain layer entity update
     */
    async updateCharacter(characterId, updateData) {
        try {
            this.validateRequiredFields({ characterId }, ['characterId'], 'update character');

            if (!updateData || Object.keys(updateData).length === 0) {
                throw new Error('Update data cannot be empty');
            }

            // Get current character data to merge with updates
            const currentCharacter = await this.getCharacter(characterId);
            if (!currentCharacter) {
                throw new Error('Character not found');
            }
            
            const data = {
                updated_at: this.getCurrentTimestamp()
            };

            if (updateData.name !== undefined) {
                data.name = updateData.name;
            }
            if (updateData.description !== undefined) {
                data.description = updateData.description;
            }
            if (updateData.background !== undefined) {
                data.definition = updateData.background;
            }
            if (updateData.avatar !== undefined) {
                data.display = updateData.avatar || 'default.png';
                // Update image type based on avatar value
                if (updateData.avatar && updateData.avatar.startsWith('http')) {
                    data.image_type = 'url';
                    data.image_data = null; // Clear any stored image data
                } else if (!updateData.imageData) {
                    data.image_type = 'path';
                    data.image_data = null; // Clear any stored image data
                }
            }
            // Handle image upload
            if (updateData.imageData) {
                data.image_data = updateData.imageData;
                data.image_type = 'upload';
                data.image_metadata = JSON.stringify({
                    filename: updateData.imageFilename || 'uploaded_image',
                    mimetype: updateData.imageMimetype || 'image/jpeg',
                    size: updateData.imageSize || 0,
                    uploadedAt: this.getCurrentTimestamp()
                });
                // When uploading image, update display to reference the image
                data.display = updateData.imageFilename || 'uploaded_image';
            }
            if (updateData.llm_preferences !== undefined) {
                // Store as JSON string if it's an object, or as-is if null
                data.llm_preferences = updateData.llm_preferences !== null 
                    ? JSON.stringify(updateData.llm_preferences)
                    : null;
            }

            const result = await this.dal.update(this.tableName, data, { id: characterId });
            
            return { updated: result.changes > 0 };
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to update character');
        }
    }

    /**
     * Delete a character (admin/creator only - global operation)
     * CLEAN ARCHITECTURE: Domain layer entity deletion
     */
    async deleteCharacter(characterId) {
        try {
            this.validateRequiredFields({ characterId }, ['characterId'], 'delete character');

            // Soft delete: set is_active to 0
            const result = await this.update(characterId, { is_active: 0 });
            
            return { deleted: result.changes > 0 };
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to delete character');
        }
    }
}

module.exports = PersonalityRepository;