"""Output validator ensuring AI-generated action plans obey StudentPulse constraints."""

import json
import re
from typing import Any, Dict, List, Tuple
from python.schemas import EvidenceSnapshotInput, READINESS_DISCLAIMER


def _strip_fences(raw: str) -> str:
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    return cleaned.strip()


def validate_ai_plan_output(
    raw_output: str | Dict[str, Any],
    evidence: EvidenceSnapshotInput,
    metrics: Dict[str, Any],
) -> Tuple[bool, Dict[str, Any] | None, List[str]]:
    """
    Validate Gemini JSON against hard study-hour limits, required fields,
    action steps, and interview questions.
    """
    issues: List[str] = []

    if isinstance(raw_output, dict):
        data = raw_output
    elif isinstance(raw_output, str):
        try:
            data = json.loads(_strip_fences(raw_output))
        except Exception:
            return False, None, ["AI response was not valid JSON."]
    else:
        return False, None, ["AI response had an unsupported type."]

    if not isinstance(data, dict):
        return False, None, ["AI response JSON must be an object."]

    title = data.get("title")
    explanation = data.get("explanation") or data.get("readiness_summary")
    total_hours = data.get("total_hours")
    steps = data.get("action_steps")
    questions = data.get("interview_questions")

    if not isinstance(title, str) or len(title.strip()) < 4:
        issues.append("Missing or invalid action plan title.")
    if not isinstance(explanation, str) or len(explanation.strip()) < 10:
        issues.append("Missing or invalid readiness explanation.")

    if isinstance(total_hours, bool) or not isinstance(total_hours, (int, float)):
        issues.append("Missing or invalid total_hours.")
        hours_int = 0
    else:
        hours_int = int(round(total_hours))
        if hours_int <= 0 or hours_int > evidence.weekly_study_hours:
            issues.append(
                f"AI total_hours ({hours_int} hrs) exceeds weekly_study_hours ({evidence.weekly_study_hours} hrs)."
            )

    if not isinstance(steps, list) or len(steps) < 2:
        issues.append("Action plan must contain at least 2 structured action steps.")
        return False, None, issues

    sanitized_steps: List[Dict[str, Any]] = []
    sum_hours = 0
    for idx, st in enumerate(steps):
        if not isinstance(st, dict):
            issues.append(f"Action step #{idx + 1} is malformed.")
            continue
        st_title = str(st.get("title", "")).strip()
        st_skill = str(st.get("focus_skill", "Core Skill")).strip()
        st_cat = str(st.get("category", "Action Item")).strip()
        st_deliv = str(st.get("deliverable", "")).strip()
        st_rat = str(st.get("rationale", "")).strip()
        raw_h = st.get("hours")
        st_hours = (
            max(1, int(round(raw_h)))
            if isinstance(raw_h, (int, float)) and not isinstance(raw_h, bool)
            else 2
        )
        if not st_title or not st_deliv:
            issues.append(f"Action step #{idx + 1} is missing title or deliverable.")
            continue
        sum_hours += st_hours
        sanitized_steps.append(
            {
                "title": st_title[:100],
                "hours": st_hours,
                "focus_skill": st_skill[:50],
                "category": st_cat[:40],
                "deliverable": st_deliv[:200],
                "rationale": st_rat[:200] or "Directly targets role readiness gaps.",
                "completed": False,
            }
        )

    if sum_hours > evidence.weekly_study_hours:
        issues.append(
            f"Combined action hours ({sum_hours} hrs) exceed weekly study limit ({evidence.weekly_study_hours} hrs)."
        )

    sanitized_questions: List[Dict[str, str]] = []
    if isinstance(questions, list):
        for q in questions[:4]:
            if isinstance(q, dict) and q.get("question"):
                sanitized_questions.append(
                    {
                        "question": str(q.get("question", "")).strip()[:240],
                        "topic": str(q.get("topic", "Technical & Project")).strip()[:60],
                        "hint": str(q.get("hint", "Relate your answer to concrete project evidence.")).strip()[:220],
                    }
                )

    if len(sanitized_questions) < 2:
        issues.append("Action plan must include at least 2 role-specific interview questions.")

    if issues or len(sanitized_steps) < 2:
        return False, None, issues or ["Insufficient valid action steps remained."]

    sanitized = {
        "title": str(title).strip()[:110],
        "total_hours": min(hours_int, evidence.weekly_study_hours),
        "readiness_summary": str(explanation).strip()[:400],
        "action_steps": sanitized_steps,
        "interview_questions": sanitized_questions,
        "explanation": str(explanation).strip()[:400],
        "safety_note": READINESS_DISCLAIMER,
        "source": "gemini_ai_hybrid",
        "metrics": metrics,
    }
    return True, sanitized, []
