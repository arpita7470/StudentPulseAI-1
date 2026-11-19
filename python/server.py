"""Persistent Python 3.11 HTTP API Server for StudentPulse AI."""

import argparse
import base64
import json
import os
import re
import subprocess
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Dict, Optional, Tuple
from urllib.parse import parse_qs, urlparse

from python import database
from python.output_validator import validate_ai_plan_output
from python.pdf_utils import extract_text_from_pdf_bytes
from python.prompt_builder import build_readiness_prompt
from python.recommender import (
    build_fallback_plan,
    compare_roles_for_student,
    compute_readiness_metrics,
    evaluate_interview_answer_fallback,
    get_alternative_tasks,
    modify_action_plan,
)
from python.schemas import EvidenceSnapshotInput
from python.validator import (
    ValidationError,
    validate_assessment_create,
    validate_completion,
    validate_course_create,
    validate_evidence_snapshot,
    validate_feedback,
    validate_forgot_password,
    validate_job_create,
    validate_note,
    validate_profile,
    validate_project,
    validate_signin,
    validate_signup,
    validate_task,
)

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _run_unittest_suite() -> Dict[str, Any]:
    proc = subprocess.run(
        [sys.executable, "-m", "unittest", "discover", "-s", "python/tests", "-v"],
        cwd=ROOT_DIR,
        capture_output=True,
        text=True,
        timeout=30,
    )
    combined = f"{proc.stdout or ''}\n{proc.stderr or ''}".strip()
    lines = combined.splitlines()
    tests = []
    i = 0
    while i < len(lines):
        line = lines[i]
        single = re.match(r"^(test_\S+)\s+\([^)]+\)\s+\.\.\.\s+(ok|FAIL|ERROR|skipped)", line, re.I)
        if single:
            tests.append({"name": single.group(1), "doc": "", "status": single.group(2).lower()})
            i += 1
            continue
        header = re.match(r"^(test_\S+)\s+\([^)]+\)$", line)
        if header and i + 1 < len(lines):
            nxt = lines[i + 1]
            doc = re.match(r"^(.*)\s+\.\.\.\s+(ok|FAIL|ERROR|skipped)$", nxt, re.I)
            if doc:
                tests.append(
                    {"name": header.group(1), "doc": doc.group(1).strip(), "status": doc.group(2).lower()}
                )
                i += 2
                continue
        i += 1

    return {
        "passed": proc.returncode == 0,
        "exitCode": proc.returncode,
        "output": combined,
        "tests": tests,
    }


def _compute_role_comparison(user_id: int) -> Tuple[int, Dict[str, Any]]:
    profile = database.get_profile(user_id)
    if not profile:
        return 404, {"error": "Student profile not found."}
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
        projs = database.list_projects(user_id)
        derived_skills = list({s for p in projs for s in p["tech_stack"]})
        ev = EvidenceSnapshotInput(
            user_id=user_id,
            weekly_study_hours=10,
            assessment_score=70,
            coding_score=65,
            project_count=len(projs),
            project_level="deployed_fullstack"
            if any(p["live_url"] for p in projs)
            else ("academic_mini" if projs else "none"),
            interview_score=55,
            interview_prep_level="beginner",
            verified_skills=derived_skills or ["python"],
            certifications_count=0,
        )
    comparison = compare_roles_for_student(ev, profile["cgpa"])
    return 200, {"comparison": comparison, "has_snapshot": snap is not None}


class StudentPulseHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, format: str, *args: Any) -> None:
        return

    def _send_json(self, status: int, body: Any) -> None:
        raw = json.dumps(body).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def _read_json(self) -> Dict[str, Any]:
        length = int(self.headers.get("Content-Length", "0") or 0)
        if length <= 0:
            return {}
        raw = self.rfile.read(length).decode("utf-8").strip()
        if not raw:
            return {}
        return json.loads(raw)

    def _get_actor(self) -> Optional[Dict[str, Any]]:
        raw_id = self.headers.get("X-User-Id", "").strip()
        if raw_id.isdigit():
            return database.get_profile(int(raw_id))
        return None

    def _require_role(self, allowed_roles: Tuple[str, ...]) -> Optional[Dict[str, Any]]:
        actor = self._get_actor()
        if not actor:
            self._send_json(401, {"error": "Authentication header X-User-Id required for this operation."})
            return None
        if actor.get("role") not in allowed_roles:
            self._send_json(403, {"error": f"Insufficient permissions. Required role: {' or '.join(allowed_roles)}."})
            return None
        return actor

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path
        qs = parse_qs(parsed.query)

        try:
            if path == "/api/health":
                self._send_json(200, {"ok": True, "engine": "Python 3.11 ThreadingHTTPServer"})
                return

            if path == "/api/profiles":
                self._send_json(200, {"profiles": database.list_profiles()})
                return

            m = re.match(r"^/api/profiles/(\d+)/role-comparison$", path)
            if m:
                code, body = _compute_role_comparison(int(m.group(1)))
                self._send_json(code, body)
                return

            m = re.match(r"^/api/profiles/(\d+)/trend$", path)
            if m:
                self._send_json(200, {"trend": database.get_readiness_trend(int(m.group(1)))})
                return

            m = re.match(r"^/api/profiles/(\d+)/latest-plan$", path)
            if m:
                uid = int(m.group(1))
                self._send_json(
                    200,
                    {
                        "plan": database.get_latest_plan_for_user(uid),
                        "snapshot": database.get_latest_snapshot(uid),
                    },
                )
                return

            m = re.match(r"^/api/profiles/(\d+)/skill-profile$", path)
            if m:
                uid = int(m.group(1))
                self._send_json(200, database.get_student_skill_profile(uid))
                return

            if path == "/api/projects":
                uid_raw = qs.get("user_id", [None])[0]
                if not uid_raw or not uid_raw.isdigit():
                    self._send_json(400, {"error": "user_id query parameter is required."})
                    return
                self._send_json(200, {"projects": database.list_projects(int(uid_raw))})
                return

            m = re.match(r"^/api/readiness-plans/(\d+)/alternatives$", path)
            if m:
                bundle = database.get_plan_with_snapshot(int(m.group(1)))
                if not bundle:
                    self._send_json(404, {"error": "Action plan not found."})
                    return
                current_titles = [s["title"] for s in bundle["content"].get("action_steps", [])]
                alts = get_alternative_tasks(current_titles, bundle["target_role"], bundle["skill_gaps"])
                self._send_json(200, {"alternatives": alts})
                return

            if path == "/api/history":
                uid_raw = qs.get("user_id", [None])[0]
                uid = int(uid_raw) if uid_raw and uid_raw.isdigit() else None
                self._send_json(200, {"history": database.get_history(uid)})
                return

            # Daily Tasks
            if path == "/api/tasks":
                uid_raw = qs.get("user_id", [None])[0]
                if not uid_raw or not uid_raw.isdigit():
                    self._send_json(400, {"error": "user_id query parameter is required."})
                    return
                self._send_json(200, {"tasks": database.list_tasks(int(uid_raw))})
                return

            # Study Notes
            if path == "/api/notes":
                uid_raw = qs.get("user_id", [None])[0]
                if not uid_raw or not uid_raw.isdigit():
                    self._send_json(400, {"error": "user_id query parameter is required."})
                    return
                self._send_json(200, {"notes": database.list_notes(int(uid_raw))})
                return

            m = re.match(r"^/api/notes/(\d+)$", path)
            if m:
                note = database.get_note(int(m.group(1)))
                if not note:
                    self._send_json(404, {"error": "Study note not found."})
                    return
                self._send_json(200, {"note": note})
                return

            # Assessments
            if path == "/api/assessments":
                self._send_json(200, {"assessments": database.list_assessments()})
                return

            m = re.match(r"^/api/assessments/(\d+)$", path)
            if m:
                detail = database.get_assessment_detail(int(m.group(1)))
                if not detail:
                    self._send_json(404, {"error": "Assessment not found."})
                    return
                self._send_json(200, {"assessment": detail})
                return

            if path == "/api/assessment-results":
                uid_raw = qs.get("user_id", [None])[0]
                uid = int(uid_raw) if uid_raw and uid_raw.isdigit() else None
                self._send_json(200, {"results": database.list_assessment_results(uid)})
                return

            # Courses
            if path == "/api/courses":
                uid_raw = qs.get("user_id", [None])[0]
                uid = int(uid_raw) if uid_raw and uid_raw.isdigit() else None
                self._send_json(200, {"courses": database.list_courses(uid)})
                return

            # Mentor Chat Messages
            if path == "/api/mentor/messages":
                uid_raw = qs.get("user_id", [None])[0]
                if not uid_raw or not uid_raw.isdigit():
                    self._send_json(400, {"error": "user_id query parameter is required."})
                    return
                self._send_json(200, {"messages": database.list_mentor_messages(int(uid_raw))})
                return

            # Mock Interviews
            if path == "/api/interviews":
                uid_raw = qs.get("user_id", [None])[0]
                if not uid_raw or not uid_raw.isdigit():
                    self._send_json(400, {"error": "user_id query parameter is required."})
                    return
                self._send_json(200, {"interviews": database.list_mock_interviews(int(uid_raw))})
                return

            # Resumes
            if path == "/api/resumes":
                uid_raw = qs.get("user_id", [None])[0]
                if not uid_raw or not uid_raw.isdigit():
                    self._send_json(400, {"error": "user_id query parameter is required."})
                    return
                self._send_json(200, {"resumes": database.list_resumes(int(uid_raw))})
                return

            # Jobs Feed
            if path == "/api/jobs":
                uid_raw = qs.get("user_id", [None])[0]
                uid = int(uid_raw) if uid_raw and uid_raw.isdigit() else 1
                self._send_json(200, {"jobs": database.list_jobs_for_user(uid)})
                return

            # Gamification & Digital Skill Passport
            if path == "/api/gamification":
                uid_raw = qs.get("user_id", [None])[0]
                if not uid_raw or not uid_raw.isdigit():
                    self._send_json(400, {"error": "user_id query parameter is required."})
                    return
                self._send_json(200, database.get_gamification_summary(int(uid_raw)))
                return

            m = re.match(r"^/api/passport/(\d+)$", path)
            if m:
                passport = database.get_digital_passport(int(m.group(1)))
                if not passport:
                    self._send_json(404, {"error": "Student passport not found."})
                    return
                self._send_json(200, {"passport": passport})
                return

            # Notifications & Faculty Feedback
            if path == "/api/notifications":
                uid_raw = qs.get("user_id", [None])[0]
                if not uid_raw or not uid_raw.isdigit():
                    self._send_json(400, {"error": "user_id query parameter is required."})
                    return
                uid = int(uid_raw)
                self._send_json(
                    200,
                    {
                        "notifications": database.list_notifications(uid),
                        "faculty_feedback": database.list_faculty_feedback(uid),
                    },
                )
                return

            # Faculty Overview (RBAC: faculty or admin)
            if path == "/api/faculty/overview":
                if not self._require_role(("faculty", "admin")):
                    return
                self._send_json(200, database.get_faculty_overview())
                return

            # Admin Overview & Settings (RBAC: admin)
            if path == "/api/admin/overview":
                if not self._require_role(("admin",)):
                    return
                self._send_json(200, database.get_admin_overview())
                return

            if path == "/api/admin/settings":
                self._send_json(200, {"settings": database.get_app_settings()})
                return

            if path == "/api/architecture/stats":
                self._send_json(200, {"stats": database.get_db_stats()})
                return

            self._send_json(404, {"error": f"Route not found: {path}"})
        except Exception as exc:
            self._send_json(500, {"error": str(exc)})

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path

        try:
            body = self._read_json()

            if path == "/api/auth/signup":
                prof, password, account_role = validate_signup(body)
                created = database.signup_student(
                    display_name=prof.display_name,
                    email=prof.email,
                    password=password,
                    branch=prof.branch,
                    target_role=prof.target_role,
                    semester=prof.semester,
                    cgpa=prof.cgpa,
                    role=account_role,
                )
                if not created:
                    raise ValidationError(
                        "An account with this email already exists.",
                        {"email": "This email is already registered. Try signing in instead."},
                    )
                self._send_json(201, {"profile": created})
                return

            if path == "/api/auth/signin":
                email, password = validate_signin(body)
                profile = database.signin_student(email, password)
                if not profile:
                    raise ValidationError(
                        "Invalid email or password (or account deactivated).",
                        {"password": "Email or password did not match an active account."},
                    )
                self._send_json(200, {"profile": profile})
                return

            if path == "/api/auth/forgot-password":
                email, new_pw = validate_forgot_password(body)
                ok = database.reset_password_by_email(email, new_pw)
                if not ok:
                    raise ValidationError(
                        "No registered account matches this email.",
                        {"email": "Email not found in StudentPulse records."},
                    )
                self._send_json(200, {"reset": True, "message": "Password updated successfully. You can now sign in."})
                return

            if path == "/api/profiles":
                prof = validate_profile(body)
                created = database.create_profile(
                    prof.display_name,
                    prof.target_role,
                    prof.semester,
                    prof.cgpa,
                    email=prof.email,
                    branch=prof.branch,
                )
                self._send_json(201, {"profile": created})
                return

            m = re.match(r"^/api/profiles/(\d+)/skills$", path)
            if m:
                uid = int(m.group(1))
                updates = body.get("skills", [])
                if not isinstance(updates, list):
                    raise ValidationError("skills must be an array.")
                profile_data = database.upsert_student_skills(uid, updates)
                self._send_json(200, profile_data)
                return

            if path == "/api/projects":
                proj = validate_project(body)
                created = database.create_project(**proj)
                self._send_json(201, {"project": created})
                return

            # Tasks
            if path == "/api/tasks":
                t = validate_task(body)
                created = database.create_task(**t)
                self._send_json(201, {"task": created})
                return

            m = re.match(r"^/api/tasks/(\d+)/toggle$", path)
            if m:
                toggled = database.toggle_task(int(m.group(1)))
                if not toggled:
                    self._send_json(404, {"error": "Task not found."})
                    return
                self._send_json(200, {"task": toggled})
                return

            # Study Notes
            if path == "/api/notes":
                note_data = validate_note(body)
                created = database.create_note(**note_data)
                self._send_json(201, {"note": created})
                return

            # Assessments
            if path == "/api/assessments":
                if not self._require_role(("faculty", "admin")):
                    return
                adata = validate_assessment_create(body)
                created = database.create_assessment(**adata)
                self._send_json(201, {"assessment": created})
                return

            m = re.match(r"^/api/assessments/(\d+)/submit$", path)
            if m:
                aid = int(m.group(1))
                user_id = int(body.get("user_id", 0) or 0)
                answers = body.get("answers", [])
                time_taken = int(body.get("time_taken_sec", 0) or 0)
                if user_id <= 0 or not isinstance(answers, list):
                    raise ValidationError("user_id and answers array are required.")
                res_obj = database.submit_assessment(user_id, aid, [int(a) for a in answers], time_taken)
                if not res_obj:
                    self._send_json(404, {"error": "Assessment not found."})
                    return
                self._send_json(201, {"result": res_obj})
                return

            m = re.match(r"^/api/assessment-results/(\d+)/ai-feedback$", path)
            if m:
                rid = int(m.group(1))
                fb_text = str(body.get("ai_feedback", "") or "").strip()
                if not fb_text:
                    raise ValidationError("ai_feedback text is required.")
                database.update_assessment_ai_feedback(rid, fb_text)
                self._send_json(200, {"updated": True})
                return

            # Courses
            if path == "/api/courses":
                if not self._require_role(("faculty", "admin")):
                    return
                cdata = validate_course_create(body)
                created = database.create_course(**cdata)
                self._send_json(201, {"course": created})
                return

            m = re.match(r"^/api/courses/(\d+)/toggle$", path)
            if m:
                cid = int(m.group(1))
                user_id = int(body.get("user_id", 0) or 0)
                if user_id <= 0:
                    raise ValidationError("user_id is required.")
                prog = database.toggle_course_progress(user_id, cid)
                self._send_json(200, prog)
                return

            # Mentor messages
            if path == "/api/mentor/messages":
                user_id = int(body.get("user_id", 0) or 0)
                sender = str(body.get("sender", "user") or "user")
                content = str(body.get("content", "") or "").strip()
                if user_id <= 0 or sender not in ("user", "assistant") or not content:
                    raise ValidationError("Valid user_id, sender, and content are required.")
                msg = database.add_mentor_message(user_id, sender, content)
                self._send_json(201, {"message": msg})
                return

            # Mock interviews persistence
            if path == "/api/interviews":
                saved = database.save_mock_interview(
                    user_id=int(body["user_id"]),
                    target_role=str(body["target_role"]),
                    mode=str(body.get("mode", "technical")),
                    question=str(body["question"]),
                    answer=str(body["answer"]),
                    technical_score=int(body["technical_score"]),
                    communication_score=int(body["communication_score"]),
                    quality_score=int(body["quality_score"]),
                    overall_score=int(body["overall_score"]),
                    feedback=str(body["feedback"]),
                    improvements=str(body["improvements"]),
                    source=str(body.get("source", "gemini_ai")),
                )
                self._send_json(201, {"interview": saved})
                return

            # Resumes persistence
            if path == "/api/resumes":
                saved = database.save_resume_analysis(
                    user_id=int(body["user_id"]),
                    file_name=str(body["file_name"]),
                    file_path=str(body.get("file_path", "")),
                    extracted_text=str(body.get("extracted_text", "")),
                    target_role=str(body["target_role"]),
                    job_description=str(body.get("job_description", "")),
                    ats_score=int(body["ats_score"]),
                    matched_keywords=list(body.get("matched_keywords", [])),
                    missing_keywords=list(body.get("missing_keywords", [])),
                    suggestions=list(body.get("suggestions", [])),
                    summary=str(body.get("summary", "")),
                )
                self._send_json(201, {"resume": saved})
                return

            # PDF text extraction helper for Node server
            if path == "/api/python/extract-pdf":
                b64 = str(body.get("file_base64", "") or "")
                if "," in b64:
                    b64 = b64.split(",", 1)[1]
                raw_bytes = base64.b64decode(b64) if b64 else b""
                text = extract_text_from_pdf_bytes(raw_bytes)
                self._send_json(200, {"text": text})
                return

            # Jobs
            if path == "/api/jobs":
                if not self._require_role(("faculty", "admin")):
                    return
                jdata = validate_job_create(body)
                created = database.create_job_opportunity(**jdata)
                self._send_json(201, {"job": created})
                return

            m = re.match(r"^/api/jobs/(\d+)/status$", path)
            if m:
                jid = int(m.group(1))
                user_id = int(body.get("user_id", 0) or 0)
                status = str(body.get("status", "saved") or "saved")
                if user_id <= 0 or status not in ("none", "saved", "applied", "interviewing"):
                    raise ValidationError("Valid user_id and status (none/saved/applied/interviewing) required.")
                res_obj = database.set_job_status(user_id, jid, status)
                self._send_json(200, res_obj)
                return

            # Notifications
            if path == "/api/notifications/read":
                user_id = int(body.get("user_id", 0) or 0)
                if user_id <= 0:
                    raise ValidationError("user_id is required.")
                database.mark_notifications_read(user_id)
                self._send_json(200, {"ok": True})
                return

            # Faculty feedback
            if path == "/api/faculty/feedback":
                if not self._require_role(("faculty", "admin")):
                    return
                fdata = validate_feedback(body)
                created = database.add_faculty_feedback(**fdata)
                self._send_json(201, {"feedback": created})
                return

            # Existing Readiness & Plan endpoints
            if path == "/api/python/prepare-plan":
                ev = validate_evidence_snapshot(body)
                profile = database.get_profile(ev.user_id)
                if not profile:
                    raise ValidationError(
                        "Selected student profile not found.", {"user_id": "Profile does not exist."}
                    )
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
                self._send_json(
                    200,
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
                return

            if path == "/api/python/finalize-plan":
                ev_raw = body["evidence"]
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
                snapshot_id = int(body["snapshot_id"])
                target_role = str(body["target_role"])
                metrics = body["metrics"]
                role_comparison = body.get("role_comparison", [])
                raw_ai = body.get("raw_ai_response")
                ai_error = body.get("ai_error")

                validation_issues = []
                if raw_ai and not ai_error:
                    valid, sanitized, issues = validate_ai_plan_output(raw_ai, ev, metrics)
                    if valid and sanitized is not None:
                        sanitized["role_comparison"] = role_comparison
                        saved = database.save_action_plan(snapshot_id, sanitized)
                        self._send_json(200, {"plan": saved, "validation_issues": []})
                        return
                    validation_issues = issues
                    reason = "AI plan adjusted by Python constraint validator; used verified rule engine"
                else:
                    reason = (
                        str(ai_error)
                        if ai_error
                        else "AI service unavailable; used Python readiness engine"
                    )

                fallback = build_fallback_plan(ev, target_role, metrics, reason)
                fallback["role_comparison"] = role_comparison
                saved = database.save_action_plan(snapshot_id, fallback)
                self._send_json(200, {"plan": saved, "validation_issues": validation_issues})
                return

            m = re.match(r"^/api/readiness-plans/(\d+)/modify$", path)
            if m:
                plan_id = int(m.group(1))
                action = str(body.get("action", ""))
                if action not in ("swap_task", "compress_hours", "focus_interview"):
                    self._send_json(400, {"error": "Unsupported modification action."})
                    return
                bundle = database.get_plan_with_snapshot(plan_id)
                if not bundle:
                    self._send_json(404, {"error": "Action plan not found."})
                    return
                updated = modify_action_plan(
                    bundle["content"],
                    action,
                    bundle["weekly_study_hours"],
                    bundle["target_role"],
                    swap_index=body.get("swap_index"),
                    replacement=body.get("replacement"),
                )
                saved = database.update_action_plan_content(plan_id, updated)
                self._send_json(200, {"plan": saved})
                return

            m = re.match(r"^/api/readiness-plans/(\d+)/toggle-step$", path)
            if m:
                plan_id = int(m.group(1))
                step_index = int(body.get("step_index", -1))
                saved = database.toggle_action_step(plan_id, step_index)
                if not saved:
                    self._send_json(404, {"error": "Action step or plan not found."})
                    return
                self._send_json(200, {"plan": saved})
                return

            if path == "/api/python/evaluate-interview-fallback":
                question = str(body.get("question", ""))
                answer = str(body.get("answer", ""))
                hint = str(body.get("hint", ""))
                if len(answer.strip()) < 5:
                    raise ValidationError(
                        "Please write an interview answer first.",
                        {"answer": "Enter at least a few words."},
                    )
                result = evaluate_interview_answer_fallback(question, answer, hint)
                self._send_json(200, {"evaluation": result})
                return

            if path == "/api/completions":
                user_id, plan_id, status, notes = validate_completion(body)
                comp = database.record_completion(user_id, plan_id, status, notes)
                self._send_json(201, {"completion": comp})
                return

            if path == "/api/architecture/run-tests":
                self._send_json(200, _run_unittest_suite())
                return

            self._send_json(404, {"error": f"Route not found: {path}"})
        except ValidationError as ve:
            self._send_json(400, {"error": ve.message, "field_errors": ve.field_errors})
        except Exception as exc:
            self._send_json(500, {"error": str(exc)})

    def do_PUT(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path
        try:
            body = self._read_json()

            m = re.match(r"^/api/profiles/(\d+)$", path)
            if m:
                user_id = int(m.group(1))
                prof = validate_profile(body)
                updated = database.update_profile(
                    user_id,
                    prof.display_name,
                    prof.target_role,
                    prof.semester,
                    prof.cgpa,
                    branch=prof.branch,
                    bio=body.get("bio"),
                    github_username=body.get("github_username"),
                    linkedin_url=body.get("linkedin_url"),
                )
                if not updated:
                    self._send_json(404, {"error": "Student profile not found."})
                    return
                self._send_json(200, {"profile": updated})
                return

            m = re.match(r"^/api/admin/users/(\d+)$", path)
            if m:
                if not self._require_role(("admin",)):
                    return
                uid = int(m.group(1))
                updated = database.admin_update_user(
                    uid,
                    str(body.get("role", "student")),
                    str(body.get("branch", "CSE")),
                    bool(body.get("is_active", True)),
                )
                if not updated:
                    self._send_json(404, {"error": "User not found."})
                    return
                self._send_json(200, {"user": updated})
                return

            if path == "/api/admin/settings":
                if not self._require_role(("admin",)):
                    return
                settings = database.update_app_settings(body)
                self._send_json(200, {"settings": settings})
                return

            self._send_json(404, {"error": f"Route not found: {path}"})
        except ValidationError as ve:
            self._send_json(400, {"error": ve.message, "field_errors": ve.field_errors})
        except Exception as exc:
            self._send_json(500, {"error": str(exc)})

    def do_DELETE(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path
        try:
            m = re.match(r"^/api/projects/(\d+)$", path)
            if m:
                deleted = database.delete_project(int(m.group(1)))
                if not deleted:
                    self._send_json(404, {"error": "Project not found."})
                    return
                self._send_json(200, {"deleted": True})
                return

            m = re.match(r"^/api/tasks/(\d+)$", path)
            if m:
                deleted = database.delete_task(int(m.group(1)))
                if not deleted:
                    self._send_json(404, {"error": "Task not found."})
                    return
                self._send_json(200, {"deleted": True})
                return

            m = re.match(r"^/api/notes/(\d+)$", path)
            if m:
                deleted = database.delete_note(int(m.group(1)))
                if not deleted:
                    self._send_json(404, {"error": "Study note not found."})
                    return
                self._send_json(200, {"deleted": True})
                return

            if path == "/api/mentor/messages":
                qs = parse_qs(parsed.query)
                uid_raw = qs.get("user_id", [None])[0]
                if not uid_raw or not uid_raw.isdigit():
                    self._send_json(400, {"error": "user_id query parameter is required."})
                    return
                database.clear_mentor_messages(int(uid_raw))
                self._send_json(200, {"cleared": True})
                return

            self._send_json(404, {"error": f"Route not found: {path}"})
        except Exception as exc:
            self._send_json(500, {"error": str(exc)})


def run_server(host: str = "127.0.0.1", port: int = 8001) -> None:
    database.init_db()
    server = ThreadingHTTPServer((host, port), StudentPulseHandler)
    print(f"StudentPulse Python API server listening on http://{host}:{port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="StudentPulse AI Python HTTP API server")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=int(os.environ.get("PYTHON_API_PORT", "8001")))
    args = parser.parse_args()
    run_server(args.host, args.port)
