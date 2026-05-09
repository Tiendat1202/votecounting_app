"""Runtime ballot processor router.

This is the single entry-point used by ai_backend.py.

Responsibilities:
- Choose the correct prompt file by ballot_type
  trust   -> ai.khong_du.PROMPT
  surplus -> ai.co_du.PROMPT
- Send the image + prompt to Together AI
- Parse the model response and return structured JSON

NOT responsible for:
- Deciding final ballot validity (that is voteService.ts)
- Prompt authorship (prompts live in ai/khong_du.py and ai/co_du.py)
"""
from __future__ import annotations

import base64
import mimetypes
import os
import re
import tempfile
import traceback
from typing import Any, Dict, Optional

from PIL import Image

DEFAULT_MODEL_ID = "Qwen/Qwen3.5-397B-A17B"


def _get_model_id() -> str:
    # Prefer newer env naming used by this repo's .env.
    model = (
        os.getenv("TOGETHER_MODEL_ID")
        or os.getenv("MODEL")
        or DEFAULT_MODEL_ID
    )
    return str(model).strip() or DEFAULT_MODEL_ID


def _get_together_base_url() -> Optional[str]:
    # Optional override for dedicated endpoints / non-default Together gateways.
    base_url = (
        os.getenv("TOGETHER_MODEL_ENDPOINT")
        or os.getenv("TOGETHER_BASE_URL")
        or os.getenv("TOGETHER_API_BASE")
        or ""
    )
    base_url = str(base_url).strip()
    return base_url or None


def _extract_first_json_object(text: str) -> Optional[Dict[str, Any]]:
    import json

    src = str(text or "")
    start = src.find("{")
    if start == -1:
        return None
    depth = 0
    for i in range(start, len(src)):
        ch = src[i]
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                candidate = src[start : i + 1]
                try:
                    obj = json.loads(candidate)
                    return obj if isinstance(obj, dict) else None
                except Exception:
                    continue
    return None


def _strip_fences(text: str) -> str:
    s = str(text or "").strip()
    # Remove ```json ... ``` fences if present
    if s.startswith("```"):
        s = re.sub(r"^```[a-zA-Z0-9_-]*\n", "", s)
        s = re.sub(r"\n```$", "", s)
    return s.strip()


def _try_parse_json_object(text: str) -> Optional[Dict[str, Any]]:
    import json

    s = _strip_fences(text)
    if not s:
        return None
    try:
        obj = json.loads(s)
        return obj if isinstance(obj, dict) else None
    except Exception:
        return _extract_first_json_object(s)


def _extract_message_parts(response: Any):
    content_text = None
    reasoning_text = None
    try:
        choices = getattr(response, "choices", None)
        if choices and len(choices) > 0:
            msg = getattr(choices[0], "message", None)
            if msg is not None:
                c = getattr(msg, "content", None)
                r = getattr(msg, "reasoning", None)
                if isinstance(c, str) and c.strip():
                    content_text = c.strip()
                if isinstance(r, str) and r.strip():
                    reasoning_text = r.strip()
    except Exception:
        pass
    return content_text, reasoning_text


