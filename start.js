#!/usr/bin/env node

/**
 * Aria AI Application Startup Script
 * 
 * CLEAN ARCHITECTURE DESIGN:
 * - Environment validation and dependency checks
 * - Graceful service initialization with proper error handling
 * - Health monitoring and graceful shutdown handling
 * - Development vs Production configuration management
 * 
 * Usage:
 *   npm start                    # Start in production mode
 *   npm run dev                  # Start in development mode  
 *   node start.js --dev          # Start in development mode
 *   node start.js --prod         # Start in production mode
 *   node start.js --help         # Show help
 */

const { setupServices, shutdownServices, checkServicesHealth } = require('./setupServices');
const path = require('path');
const fs = require('fs');

// Parse command line arguments
const args = process.argv.slice(2);
const isDevelopment = args.includes('--dev') || process.env.NODE_ENV === 'development';
const isProduction = args.includes('--prod') || process.env.NODE_ENV === 'production';
const showHelp = args.includes('--help') || args.includes('-h');

/**
 * Display help information
 */
function displayHelp() {
    console.log(`
🤖 Aria AI Chat Application Startup Script

USAGE:
  node start.js [options]
  npm start                    # Production mode
  npm run dev                  # Development mode

OPTIONS:
  --dev                        # Development mode (verbose logging, test database)
  --prod                       # Production mode (optimized settings)
  --help, -h                   # Show this help message

ENVIRONMENT VARIABLES:
  NODE_ENV                     # Set to 'development' or 'production'
  SKIP_LLM_CONNECTION_TEST     # Skip LLM server connection test
  DB_PATH                      # Custom database file path
  LOG_LEVEL                    # Logging level (debug, info, warn, error)

EXAMPLES:
  node start.js --dev          # Start in development mode
  NODE_ENV=production node start.js  # Production with env var
  SKIP_LLM_CONNECTION_TEST=true node start.js --dev  # Dev without LLM
    `);
}

/**
 * Validate environment and dependencies
 */
async function validateEnvironment() {
    console.log('🔍 Validating environment...');
    
    const issues = [];
    
    // Check Node.js version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    if (majorVersion < 14) {
        issues.push(`Node.js version ${nodeVersion} is too old. Requires Node.js 14+`);
    }
    
    // Check required directories
    const requiredDirs = ['backend', 'database'];
    for (const dir of requiredDirs) {
        const dirPath = path.join(__dirname, dir);
        if (!fs.existsSync(dirPath)) {
            issues.push(`Required directory missing: ${dir}`);
        }
    }
    
    // Check database directory and create if needed
    const databaseDir = path.join(__dirname, 'database');
    if (!fs.existsSync(databaseDir)) {
        console.log('📁 Creating database directory...');
        fs.mkdirSync(databaseDir, { recursive: true });
    }
    
    // Check for required schema files
    const schemaFile = path.join(__dirname, 'database', 'schema.sql');
    if (!fs.existsSync(schemaFile)) {
        console.log('⚠️  Warning: database/schema.sql not found. Database tables may not exist.');
    }
    
    // Check package.json and dependencies
    const packageJsonPath = path.join(__dirname, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
        issues.push('package.json not found');
    } else {
        try {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            const requiredDeps = ['sqlite3', 'uuid'];
            for (const dep of requiredDeps) {
                if (!packageJson.dependencies || !packageJson.dependencies[dep]) {
                    issues.push(`Required dependency missing: ${dep}`);
                }
            }
        } catch (error) {
            issues.push('Invalid package.json format');
        }
    }
    
    if (issues.length > 0) {
        console.error('❌ Environment validation failed:');
        issues.forEach(issue => console.error(`   - ${issue}`));
        throw new Error('Environment validation failed');
    }
    
    console.log('✅ Environment validation passed');
}

/**
 * Initialize database schema if needed
 */
async function initializeDatabase(dbPath) {
    console.log('🗄️  Checking database initialization...');
    
    const sqlite3 = require('sqlite3').verbose();
    
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                reject(new Error(`Database connection failed: ${err.message}`));
                return;
            }
            
            // Check if tables exist
            db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='chats'", (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                if (!row) {
                    console.log('📋 Database tables not found. Please run schema initialization first.');
                    console.log('   Run: sqlite3 database/aria.db < database/schema.sql');
                } else {
                    console.log('✅ Database tables verified');
                }
                
                db.close();
                resolve();
            });
        });
    });
}

/**
 * Setup graceful shutdown handling
 */
function setupGracefulShutdown(serviceFactory) {
    let shuttingDown = false;
    
    const gracefulShutdown = async (signal) => {
        if (shuttingDown) {
            console.log('⚠️  Already shutting down, force exit...');
            process.exit(1);
        }
        
        shuttingDown = true;
        console.log(`\n🛑 Received ${signal}, initiating graceful shutdown...`);
        
        try {
            await shutdownServices(serviceFactory);
            console.log('✅ Graceful shutdown completed');
            process.exit(0);
        } catch (error) {
            console.error('❌ Error during shutdown:', error.message);
            process.exit(1);
        }
    };
    
    // Handle various shutdown signals
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGUSR1', () => gracefulShutdown('SIGUSR1'));
    process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2'));
    
    // Handle uncaught exceptions
    process.on('uncaughtException', async (error) => {
        console.error('💥 Uncaught Exception:', error);
        await gracefulShutdown('uncaughtException');
    });
    
    process.on('unhandledRejection', async (reason, promise) => {
        console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
        await gracefulShutdown('unhandledRejection');
    });
}

