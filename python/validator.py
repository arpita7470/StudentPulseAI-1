"""Strict input, authentication, and evidence validation for StudentPulse AI."""

import re
from typing import Any, Dict, List, Tuple
from python.schemas import (
    CAREER_ROLES,
    PROJECT_LEVELS,
    INTERVIEW_PREP_LEVELS,
    SKILL_OPTIONS,
    ACTION_STATUSES,
    BRANCH_OPTIONS,
    StudentProfileInput,
    EvidenceSnapshotInput,
)


class ValidationError(Exception):
    """Raised when student profile, auth, or evidence input fails validation."""

    def __init__(self, message: str, field_errors: Dict[str, str] | None = None):
        super().__init__(message)
        self.message = message
        self.field_errors = field_errors or {}


EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def validate_profile(payload: Dict[str, Any]) -> StudentProfileInput:
    errors: Dict[str, str] = {}

    raw_name = payload.get("display_name")
    if not isinstance(raw_name, str) or not raw_name.strip():
        errors["display_name"] = "Please enter your full name or student alias."
        name = ""
    else:
        name = re.sub(r"\s+", " ", raw_name.strip())
        if len(name) < 2 or len(name) > 50:
            errors["display_name"] = "Name must be between 2 and 50 characters."

    role = payload.get("target_role")
    if not isinstance(role, str) or role not in CAREER_ROLES:
        errors["target_role"] = "Select a valid target career role."

    raw_sem = payload.get("semester")
    sem = 0
    if isinstance(raw_sem, bool) or raw_sem is None:
        errors["semester"] = "Semester (1–8) is required."
    else:
        try:
            sem = int(raw_sem)
            if sem < 1 or sem > 8:
                errors["semester"] = "Semester must be between 1 and 8."
        except (ValueError, TypeError):
            errors["semester"] = "Semester must be a whole number (1–8)."

    raw_cgpa = payload.get("cgpa")
    cgpa = 0.0
    if isinstance(raw_cgpa, bool) or raw_cgpa is None or raw_cgpa == "":
        errors["cgpa"] = "Current CGPA (0.0–10.0) is required."
    else:
        try:
            cgpa = round(float(raw_cgpa), 2)
            if cgpa < 0.0 or cgpa > 10.0:
                errors["cgpa"] = "CGPA must be between 0.0 and 10.0."
        except (ValueError, TypeError):
            errors["cgpa"] = "CGPA must be a valid decimal number."

    raw_email = str(payload.get("email", "") or "").strip().lower()
    if raw_email and not EMAIL_REGEX.match(raw_email):
        errors["email"] = "Enter a valid email address."

    raw_branch = str(payload.get("branch", "CSE") or "CSE").strip()
    if raw_branch not in BRANCH_OPTIONS:
        raw_branch = "CSE"

    if errors:
        raise ValidationError("Student profile validation failed.", errors)

    return StudentProfileInput(
        display_name=name,
        target_role=str(role),
        semester=sem,
        cgpa=cgpa,
        email=raw_email,
        branch=raw_branch,
    )


def validate_signup(payload: Dict[str, Any]) -> Tuple[StudentProfileInput, str, str]:
    errors: Dict[str, str] = {}

    try:
        profile = validate_profile(payload)
    except ValidationError as ve:
        errors.update(ve.field_errors)
        profile = None

    email = str(payload.get("email", "") or "").strip().lower()
    if not email:
        errors["email"] = "Email address is required."
    elif not EMAIL_REGEX.match(email):
        errors["email"] = "Enter a valid email address (e.g., name@kiet.edu)."

    password = str(payload.get("password", "") or "")
    if len(password) < 6:
        errors["password"] = "Password must be at least 6 characters."

    raw_role = str(payload.get("role", "student") or "student").strip().lower()
    account_role = raw_role if raw_role in ("student", "faculty") else "student"

    if errors or profile is None:
        raise ValidationError("Please check the highlighted sign-up fields.", errors)

    profile.email = email
    return profile, password, account_role


