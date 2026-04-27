#!/usr/bin/env python3
"""
AI Backend for Vote Counting Application - Using AI/backend processor
"""
from pathlib import Path
from dotenv import load_dotenv
import os
import sys
import json
import uuid
import traceback
from typing import List, Optional
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env", override=True)

# Make AI/backend importable regardless of working directory
AI_DIR = os.path.join(str(BASE_DIR), 'AI')
# Runtime source of truth: router processor
AI_BACKEND_PY = os.path.join(AI_DIR, 'backend', 'ballot_processor.py')

# Insert likely paths at front
for p in (AI_DIR, str(BASE_DIR)):
    if p not in sys.path:
        sys.path.insert(0, p)

process_ballot = None
PROCESSOR_SOURCE = None
import traceback as _tb
import importlib.util

# Preferred import order: 1) explicit router file path,
# 2) package module fallback.
try:
    spec = importlib.util.spec_from_file_location('ai_ballot_processor', AI_BACKEND_PY)
    if spec and spec.loader:
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        process_ballot = getattr(module, 'process_ballot', None)
        PROCESSOR_SOURCE = f'file:{AI_BACKEND_PY}'
        if process_ballot is None:
            print(f"Loaded module from {AI_BACKEND_PY} but no 'process_ballot' symbol found")
except Exception:
    print("Warning: file import of router processor failed; falling back to package import")
    _tb.print_exc()
    try:
        pkg_mod = __import__('importlib').import_module('backend.ballot_processor')
        process_ballot = getattr(pkg_mod, 'process_ballot', None)
        PROCESSOR_SOURCE = 'package:backend.ballot_processor'
    except Exception:
        print("Warning: package import of backend.ballot_processor also failed:")
        _tb.print_exc()
        try:
            # last-ditch compatibility wrapper by explicit file import
            clean_file = os.path.join(AI_DIR, 'backend', 'ballot_processor_clean.py')
            spec2 = importlib.util.spec_from_file_location('ai_ballot_processor_clean', clean_file)
            if spec2 and spec2.loader:
                module2 = importlib.util.module_from_spec(spec2)
                spec2.loader.exec_module(module2)
                process_ballot = getattr(module2, 'process_ballot', None)
                PROCESSOR_SOURCE = f'file:{clean_file}(compat)'
        except Exception:
            print("Warning: file import of ballot_processor_clean compatibility wrapper also failed:")
            _tb.print_exc()

if process_ballot is None:
    print("ballot_processor not available after attempts; AI processing will error until fixed")
else:
    print(f"Loaded ballot processor from: {PROCESSOR_SOURCE}")

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
# Prefer explicit AI_PROCESSOR env. If not set and TOGETHER_API_KEY is present, default to 'qwen'
env_ai_proc = os.getenv("AI_PROCESSOR")
if env_ai_proc and env_ai_proc.strip():
    AI_PROCESSOR = env_ai_proc.strip()
else:
    AI_PROCESSOR = "qwen" if os.getenv("TOGETHER_API_KEY") else "mock"

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")
AI_PORT = int(os.getenv("AI_PORT", os.getenv("PORT", "8000")))

# In-memory storage for batches
batches = {}
batch_results = {}


# ============================================================================
# PROCESSOR WRAPPER - Uses AI/backend/ballot_processor.py
# ============================================================================

def process_ballot_wrapper(file_bytes: bytes, filename: str, ballot_type: str, idx: int, official_candidates: list = None) -> dict:
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
        if process_ballot is None:
            raise RuntimeError("ballot processor not available (import failed)")
        result = process_ballot(tmp_path, ballot_type, f"batch_{idx}", filename, official_candidates)
        return result
    finally:
        # Cleanup
        try:
            os.unlink(tmp_path)
        except:
            pass


def _strip_fences(s: str) -> str:
    import re
    if not s or not isinstance(s, str):
        return s
    # Remove triple backticks and surrounding fences
    s = re.sub(r"^```[a-zA-Z]*\n", "", s)
    s = re.sub(r"```$", "", s)
    return s.strip()


