#!/usr/bin/env python3
"""
AI Backend for Vote Counting Application - Using AI/backend processor
"""
import os
import sys
import json
import uuid
from typing import List, Optional
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

# Add AI/backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'AI'))

from backend.ballot_processor import process_ballot

app = FastAPI(title="Vote Counting AI Backend")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
AI_PROCESSOR = os.getenv("AI_PROCESSOR", "mock")  # "mock", "gemini", "openai", etc.
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")

# In-memory storage for batches
batches = {}
batch_results = {}


# ============================================================================
# PROCESSOR WRAPPER - Uses AI/backend/ballot_processor.py
# ============================================================================

def process_ballot_wrapper(file_bytes: bytes, filename: str, ballot_type: str, idx: int) -> dict:
    """
    Wrapper to call AI/backend/ballot_processor with correct signature
    
    Converts file_bytes to temp file and calls the processor
    """
    import tempfile
    
    # Save bytes to temp file (processor expects file path)
    with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
        tmp.write(file_bytes)
        tmp_path = tmp.name
    
    try:
        # Call the real processor from AI/backend
        result = process_ballot(tmp_path, ballot_type, f"batch_{idx}", filename)
        return result
    finally:
        # Cleanup
        try:
            os.unlink(tmp_path)
        except:
            pass


# ============================================================================
# API ENDPOINTS
# ============================================================================

@app.on_event("startup")
def startup():
    """Initialize on startup"""
    print(f"AI Backend started (Processor: {AI_PROCESSOR})")
    if AI_PROCESSOR == "mock":
        print("   ⚠️  Using MOCK processor (test data only)")
    else:
        print(f"   Using {AI_PROCESSOR.upper()} processor (real AI)")


@app.get("/")
async def root():
    """Health check"""
    return {
        "status": "ok",
        "version": "2.0.0",
        "processor": AI_PROCESSOR,
        "is_mock": AI_PROCESSOR == "mock"
    }


@app.post("/api/batches")
async def create_batch(
    ballot_type: str = Form(...),
    model_name: Optional[str] = Form(None),
    prompt_version: int = Form(1),
    files: List[UploadFile] = File(...)
):
    """Create a batch processing job"""
    batch_id = str(uuid.uuid4())
    
    # Create job entries for each file
    jobs = []
    for idx, file in enumerate(files):
        job_id = f"{batch_id}-{idx}"
        
        # Read file content
        content = await file.read()
        filename = file.filename or f"ballot_{idx}"
        
        jobs.append({
            "job_id": job_id,
            "file": filename,
            "status": "processing"
        })
        
        # Process ballot
        try:
            parsed_result = process_ballot_wrapper(content, filename, ballot_type, idx)
            
            batch_results[job_id] = {
                "ok": True,
                "error": None,
                "latency_ms": 1000,
                "parsed": parsed_result
            }
        except Exception as e:
            batch_results[job_id] = {
                "ok": False,
                "error": str(e),
                "latency_ms": 0,
                "parsed": None
            }
    
    batches[batch_id] = {
        "id": batch_id,
        "ballot_type": ballot_type,
        "jobs": jobs,
        "total": len(jobs),
        "completed": 0
    }
    
    return {
        "batch_id": batch_id,
        "total_files": len(files),
        "job_ids": [j["job_id"] for j in jobs],
        "processor": AI_PROCESSOR
    }


@app.post("/api/process")
async def process_single_ballot(
    ballot_type: str = Form(...),
    files: List[UploadFile] = File(...)
):
    """Process a single ballot synchronously"""
    if not files or len(files) == 0:
        return JSONResponse(
            {"error": "No files uploaded"},
            status_code=400
        )
    
    file = files[0]  # Take first file
    content = await file.read()
    filename = file.filename or "ballot"
    
    try:
        parsed_result = process_ballot_wrapper(content, filename, ballot_type, 0)
        
        return {
            "batch_id": "sync",
            "job_id": "sync_0",
            "ballot_type": ballot_type,
            "image_path": filename,
            "ok": True,
            "error": None,
            "latency_ms": 1000,
            "usage": {},
            "parsed": parsed_result,
            "processor": AI_PROCESSOR
        }
    except Exception as e:
        return JSONResponse(
            {
                "batch_id": "sync",
                "job_id": "sync_0",
                "ballot_type": ballot_type,
                "image_path": filename,
                "ok": False,
                "error": str(e),
                "latency_ms": 0,
                "usage": {},
                "parsed": None,
                "processor": AI_PROCESSOR
            },
            status_code=500
        )


@app.get("/api/batches/{batch_id}")
async def get_batch_status(batch_id: str):
    """Get batch status"""
    if batch_id not in batches:
        return JSONResponse(
            {"error": "Batch not found"},
            status_code=404
        )
    
    batch = batches[batch_id]
    
    # Mark all as done
    completed = len(batch["jobs"])
    batch["completed"] = completed
    
    for job in batch["jobs"]:
        job["status"] = "done"
    
    return {
        "batch_id": batch_id,
        "done": completed,
        "total": batch["total"]
    }


@app.get("/api/batches/{batch_id}/results")
async def get_batch_results(batch_id: str):
    """Get batch results - returns list of filenames"""
    if batch_id not in batches:
        return JSONResponse(
            {"error": "Batch not found"},
            status_code=404
        )
    
    batch = batches[batch_id]
    results = []
    
    for job in batch["jobs"]:
        job_id = job["job_id"]
        if job_id in batch_results:
            results.append(f"{job_id}.json")
    
    return {
        "batch_id": batch_id,
        "files": results
    }


@app.get("/api/batches/{batch_id}/results/{filename}")
async def get_job_result(batch_id: str, filename: str):
    """Get single job result by filename"""
    if batch_id not in batches:
        return JSONResponse(
            {"error": "Batch not found"},
            status_code=404
        )
    
    job_id = filename.replace(".json", "")
    
    if job_id not in batch_results:
        return JSONResponse(
            {"error": "Result not found"},
            status_code=404
        )
    
    result = batch_results[job_id]
    return {
        "batch_id": batch_id,
        "job_id": job_id,
        "ballot_type": batches[batch_id]["ballot_type"],
        "image_path": "",
        "ok": result.get("ok", True),
        "error": result.get("error"),
        "latency_ms": result.get("latency_ms", 0),
        "usage": {},
        "parsed": result.get("parsed", {}),
        "processor": AI_PROCESSOR
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "ok",
        "service": "AI Backend",
        "processor": AI_PROCESSOR,
        "is_mock": AI_PROCESSOR == "mock"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
