# backend/validator_khong_du.py
from __future__ import annotations
from typing import Any, Dict, List, Tuple


def _normalize_row(row: Dict[str, Any]) -> Dict[str, Any]:
    status = (row.get("row_status") or "").upper().strip()
    if status not in {"OK", "DOUBLE_MARK", "EMPTY"}:
        status = "EMPTY"

    agree = bool(row.get("agree"))
    disagree = bool(row.get("disagree"))

    # đồng bộ lại row_status nếu AI lệch
    if agree and disagree:
        status = "DOUBLE_MARK"
    elif not agree and not disagree:
        status = "EMPTY"
    else:
        status = "OK"

    return {
        "stt": row.get("stt"),
        "name": row.get("name"),
        "agree": agree,
        "disagree": disagree,
        "row_status": status,
    }


def _analyze(details: List[Dict[str, Any]]) -> Tuple[int, int, int, List[Dict[str, Any]]]:
    agree_cnt = 0
    double_mark_cnt = 0
    fixed = []

    for r in details:
        rr = _normalize_row(r)

        if rr["row_status"] == "OK" and rr["agree"]:
            agree_cnt += 1
        if rr["row_status"] == "DOUBLE_MARK":
            double_mark_cnt += 1

        fixed.append(rr)

    return agree_cnt, double_mark_cnt, len(fixed), fixed


def _extract_details(raw: Dict[str, Any]) -> List[Dict[str, Any]]:
    details = raw.get("ballot_details") or []
    if details:
        return details

    full_analysis = raw.get("full_analysis")
    if isinstance(full_analysis, dict):
        details = full_analysis.get("vote_details") or full_analysis.get("ballot_details") or []
        if details:
            return details

    parsed = raw.get("parsed") or {}
    full_analysis = parsed.get("full_analysis") if isinstance(parsed, dict) else None
    if isinstance(full_analysis, dict):
        details = full_analysis.get("vote_details") or full_analysis.get("ballot_details") or []
    return details if isinstance(details, list) else []


def validate_khong_du(
    raw_stage1: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Stage 2 – Hậu kiểm phiếu KHÔNG CÓ SỐ DƯ
    """

    raw = raw_stage1.get("raw", raw_stage1)
    ballot_id = raw.get("ballot_id")

    details = _extract_details(raw)
    handwritten = bool(raw.get("handwritten_marks"))

    reasons = set()

    agree_cnt, double_mark_cnt, total_rows, fixed_details = _analyze(details)

    # ===== LUẬT INVALID =====

    # AI không đọc được chi tiết phiếu
    if total_rows == 0:
        reasons.add("NO_BALLOT_DETAILS")

    # Không chọn ai (để trống toàn bộ)
    if agree_cnt == 0:
        reasons.add("NO_SELECTION")

    # Phiếu chỉ có 1 người
    if total_rows == 1:
        rs = fixed_details[0]["row_status"]
        if rs in {"EMPTY", "DOUBLE_MARK"}:
            reasons.add("INVALID_SINGLE_CANDIDATE")

    # Phiếu nhiều người – tất cả đều DOUBLE_MARK
    if total_rows > 1 and double_mark_cnt == total_rows:
        reasons.add("ALL_DOUBLE_MARK")

    # Chỉ cần có 1 dòng bị đánh dấu cả 2 ô (DOUBLE_MARK) là phiếu không hợp lệ
    if double_mark_cnt > 0:
        reasons.add("DOUBLE_MARK_PRESENT")

    # Có chữ viết tay / ký hiệu
    if handwritten:
        reasons.add("HANDWRITTEN_MARKS")

    validity = "VALID" if not reasons else "INVALID"

    return {
        "ballot_id": ballot_id,
        "ballot_type": "khong_du",
        "validity": validity,
        "invalid_reasons": sorted(reasons),
        "ballot_details": fixed_details,
        "agree_count": agree_cnt,
        "double_mark_count": double_mark_cnt,
    }