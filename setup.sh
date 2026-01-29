#!/bin/bash

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PROJECT_ROOT="/Users/lthyor3/4/votecounting_app"

echo -e "${BLUE}=== Vote Counting App - Complete Setup Guide ===${NC}"
echo ""

# Check if project exists
if [ ! -d "$PROJECT_ROOT" ]; then
    echo -e "${RED}❌ Project folder not found at $PROJECT_ROOT${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Project folder found${NC}"
echo ""

# Backend setup
echo -e "${YELLOW}📦 Setting up Backend (Node.js)...${NC}"
cd "$PROJECT_ROOT/backend"

if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
else
    echo -e "${GREEN}✅ Dependencies already installed${NC}"
fi

echo ""
echo -e "${GREEN}✅ Backend setup complete${NC}"
echo ""

# Frontend setup
echo -e "${YELLOW}📦 Setting up Frontend (React)...${NC}"
cd "$PROJECT_ROOT/frontend"

if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
else
    echo -e "${GREEN}✅ Dependencies already installed${NC}"
fi

echo ""
echo -e "${GREEN}✅ Frontend setup complete${NC}"
echo ""

# AI Backend check
echo -e "${YELLOW}📦 Checking AI Backend...${NC}"
cd "$PROJECT_ROOT/AI"

if [ -f "requirements.txt" ]; then
    echo -e "${GREEN}✅ AI Backend folder exists${NC}"
    echo "To set up AI Backend Python environment, run:"
    echo "  cd $PROJECT_ROOT/AI"
    echo "  pip install -r requirements.txt"
else
    echo -e "${RED}❌ AI Backend requirements.txt not found${NC}"
fi

echo ""
echo ""
echo -e "${BLUE}=== STARTUP INSTRUCTIONS ===${NC}"
echo ""
echo "Open 3 separate terminal windows and run:"
echo ""
echo -e "${YELLOW}Terminal 1 - AI Backend (FastAPI):${NC}"
echo "  cd $PROJECT_ROOT/AI"
echo "  python -m uvicorn backend.app:app --port 8000 --reload"
echo ""
echo -e "${YELLOW}Terminal 2 - Node Backend (Express):${NC}"
echo "  cd $PROJECT_ROOT/backend"
echo "  npm run dev"
echo ""
echo -e "${YELLOW}Terminal 3 - Frontend (React/Vite):${NC}"
echo "  cd $PROJECT_ROOT/frontend"
echo "  npm run dev"
echo ""
echo ""
echo -e "${BLUE}=== ACCESS POINTS ===${NC}"
echo "Frontend: http://localhost:5173"
echo "Backend API: http://localhost:5050"
echo "AI Backend: http://localhost:8000"
echo ""
echo -e "${GREEN}✅ All setup complete!${NC}"
