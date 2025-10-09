-- Cleanup Orphaned Data Script
-- Created: 2025-10-07
-- Purpose: Remove test data with broken foreign key references

-- Step 1: Clean orphaned user_sessions (referencing non-existent users)
DELETE FROM user_sessions
WHERE user_id NOT IN (SELECT id FROM users);

-- Step 2: Clean orphaned proactive_engagements (referencing non-existent users/sessions)
DELETE FROM proactive_engagements
WHERE user_id NOT IN (SELECT id FROM users)
   OR session_id NOT IN (SELECT id FROM sessions);

-- Step 3: Clean orphaned analytics_data (referencing non-existent users/sessions)
DELETE FROM analytics_data
WHERE user_id NOT IN (SELECT id FROM users)
   OR (session_id IS NOT NULL AND session_id NOT IN (SELECT id FROM sessions));

-- Step 4: Clean orphaned character_psychological_state (referencing non-existent users/personalities/sessions)
DELETE FROM character_psychological_state
WHERE user_id NOT IN (SELECT id FROM users)
   OR (personality_id IS NOT NULL AND personality_id NOT IN (SELECT id FROM personalities))
   OR (session_id IS NOT NULL AND session_id NOT IN (SELECT id FROM sessions));

-- Step 5: Clean orphaned conversation_logs (referencing non-existent users/chats)
DELETE FROM conversation_logs
WHERE user_id NOT IN (SELECT id FROM users)
   OR chat_id NOT IN (SELECT id FROM chats);

-- Step 6: Clean orphaned chats (referencing non-existent users/personalities)
DELETE FROM chats
WHERE user_id NOT IN (SELECT id FROM users)
   OR personality_id NOT IN (SELECT id FROM personalities);

-- Verification queries
SELECT 'Cleanup Summary:' as status;
SELECT COUNT(*) as user_sessions_count FROM user_sessions;
SELECT COUNT(*) as proactive_engagements_count FROM proactive_engagements;
SELECT COUNT(*) as analytics_data_count FROM analytics_data;
SELECT COUNT(*) as character_psychological_state_count FROM character_psychological_state;
SELECT COUNT(*) as conversation_logs_count FROM conversation_logs;
SELECT COUNT(*) as chats_count FROM chats;



