#!/usr/bin/env python
"""
Simple wrapper to run the FastAPI app with proper Python path setup
"""
import sys
import os

# Add both AI root and backend directories to Python path
ai_root = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ai_root)
sys.path.insert(0, os.path.join(ai_root, 'backend'))

# Import and run the app
from backend.app import app

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=False)
