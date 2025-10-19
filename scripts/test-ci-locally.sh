#!/bin/bash

# Test CI Workflow Locally
# This script runs the same checks as the GitHub Actions workflow

set -e

echo "🧪 RedisX CI Local Test"
echo "======================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track overall status
OVERALL_STATUS=0

echo "📦 Step 1: Install dependencies"
echo "--------------------------------"
if npm install; then
  echo -e "${GREEN}✓ Dependencies installed${NC}"
else
  echo -e "${RED}✗ Failed to install dependencies${NC}"
  OVERALL_STATUS=1
fi
echo ""

echo "🔍 Step 2: Type check"
echo "---------------------"
if npm run typecheck; then
  echo -e "${GREEN}✓ Type check passed${NC}"
else
  echo -e "${RED}✗ Type check failed${NC}"
  OVERALL_STATUS=1
fi
echo ""

echo "🧪 Step 3: Run tests with coverage"
echo "-----------------------------------"
if npm run coverage; then
  echo -e "${GREEN}✓ Tests passed${NC}"
  TEST_STATUS="passing"
  TEST_COLOR="brightgreen"
else
  echo -e "${RED}✗ Tests failed${NC}"
  TEST_STATUS="failing"
  TEST_COLOR="red"
  OVERALL_STATUS=1
fi
echo ""

echo "📊 Step 4: Parse coverage"
echo "-------------------------"
if [ -f coverage/coverage-summary.json ]; then
  # Try jq first (used in CI), fallback to node
  if command -v jq &> /dev/null; then
    COVERAGE=$(jq '.total.statements.pct' coverage/coverage-summary.json | awk '{print int($1+0.5)}')
  else
    # Fallback to node for local development
    COVERAGE=$(node -e "const fs=require('fs'); const c=JSON.parse(fs.readFileSync('coverage/coverage-summary.json', 'utf8')); console.log(Math.round(c.total.statements.pct))")
  fi
  echo -e "Coverage: ${YELLOW}${COVERAGE}%${NC}"
  
  # Determine coverage color
  if [ $COVERAGE -ge 90 ]; then
    COVERAGE_COLOR="brightgreen"
  elif [ $COVERAGE -ge 80 ]; then
    COVERAGE_COLOR="green"
  elif [ $COVERAGE -ge 70 ]; then
    COVERAGE_COLOR="yellow"
  elif [ $COVERAGE -ge 60 ]; then
    COVERAGE_COLOR="orange"
  else
    COVERAGE_COLOR="red"
  fi
  
  echo "Coverage color: $COVERAGE_COLOR"
else
  echo -e "${RED}✗ Coverage file not found${NC}"
  COVERAGE=0
  COVERAGE_COLOR="red"
  OVERALL_STATUS=1
fi
echo ""

echo "🔨 Step 5: Build project"
echo "------------------------"
if npm run build; then
  echo -e "${GREEN}✓ Build successful${NC}"
else
  echo -e "${RED}✗ Build failed${NC}"
  OVERALL_STATUS=1
fi
echo ""

echo "📛 Step 6: Badge Preview"
echo "------------------------"
echo "Test Badge:     ![Tests](https://img.shields.io/badge/tests-${TEST_STATUS}-${TEST_COLOR})"
echo "Coverage Badge: ![Coverage](https://img.shields.io/badge/coverage-${COVERAGE}%25-${COVERAGE_COLOR})"
echo ""

echo "======================="
if [ $OVERALL_STATUS -eq 0 ]; then
  echo -e "${GREEN}✓ All checks passed! Ready to push.${NC}"
else
  echo -e "${RED}✗ Some checks failed. Please fix before pushing.${NC}"
  exit 1
fi

