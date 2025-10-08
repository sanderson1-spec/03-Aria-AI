-- Events table for character-scheduled meetings/check-ins
CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    chat_id TEXT NOT NULL,              -- Chat-scoped (character isolation)
    character_id TEXT NOT NULL,
    
    -- Event details
    title TEXT NOT NULL,                -- "Daily Morning Check-in"
    description TEXT,                   -- Additional context
    
    -- Recurrence configuration
    recurrence_type TEXT NOT NULL,      -- 'once', 'daily', 'weekly', 'monthly'
    recurrence_data TEXT DEFAULT '{}',  -- JSON: {"time": "07:00", "day_of_week": "monday"}
    starts_at DATETIME NOT NULL,        -- First occurrence
    ends_at DATETIME,                   -- Optional end date (null = infinite)
    
    -- Occurrence tracking
    last_occurrence DATETIME,           -- When did this last trigger?
    next_occurrence DATETIME NOT NULL,  -- Calculated: when is it due next?
    
    -- Status and metadata
    is_active BOOLEAN DEFAULT 1,
    status TEXT DEFAULT 'scheduled',    -- scheduled, completed, missed, cancelled
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
    FOREIGN KEY (character_id) REFERENCES personalities(id) ON DELETE CASCADE
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_events_user ON events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_chat ON events(chat_id);
CREATE INDEX IF NOT EXISTS idx_events_character ON events(character_id);
CREATE INDEX IF NOT EXISTS idx_events_next_occurrence ON events(next_occurrence);
CREATE INDEX IF NOT EXISTS idx_events_active_due ON events(is_active, next_occurrence) 
WHERE is_active = 1;

-- Trigger for automatic timestamp updates
CREATE TRIGGER IF NOT EXISTS update_events_timestamp 
    AFTER UPDATE ON events
    BEGIN
        UPDATE events SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;