def validate_signin(payload: Dict[str, Any]) -> Tuple[str, str]:
    errors: Dict[str, str] = {}
    email = str(payload.get("email", "") or "").strip().lower()
    password = str(payload.get("password", "") or "")

    if not email or not EMAIL_REGEX.match(email):
        errors["email"] = "Enter your registered email address."
    if not password:
        errors["password"] = "Enter your password."

    if errors:
        raise ValidationError("Sign-in validation failed.", errors)
    return email, password


def validate_forgot_password(payload: Dict[str, Any]) -> Tuple[str, str]:
    errors: Dict[str, str] = {}
    email = str(payload.get("email", "") or "").strip().lower()
    new_password = str(payload.get("new_password", "") or "")

    if not email or not EMAIL_REGEX.match(email):
        errors["email"] = "Enter your registered email address."
    if len(new_password) < 6:
        errors["new_password"] = "New password must be at least 6 characters."

    if errors:
        raise ValidationError("Password reset validation failed.", errors)
    return email, new_password


def _validate_int_range(
    payload: Dict[str, Any],
    key: str,
    label: str,
    min_val: int,
    max_val: int,
    errors: Dict[str, str],
) -> int:
    raw = payload.get(key)
    if isinstance(raw, bool) or raw is None or raw == "":
        errors[key] = f"{label} is required ({min_val}–{max_val})."
        return 0
    try:
        val = int(raw)
        if val < min_val or val > max_val:
            errors[key] = f"{label} must be between {min_val} and {max_val}."
        return val
    except (ValueError, TypeError):
        errors[key] = f"{label} must be a whole number."
        return 0


def validate_evidence_snapshot(payload: Dict[str, Any]) -> EvidenceSnapshotInput:
    errors: Dict[str, str] = {}

    user_id = payload.get("user_id")
    if not isinstance(user_id, int) or user_id <= 0:
        errors["user_id"] = "Select or sign in to a valid student profile first."

    weekly_hours = _validate_int_range(
        payload, "weekly_study_hours", "Weekly study hours", 2, 40, errors
    )
    assessment_score = _validate_int_range(
        payload, "assessment_score", "Assessment score (%)", 0, 100, errors
    )
    coding_score = _validate_int_range(
        payload, "coding_score", "Coding score (%)", 0, 100, errors
    )
    project_count = _validate_int_range(
        payload, "project_count", "Project count", 0, 20, errors
    )
    interview_score = _validate_int_range(
        payload, "interview_score", "Mock interview score (%)", 0, 100, errors
    )
    certs = _validate_int_range(
        {"certifications_count": payload.get("certifications_count", 0)},
        "certifications_count",
        "Certifications count",
        0,
        20,
        errors,
    )

    proj_level = payload.get("project_level")
    if not isinstance(proj_level, str) or proj_level not in PROJECT_LEVELS:
        errors["project_level"] = "Select your current project evidence depth."

    prep_level = payload.get("interview_prep_level")
    if not isinstance(prep_level, str) or prep_level not in INTERVIEW_PREP_LEVELS:
        errors["interview_prep_level"] = "Select your interview preparation stage."

    raw_skills = payload.get("verified_skills", [])
    skills: List[str] = []
    if isinstance(raw_skills, list):
        skills = [str(s).strip() for s in raw_skills if str(s).strip()]
    elif isinstance(raw_skills, str):
        skills = [s.strip() for s in raw_skills.split(",") if s.strip()]

    invalid_skills = [s for s in skills if s not in SKILL_OPTIONS]
    if invalid_skills:
        errors["verified_skills"] = f"Unsupported skill key(s): {', '.join(invalid_skills)}."

    if errors:
        raise ValidationError("Student evidence validation failed.", errors)

    return EvidenceSnapshotInput(
        user_id=int(user_id),
        weekly_study_hours=weekly_hours,
        assessment_score=assessment_score,
        coding_score=coding_score,
        project_count=project_count,
        project_level=str(proj_level),
        interview_score=interview_score,
        interview_prep_level=str(prep_level),
        verified_skills=list(dict.fromkeys(skills)),
        certifications_count=certs,
    )


