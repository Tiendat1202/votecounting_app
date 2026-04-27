"""Compatibility wrapper.

Deprecated as a primary processor. Runtime source of truth is `AI/backend/ballot_processor.py`.
This module forwards calls to router `process_ballot` for backward compatibility.
"""

from __future__ import annotations

from typing import Dict
import importlib.util
from pathlib import Path


def process_ballot(tmp_path: str, ballot_type: str, batch_name: str, filename: str) -> Dict:
    try:
        from .ballot_processor import process_ballot as router_process_ballot
        return router_process_ballot(tmp_path, ballot_type, batch_name, filename)
    except Exception:
        # support direct file import context (no package)
        router_file = Path(__file__).resolve().parent / "ballot_processor.py"
        spec = importlib.util.spec_from_file_location("runtime_router_processor", str(router_file))
        if spec and spec.loader:
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            router_process_ballot = getattr(module, "process_ballot")
            return router_process_ballot(tmp_path, ballot_type, batch_name, filename)
        raise RuntimeError("router_processor_load_failed")

