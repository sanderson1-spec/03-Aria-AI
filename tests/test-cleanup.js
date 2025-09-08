#!/usr/bin/env node

/**
 * Test Data Cleanup Utility
 * 
 * CLEAN ARCHITECTURE TESTING:
 * - Ensures complete test data isolation
 * - Removes all test artifacts after test runs
 * - Prevents test data from appearing in production
 * - Maintains database integrity
 */

const fs = require('fs').promises;
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

class TestDataCleanup {
    constructor() {
        this.testDbPaths = [
            path.join(__dirname, '../database/test_aria.db'),
            path.join(__dirname, '../database/test_e2e_aria.db'),
            path.join(__dirname, '../database/test_integration_aria.db')
        ];
        this.mainDbPath = path.join(__dirname, '../database/aria.db');
        this.testDataPatterns = [
            // Prefix patterns
            /^test_/i,
            /^testuser/i,
            /^integration_/i,
            /^e2e_/i,
            /^mock_/i,
            /^custom_/i,
            /^multi_/i,
            /^psych_/i,
            /^proactive_/i,
            /^crosstest/i,
            
            // Suffix patterns
            /_test$/i,
            /_integration$/i,
            /_e2e$/i,
            
            // Content patterns
            /Test Character/i,
            /Integration Test/i,
            /E2E Test/i,
            /testing purposes/i,
            /Custom Character/i,
            /Multi Session Character/i,
            /For testing/i,
            
            // Email patterns
            /@test\.com$/i,
            /test@/i,
            
            // Display name patterns
            /Test User/i,
            /Cross Test/i,
            /Psychology Test/i,
            /Proactive Test/i,
            
            // Development patterns
            /alice/i,
            /bob/i,
            /charlie/i,
            /dave/i
        ];
    }

    /**
     * Clean up all test databases
     */
    async cleanupTestDatabases() {
        console.log('🧹 Cleaning up test databases...');
        
        for (const dbPath of this.testDbPaths) {
            try {
                await fs.unlink(dbPath);
                console.log(`✅ Removed test database: ${path.basename(dbPath)}`);
            } catch (error) {
                if (error.code !== 'ENOENT') {
                    console.warn(`⚠️  Could not remove ${path.basename(dbPath)}: ${error.message}`);
                }
            }
        }
    }

    /**
     * Clean test data from main database
     */
    async cleanupMainDatabase() {
        console.log('🧹 Cleaning test data from main database...');
        
        if (!await this.fileExists(this.mainDbPath)) {
            console.log('ℹ️  Main database does not exist, skipping cleanup');
            return;
        }

        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(this.mainDbPath, (err) => {
                if (err) {
                    reject(err);
                    return;
                }

                this.cleanupTablesSequentially(db)
                    .then(() => {
                        db.close((err) => {
                            if (err) reject(err);
                            else resolve();
                        });
                    })
                    .catch(reject);
            });
        });
    }

    /**
     * Clean up tables in proper order (respecting foreign keys)
     */
    async cleanupTablesSequentially(db) {
        const tables = [
            // Order matters due to foreign key constraints
            'conversations',
            'psychology_states', 
            'proactive_engagement_history',
            'proactive_learning_patterns',
            'user_sessions',
            'chats',
            'personalities',
            'users',
            'analytics_events',
            'configuration'
        ];

        for (const table of tables) {
            await this.cleanupTable(db, table);
        }
    }

    /**
     * Clean up a specific table
     */
    async cleanupTable(db, tableName) {
        return new Promise((resolve, reject) => {
            // First, get all records that match test patterns
            db.all(`SELECT * FROM ${tableName}`, [], (err, rows) => {
                if (err) {
                    console.warn(`⚠️  Could not query table ${tableName}: ${err.message}`);
                    resolve(); // Continue with other tables
                    return;
                }

                const testRows = rows.filter(row => this.isTestData(row));
                
                if (testRows.length === 0) {
                    resolve();
                    return;
                }

                console.log(`🔍 Found ${testRows.length} test records in ${tableName}`);

                // Delete test records
                const placeholders = testRows.map(() => '?').join(',');
                const ids = testRows.map(row => row.id);
                
                if (ids.length > 0) {
                    db.run(`DELETE FROM ${tableName} WHERE id IN (${placeholders})`, ids, (err) => {
                        if (err) {
                            console.warn(`⚠️  Could not delete test data from ${tableName}: ${err.message}`);
                        } else {
                            console.log(`✅ Cleaned ${ids.length} test records from ${tableName}`);
                        }
                        resolve();
                    });
                } else {
                    resolve();
                }
            });
        });
    }

    /**
     * Check if a record contains test data
     */
    isTestData(record) {
        const values = Object.values(record);
        
        return values.some(value => {
            if (typeof value === 'string') {
                return this.testDataPatterns.some(pattern => pattern.test(value));
            }
            return false;
        });
    }

    /**
     * Check if file exists
     */
    async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Run complete cleanup
     */
    async cleanup() {
        console.log('🧪 Starting Test Data Cleanup');
        console.log('===============================');
        
        try {
            await this.cleanupTestDatabases();
            await this.cleanupMainDatabase();
            
            console.log('\n✅ Test data cleanup completed successfully!');
            console.log('📊 All test artifacts have been removed');
            
        } catch (error) {
            console.error('\n❌ Test cleanup failed:', error.message);
            throw error;
        }
    }

    /**
     * Verify cleanup was successful
     */
    async verifyCleanup() {
        console.log('\n🔍 Verifying cleanup...');
        
        // Check test databases are gone
        for (const dbPath of this.testDbPaths) {
            if (await this.fileExists(dbPath)) {
                throw new Error(`Test database still exists: ${path.basename(dbPath)}`);
            }
        }

        // Check main database for test data
        if (await this.fileExists(this.mainDbPath)) {
            const hasTestData = await this.checkMainDatabaseForTestData();
            if (hasTestData) {
                throw new Error('Main database still contains test data');
            }
        }

        console.log('✅ Cleanup verification passed!');
    }

    /**
     * Check if main database still contains test data
     */
    async checkMainDatabaseForTestData() {
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(this.mainDbPath, (err) => {
                if (err) {
                    reject(err);
                    return;
                }

                // Check a few key tables for test data
                const checkTables = ['users', 'personalities', 'chats'];
                let foundTestData = false;
                let tablesChecked = 0;

                checkTables.forEach(tableName => {
                    db.all(`SELECT * FROM ${tableName} LIMIT 100`, [], (err, rows) => {
                        if (err) {
                            tablesChecked++;
                            if (tablesChecked === checkTables.length) {
                                db.close();
                                resolve(foundTestData);
                            }
                            return;
                        }

                        const hasTest = rows.some(row => this.isTestData(row));
                        if (hasTest) {
                            foundTestData = true;
                        }

                        tablesChecked++;
                        if (tablesChecked === checkTables.length) {
                            db.close();
                            resolve(foundTestData);
                        }
                    });
                });
            });
        });
    }
}

// CLI interface
if (require.main === module) {
    const cleanup = new TestDataCleanup();
    
    const command = process.argv[2];
    
    if (command === 'verify') {
        cleanup.verifyCleanup()
            .then(() => process.exit(0))
            .catch(error => {
                console.error('Verification failed:', error.message);
                process.exit(1);
            });
    } else {
        cleanup.cleanup()
            .then(() => cleanup.verifyCleanup())
            .then(() => process.exit(0))
            .catch(error => {
                console.error('Cleanup failed:', error.message);
                process.exit(1);
            });
    }
}

module.exports = TestDataCleanup;
