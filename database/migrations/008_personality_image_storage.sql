-- ============================================================================
-- Migration 008: Personality Image Storage
-- Add support for storing character images directly in the database
-- ============================================================================
-- Date: 2025-10-10
-- Description: 
--   - Add image_data column to store base64 encoded images
--   - Add image_type column to track storage type (url, upload, base64)
--   - Keep display column for backward compatibility
--   - Support both URL-based and database-stored images
-- ============================================================================

-- Add new columns to personalities table
ALTER TABLE personalities ADD COLUMN image_data TEXT DEFAULT NULL;
ALTER TABLE personalities ADD COLUMN image_type TEXT DEFAULT 'url';
-- image_type values:
--   'url'    = display field contains a URL
--   'upload' = image is stored in image_data as base64
--   'path'   = display field contains a relative path to /avatars/

-- Add metadata column for image information
ALTER TABLE personalities ADD COLUMN image_metadata TEXT DEFAULT '{}';
-- image_metadata JSON structure:
-- {
--   "filename": "original filename",
--   "mimetype": "image/png",
--   "size": 12345,
--   "uploadedAt": "2025-10-10T12:00:00Z"
-- }

-- Update existing records to have image_type based on current display value
UPDATE personalities 
SET image_type = CASE 
    WHEN display LIKE 'http%' THEN 'url'
    WHEN display = 'default.png' THEN 'path'
    ELSE 'path'
END;

-- Create index for efficient image queries
CREATE INDEX IF NOT EXISTS idx_personalities_image_type ON personalities(image_type);

-- Record migration
INSERT INTO schema_versions (id, version, description) 
VALUES ('migration_008', '008', 'Add personality image storage support');

