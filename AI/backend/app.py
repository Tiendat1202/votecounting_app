import os, uuid
from typing import List, Optional
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import JSONResponse
from redis import Redis
from rq import Queue

from .config import REDIS_URL
from .storage import ensure_dirs, new_batch_id, save_upload, list_results
from .jobs import run_inference_job

app = FastAPI(title="Ballot VLM Backend (Option 2)")

redis_conn = Redis.from_url(REDIS_URL)
q = Queue("ballot", connection=redis_conn, default_timeout=180)  # 180s/job

@app.on_event("startup")
def _startup():
    ensure_dirs()

@app.post("/api/batches")
async def create_batch(
    ballot_type: str = Form(...),          # "trust" | "surplus"
    model_name: Optional[str] = Form(None),
    prompt_version: int = Form(1),
    files: List[UploadFile] = File(...)
):
    batch_id = new_batch_id()
    total = 0
    job_ids = []

    for f in files:
        content = await f.read()
        # tên file an toàn
        safe_name = f.filename.replace("/", "_").replace("\\", "_")
        img_path = save_upload(batch_id, safe_name, content)

        job_id = uuid.uuid4().hex[:10]
        job = q.enqueue(
            run_inference_job,
            batch_id, job_id, ballot_type, img_path,
            model_name=model_name,
            prompt_version=prompt_version,
            retry=3  # RQ retry cơ bản
        )
        job_ids.append(job.id)
        total += 1

    return {"batch_id": batch_id, "total": total, "queue_job_ids": job_ids}

@app.get("/api/batches/{batch_id}")
def batch_status(batch_id: str):
    # tiến độ dựa vào số file result đã sinh
    results = list_results(batch_id)
    done = len(results)
    # total không lưu DB nên bạn có thể:
    # - lưu 1 file meta.json khi create batch, hoặc
    # - FE tự giữ total từ response create_batch
    return {"batch_id": batch_id, "done": done}

@app.get("/api/batches/{batch_id}/results")
def batch_results(batch_id: str):
    paths = list_results(batch_id)
    items = []
    for p in paths:
        items.append(os.path.basename(p))
    return {"batch_id": batch_id, "files": items}

@app.get("/api/batches/{batch_id}/results/{filename}")
def get_result_file(batch_id: str, filename: str):
    from .storage import result_dir
    import json

    path = os.path.join(result_dir(batch_id), filename)
    if not os.path.isfile(path):
        return JSONResponse({"error": "not found"}, status_code=404)

    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)