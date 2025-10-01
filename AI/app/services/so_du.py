from together import Together
import os, json
import base64, mimetypes

# ====== CẤU HÌNH ======
MODEL_ID = "Qwen/Qwen2.5-VL-72B-Instruct"
LOCAL_IMAGE_PATH =  input("Nhập đường dẫn ảnh phiếu: ").strip()
OUTPUT_JSON = "result.json"

# ====== PROMPT: PHIẾU SỐ DƯ (ONLY JSON) ======
SYSTEM_PROMPT = """
Bạn là hệ thống kiểm phiếu thông minh.

Nhiệm vụ:
1. Phân tích duy nhất 1 lá phiếu bầu có số dư từ ảnh được cung cấp.
2. Nhận diện danh sách ứng viên trong bảng (cột STT, Họ và Tên).
3. Xác định ai bị gạch tên (không được bầu), ai không bị gạch (được bầu).
4. Kiểm tra hợp lệ theo quy tắc:
   - Phiếu hợp lệ:
     • Phiếu do Ban kiểm phiếu phát.
     • Số lượng người được chọn (không gạch tên) phải nhỏ hơn hoặc bằng số lượng đại biểu cần bầu (N).
     • Có thể chọn ít hơn N, nhưng không được vượt quá N.
   - Phiếu không hợp lệ nếu:
     • Bầu nhiều hơn N ứng viên.
     • Có tên ngoài danh sách.
     • Sử dụng nhiều loại mực, có vết tẩy xoá, ký tên hoặc ghi thêm.
     • Có ký hiệu khả nghi trên phiếu.
5. Nếu phiếu không hợp lệ, không tính cho bất kỳ ứng viên nào.

Yêu cầu:
- CHỈ trả về một JSON hợp lệ đúng cấu trúc sau.
- KHÔNG viết giải thích, KHÔNG markdown, KHÔNG thêm text ngoài JSON.
- Nếu không chắc một trường, đặt null.

Cấu trúc JSON:
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

client = Together()

def file_to_data_uri(path: str) -> str:
    mime, _ = mimetypes.guess_type(path)
    if not mime:
        mime = "image/jpeg"
    with open(path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("ascii")
    return f"data:{mime};base64,{b64}"

# TẠO data_uri TỪ ẢNH LOCAL
data_uri = file_to_data_uri(LOCAL_IMAGE_PATH)

response = client.chat.completions.create(
    model=MODEL_ID,
    response_format={"type": "json_object"},
    messages=[
        {"role": "system", "content": SYSTEM_PROMPT},
        {
            "role": "user",
            "content": [
                {"type": "text", "text": "Phân tích lá phiếu trong ảnh và CHỈ trả JSON theo cấu trúc đã nêu."},
                {"type": "image_url", "image_url": {"url": data_uri}}
            ],
        },
    ],
    temperature=0.2,
)

content = response.choices[0].message.content  # chuỗi JSON
print(content)

# lưu file
try:
    parsed = json.loads(content)
    RESULT_DIR = "/Users/baominh/Desktop/Đồ án/results/so_du_results"

    #Lưu file theo sequence
    existing = [f for f in os.listdir(RESULT_DIR) if f.endswith(".json")]
    next_id = len(existing) + 1

    OUTPUT_JSON = os.path.join(RESULT_DIR, f"ballot_{next_id:03d}.json")

    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(parsed, f, ensure_ascii=False, indent=2)

    print(f"✅ Đã lưu kết quả phiếu vào: {OUTPUT_JSON}")

except json.JSONDecodeError:
    pass