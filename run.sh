#!/bin/bash

# Aria AI Application Launcher
# 
# CLEAN ARCHITECTURE DESIGN:
# - Simple launcher script with multiple startup options
# - Environment validation and dependency checks
# - Database initialization automation
# - User-friendly interface

set -e  # Exit on any error

# Colors for better UX
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Display banner
echo -e "${CYAN}"
echo "🤖 Aria AI Chat Application Launcher"
echo "=====================================🤖"
echo -e "${NC}"

# Function to display help
show_help() {
    echo -e "${BLUE}USAGE:${NC}"
    echo "  ./run.sh [option]"
    echo ""
    echo -e "${BLUE}OPTIONS:${NC}"
    echo "  dev, d          🔧 Start in development mode"
    echo "  prod, p         🚀 Start in production mode"
    echo "  init, i         🗄️  Initialize database only"
    echo "  setup, s        ⚙️  Setup and validate services"
    echo "  test, t         🧪 Run tests"
    echo "  health, h       🏥 Check service health"
    echo "  help            ❓ Show this help"
    echo ""
    echo -e "${BLUE}EXAMPLES:${NC}"
    echo "  ./run.sh dev           # Quick development start"
    echo "  ./run.sh init          # Initialize database first"
    echo "  ./run.sh setup         # Validate service architecture"
    echo ""
}

# Function to check prerequisites
check_prerequisites() {
    echo -e "${YELLOW}🔍 Checking prerequisites...${NC}"
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        echo -e "${RED}❌ Node.js not found. Please install Node.js 14+${NC}"
        exit 1
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        echo -e "${RED}❌ npm not found. Please install npm${NC}"
        exit 1
    fi
    
    # Check package.json
    if [[ ! -f "package.json" ]]; then
        echo -e "${RED}❌ package.json not found. Are you in the correct directory?${NC}"
        exit 1
    fi
    
    # Check node_modules
    if [[ ! -d "node_modules" ]]; then
        echo -e "${YELLOW}📦 Installing dependencies...${NC}"
        npm install
    fi
    
    echo -e "${GREEN}✅ Prerequisites check passed${NC}"
}

# Function to initialize database
init_database() {
    echo -e "${CYAN}🗄️  Initializing database...${NC}"
    
    if [[ ! -f "database/schema.sql" ]]; then
        echo -e "${RED}❌ Database schema not found. Please ensure database/schema.sql exists.${NC}"
        exit 1
    fi
    
    node init-db.js
    echo -e "${GREEN}✅ Database initialization completed${NC}"
}

# Function to run in development mode
run_dev() {
    echo -e "${YELLOW}🔧 Starting Aria AI in Development Mode...${NC}"
    check_prerequisites
    init_database
    echo -e "${GREEN}🚀 Launching development server...${NC}"
    npm run dev
}

# Function to run in production mode
run_prod() {
    echo -e "${PURPLE}🚀 Starting Aria AI in Production Mode...${NC}"
    check_prerequisites
    init_database
    echo -e "${GREEN}🏭 Launching production server...${NC}"
    npm start
}

# Function to setup and validate
run_setup() {
    echo -e "${CYAN}⚙️  Setting up and validating Aria AI...${NC}"
    check_prerequisites
    init_database
    npm run setup
    
    if [[ -f "validate-services.js" ]]; then
        echo -e "${YELLOW}🔍 Validating service architecture...${NC}"
        npm run validate
    fi
    
    echo -e "${GREEN}✅ Setup and validation completed${NC}"
}

# Function to run tests
run_tests() {
    echo -e "${CYAN}🧪 Running Aria AI tests...${NC}"
    check_prerequisites
    npm run test
}

# Function to check health
check_health() {
    echo -e "${CYAN}🏥 Checking Aria AI service health...${NC}"
    check_prerequisites
    npm run health
}

# Main script logic
case "${1:-help}" in
    "dev"|"d")
        run_dev
        ;;
    "prod"|"p")
        run_prod
        ;;
    "init"|"i")
        check_prerequisites
        init_database
        ;;
    "setup"|"s")
        run_setup
        ;;
    "test"|"t")
        run_tests
        ;;
    "health"|"h")
        check_health
        ;;
    "help"|"--help"|"-h"|*)
        show_help
        ;;
esac
