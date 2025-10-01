from together import Together
import os, json
import base64, mimetypes

# ====== CẤU HÌNH ======
MODEL_ID = "Qwen/Qwen2.5-VL-72B-Instruct"
LOCAL_IMAGE_PATH =  input("Nhập đường dẫn ảnh phiếu: ").strip()
OUTPUT_JSON = "result.json"

# ====== PROMPT: PHIẾU TÍN NHIỆM (ONLY JSON) ======
SYSTEM_PROMPT = """
Bạn là hệ thống kiểm phiếu thông minh.

Nhiệm vụ:
1. Phân tích duy nhất 1 lá phiếu bầu tín nhiệm từ ảnh được cung cấp. 
2. Nhận diện bảng với các cột: STT, Họ và Tên, Đồng ý, Không đồng ý. 
3. Xác định dấu X trong từng ô. 
4. Kiểm tra hợp lệ của phiếu theo quy tắc:
   - Phiếu hợp lệ:
     • Với phiếu nhiều người: cử tri có thể đánh X vào ô Đồng ý hoặc Không đồng ý, có thể để trống cả hai ô cho một số ứng viên.
   - Phiếu không hợp lệ nếu:
     • Không đánh X vào ô Đồng ý cho bất kỳ ứng viên nào.
     • Đánh X vào cả hai ô Đồng ý và Không đồng ý cho cùng một ứng viên.
     • Với phiếu chỉ có 1 ứng viên: để trống cả 2 ô hoặc chọn cả 2 ô.
     • Bầu vượt số lượng quy định.
     • Có thêm ký tự, chữ viết, hoặc thêm tên ngoài danh sách.
5. Nếu phiếu không hợp lệ thì không tính cho bất kỳ ứng viên nào.

Yêu cầu:
- CHỈ trả về một JSON hợp lệ đúng cấu trúc dưới đây.
- KHÔNG viết thêm giải thích, KHÔNG dùng markdown, KHÔNG thêm text ngoài JSON.
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
      "agree": true|false,
      "disagree": true|false,
      "row_status": "OK|DOUBLE_MARK|EMPTY"
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