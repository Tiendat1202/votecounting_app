# backend/report_co_du.py
from __future__ import annotations

from typing import Any, Dict, List, Optional
from collections import defaultdict


def build_co_du_report(
    validated_ballots: List[Dict[str, Any]],
    seats_n: int,
    total_issued: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Thống kê phiên bầu cho phiếu CÓ DƯ

    Quy tắc cộng phiếu:
    - Chỉ dùng phiếu VALID
    - Hàng agree=true => cộng 1 phiếu
    - Người trúng cử phải > 50% số phiếu hợp lệ
    - Nếu nhiều người >50%, lấy từ cao xuống thấp cho đủ seats_n
    """

    total_received = len(validated_ballots)
    if total_issued is None:
        total_issued = total_received

    valid_ballots = [b for b in validated_ballots if b.get("validity") == "VALID"]
    invalid_ballots = [b for b in validated_ballots if b.get("validity") == "INVALID"]

    total_valid = len(valid_ballots)

    agree_counter = defaultdict(int)
    disagree_counter = defaultdict(int)

    candidate_names = set()

    for ballot in validated_ballots:
        for row in ballot.get("ballot_details", []):
            name = row.get("name")
            if isinstance(name, str) and name.strip():
                candidate_names.add(name)

    for ballot in valid_ballots:
        for row in ballot.get("ballot_details", []):
            name = row.get("name")
            if not isinstance(name, str) or not name.strip():
                continue

            if row.get("agree") is True:
                agree_counter[name] += 1
            elif row.get("disagree") is True:
                disagree_counter[name] += 1

    candidate_statistics = []
    threshold_percent = 50.0

    for name in sorted(candidate_names):
        agree_votes = agree_counter[name]
        disagree_votes = disagree_counter[name]
        agree_percent = (agree_votes / total_valid * 100.0) if total_valid > 0 else 0.0

        candidate_statistics.append({
            "name": name,
            "agree_votes": agree_votes,
            "disagree_votes": disagree_votes,
            "agree_percent": round(agree_percent, 2),
        })

    passed = [c for c in candidate_statistics if c["agree_percent"] > threshold_percent]
    passed_sorted = sorted(
        passed,
        key=lambda x: (x["agree_votes"], -x["disagree_votes"], x["name"]),
        reverse=True,
    )

    winners = passed_sorted[:seats_n]

    return {
        "ballot_type": "co_du",
        "summary": {
            "total_ballots_issued": total_issued,
            "total_ballots_received": total_received,
            "valid_ballots": len(valid_ballots),
            "invalid_ballots": len(invalid_ballots),
        },
        "threshold": {
            "type": "VALID_BALLOTS_OVER_50_PERCENT",
            "valid_ballots_base": total_valid,
            "required_percent": 50.0,
        },
        "winners": winners,
        "candidate_statistics": sorted(
            candidate_statistics,
            key=lambda x: (x["agree_votes"], -x["disagree_votes"], x["name"]),
            reverse=True,
        ),
    }