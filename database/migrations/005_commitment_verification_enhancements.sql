-- ============================================================================
-- Migration 005: Commitment Verification Enhancements
-- ============================================================================
-- PURPOSE: Add advanced verification tracking to commitments table
-- FEATURES:
--   - Verification request tracking
--   - User feedback collection
--   - Verification decision workflow
--   - Revision tracking for iterative improvement
-- ============================================================================

-- Track when verification was requested
ALTER TABLE commitments 
ADD COLUMN verification_requested_at DATETIME;

-- Store user's feedback on character verification
-- (e.g., "Actually, I did complete all 3 parts, not just 2")
ALTER TABLE commitments 
ADD COLUMN verification_feedback TEXT;

-- Store character's verification decision
-- Values: 'approved', 'needs_revision', 'rejected', 'not_verifiable'
ALTER TABLE commitments 
ADD COLUMN verification_decision TEXT;

-- Track how many times this commitment was revised/resubmitted
ALTER TABLE commitments
ADD COLUMN revision_count INTEGER DEFAULT 0;

-- ============================================================================
-- INDEXES: Performance optimization for verification workflows
-- ============================================================================

-- Index for tracking revision history and patterns
CREATE INDEX IF NOT EXISTS idx_commitments_revision 
ON commitments(user_id, revision_count);

-- Index for querying pending verification requests
CREATE INDEX IF NOT EXISTS idx_commitments_verification_requested
ON commitments(verification_requested_at) 
WHERE verification_requested_at IS NOT NULL;

-- Index for analyzing verification decisions
CREATE INDEX IF NOT EXISTS idx_commitments_verification_decision
ON commitments(verification_decision, user_id)
WHERE verification_decision IS NOT NULL;

-- ============================================================================
-- MIGRATION METADATA
-- ============================================================================

INSERT INTO schema_versions (id, version, description) 
VALUES (
    'commitment_verification_v1', 
    '1.1.0', 
    'Added verification request tracking, feedback collection, decision workflow, and revision counting'
);

