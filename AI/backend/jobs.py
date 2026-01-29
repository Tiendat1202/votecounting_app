import time
from typing import Dict, Any

# Import stage1 AI (legacy support)
from ai.co_du import process_trust
from ai.khong_du import process_surplus

# Import pluggable ballot processor
from .ballot_processor import process_ballot

from .storage import save_result

def run_inference_job(batch_id: str, job_id: str, ballot_type: str, image_path: str,
                      model_name: str | None = None, prompt_version: int = 1, use_processor: bool = True) -> Dict[str, Any]:
    """
    Worker job: chạy ballot processor hoặc legacy AI stage1 cho 1 ảnh.
    
    Args:
        batch_id: Batch identifier
        job_id: Job identifier
        ballot_type: "trust" | "surplus"
        image_path: Path to ballot image
        model_name: Optional model name
        prompt_version: Prompt version (legacy)
        use_processor: Use new pluggable processor (default: True)
        
    Returns:
        Processing result dict
    """
    t0 = time.time()
    ok = True
    err = None
    raw = None
    parsed = None
    usage = None

    try:
        if use_processor:
            # Use new pluggable processor
            parsed = process_ballot(image_path, ballot_type, batch_id, job_id)
        else:
            # Legacy: use stage1 AI
            if ballot_type == "trust":
                parsed = process_trust(image_path, ballot_id=job_id)
            elif ballot_type == "surplus":
                parsed = process_surplus(image_path, ballot_id=job_id)
            else:
                raise ValueError("ballot_type must be 'trust' or 'surplus'")
    except Exception as e:
        ok = False
        err = str(e)

    latency_ms = int((time.time() - t0) * 1000)

    result = {
        "batch_id": batch_id,
        "job_id": job_id,
        "ballot_type": ballot_type,
        "image_path": image_path,
        "ok": ok,
        "error": err,
        "latency_ms": latency_ms,
        "usage": usage,
        "parsed": parsed,
    }

    save_result(batch_id, job_id, result)
    return result