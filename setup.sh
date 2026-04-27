#!/bin/bash

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"

echo -e "${BLUE}=== Vote Counting App - Setup ===${NC}"
echo "Project root: $PROJECT_ROOT"
echo ""

# Backend setup
cd "$PROJECT_ROOT/backend" || exit 1
echo -e "${YELLOW}📦 Cài backend dependencies...${NC}"
npm install
npm install sqlite3

echo -e "${GREEN}✅ Backend xong${NC}"
echo ""

# Frontend setup
cd "$PROJECT_ROOT/frontend" || exit 1
echo -e "${YELLOW}📦 Cài frontend dependencies...${NC}"
npm install

echo -e "${GREEN}✅ Frontend xong${NC}"
echo ""

# Python env
cd "$PROJECT_ROOT" || exit 1
echo -e "${YELLOW}🐍 Thiết lập Python env...${NC}"
if [ ! -d "venv" ]; then
  python3 -m venv venv
fi
source venv/bin/activate
pip install --upgrade pip
if [ -f "AI/backend/requirements.txt" ]; then
  pip install -r AI/backend/requirements.txt
elif [ -f "requirements.txt" ]; then
  pip install -r requirements.txt || true
fi

echo -e "${GREEN}✅ Python env xong${NC}"
echo ""

# Seed admin
cd "$PROJECT_ROOT/backend" || exit 1
echo -e "${YELLOW}👤 Seed tài khoản admin mặc định...${NC}"
SEED_ADMIN_EMAIL=admin@vote.local SEED_ADMIN_PASSWORD='Admin@123456' npx ts-node src/scripts/seed.ts || true

echo ""
echo -e "${BLUE}=== Thông tin đăng nhập mặc định ===${NC}"
echo "Admin email: admin@vote.local"
echo "Admin password: Admin@123456"
echo ""
echo -e "${GREEN}✅ Setup hoàn tất. Chạy ./start_all.sh để khởi động toàn bộ hệ thống.${NC}"
