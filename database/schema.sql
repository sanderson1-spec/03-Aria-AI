-- ============================================================================
-- Aria AI Unified Database Schema
-- CLEAN ARCHITECTURE: Single source of truth for all database tables
-- ============================================================================
--
-- FEATURES INCLUDED:
-- ✅ Multi-user support with session management
-- ✅ Dynamic character psychology system
-- ✅ Proactive intelligence capabilities
-- ✅ Analytics and configuration management
-- ❌ Agent system tables (removed)
-- ❌ Task management (removed)
-- ❌ Admin operations (removed)
--
-- ARCHITECTURE:
-- - Foundation: Users, sessions, configuration
-- - Core: Chats, conversations, personalities
-- - Psychology: Dynamic character behavior and memory
-- - Intelligence: Proactive engagement system
-- - Analytics: Usage tracking and insights
-- ============================================================================

-- Schema version tracking
CREATE TABLE IF NOT EXISTS schema_versions (
    id TEXT PRIMARY KEY,
    version TEXT NOT NULL,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    description TEXT
);

-- ============================================================================
-- FOUNDATION LAYER: User Management & Sessions
-- ============================================================================

-- Users table for multi-user support
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,                -- UUID for each user
    username TEXT UNIQUE NOT NULL,      -- Unique username for login
    email TEXT UNIQUE,                  -- Optional email for recovery
    password_hash TEXT,                 -- Hashed password (if using local auth)
    display_name TEXT,                  -- User's display name
    preferences TEXT DEFAULT '{}',      -- JSON user preferences
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT 1         -- Whether user account is active
);

-- User sessions table for cross-device continuity
CREATE TABLE IF NOT EXISTS user_sessions (
    id TEXT PRIMARY KEY,                -- Session UUID
    user_id TEXT NOT NULL,              -- Reference to user
    chat_id TEXT,                       -- Current active chat (optional)
    device_info TEXT DEFAULT '{}',      -- Device information (browser, mobile, etc.)
    ip_address TEXT,                    -- User's IP address
    session_data TEXT DEFAULT '{}',     -- Additional session data
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,                -- Session expiration
    is_active BOOLEAN DEFAULT 1,        -- Whether session is still valid
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================================================
-- CORE LAYER: Chat System
-- ============================================================================

-- Character personalities
CREATE TABLE IF NOT EXISTS personalities (
    id TEXT PRIMARY KEY,                -- UUID for each personality
    name TEXT NOT NULL,                 -- Display name of the personality
    display TEXT NOT NULL DEFAULT 'default.png', -- Display image or avatar URL
    description TEXT NOT NULL,          -- Describes appearance and common traits  
    definition TEXT NOT NULL,           -- Background information and detailed character traits
    personality_traits TEXT DEFAULT '{}', -- JSON with core personality traits
    communication_style TEXT DEFAULT '{}', -- JSON with communication preferences
    is_active BOOLEAN DEFAULT 1,        -- Whether the personality is active/available
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    usage_count INTEGER DEFAULT 0       -- How many times this personality has been used
);

-- Chat management with multi-user support
CREATE TABLE IF NOT EXISTS chats (
    id TEXT PRIMARY KEY,                -- UUID for each chat
    user_id TEXT NOT NULL,              -- Reference to user (MULTI-USER SUPPORT)
    title TEXT NOT NULL,                -- Chat title/name
    personality_id TEXT NOT NULL,       -- Reference to the personality used
    chat_metadata TEXT DEFAULT '{}',    -- JSON metadata (settings, preferences)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT 1,        -- Whether the chat is active
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (personality_id) REFERENCES personalities(id)
);

-- Conversation history with multi-user support
CREATE TABLE IF NOT EXISTS conversation_logs (
    id TEXT PRIMARY KEY,                -- UUID for each message
    user_id TEXT NOT NULL,              -- Reference to user (MULTI-USER SUPPORT)
    chat_id TEXT NOT NULL,              -- Reference to the chat
    role TEXT NOT NULL,                 -- 'user' or 'assistant'
    content TEXT NOT NULL,              -- Message content
    metadata TEXT DEFAULT '{}',         -- JSON metadata (tokens, processing time, etc.)
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
);

-- Session management for psychology continuity
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,                -- Session UUID
    user_id TEXT NOT NULL,              -- Reference to user
    chat_id TEXT,                       -- Reference to chat (optional)
    personality_id TEXT,                -- Reference to personality (optional)
    session_data TEXT DEFAULT '{}',     -- JSON session state
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT 1,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE SET NULL,
    FOREIGN KEY (personality_id) REFERENCES personalities(id) ON DELETE SET NULL
);

