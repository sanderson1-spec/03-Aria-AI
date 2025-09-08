#!/usr/bin/env node

/**
 * Aria AI Application - IDE Entry Point
 * 
 * CLEAN ARCHITECTURE DESIGN:
 * - Simple entry point optimized for IDE execution
 * - Automatic development mode configuration
 * - Minimal setup for quick testing and development
 * 
 * This file is designed to be executed directly from your IDE's "play" button.
 * It automatically starts the application in development mode with sensible defaults.
 */

const { startApplication } = require('./start');

/**
 * IDE-optimized startup configuration
 * Automatically configures for development environment
 */
async function runFromIDE() {
    console.log('🎮 Starting Aria AI from IDE...');
    console.log('📍 Automatically configured for development mode');
    console.log('');
    
    // Set environment variables for IDE execution
    process.env.NODE_ENV = 'development';
    process.env.SKIP_LLM_CONNECTION_TEST = 'false'; // Enable LLM connection test
    process.env.LOG_LEVEL = 'debug';
    process.env.LLM_ENDPOINT = 'http://192.168.178.182:1234/v1/chat/completions';
    process.env.LLM_MODEL = 'meta-llama-3.1-8b-instruct'; // Use a specific model instead of 'auto'
    
    // Override command line arguments to force development mode
    process.argv = ['node', 'index.js', '--dev'];
    
    try {
        // Start the application using the main startup script
        const serviceFactory = await startApplication();
        
        console.log('');
        console.log('🎉 IDE execution successful!');
        console.log('💡 Tip: Press the stop button in your IDE to gracefully shutdown');
        
        return serviceFactory;
        
    } catch (error) {
        console.error('💥 IDE execution failed:', error.message);
        console.error('');
        console.error('🔧 Troubleshooting:');
        console.error('   1. Ensure database is initialized: npm run setup');
        console.error('   2. Check service logs in logs/ directory');
        console.error('   3. Try running: npm run dev from terminal');
        
        process.exit(1);
    }
}

// Execute immediately when run from IDE
if (require.main === module) {
    runFromIDE().catch(error => {
        console.error('💥 Fatal error during IDE execution:', error.message);
        process.exit(1);
    });
}

// Export for programmatic usage
module.exports = {
    runFromIDE
};