def validate_completion(payload: Dict[str, Any]) -> Tuple[int, int, str, str]:
    errors: Dict[str, str] = {}
    user_id = payload.get("user_id")
    plan_id = payload.get("plan_id")
    status = payload.get("status")
    notes = payload.get("notes", "")

    if not isinstance(user_id, int) or user_id <= 0:
        errors["user_id"] = "Valid user_id is required."
    if not isinstance(plan_id, int) or plan_id <= 0:
        errors["plan_id"] = "Valid plan_id is required."
    if not isinstance(status, str) or status not in ACTION_STATUSES:
        errors["status"] = "Status must be completed, in_progress, or skipped."
    if not isinstance(notes, str):
        notes = ""
    notes = notes.strip()[:280]

    if errors:
        raise ValidationError("Completion validation failed.", errors)

    return int(user_id), int(plan_id), str(status), notes


def validate_project(payload: Dict[str, Any]) -> Dict[str, Any]:
    errors: Dict[str, str] = {}

    user_id = payload.get("user_id")
    if not isinstance(user_id, int) or user_id <= 0:
        errors["user_id"] = "Select a valid student profile first."

    raw_title = payload.get("title")
    title = re.sub(r"\s+", " ", str(raw_title or "").strip())
    if len(title) < 3 or len(title) > 80:
        errors["title"] = "Project title must be 3–80 characters."

    raw_summary = payload.get("summary")
    summary = re.sub(r"\s+", " ", str(raw_summary or "").strip())
    if len(summary) < 10 or len(summary) > 320:
        errors["summary"] = "Provide a brief 10–320 character impact/architecture summary."

    raw_skills = payload.get("tech_stack", [])
    tech_stack: List[str] = []
    if isinstance(raw_skills, list):
        tech_stack = [str(s).strip() for s in raw_skills if str(s).strip()]
    invalid_skills = [s for s in tech_stack if s not in SKILL_OPTIONS]
    if not tech_stack:
        errors["tech_stack"] = "Tag at least one skill demonstrated by this project."
    elif invalid_skills:
        errors["tech_stack"] = f"Unsupported skill tag(s): {', '.join(invalid_skills)}."

    repo_url = str(payload.get("repo_url", "") or "").strip()
    live_url = str(payload.get("live_url", "") or "").strip()
    for url_key, url_val in (("repo_url", repo_url), ("live_url", live_url)):
        if url_val and not re.match(r"^https?://[^\s]+$", url_val, re.IGNORECASE):
            errors[url_key] = "URL must start with http:// or https://."

    has_tests = bool(payload.get("has_tests", False))
    raw_status = str(payload.get("status", "completed") or "completed").strip()
    status = raw_status if raw_status in ("completed", "in_progress") else "completed"

    if errors:
        raise ValidationError("Project evidence validation failed.", errors)

    return {
        "user_id": int(user_id),
        "title": title,
        "summary": summary,
        "tech_stack": list(dict.fromkeys(tech_stack)),
        "repo_url": repo_url[:200],
        "live_url": live_url[:200],
        "has_tests": has_tests,
        "status": status,
        "attachment_name": str(payload.get("attachment_name", "") or "")[:120],
        "attachment_path": str(payload.get("attachment_path", "") or "")[:240],
        "github_stars": max(0, int(payload.get("github_stars", 0) or 0)),
    }


def validate_task(payload: Dict[str, Any]) -> Dict[str, Any]:
    errors: Dict[str, str] = {}
    user_id = payload.get("user_id")
    if not isinstance(user_id, int) or user_id <= 0:
        errors["user_id"] = "Valid user_id is required."

    title = re.sub(r"\s+", " ", str(payload.get("title", "") or "").strip())
    if len(title) < 3 or len(title) > 120:
        errors["title"] = "Task target must be between 3 and 120 characters."

    category = re.sub(r"\s+", " ", str(payload.get("category", "Study Target") or "Study Target").strip())[:40]
    priority = str(payload.get("priority", "medium") or "medium").lower()
    if priority not in ("low", "medium", "high"):
        priority = "medium"

    target_date = str(payload.get("target_date", "") or "").strip()[:20]

    if errors:
        raise ValidationError("Daily task validation failed.", errors)

    return {
        "user_id": int(user_id),
        "title": title,
        "category": category or "Study Target",
        "priority": priority,
        "target_date": target_date,
        "attachment_name": str(payload.get("attachment_name", "") or "")[:120],
        "attachment_path": str(payload.get("attachment_path", "") or "")[:240],
    }


