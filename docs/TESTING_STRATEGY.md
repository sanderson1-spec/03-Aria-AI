# 🧪 Aria AI Testing Strategy

## 📋 Overview

This document outlines our **incremental testing strategy** that ensures each component is structurally sound and properly integrated as we build the application step by step.

## 🏗️ Test Pyramid Architecture

```
        /\     E2E Tests (Few)
       /  \    - Complete user workflows
      /____\   - Real services, real database
     /      \  - Multi-user scenarios
    /________\  Integration Tests (Some)
   /          \ - Service interactions
  /____________\ - Repository combinations
 /              \ - Cross-layer communication
/________________\ Unit Tests (Many)
                   - Individual classes in isolation
                   - Mocked dependencies
                   - Fast execution
```

## 🎯 Testing Philosophy

### ✅ **Incremental Development**
- Each class is **structurally sound** before moving to the next
- **Unit tests written immediately** after creating each component
- **Integration tests** verify new features work with existing ones
- **Continuous validation** prevents breaking existing functionality

### ✅ **Clean Architecture Compliance**
- Tests mirror the **layered architecture**
- Dependencies are **mocked at layer boundaries**
- Each layer tested **independently**
- **Cross-layer interactions** verified through integration tests

### ✅ **Multi-User Focus**
- All tests verify **user data isolation**
- **Access control** tested at repository level
- **Cross-user access** prevented and tested
- **Realistic multi-user scenarios** in E2E tests

## 🧪 Test Types

### 1. 🔬 **Unit Tests** (`tests/repositories/`, `tests/services/`)

**Purpose**: Test individual classes in complete isolation

**Characteristics**:
- ⚡ **Fast execution** (< 100ms per test)
- 🔒 **Isolated** - no external dependencies
- 🎭 **Mocked** - all dependencies are test doubles
- 📊 **Comprehensive** - cover all methods and edge cases

**Examples**:
- `UserRepository.test.js` - Tests CRUD operations, multi-user support
- `ChatRepository.test.js` - Tests chat operations, access control
- `PsychologyService.test.js` - Tests psychology logic, state management

**Template**:
```javascript
// tests/repositories/ExampleRepository.test.js
const ExampleRepository = require('../../backend/dal/repositories/CORE_ExampleRepository');
const { ArchitectureAssertions } = require('../test-framework');

suite.test('should extend BaseRepository', () => {
    ArchitectureAssertions.assertExtendsBaseRepository(repository);
});

suite.test('should support multi-user operations', () => {
    ArchitectureAssertions.assertMultiUserSupport(repository, 'methodName');
});
```

### 2. 🔗 **Integration Tests** (`tests/integration/`)

**Purpose**: Test service interactions and cross-layer communication

**Characteristics**:
- 🔄 **Real services** - actual service instances
- 🗄️ **Test database** - isolated SQLite database
- 🌐 **Cross-layer** - verify repository + service combinations
- 📈 **Realistic scenarios** - multi-step workflows

**Examples**:
- `database-service-integration.test.js` - Tests DAL + repositories
- `psychology-service-integration.test.js` - Tests psychology + database
- `conversation-flow-integration.test.js` - Tests full conversation handling

### 3. 🌐 **E2E Tests** (`tests/e2e/`)

**Purpose**: Test complete user journeys from start to finish

**Characteristics**:
- 👥 **Complete workflows** - user registration to conversation
- 🏢 **Full stack** - all services running together
- 🔒 **Data isolation** - realistic multi-user scenarios
- 🚨 **Error scenarios** - test failure and recovery paths

**Examples**:
- `user-chat-workflow.test.js` - Complete user chat experience
- `psychology-evolution.test.js` - Character development over time
- `proactive-engagement.test.js` - AI-initiated conversations

## 🚀 Running Tests

### **Quick Commands**
```bash
# Run all tests
npm test

# Run specific test types
npm run test:unit
npm run test:integration  
npm run test:e2e

# Generate missing tests
npm run test:generate

# Verbose output
npm run test:verbose
```

### **Development Workflow**
```bash
# 1. Create new feature (e.g., new repository)
# 2. Generate test template
npm run test:generate

# 3. Run unit tests for new feature
npm run test:unit

# 4. Run integration tests to verify compatibility
npm run test:integration

# 5. Run full test suite before commit
npm test
```

## 📊 Test Coverage Goals

