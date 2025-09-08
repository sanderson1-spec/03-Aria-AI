#!/bin/bash

# Comprehensive Test Runner for Aria AI
# Runs both backend and frontend tests

set -e

echo "🚀 Starting Comprehensive Test Suite for Aria AI"
echo "================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Track test results
BACKEND_TESTS_PASSED=0
FRONTEND_TESTS_PASSED=0
TOTAL_FAILURES=0

# Function to run backend tests
run_backend_tests() {
    print_status "Running Backend Tests..."
    
    cd "$(dirname "$0")"
    
    if node tests/run-all-tests.js; then
        print_success "Backend tests passed!"
        BACKEND_TESTS_PASSED=1
    else
        print_error "Backend tests failed!"
        TOTAL_FAILURES=$((TOTAL_FAILURES + 1))
    fi
}

# Function to run frontend tests
run_frontend_tests() {
    print_status "Running Frontend Tests..."
    
    cd "$(dirname "$0")/frontend"
    
    # Check if frontend dependencies are installed
    if [ ! -d "node_modules" ]; then
        print_warning "Frontend dependencies not found. Installing..."
        npm install
    fi
    
    # Check if test dependencies are available
    if ! npm list vitest > /dev/null 2>&1; then
        print_warning "Test dependencies not found. Installing..."
        npm install
    fi
    
    if npm run test; then
        print_success "Frontend tests passed!"
        FRONTEND_TESTS_PASSED=1
    else
        print_error "Frontend tests failed!"
        TOTAL_FAILURES=$((TOTAL_FAILURES + 1))
    fi
    
    cd ..
}

# Function to check test coverage
check_coverage() {
    print_status "Checking Test Coverage..."
    
    cd "$(dirname "$0")/frontend"
    
    if npm run test:coverage; then
        print_success "Coverage report generated!"
    else
        print_warning "Could not generate coverage report"
    fi
    
    cd ..
}

# Function to run architecture validation
run_architecture_validation() {
    print_status "Running Architecture Validation..."
    
    cd "$(dirname "$0")"
    
    if [ -f "validate-services.js" ]; then
        if node validate-services.js; then
            print_success "Architecture validation passed!"
        else
            print_error "Architecture validation failed!"
            TOTAL_FAILURES=$((TOTAL_FAILURES + 1))
        fi
    else
        print_warning "Architecture validation script not found"
    fi
}

# Function to run linting
run_linting() {
    print_status "Running Code Linting..."
    
    # Backend linting (if ESLint config exists)
    cd "$(dirname "$0")"
    if [ -f ".eslintrc.js" ] || [ -f ".eslintrc.json" ]; then
        if npx eslint backend/ --ext .js; then
            print_success "Backend linting passed!"
        else
            print_warning "Backend linting issues found"
        fi
    fi
    
    # Frontend linting
    cd frontend
    if npm run lint; then
        print_success "Frontend linting passed!"
    else
        print_warning "Frontend linting issues found"
    fi
    
    cd ..
}

# Main execution
main() {
    print_status "Starting comprehensive test suite..."
    
    # Run architecture validation first
    run_architecture_validation
    
    # Run linting
    run_linting
    
    # Run backend tests
    run_backend_tests
    
    # Run frontend tests
    run_frontend_tests
    
    # Generate coverage report
    check_coverage
    
    # Print final results
    echo ""
    echo "🏁 Test Suite Results"
    echo "===================="
    
    if [ $BACKEND_TESTS_PASSED -eq 1 ]; then
        print_success "✅ Backend Tests: PASSED"
    else
        print_error "❌ Backend Tests: FAILED"
    fi
    
    if [ $FRONTEND_TESTS_PASSED -eq 1 ]; then
        print_success "✅ Frontend Tests: PASSED"
    else
        print_error "❌ Frontend Tests: FAILED"
    fi
    
    if [ $TOTAL_FAILURES -eq 0 ]; then
        print_success "🎉 All tests passed! Your application is ready for deployment!"
        exit 0
    else
        print_error "💥 $TOTAL_FAILURES test suite(s) failed. Please fix the issues before deployment."
        exit 1
    fi
}

# Handle script arguments
case "${1:-}" in
    "backend")
        print_status "Running backend tests only..."
        run_backend_tests
        ;;
    "frontend")
        print_status "Running frontend tests only..."
        run_frontend_tests
        ;;
    "coverage")
        print_status "Running tests with coverage..."
        run_backend_tests
        run_frontend_tests
        check_coverage
        ;;
    "lint")
        print_status "Running linting only..."
        run_linting
        ;;
    "validate")
        print_status "Running architecture validation only..."
        run_architecture_validation
        ;;
    "help"|"-h"|"--help")
        echo "Aria AI Test Runner"
        echo ""
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  backend     Run backend tests only"
        echo "  frontend    Run frontend tests only"
        echo "  coverage    Run tests with coverage report"
        echo "  lint        Run linting only"
        echo "  validate    Run architecture validation only"
        echo "  help        Show this help message"
        echo ""
        echo "No command runs the full test suite"
        ;;
    *)
        main
        ;;
esac