def validate_note(payload: Dict[str, Any]) -> Dict[str, Any]:
    errors: Dict[str, str] = {}
    user_id = payload.get("user_id")
    if not isinstance(user_id, int) or user_id <= 0:
        errors["user_id"] = "Valid user_id is required."

    title = re.sub(r"\s+", " ", str(payload.get("title", "") or "").strip())
    if len(title) < 2 or len(title) > 120:
        errors["title"] = "Note title must be 2–120 characters."

    subject = re.sub(r"\s+", " ", str(payload.get("subject", "General") or "General").strip())[:60]
    content = str(payload.get("content", "") or "").strip()
    file_name = str(payload.get("file_name", "") or "")[:140]
    file_path = str(payload.get("file_path", "") or "")[:240]

    if not content and not file_path:
        errors["content"] = "Write study notes or attach a PDF / study file."

    if errors:
        raise ValidationError("Study note validation failed.", errors)

    return {
        "user_id": int(user_id),
        "title": title,
        "subject": subject or "General",
        "content": content[:15000],
        "file_name": file_name,
        "file_path": file_path,
        "mime_type": str(payload.get("mime_type", "text/plain") or "text/plain")[:80],
        "file_size": max(0, int(payload.get("file_size", 0) or 0)),
    }


def validate_assessment_create(payload: Dict[str, Any]) -> Dict[str, Any]:
    errors: Dict[str, str] = {}
    title = re.sub(r"\s+", " ", str(payload.get("title", "") or "").strip())
    category = re.sub(r"\s+", " ", str(payload.get("category", "Technical MCQ") or "Technical MCQ").strip())
    description = re.sub(r"\s+", " ", str(payload.get("description", "") or "").strip())

    if len(title) < 4 or len(title) > 100:
        errors["title"] = "Assessment title must be 4–100 characters."
    if len(description) < 8 or len(description) > 260:
        errors["description"] = "Provide an 8–260 character assessment description."

    dur = _validate_int_range({"duration_minutes": payload.get("duration_minutes", 10)}, "duration_minutes", "Duration (minutes)", 5, 90, errors)

    raw_skills = payload.get("skill_keys", ["dsa"])
    skill_keys = [str(s).strip() for s in raw_skills if str(s).strip() in SKILL_OPTIONS] if isinstance(raw_skills, list) else ["dsa"]

    raw_questions = payload.get("questions", [])
    valid_questions: List[Dict[str, Any]] = []
    if not isinstance(raw_questions, list) or len(raw_questions) < 1:
        errors["questions"] = "Add at least 1 multiple-choice question."
    else:
        for idx, q in enumerate(raw_questions):
            if not isinstance(q, dict):
                continue
            prompt = str(q.get("prompt", "") or "").strip()
            opts = [str(o).strip() for o in (q.get("options") or []) if str(o).strip()]
            corr = int(q.get("correct_index", 0) or 0)
            topic = str(q.get("topic", "Core Concept") or "Core Concept").strip()
            expl = str(q.get("explanation", "") or "").strip()
            if len(prompt) < 5 or len(opts) < 2 or not (0 <= corr < len(opts)):
                errors["questions"] = f"Question #{idx + 1} needs a prompt, at least 2 options, and a valid correct index."
                break
            valid_questions.append({
                "prompt": prompt,
                "options": opts[:4],
                "correct_index": corr,
                "topic": topic,
                "explanation": expl,
            })

    if errors:
        raise ValidationError("Assessment validation failed.", errors)

    return {
        "title": title,
        "category": category or "Technical MCQ",
        "description": description,
        "duration_minutes": dur,
        "skill_keys": skill_keys or ["dsa"],
        "questions": valid_questions,
        "created_by": payload.get("created_by"),
    }


