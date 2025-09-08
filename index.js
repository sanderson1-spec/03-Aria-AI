#!/usr/bin/env node

/**
 * Aria AI Application - Complete IDE Entry Point
 * 
 * CLEAN ARCHITECTURE DESIGN:
 * - Complete application startup (backend + frontend) from IDE
 * - Intelligent mode detection (development/production)
 * - Graceful shutdown handling for both servers
 * - Single entry point for the complete application
 * 
 * This file starts both backend and frontend servers when executed from IDE.
 * It works in both development and production modes.
 */

const { setupServices, shutdownServices, checkServicesHealth } = require('./setupServices');
const APIServer = require('./backend/api/server');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// Global references for graceful shutdown
let globalServiceFactory = null;
let globalFrontendProcess = null;
let globalApiServer = null;

/**
 * Start frontend server (works in both dev and production modes)
 */
async function startFrontendServer(isDevelopment = true) {
    console.log(`🎨 Starting frontend ${isDevelopment ? 'development' : 'production'} server...`);
    
    const frontendPath = path.join(__dirname, 'frontend');
    
    // Check if frontend directory exists
    if (!fs.existsSync(frontendPath)) {
        console.log('⚠️  Frontend directory not found, skipping frontend server');
        return null;
    }
    
    // Check if package.json exists in frontend
    const frontendPackageJson = path.join(frontendPath, 'package.json');
    if (!fs.existsSync(frontendPackageJson)) {
        console.log('⚠️  Frontend package.json not found, skipping frontend server');
        return null;
    }

    // Check if node_modules exists in frontend
    const frontendNodeModules = path.join(frontendPath, 'node_modules');
    if (!fs.existsSync(frontendNodeModules)) {
        console.log('⚠️  Frontend dependencies not installed. Installing...');
        try {
            await new Promise((resolve, reject) => {
                const installProcess = spawn('npm', ['install'], {
                    cwd: frontendPath,
                    stdio: 'inherit',
                    shell: true
                });
                installProcess.on('close', (code) => {
                    if (code === 0) resolve();
                    else reject(new Error(`npm install failed with code ${code}`));
                });
            });
            console.log('✅ Frontend dependencies installed successfully');
        } catch (error) {
            console.log('⚠️  Failed to install frontend dependencies:', error.message);
            return null;
        }
    }
    
    return new Promise((resolve, reject) => {
        // Choose the appropriate command based on mode
        const command = isDevelopment ? 'dev' : 'preview';
        const args = isDevelopment 
            ? ['run', 'dev', '--', '--port', '5173', '--host', '0.0.0.0']
            : ['run', 'build', '&&', 'npm', 'run', 'preview', '--', '--port', '5173', '--host', '0.0.0.0'];
        
        // Start frontend server
        const frontendProcess = spawn('npm', args, {
            cwd: frontendPath,
            stdio: ['ignore', 'pipe', 'pipe'],
            shell: true,
            env: { ...process.env, FORCE_COLOR: '1' }
        });
        
        let serverStarted = false;
        let startupTimeout;
        
        // Set a timeout for server startup
        startupTimeout = setTimeout(() => {
            if (!serverStarted) {
                console.log('⚠️  Frontend server startup timeout - frontend may not be available');
                console.log(`   Try starting frontend manually: cd frontend && npm run ${command}`);
                resolve(null); // Return null instead of the process
            }
        }, isDevelopment ? 15000 : 30000); // Longer timeout for production build
        
        frontendProcess.stdout.on('data', (data) => {
            const output = data.toString();
            console.log(`[Frontend] ${output.trim()}`);
            
            // Look for server startup confirmation
            if (output.includes('ready in') || 
                (output.includes('Local:') && output.includes('5173')) ||
                output.includes('localhost:5173')) {
                if (!serverStarted) {
                    serverStarted = true;
                    clearTimeout(startupTimeout);
                    
                    // Wait a moment for the server to fully bind to the port
                    setTimeout(() => {
                        console.log('✅ Frontend server started successfully');
                        console.log('🌐 Frontend UI available at: http://localhost:5173/');
                        console.log('🌐 Frontend UI also available at: http://127.0.0.1:5173/');
                        
                        resolve(frontendProcess);
                    }, 1000);
                }
            }
        });
        
        frontendProcess.stderr.on('data', (data) => {
            const error = data.toString();
            console.log(`[Frontend Error] ${error.trim()}`);
        });
        
        frontendProcess.on('error', (error) => {
            clearTimeout(startupTimeout);
            console.log('⚠️  Frontend server error:', error.message);
            console.log('   Continuing without frontend server...');
            resolve(null);
        });
        
        frontendProcess.on('close', (code) => {
            clearTimeout(startupTimeout);
            if (!serverStarted) {
                console.log(`⚠️  Frontend server exited with code ${code}`);
                resolve(null);
            }
        });
    });
}

/**
 * Setup graceful shutdown for both servers
 */
