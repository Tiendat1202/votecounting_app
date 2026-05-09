# backend/report_co_du.py
from typing import Dict, List, Any
from collections import defaultdict


def build_co_du_report(
    validated_ballots: List[Dict[str, Any]],
    seats_n: int,
) -> Dict[str, Any]:
    """
    Stage 3 – Báo cáo tổng hợp PHIẾU CÓ DƯ
    """

    total_issued = len(validated_ballots)
    total_received = len(validated_ballots)

    valid_ballots = [b for b in validated_ballots if b["validity"] == "VALID"]
    invalid_ballots = [b for b in validated_ballots if b["validity"] == "INVALID"]

    vote_counter = defaultdict(int)

    for ballot in valid_ballots:
        for row in ballot.get("ballot_details", []):
            if row.get("agree") is True:
                name = row.get("name")
                if isinstance(name, str):
                    vote_counter[name] += 1

    # sắp xếp theo số phiếu giảm dần
    sorted_candidates = sorted(
        vote_counter.items(),
        key=lambda x: x[1],
        reverse=True,
    )

    winners = [
        {"name": name, "agree_votes": cnt}
        for name, cnt in sorted_candidates[:seats_n]
    ]

    return {
        "ballot_type": "co_du",
        "summary": {
            "total_ballots_issued": total_issued,
            "total_ballots_received": total_received,
            "valid_ballots": len(valid_ballots),
            "invalid_ballots": len(invalid_ballots),
        },
        "winners": winners,
        "vote_distribution": [
            {"name": name, "agree_votes": cnt}
            for name, cnt in sorted_candidates
        ],
    }