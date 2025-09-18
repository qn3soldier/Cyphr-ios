#!/bin/bash

# =================================================================
# AWS PREREQUISITES CHECK
# =================================================================
# This script checks all prerequisites before AWS migration
# =================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}==================================================================${NC}"
echo -e "${BLUE}   CHECKING AWS MIGRATION PREREQUISITES${NC}"
echo -e "${BLUE}==================================================================${NC}"
echo ""

READY=true

# Check AWS CLI
echo -e "${YELLOW}1. Checking AWS CLI...${NC}"
if command -v aws &> /dev/null; then
    AWS_VERSION=$(aws --version 2>&1 | cut -d' ' -f1 | cut -d'/' -f2)
    echo -e "${GREEN}   ✓ AWS CLI installed (version: ${AWS_VERSION})${NC}"
else
    echo -e "${RED}   ✗ AWS CLI not installed${NC}"
    echo -e "   Install with: brew install awscli"
    READY=false
fi

# Check AWS Credentials
echo -e "${YELLOW}2. Checking AWS Credentials...${NC}"
if aws sts get-caller-identity &> /dev/null; then
    ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    echo -e "${GREEN}   ✓ AWS credentials configured (Account: ${ACCOUNT_ID})${NC}"
else
    echo -e "${RED}   ✗ AWS credentials not configured or invalid${NC}"
    echo -e "   Run: aws configure"
    READY=false
fi

# Check Node.js
echo -e "${YELLOW}3. Checking Node.js...${NC}"
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}   ✓ Node.js installed (${NODE_VERSION})${NC}"
else
    echo -e "${RED}   ✗ Node.js not installed${NC}"
    echo -e "   Install from: https://nodejs.org/"
    READY=false
fi

# Check npm
echo -e "${YELLOW}4. Checking npm...${NC}"
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo -e "${GREEN}   ✓ npm installed (${NPM_VERSION})${NC}"
else
    echo -e "${RED}   ✗ npm not installed${NC}"
    READY=false
fi

# Check for production environment file
echo -e "${YELLOW}5. Checking environment configuration...${NC}"
if [ -f ".env.production" ]; then
    echo -e "${GREEN}   ✓ .env.production found${NC}"
else
    echo -e "${YELLOW}   ⚠ .env.production not found${NC}"
    echo -e "   Copy .env.production.example and fill in your values"
    if [ -f ".env.production.example" ]; then
        echo -e "   Run: cp .env.production.example .env.production"
    fi
fi

# Check project directories
echo -e "${YELLOW}6. Checking project directories...${NC}"
if [ -d "/Users/daniilbogdanov/cyphrmessenger" ]; then
    echo -e "${GREEN}   ✓ Cyphr app directory found${NC}"
else
    echo -e "${RED}   ✗ Cyphr app directory not found${NC}"
    READY=false
fi

if [ -d "/Users/daniilbogdanov/cyphrwebsite" ]; then
    echo -e "${GREEN}   ✓ Landing page directory found${NC}"
else
    echo -e "${RED}   ✗ Landing page directory not found${NC}"
    READY=false
fi

# Check for required files in project 2
echo -e "${YELLOW}7. Checking for complete application...${NC}"
if [ -d "project 2" ]; then
    if [ -f "project 2/server.ts" ] && [ -f "project 2/package.json" ]; then
        echo -e "${GREEN}   ✓ Complete application found in 'project 2'${NC}"
    else
        echo -e "${YELLOW}   ⚠ Application files may be incomplete${NC}"
    fi
else
    echo -e "${YELLOW}   ⚠ 'project 2' directory not found, will use main directory${NC}"
fi

# Check SSH directory
echo -e "${YELLOW}8. Checking SSH configuration...${NC}"
if [ -d "$HOME/.ssh" ]; then
    echo -e "${GREEN}   ✓ SSH directory exists${NC}"
else
    echo -e "${YELLOW}   ⚠ Creating SSH directory${NC}"
    mkdir -p $HOME/.ssh
    chmod 700 $HOME/.ssh
fi

# Check available disk space
echo -e "${YELLOW}9. Checking disk space...${NC}"
AVAILABLE_SPACE=$(df -h . | awk 'NR==2 {print $4}')
echo -e "${GREEN}   ✓ Available disk space: ${AVAILABLE_SPACE}${NC}"

# Summary
echo ""
echo -e "${BLUE}==================================================================${NC}"
if [ "$READY" = true ]; then
    echo -e "${GREEN}   ✅ ALL PREREQUISITES MET - READY FOR MIGRATION!${NC}"
    echo -e "${BLUE}==================================================================${NC}"
    echo ""
    echo -e "${YELLOW}Next steps:${NC}"
    echo -e "1. Ensure .env.production is configured with your values"
    echo -e "2. Run: ./aws-full-migration.sh"
    echo -e "3. After infrastructure is created, run: ./deploy-to-aws.sh"
else
    echo -e "${RED}   ❌ PREREQUISITES NOT MET - FIX ISSUES ABOVE${NC}"
    echo -e "${BLUE}==================================================================${NC}"
    exit 1
fi