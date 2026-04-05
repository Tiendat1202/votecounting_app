# AI/ai/khong_du.py
from __future__ import annotations

import os
import json
import base64
import mimetypes
import time
from typing import Any, Dict, Optional

from dotenv import load_dotenv
from together import Together

<<<<<<< Updated upstream
# ====== NẠP API KEY ======
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # /app
ENV_PATH = os.path.join(BASE_DIR, ".env")
load_dotenv(dotenv_path=ENV_PATH)

api_key = os.getenv("TOGETHER_API_KEY")
if not api_key:
    raise RuntimeError(f"Không tìm thấy TOGETHER_API_KEY trong {ENV_PATH}")

client = Together(api_key=api_key)

# ====== CẤU HÌNH ======
MODEL_ID = "Qwen/Qwen2.5-VL-72B-Instruct"
LOCAL_IMAGE_PATH = input("Nhập đường dẫn ảnh phiếu: ").strip()
OUTPUT_JSON = "result.json"

# ====== TẠO ballot_id ======
def make_ballot_id(path: str) -> str:
    stem = os.path.splitext(os.path.basename(path))[0]
    with open(path, "rb") as f:
        h = hashlib.sha1(f.read()).hexdigest()[:4].upper()
    norm = stem.strip().replace(" ", "_").upper()
    return f"{norm}_{h}"

# ====== PROMPT: PHIẾU TÍN NHIỆM ======
SYSTEM_PROMPT = """
Bạn là hệ thống kiểm phiếu thông minh.

Nhiệm vụ:
1. Phân tích DUY NHẤT 1 lá phiếu bầu tín nhiệm từ ảnh được cung cấp. 
2. Nhận diện bảng với các cột: STT, Họ và Tên, Đồng ý, Không đồng ý. 
3. Xác định dấu X trong từng ô. 
4. Phân biệt các tên người khác nhau về ký tự là khác nhau. 
5. ĐÁNH DẤU Ô & row_status
- Với mỗi hàng:
  • agree=true nếu ô Đồng ý có dấu X rõ.
  • disagree=true nếu ô Không đồng ý có dấu X rõ.
  • Nếu cả hai ô đều có X ⇒ row_status="DOUBLE_MARK" (vẫn xuất hàng, nhưng HÀNG NÀY KHÔNG ĐƯỢC TÍNH cho kết quả của ứng viên đó).
  • Nếu cả hai ô không có X ⇒ row_status="EMPTY".
  • Ngược lại ⇒ row_status="OK".
- Không suy đoán nếu mơ hồ: khi không chắc là X, coi như không có X.
6. Kiểm tra hợp lệ của phiếu theo quy tắc:
   - Phiếu hợp lệ nếu:
     • Với phiếu nhiều người: Là phiếu nhiều người và có ÍT NHẤT MỘT ứng viên được đánh X ở ô Đồng ý (agree=true), và KHÔNG vi phạm các điều “không hợp lệ” bên dưới.
     • Với phiếu chỉ có một người: Với phiếu chỉ có một người: phải đánh X vào một trong hai ô (Đồng ý/Không đồng ý). DOUBLE_MARK hoặc EMPTY ở phiếu 1 người ⇒ KHÔNG HỢP LỆ.
     • DOUBLE_MARK chỉ loại kết quả của CHÍNH ỨNG VIÊN đó (hàng đó không được cộng vào Đồng ý/Không đồng ý), NHƯNG KHÔNG tự động làm rơi cả phiếu, trừ khi rơi vào các điều “không hợp lệ” ở trên.
   - Phiếu không hợp lệ nếu:
     • Không đánh X vào ô Đồng ý cho BẤT KỲ ứng viên nào trong danh sách nhiều người (tức không có agree=true ở bất kỳ hàng nào).
     • Đánh X vào ô Không đồng ý CHO TẤT CẢ các ứng viên (tức mọi hàng đều disagree=true, và không có agree=true).
     • Phiếu chỉ có 1 ứng viên nhưng để trống cả 2 ô (EMPTY) hoặc đánh X cả hai ô (DOUBLE_MARK).
     • Có vết tẩy xoá, ký tên hoặc ghi thêm thông tin khác ngoài thông tin được in trên phiếu.
     • Có thêm tên ngoài danh sách được in.
7. Nếu phiếu không hợp lệ thì không tính cho bất kỳ ứng viên nào.

Yêu cầu:
- CHỈ trả về đúng 1 JSON hợp lệ, theo đúng cấu trúc dưới đây.
- KHÔNG viết thêm giải thích, KHÔNG dùng markdown, KHÔNG thêm text ngoài JSON.
- Nếu không chắc một trường, đặt null.
- Nếu không nhận diện được phiếu, vẫn PHẢI trả JSON hợp lệ với giá trị null hoặc [].

Cấu trúc JSON:
{
  "ballot_id": "<string|null>",
  "validity": "VALID|INVALID",
  "invalid_reasons": ["<string>"],
  "ballot_details": [
    {
      "stt": <int>,
      "name": "<string>",
      "agree": true|false,
      "disagree": true|false,
      "row_status": "OK|DOUBLE_MARK|EMPTY"
    }
  ]
}
""".strip()

