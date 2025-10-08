# Commitment Verification Workflow

## Overview
Enhanced verification system for character-assigned commitments with feedback loops and revision tracking.

## New Database Fields (v1.1.0)

### `verification_requested_at` (DATETIME)
- **Purpose**: Track when user requested verification from character
- **Use Case**: User wants character to review their submission
- **Example**: "Can you check if this meets what you asked for?"

### `verification_feedback` (TEXT)
- **Purpose**: Store user's feedback on character's verification
- **Use Case**: User disagrees with character's assessment or provides clarification
- **Example**: "Actually, I did complete all 3 parts, not just 2. Check section B again."

### `verification_decision` (TEXT)
- **Purpose**: Character's final decision on verification
- **Possible Values**:
  - `'approved'` - Character accepts the submission as complete
  - `'needs_revision'` - Character wants improvements but commitment is valid
  - `'rejected'` - Character determines submission doesn't meet requirements
  - `'not_verifiable'` - Cannot be verified (subjective/unmeasurable)

### `revision_count` (INTEGER, DEFAULT 0)
- **Purpose**: Track iteration cycles for learning and analytics
- **Incremented**: Each time commitment is resubmitted after feedback
- **Use Case**: Identify commitments requiring multiple iterations

## Workflow Examples

### Standard Verification Flow
```javascript
// 1. User submits commitment
await commitmentsRepo.submitCommitment(commitmentId, submissionContent);

// 2. User requests character verification
await commitmentsRepo.update(
    { verification_requested_at: getCurrentTimestamp() },
    { id: commitmentId }
);

// 3. Character provides verification decision
await commitmentsRepo.updateCommitmentStatus(
    commitmentId,
    'completed',
    { 
        verification_decision: 'approved',
        verification_result: 'verified'
    }
);
```

### Revision Flow (Needs Improvement)
```javascript
// 1. Character requests revision
await commitmentsRepo.updateCommitmentStatus(
    commitmentId,
    'active',
    { 
        verification_decision: 'needs_revision',
        verification_reasoning: 'Good start, but please elaborate on section 2'
    }
);

// 2. User provides feedback/resubmits
await commitmentsRepo.update(
    {
        verification_feedback: 'I added more detail to section 2 as requested',
        submission_content: updatedContent,
        revision_count: currentRevisionCount + 1,
        submitted_at: getCurrentTimestamp()
    },
    { id: commitmentId }
);

// 3. Character re-evaluates
await commitmentsRepo.updateCommitmentStatus(
    commitmentId,
    'completed',
    { verification_decision: 'approved' }
);
```

### Feedback/Disagreement Flow
```javascript
// User disagrees with character's assessment
await commitmentsRepo.update(
    {
        verification_feedback: 'I believe this does meet the requirements. Can you explain what\'s missing?',
        status: 'submitted' // Keep as submitted, not completed
    },
    { id: commitmentId }
);

// Character responds to feedback
await commitmentsRepo.updateCommitmentStatus(
    commitmentId,
    'completed',
    {
        verification_decision: 'approved',
        verification_reasoning: 'You\'re right, I missed that section. Well done!'
    }
);
```

## Usage with Existing Repository Methods

### Using `updateCommitmentStatus()`
The existing method accepts an `updateData` object that can include new fields:

```javascript
await commitmentsRepo.updateCommitmentStatus(
    commitmentId,
    'submitted',
    {
        verification_requested_at: getCurrentTimestamp(),
        verification_decision: 'needs_revision',
        revision_count: 1
    }
);
```

### Using Generic `update()`
For fields-only updates without status changes:

```javascript
await commitmentsRepo.update(
    {
        verification_feedback: 'User feedback text',
        revision_count: currentCount + 1
    },
    { id: commitmentId }
);
```

## Query Examples

