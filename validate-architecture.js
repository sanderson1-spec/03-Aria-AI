#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Clean Architecture Validator
 * 
 * ARCHITECTURE ENFORCEMENT:
 * - Validates clean architecture principles across all services
 * - Detects SQL queries outside repository layer
 * - Ensures console.* usage only in LoggerService
 * - Verifies AbstractService inheritance
 * - Validates constructor(dependencies) pattern
 * - Reports violations with precise file/line information
 * 
 * VALIDATION RULES:
 * 1. SQL_VIOLATION: No SQL queries outside /repositories/ files
 * 2. CONSOLE_VIOLATION: No console.* except in LoggerService.js
 * 3. INHERITANCE_VIOLATION: All services must extend AbstractService
 * 4. CONSTRUCTOR_VIOLATION: All services must use constructor(dependencies)
 * 5. DATABASE_IMPORT_VIOLATION: No direct database imports outside DAL
 */

class ArchitectureValidator {
    constructor() {
        this.violations = [];
        this.servicesPath = path.join(__dirname, 'backend', 'services');
        this.repositoriesPath = path.join(__dirname, 'backend', 'dal', 'repositories');
        
        // SQL patterns to detect
        this.sqlPatterns = [
            /\b(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|TRUNCATE)\s+/gi,
            /\.(query|run|exec|execute)\s*\(/gi,
            /\bSQL\s*[:=]\s*['"`]/gi,
            /\b(db|database)\.(query|run|exec|execute)/gi
        ];
        
        // Console patterns to detect
        this.consolePatterns = [
            /console\.(log|error|warn|info|debug|trace)\s*\(/g
        ];
        
        // Database import patterns
        this.databaseImportPatterns = [
            /require\s*\(\s*['"`]sqlite3['"`]\s*\)/g,
            /require\s*\(\s*['"`]mysql['"`]\s*\)/g,
            /require\s*\(\s*['"`]postgres['"`]\s*\)/g,
            /require\s*\(\s*['"`]mongodb['"`]\s*\)/g,
            /import.*from\s*['"`](sqlite3|mysql|postgres|mongodb)['"`]/g
        ];
        
        // AbstractService patterns
        this.abstractServicePatterns = {
            extends: /class\s+\w+\s+extends\s+AbstractService/,
            import: /require\s*\(\s*['"`].*AbstractService['"`]\s*\)/,
            constructor: /constructor\s*\(\s*dependencies\s*(?:=\s*\{\}\s*)?\)/
        };
    }

    /**
     * Main validation entry point
     */
    async validate() {
        console.log('🔍 Starting Clean Architecture validation...\n');
        
        try {
            // Scan all service files
            await this.scanDirectory(this.servicesPath);
            
            // Report results
            this.reportResults();
            
            // Exit with appropriate code
            process.exit(this.violations.length > 0 ? 1 : 0);
            
        } catch (error) {
            console.error('❌ Validation failed:', error.message);
            process.exit(1);
        }
    }

    /**
     * Recursively scan directory for .js files
     */
    async scanDirectory(dirPath) {
        if (!fs.existsSync(dirPath)) {
            return;
        }

        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        
        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            
            if (entry.isDirectory()) {
                await this.scanDirectory(fullPath);
            } else if (entry.isFile() && entry.name.endsWith('.js')) {
                await this.validateFile(fullPath);
            }
        }
    }

    /**
     * Validate a single JavaScript file
     */
    async validateFile(filePath) {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const relativePath = path.relative(__dirname, filePath);
            const lines = content.split('\n');
            
            // Determine file type and applicable rules
            const isRepository = filePath.includes('/repositories/');
            const isLoggerService = filePath.endsWith('LoggerService.js');
            const isServiceFile = filePath.includes('/services/') && !filePath.includes('/base/');
            const isAbstractService = filePath.endsWith('AbstractService.js');
            
            // Skip validation for AbstractService itself
            if (isAbstractService) {
                return;
            }
            
            // Apply validation rules based on file type
            if (!isRepository) {
                this.validateNoSQL(relativePath, lines);
            }
            
            if (!isLoggerService) {
                this.validateNoConsole(relativePath, lines);
            }
            
            if (isServiceFile && !isAbstractService) {
                this.validateServiceStructure(relativePath, content, lines);
            }
            
            if (!isRepository && !filePath.includes('/dal/')) {
                this.validateNoDatabaseImports(relativePath, lines);
            }
            
        } catch (error) {
            this.addViolation('FILE_READ_ERROR', filePath, 0, '', `Cannot read file: ${error.message}`);
        }
    }

    /**
     * Validate no SQL queries outside repositories
     */
    validateNoSQL(filePath, lines) {
        lines.forEach((line, index) => {
            const lineNumber = index + 1;
            
            for (const pattern of this.sqlPatterns) {
                const matches = line.match(pattern);
                if (matches) {
                    matches.forEach(match => {
                        this.addViolation(
                            'SQL_VIOLATION',
                            filePath,
                            lineNumber,
                            line.trim(),
                            'SQL found outside repository layer'
                        );
                    });
                }
            }
        });
    }

    /**
     * Validate no console usage outside LoggerService
     */
    validateNoConsole(filePath, lines) {
        lines.forEach((line, index) => {
            const lineNumber = index + 1;
            
            // Skip comments
            if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
                return;
            }
            
            for (const pattern of this.consolePatterns) {
                pattern.lastIndex = 0; // Reset regex state
                const matches = pattern.exec(line);
                if (matches) {
                    this.addViolation(
                        'CONSOLE_VIOLATION',
                        filePath,
                        lineNumber,
                        line.trim(),
                        'console.* usage found outside LoggerService'
                    );
                }
            }
        });
    }

    /**
     * Validate service structure (AbstractService inheritance and constructor)
     */
    validateServiceStructure(filePath, content, lines) {
        const hasAbstractServiceImport = this.abstractServicePatterns.import.test(content);
        const extendsAbstractService = this.abstractServicePatterns.extends.test(content);
        const hasCorrectConstructor = this.abstractServicePatterns.constructor.test(content);
        
        // Check for class definition
        const classMatch = content.match(/class\s+(\w+)/);
        if (!classMatch) {
            return; // Not a class file, skip validation
        }
        
        const className = classMatch[1];
        
        // Find class line number
        const classLineIndex = lines.findIndex(line => line.includes(`class ${className}`));
        const classLineNumber = classLineIndex >= 0 ? classLineIndex + 1 : 1;
        
        // Validate AbstractService import
        if (!hasAbstractServiceImport) {
            this.addViolation(
                'INHERITANCE_VIOLATION',
                filePath,
                1,
                'Missing AbstractService import',
                'Service must import AbstractService'
            );
        }
        
        // Validate extends AbstractService
        if (!extendsAbstractService) {
            this.addViolation(
                'INHERITANCE_VIOLATION',
                filePath,
                classLineNumber,
                lines[classLineIndex] || '',
                'Service must extend AbstractService'
            );
        }
        
        // Validate constructor pattern
        if (!hasCorrectConstructor) {
            const constructorLineIndex = lines.findIndex(line => line.includes('constructor'));
            const constructorLineNumber = constructorLineIndex >= 0 ? constructorLineIndex + 1 : classLineNumber;
            
            this.addViolation(
                'CONSTRUCTOR_VIOLATION',
                filePath,
                constructorLineNumber,
                lines[constructorLineIndex] || 'Missing constructor',
                'Service must use constructor(dependencies = {}) pattern'
            );
        }
    }

    /**
     * Validate no direct database imports outside DAL
     */
    validateNoDatabaseImports(filePath, lines) {
        lines.forEach((line, index) => {
            const lineNumber = index + 1;
            
            for (const pattern of this.databaseImportPatterns) {
                pattern.lastIndex = 0; // Reset regex state
                const matches = pattern.exec(line);
                if (matches) {
                    this.addViolation(
                        'DATABASE_IMPORT_VIOLATION',
                        filePath,
                        lineNumber,
                        line.trim(),
                        'Direct database import found outside DAL layer'
                    );
                }
            }
        });
    }

    /**
     * Add a violation to the results
     */
    addViolation(type, filePath, lineNumber, code, issue) {
        this.violations.push({
            type,
            filePath,
            lineNumber,
            code,
            issue
        });
    }

    /**
     * Report validation results
     */
    reportResults() {
        if (this.violations.length === 0) {
            console.log('✅ ALL ARCHITECTURE RULES PASSED!');
            console.log('🏗️  Clean Architecture principles are properly enforced.\n');
            return;
        }

        console.log(`❌ ${this.violations.length} VIOLATION${this.violations.length > 1 ? 'S' : ''} FOUND:\n`);
        
        // Group violations by type
        const violationsByType = {};
        this.violations.forEach(violation => {
            if (!violationsByType[violation.type]) {
                violationsByType[violation.type] = [];
            }
            violationsByType[violation.type].push(violation);
        });

        // Report each violation type
        Object.entries(violationsByType).forEach(([type, violations]) => {
            console.log(`\n🚨 ${type} (${violations.length} violation${violations.length > 1 ? 's' : ''}):`);
            console.log('─'.repeat(60));
            
            violations.forEach(violation => {
                console.log(`File: ${violation.filePath}`);
                console.log(`Line: ${violation.lineNumber}`);
                console.log(`Code: ${violation.code}`);
                console.log(`Issue: ${violation.issue}`);
                console.log('');
            });
        });

        // Summary
        console.log('📋 SUMMARY:');
        console.log('─'.repeat(40));
        Object.entries(violationsByType).forEach(([type, violations]) => {
            console.log(`${type}: ${violations.length} violation${violations.length > 1 ? 's' : ''}`);
        });
        console.log(`\nTotal violations: ${this.violations.length}`);
        console.log('\n🔧 Please fix these violations to maintain Clean Architecture principles.\n');
    }

    /**
     * Get violation statistics
     */
    getStatistics() {
        const stats = {
            total: this.violations.length,
            byType: {}
        };

        this.violations.forEach(violation => {
            stats.byType[violation.type] = (stats.byType[violation.type] || 0) + 1;
        });

        return stats;
    }
}

/**
 * CLI interface
 */
function main() {
    const validator = new ArchitectureValidator();
    
    // Handle command line arguments
    const args = process.argv.slice(2);
    
    if (args.includes('--help') || args.includes('-h')) {
        console.log(`
Clean Architecture Validator

Usage: node validate-architecture.js [options]

Options:
  --help, -h     Show this help message
  --verbose, -v  Show verbose output
  --json         Output results in JSON format

Validation Rules:
  • SQL_VIOLATION: No SQL queries outside repository layer
  • CONSOLE_VIOLATION: No console.* usage except in LoggerService
  • INHERITANCE_VIOLATION: All services must extend AbstractService
  • CONSTRUCTOR_VIOLATION: All services must use constructor(dependencies)
  • DATABASE_IMPORT_VIOLATION: No direct database imports outside DAL

Exit Codes:
  0 - All architecture rules passed
  1 - Violations found or validation failed
        `);
        process.exit(0);
    }

    if (args.includes('--json')) {
        // JSON output mode
        validator.validate().then(() => {
            const stats = validator.getStatistics();
            console.log(JSON.stringify({
                passed: stats.total === 0,
                violations: validator.violations,
                statistics: stats
            }, null, 2));
        }).catch(error => {
            console.error(JSON.stringify({ error: error.message }, null, 2));
            process.exit(1);
        });
    } else {
        // Standard output mode
        validator.validate();
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = ArchitectureValidator;
