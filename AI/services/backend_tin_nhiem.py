import os, json, math, tempfile, unicodedata
from typing import List, Dict
from collections import Counter
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse, FileResponse, PlainTextResponse
from pydantic import BaseModel, Field

app = FastAPI(title="Tín Nhiệm Aggregator", version="1.1.0")

# ======= CẤU HÌNH =======
RESULTS_DIR = os.getenv("TN_RESULTS_DIR", "./results_tin_nhiem")  # folder JSON
IMAGES_DIR  = os.getenv("TN_IMAGES_DIR", "./images_tin_nhiem")    # folder ảnh
SEATS       = int(os.getenv("TN_SEATS", "3"))
BALLOTS_ISSUED = int(os.getenv("TN_BALLOTS_ISSUED", "0"))
CANDIDATES  = [s.strip() for s in os.getenv("TN_CANDIDATES", "").split("|") if s.strip()]

os.makedirs(RESULTS_DIR, exist_ok=True)
TMP_DIR = tempfile.gettempdir()
CHART_PATH = os.path.join(TMP_DIR, "tin_nhiem_chart.png")


# ======= MODEL CẤU HÌNH =======
class ConfigIn(BaseModel):
    results_dir: str | None = None
    images_dir: str | None = None
    seats: int | None = Field(default=None, ge=1)
    ballots_issued: int | None = Field(default=None, ge=0)
    candidates: List[str] | None = None


# ======= ĐỌC FILE JSON =======
def _read_json_files(folder: str) -> List[dict]:
    if not folder or not os.path.isdir(folder):
        return []
    out = []
    for fn in sorted(os.listdir(folder)):
        if fn.lower().endswith(".json"):
            try:
                with open(os.path.join(folder, fn), "r", encoding="utf-8") as f:
                    out.append(json.load(f))
            except Exception:
                pass
    return out


# ======= HÀM CHUẨN HÓA & GỘP TÊN =======
def normalize_name(raw: str) -> tuple[str, str]:
    n = (raw or "").strip()
    n = " ".join(n.split())  
    n = n.title()
    n = unicodedata.normalize("NFC", n)  

    def remove_diacritics(s: str) -> str:
        s = unicodedata.normalize("NFD", s)
        return ''.join(ch for ch in s if unicodedata.category(ch) != "Mn")

    key = remove_diacritics(n).lower()

    alias_map = {
    }

    display = alias_map.get(key, n)
    return key, display


# ======= HÀM TỔNG HỢP =======
def _aggregate(records: List[dict], seats: int, canonical: List[str]) -> dict:
    received = len(records)
    valid = sum(1 for r in records if str(r.get("validity", "")).upper() == "VALID")
    invalid = received - valid
    valid_ratio = (valid / received) if received else 0.0

    agree, disagree = Counter(), Counter()
    display_name_map: Dict[str, str] = {}

    # Khởi tạo thứ tự theo danh sách chuẩn
    names_order_norm: List[str] = []
    for c in (canonical or []):
        key, disp = normalize_name(c)
        if key not in names_order_norm:
            names_order_norm.append(key)
            display_name_map[key] = disp

    # Duyệt tất cả phiếu
    for r in records:
        is_valid = str(r.get("validity", "")).upper() == "VALID"
        for row in (r.get("ballot_details") or []):
            raw_name = row.get("name") or ""
            key, disp = normalize_name(raw_name)
            if key and key not in names_order_norm:
                names_order_norm.append(key)
            if key and key not in display_name_map:
                display_name_map[key] = disp
            status = (row.get("row_status") or "").upper()
            if status == "DOUBLE_MARK":
                continue
            if is_valid and key:
                if row.get("agree") is True:
                    agree[key] += 1
                if row.get("disagree") is True:
                    disagree[key] += 1

    threshold = math.floor(valid * 0.5) + 1
    winners_norm = [k for k in names_order_norm if agree[k] >= threshold]
    if len(winners_norm) > seats:
        winners_norm = sorted(winners_norm, key=lambda k: (-agree[k], display_name_map.get(k, k)))[:seats]

    candidates = []
    for k in names_order_norm:
        agree_pct = (agree[k] / valid * 100.0) if valid else 0.0
        disagree_pct = (disagree[k] / valid * 100.0) if valid else 0.0
        candidates.append({
            "name": display_name_map.get(k, k),
            "agree": agree[k],
            "disagree": disagree[k],
            "agree_percent_of_valid": round(agree_pct, 2),
            "disagree_percent_of_valid": round(disagree_pct, 2),
        })

    issued = BALLOTS_ISSUED
    received_ratio = (received / issued) if issued else 0.0

    return {
        "ballots": {
            "issued": issued,
            "received": received,
            "received_ratio": round(received_ratio, 4),
            "valid": valid,
            "invalid": invalid,
            "valid_ratio": round(valid_ratio, 4),
        },
        "threshold_vote": threshold,
        "winners_rule": "> 50% số phiếu hợp lệ; nếu quá số ghế thì lấy theo 'Đồng ý' giảm dần.",
        "winners": [display_name_map.get(k, k) for k in winners_norm],
        "candidates": candidates,
    }


