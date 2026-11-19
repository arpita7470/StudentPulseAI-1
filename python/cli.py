"""JSON CLI bridge invoked by Express server for StudentPulse AI Python logic."""

import json
import sys
from typing import Any, Dict

from python import database
from python.schemas import EvidenceSnapshotInput
from python.validator import (
    ValidationError,
    validate_profile,
    validate_evidence_snapshot,
    validate_completion,
    validate_project,
)
from python.prompt_builder import build_readiness_prompt
from python.output_validator import validate_ai_plan_output
from python.recommender import (
    compute_readiness_metrics,
    compare_roles_for_student,
    build_fallback_plan,
    get_alternative_tasks,
    modify_action_plan,
    evaluate_interview_answer_fallback,
)


def _read_stdin_json() -> Dict[str, Any]:
    raw = sys.stdin.read().strip()
    if not raw:
        return {}
    return json.loads(raw)


def _respond(ok: bool, data: Any = None, error: str | None = None, field_errors: Dict[str, str] | None = None) -> None:
    payload: Dict[str, Any] = {"ok": ok}
    if data is not None:
        payload["data"] = data
    if error is not None:
        payload["error"] = error
    if field_errors:
        payload["field_errors"] = field_errors
    print(json.dumps(payload))


def main() -> None:
    if len(sys.argv) < 2:
        _respond(False, error="Missing command argument.")
        sys.exit(1)

    cmd = sys.argv[1]
    try:
        payload = _read_stdin_json()

        if cmd == "init":
            database.init_db()
            _respond(True, {"initialized": True})

        elif cmd == "list_profiles":
            _respond(True, {"profiles": database.list_profiles()})

        elif cmd == "create_profile":
            prof = validate_profile(payload)
            created = database.create_profile(
                prof.display_name, prof.target_role, prof.semester, prof.cgpa
            )
            _respond(True, {"profile": created})

        elif cmd == "update_profile":
            user_id = payload.get("user_id")
            if not isinstance(user_id, int) or user_id <= 0:
                raise ValidationError("Valid user_id is required.", {"user_id": "Invalid profile ID."})
            prof = validate_profile(payload)
            updated = database.update_profile(
                user_id, prof.display_name, prof.target_role, prof.semester, prof.cgpa
            )
            if not updated:
                _respond(False, error="Student profile not found.")
                return
            _respond(True, {"profile": updated})

        elif cmd == "list_projects":
            user_id = int(payload["user_id"])
            _respond(True, {"projects": database.list_projects(user_id)})

        elif cmd == "create_project":
            proj = validate_project(payload)
            created = database.create_project(**proj)
            _respond(True, {"project": created})

        elif cmd == "delete_project":
            project_id = int(payload["project_id"])
            deleted = database.delete_project(project_id)
            if not deleted:
                _respond(False, error="Project not found.")
                return
            _respond(True, {"deleted": True})

        elif cmd == "prepare_plan":
            ev = validate_evidence_snapshot(payload)
            profile = database.get_profile(ev.user_id)
            if not profile:
                raise ValidationError("Selected student profile not found.", {"user_id": "Profile does not exist."})

            metrics = compute_readiness_metrics(ev, profile["target_role"], profile["cgpa"])
            role_comparison = compare_roles_for_student(ev, profile["cgpa"])
            snapshot_id = database.save_evidence_snapshot(
                ev.user_id,
                ev.weekly_study_hours,
                ev.assessment_score,
                ev.coding_score,
                ev.project_count,
                ev.project_level,
                ev.interview_score,
                ev.interview_prep_level,
                ev.verified_skills,
                ev.certifications_count,
                metrics["overall_score"],
                metrics["skill_gaps"],
            )
            prompt_bundle = build_readiness_prompt(ev, profile["target_role"], metrics)
            _respond(
                True,
                {
                    "snapshot_id": snapshot_id,
                    "target_role": profile["target_role"],
                    "metrics": metrics,
                    "role_comparison": role_comparison,
                    "evidence": {
                        "user_id": ev.user_id,
                        "weekly_study_hours": ev.weekly_study_hours,
                        "assessment_score": ev.assessment_score,
                        "coding_score": ev.coding_score,
                        "project_count": ev.project_count,
                        "project_level": ev.project_level,
                        "interview_score": ev.interview_score,
                        "interview_prep_level": ev.interview_prep_level,
                        "verified_skills": ev.verified_skills,
                        "certifications_count": ev.certifications_count,
                    },
                    "prompt_bundle": prompt_bundle,
                },
            )

        elif cmd == "finalize_plan":
            ev_raw = payload["evidence"]
            ev = EvidenceSnapshotInput(
                user_id=int(ev_raw["user_id"]),
                weekly_study_hours=int(ev_raw["weekly_study_hours"]),
                assessment_score=int(ev_raw["assessment_score"]),
                coding_score=int(ev_raw["coding_score"]),
                project_count=int(ev_raw["project_count"]),
                project_level=str(ev_raw["project_level"]),
                interview_score=int(ev_raw["interview_score"]),
                interview_prep_level=str(ev_raw["interview_prep_level"]),
                verified_skills=list(ev_raw["verified_skills"]),
                certifications_count=int(ev_raw.get("certifications_count", 0)),
            )
            snapshot_id = int(payload["snapshot_id"])
            target_role = str(payload["target_role"])
            metrics = payload["metrics"]
            role_comparison = payload.get("role_comparison", [])
            raw_ai = payload.get("raw_ai_response")
            ai_error = payload.get("ai_error")

            validation_issues = []
            if raw_ai and not ai_error:
                valid, sanitized, issues = validate_ai_plan_output(raw_ai, ev, metrics)
                if valid and sanitized is not None:
                    sanitized["role_comparison"] = role_comparison
                    saved = database.save_action_plan(snapshot_id, sanitized)
                    _respond(True, {"plan": saved, "validation_issues": []})
                    return
                validation_issues = issues
                reason = "AI plan adjusted by Python constraint validator; used verified rule engine"
            else:
                reason = str(ai_error) if ai_error else "AI service unavailable; used Python readiness engine"

            fallback = build_fallback_plan(ev, target_role, metrics, reason)
            fallback["role_comparison"] = role_comparison
            saved = database.save_action_plan(snapshot_id, fallback)
            _respond(True, {"plan": saved, "validation_issues": validation_issues})

        elif cmd == "get_alternatives":
            plan_id = int(payload["plan_id"])
            bundle = database.get_plan_with_snapshot(plan_id)
            if not bundle:
                _respond(False, error="Action plan not found.")
                return
            current_titles = [s["title"] for s in bundle["content"].get("action_steps", [])]
            alts = get_alternative_tasks(current_titles, bundle["target_role"], bundle["skill_gaps"])
            _respond(True, {"alternatives": alts})

        elif cmd == "modify_plan":
            plan_id = int(payload["plan_id"])
            action = str(payload.get("action", ""))
            if action not in ("swap_task", "compress_hours", "focus_interview"):
                _respond(False, error="Unsupported modification action.")
                return
            bundle = database.get_plan_with_snapshot(plan_id)
            if not bundle:
                _respond(False, error="Action plan not found.")
                return
            updated = modify_action_plan(
                bundle["content"],
                action,
                bundle["weekly_study_hours"],
                bundle["target_role"],
                swap_index=payload.get("swap_index"),
                replacement=payload.get("replacement"),
            )
            saved = database.update_action_plan_content(plan_id, updated)
            _respond(True, {"plan": saved})

        elif cmd == "toggle_step":
            plan_id = int(payload["plan_id"])
            step_index = int(payload["step_index"])
            saved = database.toggle_action_step(plan_id, step_index)
            if not saved:
                _respond(False, error="Action step or plan not found.")
                return
            _respond(True, {"plan": saved})

        elif cmd == "compare_roles":
            user_id = int(payload["user_id"])
            profile = database.get_profile(user_id)
            if not profile:
                _respond(False, error="Student profile not found.")
                return
            snap = database.get_latest_snapshot(user_id)
            if snap:
                ev = EvidenceSnapshotInput(
                    user_id=user_id,
                    weekly_study_hours=snap["weekly_study_hours"],
                    assessment_score=snap["assessment_score"],
                    coding_score=snap["coding_score"],
                    project_count=snap["project_count"],
                    project_level=snap["project_level"],
                    interview_score=snap["interview_score"],
                    interview_prep_level=snap["interview_prep_level"],
                    verified_skills=snap["verified_skills"],
                    certifications_count=snap["certifications_count"],
                )
            else:
                # Derive baseline from logged projects if no snapshot yet
                projs = database.list_projects(user_id)
                derived_skills = list({s for p in projs for s in p["tech_stack"]})
                ev = EvidenceSnapshotInput(
                    user_id=user_id,
                    weekly_study_hours=10,
                    assessment_score=70,
                    coding_score=65,
                    project_count=len(projs),
                    project_level="deployed_fullstack" if any(p["live_url"] for p in projs) else ("academic_mini" if projs else "none"),
                    interview_score=55,
                    interview_prep_level="beginner",
                    verified_skills=derived_skills or ["python"],
                    certifications_count=0,
                )
            comparison = compare_roles_for_student(ev, profile["cgpa"])
            _respond(True, {"comparison": comparison, "has_snapshot": snap is not None})

        elif cmd == "get_trend":
            user_id = int(payload["user_id"])
            _respond(True, {"trend": database.get_readiness_trend(user_id)})

        elif cmd == "get_latest_plan":
            user_id = int(payload["user_id"])
            plan = database.get_latest_plan_for_user(user_id)
            snap = database.get_latest_snapshot(user_id)
            _respond(True, {"plan": plan, "snapshot": snap})

        elif cmd == "evaluate_interview_fallback":
            question = str(payload.get("question", ""))
            answer = str(payload.get("answer", ""))
            hint = str(payload.get("hint", ""))
            if len(answer.strip()) < 5:
                raise ValidationError("Please write an interview answer first.", {"answer": "Enter at least a few words."})
            result = evaluate_interview_answer_fallback(question, answer, hint)
            _respond(True, {"evaluation": result})

        elif cmd == "record_completion":
            user_id, plan_id, status, notes = validate_completion(payload)
            comp = database.record_completion(user_id, plan_id, status, notes)
            _respond(True, {"completion": comp})

        elif cmd == "get_history":
            user_id = payload.get("user_id")
            uid = int(user_id) if user_id is not None else None
            _respond(True, {"history": database.get_history(uid)})

        elif cmd == "get_db_stats":
            _respond(True, {"stats": database.get_db_stats()})

        else:
            _respond(False, error=f"Unknown command: {cmd}")

    except ValidationError as ve:
        _respond(False, error=ve.message, field_errors=ve.field_errors)
    except Exception as exc:
        _respond(False, error=f"Backend processing error: {str(exc)}")


if __name__ == "__main__":
    main()