/**
 * Start the Aria AI application
 */
async function startApplication() {
    try {
        console.log('🤖 Starting Aria AI Chat Application...');
        console.log(`📍 Mode: ${isDevelopment ? 'Development' : 'Production'}`);
        console.log(`📁 Working Directory: ${__dirname}`);
        console.log('');
        
        // Step 1: Environment validation
        await validateEnvironment();
        
        // Step 2: Determine configuration (unified database)
        const dbPath = process.env.DB_PATH || path.join(__dirname, 'database', 'aria.db');
        
        const config = {
            dbPath,
            includeMetadata: isDevelopment,
            dateFormat: 'ISO',
            maxContextSize: isDevelopment ? 500 : 1000,
            includeStackTrace: isDevelopment,
            autoSave: !isDevelopment,
            createMissingDirectories: true
        };
        
        // Step 3: Initialize database
        await initializeDatabase(dbPath);
        
        // Step 4: Setup services
        console.log('🏗️  Initializing service architecture...');
        
        // Set environment flags for development
        if (isDevelopment) {
            process.env.SKIP_LLM_CONNECTION_TEST = 'false'; // Enable LLM connection test
            process.env.LOG_LEVEL = 'debug';
            process.env.LLM_ENDPOINT = 'http://192.168.178.182:1234/v1/chat/completions';
            process.env.LLM_MODEL = 'meta-llama-3.1-8b-instruct'; // Use a specific model instead of 'auto'
        }
        
        const serviceFactory = await setupServices(config);
        
        // Step 5: Health check
        console.log('🏥 Running initial health check...');
        const healthStatus = await checkServicesHealth(serviceFactory);
        
        // Handle the health status format correctly
        const healthyServices = healthStatus.healthyServices || 0;
        const totalServices = healthStatus.totalServices || 0;
        const serviceDetails = healthStatus.details || {};
        
        console.log(`📊 Health Status: ${healthyServices}/${totalServices} services healthy`);
        
        // In development mode, allow startup even if some services are unhealthy (e.g., LLM server not running)
        if (healthyServices === 0 && !isDevelopment) {
            throw new Error('No services are healthy - cannot start application');
        } else if (healthyServices === 0 && isDevelopment) {
            console.log('⚠️  Development mode: Starting with unhealthy services (expected for local development)');
        }
        
        // Step 6: Setup graceful shutdown
        setupGracefulShutdown(serviceFactory);
        
        // Step 7: Application ready
        console.log('');
        console.log('🎉 Aria AI Application Started Successfully!');
        console.log('');
        console.log('📋 Available Services:');
        serviceFactory.getServiceNames().forEach(name => {
            const serviceHealth = serviceDetails[name];
            const isHealthy = serviceHealth && serviceHealth.healthy ? '✅' : '❌';
            const status = serviceHealth ? serviceHealth.status || 'unknown' : 'unknown';
            console.log(`   ${isHealthy} ${name} (${status})`);
        });
        console.log('');
        console.log('🔧 Management Commands:');
        console.log('   Press Ctrl+C to gracefully shutdown');
        if (isDevelopment) {
            console.log('   Check logs/ directory for detailed service logs');
        }
        console.log('');
        
        // Keep application running
        console.log('🔄 Application running... (Press Ctrl+C to stop)');
        
        // In development mode, show periodic health updates
        if (isDevelopment) {
            setInterval(async () => {
                try {
                    const currentHealth = await checkServicesHealth(serviceFactory);
                    const currentHealthy = currentHealth.healthyServices || 0;
                    const currentTotal = currentHealth.totalServices || 0;
                    console.log(`💓 Health Check: ${currentHealthy}/${currentTotal} services healthy`);
                } catch (error) {
                    console.log('⚠️  Health check failed:', error.message);
                }
            }, 30000); // Every 30 seconds
        }
        
        // Return service factory for programmatic usage
        return serviceFactory;
        
    } catch (error) {
        console.error('💥 Application startup failed:', error.message);
        if (isDevelopment) {
            console.error('Stack trace:', error.stack);
        }
        process.exit(1);
    }
}

/**
 * Main entry point
 */
async function main() {
    if (showHelp) {
        displayHelp();
        process.exit(0);
    }
    
    await startApplication();
}

// Export for programmatic usage
module.exports = {
    startApplication,
    validateEnvironment,
    initializeDatabase
};

// Execute if run directly
if (require.main === module) {
    main().catch(error => {
        console.error('💥 Fatal error:', error.message);
        process.exit(1);
    });
}