def _extract_first_json(s: str):
    import json
    if not s or not isinstance(s, str):
        return None
    s = s.strip()
    # Try direct parse
    try:
        return json.loads(s)
    except Exception:
        pass

    # strip fences then look for first balanced object
    s2 = _strip_fences(s)
    start = s2.find('{')
    if start == -1:
        return None
    depth = 0
    for i in range(start, len(s2)):
        if s2[i] == '{':
            depth += 1
        elif s2[i] == '}':
            depth -= 1
            if depth == 0:
                candidate = s2[start:i+1]
                try:
                    return json.loads(candidate)
                except Exception:
                    # try unescaping quoted JSON
                    try:
                        unq = candidate.encode('utf-8').decode('unicode_escape')
                        return json.loads(unq)
                    except Exception:
                        return None
    return None


def normalize_ai_result(raw_result: dict) -> dict:
    """Return a normalized parsed object with stable schema for downstream code.

    Target schema:
    {
      "candidate_name": "...",
      "candidates": [ {name, agree?, disagree?, selected?, row_status?} ],
      "validity": "VALID" | "INVALID",
      "reason": "...",
      "confidence": 0.95,
      "raw_model_output": "...",
      "full_analysis": {...}
    }
    """
    import json

    parsed = {}
    # raw_result may already contain 'full_analysis' or 'parsed'
    full = None
    if isinstance(raw_result, dict):
        full = raw_result.get('full_analysis') or raw_result.get('parsed') or raw_result
    else:
        full = raw_result

    # Fast-path: router processor output shape (from AI/backend/ballot_processor.py)
    if isinstance(raw_result, dict) and raw_result.get('processor') == 'router':
        router_status = raw_result.get('status')
        router_error = raw_result.get('error_message')

        model_json = raw_result.get('full_analysis') if isinstance(raw_result.get('full_analysis'), dict) else {}

        # If router couldn't parse JSON, try a second-pass extraction from raw_text.
        if isinstance(model_json, dict) and isinstance(model_json.get('raw_text'), str):
            recovered = _extract_first_json(model_json.get('raw_text'))
            if isinstance(recovered, dict):
                model_json = recovered
                router_status = 'ok' if isinstance(model_json.get('ballot_details'), list) else router_status
                if router_status == 'ok':
                    router_error = None

        # Build candidates from ballot_details/candidates
        rows_src = None
        if isinstance(model_json.get('ballot_details'), list):
            rows_src = model_json.get('ballot_details')
        elif isinstance(model_json.get('candidates'), list):
            rows_src = model_json.get('candidates')
        else:
            rows_src = []

        candidates = []
        for r in rows_src:
            if isinstance(r, dict):
                candidates.append({
                    'stt': r.get('stt'),
                    'name': r.get('name') or r.get('label') or None,
                    'agree': r.get('agree'),
                    'disagree': r.get('disagree'),
                    'selected': r.get('selected'),
                    'row_status': r.get('row_status')
                })

        # Optional human-friendly summary (Node backend remains source of truth)
        candidate_name = None
        try:
            picked = [
                c.get('name')
                for c in candidates
                if (c.get('agree') is True or c.get('selected') is True) and (c.get('disagree') is not True)
            ]
            picked = [p for p in picked if isinstance(p, str) and p.strip()]
            if picked:
                candidate_name = ', '.join(picked)
        except Exception:
            candidate_name = None

        raw_text = raw_result.get('message_content') or raw_result.get('message_reasoning')
        cleaned = _strip_fences(raw_text) if isinstance(raw_text, str) else None

        try:
            confidence = float(raw_result.get('confidence') or model_json.get('confidence') or 0.0)
        except Exception:
            confidence = 0.0

        # votes_extracted: rows that contain an explicit mark
        try:
            votes_extracted = sum(
                1 for c in candidates
                if (c.get('agree') is True or c.get('disagree') is True or c.get('selected') is True)
            )
        except Exception:
            votes_extracted = 0
        print(f"[normalize] router_status={router_status} votes_extracted={votes_extracted}")

        return {
            'candidate_name': candidate_name,
            'candidates': candidates,
            'validity': None,
            'reason': router_error,
            'confidence': confidence,
            'raw_model_output': raw_text,
            'cleaned_model_output': cleaned,
            'parsed_full': model_json,
            'full_analysis': model_json,
            'content_text': raw_result.get('message_content'),
            'reasoning_text': raw_result.get('message_reasoning'),
            'processor': raw_result.get('processor'),
            'model': raw_result.get('model'),
            'ballot_type': raw_result.get('ballot_type'),
            'router_status': router_status,
        }

    # If the router explicitly reported an error, do not attempt to "recover" rows from prose.
    # Those error strings (tracebacks / HTTP errors) often contain numbered lines that look like rows.
    try:
        router_status = raw_result.get('status') if isinstance(raw_result, dict) else None
        router_error = raw_result.get('error_message') if isinstance(raw_result, dict) else None
        full_has_traceback = isinstance(full, dict) and bool(full.get('traceback'))
        if router_status == 'error' or router_error or full_has_traceback:
            return {
                'candidate_name': None,
                'candidates': [],
                'validity': None,
                'reason': router_error or (full.get('exception') if isinstance(full, dict) else None) or 'processor_error',
                'confidence': float(raw_result.get('confidence') or 0.0) if isinstance(raw_result, dict) else 0.0,
                'raw_model_output': None,
                'cleaned_model_output': None,
                'parsed_full': full if isinstance(full, dict) else {'raw': str(full)},
                'content_text': raw_result.get('message_content') if isinstance(raw_result, dict) else None,
                'reasoning_text': raw_result.get('message_reasoning') if isinstance(raw_result, dict) else None,
            }
    except Exception:
        pass

    # If full contains a 'raw' string, try to extract JSON from it
    raw_model_text = None
    if isinstance(full, dict) and full.get('raw') and isinstance(full.get('raw'), str):
        raw_model_text = full.get('raw')
    elif isinstance(raw_result, dict) and raw_result.get('raw') and isinstance(raw_result.get('raw'), str):
        raw_model_text = raw_result.get('raw')
    else:
        # fallback: try to stringify the raw_result provided by processor
        try:
            raw_model_text = json.dumps(raw_result, ensure_ascii=False)
        except Exception:
            raw_model_text = str(raw_result)

    # Keep original raw text for logs
    cleaned = None
    parsed_json = None
    content_text = None
    reasoning_text = None

    # Debug logging: inspect raw model payload before any JSON parsing
    debug_content = None
    debug_reasoning = None
    try:
        if isinstance(raw_result, dict):
            # explicit normalized fields if present
            debug_content = raw_result.get('message_content') or raw_result.get('content_text')
            debug_reasoning = raw_result.get('message_reasoning') or raw_result.get('reasoning_text')

            # raw OpenAI/Together-like dict shape
            choices = raw_result.get('choices')
            if isinstance(choices, list) and choices:
                msg = choices[0].get('message', {}) if isinstance(choices[0], dict) else {}
                if isinstance(msg, dict):
                    debug_content = debug_content or msg.get('content')
                    debug_reasoning = debug_reasoning or msg.get('reasoning')
        else:
            # object shape from SDK
            choices = getattr(raw_result, 'choices', None)
            if choices and len(choices) > 0:
                msg = getattr(choices[0], 'message', None)
                if msg is not None:
                    debug_content = debug_content or getattr(msg, 'content', None)
                    debug_reasoning = debug_reasoning or getattr(msg, 'reasoning', None)
    except Exception:
        pass

    final_text_used = debug_content or debug_reasoning or raw_model_text
    print("===== RAW MODEL RESPONSE =====")
    print(raw_result)
    print("===== MESSAGE CONTENT =====")
    print(debug_content)
    print("===== MESSAGE REASONING =====")
    print(debug_reasoning)
    print("===== FINAL TEXT USED =====")
    print(final_text_used)

    if raw_model_text:
        cleaned = _strip_fences(raw_model_text)
        parsed_json = _extract_first_json(cleaned) or _extract_first_json(raw_model_text)

    # If parsed_json still None, maybe full is dict already
    if parsed_json is None and isinstance(full, dict):
        parsed_json = full

    # If the parsed JSON contains explicit message fields, capture them
    try:
        if isinstance(parsed_json, dict):
            content_text = parsed_json.get('message_content') or parsed_json.get('content_text') or parsed_json.get('content') or None
            reasoning_text = parsed_json.get('message_reasoning') or parsed_json.get('reasoning_text') or parsed_json.get('reasoning') or None
    except Exception:
        pass

    if not isinstance(parsed_json, dict):
        parsed_json = {"raw": raw_model_text}

    # If prose reasoning is present and we couldn't parse JSON, try to extract ballot_details from prose
    def _parse_prose_to_structured(s: str):
        import re
        lines = [l.strip() for l in s.splitlines() if l.strip()]
        details = []
        validity = None
        double_mark = False
        for ln in lines:
            low = ln.lower()
            if 'valid' in low or 'hợp lệ' in low:
                validity = 'VALID'
            if 'invalid' in low or 'không hợp lệ' in low or 'không hợp' in low:
                validity = 'INVALID'
            if 'double' in low or 'double mark' in low or 'đánh x vào cả hai' in low:
                double_mark = True
            m = re.search(r"(?:stt\s*)?(\d{1,3})[).:\s-]+(.+)", ln, re.IGNORECASE)
            if m:
                stt = int(m.group(1))
                rest = m.group(2).strip()
                agree = False
                disagree = False
                selected = False
                row_status = 'OK'
                rlow = rest.lower()
                # detect negation first ('không đồng ý') to avoid matching 'đồng ý' inside it
                if 'không đồng ý' in rlow or 'khong dong y' in rlow or 'không' in rlow or 'khong' in rlow:
                    disagree = True
                elif 'đồng ý' in rlow or 'dong y' in rlow or 'agree' in rlow:
                    agree = True
                if 'x' in rest and ('đồng ý' in rlow or 'agree' in rlow):
                    selected = True
                name = re.sub(r"(đồng ý|không đồng ý|không|agree|disagree|x)$", '', rest, flags=re.IGNORECASE).strip(' -:,.')
                details.append({'stt': stt, 'name': name or None, 'agree': agree, 'disagree': disagree, 'selected': selected, 'row_status': row_status})
        out = {}
        if details:
            out['ballot_details'] = details
        # NOTE: do NOT set 'validity' or 'invalid_reasons' here.
        # The model is only responsible for reading rows from the image.
        # Final VALID / INVALID / FAILED decision is made exclusively by
        # voteService.ts -> evaluateBallot().
        return out if out else None

    try:
        if isinstance(parsed_json, dict) and not parsed_json.get('ballot_details'):
            # prefer explicit message content if non-empty, otherwise reasoning, then raw
            prose = None
            if content_text and isinstance(content_text, str) and content_text.strip():
                prose = content_text
            elif reasoning_text and isinstance(reasoning_text, str) and reasoning_text.strip():
                prose = reasoning_text
            else:
                prose = parsed_json.get('raw') or cleaned or raw_model_text

            if isinstance(prose, str) and prose.strip():
                structured = _parse_prose_to_structured(prose)
                if structured:
                    # merge structured result into parsed_json
                    parsed_json = dict(parsed_json)
                    parsed_json.update(structured)
    except Exception:
        pass

    # Build candidates list
    candidates = []
    if isinstance(parsed_json.get('ballot_details'), list):
        for d in parsed_json.get('ballot_details'):
            if isinstance(d, dict):
                candidates.append({
                    'name': d.get('name') or d.get('label') or None,
                    'agree': d.get('agree'),
                    'disagree': d.get('disagree'),
                    'selected': d.get('selected'),
                    'row_status': d.get('row_status')
                })
    elif isinstance(parsed_json.get('candidates'), list):
        for d in parsed_json.get('candidates'):
            if isinstance(d, dict):
                candidates.append({
                    'name': d.get('name') or d.get('label') or None,
                    'agree': d.get('agree'),
                    'disagree': d.get('disagree'),
                    'selected': d.get('selected'),
                    'row_status': d.get('row_status')
                })

    # candidate_name fallback
    candidate_name = parsed_json.get('candidate_name') or parsed_json.get('selected_candidate') or None
    if not candidate_name and candidates:
        # prefer ones with agree/selected true
        picked = [c.get('name') for c in candidates if (c.get('agree') is True or c.get('selected') is True) and (not c.get('disagree'))]
        picked = [p for p in picked if p]
        if picked:
            candidate_name = ', '.join(picked)

    # validity and reason are intentionally NOT taken from model output.
    # The model only reads rows; voteService.ts -> evaluateBallot() decides VALID/INVALID/FAILED.
    confidence = parsed_json.get('confidence') or raw_result.get('confidence') or 0.0

    normalized = {
        'candidate_name': candidate_name or None,
        'candidates': candidates,
        'validity': None,   # Backend is sole authority — see voteService.ts evaluateBallot()
        'reason': None,
        'confidence': float(confidence) if confidence is not None else 0.0,
        'raw_model_output': raw_model_text,
        'cleaned_model_output': cleaned,
        'parsed_full': parsed_json,
        'content_text': content_text,
        'reasoning_text': reasoning_text
    }

    return normalized


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
        "processor_source": PROCESSOR_SOURCE,
        "is_mock": AI_PROCESSOR == "mock"
    }