| Test Type | Coverage Target | Execution Time |
|-----------|-----------------|----------------|
| **Unit** | 90%+ | < 2 seconds |
| **Integration** | 80%+ | < 10 seconds |
| **E2E** | 70%+ | < 30 seconds |

## 🔧 Test Framework Features

### **MockFactory** - Test Double Creation
```javascript
const { MockFactory } = require('./test-framework');

// Create service mocks
const mocks = MockFactory.createServiceMocks('psychology');
// mocks.logger, mocks.errorHandling, mocks.database, etc.

// Create repository mocks
const repoMock = MockFactory.createRepositoryMock('users');
// repoMock.count(), repoMock.findById(), etc.
```

### **ArchitectureAssertions** - Clean Architecture Validation
```javascript
const { ArchitectureAssertions } = require('./test-framework');

// Verify inheritance
ArchitectureAssertions.assertExtendsAbstractService(service);
ArchitectureAssertions.assertExtendsBaseRepository(repository);

// Verify interfaces
ArchitectureAssertions.assertServiceInterface(service);
ArchitectureAssertions.assertRepositoryInterface(repository);

// Verify multi-user support
ArchitectureAssertions.assertMultiUserSupport(repository, 'methodName');
```

### **TestDatabaseHelper** - Isolated Test Database
```javascript
const { TestDatabaseHelper } = require('./test-framework');

const dbHelper = new TestDatabaseHelper();
await dbHelper.createTestDatabase();     // Fresh test DB
const testDbPath = dbHelper.getTestDbPath();
await dbHelper.cleanupTestDatabase();    // Clean up
```

## 🔄 Incremental Testing Workflow

### **When Creating New Features:**

1. **🏗️ Create Component**
   ```bash
   # Create new repository/service
   touch backend/dal/repositories/CORE_NewRepository.js
   ```

2. **🧪 Generate Tests**
   ```bash
   npm run test:generate
   ```

3. **✅ Write Unit Tests**
   ```bash
   # Edit generated test file
   # Add specific business logic tests
   npm run test:unit
   ```

4. **🔗 Update Integration Tests**
   ```bash
   # Add new feature to integration scenarios
   npm run test:integration
   ```

5. **🌐 Extend E2E Tests**
   ```bash
   # Add new workflows that use the feature
   npm run test:e2e
   ```

6. **🚀 Full Validation**
   ```bash
   npm test
   ```

### **When Modifying Existing Features:**

1. **🧪 Run Existing Tests**
   ```bash
   npm run test:unit
   ```

2. **🔄 Update Tests** (if behavior changed)

3. **🔗 Integration Check**
   ```bash
   npm run test:integration
   ```

4. **✅ Full Validation**
   ```bash
   npm test
   ```

## 🛡️ Continuous Integration

### **Pre-Commit Hooks**
```bash
# Validate architecture
npm run validate

# Run full test suite
npm test

# Check service health
npm run health
```

### **Development Guidelines**
- ❌ **Never commit** without passing tests
- ✅ **Always add tests** for new functionality  
- 🔄 **Update tests** when changing behavior
- 📊 **Maintain coverage** above target thresholds

## 📈 Test Metrics and Reporting

The test runner provides comprehensive metrics:

- **Execution time** per test and overall
- **Pass/fail rates** by test type
- **Coverage analysis** (manual tracking)
- **Architecture compliance** validation
- **Performance regression** detection

## 🎯 Quality Gates

### **Unit Test Quality Gates**
- ✅ All public methods tested
- ✅ Error conditions handled
- ✅ Edge cases covered
- ✅ Mocks properly isolated
- ✅ Architecture compliance verified

### **Integration Test Quality Gates**  
- ✅ Service dependencies work together
- ✅ Database transactions complete
- ✅ Cross-repository operations succeed
- ✅ Multi-user isolation maintained
- ✅ Error propagation handled

### **E2E Test Quality Gates**
- ✅ Complete user workflows succeed
- ✅ Realistic data scenarios work
- ✅ Error recovery paths tested
- ✅ Performance within acceptable limits
- ✅ Security boundaries respected

## 🚀 Future Enhancements

- **Jest Integration** - Professional test framework
- **Coverage Reporting** - Automated coverage analysis
- **Performance Testing** - Load and stress testing
- **Visual Testing** - UI component testing (when frontend is added)
- **API Testing** - REST/GraphQL endpoint testing (when API is added)
