-- ============================================================================
-- DATABASE RESET SCRIPT
-- Purpose: Clean all user data while preserving user accounts and schema
-- Date: 2025-10-08
-- ============================================================================

-- Preserve user accounts (Bjoern and Steve only)
-- First, identify the user IDs to keep
-- Bjoern: e5500cad-e6e0-45ed-b20a-63b81fdb22a4
-- Steve: 30b2ae99-c903-47b8-abed-a4b68ce07487
-- dev-user-001 (developer account)

BEGIN TRANSACTION;

-- ============================================================================
-- STEP 1: Delete all data from character-related tables
-- ============================================================================

-- Delete all characters (will be re-imported)
DELETE FROM personalities;

-- Delete all character psychology data
DELETE FROM character_psychological_state;
DELETE FROM character_psychological_frameworks;
DELETE FROM character_psychology_summary;
DELETE FROM character_memory_weights;

-- ============================================================================
-- STEP 2: Delete all chat and conversation data
-- ============================================================================

-- Delete all chats
DELETE FROM chats;

-- Delete all conversation logs
DELETE FROM conversation_logs;

-- Delete all sessions
DELETE FROM sessions;

-- Delete user sessions (except for current users)
DELETE FROM user_sessions 
WHERE user_id NOT IN (
    'e5500cad-e6e0-45ed-b20a-63b81fdb22a4', 
    '30b2ae99-c903-47b8-abed-a4b68ce07487',
    'dev-user-001'
);

-- ============================================================================
-- STEP 3: Delete all commitment and event data
-- ============================================================================

-- Delete all commitments
DELETE FROM commitments;

-- Delete all events
DELETE FROM events;

-- ============================================================================
-- STEP 4: Delete all proactive intelligence data
-- ============================================================================

-- Delete all proactive engagements
DELETE FROM proactive_engagements;
DELETE FROM proactive_engagement_history;
DELETE FROM proactive_learning_patterns;
DELETE FROM proactive_timing_optimizations;

-- ============================================================================
-- STEP 5: Delete all psychology and learning data
-- ============================================================================

-- Delete psychology evolution logs
DELETE FROM psychology_evolution_log;

-- Delete psychology frameworks (keep table structure)
DELETE FROM psychology_frameworks;

-- Delete memory significance analysis
DELETE FROM memory_significance_analysis;

-- ============================================================================
-- STEP 6: Delete analytics data
-- ============================================================================

-- Delete analytics data
DELETE FROM analytics_data;

-- Delete user chat summaries
DELETE FROM user_chat_summary;

-- ============================================================================
-- STEP 7: Clean up users table (keep only Bjoern, Steve, and dev-user-001)
-- ============================================================================

-- Delete all test users
DELETE FROM users 
WHERE id NOT IN (
    'e5500cad-e6e0-45ed-b20a-63b81fdb22a4',  -- Bjoern
    '30b2ae99-c903-47b8-abed-a4b68ce07487',  -- Steve
    'dev-user-001'                            -- Developer account
);

-- ============================================================================
-- STEP 8: Keep configuration and schema_versions intact
-- ============================================================================

-- We keep configuration table as is
-- We keep schema_versions table as is

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Count remaining users
SELECT 'Remaining Users:' as info, COUNT(*) as count FROM users;

-- Show remaining users
SELECT 'User Details:' as info, id, username, display_name FROM users;

-- Count characters (should be 0)
SELECT 'Remaining Characters:' as info, COUNT(*) as count FROM personalities;

-- Count chats (should be 0)
SELECT 'Remaining Chats:' as info, COUNT(*) as count FROM chats;

-- Count conversations (should be 0)
SELECT 'Remaining Conversations:' as info, COUNT(*) as count FROM conversation_logs;

-- Count commitments (should be 0)
SELECT 'Remaining Commitments:' as info, COUNT(*) as count FROM commitments;

-- Count events (should be 0)
SELECT 'Remaining Events:' as info, COUNT(*) as count FROM events;

COMMIT;

-- ============================================================================
-- RESET COMPLETE
-- ============================================================================

SELECT '✅ Database reset complete!' as status;
SELECT '📋 You can now import characters for Bjoern and Steve' as next_steps;
