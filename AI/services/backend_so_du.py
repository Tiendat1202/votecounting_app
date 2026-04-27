import os, json, math, tempfile, unicodedata
from typing import List, Dict
from collections import Counter
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse, FileResponse, PlainTextResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(title="Số Dư Aggregator", version="2.0.0")

# Cho phép Frontend truy cập
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ====== CẤU HÌNH BAN ĐẦU ======
RESULTS_DIR = os.getenv("SD_RESULTS_DIR", "./results_so_du")
IMAGES_DIR  = os.getenv("SD_IMAGES_DIR", "./images_so_du")
SEATS       = int(os.getenv("SD_SEATS", "3"))
BALLOTS_ISSUED = int(os.getenv("SD_BALLOTS_ISSUED", "0"))
CANDIDATES  = [s.strip() for s in os.getenv("SD_CANDIDATES", "").split("|") if s.strip()]

os.makedirs(RESULTS_DIR, exist_ok=True)
TMP_DIR = tempfile.gettempdir()
CHART_PATH = os.path.join(TMP_DIR, "so_du_chart.png")


# ====== MODEL CẤU HÌNH ======
class ConfigIn(BaseModel):
    results_dir: str | None = None
    images_dir: str | None = None
    seats: int | None = Field(default=None, ge=1)
    ballots_issued: int | None = Field(default=None, ge=0)
    candidates: List[str] | None = None


# ====== ĐỌC FILE JSON ======
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


# ====== CHUẨN HÓA TÊN ======
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
        "le thi thu thuy": "Lê Thị Thu Thủy",
        "le thi thu thuy ": "Lê Thị Thu Thủy",
        "le thi thu thuỵ": "Lê Thị Thu Thủy",
        "le thi thu thuỳ": "Lê Thị Thu Thủy",
    }
    display = alias_map.get(key, n)
    return key, display