def file_to_data_uri(path: str) -> str:
=======
from ai.prompt.khong_du_prompt import build_khong_du_prompt


def _file_to_data_uri(path: str) -> str:
>>>>>>> Stashed changes
    mime, _ = mimetypes.guess_type(path)
    if not mime:
        mime = "image/jpeg"
    with open(path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("ascii")
    return f"data:{mime};base64,{b64}"


def _load_api_key() -> str:
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    env_path = os.path.join(base_dir, ".env")
    load_dotenv(dotenv_path=env_path)

    key = os.getenv("TOGETHER_API_KEY")
    if not key:
        raise RuntimeError(f"Không tìm thấy TOGETHER_API_KEY trong {env_path}")
    return key


def process_khong_du(
    image_path: str,
    ballot_id: Optional[str] = None,
    model_id: str = "Qwen/Qwen2.5-VL-72B-Instruct",
    prompt_version: int = 1,
    temperature: float = 0.0,
) -> Dict[str, Any]:
    """
    Stage 1 - đọc RAW phiếu không dư.
    KHÔNG kết luận VALID/INVALID.
    """
    return process_khong_du_raw(
        image_path=image_path,
        ballot_id=ballot_id,
        model_id=model_id,
        prompt_version=prompt_version,
        temperature=temperature,
    )


def process_khong_du_raw(
    image_path: str,
    ballot_id: Optional[str] = None,
    model_id: str = "Qwen/Qwen2.5-VL-72B-Instruct",
    prompt_version: int = 1,
    temperature: float = 0.0,
) -> Dict[str, Any]:
    api_key = _load_api_key()
    client = Together(api_key=api_key)

    system_prompt = build_khong_du_prompt(prompt_version)
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

<<<<<<< Updated upstream
    reasons = set(data.get("invalid_reasons", []))

    # nếu không có bất kỳ ô đồng ý nào => INVALID
    if agree_total == 0:
        data["validity"] = "INVALID"
        reasons.add("NO_ANY_AGREE")

    data["invalid_reasons"] = list(reasons)

    # ====== LƯU FILE ======
    RESULT_DIR = "/Users/baominh/Desktop/votecounting_app/AI/results/tin_nhiem_results"
    os.makedirs(RESULT_DIR, exist_ok=True)

    ballot_id = data.get("ballot_id") or "ballot"
    safe_id = "".join(ch if ch.isalnum() or ch in ("-", "_") else "_" for ch in str(ballot_id))
    outfile = os.path.join(RESULT_DIR, f"{safe_id}.json")

    # Nếu lỡ trùng mã, thêm hậu tố _1, _2,...
    i = 1
    base_outfile = outfile
    while os.path.exists(outfile):
        outfile = os.path.join(RESULT_DIR, f"{safe_id}_{i}.json")
        i += 1

    with open(outfile, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(json.dumps(data, ensure_ascii=False, indent=2))
    print(f"✅ Đã lưu kết quả phiếu vào: {outfile}")

except json.JSONDecodeError:
    print("Model không trả JSON hợp lệ.")
=======
    return {
        "ok": True,
        "latency_ms": latency_ms,
        "model_id": model_id,
        "prompt_version": prompt_version,
        "raw": data,
    }
>>>>>>> Stashed changes
