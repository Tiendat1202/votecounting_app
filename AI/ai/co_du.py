# AI/ai/co_du.py
from __future__ import annotations

import os
import json
import base64
import mimetypes
import time
from typing import Any, Dict, Optional

from dotenv import load_dotenv
from together import Together

from ai.prompt.co_du_prompt import build_co_du_prompt


def _file_to_data_uri(path: str) -> str:
    mime, _ = mimetypes.guess_type(path)
    if not mime:
        mime = "image/jpeg"
    with open(path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("ascii")
    return f"data:{mime};base64,{b64}"


def _load_api_key() -> str:
    # root project: votecounting_app/
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    env_path = os.path.join(base_dir, ".env")
    load_dotenv(dotenv_path=env_path)

    key = os.getenv("TOGETHER_API_KEY")
    if not key:
        raise RuntimeError(f"Không tìm thấy TOGETHER_API_KEY trong {env_path}")
    return key


<<<<<<< Updated upstream
def process_surplus_raw(
=======
def process_co_du(
    image_path: str,
    ballot_id: Optional[str] = None,
    model_id: str = "Qwen/Qwen2.5-VL-72B-Instruct",
    prompt_version: int = 1,
    temperature: float = 0.0,
) -> Dict[str, Any]:
    """
    Stage 1 - đọc RAW phiếu có dư.
    KHÔNG kết luận VALID/INVALID.
    """
    return process_co_du_raw(
        image_path=image_path,
        ballot_id=ballot_id,
        model_id=model_id,
        prompt_version=prompt_version,
        temperature=temperature,
    )


def process_co_du_raw(
>>>>>>> Stashed changes
    image_path: str,
    ballot_id: Optional[str] = None,
    model_id: str = "Qwen/Qwen2.5-VL-72B-Instruct",
    prompt_version: int = 1,
    temperature: float = 0.0,
) -> Dict[str, Any]:
    api_key = _load_api_key()
    client = Together(api_key=api_key)

    system_prompt = build_co_du_prompt(prompt_version)
    data_uri = _file_to_data_uri(image_path)

    t0 = time.time()
    resp = client.chat.completions.create(
        model=model_id,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "Phân tích lá phiếu này và CHỈ trả JSON theo schema."},
                    {"type": "image_url", "image_url": {"url": data_uri}},
                ],
            },
        ],
        temperature=temperature,
    )
    latency_ms = int((time.time() - t0) * 1000)

    content = resp.choices[0].message.content
    data = json.loads(content)

    if ballot_id is not None and not data.get("ballot_id"):
        data["ballot_id"] = ballot_id

    data.setdefault("ballot_details", [])
    data.setdefault("extra_names", [])
    data.setdefault("handwritten_marks", False)
    data.setdefault("tampering_marks", False)

    return {
        "ok": True,
        "latency_ms": latency_ms,
        "model_id": model_id,
        "prompt_version": prompt_version,
        "raw": data,
    }