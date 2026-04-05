# backend/validator_khong_du.py
from __future__ import annotations

from typing import Any, Dict, List, Tuple


def _normalize_row(row: Dict[str, Any]) -> Dict[str, Any]:
    status = (row.get("row_status") or "").upper().strip()
    if status not in {"OK", "DOUBLE_MARK", "EMPTY"}:
        status = "EMPTY"

    agree = bool(row.get("agree"))
    disagree = bool(row.get("disagree"))

    # Đồng bộ lại theo agree/disagree để tránh AI trả lệch row_status
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


def _analyze(details: List[Dict[str, Any]]) -> Tuple[int, int, int, int, List[Dict[str, Any]]]:
    """
    Trả về:
    - agree_valid_cnt: số hàng agree hợp lệ (agree=true, disagree=false)
    - disagree_only_cnt: số hàng disagree-only
    - double_mark_cnt: số hàng DOUBLE_MARK
    - empty_cnt: số hàng EMPTY
    - fixed_details
    """
    agree_valid_cnt = 0
    disagree_only_cnt = 0
    double_mark_cnt = 0
    empty_cnt = 0
    fixed = []

    for r in details:
        rr = _normalize_row(r)
        rs = rr["row_status"]

        if rs == "OK":
            if rr["agree"] and not rr["disagree"]:
                agree_valid_cnt += 1
            elif rr["disagree"] and not rr["agree"]:
                disagree_only_cnt += 1
        elif rs == "DOUBLE_MARK":
            double_mark_cnt += 1
        elif rs == "EMPTY":
            empty_cnt += 1

        fixed.append(rr)

    return agree_valid_cnt, disagree_only_cnt, double_mark_cnt, empty_cnt, fixed


def validate_khong_du(raw_stage1: Dict[str, Any]) -> Dict[str, Any]:
    """
    Hậu kiểm phiếu KHÔNG DƯ / TÍN NHIỆM

    Luật:
    - Phiếu 1 người:
      Hợp lệ nếu có đúng 1 lựa chọn (agree xor disagree)
      Không hợp lệ nếu DOUBLE_MARK hoặc EMPTY

    - Phiếu nhiều người:
      Hợp lệ nếu có ít nhất 1 hàng agree=true và disagree=false
      Không hợp lệ nếu:
        + không có ai agree=true
        + toàn bộ danh sách đều disagree=true
        + tất cả đều empty
    - DOUBLE_MARK ở một số người KHÔNG làm phiếu invalid,
      chỉ không tính kết quả cho người đó.
    - Có handwritten_marks hoặc tampering_marks => invalid
    """

    raw = raw_stage1.get("raw", raw_stage1)
    ballot_id = raw.get("ballot_id")

    details = raw.get("ballot_details") or []
    extra_names = raw.get("extra_names") or []
    handwritten_marks = bool(raw.get("handwritten_marks"))
    tampering_marks = bool(raw.get("tampering_marks"))

    reasons = set()

    agree_valid_cnt, disagree_only_cnt, double_mark_cnt, empty_cnt, fixed_details = _analyze(details)
    total_rows = len(fixed_details)

    # Không có hàng nào
    if total_rows == 0:
        reasons.add("NO_ROWS_DETECTED")

    # Phiếu 1 người
    if total_rows == 1:
        rs = fixed_details[0]["row_status"]
        if rs in {"DOUBLE_MARK", "EMPTY"}:
            reasons.add("INVALID_SINGLE_CANDIDATE_MARKING")

    # Phiếu nhiều người
    if total_rows >= 2:
        # không có ai agree=true và disagree=false
        if agree_valid_cnt == 0:
            reasons.add("NO_VALID_APPROVAL_ROW")

        # tất cả đều disagree=true (và không có agree-valid)
        if disagree_only_cnt == total_rows:
            reasons.add("ALL_DISAGREE")

        # tất cả đều empty
        if empty_cnt == total_rows:
            reasons.add("ALL_EMPTY")

    # extra_names cũng coi là thêm tên ngoài danh sách
    if extra_names:
        reasons.add("EXTRA_NAMES_PRESENT")

    if handwritten_marks:
        reasons.add("HANDWRITTEN_MARKS_PRESENT")

    if tampering_marks:
        reasons.add("TAMPERING_MARKS_PRESENT")

    validity = "VALID" if len(reasons) == 0 else "INVALID"

    return {
        "ballot_id": ballot_id,
        "ballot_type": "khong_du",
        "validity": validity,
        "invalid_reasons": sorted(reasons),
        "ballot_details": fixed_details,
        "extra_names": extra_names,
        "handwritten_marks": handwritten_marks,
        "tampering_marks": tampering_marks,
        "agree_valid_count": agree_valid_cnt,
        "disagree_only_count": disagree_only_cnt,
        "double_mark_count": double_mark_cnt,
        "empty_count": empty_cnt,
    }