-- Migration: Add commitment confidence threshold configuration
-- Date: 2025-10-08
-- Purpose: Add configurable threshold for commitment detection confidence scores

-- Add commitment confidence threshold configuration
INSERT INTO configuration (key, value, type, description, category, is_user_configurable) 
VALUES ('commitment_confidence_threshold', '0.8', 'number', 'Minimum confidence score (0.0-1.0) to create commitment', 'commitments', 1);
