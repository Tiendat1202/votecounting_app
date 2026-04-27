from together import Together
import os, json
import base64, mimetypes
from dotenv import load_dotenv


# ====== NẠP API KEY ======
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # /app
ENV_PATH = os.path.join(BASE_DIR, ".env")
load_dotenv(dotenv_path=ENV_PATH)

api_key = os.getenv("TOGETHER_API_KEY")
if not api_key:
    raise RuntimeError(f"Không tìm thấy TOGETHER_API_KEY trong {ENV_PATH}")

client = Together(api_key=api_key)

# ====== CẤU HÌNH ======
DEFAULT_MODEL_ID = "Qwen/Qwen3.5-397B-A17B"
MODEL_ID = (os.getenv("TOGETHER_MODEL_ID") or os.getenv("MODEL") or DEFAULT_MODEL_ID).strip()
LOCAL_IMAGE_PATH = input("Nhập đường dẫn ảnh phiếu: ").strip()
N_raw = input("Nhập số lượng cần bầu: ").strip()
try:
    SEATS_N = int(N_raw)
    assert SEATS_N > 0
except Exception:
    raise ValueError("N phải là số nguyên dương.")
OUTPUT_JSON = "result.json"

# ====== PROMPT ======
SYSTEM_PROMPT = """
Bạn là hệ thống kiểm phiếu thông minh.

Nhiệm vụ:
1. Phân tích DUY NHẤT 1 ảnh phiếu bầu có số dư.
2. Nhận diện bảng (STT, Họ và Tên), xác định ai bị gạch (selected=false), ai không bị gạch (selected=true).
3. Kiểm tra hợp lệ:
   - Hợp lệ nếu: số người được bầu ≤ N và không có tên ngoài danh sách.
   - Không hợp lệ nếu: bầu > N; có tên ngoài danh sách; gạch tất cả; tẩy xoá; nhiều loại mực; chữ trong ô.
   - Chữ ký/ghi chú NẰM NGOÀI bảng: bỏ qua, KHÔNG làm phiếu INVALID.
4. CHỈ được phép trả đúng **1 JSON duy nhất** theo cấu trúc sau.
5. KHÔNG viết giải thích, KHÔNG Markdown, KHÔNG thêm text ngoài JSON.
6. Nếu không thể nhận dạng, vẫn phải xuất ra JSON hợp lệ với null/[].

Cấu trúc JSON bắt buộc:
{
  "ballot_id": "<string|null>",
  "validity": "VALID|INVALID",
  "invalid_reasons": ["<string>"],
  "ballot_details": [
    {
      "stt": <int>,
      "name": "<string>",
      "selected": true|false,
      "row_status": "OK|CROSSED|SUSPICIOUS"
    }
  ]
}
""".strip()

def file_to_data_uri(path: str) -> str:
    mime, _ = mimetypes.guess_type(path)
    if not mime:
        mime = "image/jpeg"
    with open(path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("ascii")
    return f"data:{mime};base64,{b64}"

# ====== TẠO data_uri & GỬI YÊU CẦU ======
data_uri = file_to_data_uri(LOCAL_IMAGE_PATH)

session_block = f"[SessionConfig]\n{{\"ballot_type\":\"SO_DU\",\"seats\":{SEATS_N}}}\n[End]\n"

response = client.chat.completions.create(
    model=MODEL_ID,
    response_format={"type": "json_object"},
    messages=[
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user",
         "content": [
             {"type": "text", "text": session_block + f"Phân tích lá phiếu này và CHỈ trả JSON. N={SEATS_N}."},
             {"type": "image_url", "image_url": {"url": data_uri}},
         ]},
    ],
    temperature=0.0,
)

# ====== HẬU KIỂM & LƯU FILE ======
try:
    content = response.choices[0].message.content
    data = json.loads(content)

    details = data.get("ballot_details", []) or []
    # --- Đồng bộ selected theo row_status ---
    for r in details:
        status = (r.get("row_status") or "").upper()
        if status == "CROSSED":
            r["selected"] = False
        elif status == "OK":
            r["selected"] = True
        elif status == "SUSPICIOUS":
            r["selected"] = False  # hoặc giữ nguyên, tùy chính sách

    # --- Đếm số người được chọn ---
    selected_cnt = sum(1 for r in details if r.get("selected") is True)

    # --- Áp luật cứng: không vượt N, không bỏ trống toàn bộ ---
    N = SEATS_N
    reasons = set(data.get("invalid_reasons", []))

    if selected_cnt > N:
        data["validity"] = "INVALID"
        reasons.add(f"OVER_SEATS(N={N}, selected={selected_cnt})")
    elif selected_cnt == 0:
        data["validity"] = "INVALID"
        reasons.add("NO_SELECTION")
    else:
        data["validity"] = "VALID"

    data["invalid_reasons"] = list(reasons)
    data["seats"] = N

    # --- Lưu file như cũ ---
    RESULT_DIR = "/Users/baominh/Desktop/votecounting_app/AI/results/so_du_results"
    os.makedirs(RESULT_DIR, exist_ok=True)

    ballot_id = data.get("ballot_id") or "ballot"
    safe_id = "".join(ch if ch.isalnum() or ch in ("-", "_") else "_" for ch in str(ballot_id))
    outfile = os.path.join(RESULT_DIR, f"{safe_id}.json")

    # Nếu lỡ trùng mã (rất hiếm), thêm hậu tố _1, _2,...
    i = 1
    base_outfile = outfile
    while os.path.exists(outfile):
        outfile = os.path.join(RESULT_DIR, f"{safe_id}_{i}.json")
        i += 1

    with open(outfile, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(json.dumps(data, ensure_ascii=False, indent=2))
    print(f"Đã lưu kết quả phiếu vào: {outfile}")

except json.JSONDecodeError:
    pass