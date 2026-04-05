# backend/validator_co_du.py
from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple


def _normalize_row(row: Dict[str, Any]) -> Dict[str, Any]:
    status = (row.get("row_status") or "").upper().strip()
    if status not in {"OK", "CROSSED", "SUSPICIOUS"}:
        status = "SUSPICIOUS"

    stt = row.get("stt")
    name = row.get("name")

    agree = bool(row.get("agree"))
    disagree = bool(row.get("disagree"))

    return {
        "stt": stt if isinstance(stt, int) else stt,
        "name": name if isinstance(name, str) else name,
        "agree": agree,
        "disagree": disagree,
        "row_status": status,
    }


def _apply_selected_logic(details: List[Dict[str, Any]]) -> Tuple[int, int, List[Dict[str, Any]]]:
    """
    Với phiếu có dư:
    - OK => agree=true
    - CROSSED => disagree=true
    - SUSPICIOUS => không tính

    Trả về:
    - agree_cnt
    - suspicious_cnt
    - fixed_details
    """
    fixed = []
    agree_cnt = 0
    suspicious_cnt = 0

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
        else:
            rr["agree"] = False
            rr["disagree"] = False
            suspicious_cnt += 1

        fixed.append(rr)

    return agree_cnt, suspicious_cnt, fixed


def validate_co_du(
    raw_stage1: Dict[str, Any],
    seats_n: int,
    candidate_list: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Hậu kiểm phiếu CÓ DƯ

    Luật:
    - Hợp lệ nếu 1 <= x <= n, với x là số agree=true
    - Invalid nếu:
      + x = 0
      + x > n
      + có extra_names / tên ngoài danh sách
      + có handwritten_marks
      + có tampering_marks
    """
    if seats_n <= 0:
        raise ValueError("seats_n must be > 0")

    raw = raw_stage1.get("raw", raw_stage1)
    ballot_id = raw.get("ballot_id")

    details = raw.get("ballot_details") or []
    extra_names = raw.get("extra_names") or []
    handwritten_marks = bool(raw.get("handwritten_marks"))
    tampering_marks = bool(raw.get("tampering_marks"))

    reasons = set()

    agree_cnt, suspicious_cnt, fixed_details = _apply_selected_logic(details)

    if agree_cnt == 0:
        reasons.add("NO_SELECTION")

    if agree_cnt > seats_n:
        reasons.add("OVER_SEATS")

    if candidate_list:
        allowed = set(candidate_list)
        for r in fixed_details:
            nm = r.get("name")
            if isinstance(nm, str) and nm.strip() and nm not in allowed:
                reasons.add("NAME_OUT_OF_LIST")
                break

    if extra_names:
        reasons.add("EXTRA_NAMES_PRESENT")

    if handwritten_marks:
        reasons.add("HANDWRITTEN_MARKS_PRESENT")

    if tampering_marks:
        reasons.add("TAMPERING_MARKS_PRESENT")

    validity = "VALID" if len(reasons) == 0 else "INVALID"

    return {
        "ballot_id": ballot_id,
        "ballot_type": "co_du",
        "seats": seats_n,
        "validity": validity,
        "invalid_reasons": sorted(reasons),
        "ballot_details": fixed_details,
        "extra_names": extra_names,
        "handwritten_marks": handwritten_marks,
        "tampering_marks": tampering_marks,
        "agree_count": agree_cnt,
        "suspicious_count": suspicious_cnt,
    }