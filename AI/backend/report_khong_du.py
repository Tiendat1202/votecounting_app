# backend/report_khong_du.py
from typing import Dict, List, Any
from collections import defaultdict


def build_khong_du_report(
    validated_ballots: List[Dict[str, Any]],
    seats_n: int,
) -> Dict[str, Any]:
    """
    Stage 3 – Báo cáo tổng hợp PHIẾU KHÔNG CÓ SỐ DƯ (TÍN NHIỆM)
    """

    total_issued = len(validated_ballots)
    total_received = len(validated_ballots)

    valid_ballots = [b for b in validated_ballots if b["validity"] == "VALID"]
    invalid_ballots = [b for b in validated_ballots if b["validity"] == "INVALID"]

    total_valid = len(valid_ballots)

    agree_counter = defaultdict(int)

    for ballot in valid_ballots:
        for row in ballot.get("ballot_details", []):
            agree = row.get("agree")
            disagree = row.get("disagree")

            # DOUBLE_MARK → không cộng cho người đó
            if agree and disagree:
                continue

            if agree:
                name = row.get("name")
                if isinstance(name, str):
                    agree_counter[name] += 1

    # thống kê %
    stats = []
    for name, cnt in agree_counter.items():
        percent = cnt / total_valid if total_valid > 0 else 0
        stats.append({
            "name": name,
            "agree_votes": cnt,
            "agree_percent": round(percent * 100, 2),
        })

    # chỉ lấy người > 50%
    passed = [s for s in stats if s["agree_percent"] > 50.0]

    # sắp xếp giảm dần
    passed_sorted = sorted(
        passed,
        key=lambda x: x["agree_votes"],
        reverse=True,
    )

    winners = passed_sorted[:seats_n]

    return {
        "ballot_type": "khong_du",
        "summary": {
            "total_ballots_issued": total_issued,
            "total_ballots_received": total_received,
            "valid_ballots": total_valid,
            "invalid_ballots": len(invalid_ballots),
        },
        "winners": winners,
        "candidate_statistics": stats,
    }