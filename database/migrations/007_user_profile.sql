-- Migration: Add user_profile column to users table
-- Date: 2025-10-09
-- Description: Adds JSON column to store user profile information (name, birthdate, bio)

ALTER TABLE users ADD COLUMN user_profile TEXT DEFAULT '{}';

