"""SQLite relational persistence layer for StudentPulse AI."""

import hashlib
import hmac
import json
import os
import secrets
import sqlite3
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from python.catalog import ROLE_BENCHMARKS
from python.schemas import CAREER_ROLES, SKILL_OPTIONS

DEFAULT_DB_PATH = os.environ.get(
    "STUDENTPULSE_DB_PATH",
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "studentpulse.db"),
)

_PROFILE_COLUMNS = (
    "user_id, display_name, email, branch, role, target_role, semester, cgpa, "
    "xp_points, streak_days, communication_score, bio, github_username, linkedin_url, is_active, created_at"
)


def _utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


def _today_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _hash_password(password: str, salt: str | None = None) -> str:
    actual_salt = salt or secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), actual_salt.encode("utf-8"), 100_000)
    return f"{actual_salt}${dk.hex()}"


def _verify_password(password: str, stored_hash: str) -> bool:
    if not stored_hash or "$" not in stored_hash:
        return False
    salt, expected = stored_hash.split("$", 1)
    candidate = _hash_password(password, salt).split("$", 1)[1]
    return hmac.compare_digest(candidate, expected)


def get_connection(db_path: str = DEFAULT_DB_PATH) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def init_db(db_path: str = DEFAULT_DB_PATH, seed_demo: bool = True) -> None:
    """Create all StudentPulse AI relational tables with primary and foreign keys."""
    with get_connection(db_path) as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS student_profile (
                user_id INTEGER PRIMARY KEY AUTOINCREMENT,
                display_name TEXT NOT NULL,
                email TEXT UNIQUE,
                password_hash TEXT NOT NULL DEFAULT '',
                branch TEXT NOT NULL DEFAULT 'CSE',
                role TEXT NOT NULL DEFAULT 'student',
                target_role TEXT NOT NULL,
                semester INTEGER NOT NULL,
                cgpa REAL NOT NULL,
                xp_points INTEGER NOT NULL DEFAULT 120,
                streak_days INTEGER NOT NULL DEFAULT 1,
                communication_score INTEGER NOT NULL DEFAULT 70,
                bio TEXT NOT NULL DEFAULT '',
                github_username TEXT NOT NULL DEFAULT '',
                linkedin_url TEXT NOT NULL DEFAULT '',
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS student_project (
                project_id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                summary TEXT NOT NULL,
                tech_stack_json TEXT NOT NULL,
                repo_url TEXT NOT NULL DEFAULT '',
                live_url TEXT NOT NULL DEFAULT '',
                has_tests INTEGER NOT NULL DEFAULT 0,
                status TEXT NOT NULL DEFAULT 'completed',
                attachment_name TEXT NOT NULL DEFAULT '',
                attachment_path TEXT NOT NULL DEFAULT '',
                github_stars INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES student_profile (user_id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS evidence_snapshot (
                snapshot_id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                weekly_study_hours INTEGER NOT NULL,
                assessment_score INTEGER NOT NULL,
                coding_score INTEGER NOT NULL,
                project_count INTEGER NOT NULL,
                project_level TEXT NOT NULL,
                interview_score INTEGER NOT NULL,
                interview_prep_level TEXT NOT NULL,
                verified_skills_json TEXT NOT NULL,
                certifications_count INTEGER NOT NULL DEFAULT 0,
                computed_readiness INTEGER NOT NULL,
                skill_gaps_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES student_profile (user_id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS action_plan (
                plan_id INTEGER PRIMARY KEY AUTOINCREMENT,
                snapshot_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                total_hours INTEGER NOT NULL,
                content_json TEXT NOT NULL,
                source TEXT NOT NULL DEFAULT 'python_rule_fallback',
                created_at TEXT NOT NULL,
                FOREIGN KEY (snapshot_id) REFERENCES evidence_snapshot (snapshot_id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS readiness_completion (
                completion_id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                plan_id INTEGER NOT NULL,
                status TEXT NOT NULL,
                notes TEXT NOT NULL DEFAULT '',
                completed_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES student_profile (user_id) ON DELETE CASCADE,
                FOREIGN KEY (plan_id) REFERENCES action_plan (plan_id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS student_skills (
                skill_record_id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                skill_key TEXT NOT NULL,
                proficiency INTEGER NOT NULL DEFAULT 50,
                source TEXT NOT NULL DEFAULT 'self_reported',
                verified_score INTEGER NOT NULL DEFAULT 0,
                updated_at TEXT NOT NULL,
                UNIQUE (user_id, skill_key),
                FOREIGN KEY (user_id) REFERENCES student_profile (user_id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS daily_tasks (
                task_id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                category TEXT NOT NULL DEFAULT 'Study Target',
                priority TEXT NOT NULL DEFAULT 'medium',
                target_date TEXT NOT NULL,
                completed INTEGER NOT NULL DEFAULT 0,
                attachment_name TEXT NOT NULL DEFAULT '',
                attachment_path TEXT NOT NULL DEFAULT '',
                xp_reward INTEGER NOT NULL DEFAULT 25,
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES student_profile (user_id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS study_notes (
                note_id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                subject TEXT NOT NULL DEFAULT 'General',
                content TEXT NOT NULL DEFAULT '',
                file_name TEXT NOT NULL DEFAULT '',
                file_path TEXT NOT NULL DEFAULT '',
                mime_type TEXT NOT NULL DEFAULT '',
                file_size INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES student_profile (user_id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS assessments (
                assessment_id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                category TEXT NOT NULL,
                description TEXT NOT NULL,
                duration_minutes INTEGER NOT NULL DEFAULT 15,
                skill_keys_json TEXT NOT NULL,
                created_by INTEGER,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS assessment_questions (
                question_id INTEGER PRIMARY KEY AUTOINCREMENT,
                assessment_id INTEGER NOT NULL,
                prompt TEXT NOT NULL,
                options_json TEXT NOT NULL,
                correct_index INTEGER NOT NULL,
                topic TEXT NOT NULL,
                explanation TEXT NOT NULL DEFAULT '',
                FOREIGN KEY (assessment_id) REFERENCES assessments (assessment_id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS assessment_results (
                result_id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                assessment_id INTEGER NOT NULL,
                score_pct INTEGER NOT NULL,
                correct_count INTEGER NOT NULL,
                total_count INTEGER NOT NULL,
                weak_topics_json TEXT NOT NULL,
                answers_json TEXT NOT NULL,
                ai_feedback TEXT NOT NULL DEFAULT '',
                time_taken_sec INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES student_profile (user_id) ON DELETE CASCADE,
                FOREIGN KEY (assessment_id) REFERENCES assessments (assessment_id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS courses (
                course_id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                provider TEXT NOT NULL,
                category TEXT NOT NULL,
                target_role TEXT NOT NULL,
                duration_hours INTEGER NOT NULL DEFAULT 6,
                resource_url TEXT NOT NULL DEFAULT '',
                skill_keys_json TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS user_course_progress (
                progress_id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                course_id INTEGER NOT NULL,
                completed INTEGER NOT NULL DEFAULT 0,
                updated_at TEXT NOT NULL,
                UNIQUE (user_id, course_id),
                FOREIGN KEY (user_id) REFERENCES student_profile (user_id) ON DELETE CASCADE,
                FOREIGN KEY (course_id) REFERENCES courses (course_id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS mentor_messages (
                msg_id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                sender TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES student_profile (user_id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS mock_interviews (
                interview_id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                target_role TEXT NOT NULL,
                mode TEXT NOT NULL DEFAULT 'technical',
                question TEXT NOT NULL,
                answer TEXT NOT NULL,
                technical_score INTEGER NOT NULL,
                communication_score INTEGER NOT NULL,
                quality_score INTEGER NOT NULL,
                overall_score INTEGER NOT NULL,
                feedback TEXT NOT NULL,
                improvements TEXT NOT NULL,
                source TEXT NOT NULL DEFAULT 'gemini_ai',
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES student_profile (user_id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS resumes (
                resume_id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                file_name TEXT NOT NULL,
                file_path TEXT NOT NULL DEFAULT '',
                extracted_text TEXT NOT NULL DEFAULT '',
                target_role TEXT NOT NULL,
                job_description TEXT NOT NULL DEFAULT '',
                ats_score INTEGER NOT NULL,
                matched_keywords_json TEXT NOT NULL,
                missing_keywords_json TEXT NOT NULL,
                suggestions_json TEXT NOT NULL,
                summary TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES student_profile (user_id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS job_opportunities (
                job_id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                company TEXT NOT NULL,
                location TEXT NOT NULL,
                work_mode TEXT NOT NULL,
                job_type TEXT NOT NULL,
                compensation TEXT NOT NULL,
                target_role TEXT NOT NULL,
                required_skills_json TEXT NOT NULL,
                description TEXT NOT NULL,
                apply_url TEXT NOT NULL DEFAULT '',
                is_sample INTEGER NOT NULL DEFAULT 1,
                posted_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS job_applications (
                application_id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                job_id INTEGER NOT NULL,
                status TEXT NOT NULL DEFAULT 'saved',
                updated_at TEXT NOT NULL,
                UNIQUE (user_id, job_id),
                FOREIGN KEY (user_id) REFERENCES student_profile (user_id) ON DELETE CASCADE,
                FOREIGN KEY (job_id) REFERENCES job_opportunities (job_id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS faculty_feedback (
                feedback_id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id INTEGER NOT NULL,
                faculty_id INTEGER NOT NULL,
                category TEXT NOT NULL DEFAULT 'Academic & Career',
                comment TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (student_id) REFERENCES student_profile (user_id) ON DELETE CASCADE,
                FOREIGN KEY (faculty_id) REFERENCES student_profile (user_id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS notifications (
                notification_id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                message TEXT NOT NULL,
                kind TEXT NOT NULL DEFAULT 'info',
                is_read INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES student_profile (user_id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS app_settings (
                setting_key TEXT PRIMARY KEY,
                setting_value TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            """
        )

        # Graceful migrations for pre-existing tables
        profile_cols = {r["name"] for r in conn.execute("PRAGMA table_info(student_profile)").fetchall()}
        migrations = [
            ("email", "ALTER TABLE student_profile ADD COLUMN email TEXT"),
            ("password_hash", "ALTER TABLE student_profile ADD COLUMN password_hash TEXT NOT NULL DEFAULT ''"),
            ("branch", "ALTER TABLE student_profile ADD COLUMN branch TEXT NOT NULL DEFAULT 'CSE'"),
            ("role", "ALTER TABLE student_profile ADD COLUMN role TEXT NOT NULL DEFAULT 'student'"),
            ("xp_points", "ALTER TABLE student_profile ADD COLUMN xp_points INTEGER NOT NULL DEFAULT 120"),
            ("streak_days", "ALTER TABLE student_profile ADD COLUMN streak_days INTEGER NOT NULL DEFAULT 1"),
            ("communication_score", "ALTER TABLE student_profile ADD COLUMN communication_score INTEGER NOT NULL DEFAULT 70"),
            ("bio", "ALTER TABLE student_profile ADD COLUMN bio TEXT NOT NULL DEFAULT ''"),
            ("github_username", "ALTER TABLE student_profile ADD COLUMN github_username TEXT NOT NULL DEFAULT ''"),
            ("linkedin_url", "ALTER TABLE student_profile ADD COLUMN linkedin_url TEXT NOT NULL DEFAULT ''"),
            ("is_active", "ALTER TABLE student_profile ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1"),
        ]
        for col, sql in migrations:
            if col not in profile_cols:
                conn.execute(sql)

        proj_cols = {r["name"] for r in conn.execute("PRAGMA table_info(student_project)").fetchall()}
        proj_migrations = [
            ("status", "ALTER TABLE student_project ADD COLUMN status TEXT NOT NULL DEFAULT 'completed'"),
            ("attachment_name", "ALTER TABLE student_project ADD COLUMN attachment_name TEXT NOT NULL DEFAULT ''"),
            ("attachment_path", "ALTER TABLE student_project ADD COLUMN attachment_path TEXT NOT NULL DEFAULT ''"),
            ("github_stars", "ALTER TABLE student_project ADD COLUMN github_stars INTEGER NOT NULL DEFAULT 0"),
        ]
        for col, sql in proj_migrations:
            if col not in proj_cols:
                conn.execute(sql)

        if seed_demo:
            count = conn.execute("SELECT COUNT(*) FROM student_profile").fetchone()[0]
            if count == 0:
                _seed_demo_data(conn)


def _seed_demo_data(conn: sqlite3.Connection) -> None:
    """Seed demo Student, Faculty, and Admin users plus assessments, tasks, notes, jobs, and plans."""
    now = _utc_now()
    today = _today_iso()
    student_pw = _hash_password("student123")
    faculty_pw = _hash_password("faculty123")
    admin_pw = _hash_password("admin123")

    ananya_id = conn.execute(
        """INSERT INTO student_profile
           (display_name, email, password_hash, branch, role, target_role, semester, cgpa, xp_points, streak_days, communication_score, bio, github_username, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        ("Ananya Sharma", "ananya@kiet.edu", student_pw, "CSE (AI & ML)", "student", "ml_ai_engineer", 6, 8.4, 480, 7, 78, "B.Tech CSE (AI & ML) student building practical ML & full-stack apps.", "ananya-cs26", now),
    ).lastrowid

    kabir_id = conn.execute(
        """INSERT INTO student_profile
           (display_name, email, password_hash, branch, role, target_role, semester, cgpa, xp_points, streak_days, communication_score, bio, github_username, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        ("Kabir Verma", "kabir@kiet.edu", student_pw, "IT", "student", "fullstack_dev", 5, 7.9, 340, 4, 71, "IT undergraduate passionate about React, TypeScript, and scalable REST APIs.", "kabir-it26", now),
    ).lastrowid

    faculty_id = conn.execute(
        """INSERT INTO student_profile
           (display_name, email, password_hash, branch, role, target_role, semester, cgpa, xp_points, streak_days, communication_score, bio, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        ("Dr. Arvind Mehta", "prof.mehta@kiet.edu", faculty_pw, "CSE", "faculty", "ml_ai_engineer", 8, 9.5, 900, 12, 92, "Associate Professor & Placement Mentor, KIET Department of CSE.", now),
    ).lastrowid

    conn.execute(
        """INSERT INTO student_profile
           (display_name, email, password_hash, branch, role, target_role, semester, cgpa, xp_points, streak_days, communication_score, bio, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        ("Placement Cell Admin", "admin@kiet.edu", admin_pw, "CSE", "admin", "fullstack_dev", 8, 9.8, 1000, 15, 95, "KIET Training & Placement Academic Administrator.", now),
    )

    # Seed skill proficiencies distinguishing verified vs self-reported
    ananya_skill_rows = [
        ("python", 85, "assessment_verified", 85),
        ("dsa", 64, "assessment_verified", 64),
        ("sql_db", 72, "project_verified", 72),
        ("prompt_eng", 80, "project_verified", 80),
        ("ml_basics", 58, "self_reported", 0),
        ("git_collab", 82, "project_verified", 82),
        ("tech_comm", 76, "self_reported", 0),
        ("testing_qa", 52, "project_verified", 52),
    ]
    for sk, prof, src, vs in ananya_skill_rows:
        conn.execute(
            "INSERT INTO student_skills (user_id, skill_key, proficiency, source, verified_score, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
            (ananya_id, sk, prof, src, vs, now),
        )

    kabir_skill_rows = [
        ("js_ts", 80, "assessment_verified", 80),
        ("react_ui", 78, "project_verified", 78),
        ("sql_db", 68, "project_verified", 68),
        ("git_collab", 75, "project_verified", 75),
        ("dsa", 48, "self_reported", 0),
        ("node_express", 55, "self_reported", 0),
        ("tech_comm", 70, "self_reported", 0),
    ]
    for sk, prof, src, vs in kabir_skill_rows:
        conn.execute(
            "INSERT INTO student_skills (user_id, skill_key, proficiency, source, verified_score, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
            (kabir_id, sk, prof, src, vs, now),
        )

    # Seed portfolio projects
    conn.execute(
        """INSERT INTO student_project (user_id, title, summary, tech_stack_json, repo_url, live_url, has_tests, status, github_stars, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            ananya_id,
            "Campus Attendance Anomaly Detector",
            "Scikit-learn classification pipeline flagging irregular lab attendance trends with precision/recall metrics.",
            json.dumps(["python", "ml_basics", "testing_qa", "git_collab"]),
            "https://github.com/ananya-cs26/attendance-anomaly-ml",
            "",
            1,
            "completed",
            14,
            now,
        ),
    )
    conn.execute(
        """INSERT INTO student_project (user_id, title, summary, tech_stack_json, repo_url, live_url, has_tests, status, github_stars, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            ananya_id,
            "Smart Notes Flashcard Studio",
            "Full-stack REST API and React study workspace turning lecture notes into structured revision cards.",
            json.dumps(["prompt_eng", "api_integration", "tech_comm", "sql_db"]),
            "https://github.com/ananya-cs26/notes-flashcard-api",
            "https://notes-flashcard-demo.example.com",
            0,
            "completed",
            9,
            now,
        ),
    )
    conn.execute(
        """INSERT INTO student_project (user_id, title, summary, tech_stack_json, repo_url, live_url, has_tests, status, github_stars, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            kabir_id,
            "Hostel Mess Feedback Portal",
            "React + TypeScript and SQLite web portal allowing students to submit meal ratings and view weekly analytics.",
            json.dumps(["react_ui", "js_ts", "sql_db", "git_collab"]),
            "https://github.com/kabir-it26/hostel-mess-portal",
            "",
            0,
            "completed",
            7,
            now,
        ),
    )

    # Seed progressive snapshots + action plans
    conn.execute(
        """INSERT INTO evidence_snapshot (
               user_id, weekly_study_hours, assessment_score, coding_score,
               project_count, project_level, interview_score, interview_prep_level,
               verified_skills_json, certifications_count, computed_readiness, skill_gaps_json, created_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            ananya_id, 8, 76, 65, 1, "academic_mini", 55, "beginner",
            json.dumps(["python", "git_collab", "sql_db"]), 1, 58,
            json.dumps(["dsa", "ml_basics", "prompt_eng", "testing_qa", "tech_comm"]),
            "2026-11-05 10:00:00",
        ),
    )

    skills = ["python", "dsa", "prompt_eng", "sql_db", "git_collab"]
    gaps = ["ml_basics", "testing_qa", "tech_comm"]
    snap_id = conn.execute(
        """INSERT INTO evidence_snapshot (
               user_id, weekly_study_hours, assessment_score, coding_score,
               project_count, project_level, interview_score, interview_prep_level,
               verified_skills_json, certifications_count, computed_readiness, skill_gaps_json, created_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            ananya_id, 10, 82, 74, 2, "deployed_fullstack", 68, "practicing",
            json.dumps(skills), 2, 75, json.dumps(gaps), now,
        ),
    ).lastrowid

    sample_plan = {
        "title": "9-Hr Weekly Action Plan · AI & Machine Learning Engineer",
        "total_hours": 9,
        "readiness_summary": "Calculated 75/100 (Developing Strong) readiness for AI & Machine Learning Engineer.",
        "action_steps": [
            {
                "title": "Applied ML Pipeline & Model Evaluation Mini-Lab",
                "hours": 4,
                "focus_skill": "Machine Learning & Deep Learning",
                "category": "AI & Data",
                "deliverable": "Train and benchmark a baseline classifier reporting precision, recall, and F1.",
                "rationale": "Builds quantitative model benchmark evidence required for AI/ML roles.",
                "completed": True,
            },
            {
                "title": "Automated Testing & Edge-Case Verification",
                "hours": 3,
                "focus_skill": "Software Testing & QA Automation",
                "category": "Quality & QA",
                "deliverable": "Write 6+ automated unit/integration test cases covering invalid inputs and fallbacks.",
                "rationale": "Proves engineering reliability and systematic testing discipline.",
                "completed": True,
            },
            {
                "title": "Technical Communication, Resume & STAR Defense Drill",
                "hours": 2,
                "focus_skill": "Technical Communication & Docs",
                "category": "Career Readiness",
                "deliverable": "Refine 2 project bullet summaries with measurable impact and rehearse 90-second pitches.",
                "rationale": "Bridges building strong projects and explaining them clearly in interviews.",
                "completed": False,
            },
        ],
        "interview_questions": [
            {
                "question": "Why is a hybrid approach (deterministic rules + LLM output validator) safer than letting an LLM control hard constraints?",
                "topic": "AI Safety & Architecture",
                "hint": "Discuss hallucination risk, deterministic constraint enforcement, and schema verification.",
            },
            {
                "question": "How do you evaluate a classification or recommendation model beyond raw accuracy?",
                "topic": "Model Evaluation",
                "hint": "Mention precision, recall, F1, edge-case testing, and data leakage prevention.",
            },
        ],
        "explanation": "Calculated 75/100 (Developing Strong) readiness for AI & Machine Learning Engineer.",
        "safety_note": "Advisory academic and career-readiness guidance only.",
        "source": "python_rule_fallback",
        "metrics": {
            "overall_score": 75,
            "readiness_band": "Developing Strong",
            "pillars": {"academic": 83, "technical_skills": 68, "projects": 74, "interview_prep": 66},
            "matched_skills": skills,
            "skill_gaps": gaps,
            "benchmark_total": 8,
        },
    }
    plan_id = conn.execute(
        "INSERT INTO action_plan (snapshot_id, title, total_hours, content_json, source, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        (snap_id, sample_plan["title"], sample_plan["total_hours"], json.dumps(sample_plan), "python_rule_fallback", now),
    ).lastrowid
    conn.execute(
        "INSERT INTO readiness_completion (user_id, plan_id, status, notes, completed_at) VALUES (?, ?, ?, ?, ?)",
        (ananya_id, plan_id, "completed", "Completed ML baseline benchmark and wrote 6 automated unit tests.", now),
    )

    kabir_skills = ["js_ts", "react_ui", "sql_db", "git_collab"]
    kabir_gaps = ["node_express", "api_integration", "cloud_deploy", "testing_qa"]
    kabir_snap_id = conn.execute(
        """INSERT INTO evidence_snapshot (
               user_id, weekly_study_hours, assessment_score, coding_score,
               project_count, project_level, interview_score, interview_prep_level,
               verified_skills_json, certifications_count, computed_readiness, skill_gaps_json, created_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            kabir_id, 12, 74, 69, 1, "academic_mini", 60, "practicing",
            json.dumps(kabir_skills), 1, 63, json.dumps(kabir_gaps), now,
        ),
    ).lastrowid
    kabir_plan = {
        "title": "9-Hr Weekly Action Plan · Full-Stack Software Developer",
        "total_hours": 9,
        "readiness_summary": "Calculated 63/100 (Building Momentum) readiness for Full-Stack Software Developer.",
        "action_steps": [
            {
                "title": "Node.js & REST API Architecture Lab",
                "hours": 4,
                "focus_skill": "Node.js & Express APIs",
                "category": "Backend",
                "deliverable": "Build structured REST endpoints with middleware validation and clean error responses.",
                "rationale": "Pairs React + TypeScript frontend experience with production backend skills.",
                "completed": True,
            },
            {
                "title": "REST API Integration & Resilience Sprint",
                "hours": 3,
                "focus_skill": "REST APIs & Backend Integration",
                "category": "Project Proof",
                "deliverable": "Connect your Hostel Mess Portal client to validated API routes with error & loading states.",
                "rationale": "Upgrades an academic mini-project into an end-to-end full-stack architecture.",
                "completed": False,
            },
            {
                "title": "Cloud Deployment & Environment Security Setup",
                "hours": 2,
                "focus_skill": "Cloud Computing (AWS / GCP)",
                "category": "Cloud",
                "deliverable": "Deploy a live project URL with .env.example config and automated health checks.",
                "rationale": "Turns local coursework into a shareable live portfolio artifact for recruiters.",
                "completed": False,
            },
        ],
        "interview_questions": [
            {
                "question": "How do you prevent SQL injection and broken foreign keys in a full-stack web application?",
                "topic": "Database & Security",
                "hint": "Mention parameterized SQL queries, PRAGMA foreign_keys, and server-side input validation.",
            },
        ],
        "explanation": "Calculated 63/100 (Building Momentum) readiness for Full-Stack Software Developer.",
        "safety_note": "Advisory academic and career-readiness guidance only.",
        "source": "python_rule_fallback",
        "metrics": {
            "overall_score": 63,
            "readiness_band": "Building Momentum",
            "pillars": {"academic": 76, "technical_skills": 60, "projects": 46, "interview_prep": 59},
            "matched_skills": kabir_skills,
            "skill_gaps": kabir_gaps,
            "benchmark_total": 8,
        },
    }
    conn.execute(
        "INSERT INTO action_plan (snapshot_id, title, total_hours, content_json, source, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        (kabir_snap_id, kabir_plan["title"], kabir_plan["total_hours"], json.dumps(kabir_plan), "python_rule_fallback", now),
    )

    # Seed Daily Tasks for Ananya & Kabir
    for uid, title, cat, prio, done in [
        (ananya_id, "Complete 5 Graph BFS/DFS coding problems", "DSA Practice", "high", 0),
        (ananya_id, "Upload ML Unit-3 Revision Notes PDF", "Study Notes", "medium", 1),
        (ananya_id, "Run AI Resume ATS check before campus drive", "Career Prep", "high", 0),
        (kabir_id, "Build Express validation middleware for Mess Portal", "Project Sprint", "high", 0),
        (kabir_id, "Review SQL JOINs & Indexing cheat sheet", "Database", "medium", 1),
    ]:
        conn.execute(
            "INSERT INTO daily_tasks (user_id, title, category, priority, target_date, completed, xp_reward, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (uid, title, cat, prio, today, done, 30 if prio == "high" else 20, now),
        )

    # Seed Study Notes
    conn.execute(
        """INSERT INTO study_notes (user_id, title, subject, content, file_name, mime_type, file_size, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            ananya_id,
            "ML Model Evaluation & Precision-Recall Notes",
            "Machine Learning",
            "Key Takeaways:\n1. Use Precision, Recall, and F1-Score when classes are imbalanced.\n2. Always split train/validation/test before scaling to prevent data leakage.\n3. Track confusion matrix false negatives for anomaly detection labs.",
            "",
            "text/plain",
            245,
            now,
        ),
    )
    conn.execute(
        """INSERT INTO study_notes (user_id, title, subject, content, file_name, mime_type, file_size, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            ananya_id,
            "DSA Dynamic Programming & Graph Patterns",
            "Data Structures",
            "Patterns to revise before placements:\n- BFS shortest path in unweighted graphs\n- Topological sort (Kahn's algorithm) for dependency scheduling\n- 1D/2D Knapsack state transitions & memoization.",
            "",
            "text/plain",
            210,
            now,
        ),
    )

    # Seed Smart Assessments & Questions
    assessments_seed = [
        (
            "Technical Core: DSA, Python & Java OOP",
            "Technical MCQ & Coding",
            "Timed 10-minute diagnostic covering time complexity, data structures, OOP principles, and Python/Java semantics.",
            10,
            json.dumps(["dsa", "python", "java_oop"]),
            [
                ("What is the average-case time complexity of searching for a key in a balanced hash table?", ["O(1)", "O(log n)", "O(n)", "O(n log n)"], 0, "Hash Tables & Complexity", "Hash tables compute bucket indices in constant average time O(1)."),
                ("Which graph traversal guarantees the shortest path (fewest edges) in an unweighted graph?", ["Depth-First Search (DFS)", "Breadth-First Search (BFS)", "Binary Search", "Prim's Algorithm"], 1, "Graph Algorithms", "BFS explores level by level, guaranteeing the minimum edge distance first."),
                ("In Object-Oriented Programming, which SOLID principle states classes should depend on abstractions rather than concrete implementations?", ["Single Responsibility", "Open-Closed", "Dependency Inversion", "Liskov Substitution"], 2, "OOP Design", "Dependency Inversion decouples high-level modules from low-level details via interfaces."),
                ("What does Python's `with open(...) as f:` statement guarantee?", ["Faster disk I/O speed", "Automatic resource cleanup via context manager even on exceptions", "Multithreaded file locking", "Automatic JSON serialization"], 1, "Python Best Practices", "Context managers invoke __exit__ to close file handles cleanly even when errors occur."),
                ("Which data structure uses LIFO ordering and backs function call stacks and undo history?", ["Queue", "Min-Heap", "Stack", "Trie"], 2, "Linear Data Structures", "A Stack follows Last-In, First-Out (LIFO) ordering."),
            ],
        ),
        (
            "Full-Stack Web, React & SQL Systems",
            "Web & Database",
            "Evaluates frontend state management, REST API status codes, SQL joins, and relational integrity.",
            10,
            json.dumps(["react_ui", "js_ts", "sql_db", "api_integration"]),
            [
                ("Which SQL JOIN returns all rows from the left table even when there is no matching row in the right table?", ["INNER JOIN", "LEFT JOIN", "CROSS JOIN", "SELF JOIN"], 1, "SQL Joins", "LEFT JOIN preserves every row from the left table and fills unmatched right columns with NULL."),
                ("Which HTTP status code indicates a new resource was successfully created by a POST endpoint?", ["200 OK", "201 Created", "204 No Content", "409 Conflict"], 1, "REST API Design", "201 Created signals successful resource creation."),
                ("Why should relational database queries always use parameterized placeholders (?) instead of string concatenation?", ["To reduce query length", "To prevent SQL injection attacks and safely bind types", "To bypass foreign key checks", "To enable CSS styling"], 1, "Database Security", "Parameterized queries separate SQL syntax from user-supplied data."),
                ("In React, why must `useEffect` include accurate dependency arrays?", ["To style components automatically", "To re-run side effects only when relevant state or props change", "To compile TypeScript faster", "To disable browser caching"], 1, "React Hooks", "Dependencies prevent stale closures and redundant network fetches."),
            ],
        ),
        (
            "Aptitude, Logical Reasoning & Communication",
            "Aptitude & Soft Skills",
            "Placement screening readiness check combining quantitative aptitude, logical deduction, and workplace communication.",
            10,
            json.dumps(["problem_solving", "tech_comm", "interview_story"]),
            [
                ("A train travels 180 km in 3 hours and the next 120 km in 2 hours. What is its average speed for the entire journey?", ["55 km/h", "60 km/h", "65 km/h", "70 km/h"], 1, "Quantitative Aptitude", "Total distance (300 km) divided by total time (5 hrs) = 60 km/h."),
                ("All developers in a cohort know Git. Some people who know Git also know Docker. Which conclusion is definitely true?", ["All developers know Docker", "No developer knows Docker", "Knowing Git does not guarantee knowing Docker", "Everyone knowing Docker is a developer"], 2, "Logical Reasoning", "Only 'some' Git users know Docker, so knowing Git alone doesn't guarantee Docker."),
                ("When answering a behavioral interview question using STAR, what does the 'R' stand for?", ["Review", "Result (quantified outcome)", "Responsibility", "Requirement"], 1, "Interview Communication", "STAR stands for Situation, Task, Action, and Result—ideally quantified."),
                ("In technical documentation or PR reviews, what makes feedback most actionable?", ["Vague opinion statements", "Specific reproduction steps, expected vs actual behavior, and concise tone", "Only emojis", "Rewriting the whole app silently"], 1, "Technical Communication", "Clear context and specific suggestions speed up engineering collaboration."),
            ],
        ),
    ]

    for title, cat, desc, dur, sk_json, questions in assessments_seed:
        aid = conn.execute(
            "INSERT INTO assessments (title, category, description, duration_minutes, skill_keys_json, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (title, cat, desc, dur, sk_json, faculty_id, now),
        ).lastrowid
        for q_prompt, opts, corr, topic, expl in questions:
            conn.execute(
                "INSERT INTO assessment_questions (assessment_id, prompt, options_json, correct_index, topic, explanation) VALUES (?, ?, ?, ?, ?, ?)",
                (aid, q_prompt, json.dumps(opts), corr, topic, expl),
            )

    # Seed an initial assessment result for Ananya so dashboard & analytics show real data immediately
    conn.execute(
        """INSERT INTO assessment_results
           (user_id, assessment_id, score_pct, correct_count, total_count, weak_topics_json, answers_json, ai_feedback, time_taken_sec, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            ananya_id,
            1,
            80,
            4,
            5,
            json.dumps(["Graph Algorithms"]),
            json.dumps([0, 0, 2, 1, 2]),
            "Strong grasp of hash tables, OOP, and Python context managers. Focus 20 minutes on BFS vs DFS shortest-path guarantees.",
            310,
            now,
        ),
    )

    # Seed Courses & Learning Resources
    courses_seed = [
        ("CS50 & Practical DSA Foundations", "Harvard / OpenCourseWare", "Algorithms & CS Core", "ml_ai_engineer", 12, "https://cs50.harvard.edu", ["dsa", "problem_solving"]),
        ("Full-Stack TypeScript, React & REST APIs", "Full Stack Open", "Web Engineering", "fullstack_dev", 16, "https://fullstackopen.com", ["js_ts", "react_ui", "node_express", "api_integration"]),
        ("Practical Deep Learning & Model Evaluation", "fast.ai", "AI & Machine Learning", "ml_ai_engineer", 14, "https://course.fast.ai", ["ml_basics", "python", "testing_qa"]),
        ("Docker, Linux & CI/CD Pipelines", "Docker Docs & GitHub Skills", "Cloud & DevOps", "cloud_devops", 8, "https://skills.github.com", ["docker_cicd", "cloud_deploy", "git_collab"]),
        ("Figma UI/UX Design Systems & Accessibility", "Figma Learn", "Product Design", "ui_ux_product", 8, "https://help.figma.com", ["ui_ux_figma", "tech_comm"]),
        ("OWASP Web Application Security Essentials", "OWASP Foundation", "Cybersecurity", "cybersecurity_analyst", 10, "https://owasp.org/www-project-top-ten/", ["cyber_sec", "api_integration"]),
    ]
    for title, prov, cat, role_k, hrs, url, sks in courses_seed:
        conn.execute(
            "INSERT INTO courses (title, provider, category, target_role, duration_hours, resource_url, skill_keys_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (title, prov, cat, role_k, hrs, url, json.dumps(sks), now),
        )

    # Seed Sample LinkedIn-Style Career & Job Updates (explicitly marked is_sample=1)
    jobs_seed = [
        (
            "Junior AI / ML Engineer Intern",
            "DataWeave Labs (Campus Partner)",
            "Bengaluru · Hybrid",
            "Hybrid",
            "Internship · 6 Months",
            "₹35,000 / mo",
            "ml_ai_engineer",
            ["python", "ml_basics", "sql_db", "prompt_eng", "git_collab"],
            "Work with applied ML engineers on document extraction, model evaluation benchmarks, and prompt validation pipelines.",
            "https://example.com/campus-jobs/dataweave-ml-intern",
        ),
        (
            "Full-Stack Software Engineer Trainee",
            "CloudBridge Systems",
            "Noida / Delhi NCR · Hybrid",
            "Hybrid",
            "Full-Time · Fresher 2026",
            "8.5 LPA",
            "fullstack_dev",
            ["js_ts", "react_ui", "node_express", "sql_db", "api_integration", "git_collab"],
            "Build modern SaaS dashboards in React + TypeScript backed by REST APIs, relational SQL databases, and automated tests.",
            "https://example.com/campus-jobs/cloudbridge-sde",
        ),
        (
            "Backend & API Systems Intern",
            "FinPulse Technologies",
            "Remote (India)",
            "Remote",
            "Internship · PPO Track",
            "₹30,000 / mo",
            "python_backend",
            ["java_oop", "python", "sql_db", "api_integration", "testing_qa", "docker_cicd"],
            "Design resilient backend microservices, write integration tests, and optimize SQL queries for financial workflows.",
            "https://example.com/campus-jobs/finpulse-backend",
        ),
        (
            "Product UI/UX & Frontend Intern",
            "CraftGrid Studio",
            "Remote (India)",
            "Remote",
            "Internship · 3 Months",
            "₹22,000 / mo",
            "ui_ux_product",
            ["ui_ux_figma", "react_ui", "js_ts", "tech_comm", "agile_team"],
            "Create accessible Figma component libraries, prototype user journeys, and collaborate with engineers on React UI polish.",
            "https://example.com/campus-jobs/craftgrid-uiux",
        ),
        (
            "Data & Business Analytics Associate",
            "MetricFlow Analytics",
            "Gurugram · On-site",
            "On-site",
            "Full-Time · Campus Drive",
            "6.5 LPA",
            "data_analyst",
            ["sql_db", "python", "data_viz", "problem_solving", "tech_comm"],
            "Transform multi-table product usage logs into executive KPI dashboards and cohort retention insights.",
            "https://example.com/campus-jobs/metricflow-analyst",
        ),
        (
            "Cloud & DevOps Trainee",
            "ScaleOps Infrastructure",
            "Pune · Hybrid",
            "Hybrid",
            "Full-Time",
            "7.5 LPA",
            "cloud_devops",
            ["docker_cicd", "cloud_deploy", "git_collab", "cyber_sec", "testing_qa"],
            "Automate CI/CD test pipelines, containerize microservices, and enforce secrets & cloud security policies.",
            "https://example.com/campus-jobs/scaleops-devops",
        ),
    ]
    for title, comp, loc, wmode, jtype, pay, role_k, reqs, desc, url in jobs_seed:
        conn.execute(
            """INSERT INTO job_opportunities
               (title, company, location, work_mode, job_type, compensation, target_role, required_skills_json, description, apply_url, is_sample, posted_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)""",
            (title, comp, loc, wmode, jtype, pay, role_k, json.dumps(reqs), desc, url, today),
        )

    # Seed Faculty Feedback & Notification
    conn.execute(
        "INSERT INTO faculty_feedback (student_id, faculty_id, category, comment, created_at) VALUES (?, ?, ?, ?, ?)",
        (ananya_id, faculty_id, "Project & Skill Readiness", "Great precision/recall evaluation on your Attendance Detector project. Add 2 more graph/DP timed quizzes before next month's placement drive.", now),
    )
    conn.execute(
        "INSERT INTO notifications (user_id, title, message, kind, is_read, created_at) VALUES (?, ?, ?, ?, 0, ?)",
        (ananya_id, "Faculty Mentor Feedback Received", "Dr. Arvind Mehta reviewed your Attendance Detector project and shared readiness advice.", "faculty", now),
    )
    conn.execute(
        "INSERT INTO notifications (user_id, title, message, kind, is_read, created_at) VALUES (?, ?, ?, ?, 0, ?)",
        (ananya_id, "New Campus Internship Alert", "DataWeave Labs Junior AI/ML Intern matches 4 of your 5 verified skills.", "job", now),
    )

    # Seed App Settings
    for k, v in [
        ("institution_name", "KIET University"),
        ("min_placement_readiness", "75"),
        ("weekly_xp_goal", "250"),
        ("allow_student_registration", "true"),
    ]:
        conn.execute(
            "INSERT INTO app_settings (setting_key, setting_value, updated_at) VALUES (?, ?, ?)",
            (k, v, now),
        )


def _format_profile_row(row: sqlite3.Row | None) -> Optional[Dict[str, Any]]:
    if not row:
        return None
    d = dict(row)
    d["is_active"] = bool(d.get("is_active", 1))
    return d


def list_profiles(db_path: str = DEFAULT_DB_PATH) -> List[Dict[str, Any]]:
    init_db(db_path)
    with get_connection(db_path) as conn:
        rows = conn.execute(
            f"SELECT {_PROFILE_COLUMNS} FROM student_profile ORDER BY user_id ASC"
        ).fetchall()
        return [_format_profile_row(r) for r in rows if r]


def get_profile(user_id: int, db_path: str = DEFAULT_DB_PATH) -> Optional[Dict[str, Any]]:
    init_db(db_path)
    with get_connection(db_path) as conn:
        row = conn.execute(
            f"SELECT {_PROFILE_COLUMNS} FROM student_profile WHERE user_id = ?",
            (user_id,),
        ).fetchone()
        return _format_profile_row(row)


def create_profile(
    display_name: str,
    target_role: str,
    semester: int,
    cgpa: float,
    db_path: str = DEFAULT_DB_PATH,
    email: str = "",
    branch: str = "CSE",
    password: str = "",
    role: str = "student",
) -> Dict[str, Any]:
    init_db(db_path)
    now = _utc_now()
    pw_hash = _hash_password(password) if password else ""
    clean_email = email.strip().lower() if email else None
    safe_role = role if role in ("student", "faculty", "admin") else "student"
    with get_connection(db_path) as conn:
        cur = conn.execute(
            """INSERT INTO student_profile
               (display_name, email, password_hash, branch, role, target_role, semester, cgpa, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (display_name, clean_email, pw_hash, branch or "CSE", safe_role, target_role, semester, cgpa, now),
        )
        row = conn.execute(
            f"SELECT {_PROFILE_COLUMNS} FROM student_profile WHERE user_id = ?",
            (cur.lastrowid,),
        ).fetchone()
        return _format_profile_row(row)  # type: ignore[return-value]


def signup_student(
    display_name: str,
    email: str,
    password: str,
    branch: str,
    target_role: str,
    semester: int,
    cgpa: float,
    db_path: str = DEFAULT_DB_PATH,
    role: str = "student",
) -> Optional[Dict[str, Any]]:
    init_db(db_path)
    clean_email = email.strip().lower()
    with get_connection(db_path) as conn:
        existing = conn.execute(
            "SELECT user_id FROM student_profile WHERE lower(email) = ?",
            (clean_email,),
        ).fetchone()
        if existing:
            return None
    return create_profile(
        display_name=display_name,
        target_role=target_role,
        semester=semester,
        cgpa=cgpa,
        db_path=db_path,
        email=clean_email,
        branch=branch,
        password=password,
        role=role,
    )


def signin_student(
    email: str, password: str, db_path: str = DEFAULT_DB_PATH
) -> Optional[Dict[str, Any]]:
    init_db(db_path)
    clean_email = email.strip().lower()
    with get_connection(db_path) as conn:
        row = conn.execute(
            f"SELECT {_PROFILE_COLUMNS}, password_hash FROM student_profile WHERE lower(email) = ?",
            (clean_email,),
        ).fetchone()
        if not row:
            return None
        if not bool(row["is_active"]):
            return None
        if not _verify_password(password, row["password_hash"]):
            return None
        result = dict(row)
        result.pop("password_hash", None)
        result["is_active"] = bool(result.get("is_active", 1))
        return result


def reset_password_by_email(
    email: str, new_password: str, db_path: str = DEFAULT_DB_PATH
) -> bool:
    init_db(db_path)
    clean_email = email.strip().lower()
    with get_connection(db_path) as conn:
        row = conn.execute(
            "SELECT user_id FROM student_profile WHERE lower(email) = ?",
            (clean_email,),
        ).fetchone()
        if not row:
            return False
        conn.execute(
            "UPDATE student_profile SET password_hash = ? WHERE user_id = ?",
            (_hash_password(new_password), row["user_id"]),
        )
        return True


def update_profile(
    user_id: int,
    display_name: str,
    target_role: str,
    semester: int,
    cgpa: float,
    db_path: str = DEFAULT_DB_PATH,
    branch: str | None = None,
    bio: str | None = None,
    github_username: str | None = None,
    linkedin_url: str | None = None,
) -> Optional[Dict[str, Any]]:
    init_db(db_path)
    with get_connection(db_path) as conn:
        current = conn.execute(
            "SELECT branch, bio, github_username, linkedin_url FROM student_profile WHERE user_id = ?",
            (user_id,),
        ).fetchone()
        if not current:
            return None
        conn.execute(
            """UPDATE student_profile
               SET display_name = ?, target_role = ?, semester = ?, cgpa = ?,
                   branch = ?, bio = ?, github_username = ?, linkedin_url = ?
               WHERE user_id = ?""",
            (
                display_name,
                target_role,
                semester,
                cgpa,
                branch if branch is not None else current["branch"],
                bio if bio is not None else current["bio"],
                github_username if github_username is not None else current["github_username"],
                linkedin_url if linkedin_url is not None else current["linkedin_url"],
                user_id,
            ),
        )
        row = conn.execute(
            f"SELECT {_PROFILE_COLUMNS} FROM student_profile WHERE user_id = ?",
            (user_id,),
        ).fetchone()
        return _format_profile_row(row)


def award_xp(user_id: int, amount: int, db_path: str = DEFAULT_DB_PATH) -> None:
    if amount <= 0:
        return
    with get_connection(db_path) as conn:
        conn.execute(
            "UPDATE student_profile SET xp_points = xp_points + ? WHERE user_id = ?",
            (amount, user_id),
        )


# Portfolio Projects CRUD
def list_projects(user_id: int, db_path: str = DEFAULT_DB_PATH) -> List[Dict[str, Any]]:
    init_db(db_path)
    with get_connection(db_path) as conn:
        rows = conn.execute(
            """
            SELECT project_id, user_id, title, summary, tech_stack_json, repo_url, live_url,
                   has_tests, status, attachment_name, attachment_path, github_stars, created_at
            FROM student_project
            WHERE user_id = ?
            ORDER BY project_id DESC
            """,
            (user_id,),
        ).fetchall()
        results: List[Dict[str, Any]] = []
        for r in rows:
            item = dict(r)
            item["tech_stack"] = json.loads(item.pop("tech_stack_json"))
            item["has_tests"] = bool(item["has_tests"])
            results.append(item)
        return results


def create_project(
    user_id: int,
    title: str,
    summary: str,
    tech_stack: List[str],
    repo_url: str = "",
    live_url: str = "",
    has_tests: bool = False,
    db_path: str = DEFAULT_DB_PATH,
    status: str = "completed",
    attachment_name: str = "",
    attachment_path: str = "",
    github_stars: int = 0,
) -> Dict[str, Any]:
    init_db(db_path)
    now = _utc_now()
    with get_connection(db_path) as conn:
        cur = conn.execute(
            """
            INSERT INTO student_project
            (user_id, title, summary, tech_stack_json, repo_url, live_url, has_tests, status, attachment_name, attachment_path, github_stars, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                user_id,
                title,
                summary,
                json.dumps(tech_stack),
                repo_url,
                live_url,
                1 if has_tests else 0,
                status if status in ("in_progress", "completed") else "completed",
                attachment_name,
                attachment_path,
                int(github_stars or 0),
                now,
            ),
        )
        # Auto-mark associated skills at project_verified if not already assessment_verified
        for sk in tech_stack:
            existing = conn.execute(
                "SELECT source, proficiency FROM student_skills WHERE user_id = ? AND skill_key = ?",
                (user_id, sk),
            ).fetchone()
            if not existing:
                conn.execute(
                    "INSERT INTO student_skills (user_id, skill_key, proficiency, source, verified_score, updated_at) VALUES (?, ?, 70, 'project_verified', 70, ?)",
                    (user_id, sk, now),
                )
            elif existing["source"] == "self_reported":
                conn.execute(
                    "UPDATE student_skills SET source = 'project_verified', proficiency = MAX(proficiency, 70), verified_score = MAX(verified_score, 70), updated_at = ? WHERE user_id = ? AND skill_key = ?",
                    (now, user_id, sk),
                )

        conn.execute(
            "UPDATE student_profile SET xp_points = xp_points + 40 WHERE user_id = ?",
            (user_id,),
        )

        row = conn.execute(
            """
            SELECT project_id, user_id, title, summary, tech_stack_json, repo_url, live_url,
                   has_tests, status, attachment_name, attachment_path, github_stars, created_at
            FROM student_project WHERE project_id = ?
            """,
            (cur.lastrowid,),
        ).fetchone()
        item = dict(row)
        item["tech_stack"] = json.loads(item.pop("tech_stack_json"))
        item["has_tests"] = bool(item["has_tests"])
        return item


def delete_project(project_id: int, db_path: str = DEFAULT_DB_PATH) -> bool:
    init_db(db_path)
    with get_connection(db_path) as conn:
        cur = conn.execute("DELETE FROM student_project WHERE project_id = ?", (project_id,))
        return cur.rowcount > 0


# Evidence Snapshots & Action Plans
def save_evidence_snapshot(
    user_id: int,
    weekly_study_hours: int,
    assessment_score: int,
    coding_score: int,
    project_count: int,
    project_level: str,
    interview_score: int,
    interview_prep_level: str,
    verified_skills: List[str],
    certifications_count: int,
    computed_readiness: int,
    skill_gaps: List[str],
    db_path: str = DEFAULT_DB_PATH,
) -> int:
    init_db(db_path)
    now = _utc_now()
    with get_connection(db_path) as conn:
        cur = conn.execute(
            """
            INSERT INTO evidence_snapshot (
                user_id, weekly_study_hours, assessment_score, coding_score,
                project_count, project_level, interview_score, interview_prep_level,
                verified_skills_json, certifications_count, computed_readiness, skill_gaps_json, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                user_id, weekly_study_hours, assessment_score, coding_score,
                project_count, project_level, interview_score, interview_prep_level,
                json.dumps(verified_skills), certifications_count, computed_readiness,
                json.dumps(skill_gaps), now,
            ),
        )
        return int(cur.lastrowid)


def save_action_plan(
    snapshot_id: int,
    plan: Dict[str, Any],
    db_path: str = DEFAULT_DB_PATH,
) -> Dict[str, Any]:
    init_db(db_path)
    now = _utc_now()
    source = str(plan.get("source", "python_rule_fallback"))
    with get_connection(db_path) as conn:
        cur = conn.execute(
            """
            INSERT INTO action_plan (snapshot_id, title, total_hours, content_json, source, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                snapshot_id,
                plan["title"],
                int(plan["total_hours"]),
                json.dumps(plan),
                source,
                now,
            ),
        )
        plan_id = int(cur.lastrowid)
        return {
            "plan_id": plan_id,
            "snapshot_id": snapshot_id,
            "created_at": now,
            **plan,
        }


def get_plan_with_snapshot(plan_id: int, db_path: str = DEFAULT_DB_PATH) -> Optional[Dict[str, Any]]:
    init_db(db_path)
    with get_connection(db_path) as conn:
        row = conn.execute(
            """
            SELECT ap.plan_id, ap.snapshot_id, ap.content_json, ap.source, ap.created_at,
                   es.user_id, es.weekly_study_hours, es.computed_readiness, es.skill_gaps_json,
                   sp.target_role
            FROM action_plan ap
            JOIN evidence_snapshot es ON ap.snapshot_id = es.snapshot_id
            JOIN student_profile sp ON es.user_id = sp.user_id
            WHERE ap.plan_id = ?
            """,
            (plan_id,),
        ).fetchone()
        if not row:
            return None
        data = dict(row)
        data["content"] = json.loads(data.pop("content_json"))
        data["skill_gaps"] = json.loads(data.pop("skill_gaps_json"))
        return data


def update_action_plan_content(
    plan_id: int, plan: Dict[str, Any], db_path: str = DEFAULT_DB_PATH
) -> Optional[Dict[str, Any]]:
    init_db(db_path)
    with get_connection(db_path) as conn:
        conn.execute(
            "UPDATE action_plan SET title = ?, total_hours = ?, content_json = ? WHERE plan_id = ?",
            (plan["title"], int(plan["total_hours"]), json.dumps(plan), plan_id),
        )
        row = conn.execute(
            "SELECT plan_id, snapshot_id, content_json, created_at FROM action_plan WHERE plan_id = ?",
            (plan_id,),
        ).fetchone()
        if not row:
            return None
        parsed = json.loads(row["content_json"])
        return {
            "plan_id": row["plan_id"],
            "snapshot_id": row["snapshot_id"],
            "created_at": row["created_at"],
            **parsed,
        }


def toggle_action_step(
    plan_id: int, step_index: int, db_path: str = DEFAULT_DB_PATH
) -> Optional[Dict[str, Any]]:
    bundle = get_plan_with_snapshot(plan_id, db_path)
    if not bundle:
        return None
    content = bundle["content"]
    steps = content.get("action_steps", [])
    if not (0 <= step_index < len(steps)):
        return None
    steps[step_index]["completed"] = not bool(steps[step_index].get("completed", False))
    content["action_steps"] = steps
    return update_action_plan_content(plan_id, content, db_path)


def record_completion(
    user_id: int,
    plan_id: int,
    status: str,
    notes: str = "",
    db_path: str = DEFAULT_DB_PATH,
) -> Dict[str, Any]:
    init_db(db_path)
    now = _utc_now()
    with get_connection(db_path) as conn:
        cur = conn.execute(
            """
            INSERT INTO readiness_completion (user_id, plan_id, status, notes, completed_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (user_id, plan_id, status, notes, now),
        )
        if status == "completed":
            conn.execute("UPDATE student_profile SET xp_points = xp_points + 35 WHERE user_id = ?", (user_id,))
        comp_id = int(cur.lastrowid)
        row = conn.execute(
            """
            SELECT rc.completion_id, rc.user_id, rc.plan_id, rc.status, rc.notes, rc.completed_at,
                   ap.title, ap.total_hours, ap.source,
                   es.computed_readiness, es.weekly_study_hours, sp.display_name, sp.target_role
            FROM readiness_completion rc
            JOIN student_profile sp ON rc.user_id = sp.user_id
            JOIN action_plan ap ON rc.plan_id = ap.plan_id
            JOIN evidence_snapshot es ON ap.snapshot_id = es.snapshot_id
            WHERE rc.completion_id = ?
            """,
            (comp_id,),
        ).fetchone()
        return dict(row)


def get_history(user_id: Optional[int] = None, db_path: str = DEFAULT_DB_PATH) -> List[Dict[str, Any]]:
    init_db(db_path)
    with get_connection(db_path) as conn:
        query = """
            SELECT rc.completion_id, rc.user_id, sp.display_name, sp.target_role,
                   rc.plan_id, rc.status, rc.notes, rc.completed_at,
                   ap.title, ap.total_hours, ap.source,
                   es.computed_readiness, es.weekly_study_hours, es.project_level
            FROM readiness_completion rc
            JOIN student_profile sp ON rc.user_id = sp.user_id
            JOIN action_plan ap ON rc.plan_id = ap.plan_id
            JOIN evidence_snapshot es ON ap.snapshot_id = es.snapshot_id
        """
        params: tuple[Any, ...] = ()
        if user_id is not None:
            query += " WHERE rc.user_id = ?"
            params = (user_id,)
        query += " ORDER BY rc.completion_id DESC"
        rows = conn.execute(query, params).fetchall()
        return [dict(r) for r in rows]


def get_readiness_trend(user_id: int, db_path: str = DEFAULT_DB_PATH) -> List[Dict[str, Any]]:
    init_db(db_path)
    with get_connection(db_path) as conn:
        rows = conn.execute(
            """
            SELECT snapshot_id, computed_readiness, assessment_score, coding_score,
                   interview_score, project_count, created_at
            FROM evidence_snapshot
            WHERE user_id = ?
            ORDER BY snapshot_id ASC
            """,
            (user_id,),
        ).fetchall()
        return [dict(r) for r in rows]


def get_latest_snapshot(user_id: int, db_path: str = DEFAULT_DB_PATH) -> Optional[Dict[str, Any]]:
    init_db(db_path)
    with get_connection(db_path) as conn:
        row = conn.execute(
            "SELECT * FROM evidence_snapshot WHERE user_id = ? ORDER BY snapshot_id DESC LIMIT 1",
            (user_id,),
        ).fetchone()
        if not row:
            return None
        d = dict(row)
        d["verified_skills"] = json.loads(d.pop("verified_skills_json"))
        d["skill_gaps"] = json.loads(d.pop("skill_gaps_json"))
        return d


def get_latest_plan_for_user(user_id: int, db_path: str = DEFAULT_DB_PATH) -> Optional[Dict[str, Any]]:
    init_db(db_path)
    with get_connection(db_path) as conn:
        row = conn.execute(
            """
            SELECT ap.plan_id, ap.snapshot_id, ap.content_json, ap.source, ap.created_at
            FROM action_plan ap
            JOIN evidence_snapshot es ON ap.snapshot_id = es.snapshot_id
            WHERE es.user_id = ?
            ORDER BY ap.plan_id DESC
            LIMIT 1
            """,
            (user_id,),
        ).fetchone()
        if not row:
            return None
        parsed = json.loads(row["content_json"])
        return {
            "plan_id": row["plan_id"],
            "snapshot_id": row["snapshot_id"],
            "created_at": row["created_at"],
            "source": row["source"],
            **parsed,
        }


# Skill Gap Analyzer (Proficiency + Benchmark Comparison)
def get_student_skill_profile(user_id: int, db_path: str = DEFAULT_DB_PATH) -> Dict[str, Any]:
    init_db(db_path)
    profile = get_profile(user_id, db_path)
    if not profile:
        return {"skills": [], "comparison": [], "missing_skills": [], "strengths": [], "weaknesses": [], "overall_gap_pct": 100}

    target_role = profile["target_role"]
    required = ROLE_BENCHMARKS.get(target_role, ROLE_BENCHMARKS["fullstack_dev"])
    target_threshold = 75

    with get_connection(db_path) as conn:
        rows = conn.execute(
            "SELECT skill_key, proficiency, source, verified_score, updated_at FROM student_skills WHERE user_id = ?",
            (user_id,),
        ).fetchall()
        skill_map = {r["skill_key"]: dict(r) for r in rows}

    skills_list: List[Dict[str, Any]] = []
    for key, label in SKILL_OPTIONS.items():
        rec = skill_map.get(key)
        skills_list.append(
            {
                "skill_key": key,
                "label": label,
                "proficiency": rec["proficiency"] if rec else 0,
                "source": rec["source"] if rec else "none",
                "verified_score": rec["verified_score"] if rec else 0,
                "required_for_role": key in required,
            }
        )

    comparison: List[Dict[str, Any]] = []
    missing_skills: List[Dict[str, Any]] = []
    strengths: List[Dict[str, Any]] = []
    weaknesses: List[Dict[str, Any]] = []

    gap_sum = 0
    for rk in required:
        rec = skill_map.get(rk)
        cur = rec["proficiency"] if rec else 0
        gap = max(0, target_threshold - cur)
        gap_sum += gap
        item = {
            "skill_key": rk,
            "label": SKILL_OPTIONS.get(rk, rk),
            "current": cur,
            "target": target_threshold,
            "gap_pct": gap,
            "source": rec["source"] if rec else "missing",
        }
        comparison.append(item)
        if cur == 0:
            missing_skills.append(item)
        if cur >= target_threshold:
            strengths.append(item)
        elif cur < 60:
            weaknesses.append(item)

    avg_gap = round(gap_sum / max(1, len(required)))
    return {
        "target_role": target_role,
        "target_role_label": CAREER_ROLES.get(target_role, target_role),
        "skills": skills_list,
        "comparison": comparison,
        "missing_skills": missing_skills,
        "strengths": strengths,
        "weaknesses": weaknesses,
        "overall_gap_pct": avg_gap,
        "verified_count": sum(1 for s in skills_list if s["source"] in ("assessment_verified", "project_verified")),
        "self_reported_count": sum(1 for s in skills_list if s["source"] == "self_reported"),
    }


def upsert_student_skills(
    user_id: int, updates: List[Dict[str, Any]], db_path: str = DEFAULT_DB_PATH
) -> Dict[str, Any]:
    init_db(db_path)
    now = _utc_now()
    with get_connection(db_path) as conn:
        for item in updates:
            sk = str(item.get("skill_key", "")).strip()
            if sk not in SKILL_OPTIONS:
                continue
            prof = max(0, min(100, int(item.get("proficiency", 0))))
            existing = conn.execute(
                "SELECT source, verified_score FROM student_skills WHERE user_id = ? AND skill_key = ?",
                (user_id, sk),
            ).fetchone()
            if prof == 0 and existing and existing["source"] == "self_reported":
                conn.execute("DELETE FROM student_skills WHERE user_id = ? AND skill_key = ?", (user_id, sk))
                continue
            if not existing:
                conn.execute(
                    "INSERT INTO student_skills (user_id, skill_key, proficiency, source, verified_score, updated_at) VALUES (?, ?, ?, 'self_reported', 0, ?)",
                    (user_id, sk, prof, now),
                )
            else:
                # Never downgrade assessment_verified label when updating proficiency
                conn.execute(
                    "UPDATE student_skills SET proficiency = ?, updated_at = ? WHERE user_id = ? AND skill_key = ?",
                    (prof, now, user_id, sk),
                )
    return get_student_skill_profile(user_id, db_path)


# Daily Tasks CRUD
def list_tasks(user_id: int, db_path: str = DEFAULT_DB_PATH) -> List[Dict[str, Any]]:
    init_db(db_path)
    with get_connection(db_path) as conn:
        rows = conn.execute(
            "SELECT * FROM daily_tasks WHERE user_id = ? ORDER BY completed ASC, task_id DESC",
            (user_id,),
        ).fetchall()
        results = []
        for r in rows:
            d = dict(r)
            d["completed"] = bool(d["completed"])
            results.append(d)
        return results


def create_task(
    user_id: int,
    title: str,
    category: str = "Study Target",
    priority: str = "medium",
    target_date: str = "",
    attachment_name: str = "",
    attachment_path: str = "",
    db_path: str = DEFAULT_DB_PATH,
) -> Dict[str, Any]:
    init_db(db_path)
    now = _utc_now()
    tdate = target_date.strip() or _today_iso()
    prio = priority if priority in ("low", "medium", "high") else "medium"
    xp = 35 if prio == "high" else (25 if prio == "medium" else 15)
    with get_connection(db_path) as conn:
        cur = conn.execute(
            """INSERT INTO daily_tasks
               (user_id, title, category, priority, target_date, completed, attachment_name, attachment_path, xp_reward, created_at)
               VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?)""",
            (user_id, title.strip(), category.strip() or "Study Target", prio, tdate, attachment_name, attachment_path, xp, now),
        )
        row = conn.execute("SELECT * FROM daily_tasks WHERE task_id = ?", (cur.lastrowid,)).fetchone()
        d = dict(row)
        d["completed"] = bool(d["completed"])
        return d


def toggle_task(task_id: int, db_path: str = DEFAULT_DB_PATH) -> Optional[Dict[str, Any]]:
    init_db(db_path)
    with get_connection(db_path) as conn:
        row = conn.execute("SELECT * FROM daily_tasks WHERE task_id = ?", (task_id,)).fetchone()
        if not row:
            return None
        next_state = 0 if row["completed"] else 1
        conn.execute("UPDATE daily_tasks SET completed = ? WHERE task_id = ?", (next_state, task_id))
        if next_state == 1:
            conn.execute("UPDATE student_profile SET xp_points = xp_points + ? WHERE user_id = ?", (row["xp_reward"], row["user_id"]))
        updated = conn.execute("SELECT * FROM daily_tasks WHERE task_id = ?", (task_id,)).fetchone()
        d = dict(updated)
        d["completed"] = bool(d["completed"])
        return d


def delete_task(task_id: int, db_path: str = DEFAULT_DB_PATH) -> bool:
    init_db(db_path)
    with get_connection(db_path) as conn:
        cur = conn.execute("DELETE FROM daily_tasks WHERE task_id = ?", (task_id,))
        return cur.rowcount > 0


# Study Notes & PDF Vault CRUD
def list_notes(user_id: int, db_path: str = DEFAULT_DB_PATH) -> List[Dict[str, Any]]:
    init_db(db_path)
    with get_connection(db_path) as conn:
        rows = conn.execute(
            "SELECT * FROM study_notes WHERE user_id = ? ORDER BY note_id DESC",
            (user_id,),
        ).fetchall()
        return [dict(r) for r in rows]


def get_note(note_id: int, db_path: str = DEFAULT_DB_PATH) -> Optional[Dict[str, Any]]:
    init_db(db_path)
    with get_connection(db_path) as conn:
        row = conn.execute("SELECT * FROM study_notes WHERE note_id = ?", (note_id,)).fetchone()
        return dict(row) if row else None


def create_note(
    user_id: int,
    title: str,
    subject: str,
    content: str,
    file_name: str = "",
    file_path: str = "",
    mime_type: str = "text/plain",
    file_size: int = 0,
    db_path: str = DEFAULT_DB_PATH,
) -> Dict[str, Any]:
    init_db(db_path)
    now = _utc_now()
    with get_connection(db_path) as conn:
        cur = conn.execute(
            """INSERT INTO study_notes
               (user_id, title, subject, content, file_name, file_path, mime_type, file_size, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (user_id, title.strip(), subject.strip() or "General", content.strip(), file_name, file_path, mime_type, int(file_size), now),
        )
        conn.execute("UPDATE student_profile SET xp_points = xp_points + 20 WHERE user_id = ?", (user_id,))
        row = conn.execute("SELECT * FROM study_notes WHERE note_id = ?", (cur.lastrowid,)).fetchone()
        return dict(row)


def delete_note(note_id: int, db_path: str = DEFAULT_DB_PATH) -> bool:
    init_db(db_path)
    with get_connection(db_path) as conn:
        cur = conn.execute("DELETE FROM study_notes WHERE note_id = ?", (note_id,))
        return cur.rowcount > 0


# Smart Assessment System
def list_assessments(db_path: str = DEFAULT_DB_PATH) -> List[Dict[str, Any]]:
    init_db(db_path)
    with get_connection(db_path) as conn:
        rows = conn.execute("SELECT * FROM assessments ORDER BY assessment_id ASC").fetchall()
        out = []
        for r in rows:
            d = dict(r)
            d["skill_keys"] = json.loads(d.pop("skill_keys_json"))
            q_cnt = conn.execute(
                "SELECT COUNT(*) FROM assessment_questions WHERE assessment_id = ?",
                (d["assessment_id"],),
            ).fetchone()[0]
            d["question_count"] = q_cnt
            out.append(d)
        return out


def get_assessment_detail(assessment_id: int, db_path: str = DEFAULT_DB_PATH) -> Optional[Dict[str, Any]]:
    init_db(db_path)
    with get_connection(db_path) as conn:
        row = conn.execute("SELECT * FROM assessments WHERE assessment_id = ?", (assessment_id,)).fetchone()
        if not row:
            return None
        d = dict(row)
        d["skill_keys"] = json.loads(d.pop("skill_keys_json"))
        qrows = conn.execute(
            "SELECT question_id, assessment_id, prompt, options_json, topic FROM assessment_questions WHERE assessment_id = ? ORDER BY question_id ASC",
            (assessment_id,),
        ).fetchall()
        d["questions"] = [
            {
                "question_id": q["question_id"],
                "prompt": q["prompt"],
                "options": json.loads(q["options_json"]),
                "topic": q["topic"],
            }
            for q in qrows
        ]
        return d


def create_assessment(
    title: str,
    category: str,
    description: str,
    duration_minutes: int,
    skill_keys: List[str],
    questions: List[Dict[str, Any]],
    created_by: int | None = None,
    db_path: str = DEFAULT_DB_PATH,
) -> Dict[str, Any]:
    init_db(db_path)
    now = _utc_now()
    valid_skills = [s for s in skill_keys if s in SKILL_OPTIONS] or ["dsa"]
    with get_connection(db_path) as conn:
        cur = conn.execute(
            "INSERT INTO assessments (title, category, description, duration_minutes, skill_keys_json, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (title.strip(), category.strip(), description.strip(), max(5, min(90, int(duration_minutes))), json.dumps(valid_skills), created_by, now),
        )
        aid = int(cur.lastrowid)
        for q in questions:
            conn.execute(
                "INSERT INTO assessment_questions (assessment_id, prompt, options_json, correct_index, topic, explanation) VALUES (?, ?, ?, ?, ?, ?)",
                (
                    aid,
                    str(q["prompt"]).strip(),
                    json.dumps([str(o).strip() for o in q["options"]]),
                    int(q.get("correct_index", 0)),
                    str(q.get("topic", "General")).strip(),
                    str(q.get("explanation", "")).strip(),
                ),
            )
    return get_assessment_detail(aid, db_path)  # type: ignore[return-value]


def submit_assessment(
    user_id: int,
    assessment_id: int,
    answers: List[int],
    time_taken_sec: int = 0,
    ai_feedback: str = "",
    db_path: str = DEFAULT_DB_PATH,
) -> Optional[Dict[str, Any]]:
    init_db(db_path)
    now = _utc_now()
    with get_connection(db_path) as conn:
        arow = conn.execute("SELECT * FROM assessments WHERE assessment_id = ?", (assessment_id,)).fetchone()
        if not arow:
            return None
        qrows = conn.execute(
            "SELECT * FROM assessment_questions WHERE assessment_id = ? ORDER BY question_id ASC",
            (assessment_id,),
        ).fetchall()
        total = len(qrows)
        if total == 0:
            return None

        correct = 0
        weak_topics: List[str] = []
        review: List[Dict[str, Any]] = []
        for idx, q in enumerate(qrows):
            chosen = answers[idx] if idx < len(answers) else -1
            is_correct = chosen == q["correct_index"]
            if is_correct:
                correct += 1
            else:
                if q["topic"] not in weak_topics:
                    weak_topics.append(q["topic"])
            review.append(
                {
                    "question_id": q["question_id"],
                    "prompt": q["prompt"],
                    "topic": q["topic"],
                    "chosen_index": chosen,
                    "correct_index": q["correct_index"],
                    "is_correct": is_correct,
                    "explanation": q["explanation"],
                    "options": json.loads(q["options_json"]),
                }
            )

        score_pct = round((correct / total) * 100)
        summary_fb = ai_feedback or (
            f"Scored {score_pct}% ({correct}/{total}). "
            + (f"Review weak topics: {', '.join(weak_topics)}." if weak_topics else "Excellent mastery across all topics!")
        )

        cur = conn.execute(
            """INSERT INTO assessment_results
               (user_id, assessment_id, score_pct, correct_count, total_count, weak_topics_json, answers_json, ai_feedback, time_taken_sec, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                user_id,
                assessment_id,
                score_pct,
                correct,
                total,
                json.dumps(weak_topics),
                json.dumps(answers),
                summary_fb,
                int(time_taken_sec),
                now,
            ),
        )
        result_id = int(cur.lastrowid)

        # Verify tested skills in student_skills
        tested_skills = json.loads(arow["skill_keys_json"])
        for sk in tested_skills:
            if sk not in SKILL_OPTIONS:
                continue
            existing = conn.execute(
                "SELECT proficiency FROM student_skills WHERE user_id = ? AND skill_key = ?",
                (user_id, sk),
            ).fetchone()
            if not existing:
                conn.execute(
                    "INSERT INTO student_skills (user_id, skill_key, proficiency, source, verified_score, updated_at) VALUES (?, ?, ?, 'assessment_verified', ?, ?)",
                    (user_id, sk, score_pct, score_pct, now),
                )
            else:
                blended = max(existing["proficiency"], score_pct)
                conn.execute(
                    "UPDATE student_skills SET proficiency = ?, source = 'assessment_verified', verified_score = ?, updated_at = ? WHERE user_id = ? AND skill_key = ?",
                    (blended, score_pct, now, user_id, sk),
                )

        # Update communication score if this is an aptitude/communication assessment
        if "tech_comm" in tested_skills or "Communication" in arow["title"]:
            conn.execute(
                "UPDATE student_profile SET communication_score = ? WHERE user_id = ?",
                (max(40, score_pct), user_id),
            )

        conn.execute(
            "UPDATE student_profile SET xp_points = xp_points + ? WHERE user_id = ?",
            (30 + round(score_pct / 5), user_id),
        )

        return {
            "result_id": result_id,
            "user_id": user_id,
            "assessment_id": assessment_id,
            "assessment_title": arow["title"],
            "category": arow["category"],
            "score_pct": score_pct,
            "correct_count": correct,
            "total_count": total,
            "weak_topics": weak_topics,
            "ai_feedback": summary_fb,
            "time_taken_sec": int(time_taken_sec),
            "created_at": now,
            "review": review,
        }


def update_assessment_ai_feedback(result_id: int, ai_feedback: str, db_path: str = DEFAULT_DB_PATH) -> None:
    init_db(db_path)
    with get_connection(db_path) as conn:
        conn.execute("UPDATE assessment_results SET ai_feedback = ? WHERE result_id = ?", (ai_feedback, result_id))


def list_assessment_results(user_id: Optional[int] = None, db_path: str = DEFAULT_DB_PATH) -> List[Dict[str, Any]]:
    init_db(db_path)
    with get_connection(db_path) as conn:
        query = """
            SELECT ar.*, a.title AS assessment_title, a.category, sp.display_name
            FROM assessment_results ar
            JOIN assessments a ON ar.assessment_id = a.assessment_id
            JOIN student_profile sp ON ar.user_id = sp.user_id
        """
        params: tuple[Any, ...] = ()
        if user_id is not None:
            query += " WHERE ar.user_id = ?"
            params = (user_id,)
        query += " ORDER BY ar.result_id DESC"
        rows = conn.execute(query, params).fetchall()
        out = []
        for r in rows:
            d = dict(r)
            d["weak_topics"] = json.loads(d.pop("weak_topics_json"))
            d["answers"] = json.loads(d.pop("answers_json"))
            out.append(d)
        return out


# Courses & Resources
def list_courses(user_id: Optional[int] = None, db_path: str = DEFAULT_DB_PATH) -> List[Dict[str, Any]]:
    init_db(db_path)
    with get_connection(db_path) as conn:
        rows = conn.execute("SELECT * FROM courses ORDER BY course_id ASC").fetchall()
        prog_map: Dict[int, bool] = {}
        if user_id is not None:
            prows = conn.execute(
                "SELECT course_id, completed FROM user_course_progress WHERE user_id = ?",
                (user_id,),
            ).fetchall()
            prog_map = {p["course_id"]: bool(p["completed"]) for p in prows}
        out = []
        for r in rows:
            d = dict(r)
            d["skill_keys"] = json.loads(d.pop("skill_keys_json"))
            d["completed"] = prog_map.get(d["course_id"], False)
            out.append(d)
        return out


def create_course(
    title: str,
    provider: str,
    category: str,
    target_role: str,
    duration_hours: int,
    resource_url: str,
    skill_keys: List[str],
    db_path: str = DEFAULT_DB_PATH,
) -> Dict[str, Any]:
    init_db(db_path)
    now = _utc_now()
    with get_connection(db_path) as conn:
        cur = conn.execute(
            "INSERT INTO courses (title, provider, category, target_role, duration_hours, resource_url, skill_keys_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (title.strip(), provider.strip(), category.strip(), target_role, max(1, int(duration_hours)), resource_url.strip(), json.dumps(skill_keys), now),
        )
        row = conn.execute("SELECT * FROM courses WHERE course_id = ?", (cur.lastrowid,)).fetchone()
        d = dict(row)
        d["skill_keys"] = json.loads(d.pop("skill_keys_json"))
        d["completed"] = False
        return d


def toggle_course_progress(user_id: int, course_id: int, db_path: str = DEFAULT_DB_PATH) -> Dict[str, Any]:
    init_db(db_path)
    now = _utc_now()
    with get_connection(db_path) as conn:
        row = conn.execute(
            "SELECT completed FROM user_course_progress WHERE user_id = ? AND course_id = ?",
            (user_id, course_id),
        ).fetchone()
        if row:
            next_val = 0 if row["completed"] else 1
            conn.execute(
                "UPDATE user_course_progress SET completed = ?, updated_at = ? WHERE user_id = ? AND course_id = ?",
                (next_val, now, user_id, course_id),
            )
        else:
            next_val = 1
            conn.execute(
                "INSERT INTO user_course_progress (user_id, course_id, completed, updated_at) VALUES (?, ?, 1, ?)",
                (user_id, course_id, now),
            )
        if next_val == 1:
            conn.execute("UPDATE student_profile SET xp_points = xp_points + 40 WHERE user_id = ?", (user_id,))
        return {"course_id": course_id, "completed": bool(next_val)}


# AI Mentor Chat History
def list_mentor_messages(user_id: int, db_path: str = DEFAULT_DB_PATH) -> List[Dict[str, Any]]:
    init_db(db_path)
    with get_connection(db_path) as conn:
        rows = conn.execute(
            "SELECT * FROM mentor_messages WHERE user_id = ? ORDER BY msg_id ASC",
            (user_id,),
        ).fetchall()
        return [dict(r) for r in rows]


def add_mentor_message(user_id: int, sender: str, content: str, db_path: str = DEFAULT_DB_PATH) -> Dict[str, Any]:
    init_db(db_path)
    now = _utc_now()
    with get_connection(db_path) as conn:
        cur = conn.execute(
            "INSERT INTO mentor_messages (user_id, sender, content, created_at) VALUES (?, ?, ?, ?)",
            (user_id, sender, content, now),
        )
        row = conn.execute("SELECT * FROM mentor_messages WHERE msg_id = ?", (cur.lastrowid,)).fetchone()
        return dict(row)


def clear_mentor_messages(user_id: int, db_path: str = DEFAULT_DB_PATH) -> None:
    init_db(db_path)
    with get_connection(db_path) as conn:
        conn.execute("DELETE FROM mentor_messages WHERE user_id = ?", (user_id,))


# Mock Interviews History
def list_mock_interviews(user_id: int, db_path: str = DEFAULT_DB_PATH) -> List[Dict[str, Any]]:
    init_db(db_path)
    with get_connection(db_path) as conn:
        rows = conn.execute(
            "SELECT * FROM mock_interviews WHERE user_id = ? ORDER BY interview_id DESC",
            (user_id,),
        ).fetchall()
        return [dict(r) for r in rows]


def save_mock_interview(
    user_id: int,
    target_role: str,
    mode: str,
    question: str,
    answer: str,
    technical_score: int,
    communication_score: int,
    quality_score: int,
    overall_score: int,
    feedback: str,
    improvements: str,
    source: str = "gemini_ai",
    db_path: str = DEFAULT_DB_PATH,
) -> Dict[str, Any]:
    init_db(db_path)
    now = _utc_now()
    with get_connection(db_path) as conn:
        cur = conn.execute(
            """INSERT INTO mock_interviews
               (user_id, target_role, mode, question, answer, technical_score, communication_score, quality_score, overall_score, feedback, improvements, source, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (user_id, target_role, mode, question, answer, technical_score, communication_score, quality_score, overall_score, feedback, improvements, source, now),
        )
        conn.execute("UPDATE student_profile SET xp_points = xp_points + 35, communication_score = ? WHERE user_id = ?", (communication_score, user_id))
        row = conn.execute("SELECT * FROM mock_interviews WHERE interview_id = ?", (cur.lastrowid,)).fetchone()
        return dict(row)


# Resume Analyses
def list_resumes(user_id: int, db_path: str = DEFAULT_DB_PATH) -> List[Dict[str, Any]]:
    init_db(db_path)
    with get_connection(db_path) as conn:
        rows = conn.execute(
            "SELECT * FROM resumes WHERE user_id = ? ORDER BY resume_id DESC",
            (user_id,),
        ).fetchall()
        out = []
        for r in rows:
            d = dict(r)
            d["matched_keywords"] = json.loads(d.pop("matched_keywords_json"))
            d["missing_keywords"] = json.loads(d.pop("missing_keywords_json"))
            d["suggestions"] = json.loads(d.pop("suggestions_json"))
            out.append(d)
        return out


def save_resume_analysis(
    user_id: int,
    file_name: str,
    file_path: str,
    extracted_text: str,
    target_role: str,
    job_description: str,
    ats_score: int,
    matched_keywords: List[str],
    missing_keywords: List[str],
    suggestions: List[str],
    summary: str,
    db_path: str = DEFAULT_DB_PATH,
) -> Dict[str, Any]:
    init_db(db_path)
    now = _utc_now()
    with get_connection(db_path) as conn:
        cur = conn.execute(
            """INSERT INTO resumes
               (user_id, file_name, file_path, extracted_text, target_role, job_description, ats_score, matched_keywords_json, missing_keywords_json, suggestions_json, summary, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                user_id,
                file_name,
                file_path,
                extracted_text[:12000],
                target_role,
                job_description[:4000],
                max(0, min(100, int(ats_score))),
                json.dumps(matched_keywords),
                json.dumps(missing_keywords),
                json.dumps(suggestions),
                summary,
                now,
            ),
        )
        conn.execute("UPDATE student_profile SET xp_points = xp_points + 30 WHERE user_id = ?", (user_id,))
        row = conn.execute("SELECT * FROM resumes WHERE resume_id = ?", (cur.lastrowid,)).fetchone()
        d = dict(row)
        d["matched_keywords"] = json.loads(d.pop("matched_keywords_json"))
        d["missing_keywords"] = json.loads(d.pop("missing_keywords_json"))
        d["suggestions"] = json.loads(d.pop("suggestions_json"))
        return d


# LinkedIn-style Job Updates & Compatibility Matching
def list_jobs_for_user(user_id: int, db_path: str = DEFAULT_DB_PATH) -> List[Dict[str, Any]]:
    init_db(db_path)
    skill_prof = get_student_skill_profile(user_id, db_path)
    known_skills = {
        s["skill_key"] for s in skill_prof.get("skills", []) if s["proficiency"] >= 40
    }
    snap = get_latest_snapshot(user_id, db_path)
    if snap:
        known_skills.update(snap.get("verified_skills", []))

    with get_connection(db_path) as conn:
        rows = conn.execute("SELECT * FROM job_opportunities ORDER BY job_id DESC").fetchall()
        apps = conn.execute(
            "SELECT job_id, status FROM job_applications WHERE user_id = ?",
            (user_id,),
        ).fetchall()
        app_map = {a["job_id"]: a["status"] for a in apps}

    out: List[Dict[str, Any]] = []
    for r in rows:
        d = dict(r)
        req = json.loads(d.pop("required_skills_json"))
        matched = [s for s in req if s in known_skills]
        missing = [s for s in req if s not in known_skills]
        compat = round((len(matched) / max(1, len(req))) * 100)
        d["required_skills"] = req
        d["matched_skills"] = matched
        d["missing_skills"] = missing
        d["compatibility_score"] = compat
        d["is_sample"] = bool(d.get("is_sample", 1))
        d["application_status"] = app_map.get(d["job_id"], "none")
        out.append(d)
    out.sort(key=lambda j: j["compatibility_score"], reverse=True)
    return out


def set_job_status(user_id: int, job_id: int, status: str, db_path: str = DEFAULT_DB_PATH) -> Dict[str, Any]:
    init_db(db_path)
    now = _utc_now()
    with get_connection(db_path) as conn:
        if status == "none":
            conn.execute("DELETE FROM job_applications WHERE user_id = ? AND job_id = ?", (user_id, job_id))
            return {"job_id": job_id, "status": "none"}
        conn.execute(
            """INSERT INTO job_applications (user_id, job_id, status, updated_at)
               VALUES (?, ?, ?, ?)
               ON CONFLICT(user_id, job_id) DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at""",
            (user_id, job_id, status, now),
        )
        if status == "applied":
            conn.execute("UPDATE student_profile SET xp_points = xp_points + 15 WHERE user_id = ?", (user_id,))
        return {"job_id": job_id, "status": status}


def create_job_opportunity(
    title: str,
    company: str,
    location: str,
    work_mode: str,
    job_type: str,
    compensation: str,
    target_role: str,
    required_skills: List[str],
    description: str,
    apply_url: str = "",
    db_path: str = DEFAULT_DB_PATH,
) -> Dict[str, Any]:
    init_db(db_path)
    today = _today_iso()
    with get_connection(db_path) as conn:
        cur = conn.execute(
            """INSERT INTO job_opportunities
               (title, company, location, work_mode, job_type, compensation, target_role, required_skills_json, description, apply_url, is_sample, posted_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)""",
            (title.strip(), company.strip(), location.strip(), work_mode, job_type, compensation.strip(), target_role, json.dumps(required_skills), description.strip(), apply_url.strip(), today),
        )
        row = conn.execute("SELECT * FROM job_opportunities WHERE job_id = ?", (cur.lastrowid,)).fetchone()
        d = dict(row)
        d["required_skills"] = json.loads(d.pop("required_skills_json"))
        d["is_sample"] = bool(d["is_sample"])
        return d


# Gamification, Badges & Digital Skill Passport
def get_gamification_summary(user_id: int, db_path: str = DEFAULT_DB_PATH) -> Dict[str, Any]:
    init_db(db_path)
    profile = get_profile(user_id, db_path)
    tasks = list_tasks(user_id, db_path)
    notes = list_notes(user_id, db_path)
    projects = list_projects(user_id, db_path)
    assessments = list_assessment_results(user_id, db_path)
    interviews = list_mock_interviews(user_id, db_path)
    resumes = list_resumes(user_id, db_path)

    completed_tasks = sum(1 for t in tasks if t["completed"])
    xp = profile["xp_points"] if profile else 0
    level = max(1, (xp // 150) + 1)

    badges = [
        {"id": "first_quiz", "name": "Diagnostic Finisher", "description": "Complete at least 1 smart assessment", "unlocked": len(assessments) >= 1},
        {"id": "streak_5", "name": "Consistent Learner", "description": "Maintain a 5+ day study streak", "unlocked": (profile["streak_days"] if profile else 0) >= 5},
        {"id": "note_vault", "name": "PDF Note Builder", "description": "Save 2+ study notes or PDFs", "unlocked": len(notes) >= 2},
        {"id": "project_shipper", "name": "Portfolio Shipper", "description": "Publish 2+ technical projects", "unlocked": len(projects) >= 2},
        {"id": "mock_pro", "name": "Interview Ready", "description": "Complete an AI mock interview", "unlocked": len(interviews) >= 1},
        {"id": "ats_ready", "name": "ATS Screened", "description": "Analyze a resume against a target role", "unlocked": len(resumes) >= 1},
    ]

    challenges = [
        {"title": "Complete 3 Daily Study Targets", "current": min(3, completed_tasks), "target": 3, "xp": 75},
        {"title": "Score 75%+ on Any Assessment", "current": 1 if any(a["score_pct"] >= 75 for a in assessments) else 0, "target": 1, "xp": 100},
        {"title": "Ship or Log 2 Portfolio Projects", "current": min(2, len(projects)), "target": 2, "xp": 120},
    ]

    with get_connection(db_path) as conn:
        lb_rows = conn.execute(
            "SELECT user_id, display_name, branch, xp_points, streak_days, target_role FROM student_profile WHERE role = 'student' AND is_active = 1 ORDER BY xp_points DESC LIMIT 10"
        ).fetchall()
        leaderboard = [dict(r) for r in lb_rows]

    return {
        "xp_points": xp,
        "level": level,
        "next_level_xp": level * 150,
        "streak_days": profile["streak_days"] if profile else 1,
        "badges": badges,
        "challenges": challenges,
        "leaderboard": leaderboard,
    }


def get_digital_passport(user_id: int, db_path: str = DEFAULT_DB_PATH) -> Optional[Dict[str, Any]]:
    profile = get_profile(user_id, db_path)
    if not profile:
        return None
    skill_profile = get_student_skill_profile(user_id, db_path)
    projects = list_projects(user_id, db_path)
    assessments = list_assessment_results(user_id, db_path)
    interviews = list_mock_interviews(user_id, db_path)
    latest_snap = get_latest_snapshot(user_id, db_path)
    gamification = get_gamification_summary(user_id, db_path)
    courses = [c for c in list_courses(user_id, db_path) if c["completed"]]

    verified_skills = [s for s in skill_profile["skills"] if s["source"] in ("assessment_verified", "project_verified")]
    self_reported_skills = [s for s in skill_profile["skills"] if s["source"] == "self_reported"]

    return {
        "profile": profile,
        "readiness_score": latest_snap["computed_readiness"] if latest_snap else 60,
        "verified_skills": verified_skills,
        "self_reported_skills": self_reported_skills,
        "projects": projects,
        "assessments": assessments[:5],
        "interviews": interviews[:5],
        "completed_courses": courses,
        "badges": [b for b in gamification["badges"] if b["unlocked"]],
        "xp_points": gamification["xp_points"],
        "level": gamification["level"],
    }


# Notifications, Faculty & Admin Dashboards
def list_notifications(user_id: int, db_path: str = DEFAULT_DB_PATH) -> List[Dict[str, Any]]:
    init_db(db_path)
    with get_connection(db_path) as conn:
        rows = conn.execute(
            "SELECT * FROM notifications WHERE user_id = ? ORDER BY notification_id DESC LIMIT 20",
            (user_id,),
        ).fetchall()
        out = []
        for r in rows:
            d = dict(r)
            d["is_read"] = bool(d["is_read"])
            out.append(d)
        return out


def mark_notifications_read(user_id: int, db_path: str = DEFAULT_DB_PATH) -> None:
    init_db(db_path)
    with get_connection(db_path) as conn:
        conn.execute("UPDATE notifications SET is_read = 1 WHERE user_id = ?", (user_id,))


def add_faculty_feedback(
    student_id: int, faculty_id: int, category: str, comment: str, db_path: str = DEFAULT_DB_PATH
) -> Dict[str, Any]:
    init_db(db_path)
    now = _utc_now()
    with get_connection(db_path) as conn:
        cur = conn.execute(
            "INSERT INTO faculty_feedback (student_id, faculty_id, category, comment, created_at) VALUES (?, ?, ?, ?, ?)",
            (student_id, faculty_id, category.strip() or "Academic & Career", comment.strip(), now),
        )
        fac = conn.execute("SELECT display_name FROM student_profile WHERE user_id = ?", (faculty_id,)).fetchone()
        fac_name = fac["display_name"] if fac else "Faculty Mentor"
        conn.execute(
            "INSERT INTO notifications (user_id, title, message, kind, is_read, created_at) VALUES (?, ?, ?, 'faculty', 0, ?)",
            (student_id, f"Feedback from {fac_name}", comment.strip()[:160], now),
        )
        row = conn.execute("SELECT * FROM faculty_feedback WHERE feedback_id = ?", (cur.lastrowid,)).fetchone()
        return dict(row)


def list_faculty_feedback(student_id: int, db_path: str = DEFAULT_DB_PATH) -> List[Dict[str, Any]]:
    init_db(db_path)
    with get_connection(db_path) as conn:
        rows = conn.execute(
            """SELECT ff.*, sp.display_name AS faculty_name
               FROM faculty_feedback ff
               JOIN student_profile sp ON ff.faculty_id = sp.user_id
               WHERE ff.student_id = ?
               ORDER BY ff.feedback_id DESC""",
            (student_id,),
        ).fetchall()
        return [dict(r) for r in rows]


def get_faculty_overview(db_path: str = DEFAULT_DB_PATH) -> Dict[str, Any]:
    init_db(db_path)
    students = [p for p in list_profiles(db_path) if p.get("role") == "student"]
    enriched = []
    for s in students:
        snap = get_latest_snapshot(s["user_id"], db_path)
        readiness = snap["computed_readiness"] if snap else 55
        projs = list_projects(s["user_id"], db_path)
        results = list_assessment_results(s["user_id"], db_path)
        avg_quiz = round(sum(r["score_pct"] for r in results) / len(results)) if results else 0
        fb = list_faculty_feedback(s["user_id"], db_path)
        enriched.append(
            {
                **s,
                "readiness_score": readiness,
                "project_count": len(projs),
                "projects": projs,
                "assessment_count": len(results),
                "avg_assessment_score": avg_quiz,
                "needs_support": readiness < 68 or s["cgpa"] < 7.0,
                "recent_feedback": fb[:3],
            }
        )
    return {
        "students": enriched,
        "assessments": list_assessments(db_path),
        "recent_results": list_assessment_results(None, db_path)[:15],
    }


def get_admin_overview(db_path: str = DEFAULT_DB_PATH) -> Dict[str, Any]:
    init_db(db_path)
    all_users = list_profiles(db_path)
    students = [u for u in all_users if u.get("role") == "student"]
    faculty = [u for u in all_users if u.get("role") == "faculty"]

    dept_map: Dict[str, List[int]] = {}
    student_reports = []
    at_risk = []
    for st in students:
        snap = get_latest_snapshot(st["user_id"], db_path)
        readiness = snap["computed_readiness"] if snap else 55
        dept_map.setdefault(st["branch"], []).append(readiness)
        row_data = {
            **st,
            "readiness_score": readiness,
            "skill_gaps": snap["skill_gaps"] if snap else [],
            "needs_support": readiness < 68 or st["cgpa"] < 7.0,
        }
        student_reports.append(row_data)
        if row_data["needs_support"]:
            at_risk.append(row_data)

    department_analytics = [
        {
            "department": dept,
            "student_count": len(scores),
            "avg_readiness": round(sum(scores) / len(scores)),
        }
        for dept, scores in dept_map.items()
    ]

    return {
        "totals": {
            "total_users": len(all_users),
            "students": len(students),
            "faculty": len(faculty),
            "assessments": len(list_assessments(db_path)),
            "courses": len(list_courses(None, db_path)),
            "at_risk_students": len(at_risk),
            "avg_readiness": round(sum(r["readiness_score"] for r in student_reports) / max(1, len(student_reports))),
        },
        "users": all_users,
        "student_reports": student_reports,
        "at_risk_students": at_risk,
        "department_analytics": department_analytics,
        "settings": get_app_settings(db_path),
    }


def admin_update_user(
    user_id: int, role: str, branch: str, is_active: bool, db_path: str = DEFAULT_DB_PATH
) -> Optional[Dict[str, Any]]:
    init_db(db_path)
    safe_role = role if role in ("student", "faculty", "admin") else "student"
    with get_connection(db_path) as conn:
        conn.execute(
            "UPDATE student_profile SET role = ?, branch = ?, is_active = ? WHERE user_id = ?",
            (safe_role, branch, 1 if is_active else 0, user_id),
        )
    return get_profile(user_id, db_path)


def get_app_settings(db_path: str = DEFAULT_DB_PATH) -> Dict[str, str]:
    init_db(db_path)
    with get_connection(db_path) as conn:
        rows = conn.execute("SELECT setting_key, setting_value FROM app_settings").fetchall()
        return {r["setting_key"]: r["setting_value"] for r in rows}


def update_app_settings(updates: Dict[str, str], db_path: str = DEFAULT_DB_PATH) -> Dict[str, str]:
    init_db(db_path)
    now = _utc_now()
    with get_connection(db_path) as conn:
        for k, v in updates.items():
            conn.execute(
                """INSERT INTO app_settings (setting_key, setting_value, updated_at)
                   VALUES (?, ?, ?)
                   ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = excluded.updated_at""",
                (str(k).strip(), str(v).strip(), now),
            )
    return get_app_settings(db_path)


def get_db_stats(db_path: str = DEFAULT_DB_PATH) -> Dict[str, Any]:
    init_db(db_path)
    with get_connection(db_path) as conn:
        counts = {}
        for table in (
            "student_profile",
            "student_project",
            "evidence_snapshot",
            "action_plan",
            "readiness_completion",
            "student_skills",
            "daily_tasks",
            "study_notes",
            "assessments",
            "assessment_results",
            "courses",
            "mentor_messages",
            "mock_interviews",
            "resumes",
            "job_opportunities",
            "notifications",
        ):
            counts[table] = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
        return {
            "engine": "SQLite 3 (sqlite3 stdlib)",
            "db_file": os.path.basename(db_path),
            "foreign_keys_enabled": True,
            "table_counts": counts,
        }