def _parse_reasoning_fallback(reasoning_text: str) -> Optional[Dict[str, Any]]:
    """When a thinking model outputs only reasoning (no JSON content),
    parse the step-by-step Row analysis to reconstruct ballot_details."""
    if not reasoning_text:
        return None

    # Match patterns like:
    # **Row 4:**
    #   * Name: ĐẶNG TIẾN ĐẠT
    #   * Agree: Has an 'X'.
    #   * Disagree: Empty.
    #   * Status: OK.
    details = []
    # Split by row marker
    row_blocks = re.split(r'\*\*Row\s+\d+:\*\*', reasoning_text)
    for block in row_blocks[1:]:  # skip everything before first row
        name_m = re.search(r'Name:\s*([^\n\*]+)', block)
        agree_m = re.search(r'Agree:\s*([^\n\*]+)', block)
        disagree_m = re.search(r'Disagree:\s*([^\n\*]+)', block)
        status_m = re.search(r'Status:\s*([^\n\.\*]+)', block)
        stt_m = re.search(r'STT:\s*(\d+)', block)

        if not name_m:
            continue

        name_raw = name_m.group(1).strip().rstrip('.,')
        # Strip parenthetical notes like "LÊ BÌNH Đẳng (looks like X or Y, ...)"
        name_raw = re.split(r'\s*\(', name_raw)[0].strip()

        agree_raw = (agree_m.group(1) if agree_m else "").lower()
        disagree_raw = (disagree_m.group(1) if disagree_m else "").lower()
        status_raw = (status_m.group(1) if status_m else "").strip().upper()

        agree = bool(re.search(r"has|x|tick|mark|check|v\b", agree_raw))
        disagree = bool(re.search(r"has|x|tick|mark|check|v\b", disagree_raw))

        if not status_raw:
            if agree and disagree:
                status_raw = "DOUBLE_MARK"
            elif agree:
                status_raw = "OK"
            elif disagree:
                status_raw = "NOT_OK"
            else:
                status_raw = "EMPTY"

        # status_raw may have parenthetical notes like "DOUBLE_MARK (both marked)"
        # Match the canonical prefix
        if status_raw.startswith("DOUBLE_MARK"):
            row_status = "DOUBLE_MARK"
        elif status_raw.startswith("EMPTY"):
            row_status = "EMPTY"
        elif status_raw.startswith("NOT_OK"):
            row_status = "NOT_OK"
        elif status_raw.startswith("OK"):
            row_status = "OK"
        elif agree and disagree:
            row_status = "DOUBLE_MARK"
        elif agree:
            row_status = "OK"
        elif disagree:
            row_status = "NOT_OK"
        else:
            row_status = "EMPTY"

        details.append({
            "stt": int(stt_m.group(1)) if stt_m else len(details) + 1,
            "name": name_raw,
            "agree": agree,
            "disagree": disagree,
            "row_status": row_status,
        })

    if not details:
        return None

    return {"ballot_id": None, "ballot_details": details, "_source": "reasoning_fallback"}


def _to_data_uri(image_path: str) -> str:
    with Image.open(image_path) as img:
        rgb = img.convert("RGB")
        with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as tmp:
            temp_jpg = tmp.name
        rgb.save(temp_jpg, format="JPEG", quality=95, optimize=True)

    with open(temp_jpg, "rb") as f:
        encoded = base64.b64encode(f.read()).decode("ascii")
    try:
        os.unlink(temp_jpg)
    except Exception:
        pass

    mime_type, _ = mimetypes.guess_type("image.jpg")
    mime_type = mime_type or "image/jpeg"
    return f"data:{mime_type};base64,{encoded}"