### Get Commitments Pending Verification
```javascript
const pendingVerification = await commitmentsRepo.dal.query(
    `SELECT * FROM commitments 
     WHERE user_id = ? 
     AND verification_requested_at IS NOT NULL 
     AND verification_decision IS NULL
     ORDER BY verification_requested_at ASC`,
    [userId]
);
```

### Get High-Revision Commitments (Learning Opportunities)
```javascript
const challengingCommitments = await commitmentsRepo.dal.query(
    `SELECT * FROM commitments 
     WHERE user_id = ? 
     AND revision_count >= 3
     ORDER BY revision_count DESC`,
    [userId]
);
```

### Analyze Verification Patterns
```javascript
const verificationStats = await commitmentsRepo.dal.query(
    `SELECT 
        verification_decision,
        COUNT(*) as count,
        AVG(revision_count) as avg_revisions
     FROM commitments 
     WHERE user_id = ? 
     AND verification_decision IS NOT NULL
     GROUP BY verification_decision`,
    [userId]
);
```

## Character Psychology Integration

These fields enable richer character interactions:

- **Verification Requests**: Character can respond differently based on confidence
- **Feedback Loops**: Character learns from user disagreements
- **Revision Patterns**: Character adapts expectations based on user's revision history
- **Decision Reasoning**: Character provides transparency in verification decisions

## Frontend UI Considerations

### Verification Request Button
- Show when status = 'submitted' and verification_requested_at IS NULL
- Text: "Request Verification" or "Ask [Character] to Review"

### Feedback Input
- Show when verification_decision = 'needs_revision' or 'rejected'
- Allow user to provide clarification or request re-evaluation

### Revision Counter Badge
- Display revision_count when > 0
- Use for gamification or progress tracking

### Decision Display
- Show verification_decision with appropriate styling:
  - ✅ approved (green)
  - 🔄 needs_revision (yellow)
  - ❌ rejected (red)
  - ❓ not_verifiable (gray)

## Analytics Opportunities

### User Insights
- Average revisions per commitment type
- Success rate by commitment complexity
- Time between submission and verification request

### Character Insights
- Which commitments require most iterations
- Verification decision distribution
- Areas where character expectations may be unclear

### System Improvements
- Identify commitments that are consistently rejected
- Find commitment types that need better initial framing
- Discover patterns in user feedback for better character prompting

## Migration Information

**Migration File**: `005_commitment_verification_enhancements.sql`  
**Schema Version**: 1.1.0  
**Applied**: See `schema_versions` table  
**Backward Compatible**: Yes (all new fields are nullable or have defaults)

## Architecture Compliance

✅ **Follows Clean Architecture**:
- Repository methods unchanged (use existing `update` and `updateCommitmentStatus`)
- Database changes properly migrated
- Multi-user isolation maintained (user_id required)
- No breaking changes to existing code

✅ **CORE Files Protected**:
- No modifications to `CORE_CommitmentsRepository.js` required
- All new functionality accessible through existing methods
- Domain services can use new fields via `updateData` parameter

✅ **Performance Optimized**:
- Indexes created for new query patterns
- Partial indexes used where appropriate (verification_requested_at, verification_decision)
- Revision tracking indexed for analytics queries

## Testing Considerations

### Unit Tests
- Test revision count incrementing
- Test verification decision state transitions
- Test feedback storage and retrieval

### Integration Tests
- Test complete verification workflow
- Test revision flow with multiple iterations
- Test feedback disagreement resolution

### E2E Tests
- User submits → requests verification → receives approval
- User submits → needs revision → resubmits → approved
- User provides feedback on character's assessment

## Future Enhancements

### Potential Additions
- `verification_requested_count` - Track how many times user requested review
- `feedback_resolved_at` - When character responded to user feedback
- `auto_verification_attempted` - Track automatic verification attempts
- `verification_confidence_score` - Character's confidence in decision (0-1)

### Advanced Features
- Automatic verification for objective commitments
- Verification reminders if character doesn't respond
- Revision history tracking (full audit trail)
- Peer verification (other users or characters)

