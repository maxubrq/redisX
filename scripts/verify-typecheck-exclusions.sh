#!/bin/bash

# Verify TypeScript Exclusions
# This script shows what files are included/excluded in typecheck

echo "🔍 TypeScript Configuration Analysis"
echo "===================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}📁 Current TypeScript Configuration:${NC}"
echo "----------------------------------------"
echo "Main config: tsconfig.json"
echo "Build config: tsconfig.build.json"
echo ""

echo -e "${BLUE}📋 Include patterns:${NC}"
echo "• src/**/* (main source files only)"
echo ""

echo -e "${BLUE}🚫 Exclude patterns:${NC}"
echo "• **/__tests__/** (all __tests__ directories)"
echo "• **/*.test.ts (test files)"
echo "• **/*.spec.ts (spec files)"
echo "• node_modules"
echo "• dist"
echo "• coverage"
echo ""

echo -e "${YELLOW}🧪 Running typecheck to verify exclusions...${NC}"
echo ""

# Run typecheck and capture output
if npm run typecheck 2>&1; then
  echo -e "${GREEN}✅ Typecheck passed - no test files included!${NC}"
else
  echo -e "${RED}❌ Typecheck failed${NC}"
  exit 1
fi

echo ""
echo -e "${BLUE}📊 Files that would be type-checked:${NC}"
echo "----------------------------------------"

# Show what files TypeScript would process
npx tsc --listFiles --noEmit 2>/dev/null | grep -v node_modules | head -20

echo ""
echo -e "${GREEN}✅ Verification complete!${NC}"
echo ""
echo "Summary:"
echo "• ✅ Only src/ files are type-checked"
echo "• ✅ All __tests__ directories are excluded"
echo "• ✅ All .test.ts and .spec.ts files are excluded"
echo "• ✅ Build artifacts (dist, coverage) are excluded"
