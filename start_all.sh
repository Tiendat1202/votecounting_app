#!/bin/bash

# Start all services for Vote Counting App

echo "🚀 Starting Vote Counting Application..."
echo ""

# Kill existing processes on ports
echo "🧹 Cleaning up existing processes..."
lsof -ti:8000 | xargs kill -9 2>/dev/null || true
lsof -ti:5050 | xargs kill -9 2>/dev/null || true
lsof -ti:5173 | xargs kill -9 2>/dev/null || true
sleep 2

# Start AI Backend (Mock)
echo "1️⃣ Starting AI Backend (Mock) on port 8000..."
cd /Users/lthyor3/4/votecounting_app
source venv/bin/activate
nohup python3 ai_backend.py > logs/ai_backend.log 2>&1 &
AI_PID=$!
echo "   AI Backend PID: $AI_PID"
sleep 3

# Start Node.js Backend
echo "2️⃣ Starting Node.js Backend on port 5050..."
cd /Users/lthyor3/4/votecounting_app/backend
nohup npm run dev > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
echo "   Backend PID: $BACKEND_PID"
sleep 3

# Start React Frontend
echo "3️⃣ Starting React Frontend on port 5173..."
cd /Users/lthyor3/4/votecounting_app/frontend
nohup npm run dev > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
echo "   Frontend PID: $FRONTEND_PID"
sleep 3

# Check status
echo ""
echo "✅ All services started!"
echo ""
echo "=== Service Status ==="
if lsof -ti:8000 > /dev/null 2>&1; then
    echo "✅ AI Backend:     http://localhost:8000"
else
    echo "❌ AI Backend:     Failed to start"
fi

if lsof -ti:5050 > /dev/null 2>&1; then
    echo "✅ Node Backend:   http://localhost:5050"
else
    echo "❌ Node Backend:   Failed to start"
fi

if lsof -ti:5173 > /dev/null 2>&1; then
    echo "✅ Frontend:       http://localhost:5173"
else
    echo "❌ Frontend:       Failed to start"
fi

echo ""
echo "📋 Logs are saved in logs/ directory"
echo "   - logs/ai_backend.log"
echo "   - logs/backend.log"
echo "   - logs/frontend.log"
echo ""
echo "🌐 Open your browser to: http://localhost:5173"
echo ""
echo "To stop all services, run: ./stop_all.sh"
