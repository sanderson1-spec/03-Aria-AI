# Test Data Cleanup System

## Overview

The Aria AI test suite now includes a comprehensive test data cleanup system to ensure that test data never persists in the production database or interferes with regular operations.

## Problem Solved

Previously, test characters, users, and conversations created during testing would remain in the database after tests completed, causing:
- Test data appearing in the production interface
- Data pollution between test runs
- Inconsistent test results
- Security and privacy concerns

## Solution Architecture

### 🧹 Automatic Cleanup
- **Pre-test cleanup**: Removes any existing test data before tests start
- **Post-test cleanup**: Removes all test data after tests complete
- **Fail-safe cleanup**: Cleanup runs even if tests fail

### 🎯 Smart Detection
Test data is identified using multiple patterns:
- Prefixes: `test_`, `integration_`, `e2e_`, `mock_`
- Suffixes: `_test`, `_integration`, `_e2e`
- Content: "Test Character", "Integration Test", "testing purposes"

### 🏗️ Clean Architecture Compliance
- Respects foreign key constraints
- Uses proper DAL patterns
- Maintains database integrity
- Follows service isolation principles

## Components

### 1. TestDataCleanup Class (`tests/test-cleanup.js`)
Main cleanup utility that:
- Removes test database files
- Cleans test data from main database
- Provides verification functionality
- Handles cleanup failures gracefully

### 2. Framework Integration
- **Jest Setup** (`tests/jest.setup.js`): Automatic cleanup before/after Jest runs
- **Test Framework** (`tests/test-framework.js`): Integrated cleanup in custom test runner
- **Test Runner** (`tests/run-all-tests.js`): Cleanup in comprehensive test runner
- **Shell Script** (`run-all-tests.sh`): Cleanup in bash test runner

### 3. Database Isolation
- **E2E Tests**: Now use in-memory databases (`:memory:`) instead of real files
- **Integration Tests**: Already using in-memory databases
- **Unit Tests**: Use mocked dependencies

## Usage

### Automatic (Recommended)
Test cleanup runs automatically when you use any of these commands:
```bash
# All include automatic cleanup
npm run test
npm run test:all
./run-all-tests.sh
node tests/run-all-tests.js
```

### Manual Cleanup
If you need to clean up test data manually:
```bash
# Clean up test data
npm run test:cleanup

# Or directly
node tests/test-cleanup.js

# Verify cleanup was successful
node tests/test-cleanup.js verify

# Clean up from shell script
./run-all-tests.sh cleanup
```

## Test Data Patterns

### Automatic Detection
The cleanup system automatically detects test data using these patterns:

**Username/ID Patterns:**
- `test_*` - Any data starting with "test_"
- `integration_*` - Integration test data
- `e2e_*` - End-to-end test data
- `mock_*` - Mock data
- `*_test` - Data ending with "_test"

**Content Patterns:**
- "Test Character" - Test character names
- "Integration Test" - Integration test descriptions
- "E2E Test" - End-to-end test content
- "testing purposes" - Test-related descriptions

### Database Tables Cleaned
The system cleans all tables in proper order:
1. `conversations` (messages and history)
2. `psychology_states` (character psychology)
3. `proactive_engagement_history` (engagement data)
4. `proactive_learning_patterns` (learning data)
5. `user_sessions` (session data)
6. `chats` (chat records)
7. `personalities` (test characters)
8. `users` (test users)
9. `analytics_events` (analytics data)
10. `configuration` (test configs)

## Database Files

### Test Databases (Automatically Removed)
- `database/test_aria.db` - Unit test database
- `database/test_e2e_aria.db` - E2E test database
- `database/test_integration_aria.db` - Integration test database

### Production Database
- `database/aria.db` - Production database (test data removed, structure preserved)

## Error Handling

### Graceful Failures
- Cleanup warnings don't fail tests
- Missing files are handled gracefully
- Database connection errors are logged but don't stop execution

### Manual Recovery
If automatic cleanup fails:
```bash
# Force cleanup
node tests/test-cleanup.js

# Check what needs cleaning
node tests/test-cleanup.js verify

# Remove test database files manually
rm -f database/test_*.db
```

## Best Practices

### For Test Writers
1. **Use descriptive test names** with "test", "integration", or "e2e" prefixes
2. **Use in-memory databases** for isolation (`:memory:`)
3. **Don't rely on persistent test data** between test runs
4. **Use unique timestamps** in test data to avoid conflicts

### For Test Data
```javascript
// ✅ Good: Will be automatically cleaned up
const user = await dal.users.createUser({
    username: `test_user_${Date.now()}`,
    email: `test_${timestamp}@example.com`,
    display_name: 'Test User'
});

const character = await dal.personalities.createCharacter({
    id: `test_char_${timestamp}`,
    name: 'Test Character',
    description: 'A character for testing purposes'
});

// ❌ Bad: Might not be cleaned up
const user = await dal.users.createUser({
    username: 'john_doe',
    email: 'john@example.com',
    display_name: 'John Doe'
});
```

## Verification

### Automatic Verification
After cleanup, the system automatically verifies:
- All test database files are removed
- No test data remains in production database
- Database integrity is maintained

### Manual Verification
```bash
# Verify cleanup was successful
node tests/test-cleanup.js verify

# Check database manually
sqlite3 database/aria.db "SELECT * FROM users WHERE username LIKE 'test_%';"
```

## Troubleshooting

### Common Issues

**Test data still visible after tests:**
```bash
# Run manual cleanup
npm run test:cleanup
```

**Cleanup warnings during tests:**
- Usually harmless (file doesn't exist, etc.)
- Tests will continue normally
- Check logs for specific issues

**Database locked errors:**
- Ensure all database connections are closed
- Restart the application
- Run cleanup again

### Debug Mode
```bash
# Run with verbose logging
NODE_ENV=test node tests/test-cleanup.js
```

## Integration with CI/CD

The cleanup system is designed to work in CI/CD environments:
- No manual intervention required
- Handles missing files gracefully
- Provides clear success/failure status
- Logs are CI/CD friendly

### Example GitHub Actions
```yaml
- name: Run tests with cleanup
  run: |
    npm run test:all
    npm run test:cleanup  # Extra cleanup for safety
```

## Security Benefits

### Data Privacy
- Test data never persists in production
- No accidental exposure of test users/conversations
- Clean separation between test and production data

### Database Integrity
- Foreign key constraints respected
- No orphaned records
- Consistent database state

### Development Safety
- Developers can run tests without polluting their local database
- Consistent test environment for all team members
- No "works on my machine" issues due to test data pollution

## Future Enhancements

### Planned Features
- Configurable cleanup patterns
- Backup/restore for test data investigation
- Performance metrics for cleanup operations
- Integration with database migrations

### Configuration Options
Future versions may include:
```javascript
// tests/test-config.js
cleanup: {
    patterns: ['custom_test_*'],
    preserveTables: ['analytics_events'],
    backupBeforeCleanup: true
}
```

## Summary

The test data cleanup system ensures that:
- ✅ Test data never appears in production
- ✅ Tests run in isolated environments
- ✅ Database remains clean after testing
- ✅ No manual cleanup required
- ✅ Graceful error handling
- ✅ CI/CD compatible
- ✅ Clean architecture compliant

This system provides robust test isolation while maintaining the integrity and performance of the Aria AI application.
