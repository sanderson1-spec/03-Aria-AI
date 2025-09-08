#!/usr/bin/env node

/**
 * Database Initialization Script
 * 
 * INFRASTRUCTURE LAYER: Database setup and migration management
 * 
 * This script ensures the database is properly initialized with:
 * - Base schema creation
 * - Migration execution
 * - Data integrity validation
 * 
 * Usage:
 *   node init-db.js                 # Initialize development database
 *   node init-db.js --prod          # Initialize production database
 *   node init-db.js --reset         # Reset and reinitialize database
 */

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);
const isProduction = args.includes('--prod');
const shouldReset = args.includes('--reset');
const showHelp = args.includes('--help') || args.includes('-h');

/**
 * Display help information
 */
function displayHelp() {
    console.log(`
🗄️  Aria AI Database Initialization Script

USAGE:
  node init-db.js [options]

OPTIONS:
  --prod                       # Initialize production database
  --reset                      # Reset and reinitialize database (DESTRUCTIVE)
  --help, -h                   # Show this help message

EXAMPLES:
  node init-db.js              # Initialize development database
  node init-db.js --prod       # Initialize production database
  node init-db.js --reset      # Reset development database
    `);
}

/**
 * Execute SQL file against database
 */
async function executeSqlFile(db, filePath, description) {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(filePath)) {
            console.log(`⚠️  ${description} file not found: ${filePath}`);
            resolve();
            return;
        }
        
        const sql = fs.readFileSync(filePath, 'utf8');
        console.log(`📋 Executing ${description}...`);
        
        db.exec(sql, (err) => {
            if (err) {
                console.error(`❌ ${description} failed:`, err.message);
                reject(err);
            } else {
                console.log(`✅ ${description} completed`);
                resolve();
            }
        });
    });
}

/**
 * Initialize database with schema and migrations
 */
async function initializeDatabase() {
    const dbPath = path.join(__dirname, 'database', 'aria.db');
    
    console.log(`🗄️  Initializing unified database: aria.db`);
    console.log(`📍 Database path: ${dbPath}`);
    
    // Create database directory if it doesn't exist
    const databaseDir = path.dirname(dbPath);
    if (!fs.existsSync(databaseDir)) {
        console.log('📁 Creating database directory...');
        fs.mkdirSync(databaseDir, { recursive: true });
    }
    
    // If reset is requested, delete existing database
    if (shouldReset && fs.existsSync(dbPath)) {
        console.log('🗑️  Resetting database (deleting existing file)...');
        fs.unlinkSync(dbPath);
    }
    
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, async (err) => {
            if (err) {
                reject(new Error(`Database connection failed: ${err.message}`));
                return;
            }
            
            console.log('✅ Database connection established');
            
            try {
                // Execute base schema
                await executeSqlFile(
                    db, 
                    path.join(__dirname, 'database', 'schema.sql'),
                    'Base schema'
                );
                
                // Note: Migrations are no longer needed - unified schema includes all features
                console.log('📋 Using unified schema (migrations integrated)');
                
                // Verify tables exist
                db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    
                    console.log('📋 Database tables:');
                    tables.forEach(table => {
                        console.log(`   ✅ ${table.name}`);
                    });
                    
                    db.close((closeErr) => {
                        if (closeErr) {
                            reject(closeErr);
                        } else {
                            console.log('✅ Database initialization completed');
                            resolve();
                        }
                    });
                });
                
            } catch (error) {
                db.close();
                reject(error);
            }
        });
    });
}

/**
 * Main execution
 */
async function main() {
    if (showHelp) {
        displayHelp();
        process.exit(0);
    }
    
    try {
        await initializeDatabase();
        console.log('');
        console.log('🎉 Database initialization successful!');
        console.log('');
        console.log('Next steps:');
        console.log('  npm run dev     # Start in development mode');
        console.log('  npm start       # Start in production mode');
        
    } catch (error) {
        console.error('💥 Database initialization failed:', error.message);
        process.exit(1);
    }
}

// Export for programmatic usage
module.exports = {
    initializeDatabase
};

// Execute if run directly
if (require.main === module) {
    main();
}
