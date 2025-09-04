const BaseRepository = require('../CORE_BaseRepository');

/**
 * PsychologyRepository - Handles psychological state management
 * CLEAN ARCHITECTURE: Infrastructure layer psychology management
 */
class PsychologyRepository extends BaseRepository {
    constructor(tableName, dependencies) {
        super(tableName, dependencies);
    }

    /**
     * Initialize the PsychologyRepository
     * CLEAN ARCHITECTURE: Repository initialization
     */
    async initialize() {
        // Repository initialization - ensure tables exist through migrations
        this.logger.info('PsychologyRepository initialized', 'PsychologyRepository');
        return true;
    }

    /**
     * DOMAIN LAYER: Access character psychological frameworks (MULTI-TABLE SUPPORT)
     */
    async getCharacterPsychologicalFrameworks(userId, characterId) {
        try {
            const sql = `
                SELECT * FROM character_psychological_frameworks 
                WHERE personality_id = ?
                ORDER BY created_at DESC
            `;
            return await this.dbAccess.query(sql, [characterId]);
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to get character frameworks', { userId, characterId });
        }
    }

    /**
     * DOMAIN LAYER: Access character psychological state (MULTI-TABLE SUPPORT)
     */
    async getCharacterPsychologicalState(userId, characterId) {
        try {
            const sql = `
                SELECT * FROM character_psychological_state 
                WHERE user_id = ? AND personality_id = ?
                ORDER BY last_updated DESC
                LIMIT 1
            `;
            return await this.dbAccess.queryOne(sql, [userId, characterId]);
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to get character state', { userId, characterId });
        }
    }

    /**
     * DOMAIN LAYER: Create/Update character psychological state (MULTI-TABLE SUPPORT)
     */
    async saveCharacterPsychologicalState(userId, characterId, stateData) {
        try {
            const stateId = require('uuid').v4();
            const now = new Date().toISOString();
            
            const state = {
                id: stateId,
                user_id: userId,
                character_id: characterId,
                framework_id: stateData.framework_id,
                state_data: JSON.stringify(stateData.state_data || {}),
                created_at: now,
                updated_at: now
            };

            const sql = `
                INSERT OR REPLACE INTO character_psychological_state 
                (id, user_id, character_id, framework_id, state_data, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `;
            
            await this.dbAccess.run(sql, [
                state.id, state.user_id, state.character_id, state.framework_id,
                state.state_data, state.created_at, state.updated_at
            ]);
            
            return stateId;
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to save character psychological state', { userId, characterId, stateData });
        }
    }

    /**
     * DOMAIN LAYER: Access psychology evolution log (MULTI-TABLE SUPPORT)
     */
    async getPsychologyEvolutionLog(userId, characterId, limit = 50) {
        try {
            const sql = `
                SELECT * FROM psychology_evolution_log 
                WHERE user_id = ? AND character_id = ?
                ORDER BY timestamp DESC
                LIMIT ?
            `;
            return await this.dbAccess.query(sql, [userId, characterId, limit]);
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to get psychology evolution log', { userId, characterId, limit });
        }
    }

