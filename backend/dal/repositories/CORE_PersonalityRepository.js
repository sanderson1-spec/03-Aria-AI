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
            
            const personalities = await this.dal.findAll(this.tableName, {
                orderBy: 'updated_at DESC',
                limit: pageSize,
                offset: offset
            });

            const totalCount = await this.dal.count(this.tableName);

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
                is_active: true
            };

            const result = await this.dal.insertOrReplace(this.tableName, data);
            return { created: result.changes > 0, id: personality.id };
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
            return await this.dal.findAll(this.tableName, {
                columns: ['id', 'name', 'display', 'description', 'usage_count', 'is_active', 'created_at', 'updated_at'],
                orderBy: 'updated_at DESC',
                limit: limit
            });
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
            const stats = await this.dal.findAll(this.tableName, {
                columns: [
                    'id', 'name', 'display', 'usage_count', 'is_active', 'created_at', 'updated_at',
                    'description', 'definition'
                ],
                orderBy: 'usage_count DESC'
            });

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
            const personality = await this.dal.findOne(this.tableName, {
                columns: ['id', 'name', 'display', 'description', 'usage_count', 'is_active', 'created_at'],
                conditions: { id: personalityId }
            });

            if (!personality) {
                return null;
            }

            // Get associated data
            const [
                psychologyFramework,
                psychologicalState,
                recentInteractions
            ] = await Promise.all([
                this.dal.findOne('character_psychological_frameworks', {
                    conditions: { personality_id: personalityId }
                }),
                this.dal.findOne('character_psychological_state', {
                    conditions: { personality_id: personalityId }
                }),
                this.dal.findAll('llm_interactions', {
                    conditions: { personality_id: personalityId },
                    orderBy: 'created_at DESC',
                    limit: 5
                })
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
}

module.exports = PersonalityRepository;