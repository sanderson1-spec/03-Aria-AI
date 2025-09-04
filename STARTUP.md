# 🚀 Aria AI Application Startup Guide

This guide provides multiple ways to start and manage the Aria AI chat application with its clean architecture service ecosystem.

## 🎯 Quick Start

### Option 1: Simple Launcher (Recommended)
```bash
# Make executable (first time only)
chmod +x run.sh

# Start in development mode
./run.sh dev

# Start in production mode  
./run.sh prod

# Initialize database only
./run.sh init

# See all options
./run.sh help
```

### Option 2: NPM Scripts
```bash
# Development mode (with LLM connection test skipped)
npm run dev

# Production mode
npm start

# Initialize database
node init-db.js

# Setup and validate services
npm run setup

# Check service health
npm run health
```

### Option 3: Direct Node.js
```bash
# Development mode
NODE_ENV=development SKIP_LLM_CONNECTION_TEST=true node start.js --dev

# Production mode
NODE_ENV=production node start.js --prod

# Show help
node start.js --help
```

## 📋 Available Scripts

| Script | Command | Description |
|--------|---------|-------------|
| **Development** | `./run.sh dev` or `npm run dev` | Start with verbose logging, test database, LLM connection test skipped |
| **Production** | `./run.sh prod` or `npm start` | Start with optimized settings, production database |
| **Database Init** | `./run.sh init` or `node init-db.js` | Initialize database schema and migrations |
| **Service Setup** | `npm run setup` | Test service registration and initialization |
| **Health Check** | `npm run health` | Check all service health status |
| **Tests** | `npm run test` | Run all tests (when implemented) |
| **Validation** | `npm run validate` | Validate service architecture |

## 🏗️ Service Architecture

The application initializes services in this dependency order:

1. **Foundation Layer** (No dependencies)
   - `logger` - Centralized logging
   - `errorHandling` - Error management
   - `configuration` - Configuration management

2. **Infrastructure Layer** (Depends on Foundation)
   - `database` - SQLite database with repositories

3. **Intelligence Layer** (Depends on Foundation + Infrastructure)
   - `llm` - LLM communication service
   - `structuredResponse` - JSON response parsing

4. **Domain Layer** (Depends on all lower layers)
   - `psychology` - Character psychology and behavior
   - `conversationAnalyzer` - Conversation flow analysis
   - `proactiveIntelligence` - AI-driven proactive behavior
   - `proactiveLearning` - Learning from interactions

## 🔧 Development Mode Features

When running in development mode (`npm run dev` or `./run.sh dev`):

- ✅ Verbose logging with debug information
- ✅ Uses `aria.db` unified database
- ✅ LLM connection test is skipped (no local LLM server required)
- ✅ Allows startup even if some services are unhealthy
- ✅ Periodic health check reports every 30 seconds
- ✅ Enhanced error stack traces
- ✅ Graceful shutdown with Ctrl+C

## 🏭 Production Mode Features

When running in production mode (`npm start` or `./run.sh prod`):

- ✅ Optimized logging (info level and above)
- ✅ Uses `aria.db` production database
- ✅ Full LLM connection validation required
- ✅ Strict health checks (fails if no services are healthy)
- ✅ Performance optimized settings
- ✅ Graceful shutdown handling

## 🗄️ Database Management

### Automatic Database Setup
The startup scripts automatically:
- Create the database directory if it doesn't exist
- Initialize the database with the base schema
- Run available migrations
- Verify table creation

### Manual Database Operations
```bash
# Initialize development database
node init-db.js

# Initialize production database
node init-db.js --prod

# Reset and reinitialize database (DESTRUCTIVE)
node init-db.js --reset

# Check database tables
sqlite3 database/aria.db ".tables"

# Initialize database from unified schema
sqlite3 database/aria.db < database/schema.sql
```

## 🚦 Health Monitoring

The application includes comprehensive health monitoring:

- **Service Health**: Each service reports its operational status
- **Database Health**: Connection and table validation
- **LLM Health**: API endpoint connectivity (skipped in dev mode)
- **Repository Health**: Data access layer validation

Health check results show:
- ✅ Healthy services (fully operational)
- ❌ Unhealthy services (connection issues, errors)
- ⚠️  Services with warnings (degraded but functional)

## 🛑 Graceful Shutdown

The application handles shutdown signals gracefully:

- **Ctrl+C (SIGINT)**: Initiates graceful shutdown
- **SIGTERM**: Graceful shutdown for process managers
- **Uncaught Exceptions**: Emergency shutdown with cleanup

Shutdown process:
1. Stop accepting new requests
2. Complete ongoing operations
3. Close database connections
4. Clean up temporary resources
5. Exit with appropriate code

## 🔧 Troubleshooting

### Common Issues

**Database Connection Errors**
```bash
# Solution: Initialize database first
./run.sh init
```

**Service Health Failures**
```bash
# Check specific service health
npm run health

# Validate service architecture
npm run validate
```

**LLM Connection Failures**
```bash
# Development: LLM connection is skipped automatically
npm run dev

# Production: Ensure LLM server is running at localhost:1234
```

**Permission Errors**
```bash
# Make scripts executable
chmod +x run.sh
chmod +x start.js
chmod +x init-db.js
```

### Debug Mode
```bash
# Enable verbose logging
DEBUG=* npm run dev

# Check service factory logs
tail -f logs/*.log
```

## 🌟 Best Practices

1. **Always run `./run.sh init` first** when setting up a new environment
2. **Use development mode** (`./run.sh dev`) for local development
3. **Check health status** (`npm run health`) if services seem unresponsive
4. **Use graceful shutdown** (Ctrl+C) instead of force killing processes
5. **Monitor logs** in the `logs/` directory for troubleshooting

## 🔗 Related Files

- `start.js` - Main application startup script
- `setupServices.js` - Service registration and dependency injection
- `init-db.js` - Database initialization script
- `package.json` - NPM scripts and dependencies
- `docs/SERVICE_SETUP.md` - Detailed service architecture documentation