# ====== HÀM TỔNG HỢP ======
def _aggregate(records: List[dict], seats: int, canonical: List[str]) -> dict:
    received = len(records)
    valid = sum(1 for r in records if str(r.get("validity", "")).upper() == "VALID")
    invalid = received - valid
    valid_ratio = (valid / received) if received else 0.0

    selected_cnt, unselected_cnt = Counter(), Counter()
    display_name_map: Dict[str, str] = {}
    names_order_norm: List[str] = []

    for c in (canonical or []):
        key, disp = normalize_name(c)
        if key not in names_order_norm:
            names_order_norm.append(key)
            display_name_map[key] = disp

    for r in records:
        is_valid = str(r.get("validity", "")).upper() == "VALID"
        for row in (r.get("ballot_details") or []):
            raw_name = row.get("name") or ""
            key, disp = normalize_name(raw_name)
            if key and key not in names_order_norm:
                names_order_norm.append(key)
            if key and key not in display_name_map:
                display_name_map[key] = disp
            if is_valid and key:
                if row.get("selected") is True:
                    selected_cnt[key] += 1
                else:
                    unselected_cnt[key] += 1

    # Tính người trúng cử: lấy top N theo selected_cnt
    winners_norm = sorted(
        names_order_norm,
        key=lambda k: (-selected_cnt[k], display_name_map.get(k, k))
    )[:seats]

    candidates = []
    for k in names_order_norm:
        agree_pct = (selected_cnt[k] / valid * 100.0) if valid else 0.0
        disagree_pct = (unselected_cnt[k] / valid * 100.0) if valid else 0.0
        candidates.append({
            "name": display_name_map.get(k, k),
            "selected": selected_cnt[k],
            "unselected": unselected_cnt[k],
            "selected_percent_of_valid": round(agree_pct, 2),
            "unselected_percent_of_valid": round(disagree_pct, 2),
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
        "seats": seats,
        "winners": [display_name_map.get(k, k) for k in winners_norm],
        "candidates": candidates,
    }


# ====== VẼ BIỂU ĐỒ ======
def _plot_chart(cands: List[Dict], title: str, outfile: str):
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        names = [c["name"] for c in cands]
        selected = [c["selected"] for c in cands]
        unselected = [c["unselected"] for c in cands]
        if not names:
            plt.figure(figsize=(6, 3))
            plt.title("Phiếu có số dư: Chưa có dữ liệu")
            plt.savefig(outfile, bbox_inches="tight")
            plt.close()
            return
        x = range(len(names))
        w = 0.4
        plt.figure(figsize=(max(8, len(names) * 0.7), 4))
        plt.bar([i - w / 2 for i in x], selected, width=w, label="Được chọn")
        plt.bar([i + w / 2 for i in x], unselected, width=w, label="Không được chọn")
        plt.xticks(list(x), names, rotation=30, ha="right")
        plt.ylabel("Số phiếu")
        plt.title(title)
        plt.legend()
        plt.tight_layout()
        plt.savefig(outfile, bbox_inches="tight")
        plt.close()
    except Exception:
        pass


# ====== /config ======
@app.post("/config")
def set_config(cfg: ConfigIn):
    global RESULTS_DIR, IMAGES_DIR, SEATS, BALLOTS_ISSUED, CANDIDATES
    if cfg.results_dir is not None:
        RESULTS_DIR = cfg.results_dir
        os.makedirs(RESULTS_DIR, exist_ok=True)
    if cfg.images_dir is not None:
        IMAGES_DIR = cfg.images_dir
    if cfg.seats is not None:
        SEATS = cfg.seats
    if cfg.ballots_issued is not None:
        BALLOTS_ISSUED = cfg.ballots_issued
    if cfg.candidates is not None:
        CANDIDATES = [s.strip() for s in cfg.candidates if s.strip()]

    # Xóa chart cũ khi đổi phiên
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


# ====== /summary ======
@app.get("/summary")
def summary():
    recs = _read_json_files(RESULTS_DIR)
    s = _aggregate(recs, SEATS, CANDIDATES)
    _plot_chart(s["candidates"], "Kết quả phiếu có số dư", CHART_PATH)
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


# ====== /chart.png ======
@app.get("/chart.png")
def chart():
    recs = _read_json_files(RESULTS_DIR)
    s = _aggregate(recs, SEATS, CANDIDATES)
    _plot_chart(s["candidates"], "Kết quả phiếu có số dư", CHART_PATH)
    headers = {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        "Pragma": "no-cache",
        "Expires": "0",
    }
    return FileResponse(CHART_PATH, media_type="image/png", headers=headers)


# ====== /summary/pretty ======
@app.get("/summary/report")
def summary_pretty():
    recs = _read_json_files(RESULTS_DIR)
    s = _aggregate(recs, SEATS, CANDIDATES)
    if not s:
        return PlainTextResponse("Không có dữ liệu.")
    b = s["ballots"]; winners = s["winners"]; cands = s["candidates"]

    lines = []
    lines.append("KẾT QUẢ PHIẾU CÓ SỐ DƯ")
    lines.append("---------------------------------")
    lines.append(f"Tổng số phiếu phát ra : {b['issued']}")
    lines.append(f"Số phiếu thu vào      : {b['received']}  ({b['received_ratio']*100:.2f}%)")
    lines.append(f"Phiếu hợp lệ          : {b['valid']}  ({b['valid_ratio']*100:.2f}%)")
    invalid_ratio = (1 - b['valid_ratio']) * 100 if b['received'] else 0
    lines.append(f"Phiếu không hợp lệ    : {b['invalid']}  ({invalid_ratio:.2f}%)")
    lines.append("")
    lines.append(f"Số ghế được bầu       : {s['seats']}")
    lines.append("Trúng cử              : " + (", ".join(winners) if winners else "Không có"))
    lines.append("")
    lines.append("BẢNG ỨNG VIÊN")
    lines.append("---------------------------------")
    lines.append(f"{'STT':<4}{'Họ và tên':<28}{'Được chọn':>12}{'Không chọn':>15}{'Tỉ lệ được chọn':>18}{'Trạng thái':>15}")
    lines.append("-"*95)
    for i, c in enumerate(cands, 1):
        name = c["name"][:26] + ("…" if len(c["name"]) > 26 else "")
        sel = c["selected"]; unsel = c["unselected"]
        pct = c["selected_percent_of_valid"]
        status = "Trúng cử" if c["name"] in winners else ""
        lines.append(f"{i:<4}{name:<28}{sel:>12}{unsel:>15}{pct:>17.2f}%{status:>15}")
    lines.append("---------------------------------")
    return PlainTextResponse("\n".join(lines))