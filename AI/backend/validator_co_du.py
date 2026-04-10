# backend/validator_co_du.py
from __future__ import annotations
from typing import Any, Dict, List, Optional, Tuple


def _normalize_row(row: Dict[str, Any]) -> Dict[str, Any]:
    status = (row.get("row_status") or "").upper().strip()
    if status not in {"OK", "CROSSED", "SUSPICIOUS"}:
        status = "SUSPICIOUS"

    return {
        "stt": row.get("stt"),
        "name": row.get("name"),
        "row_status": status,
        "agree": bool(row.get("agree")),
        "disagree": bool(row.get("disagree")),
    }


def _apply_row_logic(details: List[Dict[str, Any]]) -> Tuple[int, List[Dict[str, Any]]]:
    """
    Phiếu có dư:
    - OK        → agree = true
    - CROSSED   → disagree = true
    - SUSPICIOUS→ không tính
    """
    fixed = []
    agree_cnt = 0

    for r in details:
        rr = _normalize_row(r)
        status = rr["row_status"]

        if status == "OK":
            rr["agree"] = True
            rr["disagree"] = False
            agree_cnt += 1
        elif status == "CROSSED":
            rr["agree"] = False
            rr["disagree"] = True
        else:  # SUSPICIOUS
            rr["agree"] = False
            rr["disagree"] = False

        fixed.append(rr)

    return agree_cnt, fixed


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


def validate_co_du(
    raw_stage1: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Stage 2 – Hậu kiểm phiếu CÓ SỐ DƯ
    """

    raw = raw_stage1.get("raw", raw_stage1)
    ballot_id = raw.get("ballot_id")

    details = _extract_details(raw)
    handwritten = bool(raw.get("handwritten_marks"))

    reasons = set()

    agree_cnt, fixed_details = _apply_row_logic(details)

    # ===== LUẬT INVALID =====
    if agree_cnt == 0:
        reasons.add("NO_SELECTION")

    if handwritten:
        reasons.add("HANDWRITTEN_MARKS")

    validity = "VALID" if not reasons else "INVALID"

    return {
        "ballot_id": ballot_id,
        "ballot_type": "co_du",
        "validity": validity,
        "invalid_reasons": sorted(reasons),
        "ballot_details": fixed_details,
        "agree_count": agree_cnt,
    }