# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture Overview

This is an AI chat application built with **strict Clean Architecture** principles. The codebase follows a service-oriented architecture with dependency injection, centralized service management, and clear separation of concerns.

### Core Architecture Components

- **AbstractService Base Class**: All services must extend `CORE_AbstractService.js` which provides standardized lifecycle management, error handling, metrics collection, and health monitoring
- **Service Factory**: `CORE_ServiceFactory.js` manages service registration, dependency injection, initialization order, and lifecycle coordination
- **Data Access Layer (DAL)**: `CORE_DataAccessLayer.js` provides infrastructure-level database operations with error wrapping
- **Repository Pattern**: Database operations are encapsulated in repository classes extending `CORE_BaseRepository.js`

### Service Architecture Rules

All services in the system follow these mandatory patterns:

1. **Service Creation Pattern**:
```javascript
const AbstractService = require('./base/AbstractService');

class YourService extends AbstractService {
    constructor(dependencies) {
        super('YourService', dependencies);
        this.dal = dependencies.database;
        this.logger = dependencies.logger;
        // Access other services via dependencies object
    }
    
    async onInitialize() {
        this.logger.info('Service initialized', 'YourService');
    }
}
```

2. **Service Registration** (in setupServices.js):
```javascript
serviceFactory.registerService('yourService', YourService, [
    'database', 'logger', 'errorHandling', 'psychology'
]);
```

3. **Database Access** (only through DAL):
```javascript
// ✅ CORRECT
await this.dal.chats.getUserChats(userId);
// ❌ FORBIDDEN - Direct SQL
this.db.run("SELECT...");
```

### Protected Files (DO NOT MODIFY)

Files prefixed with `CORE_` are foundation services and should not be modified:
- `CORE_LoggerService.js`
- `CORE_AbstractService.js` 
- `CORE_ServiceFactory.js`
- `CORE_DataAccessLayer.js`
- `CORE_BaseRepository.js`
- `CORE_StructuredResponseService.js`
- `CORE_LLMService.js`

If CORE functionality is insufficient, extend or compose rather than modify.

### Multi-User Architecture

- Every database operation MUST include `userId` for data isolation
- Chat-centric psychology uses `userId + chatId + characterId` pattern
- Multi-device continuity uses `chatId` as universal key

## Development Commands

### Validation
```bash
node validate-services.js
```
Validates service dependencies and imports. Run this to ensure all CORE services are working correctly.

### Architecture Validation
```bash
node validate-architecture.js
```
Must pass before proceeding with integration.

## Development Workflow

1. Build ONE component (single file)
2. Write unit tests immediately  
3. Run validation: `node validate-architecture.js` (must pass)
4. Integration test with existing services
5. Only then proceed to next component

## Strict Rules (IMMEDIATE FAILURE CONDITIONS)

- ❌ Any SQL outside `/repositories/` files
- ❌ Any `console.log` or `console.error` statements
- ❌ Not extending `AbstractService` for new services
- ❌ Manual service creation (e.g., `new ServiceName()`)
- ❌ Modifying any `CORE_` prefixed files

## Directory Structure

```
backend/
├── services/
│   ├── base/CORE_AbstractService.js          # Service base class
│   ├── CORE_ServiceFactory.js                # Service management
│   ├── foundation/                           # Core foundation services
│   └── intelligence/                         # AI/LLM services
├── dal/
│   ├── CORE_DataAccessLayer.js               # Database access
│   └── CORE_BaseRepository.js                # Repository base
└── utils/
    └── datetime_utils.js                     # Utility functions

tests/
├── services/                                 # Service tests
├── repositories/                             # Repository tests
└── integration/                              # Integration tests
```

## Key Dependencies

- `node-fetch`: HTTP requests (v3.3.2)

This codebase emphasizes strict architectural discipline to maintain clean separation of concerns and ensure scalability.