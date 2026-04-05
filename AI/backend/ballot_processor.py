"""
Ballot processor dùng pipeline mới:

Stage 1:
- AI/ai/khong_du.py
- AI/ai/co_du.py

Stage 2:
- AI/backend/validator_khong_du.py
- AI/backend/validator_co_du.py

Mục tiêu:
- Tương thích với ai_backend.py hiện tại
- Tương thích tương đối với frontend/backend hiện tại
- Trả về kết quả đã hậu kiểm + metadata cho UI
"""

from __future__ import annotations

import os
from typing import Dict, Any, List

AI_PROCESSOR = os.getenv("AI_PROCESSOR", "mock")


def _normalize_ballot_type(ballot_type: str) -> str:
    bt = (ballot_type or "").strip().lower()
    if bt in {"trust", "khong_du", "tin_nhiem"}:
        return "khong_du"
    if bt in {"surplus", "co_du", "so_du"}:
        return "co_du"
    return bt


def _extract_selected_names(ballot_type: str, validated_result: Dict[str, Any]) -> List[str]:
    """
    Rút danh sách ứng viên được tính là 'được bầu / đồng ý'
    từ kết quả đã qua validator.
    """
    bt = _normalize_ballot_type(ballot_type)
    details = validated_result.get("ballot_details", []) or []

    names: List[str] = []

    if bt == "khong_du":
        for row in details:
            name = row.get("name")
            agree = bool(row.get("agree"))
            disagree = bool(row.get("disagree"))

            # Chỉ tính agree hợp lệ
            if isinstance(name, str) and name.strip() and agree and not disagree:
                names.append(name)

    elif bt == "co_du":
        for row in details:
            name = row.get("name")
            agree = bool(row.get("agree"))
            disagree = bool(row.get("disagree"))

            if isinstance(name, str) and name.strip() and agree and not disagree:
                names.append(name)

    return names


def _build_response(
    ballot_type: str,
    processor_name: str,
    validated_result: Dict[str, Any],
    candidate_names: List[str],
) -> Dict[str, Any]:
    """
    Chuẩn hoá output để tương thích với app hiện tại.
    """
    candidate_name = ", ".join(candidate_names) if candidate_names else "Unknown"

    return {
        # Legacy-compatible fields
        "candidate_name": candidate_name,
        "selected_candidate": candidate_name,
        "confidence": 0.95 if validated_result.get("validity") == "VALID" else 0.7,

        # Core metadata
        "ballot_id": validated_result.get("ballot_id"),
        "ballot_type": _normalize_ballot_type(ballot_type),
        "processor": processor_name,
        "status": "success",
        "error_message": None,

        # Final validated result
        "validity": validated_result.get("validity"),
        "invalid_reasons": validated_result.get("invalid_reasons", []),

        # Frontend/backend dễ dùng hơn
        "ballot_details": validated_result.get("ballot_details", []),
        "full_analysis": validated_result,
    }


def process_ballot(
    file_path: str,
    ballot_type: str,
    batch_id: str,
    job_id: str,
) -> Dict[str, Any]:
    """
    Entry point được ai_backend.py gọi.

    Args:
        file_path: path ảnh phiếu
        ballot_type: trust/surplus hoặc khong_du/co_du
        batch_id: id batch
        job_id: id job

    Returns:
        dict theo format app hiện tại đang dùng
    """
    bt = _normalize_ballot_type(ballot_type)

    try:
        if AI_PROCESSOR == "qwen":
            return process_ballot_qwen(file_path, bt, batch_id, job_id)
        elif AI_PROCESSOR == "mock":
            return process_ballot_mock(file_path, bt, batch_id, job_id)
        else:
            return {
                "candidate_name": "Unknown",
                "selected_candidate": "Unknown",
                "confidence": 0.0,
                "ballot_id": job_id,
                "ballot_type": bt,
                "processor": AI_PROCESSOR,
                "status": "error",
                "error_message": f"Unsupported AI_PROCESSOR: {AI_PROCESSOR}",
                "validity": "INVALID",
                "invalid_reasons": ["UNSUPPORTED_AI_PROCESSOR"],
                "ballot_details": [],
                "full_analysis": {},
            }

    except Exception as e:
        return {
            "candidate_name": "Unknown",
            "selected_candidate": "Unknown",
            "confidence": 0.0,
            "ballot_id": job_id,
            "ballot_type": bt,
            "processor": AI_PROCESSOR,
            "status": "error",
            "error_message": str(e),
            "validity": "INVALID",
            "invalid_reasons": ["PROCESSING_ERROR"],
            "ballot_details": [],
            "full_analysis": {},
        }


