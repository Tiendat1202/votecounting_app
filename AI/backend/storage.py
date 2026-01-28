import os, json, uuid, time
from typing import Any, Dict, List
from .config import UPLOAD_DIR, RESULT_DIR

def ensure_dirs():
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    os.makedirs(RESULT_DIR, exist_ok=True)

def new_batch_id() -> str:
    return time.strftime("B%Y%m%d_%H%M%S_") + uuid.uuid4().hex[:6]

def batch_dir(batch_id: str) -> str:
    return os.path.join(UPLOAD_DIR, batch_id)

def result_dir(batch_id: str) -> str:
    return os.path.join(RESULT_DIR, batch_id)

def save_upload(batch_id: str, filename: str, content: bytes) -> str:
    bdir = batch_dir(batch_id)
    os.makedirs(bdir, exist_ok=True)
    path = os.path.join(bdir, filename)
    with open(path, "wb") as f:
        f.write(content)
    return path

def save_result(batch_id: str, job_id: str, data: Dict[str, Any]) -> str:
    rdir = result_dir(batch_id)
    os.makedirs(rdir, exist_ok=True)
    path = os.path.join(rdir, f"{job_id}.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    return path

def list_results(batch_id: str) -> List[str]:
    rdir = result_dir(batch_id)
    if not os.path.isdir(rdir):
        return []
    return sorted([os.path.join(rdir, x) for x in os.listdir(rdir) if x.endswith(".json")])