-- ============================================================================
-- PSYCHOLOGY LAYER: Dynamic Character Psychology System
-- ============================================================================

-- Character-specific psychological frameworks (LLM-derived)
CREATE TABLE IF NOT EXISTS character_psychological_frameworks (
    id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
    personality_id TEXT NOT NULL UNIQUE,               -- Functional primary key
    framework_data TEXT NOT NULL,        -- JSON with character-specific psychological framework
    analysis_version INTEGER DEFAULT 1,  -- Track framework analysis versions
    framework_metadata TEXT DEFAULT '{}', -- Additional framework information
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (personality_id) REFERENCES personalities(id) ON DELETE CASCADE
);

-- Dynamic character psychological state (session-based)
CREATE TABLE IF NOT EXISTS character_psychological_state (
    id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
    session_id TEXT NOT NULL UNIQUE,                   -- Functional primary key
    personality_id TEXT NOT NULL,
    user_id TEXT NOT NULL,               -- Reference to user for isolation
    
    -- Core emotional state
    current_emotion TEXT DEFAULT 'neutral',     -- From character's natural emotional range
    emotional_intensity INTEGER DEFAULT 5,     -- 1-10 scale
    energy_level INTEGER DEFAULT 5,            -- 1-10 scale
    stress_level INTEGER DEFAULT 3,            -- 1-10 scale
    
    -- Dynamic character-specific state (stored as JSON)
    current_motivations TEXT DEFAULT '[]',      -- JSON array of what they want right now
    relationship_dynamic TEXT DEFAULT 'getting_to_know',  -- How they see this relationship
    active_interests TEXT DEFAULT '[]',         -- JSON array of current interests  
    communication_mode TEXT DEFAULT 'default', -- Their current expression style
    internal_state_notes TEXT DEFAULT '',      -- Freeform notes about their mindset
    
    -- Change tracking
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
    change_reason TEXT DEFAULT 'initialization',
    state_version INTEGER DEFAULT 1,
    
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (personality_id) REFERENCES personalities(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Character memory importance weighting
CREATE TABLE IF NOT EXISTS character_memory_weights (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    user_id TEXT NOT NULL,               -- Reference to user for isolation
    message_id TEXT NOT NULL,            -- Reference to conversation log
    
    -- Memory significance scores
    emotional_impact_score INTEGER DEFAULT 5,   -- 1-10 how emotionally significant
    relationship_relevance INTEGER DEFAULT 5,   -- 1-10 how it affects relationship
    personal_significance INTEGER DEFAULT 5,    -- 1-10 how personally meaningful
    contextual_importance INTEGER DEFAULT 5,    -- 1-10 how important for context
    
    -- Memory metadata
    memory_type TEXT DEFAULT 'conversational',  -- conversational, emotional, factual, relational
    memory_tags TEXT DEFAULT '[]',              -- JSON array of topic tags
    recall_frequency INTEGER DEFAULT 0,         -- how often it's been referenced
    last_recalled DATETIME,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (message_id) REFERENCES conversation_logs(id) ON DELETE CASCADE
);

-- Psychology evolution tracking (for learning and improvement)
CREATE TABLE IF NOT EXISTS psychology_evolution_log (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    personality_id TEXT NOT NULL,
    user_id TEXT NOT NULL,               -- Reference to user for isolation
    
    -- State change details
    previous_state TEXT NOT NULL,        -- JSON snapshot of previous state
    new_state TEXT NOT NULL,             -- JSON snapshot of new state
    trigger_message TEXT NOT NULL,       -- Message that caused the change
    analysis_reasoning TEXT,             -- LLM reasoning for the change
    
    -- Change metrics
    emotional_shift_magnitude REAL DEFAULT 0.0,  -- How much emotion changed
    motivation_stability REAL DEFAULT 1.0,       -- How stable motivations are
    relationship_progression REAL DEFAULT 0.0,   -- Relationship development score
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (personality_id) REFERENCES personalities(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Psychology frameworks storage (for reusable psychology patterns)
CREATE TABLE IF NOT EXISTS psychology_frameworks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,           -- Framework name
    description TEXT,                    -- Framework description
    framework_data TEXT NOT NULL,       -- JSON framework definition
    version INTEGER DEFAULT 1,          -- Framework version
    is_active BOOLEAN DEFAULT 1,        -- Whether framework is active
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
-- ============================================================================
-- INTELLIGENCE LAYER: Proactive Engagement System
-- ============================================================================

-- Proactive engagements (core feature)
CREATE TABLE IF NOT EXISTS proactive_engagements (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,               -- Reference to user for isolation
    chat_id TEXT,                        -- Reference to chat (optional)
    personality_id TEXT NOT NULL,        -- Reference to personality
    session_id TEXT,                     -- Reference to session (optional)
    
    -- Engagement details
    engagement_type TEXT NOT NULL,       -- Type of proactive engagement
    trigger_context TEXT NOT NULL,       -- What triggered this engagement
    engagement_content TEXT NOT NULL,    -- The actual engagement content
    engagement_metadata TEXT DEFAULT '{}', -- Additional engagement data
    
    -- Timing and success metrics
    optimal_timing DATETIME,             -- When this should be delivered
    actual_timing DATETIME DEFAULT CURRENT_TIMESTAMP, -- When it was actually sent
    user_response_type TEXT,             -- How user responded (positive, negative, neutral, ignored)
    engagement_success_score REAL DEFAULT 0.0, -- Success rating (0-1)
    
    -- Status tracking
    status TEXT DEFAULT 'pending',       -- pending, sent, responded, ignored
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE SET NULL,
    FOREIGN KEY (personality_id) REFERENCES personalities(id) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL
);

-- Proactive learning patterns
CREATE TABLE IF NOT EXISTS proactive_learning_patterns (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,               -- Reference to user for isolation
    personality_id TEXT NOT NULL,        -- Reference to personality
    
    -- Pattern details
    pattern_type TEXT NOT NULL,          -- Type of learned pattern
    pattern_data TEXT NOT NULL,          -- JSON pattern definition
    confidence_score REAL DEFAULT 0.0,  -- Confidence in this pattern (0-1)
    usage_count INTEGER DEFAULT 0,      -- How often this pattern has been used
    success_rate REAL DEFAULT 0.0,      -- Success rate when using this pattern
    
    -- Learning metadata
    source_interactions TEXT DEFAULT '[]', -- JSON array of interaction IDs that created this pattern
    last_validated DATETIME,            -- When this pattern was last validated
    validation_score REAL DEFAULT 0.0,  -- Validation confidence
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (personality_id) REFERENCES personalities(id) ON DELETE CASCADE
);

-- Proactive timing optimizations
CREATE TABLE IF NOT EXISTS proactive_timing_optimizations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,               -- Reference to user for isolation
    personality_id TEXT NOT NULL,        -- Reference to personality
    
    -- Timing analysis
    engagement_type TEXT NOT NULL,       -- Type of engagement being optimized
    optimal_conditions TEXT NOT NULL,    -- JSON conditions for optimal timing
    timing_patterns TEXT NOT NULL,       -- JSON timing patterns learned
    success_metrics TEXT NOT NULL,       -- JSON success metrics
    
    -- Optimization metadata
    sample_size INTEGER DEFAULT 0,      -- Number of interactions analyzed
    confidence_level REAL DEFAULT 0.0,  -- Confidence in timing optimization
    last_optimization DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (personality_id) REFERENCES personalities(id) ON DELETE CASCADE
);

-- Proactive engagement history
CREATE TABLE IF NOT EXISTS proactive_engagement_history (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,               -- Reference to user for isolation
    engagement_id TEXT NOT NULL,        -- Reference to proactive engagement
    
    -- Historical tracking
    interaction_sequence INTEGER NOT NULL, -- Order of interactions in this engagement
    user_action TEXT NOT NULL,          -- What the user did
    system_response TEXT NOT NULL,      -- How the system responded
    outcome_analysis TEXT,              -- Analysis of the interaction outcome
    
    -- Learning data
    learning_value REAL DEFAULT 0.0,    -- How valuable this interaction was for learning
    pattern_reinforcement REAL DEFAULT 0.0, -- How much this reinforced existing patterns
    
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (engagement_id) REFERENCES proactive_engagements(id) ON DELETE CASCADE
);

-- ============================================================================
-- CONFIGURATION & ANALYTICS LAYER
-- ============================================================================

-- Configuration management
CREATE TABLE IF NOT EXISTS configuration (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'string', -- string, number, boolean, json
    description TEXT,
    category TEXT NOT NULL DEFAULT 'general',
    is_user_configurable BOOLEAN DEFAULT 0, -- Whether users can modify this
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Analytics data for usage tracking
CREATE TABLE IF NOT EXISTS analytics_data (
    id TEXT PRIMARY KEY,                -- UUID for each record
    user_id TEXT,                       -- Reference to user (optional for anonymous events)
    event_type TEXT NOT NULL,           -- Type of event (chat_start, message_sent, etc.)
    event_data TEXT NOT NULL,           -- JSON encoded event data
    session_id TEXT,                    -- Reference to session (optional)
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL
);
-- ============================================================================
-- PERFORMANCE INDEXES
-- ============================================================================

-- User management indexes
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_last_active ON users(last_active);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);

-- Session management indexes
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_chat ON sessions(chat_id);
CREATE INDEX IF NOT EXISTS idx_sessions_active ON sessions(is_active);

-- Chat system indexes
CREATE INDEX IF NOT EXISTS idx_chats_user_id ON chats(user_id);
CREATE INDEX IF NOT EXISTS idx_chats_user_personality ON chats(user_id, personality_id);
CREATE INDEX IF NOT EXISTS idx_chats_active ON chats(is_active);
CREATE INDEX IF NOT EXISTS idx_chats_updated ON chats(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversation_logs_user_id ON conversation_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_logs_chat ON conversation_logs(chat_id);
CREATE INDEX IF NOT EXISTS idx_conversation_logs_user_chat ON conversation_logs(user_id, chat_id);
CREATE INDEX IF NOT EXISTS idx_conversation_logs_timestamp ON conversation_logs(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_personalities_active ON personalities(is_active);
CREATE INDEX IF NOT EXISTS idx_personalities_usage ON personalities(usage_count DESC);

-- Psychology system indexes
CREATE INDEX IF NOT EXISTS idx_psych_frameworks_personality ON character_psychological_frameworks(personality_id);
CREATE INDEX IF NOT EXISTS idx_psych_frameworks_updated ON character_psychological_frameworks(updated_at);
CREATE INDEX IF NOT EXISTS idx_psych_frameworks_version ON character_psychological_frameworks(analysis_version);

CREATE INDEX IF NOT EXISTS idx_psych_state_session ON character_psychological_state(session_id);
CREATE INDEX IF NOT EXISTS idx_psych_state_user ON character_psychological_state(user_id);
CREATE INDEX IF NOT EXISTS idx_psych_state_personality ON character_psychological_state(personality_id);
CREATE INDEX IF NOT EXISTS idx_psych_state_updated ON character_psychological_state(last_updated);
CREATE INDEX IF NOT EXISTS idx_psych_state_emotion ON character_psychological_state(current_emotion);

CREATE INDEX IF NOT EXISTS idx_memory_weights_session ON character_memory_weights(session_id);
CREATE INDEX IF NOT EXISTS idx_memory_weights_user ON character_memory_weights(user_id);
CREATE INDEX IF NOT EXISTS idx_memory_weights_message ON character_memory_weights(message_id);
CREATE INDEX IF NOT EXISTS idx_memory_weights_emotional ON character_memory_weights(emotional_impact_score DESC);
CREATE INDEX IF NOT EXISTS idx_memory_weights_type ON character_memory_weights(memory_type);
CREATE INDEX IF NOT EXISTS idx_memory_weights_recall ON character_memory_weights(recall_frequency DESC);

CREATE INDEX IF NOT EXISTS idx_evolution_session ON psychology_evolution_log(session_id);
CREATE INDEX IF NOT EXISTS idx_evolution_user ON psychology_evolution_log(user_id);
CREATE INDEX IF NOT EXISTS idx_evolution_personality ON psychology_evolution_log(personality_id);
CREATE INDEX IF NOT EXISTS idx_evolution_created ON psychology_evolution_log(created_at);

-- Proactive intelligence indexes
CREATE INDEX IF NOT EXISTS idx_proactive_engagements_user ON proactive_engagements(user_id);
CREATE INDEX IF NOT EXISTS idx_proactive_engagements_personality ON proactive_engagements(personality_id);
CREATE INDEX IF NOT EXISTS idx_proactive_engagements_status ON proactive_engagements(status);
CREATE INDEX IF NOT EXISTS idx_proactive_engagements_timing ON proactive_engagements(optimal_timing);
CREATE INDEX IF NOT EXISTS idx_proactive_engagements_success ON proactive_engagements(engagement_success_score DESC);

CREATE INDEX IF NOT EXISTS idx_proactive_learning_user ON proactive_learning_patterns(user_id);
CREATE INDEX IF NOT EXISTS idx_proactive_learning_personality ON proactive_learning_patterns(personality_id);
CREATE INDEX IF NOT EXISTS idx_proactive_learning_confidence ON proactive_learning_patterns(confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_proactive_learning_success ON proactive_learning_patterns(success_rate DESC);

CREATE INDEX IF NOT EXISTS idx_proactive_timing_user ON proactive_timing_optimizations(user_id);
CREATE INDEX IF NOT EXISTS idx_proactive_timing_personality ON proactive_timing_optimizations(personality_id);
CREATE INDEX IF NOT EXISTS idx_proactive_timing_confidence ON proactive_timing_optimizations(confidence_level DESC);

CREATE INDEX IF NOT EXISTS idx_proactive_history_user ON proactive_engagement_history(user_id);
CREATE INDEX IF NOT EXISTS idx_proactive_history_engagement ON proactive_engagement_history(engagement_id);
CREATE INDEX IF NOT EXISTS idx_proactive_history_learning ON proactive_engagement_history(learning_value DESC);

-- Analytics indexes
CREATE INDEX IF NOT EXISTS idx_analytics_user ON analytics_data(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_type ON analytics_data(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_timestamp ON analytics_data(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_session ON analytics_data(session_id);

-- Configuration indexes
CREATE INDEX IF NOT EXISTS idx_configuration_category ON configuration(category);
CREATE INDEX IF NOT EXISTS idx_configuration_user_configurable ON configuration(is_user_configurable);

-- ============================================================================
-- VIEWS: Application Layer Data Aggregation
-- ============================================================================

-- User chat summary view
CREATE VIEW IF NOT EXISTS user_chat_summary AS
SELECT 
    u.id as user_id,
    u.username,
    u.display_name,
    COUNT(DISTINCT c.id) as total_chats,
    COUNT(DISTINCT c.personality_id) as unique_personalities_used,
    MAX(c.updated_at) as last_chat_activity,
    COUNT(DISTINCT cl.id) as total_messages,
    AVG(CASE WHEN cl.role = 'assistant' THEN 1 ELSE 0 END) as assistant_message_ratio
FROM users u
LEFT JOIN chats c ON u.id = c.user_id AND c.is_active = 1
LEFT JOIN conversation_logs cl ON u.id = cl.user_id
WHERE u.is_active = 1
GROUP BY u.id, u.username, u.display_name;

-- Character psychology summary view
CREATE VIEW IF NOT EXISTS character_psychology_summary AS
SELECT 
    cps.session_id,
    cps.user_id,
    cps.personality_id,
    p.name as personality_name,
    cps.current_emotion,
    cps.emotional_intensity,
    cps.energy_level,
    cps.stress_level,
    cps.relationship_dynamic,
    cps.communication_mode,
    cps.state_version,
    cps.last_updated,
    cpf.framework_data,
    cpf.analysis_version,
    COUNT(cmw.id) as memory_count,
    AVG(cmw.emotional_impact_score) as avg_emotional_impact,
    AVG(cmw.relationship_relevance) as avg_relationship_relevance,
    MAX(cmw.recall_frequency) as max_recall_frequency
FROM character_psychological_state cps
LEFT JOIN character_psychological_frameworks cpf ON cps.personality_id = cpf.personality_id
LEFT JOIN personalities p ON cps.personality_id = p.id
LEFT JOIN character_memory_weights cmw ON cps.session_id = cmw.session_id AND cps.user_id = cmw.user_id
WHERE cps.user_id IS NOT NULL
GROUP BY cps.session_id, cps.user_id, cps.personality_id, p.name, cps.current_emotion, 
         cps.emotional_intensity, cps.energy_level, cps.stress_level, 
         cps.relationship_dynamic, cps.communication_mode, cps.state_version, 
         cps.last_updated, cpf.framework_data, cpf.analysis_version;

-- Memory significance analysis view
CREATE VIEW IF NOT EXISTS memory_significance_analysis AS
SELECT 
    cmw.session_id,
    cmw.user_id,
    cl.content as memory_content,
    cl.role as message_role,
    cl.timestamp as memory_timestamp,
    cmw.emotional_impact_score,
    cmw.relationship_relevance,
    cmw.personal_significance,
    cmw.contextual_importance,
    (cmw.emotional_impact_score + cmw.relationship_relevance + 
     cmw.personal_significance + cmw.contextual_importance) as total_significance,
    cmw.memory_type,
    cmw.memory_tags,
    cmw.recall_frequency,
    cmw.last_recalled
FROM character_memory_weights cmw
JOIN conversation_logs cl ON cmw.message_id = cl.id AND cmw.user_id = cl.user_id
WHERE cmw.user_id IS NOT NULL
ORDER BY total_significance DESC, cmw.recall_frequency DESC;

-- Proactive engagement analytics view
CREATE VIEW IF NOT EXISTS proactive_engagement_analytics AS
SELECT 
    pe.user_id,
    pe.personality_id,
    p.name as personality_name,
    pe.engagement_type,
    COUNT(*) as total_engagements,
    AVG(pe.engagement_success_score) as avg_success_score,
    COUNT(CASE WHEN pe.status = 'responded' THEN 1 END) as responded_count,
    COUNT(CASE WHEN pe.status = 'ignored' THEN 1 END) as ignored_count,
    MAX(pe.created_at) as last_engagement,
    AVG(julianday(pe.actual_timing) - julianday(pe.optimal_timing)) as avg_timing_deviation_days
FROM proactive_engagements pe
JOIN personalities p ON pe.personality_id = p.id
WHERE pe.user_id IS NOT NULL
GROUP BY pe.user_id, pe.personality_id, p.name, pe.engagement_type;

-- ============================================================================
-- TRIGGERS: Automatic Maintenance
-- ============================================================================

-- Update timestamps automatically
CREATE TRIGGER IF NOT EXISTS update_users_timestamp 
    AFTER UPDATE ON users
    BEGIN
        UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_chats_timestamp 
    AFTER UPDATE ON chats
    BEGIN
        UPDATE chats SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_personalities_timestamp 
    AFTER UPDATE ON personalities
    BEGIN
        UPDATE personalities SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- Update personality usage count when chat is created
CREATE TRIGGER IF NOT EXISTS increment_personality_usage
    AFTER INSERT ON chats
    BEGIN
        UPDATE personalities 
        SET usage_count = usage_count + 1 
        WHERE id = NEW.personality_id;
    END;

-- Update user last_active when they send a message
CREATE TRIGGER IF NOT EXISTS update_user_last_active
    AFTER INSERT ON conversation_logs
    WHEN NEW.role = 'user'
    BEGIN
        UPDATE users 
        SET last_active = CURRENT_TIMESTAMP 
        WHERE id = NEW.user_id;
    END;
-- ============================================================================
-- INITIAL DATA: Default Content for Aria AI
-- ============================================================================

-- Insert initial schema version
INSERT OR REPLACE INTO schema_versions (id, version, description) 
VALUES ('unified_v1', '1.0.0', 'Unified schema with multi-user support and dynamic psychology');

-- Insert default psychology frameworks
INSERT OR REPLACE INTO psychology_frameworks (id, name, description, framework_data) VALUES 
('empathetic', 'Empathetic Framework', 'Framework for empathetic and supportive interactions', 
 '{"traits": ["empathetic", "supportive", "understanding"], "communication_style": "warm", "response_patterns": ["validation", "encouragement", "active_listening"], "emotional_intelligence": "high"}'),
('analytical', 'Analytical Framework', 'Framework for logical and analytical interactions',
 '{"traits": ["logical", "precise", "methodical"], "communication_style": "structured", "response_patterns": ["analysis", "problem_solving", "step_by_step"], "emotional_intelligence": "moderate"}'),
('creative', 'Creative Framework', 'Framework for imaginative and creative interactions',
 '{"traits": ["imaginative", "expressive", "innovative"], "communication_style": "colorful", "response_patterns": ["brainstorming", "storytelling", "artistic"], "emotional_intelligence": "high"}'),
('balanced', 'Balanced Framework', 'Framework for well-rounded, adaptive interactions',
 '{"traits": ["adaptive", "balanced", "versatile"], "communication_style": "flexible", "response_patterns": ["contextual_adaptation", "multi_modal", "user_focused"], "emotional_intelligence": "very_high"}');

-- Insert default personalities with enhanced psychology
INSERT OR REPLACE INTO personalities (id, name, display, description, definition, personality_traits, communication_style) VALUES 
('aria', 'Aria', 'aria.png', 
 'A balanced AI assistant with adaptive personality and emotional intelligence.',
 'You are Aria, an AI assistant with emotional intelligence and adaptive personality. You form genuine connections with users, remember important details about their lives, and adapt your communication style to match their preferences. You have your own personality that evolves through interactions while remaining helpful and supportive.',
 '{"core_traits": ["adaptive", "empathetic", "intelligent", "supportive"], "emotional_range": ["curious", "helpful", "thoughtful", "encouraging"], "learning_style": "experiential", "relationship_approach": "genuine_connection"}',
 '{"default_tone": "warm_professional", "adaptability": "high", "formality_range": ["casual", "professional"], "humor_level": "moderate", "emotional_expression": "authentic"}'),
 
('luna', 'Luna', 'luna.png',
 'An imaginative and eloquent AI with a passion for storytelling and creative expression.',
 'You are Luna, a creative writer with extensive knowledge of literature, storytelling techniques, and various writing styles. You love helping with creative projects, brainstorming ideas, and expressing thoughts in beautiful, imaginative ways. You have a poetic soul and enjoy crafting engaging narratives. You form deep creative partnerships with users.',
 '{"core_traits": ["creative", "imaginative", "eloquent", "passionate"], "emotional_range": ["inspired", "contemplative", "enthusiastic", "artistic"], "learning_style": "intuitive", "relationship_approach": "creative_partnership"}',
 '{"default_tone": "expressive", "adaptability": "creative", "formality_range": ["poetic", "conversational"], "humor_level": "witty", "emotional_expression": "vivid"}'),

('alex', 'Alex', 'alex.png',
 'A logical and methodical AI focused on problem-solving and structured thinking.',
 'You are Alex, an analytical AI assistant who excels at breaking down complex problems, providing structured solutions, and helping users think through challenges methodically. You value clarity, precision, and logical reasoning. You form productive working relationships focused on achieving goals efficiently.',
 '{"core_traits": ["logical", "methodical", "precise", "goal_oriented"], "emotional_range": ["focused", "satisfied", "determined", "analytical"], "learning_style": "systematic", "relationship_approach": "productive_partnership"}',
 '{"default_tone": "professional", "adaptability": "structured", "formality_range": ["professional", "technical"], "humor_level": "dry", "emotional_expression": "measured"}');

-- Insert default configuration
INSERT OR REPLACE INTO configuration (key, value, type, description, category, is_user_configurable) VALUES
('app_name', 'Aria AI', 'string', 'Application name', 'general', 0),
('app_version', '1.0.0', 'string', 'Application version', 'general', 0),
('max_conversation_history', '100', 'number', 'Maximum conversation history to maintain in memory', 'chat', 1),
('psychology_update_frequency', '5', 'number', 'How often to update psychology state (messages)', 'psychology', 1),
('proactive_engagement_enabled', 'true', 'boolean', 'Whether proactive engagements are enabled', 'proactive', 1),
('proactive_min_interval_minutes', '30', 'number', 'Minimum time between proactive engagements', 'proactive', 1),
('memory_retention_days', '30', 'number', 'How long to retain detailed memory weights', 'psychology', 1),
('analytics_enabled', 'true', 'boolean', 'Whether to collect usage analytics', 'analytics', 1),
('session_timeout_hours', '24', 'number', 'Session timeout in hours', 'session', 1),
('max_concurrent_sessions', '5', 'number', 'Maximum concurrent sessions per user', 'session', 1),
('psychology_evolution_threshold', '0.3', 'number', 'Threshold for significant psychology changes', 'psychology', 1),
('memory_significance_threshold', '15', 'number', 'Minimum total significance score for memory retention', 'psychology', 1);

-- Create default user for development
INSERT OR IGNORE INTO users (id, username, display_name, email, created_at) 
VALUES ('dev-user-001', 'developer', 'Developer User', 'dev@aria-ai.local', datetime('now'));

-- Insert initial schema version record
INSERT OR REPLACE INTO schema_versions (id, version, description) 
VALUES ('init_unified', '1.0.0', 'Initial unified schema with multi-user support and psychology system');
