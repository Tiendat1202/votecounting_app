import os
from dotenv import load_dotenv

load_dotenv()

# Redis configuration
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# Directory configuration
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")
RESULT_DIR = os.getenv("RESULT_DIR", "results")

# AI Processor configuration
# Options: "mock", "openai", "google", "tesseract", "custom"
AI_PROCESSOR = os.getenv("AI_PROCESSOR", "mock")

# OpenAI Configuration
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

# Google Cloud Vision Configuration
# Set GOOGLE_APPLICATION_CREDENTIALS environment variable to path of credentials.json
GOOGLE_APPLICATION_CREDENTIALS = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "")

# Custom Model Configuration
CUSTOM_MODEL_PATH = os.getenv("CUSTOM_MODEL_PATH", "models/ballot_detector.pt")

# Processor selection info
PROCESSORS = {
    "mock": {
        "name": "Mock Processor",
        "description": "Returns test data for development",
        "requires": [],
        "cost": "Free",
        "accuracy": "0% (test only)"
    },
    "openai": {
        "name": "OpenAI Vision API",
        "description": "Uses GPT-4 Vision to analyze ballots",
        "requires": ["pip install openai", "OPENAI_API_KEY env var"],
        "cost": "~$0.01 per image",
        "accuracy": "95%+"
    },
    "google": {
        "name": "Google Cloud Vision API",
        "description": "Uses Google Cloud Vision with text detection",
        "requires": ["pip install google-cloud-vision", "GOOGLE_APPLICATION_CREDENTIALS file"],
        "cost": "~$1.5 per 1000 requests",
        "accuracy": "90%+"
    },
    "tesseract": {
        "name": "Tesseract OCR (Local)",
        "description": "Open-source OCR running locally",
        "requires": ["pip install pytesseract pillow", "brew install tesseract (macOS)"],
        "cost": "Free",
        "accuracy": "60-80%"
    },
    "custom": {
        "name": "Custom ML Model",
        "description": "Custom trained PyTorch/TensorFlow model",
        "requires": ["pip install torch torchvision", "Trained model file"],
        "cost": "Free (local)",
        "accuracy": "Depends on training"
    }
}