    /**
     * DOMAIN LAYER: Log psychology evolution event (MULTI-TABLE SUPPORT)
     */
    async logPsychologyEvolution(userId, characterId, evolutionData) {
        try {
            const logId = require('uuid').v4();
            const now = new Date().toISOString();
            
            const evolution = {
                id: logId,
                user_id: userId,
                character_id: characterId,
                change_type: evolutionData.change_type,
                before_state: JSON.stringify(evolutionData.before_state || {}),
                after_state: JSON.stringify(evolutionData.after_state || {}),
                trigger_event: evolutionData.trigger_event || null,
                significance_score: evolutionData.significance_score || 1.0,
                timestamp: now
            };

            const sql = `
                INSERT INTO psychology_evolution_log 
                (id, user_id, character_id, change_type, before_state, after_state, trigger_event, significance_score, timestamp)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            await this.dbAccess.run(sql, [
                evolution.id, evolution.user_id, evolution.character_id, evolution.change_type,
                evolution.before_state, evolution.after_state, evolution.trigger_event,
                evolution.significance_score, evolution.timestamp
            ]);
            
            return logId;
        } catch (error) {
            throw this.errorHandler.wrapRepositoryError(error, 'Failed to log psychology evolution', { userId, characterId, evolutionData });
        }
    }

    /**
     * ADMIN INTERFACE: Generic findAll method for admin interface
     * Returns all psychology frameworks (primary table for this repository)
     */
    async findAll() {
        return await super.findAll(this.frameworksTable);
    }

    /**
     * ADMIN INTERFACE: Generic findAllPaginated method for admin interface
     * Provides paginated access to psychology frameworks
     */
    async findAllPaginated(options = {}) {
        const { page = 1, limit = 50 } = options;
        const offset = (page - 1) * limit;
        
        const records = await super.query(
            `SELECT * FROM ${this.frameworksTable} ORDER BY updated_at DESC LIMIT ? OFFSET ?`, 
            [limit, offset]
        );
        
        const totalResult = await super.query(
            `SELECT COUNT(*) as count FROM ${this.frameworksTable}`, 
            []
        );
        const total = totalResult[0]?.count || 0;
        
        return {
            records,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        };
    }

    /**
     * ADMIN INTERFACE: Generic findById method for admin interface
     * Returns a specific psychology framework by ID
     */
    async findById(id) {
        this.validateRequiredFields({ id }, ['id'], 'findById');
        return await super.findById(this.frameworksTable, id);
    }

    /**
     * ADMIN INTERFACE: Get table name for admin interface
     * Returns the primary table name for this repository
     */
    getTableName() {
        return this.frameworksTable;
    }

    // ========================================================================
    // PSYCHOLOGICAL FRAMEWORKS - character_psychological_frameworks
    // ========================================================================

    /**
     * DOMAIN LAYER: Store/update psychological framework for personality
     * Saves character-specific psychological attributes derived from LLM analysis
     */
    async updatePsychologyFramework(personalityId, framework, version = 1) {
        this.validateRequiredFields(
            { personalityId, framework }, 
            ['personalityId', 'framework'], 
            'update psychology framework'
        );
        
        const frameworkData = {
            personality_id: personalityId,
            framework_data: JSON.stringify(framework),
            analysis_version: version,
            updated_at: this.getCurrentTimestamp()
        };

        // Use INSERT OR REPLACE to handle updates
        const sql = `
            INSERT OR REPLACE INTO character_psychological_frameworks (
                personality_id, framework_data, analysis_version, updated_at
            ) VALUES (?, ?, ?, ?)
        `;
        
        return await this.query(sql, [
            personalityId,
            JSON.stringify(framework),
            version,
            this.getCurrentTimestamp()
        ]);
    }

    /**
     * DOMAIN LAYER: Get psychological framework for personality
     */
    async getPsychologyFramework(personalityId) {
        this.validateRequiredFields(
            { personalityId }, 
            ['personalityId'], 
            'get psychology framework'
        );
        
        const result = await this.queryOne(
            'SELECT * FROM character_psychological_frameworks WHERE personality_id = ?',
            [personalityId]
        );
        
        if (result && result.framework_data) {
            try {
                return JSON.parse(result.framework_data);
            } catch (error) {
                this.logger.error('Error parsing framework data', 'PsychologyRepository', { error: error.message });
                return null;
            }
        }
        return null;
    }

    /**
     * DOMAIN LAYER: Get framework with metadata
     */
    async getFrameworkWithMetadata(personalityId) {
        this.validateRequiredFields(
            { personalityId }, 
            ['personalityId'], 
            'get framework with metadata'
        );
        
        const result = await this.queryOne(
            'SELECT * FROM character_psychological_frameworks WHERE personality_id = ?',
            [personalityId]
        );
        
        if (result) {
            try {
                result.framework_data = JSON.parse(result.framework_data);
            } catch (error) {
                this.logger.error('Error parsing framework data', 'PsychologyRepository', { error: error.message });
                result.framework_data = null;
            }
        }
        return result;
    }

    // ========================================================================
    // PSYCHOLOGICAL STATE - character_psychological_state
    // ========================================================================

    /**
     * DOMAIN LAYER: Update psychological state for session
     */
    async updatePsychologicalState(sessionId, personalityId, stateData) {
        this.validateRequiredFields(
            { sessionId, personalityId, stateData },
            ['sessionId', 'personalityId', 'stateData'],
            'update psychological state'
        );

        const stateRecord = {
            session_id: sessionId,
            personality_id: personalityId,
            current_emotion: stateData.current_emotion || 'neutral',
            emotional_intensity: stateData.emotional_intensity || 5,
            energy_level: stateData.energy_level || 5,
            stress_level: stateData.stress_level || 3,
            current_motivations: JSON.stringify(stateData.current_motivations || []),
            relationship_dynamic: stateData.relationship_dynamic || 'getting_to_know',
            active_interests: JSON.stringify(stateData.active_interests || []),
            communication_mode: stateData.communication_mode || 'default',
            internal_state_notes: stateData.internal_state_notes || '',
            last_updated: this.getCurrentTimestamp(),
            change_reason: stateData.change_reason || 'update',
            state_version: stateData.state_version || 1
        };

        const sql = `
            INSERT OR REPLACE INTO character_psychological_state (
                session_id, personality_id, current_emotion, emotional_intensity, 
                energy_level, stress_level, current_motivations, relationship_dynamic,
                active_interests, communication_mode, internal_state_notes,
                last_updated, change_reason, state_version
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        return await this.query(sql, [
            stateRecord.session_id,
            stateRecord.personality_id,
            stateRecord.current_emotion,
            stateRecord.emotional_intensity,
            stateRecord.energy_level,
            stateRecord.stress_level,
            stateRecord.current_motivations,
            stateRecord.relationship_dynamic,
            stateRecord.active_interests,
            stateRecord.communication_mode,
            stateRecord.internal_state_notes,
            stateRecord.last_updated,
            stateRecord.change_reason,
            stateRecord.state_version
        ]);
    }

    /**
     * DOMAIN LAYER: Get psychological state for session
     */
    async getPsychologicalState(sessionId) {
        this.validateRequiredFields(
            { sessionId }, 
            ['sessionId'], 
            'get psychological state'
        );
        
        const result = await this.queryOne(
            'SELECT * FROM character_psychological_state WHERE session_id = ?',
            [sessionId]
        );

        if (result) {
            // Parse JSON fields
            try {
                result.current_motivations = JSON.parse(result.current_motivations || '[]');
                result.active_interests = JSON.parse(result.active_interests || '[]');
            } catch (error) {
                this.logger.error('Error parsing psychological state JSON', 'PsychologyRepository', { error: error.message });
                result.current_motivations = [];
                result.active_interests = [];
            }
        }

        return result;
    }

    /**
     * DOMAIN LAYER: Get psychological state summary for session
     */
    async getPsychologyStateSummary(sessionId) {
        this.validateRequiredFields(
            { sessionId }, 
            ['sessionId'], 
            'get psychology state summary'
        );

        const sql = `
            SELECT 
                cps.*,
                cpf.framework_data,
                cpf.analysis_version,
                p.name as personality_name
            FROM character_psychological_state cps
            LEFT JOIN character_psychological_frameworks cpf ON cps.personality_id = cpf.personality_id
            LEFT JOIN personalities p ON cps.personality_id = p.id
            WHERE cps.session_id = ?
        `;

        const result = await this.queryOne(sql, [sessionId]);
        
        if (result) {
            try {
                result.current_motivations = JSON.parse(result.current_motivations || '[]');
                result.active_interests = JSON.parse(result.active_interests || '[]');
                result.framework_data = result.framework_data ? JSON.parse(result.framework_data) : null;
            } catch (error) {
                this.logger.error('Error parsing psychology summary JSON', 'PsychologyRepository', { error: error.message });
            }
        }

        return result;
    }

    // ========================================================================
    // MEMORY WEIGHTS - character_memory_weights
    // ========================================================================

    /**
     * DOMAIN LAYER: Save memory weight for message
     */
    async saveMemoryWeight(sessionId, messageId, weightData) {
        this.validateRequiredFields(
            { sessionId, messageId, weightData },
            ['sessionId', 'messageId', 'weightData'],
            'save memory weight'
        );

        const memoryWeight = {
            id: this.generateId(),
            session_id: sessionId,
            message_id: messageId,
            emotional_impact_score: weightData.emotional_impact_score || 5,
            relationship_relevance: weightData.relationship_relevance || 5,
            personal_significance: weightData.personal_significance || 5,
            contextual_importance: weightData.contextual_importance || 5,
            memory_type: weightData.memory_type || 'conversational',
            memory_tags: JSON.stringify(weightData.memory_tags || []),
            recall_frequency: weightData.recall_frequency || 0,
            last_recalled: weightData.last_recalled || null,
            created_at: this.getCurrentTimestamp(),
            updated_at: this.getCurrentTimestamp()
        };

        const sql = `
            INSERT OR REPLACE INTO character_memory_weights (
                id, session_id, message_id, emotional_impact_score, relationship_relevance,
                personal_significance, contextual_importance, memory_type, memory_tags,
                recall_frequency, last_recalled, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const result = await this.query(sql, [
            memoryWeight.id,
            memoryWeight.session_id,
            memoryWeight.message_id,
            memoryWeight.emotional_impact_score,
            memoryWeight.relationship_relevance,
            memoryWeight.personal_significance,
            memoryWeight.contextual_importance,
            memoryWeight.memory_type,
            memoryWeight.memory_tags,
            memoryWeight.recall_frequency,
            memoryWeight.last_recalled,
            memoryWeight.created_at,
            memoryWeight.updated_at
        ]);

        return { ...memoryWeight, ...result };
    }

    /**
     * DOMAIN LAYER: Get weighted memories for session
     */
    async getWeightedMemories(sessionId, limit = 10) {
        this.validateRequiredFields(
            { sessionId }, 
            ['sessionId'], 
            'get weighted memories'
        );

        const sql = `
            SELECT 
                cmw.*,
                cl.message,
                cl.sender,
                cl.timestamp,
                (cmw.emotional_impact_score + cmw.relationship_relevance + 
                 cmw.personal_significance + cmw.contextual_importance) as total_significance
            FROM character_memory_weights cmw
            JOIN conversation_logs cl ON cmw.message_id = cl.id AND cmw.session_id = cl.session_id
            WHERE cmw.session_id = ?
            ORDER BY total_significance DESC, cmw.recall_frequency DESC
            LIMIT ?
        `;

        const results = await this.query(sql, [sessionId, limit]);
        
        // Parse JSON fields
        return results.map(result => {
            try {
                result.memory_tags = JSON.parse(result.memory_tags || '[]');
            } catch (error) {
                this.logger.error('Error parsing memory tags', 'PsychologyRepository', { error: error.message });
                result.memory_tags = [];
            }
            return result;
        });
    }

    /**
     * DOMAIN LAYER: Update memory recall frequency
     */
    async updateMemoryRecall(sessionId, messageId) {
        this.validateRequiredFields(
            { sessionId, messageId },
            ['sessionId', 'messageId'],
            'update memory recall'
        );

        const sql = `
            UPDATE character_memory_weights 
            SET recall_frequency = recall_frequency + 1,
                last_recalled = ?,
                updated_at = ?
            WHERE session_id = ? AND message_id = ?
        `;

        return await this.query(sql, [
            this.getCurrentTimestamp(),
            this.getCurrentTimestamp(),
            sessionId,
            messageId
        ]);
    }

    // ========================================================================
    // PSYCHOLOGY EVOLUTION - psychology_evolution_log
    // ========================================================================

    /**
     * DOMAIN LAYER: Log psychology evolution/change
     */
    async logPsychologyEvolution(sessionId, personalityId, changeType, evolutionData) {
        this.validateRequiredFields(
            { sessionId, personalityId, changeType, evolutionData },
            ['sessionId', 'personalityId', 'changeType', 'evolutionData'],
            'log psychology evolution'
        );

        const evolutionLog = {
            id: this.generateId(),
            session_id: sessionId,
            personality_id: personalityId,
            previous_state: JSON.stringify(evolutionData.previous_state || {}),
            new_state: JSON.stringify(evolutionData.new_state || {}),
            trigger_message: evolutionData.trigger_message || '',
            analysis_reasoning: evolutionData.analysis_reasoning || '',
            emotional_shift_magnitude: evolutionData.emotional_shift_magnitude || 0.0,
            motivation_stability: evolutionData.motivation_stability || 1.0,
            relationship_progression: evolutionData.relationship_progression || 0.0,
            created_at: this.getCurrentTimestamp()
        };

        const sql = `
            INSERT INTO psychology_evolution_log (
                id, session_id, personality_id, previous_state, new_state,
                trigger_message, analysis_reasoning, emotional_shift_magnitude,
                motivation_stability, relationship_progression, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const result = await this.query(sql, [
            evolutionLog.id,
            evolutionLog.session_id,
            evolutionLog.personality_id,
            evolutionLog.previous_state,
            evolutionLog.new_state,
            evolutionLog.trigger_message,
            evolutionLog.analysis_reasoning,
            evolutionLog.emotional_shift_magnitude,
            evolutionLog.motivation_stability,
            evolutionLog.relationship_progression,
            evolutionLog.created_at
        ]);

        return { ...evolutionLog, ...result };
    }

    /**
     * DOMAIN LAYER: Get psychology evolution history
     */
    async getPsychologyEvolution(sessionId, limit = 20) {
        this.validateRequiredFields(
            { sessionId }, 
            ['sessionId'], 
            'get psychology evolution'
        );

        const sql = `
            SELECT * FROM psychology_evolution_log
            WHERE session_id = ?
            ORDER BY created_at DESC
            LIMIT ?
        `;

        const results = await this.query(sql, [sessionId, limit]);
        
        // Parse JSON fields
        return results.map(result => {
            try {
                result.previous_state = JSON.parse(result.previous_state || '{}');
                result.new_state = JSON.parse(result.new_state || '{}');
            } catch (error) {
                this.logger.error('Error parsing evolution state data', 'PsychologyRepository', { error: error.message });
                result.previous_state = {};
                result.new_state = {};
            }
            return result;
        });
    }

    // ========================================================================
    // CONVERSATION CONTEXT FOR PSYCHOLOGY
    // ========================================================================

    /**
     * DOMAIN LAYER: Get conversation context specifically for psychology analysis
     * This retrieves conversation history with weighting information
     */
    async getConversationContextForPsychology(sessionId, maxMessages = 10) {
        this.validateRequiredFields(
            { sessionId }, 
            ['sessionId'], 
            'get conversation context for psychology'
        );

        const sql = `
            SELECT 
                cl.*,
                cmw.emotional_impact_score,
                cmw.relationship_relevance,
                cmw.personal_significance,
                cmw.contextual_importance,
                cmw.memory_type,
                cmw.memory_tags,
                (cmw.emotional_impact_score + cmw.relationship_relevance + 
                 cmw.personal_significance + cmw.contextual_importance) as total_significance
            FROM conversation_logs cl
            LEFT JOIN character_memory_weights cmw ON cl.id = cmw.message_id AND cl.session_id = cmw.session_id
            WHERE cl.session_id = ?
            ORDER BY 
                CASE WHEN cmw.id IS NOT NULL THEN total_significance ELSE 0 END DESC,
                cl.timestamp DESC
            LIMIT ?
        `;

        const results = await this.query(sql, [sessionId, maxMessages]);
        
        // Parse JSON fields and format for psychology analysis
        return results.map(result => {
            if (result.memory_tags) {
                try {
                    result.memory_tags = JSON.parse(result.memory_tags);
                } catch (error) {
                    result.memory_tags = [];
                }
            }
            return result;
        });
    }

    // ========================================================================
    // ANALYTICS AND REPORTING
    // ========================================================================

    /**
     * DOMAIN LAYER: Get psychology analytics for personality
     */
    async getPsychologyAnalytics(personalityId) {
        this.validateRequiredFields(
            { personalityId }, 
            ['personalityId'], 
            'get psychology analytics'
        );

        const sql = `
            SELECT 
                COUNT(DISTINCT cps.session_id) as active_sessions,
                AVG(cps.emotional_intensity) as avg_emotional_intensity,
                AVG(cps.energy_level) as avg_energy_level,
                AVG(cps.stress_level) as avg_stress_level,
                COUNT(pel.id) as evolution_events,
                AVG(pel.emotional_shift_magnitude) as avg_emotional_shift,
                AVG(pel.relationship_progression) as avg_relationship_progression,
                COUNT(DISTINCT cmw.session_id) as sessions_with_memories,
                AVG(cmw.emotional_impact_score) as avg_memory_emotional_impact
            FROM character_psychological_state cps
            LEFT JOIN psychology_evolution_log pel ON cps.session_id = pel.session_id
            LEFT JOIN character_memory_weights cmw ON cps.session_id = cmw.session_id
            WHERE cps.personality_id = ?
        `;

        const result = await this.queryOne(sql, [personalityId]);
        return result || {};
    }

    /**
     * DOMAIN LAYER: Get recent psychology activity
     */
    async getRecentPsychologyActivity(limit = 10) {
        const sql = `
            SELECT 
                pel.created_at,
                pel.session_id,
                pel.personality_id,
                p.name as personality_name,
                pel.trigger_message,
                pel.emotional_shift_magnitude,
                pel.relationship_progression
            FROM psychology_evolution_log pel
            LEFT JOIN personalities p ON pel.personality_id = p.id
            ORDER BY pel.created_at DESC
            LIMIT ?
        `;

        return await this.query(sql, [limit]);
    }
}

module.exports = PsychologyRepository;