# ============================================================================
# MOCK PROCESSOR
# ============================================================================

def process_ballot_mock(
    file_path: str,
    ballot_type: str,
    batch_id: str,
    job_id: str,
) -> Dict[str, Any]:
    """
    Mock processor để test UI/pipeline.
    """
    bt = _normalize_ballot_type(ballot_type)

    if bt == "khong_du":
        validated = {
            "ballot_id": job_id,
            "ballot_type": "khong_du",
            "validity": "VALID",
            "invalid_reasons": [],
            "ballot_details": [
                {"stt": 1, "name": "Candidate A", "agree": True, "disagree": False, "row_status": "OK"},
                {"stt": 2, "name": "Candidate B", "agree": False, "disagree": True, "row_status": "OK"},
                {"stt": 3, "name": "Candidate C", "agree": False, "disagree": False, "row_status": "EMPTY"},
            ],
            "extra_names": [],
            "handwritten_marks": False,
            "tampering_marks": False,
        }
    else:
        validated = {
            "ballot_id": job_id,
            "ballot_type": "co_du",
            "validity": "VALID",
            "invalid_reasons": [],
            "ballot_details": [
                {"stt": 1, "name": "Candidate A", "agree": True, "disagree": False, "row_status": "OK"},
                {"stt": 2, "name": "Candidate B", "agree": False, "disagree": True, "row_status": "CROSSED"},
                {"stt": 3, "name": "Candidate C", "agree": True, "disagree": False, "row_status": "OK"},
            ],
            "extra_names": [],
            "handwritten_marks": False,
            "tampering_marks": False,
            "seats": 2,
        }

    selected_names = _extract_selected_names(bt, validated)
    result = _build_response(bt, "mock", validated, selected_names)
    return result


# ============================================================================
# QWEN PROCESSOR - PIPELINE MỚI
# ============================================================================

def process_ballot_qwen(
    file_path: str,
    ballot_type: str,
    batch_id: str,
    job_id: str,
) -> Dict[str, Any]:
    """
    Processor thật:
    - Stage 1: AI đọc raw
    - Stage 2: Validator hậu kiểm
    """
    bt = _normalize_ballot_type(ballot_type)

    if bt == "khong_du":
        from ai.khong_du import process_khong_du_raw
        from backend.validator_khong_du import validate_khong_du

        raw_stage1 = process_khong_du_raw(
            image_path=file_path,
            ballot_id=job_id,
            prompt_version=1,
        )

        validated = validate_khong_du(raw_stage1)
        selected_names = _extract_selected_names(bt, validated)
        return _build_response(bt, "qwen", validated, selected_names)

    elif bt == "co_du":
        from ai.co_du import process_co_du_raw
        from backend.validator_co_du import validate_co_du

        # TODO: nếu sau này seats_n lấy từ session/backend thì truyền từ ai_backend.py xuống
        seats_n = _infer_seats_from_env(default_value=1)

        raw_stage1 = process_co_du_raw(
            image_path=file_path,
            ballot_id=job_id,
            prompt_version=1,
        )

        validated = validate_co_du(
            raw_stage1=raw_stage1,
            seats_n=seats_n,
            candidate_list=None,
        )

        selected_names = _extract_selected_names(bt, validated)
        return _build_response(bt, "qwen", validated, selected_names)

    else:
        return {
            "candidate_name": "Unknown",
            "selected_candidate": "Unknown",
            "confidence": 0.0,
            "ballot_id": job_id,
            "ballot_type": bt,
            "processor": "qwen",
            "status": "error",
            "error_message": f"Unsupported ballot_type: {ballot_type}",
            "validity": "INVALID",
            "invalid_reasons": ["UNSUPPORTED_BALLOT_TYPE"],
            "ballot_details": [],
            "full_analysis": {},
        }


def _infer_seats_from_env(default_value: int = 1) -> int:
    """
    Tạm thời lấy số lượng cần bầu từ env nếu có.
    Nếu không có thì fallback về default_value.

    Bạn có thể set:
        export DEFAULT_SURPLUS_SEATS=5
    """
    try:
        return int(os.getenv("DEFAULT_SURPLUS_SEATS", str(default_value)))
    except Exception:
        return default_value