function setupGracefulShutdown() {
    const gracefulShutdown = async (signal) => {
        console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
        
        try {
            // Stop frontend server first
            if (globalFrontendProcess) {
                console.log('🎨 Stopping frontend server...');
                globalFrontendProcess.kill('SIGTERM');
                
                // Wait a moment for graceful shutdown
                await new Promise(resolve => {
                    const timeout = setTimeout(resolve, 3000);
                    globalFrontendProcess.on('close', () => {
                        clearTimeout(timeout);
                        resolve();
                    });
                });
                console.log('✅ Frontend server stopped');
            }
            
            // Stop API server
            if (globalApiServer) {
                console.log('🌐 Stopping API server...');
                await globalApiServer.stop();
                console.log('✅ API server stopped');
            }
            
            // Shutdown services
            if (globalServiceFactory) {
                console.log('🔧 Shutting down services...');
                await shutdownServices(globalServiceFactory);
                console.log('✅ All services stopped');
            }
            
            console.log('🎉 Graceful shutdown completed');
            process.exit(0);
            
        } catch (error) {
            console.error('💥 Error during shutdown:', error.message);
            process.exit(1);
        }
    };

    // Handle various termination signals
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGQUIT', () => gracefulShutdown('SIGQUIT'));
    
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
 * Complete application startup (backend + frontend)
 * Works in both development and production modes
 */
async function runCompleteApplication() {
    console.log('🎮 Starting Complete Aria AI Application from IDE...');
    
    // Determine mode based on environment or default to development
    const isDevelopment = process.env.NODE_ENV !== 'production';
    const mode = isDevelopment ? 'Development' : 'Production';
    
    console.log(`📍 Mode: ${mode}`);
    console.log(`📍 NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📁 Working Directory: ${__dirname}`);
    console.log('');
    
    // Set environment variables for IDE execution
    if (isDevelopment) {
        process.env.NODE_ENV = 'development';
        process.env.SKIP_LLM_CONNECTION_TEST = 'false';
        process.env.LOG_LEVEL = 'debug';
        process.env.LLM_ENDPOINT = 'http://192.168.178.182:1234/v1/chat/completions';
        process.env.LLM_MODEL = 'meta-llama-3.1-8b-instruct';
    }
    
    // Override command line arguments
    process.argv = ['node', 'index.js', isDevelopment ? '--dev' : '--prod'];
    
    try {
        // Step 1: Environment validation
        console.log('🔍 Validating environment...');
        
        // Step 2: Initialize database
        const dbPath = process.env.DB_PATH || path.join(__dirname, 'database', 'aria.db');
        console.log('🗄️  Checking database initialization...');
        
        // Step 3: Setup services
        console.log('🏗️  Initializing service architecture...');
        
        const config = {
            dbPath,
            includeMetadata: isDevelopment,
            dateFormat: 'ISO',
            maxContextSize: isDevelopment ? 500 : 1000,
            includeStackTrace: isDevelopment,
            autoSave: !isDevelopment,
            createMissingDirectories: true
        };
        
        globalServiceFactory = await setupServices(config);
        
        // Step 4: Start API server
        console.log('🌐 Starting API server...');
        globalApiServer = new APIServer(globalServiceFactory);
        await globalApiServer.start();
        
        // Step 5: Start frontend server (ALWAYS, regardless of mode)
        globalFrontendProcess = await startFrontendServer(isDevelopment);
        
        // Step 6: Health check
        console.log('🏥 Running initial health check...');
        const healthStatus = await checkServicesHealth(globalServiceFactory);
        
        const healthyServices = healthStatus.healthyServices || 0;
        const totalServices = healthStatus.totalServices || 0;
        
        console.log(`📊 Health Status: ${healthyServices}/${totalServices} services healthy`);
        
        // Step 7: Setup graceful shutdown
        setupGracefulShutdown();
        
        // Step 8: Application ready
        console.log('');
        console.log('🎉 Complete Aria AI Application Started Successfully!');
        console.log('');
        console.log('📋 Available Services:');
        console.log('   🌐 Backend API: http://localhost:3001');
        console.log('   🎨 Frontend UI: http://localhost:5173');
        console.log('   📡 Chat API: http://localhost:3001/api/chat');
        console.log('');
        console.log('🔧 Management:');
        console.log('   💡 Press the stop button in your IDE to gracefully shutdown');
        console.log('   📁 Check logs/ directory for detailed service logs');
        console.log('');
        console.log('🔄 Application running... (Stop from IDE or Ctrl+C)');
        
        return globalServiceFactory;
        
    } catch (error) {
        console.error('💥 Application startup failed:', error.message);
        console.error('');
        console.error('🔧 Troubleshooting:');
        console.error('   1. Ensure database is initialized: npm run setup');
        console.error('   2. Check service logs in logs/ directory');
        console.error('   3. Ensure frontend dependencies are installed: cd frontend && npm install');
        console.error('   4. Try running: npm run dev from terminal');
        
        // Cleanup on failure
        if (globalFrontendProcess) {
            globalFrontendProcess.kill('SIGTERM');
        }
        if (globalApiServer) {
            await globalApiServer.stop();
        }
        if (globalServiceFactory) {
            await shutdownServices(globalServiceFactory);
        }
        
        process.exit(1);
    }
}

// Execute immediately when run from IDE
if (require.main === module) {
    runCompleteApplication().catch(error => {
        console.error('💥 Fatal error during IDE execution:', error.message);
        process.exit(1);
    });
}

// Export for programmatic usage
module.exports = {
    runCompleteApplication,
    startFrontendServer,
    setupGracefulShutdown
};