def validate_course_create(payload: Dict[str, Any]) -> Dict[str, Any]:
    errors: Dict[str, str] = {}
    title = re.sub(r"\s+", " ", str(payload.get("title", "") or "").strip())
    provider = re.sub(r"\s+", " ", str(payload.get("provider", "") or "").strip())
    category = re.sub(r"\s+", " ", str(payload.get("category", "Core Skills") or "Core Skills").strip())
    target_role = str(payload.get("target_role", "fullstack_dev") or "fullstack_dev")
    resource_url = str(payload.get("resource_url", "") or "").strip()

    if len(title) < 3 or len(title) > 100:
        errors["title"] = "Course title must be 3–100 characters."
    if len(provider) < 2 or len(provider) > 60:
        errors["provider"] = "Provider name is required."
    if target_role not in CAREER_ROLES:
        target_role = "fullstack_dev"
    if resource_url and not re.match(r"^https?://[^\s]+$", resource_url, re.IGNORECASE):
        errors["resource_url"] = "Resource URL must start with http:// or https://."

    hrs = _validate_int_range({"duration_hours": payload.get("duration_hours", 8)}, "duration_hours", "Duration hours", 1, 100, errors)
    raw_skills = payload.get("skill_keys", [])
    skill_keys = [str(s).strip() for s in raw_skills if str(s).strip() in SKILL_OPTIONS] if isinstance(raw_skills, list) else []

    if errors:
        raise ValidationError("Course validation failed.", errors)

    return {
        "title": title,
        "provider": provider,
        "category": category,
        "target_role": target_role,
        "duration_hours": hrs,
        "resource_url": resource_url,
        "skill_keys": skill_keys or ["dsa"],
    }


def validate_job_create(payload: Dict[str, Any]) -> Dict[str, Any]:
    errors: Dict[str, str] = {}
    title = re.sub(r"\s+", " ", str(payload.get("title", "") or "").strip())
    company = re.sub(r"\s+", " ", str(payload.get("company", "") or "").strip())
    location = re.sub(r"\s+", " ", str(payload.get("location", "Remote") or "Remote").strip())
    work_mode = str(payload.get("work_mode", "Hybrid") or "Hybrid").strip()
    job_type = str(payload.get("job_type", "Internship") or "Internship").strip()
    compensation = str(payload.get("compensation", "Competitive") or "Competitive").strip()
    target_role = str(payload.get("target_role", "fullstack_dev") or "fullstack_dev").strip()
    description = re.sub(r"\s+", " ", str(payload.get("description", "") or "").strip())
    apply_url = str(payload.get("apply_url", "") or "").strip()

    if len(title) < 3 or len(title) > 100:
        errors["title"] = "Job title must be 3–100 characters."
    if len(company) < 2 or len(company) > 80:
        errors["company"] = "Company name is required."
    if len(description) < 10 or len(description) > 400:
        errors["description"] = "Provide a 10–400 character role summary."
    if target_role not in CAREER_ROLES:
        target_role = "fullstack_dev"

    raw_skills = payload.get("required_skills", [])
    req_skills = [str(s).strip() for s in raw_skills if str(s).strip() in SKILL_OPTIONS] if isinstance(raw_skills, list) else []
    if not req_skills:
        errors["required_skills"] = "Select at least one required skill."

    if errors:
        raise ValidationError("Job opportunity validation failed.", errors)

    return {
        "title": title,
        "company": company,
        "location": location,
        "work_mode": work_mode,
        "job_type": job_type,
        "compensation": compensation,
        "target_role": target_role,
        "required_skills": req_skills,
        "description": description,
        "apply_url": apply_url,
    }


def validate_feedback(payload: Dict[str, Any]) -> Dict[str, Any]:
    errors: Dict[str, str] = {}
    student_id = payload.get("student_id")
    faculty_id = payload.get("faculty_id")
    category = str(payload.get("category", "Academic & Career") or "Academic & Career").strip()[:60]
    comment = re.sub(r"\s+", " ", str(payload.get("comment", "") or "").strip())

    if not isinstance(student_id, int) or student_id <= 0:
        errors["student_id"] = "Valid student_id is required."
    if not isinstance(faculty_id, int) or faculty_id <= 0:
        errors["faculty_id"] = "Valid faculty_id is required."
    if len(comment) < 5 or len(comment) > 500:
        errors["comment"] = "Feedback message must be 5–500 characters."

    if errors:
        raise ValidationError("Faculty feedback validation failed.", errors)

    return {
        "student_id": int(student_id),
        "faculty_id": int(faculty_id),
        "category": category,
        "comment": comment,
    }
