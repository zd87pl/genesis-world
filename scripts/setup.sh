#!/bin/bash
#
# Genesis World - Setup Script Wrapper
#
# This script ensures dependencies are available and runs the
# interactive setup wizard.
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo ""
echo -e "${GREEN}Genesis World Setup${NC}"
echo "===================="
echo ""

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed.${NC}"
    echo "Please install Node.js 20+ from https://nodejs.org"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo -e "${RED}Error: Node.js 20+ is required (found v$NODE_VERSION).${NC}"
    echo "Please upgrade Node.js from https://nodejs.org"
    exit 1
fi

echo -e "${GREEN}✓${NC} Node.js $(node -v) detected"

# Check for pnpm
if ! command -v pnpm &> /dev/null; then
    echo -e "${YELLOW}pnpm not found. Installing...${NC}"
    npm install -g pnpm
fi

echo -e "${GREEN}✓${NC} pnpm $(pnpm -v) detected"

# Check if node_modules exists
if [ ! -d "$PROJECT_DIR/node_modules" ]; then
    echo ""
    echo -e "${YELLOW}Dependencies not installed. Running pnpm install...${NC}"
    cd "$PROJECT_DIR"
    pnpm install
fi

echo ""
echo "Starting setup wizard..."
echo ""

# Run the TypeScript setup script
cd "$PROJECT_DIR"
npx tsx scripts/setup.ts