@app.post("/api/batches")
async def create_batch(
    ballot_type: str = Form(...),
    model_name: Optional[str] = Form(None),
    prompt_version: int = Form(1),
    candidates: Optional[str] = Form(None),
    files: List[UploadFile] = File(...)
):
    """Create a batch processing job"""
    batch_id = str(uuid.uuid4())

    # Parse optional candidates list from JSON string
    official_candidates = None
    if candidates:
        try:
            official_candidates = json.loads(candidates)
        except Exception:
            official_candidates = None
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
                parsed_result = process_ballot_wrapper(content, filename, ballot_type, idx, official_candidates)

                # Normalize and log
                try:
                    normalized = normalize_ai_result(parsed_result)
                    print(f"RAW MODEL OUTPUT (job={job_id}):\n{normalized.get('raw_model_output')}")
                    print(f"CLEANED MODEL OUTPUT (job={job_id}):\n{normalized.get('cleaned_model_output')}")
                    print(f"PARSED JSON (job={job_id}):\n{normalized.get('parsed_full')}")
                except Exception as _e:
                    normalized = {
                        "candidate_name": None,
                        "candidates": [],
                        "validity": None,
                        "reason": "normalize_failed",
                        "confidence": 0.0,
                        "parsed_full": {
                            "status": "error",
                            "error_message": str(_e),
                            "raw_result": parsed_result,
                        },
                    }

                batch_results[job_id] = {
                    "ok": True,
                    "error": None,
                    "latency_ms": 1000,
                    "parsed": normalized
                }
        except Exception as e:
            batch_results[job_id] = {
                "ok": False,
                "error": {
                    "type": e.__class__.__name__,
                    "message": str(e),
                    "traceback": traceback.format_exc(),
                },
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
    candidates: Optional[str] = Form(None),
    files: List[UploadFile] = File(...)
):
    """Process a single ballot synchronously"""
    if not files or len(files) == 0:
        return JSONResponse(
            {"error": "No files uploaded"},
            status_code=400
        )
    
    # Parse optional candidates list from JSON string
    official_candidates = None
    if candidates:
        try:
            official_candidates = json.loads(candidates)
        except Exception:
            official_candidates = None

    file = files[0]  # Take first file
    content = await file.read()
    filename = file.filename or "ballot"
    
    try:
        parsed_result = process_ballot_wrapper(content, filename, ballot_type, 0, official_candidates)

        # Normalize and log outputs for clarity
        try:
            normalized = normalize_ai_result(parsed_result)
            print("========== AI RAW OUTPUT ==========")
            print(normalized.get('raw_model_output'))
            print("========== AI CLEANED OUTPUT ==========")
            print(normalized.get('cleaned_model_output'))
            print("========== AI PARSED JSON ==========")
            print(normalized.get('parsed_full'))
            print("========== AI FINAL NORMALIZED ==========")
            print(normalized)
        except Exception as e:
            normalized = {
                "candidate_name": None,
                "candidates": [],
                "validity": None,
                "reason": "normalize_failed",
                "confidence": 0.0,
                "parsed_full": {
                    "status": "error",
                    "error_message": str(e),
                    "raw_result": parsed_result,
                },
            }

        return {
            "batch_id": "sync",
            "job_id": "sync_0",
            "ballot_type": ballot_type,
            "image_path": filename,
            "ok": True,
            "error": None,
            "latency_ms": 1000,
            "usage": {},
            "parsed": normalized,
            "processor": AI_PROCESSOR
        }
    except Exception as e:
        tb = traceback.format_exc()
        print("Error processing single ballot:", tb)
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
                "processor": AI_PROCESSOR,
                "traceback": tb
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
        "processor_source": PROCESSOR_SOURCE,
        "is_mock": AI_PROCESSOR == "mock"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=AI_PORT)