# ======= VẼ BIỂU ĐỒ =======
def _plot_chart(cands: List[Dict], title: str, outfile: str):
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        names = [c["name"] for c in cands]
        agree = [c["agree"] for c in cands]
        disagree = [c["disagree"] for c in cands]
        if not names:
            plt.figure(figsize=(6, 3))
            plt.title("Tin nhiệm: Chưa có dữ liệu")
            plt.savefig(outfile, bbox_inches="tight")
            plt.close()
            return
        x = range(len(names))
        w = 0.4
        plt.figure(figsize=(max(8, len(names) * 0.7), 4))
        plt.bar([i - w / 2 for i in x], agree, width=w, label="Đồng ý")
        plt.bar([i + w / 2 for i in x], disagree, width=w, label="Không đồng ý")
        plt.xticks(list(x), names, rotation=30, ha="right")
        plt.ylabel("Số phiếu")
        plt.title(title)
        plt.legend()
        plt.tight_layout()
        plt.savefig(outfile, bbox_inches="tight")
        plt.close()
    except Exception:
        pass


# ======= API CẤU HÌNH =======
@app.post("/config")
def set_config(cfg: ConfigIn):
    global RESULTS_DIR, IMAGES_DIR, SEATS, BALLOTS_ISSUED, CANDIDATES
    # ... giữ nguyên phần set biến ...
    if cfg.results_dir is not None:
        RESULTS_DIR = cfg.results_dir
        os.makedirs(RESULTS_DIR, exist_ok=True)

    # XÓA CHART CŨ khi có bất kỳ thay đổi cấu hình
    try:
        if os.path.exists(CHART_PATH):
            os.remove(CHART_PATH)
    except Exception:
        pass

    return {
        "ok": True,
        "results_dir": RESULTS_DIR,
        "images_dir": IMAGES_DIR,
        "seats": SEATS,
        "ballots_issued": BALLOTS_ISSUED,
        "candidates": CANDIDATES,
    }

# ======= API TỔNG HỢP =======
@app.get("/summary")
def summary():
    recs = _read_json_files(RESULTS_DIR)
    s = _aggregate(recs, SEATS, CANDIDATES)
    _plot_chart(s["candidates"], "Kết quả phiếu tín nhiệm", CHART_PATH)
    return JSONResponse({
        "config": {
            "results_dir": RESULTS_DIR,
            "images_dir": IMAGES_DIR,
            "seats": SEATS,
            "ballots_issued": BALLOTS_ISSUED,
            "candidates": CANDIDATES,
        },
        "summary": s,
        "chart": "/chart.png",
    })


# ======= BIỂU ĐỒ =======
@app.get("/chart.png")
def chart():
    recs = _read_json_files(RESULTS_DIR)
    s = _aggregate(recs, SEATS, CANDIDATES)
    _plot_chart(s["candidates"], "Kết quả phiếu tín nhiệm", CHART_PATH)

    headers = {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        "Pragma": "no-cache",
        "Expires": "0",
    }
    return FileResponse(CHART_PATH, media_type="image/png", headers=headers)


# ======= HIỂN THỊ DẠNG VĂN BẢN =======
@app.get("/summary/report")
def summary_pretty():
    recs = _read_json_files(RESULTS_DIR)
    s = _aggregate(recs, SEATS, CANDIDATES)
    b = s["ballots"]
    winners = s["winners"]
    cands = s["candidates"]

    lines = []
    lines.append("KẾT QUẢ BẦU CỬ")
    lines.append("---------------------------------")
    lines.append(f"Tổng số phiếu phát ra : {b['issued']}")
    lines.append(f"Số phiếu thu vào      : {b['received']}  ({b['received_ratio']*100:.2f}%)")
    lines.append(f"Phiếu hợp lệ          : {b['valid']}  ({b['valid_ratio']*100:.2f}%)")
    invalid_ratio = (1 - b['valid_ratio']) * 100 if b['received'] else 0
    lines.append(f"Phiếu không hợp lệ    : {b['invalid']}  ({invalid_ratio:.2f}%)")
    lines.append("")
    lines.append(f"Ngưỡng >50% số hợp lệ : {s['threshold_vote']} phiếu")
    lines.append("Trúng cử              : " + (", ".join(winners) if winners else "Không có"))
    lines.append("")
    lines.append("BẢNG ỨNG VIÊN")
    lines.append("---------------------------------")
    lines.append(f"{'STT':<4}{'Họ và tên':<28}{'Đồng ý':>10}{'Không đồng ý':>15}{'Tỉ lệ đồng ý':>15}{'Trạng thái':>15}")
    lines.append("-" * 80)
    for i, c in enumerate(cands, 1):
        name = c["name"][:26] + ("…" if len(c["name"]) > 26 else "")
        agree = c["agree"]
        disagree = c["disagree"]
        pct = c["agree_percent_of_valid"]
        status = "Trúng cử" if c["name"] in winners else ""
        lines.append(f"{i:<4}{name:<28}{agree:>10}{disagree:>15}{pct:>14.2f}%{status:>15}")
    lines.append("---------------------------------")

    return PlainTextResponse("\n".join(lines))