def process_ballot(tmp_path: str, ballot_type: str, batch_name: str, filename: str, official_candidates: list = None) -> Dict[str, Any]:
    """Main entry used by ai_backend.py.

    Args:
        tmp_path:   absolute path to the uploaded image file
        ballot_type: "trust" or "surplus"
        batch_name: opaque batch/job id used as fallback ballot_id
        filename:   original filename (for logging)
        official_candidates: optional list of official candidate names for the session
    """
    try:
        from together import Together

        if ballot_type == "trust":
            from ai.khong_du import PROMPT as SYSTEM_PROMPT
        elif ballot_type == "surplus":
            from ai.co_du import PROMPT as SYSTEM_PROMPT
        else:
            return {
                "candidate_name": None,
                "confidence": 0.0,
                "ballot_id": batch_name,
                "ballot_type": ballot_type,
                "processor": "router",
                "status": "error",
                "error_message": f"unsupported_ballot_type:{ballot_type}",
                "full_analysis": {"parse_error": "unsupported_ballot_type"},
                "message_content": None,
                "message_reasoning": None,
            }

        api_key = os.getenv("TOGETHER_API_KEY", "").strip()
        if not api_key:
            raise RuntimeError("missing_together_api_key")

        # Inject candidate list into prompt
        if official_candidates:
            candidate_list_str = "\n".join(f"- {name}" for name in official_candidates)
        else:
            candidate_list_str = "Không có danh sách"
        SYSTEM_PROMPT = SYSTEM_PROMPT.replace("{candidate_list}", candidate_list_str)

        base_url = _get_together_base_url()
        try:
            client = Together(api_key=api_key, base_url=base_url) if base_url else Together(api_key=api_key)
        except TypeError:
            # Older together SDK may not accept base_url
            client = Together(api_key=api_key)

        model_id = _get_model_id()
        data_uri = _to_data_uri(tmp_path)

        # /no_think disables Qwen3 extended thinking mode so the model outputs
        # JSON directly instead of filling the entire token budget with reasoning.
        prompt_text = "/no_think Chi tra ve 1 JSON object theo dung schema. KHONG duoc co markdown, khong duoc co giai thich."
        try:
            response = client.chat.completions.create(
                model=model_id,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt_text},
                            {"type": "image_url", "image_url": {"url": data_uri}},
                        ],
                    },
                ],
                temperature=0.0,
                max_tokens=3500,
            )
        except Exception as exc:
            # Fallback only when the client/API doesn't accept response_format.
            msg = str(exc).lower()
            if "response_format" in msg or "unexpected" in msg or "unknown" in msg:
                response = client.chat.completions.create(
                    model=model_id,
                    messages=[
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {
                            "role": "user",
                            "content": [
                                {"type": "text", "text": prompt_text},
                                {"type": "image_url", "image_url": {"url": data_uri}},
                            ],
                        },
                    ],
                    temperature=0.0,
                    max_tokens=3500,
                )
            else:
                raise

        message_content, message_reasoning = _extract_message_parts(response)

        # Prefer content_text (the actual answer). Only fall back to reasoning_text
        # for JSON if content_text is absent (older SDK or thinking-disabled model).
        final_text = message_content or ""
        parsed = _try_parse_json_object(final_text) if final_text else None

        # If content produced no JSON, try reasoning fallback
        if not isinstance(parsed, dict) and message_reasoning:
            parsed = _try_parse_json_object(message_reasoning)

        # If still no JSON, try to reconstruct ballot_details from reasoning step-by-step text
        if not isinstance(parsed, dict) and message_reasoning:
            parsed = _parse_reasoning_fallback(message_reasoning)

        if not isinstance(parsed, dict):
            parsed = {"parse_error": "no_json_object_found", "raw_text": (message_content or message_reasoning or "")[:2000]}

        candidate_name = parsed.get("candidate_name") or parsed.get("selected_candidate")
        if isinstance(candidate_name, str) and candidate_name.strip().lower() == "unknown":
            candidate_name = None

        try:
            confidence = float(parsed.get("confidence", 0.0) or 0.0)
        except Exception:
            confidence = 0.0

        has_rows = isinstance(parsed.get("ballot_details"), list) or isinstance(parsed.get("candidates"), list)

        return {
            "candidate_name": candidate_name,
            "confidence": confidence,
            "ballot_id": parsed.get("ballot_id") or batch_name,
            "ballot_type": ballot_type,
            "processor": "router",
            "model": model_id,
            "status": "ok" if has_rows else "error",
            "error_message": None if has_rows else "row_data_not_recovered",
            "full_analysis": parsed,
            "message_content": message_content,
            "message_reasoning": message_reasoning,
        }

    except Exception as exc:
        return {
            "candidate_name": None,
            "confidence": 0.0,
            "ballot_id": batch_name,
            "ballot_type": ballot_type,
            "processor": "router",
            "model": _get_model_id(),
            "status": "error",
            "error_message": str(exc),
            "full_analysis": {
                "exception": str(exc),
                "traceback": traceback.format_exc(),
                "filename": filename,
            },
            "message_content": None,
            "message_reasoning": None,
        }
