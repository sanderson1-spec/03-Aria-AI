#!/usr/bin/env node

/**
 * Comprehensive Test Runner for Aria AI
 * 
 * TESTING STRATEGY:
 * 1. Auto-discovers test files in tests/ directory
 * 2. Runs tests in proper order (unit -> integration -> e2e)
 * 3. Provides detailed reporting and metrics
 * 4. Supports parallel execution for faster testing
 * 5. Creates isolated test environments
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const TestDataCleanup = require('./test-cleanup');

class TestRunner {
    constructor() {
        this.testResults = {
            unit: [],
            integration: [],
            e2e: [],
            summary: {
                totalTests: 0,
                passed: 0,
                failed: 0,
                duration: 0
            }
        };
        this.verbose = process.argv.includes('--verbose') || process.env.TEST_VERBOSE === 'true';
        this.parallel = process.argv.includes('--parallel') || process.env.TEST_PARALLEL === 'true';
    }

    /**
     * Discover all test files
     */
    async discoverTests() {
        const testDir = path.join(__dirname);
        const testFiles = {
            unit: [],
            integration: [],
            e2e: []
        };

        // Discover unit tests (services, repositories, and API routes)
        const servicesDir = path.join(testDir, 'services');
        const repositoriesDir = path.join(testDir, 'repositories');
        const apiDir = path.join(testDir, 'api');
        
        try {
            const serviceFiles = await fs.readdir(servicesDir);
            for (const file of serviceFiles) {
                if (file.endsWith('.test.js')) {
                    testFiles.unit.push(path.join(servicesDir, file));
                }
            }
        } catch (error) {
            // Services directory might not exist
        }

        try {
            const repositoryFiles = await fs.readdir(repositoriesDir);
            for (const file of repositoryFiles) {
                if (file.endsWith('.test.js')) {
                    testFiles.unit.push(path.join(repositoriesDir, file));
                }
            }
        } catch (error) {
            // Repositories directory might not exist
        }

        try {
            const apiFiles = await fs.readdir(apiDir);
            for (const file of apiFiles) {
                if (file.endsWith('.test.js')) {
                    testFiles.unit.push(path.join(apiDir, file));
                }
            }
        } catch (error) {
            // API directory might not exist
        }

        // Discover integration tests
        const integrationDir = path.join(testDir, 'integration');
        try {
            const integrationFiles = await fs.readdir(integrationDir);
            for (const file of integrationFiles) {
                if (file.endsWith('.test.js')) {
                    testFiles.integration.push(path.join(integrationDir, file));
                }
            }
        } catch (error) {
            // Integration directory might not exist
        }

        // Discover E2E tests
        const e2eDir = path.join(testDir, 'e2e');
        try {
            const e2eFiles = await fs.readdir(e2eDir);
            for (const file of e2eFiles) {
                if (file.endsWith('.test.js')) {
                    testFiles.e2e.push(path.join(e2eDir, file));
                }
            }
        } catch (error) {
            // E2E directory might not exist
        }

        return testFiles;
    }

    /**
     * Run tests of specific type
     */
    async runTestType(type, testFiles) {
        if (testFiles.length === 0) {
            console.log(`📦 ${type.toUpperCase()} Tests: No tests found\n`);
            return;
        }

        console.log(`📦 ${type.toUpperCase()} Tests (${testFiles.length} files):`);
        
        const startTime = Date.now();
        
        if (this.parallel && testFiles.length > 1) {
            await this.runTestsParallel(type, testFiles);
        } else {
            await this.runTestsSequential(type, testFiles);
        }
        
        const duration = Date.now() - startTime;
        
        const passed = this.testResults[type].filter(r => r.passed).length;
        const failed = this.testResults[type].filter(r => !r.passed).length;
        
        console.log(`  📊 ${type.toUpperCase()} Summary: ${passed}/${passed + failed} passed (${duration}ms)\n`);
    }

    /**
     * Run tests sequentially
     */
    async runTestsSequential(type, testFiles) {
        for (const testFile of testFiles) {
            const result = await this.runSingleTest(testFile);
            this.testResults[type].push(result);
            
            const status = result.passed ? '✅' : '❌';
            console.log(`  ${status} ${path.basename(testFile)} (${result.duration}ms)`);
            
            if (!result.passed && this.verbose) {
                console.log(`     Error: ${result.error}`);
            }
        }
    }

    /**
     * Run tests in parallel
     */
    async runTestsParallel(type, testFiles) {
        const promises = testFiles.map(testFile => this.runSingleTest(testFile));
        const results = await Promise.all(promises);
        
        this.testResults[type] = results;
        
        results.forEach((result, index) => {
            const status = result.passed ? '✅' : '❌';
            console.log(`  ${status} ${path.basename(testFiles[index])} (${result.duration}ms)`);
            
            if (!result.passed && this.verbose) {
                console.log(`     Error: ${result.error}`);
            }
        });
    }

    /**
     * Run a single test file
     */
    async runSingleTest(testFile) {
        return new Promise((resolve) => {
            const startTime = Date.now();
            
            // Set test environment
            const env = {
                ...process.env,
                NODE_ENV: 'test',
                TEST_MODE: 'true',
                DB_PATH: path.join(__dirname, '../database/test_aria.db')
            };
            
            const testProcess = spawn('node', [testFile], {
                env,
                stdio: this.verbose ? 'inherit' : 'pipe'
            });
            
            let output = '';
            let errorOutput = '';
            
            if (!this.verbose) {
                testProcess.stdout?.on('data', (data) => {
                    output += data.toString();
                });
                
                testProcess.stderr?.on('data', (data) => {
                    errorOutput += data.toString();
                });
            }
            
            testProcess.on('close', (code) => {
                const duration = Date.now() - startTime;
                
                resolve({
                    file: testFile,
                    passed: code === 0,
                    duration,
                    output,
                    error: errorOutput,
                    exitCode: code
                });
            });
        });
    }

    /**
     * Main test execution
     */
    async run() {
        console.log('🚀 Starting Aria AI Test Suite...\n');
        
        try {
            const testFiles = await this.discoverTests();
            const startTime = Date.now();
            
            // Run tests in order
            await this.runTestType('unit', testFiles.unit);
            await this.runTestType('integration', testFiles.integration);
            await this.runTestType('e2e', testFiles.e2e);
            
            const duration = Date.now() - startTime;
            this.printFinalSummary(duration);
            
            const success = this.getOverallSuccess();
            process.exit(success ? 0 : 1);
            
        } catch (error) {
            console.error('❌ Test runner failed:', error.message);
            process.exit(1);
        }
    }

    /**
     * Print final summary
     */
    printFinalSummary(duration) {
        const totalPassed = [
            ...this.testResults.unit,
            ...this.testResults.integration,
            ...this.testResults.e2e
        ].filter(r => r.passed).length;
        
        const totalFailed = [
            ...this.testResults.unit,
            ...this.testResults.integration,
            ...this.testResults.e2e
        ].filter(r => !r.passed).length;
        
        const totalTests = totalPassed + totalFailed;
        
        console.log('🏁 FINAL TEST RESULTS');
        console.log('=====================');
        console.log(`🧪 Unit Tests:        ${this.testResults.unit.filter(r => r.passed).length}/${this.testResults.unit.length}`);
        console.log(`🔗 Integration Tests: ${this.testResults.integration.filter(r => r.passed).length}/${this.testResults.integration.length}`);
        console.log(`🌐 E2E Tests:         ${this.testResults.e2e.filter(r => r.passed).length}/${this.testResults.e2e.length}`);
        console.log(`⏱️  Total Duration:   ${duration}ms`);
        console.log(`📈 Overall Result:   ${totalPassed}/${totalTests} tests passed`);
        
        if (totalFailed > 0) {
            console.log(`\n❌ ${totalFailed} test(s) failed - Check individual test output above`);
            
            // List failed tests
            const failedTests = [
                ...this.testResults.unit,
                ...this.testResults.integration,
                ...this.testResults.e2e
            ].filter(r => !r.passed);
            
            console.log('\n📋 Failed Tests:');
            failedTests.forEach(test => {
                console.log(`  - ${path.basename(test.file)}`);
            });
        } else {
            console.log(`\n🎉 All tests passed! Your code is solid! 🚀`);
        }
    }

    /**
     * Check overall success
     */
    getOverallSuccess() {
        const allResults = [
            ...this.testResults.unit,
            ...this.testResults.integration,
            ...this.testResults.e2e
        ];
        
        return allResults.every(result => result.passed);
    }
}

// CLI execution
if (require.main === module) {
    async function runWithCleanup() {
        console.log('🧹 Pre-test cleanup...');
        try {
            const cleanup = new TestDataCleanup();
            await cleanup.cleanup();
            console.log('✅ Pre-test cleanup completed\n');
        } catch (error) {
            console.warn('⚠️  Pre-test cleanup warning:', error.message, '\n');
        }
        
        const runner = new TestRunner();
        const success = await runner.run();
        
        console.log('\n🧹 Post-test cleanup...');
        try {
            const cleanup = new TestDataCleanup();
            await cleanup.cleanup();
            console.log('✅ Post-test cleanup completed');
        } catch (error) {
            console.warn('⚠️  Post-test cleanup warning:', error.message);
            console.warn('Please run manually: node tests/test-cleanup.js');
        }
        
        process.exit(success ? 0 : 1);
    }
    
    runWithCleanup().catch(error => {
        console.error('Test runner failed:', error);
        process.exit(1);
    });
}

const { MockFactory, TestDatabaseHelper, ArchitectureAssertions } = require('./test-framework');

module.exports = { TestRunner, MockFactory, TestDatabaseHelper, ArchitectureAssertions };
