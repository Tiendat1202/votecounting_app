#!/bin/bash

# Stop all services for Vote Counting App

echo "🛑 Stopping Vote Counting Application..."
echo ""

# Kill processes on ports
echo "Stopping AI Backend (port 8000)..."
lsof -ti:8000 | xargs kill -9 2>/dev/null || echo "   AI Backend not running"

echo "Stopping Node Backend (port 5050)..."
lsof -ti:5050 | xargs kill -9 2>/dev/null || echo "   Node Backend not running"

echo "Stopping Frontend (port 5173)..."
lsof -ti:5173 | xargs kill -9 2>/dev/null || echo "   Frontend not running"

echo ""
echo "✅ All services stopped!"
