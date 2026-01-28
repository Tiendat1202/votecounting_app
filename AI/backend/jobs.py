import time
from typing import Dict, Any

# Import stage1 AI
from ai.co_du import process_trust
from ai.khong_du import process_surplus

from .storage import save_result

def run_inference_job(batch_id: str, job_id: str, ballot_type: str, image_path: str,
                      model_name: str | None = None, prompt_version: int = 1) -> Dict[str, Any]:
    """
    Worker job: chạy AI Stage1 cho 1 ảnh, lưu JSON kết quả.
    ballot_type: "trust" | "surplus"
    """
    t0 = time.time()
    ok = True
    err = None
    raw = None
    parsed = None
    usage = None

    try:
        if ballot_type == "trust":
            # Bạn sửa process_trust để nhận prompt_version/model_name nếu cần
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
        "usage": usage,     # nếu bạn lấy token từ Together thì gắn vào đây
        "parsed": parsed,   # JSON thô Stage1
    }

    save_result(batch_id, job_id, result)
    return result