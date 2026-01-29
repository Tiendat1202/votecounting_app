from __future__ import annotations

import os, json, base64, mimetypes, time
from typing import Any, Dict, Optional

from dotenv import load_dotenv
from together import Together

from ai.prompt.co_du_prompt import build_surplus_prompt

def _file_to_data_uri(path: str) -> str:
    mime, _ = mimetypes.guess_type(path)
    if not mime:
        mime = "image/jpeg"
    with open(path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("ascii")
    return f"data:{mime};base64,{b64}"


def _load_api_key() -> str:
    # Load .env từ root dự án (BM_DOAN/.env)
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # BM_DOAN
    env_path = os.path.join(base_dir, ".env")
    load_dotenv(dotenv_path=env_path)

    key = os.getenv("TOGETHER_API_KEY")
    if not key:
        raise RuntimeError(f"Không tìm thấy TOGETHER_API_KEY trong {env_path}")
    return key


def process_surplus(
    image_path: str,
    ballot_id: Optional[str] = None,
    model_id: str = "Qwen/Qwen2.5-VL-72B-Instruct",
    prompt_version: int = 1,
    temperature: float = 0.0,
) -> Dict[str, Any]:
    """
    Wrapper cho process_surplus_raw - xử lý phiếu có số dư.
    """
    return process_surplus_raw(image_path, ballot_id, model_id, prompt_version, temperature)


def process_surplus_raw(
    image_path: str,
    ballot_id: Optional[str] = None,
    model_id: str = "Qwen/Qwen2.5-VL-72B-Instruct",
    prompt_version: int = 1,
    temperature: float = 0.0,
) -> Dict[str, Any]:
    """
    Stage 1: Model chỉ đọc dữ liệu thô từ ảnh phiếu có số dư.
    - Không kết luận VALID/INVALID
    - Không áp luật N
    Trả về dict parse từ JSON của model + metadata cơ bản.
    """
    api_key = _load_api_key()
    client = Together(api_key=api_key)

    system_prompt = build_surplus_prompt(prompt_version)
    data_uri = _file_to_data_uri(image_path)

    # Khuyến nghị: ép model trả JSON object (nếu model hỗ trợ)
    # Nếu model nào không hỗ trợ, bạn có thể bỏ response_format và dùng parser phía backend.
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

    # Gắn ballot_id nếu backend truyền vào mà model để null
    if ballot_id is not None and not data.get("ballot_id"):
        data["ballot_id"] = ballot_id

    # Chuẩn hoá tối thiểu: đảm bảo field tồn tại
    data.setdefault("ballot_details", [])
    data.setdefault("extra_names", [])

    return {
        "ok": True,
        "latency_ms": latency_ms,
        "model_id": model_id,
        "prompt_version": prompt_version,
        "raw": data,
        # Nếu Together trả usage thì bạn có thể thêm:
        # "usage": getattr(resp, "usage", None)
    }