# Service Setup Documentation

## Overview

The `setupServices.js` file provides centralized service registration and initialization for the Aria AI chat application. It implements clean architecture principles with proper dependency injection and service lifecycle management.

## Quick Start

```javascript
const { setupServices } = require('./setupServices');

// Initialize all services
const serviceFactory = await setupServices({
    dbPath: './database/aria.db',
    includeMetadata: true
});

// Access services
const logger = serviceFactory.get('logger');
const database = serviceFactory.get('database');
const psychology = serviceFactory.get('psychology');

// Graceful shutdown
await serviceFactory.shutdown();
```

## Service Architecture

### Foundation Layer (No Dependencies)
- **logger**: LoggerService - Centralized logging
- **errorHandling**: ErrorHandlingService - Error wrapping and enhancement  
- **configuration**: ConfigurationService - Configuration management

### Infrastructure Layer  
- **database**: DatabaseService - Database connection and repository management

### Intelligence Layer
- **llm**: LLMService - Large Language Model integration
- **structuredResponse**: StructuredResponseService - JSON parsing from LLM

### Domain Layer
- **psychology**: PsychologyService - Character psychology and behavior
- **conversationAnalyzer**: ConversationAnalyzer - Conversation flow analysis
- **proactiveIntelligence**: ProactiveIntelligenceService - AI-driven proactive behavior
- **proactiveLearning**: ProactiveLearningService - Learning from interactions

## Initialization Order

Services are initialized in dependency order:
1. logger → errorHandling → configuration
2. database (with all repositories)
3. llm → structuredResponse  
4. psychology → conversationAnalyzer → proactiveIntelligence → proactiveLearning

## Configuration Options

```javascript
const serviceFactory = await setupServices({
    // Database configuration
    dbPath: './database/aria.db',           // Database file path
    
    // Logger configuration  
    dateFormat: 'ISO',                      // Date format for logs
    includeMetadata: true,                  // Include metadata in logs
    
    // Error handling configuration
    maxContextSize: 1000,                   // Max error context size
    includeStackTrace: true,                // Include stack traces
    
    // Configuration service options
    autoSave: true,                         // Auto-save config changes
    createMissingDirectories: true          // Create dirs if missing
});
```

## Development Mode

For development without an LLM server running:

```bash
SKIP_LLM_CONNECTION_TEST=true node your-app.js
```

Or use the test helper:

```javascript
const { setupTestServices } = require('./setupServices-test');
const serviceFactory = await setupTestServices();
```

## Health Monitoring

```javascript
// Check all services health
const health = await serviceFactory.checkAllServicesHealth();

// Get system metrics
const metrics = serviceFactory.getSystemMetrics();

// Check specific service
const isHealthy = serviceFactory.get('database').checkHealth();
```

## Service Access Patterns

### Correct Usage ✅
```javascript
// Get service instance
const psychology = serviceFactory.get('psychology');

// Access database through DAL
const dal = database.getDAL();
const chats = await dal.chats.getUserChats(userId);
```

### Incorrect Usage ❌
```javascript
// Don't create services manually
const psychology = new PsychologyService(); // WRONG

// Don't access database directly  
await database.db.run("SELECT..."); // WRONG
```

## Error Handling

All services use centralized error handling:

```javascript
try {
    const result = await psychology.analyzeState(sessionId);
} catch (error) {
    // Errors are already wrapped with context
    console.error('Layer:', error.layer);
    console.error('Context:', error.context);
    console.error('Original:', error.originalError);
}
```

## Graceful Shutdown

```javascript
// Shutdown all services in reverse dependency order
await serviceFactory.shutdown();

// Or use the helper function
const { shutdownServices } = require('./setupServices');
await shutdownServices(serviceFactory);
```

## Architecture Compliance

The service setup enforces clean architecture rules:

1. **All services extend AbstractService**
2. **Dependency injection through constructor**
3. **No direct SQL outside repositories**
4. **No console.log outside LoggerService**
5. **Repository pattern for all database access**
6. **Service registration required for all services**

## Troubleshooting

### Database Issues
- Ensure database file exists and is readable
- Run database migrations if tables are missing
- Check that all repositories are properly registered

### LLM Connection Issues
- Use `SKIP_LLM_CONNECTION_TEST=true` for development
- Verify LLM server is running on configured endpoint
- Check network connectivity and firewall settings

### Service Dependencies
- Services are initialized in dependency order
- Missing dependencies will cause initialization failure
- Check service registration includes all required dependencies

## Adding New Services

1. Create service extending AbstractService:
```javascript
const AbstractService = require('./backend/services/base/CORE_AbstractService');

class MyService extends AbstractService {
    constructor(dependencies) {
        super('MyService', dependencies);
        this.logger = dependencies.logger;
        // ... other dependencies
    }
    
    async onInitialize() {
        this.logger.info('MyService initialized');
    }
}
```

2. Register in setupServices.js:
```javascript
serviceFactory.registerService('myService', MyService, [
    'logger', 'errorHandling', 'database'
]);
```

3. Access in other services:
```javascript
// In another service's constructor
this.myService = dependencies.myService;
```
