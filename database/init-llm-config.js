#!/usr/bin/env node
/**
 * Initialize Global LLM Configuration
 * 
 * This script sets up the default global LLM configuration in the database
 * Required for proper model resolution in the LLM service
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'aria.db');

// Check if database exists
if (!fs.existsSync(DB_PATH)) {
    console.error('❌ Database not found at:', DB_PATH);
    console.error('Please run database initialization first.');
    process.exit(1);
}

// Connect to database
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('❌ Error connecting to database:', err.message);
        process.exit(1);
    }
    console.log('✅ Connected to database');
});

// Global configuration values
const globalConfig = [
    {
        key: 'llm_conversational_model',
        value: 'meta-llama-3.1-8b-instruct',
        type: 'string',
        description: 'Default conversational model (LLM1)',
        category: 'llm',
        is_user_configurable: 1
    },
    {
        key: 'llm_conversational_temperature',
        value: '0.7',
        type: 'number',
        description: 'Default temperature for conversational model',
        category: 'llm',
        is_user_configurable: 1
    },
    {
        key: 'llm_conversational_max_tokens',
        value: '2048',
        type: 'number',
        description: 'Default max tokens for conversational model',
        category: 'llm',
        is_user_configurable: 1
    },
    {
        key: 'llm_analytical_model',
        value: 'qwen2.5-7b-instruct',
        type: 'string',
        description: 'Default analytical model (LLM2)',
        category: 'llm',
        is_user_configurable: 1
    },
    {
        key: 'llm_analytical_temperature',
        value: '0.3',
        type: 'number',
        description: 'Default temperature for analytical model',
        category: 'llm',
        is_user_configurable: 1
    },
    {
        key: 'llm_analytical_max_tokens',
        value: '2048',
        type: 'number',
        description: 'Default max tokens for analytical model',
        category: 'llm',
        is_user_configurable: 1
    },
    {
        key: 'context_window_messages_conversational',
        value: '30',
        type: 'number',
        description: 'Default context window for conversational model',
        category: 'llm',
        is_user_configurable: 1
    },
    {
        key: 'context_window_messages_analytical',
        value: '10',
        type: 'number',
        description: 'Default context window for analytical model',
        category: 'llm',
        is_user_configurable: 1
    }
];

// Function to check if configuration already exists
function checkExistingConfig(key) {
    return new Promise((resolve, reject) => {
        db.get(
            'SELECT * FROM configuration WHERE key = ?',
            [key],
            (err, row) => {
                if (err) reject(err);
                else resolve(row);
            }
        );
    });
}

// Function to insert or update configuration
async function upsertConfig(config) {
    const existing = await checkExistingConfig(config.key);
    
    if (existing) {
        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE configuration 
                 SET value = ?, type = ?, description = ?, category = ?, is_user_configurable = ?, updated_at = datetime('now')
                 WHERE key = ?`,
                [config.value, config.type, config.description, config.category, config.is_user_configurable, config.key],
                (err) => {
                    if (err) reject(err);
                    else resolve({ action: 'updated', key: config.key });
                }
            );
        });
    } else {
        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO configuration (key, value, type, description, category, is_user_configurable, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
                [config.key, config.value, config.type, config.description, config.category, config.is_user_configurable],
                (err) => {
                    if (err) reject(err);
                    else resolve({ action: 'created', key: config.key });
                }
            );
        });
    }
}

// Main execution
async function initializeGlobalConfig() {
    try {
        console.log('🔧 Initializing global LLM configuration...\n');
        
        for (const config of globalConfig) {
            try {
                const result = await upsertConfig(config);
                console.log(`✅ ${result.action} configuration: ${result.key} = ${config.value}`);
            } catch (err) {
                console.error(`❌ Failed to ${config.key}:`, err.message);
            }
        }
        
        console.log('\n✅ Global LLM configuration initialized successfully!');
        console.log('\n📋 Summary:');
        console.log(`   Conversational Model: meta-llama-3.1-8b-instruct`);
        console.log(`   Analytical Model: qwen2.5-7b-instruct`);
        console.log(`   Context Window: 30 messages (conversational), 10 messages (analytical)`);
        console.log('\nℹ️  These settings can be overridden:');
        console.log('   - Per-user in the Settings dialog');
        console.log('   - Per-character in the Character panel');
        
    } catch (err) {
        console.error('❌ Error initializing configuration:', err.message);
        process.exit(1);
    } finally {
        db.close((err) => {
            if (err) {
                console.error('Error closing database:', err.message);
            }
        });
    }
}

// Run initialization
initializeGlobalConfig();

