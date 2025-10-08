-- Migration 007: Add User Isolation to Personalities
-- Purpose: Add user_id column to personalities table for multi-user character ownership
-- Date: 2025-10-08

-- Add user_id column to personalities table
-- Note: Existing personalities will have NULL user_id (global characters)
ALTER TABLE personalities 
ADD COLUMN user_id TEXT DEFAULT NULL REFERENCES users(id) ON DELETE CASCADE;

-- Update existing personalities to be owned by 'dev-user-001' (system user)
-- This makes existing characters available to the development user
UPDATE personalities 
SET user_id = 'dev-user-001' 
WHERE user_id IS NULL;

-- Add index for user_id lookups (critical for performance)
CREATE INDEX IF NOT EXISTS idx_personalities_user_id ON personalities(user_id);

-- Add composite index for user + active status lookups
CREATE INDEX IF NOT EXISTS idx_personalities_user_active ON personalities(user_id, is_active);

-- Migration complete
-- All existing personalities are now owned by dev-user-001
-- New personalities must specify user_id on creation
