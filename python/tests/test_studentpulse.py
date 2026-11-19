"""Automated unit and integration tests for StudentPulse AI."""

import json
import os
import tempfile
import unittest

from python import database
from python.schemas import EvidenceSnapshotInput
from python.validator import ValidationError, validate_evidence_snapshot, validate_profile
from python.recommender import (
    compute_readiness_metrics,
    build_fallback_plan,
    modify_action_plan,
    evaluate_interview_answer_fallback,
)
from python.output_validator import validate_ai_plan_output


class TestStudentPulseAI(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp_dir = tempfile.TemporaryDirectory()
        self.db_path = os.path.join(self.tmp_dir.name, "test_studentpulse.db")
        database.init_db(self.db_path, seed_demo=False)
        self.profile = database.create_profile(
            "Riya_CS26", "ml_ai_engineer", 6, 8.2, self.db_path
        )

    def tearDown(self) -> None:
        self.tmp_dir.cleanup()

    def test_01_readiness_and_skill_gap_calculation(self) -> None:
        """Scenario 1: Compute weighted readiness score and exact skill gaps for AI/ML role."""
        ev = validate_evidence_snapshot(
            {
                "user_id": self.profile["user_id"],
                "weekly_study_hours": 10,
                "assessment_score": 80,
                "coding_score": 72,
                "project_count": 2,
                "project_level": "academic_mini",
                "interview_score": 65,
                "interview_prep_level": "practicing",
                "verified_skills": ["python", "dsa", "git_collab"],
                "certifications_count": 1,
            }
        )
        metrics = compute_readiness_metrics(ev, "ml_ai_engineer", self.profile["cgpa"])
        self.assertGreater(metrics["overall_score"], 0)
        self.assertLessEqual(metrics["overall_score"], 100)
        self.assertIn("ml_basics", metrics["skill_gaps"])
        self.assertIn("prompt_eng", metrics["skill_gaps"])

    def test_02_weekly_study_hours_budget_enforced(self) -> None:
        """Scenario 2: Action plan respects weekly study-hour ceiling across different role."""
        ev = validate_evidence_snapshot(
            {
                "user_id": self.profile["user_id"],
                "weekly_study_hours": 6,
                "assessment_score": 75,
                "coding_score": 70,
                "project_count": 1,
                "project_level": "academic_mini",
                "interview_score": 60,
                "interview_prep_level": "beginner",
                "verified_skills": ["python"],
            }
        )
        metrics = compute_readiness_metrics(ev, "fullstack_dev", 7.8)
        plan = build_fallback_plan(ev, "fullstack_dev", metrics)
        self.assertLessEqual(plan["total_hours"], 6)
        self.assertGreaterEqual(len(plan["action_steps"]), 2)

    def test_03_missing_required_evidence_fields(self) -> None:
        """Scenario 3: Missing required inputs produce field-specific ValidationError."""
        with self.assertRaises(ValidationError) as err:
            validate_evidence_snapshot({"user_id": self.profile["user_id"]})
        self.assertIn("weekly_study_hours", err.exception.field_errors)
        self.assertIn("assessment_score", err.exception.field_errors)
        self.assertIn("project_level", err.exception.field_errors)

    def test_04_invalid_scores_and_study_hours(self) -> None:
        """Scenario 4: Reject out-of-range assessment score (>100) and invalid study hours (>40)."""
        with self.assertRaises(ValidationError) as err:
            validate_evidence_snapshot(
                {
                    "user_id": self.profile["user_id"],
                    "weekly_study_hours": 60,
                    "assessment_score": 115,
                    "coding_score": 80,
                    "project_count": 2,
                    "project_level": "deployed_fullstack",
                    "interview_score": 70,
                    "interview_prep_level": "practicing",
                    "verified_skills": ["python"],
                }
            )
        self.assertIn("weekly_study_hours", err.exception.field_errors)
        self.assertIn("assessment_score", err.exception.field_errors)

    def test_05_ai_unavailable_safe_python_fallback(self) -> None:
        """Scenario 5: Safe Python fallback builds a complete plan when AI provider fails."""
        ev = EvidenceSnapshotInput(
            user_id=self.profile["user_id"],
            weekly_study_hours=8,
            assessment_score=78,
            coding_score=75,
            project_count=2,
            project_level="deployed_fullstack",
            interview_score=70,
            interview_prep_level="practicing",
            verified_skills=["python", "dsa", "sql_db"],
        )
        metrics = compute_readiness_metrics(ev, "python_backend", 8.2)
        plan = build_fallback_plan(ev, "python_backend", metrics, "AI rate limit reached")
        self.assertEqual(plan["source"], "python_rule_fallback")
        self.assertLessEqual(plan["total_hours"], 8)
        self.assertGreaterEqual(len(plan["interview_questions"]), 2)

    def test_06_malformed_or_hour_exceeding_ai_rejected(self) -> None:
        """Scenario 6: Output validator rejects malformed JSON and plans exceeding study hours."""
        ev = EvidenceSnapshotInput(
            user_id=self.profile["user_id"],
            weekly_study_hours=6,
            assessment_score=75,
            coding_score=70,
            project_count=1,
            project_level="academic_mini",
            interview_score=60,
            interview_prep_level="beginner",
            verified_skills=["python"],
        )
        metrics = compute_readiness_metrics(ev, "ml_ai_engineer", 8.0)

        ok_bad, _, _ = validate_ai_plan_output("{broken-json", ev, metrics)
        self.assertFalse(ok_bad)

        excessive = json.dumps(
            {
                "title": "Overloaded 25-Hour Plan",
                "total_hours": 25,
                "action_steps": [
                    {
                        "title": "Heavy ML Module",
                        "hours": 15,
                        "focus_skill": "ML",
                        "category": "Skill Gap",
                        "deliverable": "Build model",
                    },
                    {
                        "title": "Heavy DSA Grind",
                        "hours": 10,
                        "focus_skill": "DSA",
                        "category": "Core",
                        "deliverable": "Solve 50 problems",
                    },
                ],
                "interview_questions": [
                    {"question": "Q1?", "topic": "ML", "hint": "Hint 1"},
                    {"question": "Q2?", "topic": "Python", "hint": "Hint 2"},
                ],
                "explanation": "Too many hours.",
            }
        )
        ok_excess, _, issues = validate_ai_plan_output(excessive, ev, metrics)
        self.assertFalse(ok_excess)
        self.assertGreaterEqual(len(issues), 1)

    def test_07_sqlite_persistence_and_plan_modification(self) -> None:
        """Scenario 7: Snapshot, action plan modification, and completion saved with PK/FK in SQLite."""
        ev = EvidenceSnapshotInput(
            user_id=self.profile["user_id"],
            weekly_study_hours=8,
            assessment_score=80,
            coding_score=75,
            project_count=2,
            project_level="deployed_fullstack",
            interview_score=72,
            interview_prep_level="practicing",
            verified_skills=["python", "dsa"],
        )
        metrics = compute_readiness_metrics(ev, "ml_ai_engineer", 8.2)
        snap_id = database.save_evidence_snapshot(
            ev.user_id, ev.weekly_study_hours, ev.assessment_score, ev.coding_score,
            ev.project_count, ev.project_level, ev.interview_score, ev.interview_prep_level,
            ev.verified_skills, 1, metrics["overall_score"], metrics["skill_gaps"], self.db_path
        )
        plan = build_fallback_plan(ev, "ml_ai_engineer", metrics)
        saved_plan = database.save_action_plan(snap_id, plan, self.db_path)

        compressed = modify_action_plan(saved_plan, "compress_hours", 8, "ml_ai_engineer")
        self.assertLessEqual(compressed["total_hours"], saved_plan["total_hours"])

        comp = database.record_completion(
            self.profile["user_id"], saved_plan["plan_id"], "completed", "Finished all deliverables", self.db_path
        )
        self.assertEqual(comp["status"], "completed")
        history = database.get_history(self.profile["user_id"], self.db_path)
        self.assertEqual(len(history), 1)

    def test_08_profile_and_interview_rubric_evaluator(self) -> None:
        """Scenario 8: Profile validation and deterministic interview feedback evaluator."""
        with self.assertRaises(ValidationError):
            validate_profile({"display_name": "", "target_role": "bad", "semester": 12, "cgpa": 11.5})

        fb = evaluate_interview_answer_fallback(
            "Why use a hybrid validator?",
            "Deterministic rules prevent hallucination and enforce schema verification on constraints so the application never relies blindly on unverified LLM outputs.",
            "Discuss hallucination risk, deterministic constraint enforcement, and schema verification.",
        )
        self.assertGreaterEqual(fb["score"], 60)

    def test_09_portfolio_project_crud_and_role_comparison(self) -> None:
        """Scenario 9: Portfolio project CRUD and multi-role readiness comparison."""
        from python.validator import validate_project
        from python.recommender import compare_roles_for_student

        proj_data = validate_project(
            {
                "user_id": self.profile["user_id"],
                "title": "Smart Attendance Tracker",
                "summary": "Full-stack attendance analytics API with automated unit tests.",
                "tech_stack": ["python", "sql_db", "testing_qa"],
                "repo_url": "https://github.com/student/attendance-tracker",
                "has_tests": True,
            }
        )
        created = database.create_project(**proj_data, db_path=self.db_path)
        self.assertEqual(created["title"], "Smart Attendance Tracker")
        self.assertEqual(len(database.list_projects(self.profile["user_id"], self.db_path)), 1)

        ev = EvidenceSnapshotInput(
            user_id=self.profile["user_id"],
            weekly_study_hours=10,
            assessment_score=80,
            coding_score=76,
            project_count=1,
            project_level="deployed_fullstack",
            interview_score=70,
            interview_prep_level="practicing",
            verified_skills=["python", "sql_db", "testing_qa"],
        )
        roles = compare_roles_for_student(ev, 8.2)
        self.assertEqual(len(roles), 7)
        self.assertTrue(database.delete_project(created["project_id"], self.db_path))

    def test_10_step_toggle_and_trend_history(self) -> None:
        """Scenario 10: Action step completion toggle and longitudinal readiness trend."""
        ev = EvidenceSnapshotInput(
            user_id=self.profile["user_id"],
            weekly_study_hours=8,
            assessment_score=75,
            coding_score=72,
            project_count=1,
            project_level="academic_mini",
            interview_score=65,
            interview_prep_level="practicing",
            verified_skills=["python"],
        )
        metrics = compute_readiness_metrics(ev, "ml_ai_engineer", 8.2)
        snap_id = database.save_evidence_snapshot(
            ev.user_id, 8, 75, 72, 1, "academic_mini", 65, "practicing",
            ["python"], 0, metrics["overall_score"], metrics["skill_gaps"], self.db_path
        )
        plan = build_fallback_plan(ev, "ml_ai_engineer", metrics)
        saved_plan = database.save_action_plan(snap_id, plan, self.db_path)

        toggled = database.toggle_action_step(saved_plan["plan_id"], 0, self.db_path)
        self.assertTrue(toggled["action_steps"][0]["completed"])

        trend = database.get_readiness_trend(self.profile["user_id"], self.db_path)
        self.assertEqual(len(trend), 1)
        self.assertEqual(trend[0]["computed_readiness"], metrics["overall_score"])

    def test_11_latest_plan_and_snapshot_retrieval(self) -> None:
        """Scenario 11: Retrieve latest readiness snapshot and action plan for a student profile."""
        ev = EvidenceSnapshotInput(
            user_id=self.profile["user_id"],
            weekly_study_hours=10,
            assessment_score=84,
            coding_score=78,
            project_count=2,
            project_level="deployed_fullstack",
            interview_score=72,
            interview_prep_level="practicing",
            verified_skills=["python", "dsa", "ml_basics"],
        )
        metrics = compute_readiness_metrics(ev, "ml_ai_engineer", 8.2)
        snap_id = database.save_evidence_snapshot(
            ev.user_id, 10, 84, 78, 2, "deployed_fullstack", 72, "practicing",
            ["python", "dsa", "ml_basics"], 1, metrics["overall_score"], metrics["skill_gaps"], self.db_path
        )
        plan = build_fallback_plan(ev, "ml_ai_engineer", metrics)
        saved_plan = database.save_action_plan(snap_id, plan, self.db_path)

        latest_snap = database.get_latest_snapshot(self.profile["user_id"], self.db_path)
        latest_plan = database.get_latest_plan_for_user(self.profile["user_id"], self.db_path)
        self.assertIsNotNone(latest_snap)
        self.assertIsNotNone(latest_plan)
        self.assertEqual(latest_plan["plan_id"], saved_plan["plan_id"])

    def test_12_auth_signup_and_signin(self) -> None:
        """Scenario 12: Student Sign Up, duplicate email check, and PBKDF2 Sign In."""
        from python.validator import validate_signup, validate_signin

        prof, pw, role = validate_signup(
            {
                "display_name": "Arpita Shukla",
                "email": "arpita@kiet.edu",
                "password": "mysecret99",
                "branch": "CSE (AI & ML)",
                "target_role": "ui_ux_product",
                "semester": 6,
                "cgpa": 8.7,
            }
        )
        created = database.signup_student(
            prof.display_name, prof.email, pw, prof.branch, prof.target_role, prof.semester, prof.cgpa, self.db_path, role=role
        )
        self.assertIsNotNone(created)
        self.assertEqual(created["email"], "arpita@kiet.edu")
        self.assertNotIn("password_hash", created)

        # Duplicate email rejected
        dup = database.signup_student(
            prof.display_name, prof.email, pw, prof.branch, prof.target_role, prof.semester, prof.cgpa, self.db_path
        )
        self.assertIsNone(dup)

        # Valid sign-in succeeds, invalid password fails
        email, raw_pw = validate_signin({"email": "arpita@kiet.edu", "password": "mysecret99"})
        signed_in = database.signin_student(email, raw_pw, self.db_path)
        self.assertIsNotNone(signed_in)
        self.assertEqual(signed_in["user_id"], created["user_id"])
        self.assertIsNone(database.signin_student("arpita@kiet.edu", "wrongpass", self.db_path))

    def test_13_forgot_password_reset_and_login(self) -> None:
        """Scenario 13: Reset forgotten password by email and verify login with new password."""
        from python.validator import validate_forgot_password, validate_signup

        prof, pw, _ = validate_signup(
            {
                "display_name": "Neha Singh",
                "email": "neha@kiet.edu",
                "password": "oldpassword1",
                "branch": "CSE",
                "target_role": "fullstack_dev",
                "semester": 4,
                "cgpa": 8.0,
            }
        )
        database.signup_student(
            prof.display_name, prof.email, pw, prof.branch, prof.target_role, prof.semester, prof.cgpa, self.db_path
        )
        email, new_pw = validate_forgot_password({"email": "neha@kiet.edu", "new_password": "newpassword9"})
        self.assertTrue(database.reset_password_by_email(email, new_pw, self.db_path))
        self.assertIsNone(database.signin_student("neha@kiet.edu", "oldpassword1", self.db_path))
        self.assertIsNotNone(database.signin_student("neha@kiet.edu", "newpassword9", self.db_path))

    def test_14_daily_tasks_xp_and_study_notes(self) -> None:
        """Scenario 14: Daily target creation, toggle completion XP reward, and PDF study note storage."""
        from python.validator import validate_note, validate_task

        before_xp = database.get_profile(self.profile["user_id"], self.db_path)["xp_points"]
        tdata = validate_task(
            {
                "user_id": self.profile["user_id"],
                "title": "Solve 5 Dynamic Programming problems",
                "category": "DSA Practice",
                "priority": "high",
            }
        )
        task = database.create_task(**tdata, db_path=self.db_path)
        self.assertFalse(task["completed"])
        toggled = database.toggle_task(task["task_id"], self.db_path)
        self.assertTrue(toggled["completed"])
        after_xp = database.get_profile(self.profile["user_id"], self.db_path)["xp_points"]
        self.assertGreater(after_xp, before_xp)

        ndata = validate_note(
            {
                "user_id": self.profile["user_id"],
                "title": "Operating Systems Unit 4 Notes",
                "subject": "OS",
                "content": "Deadlock prevention and banker's algorithm walkthrough.",
                "file_name": "os_unit4.pdf",
                "file_path": "/uploads/notes/os_unit4.pdf",
                "mime_type": "application/pdf",
                "file_size": 4096,
            }
        )
        note = database.create_note(**ndata, db_path=self.db_path)
        self.assertEqual(note["file_name"], "os_unit4.pdf")
        self.assertEqual(len(database.list_notes(self.profile["user_id"], self.db_path)), 1)

    def test_15_smart_assessment_grading_and_skill_verification(self) -> None:
        """Scenario 15: Timed MCQ grading identifies weak topics and marks tested skills assessment_verified."""
        created_assessment = database.create_assessment(
            title="Python & DSA Quick Check",
            category="Technical MCQ",
            description="Verifies Python and DSA fundamentals.",
            duration_minutes=10,
            skill_keys=["python", "dsa"],
            questions=[
                {
                    "prompt": "Hash table lookup average complexity?",
                    "options": ["O(1)", "O(n)"],
                    "correct_index": 0,
                    "topic": "Hash Tables",
                    "explanation": "Direct bucket hashing is O(1).",
                },
                {
                    "prompt": "Shortest unweighted path algorithm?",
                    "options": ["DFS", "BFS"],
                    "correct_index": 1,
                    "topic": "Graph BFS",
                    "explanation": "BFS explores layer by layer.",
                },
            ],
            db_path=self.db_path,
        )
        result = database.submit_assessment(
            self.profile["user_id"],
            created_assessment["assessment_id"],
            [0, 0],  # 1 right, 1 wrong (Graph BFS)
            time_taken_sec=95,
            db_path=self.db_path,
        )
        self.assertEqual(result["score_pct"], 50)
        self.assertIn("Graph BFS", result["weak_topics"])

        skill_profile = database.get_student_skill_profile(self.profile["user_id"], self.db_path)
        python_skill = next(s for s in skill_profile["skills"] if s["skill_key"] == "python")
        self.assertEqual(python_skill["source"], "assessment_verified")

    def test_16_job_compatibility_and_skill_gap_analyzer(self) -> None:
        """Scenario 16: Skill proficiency gap analyzer and job opportunity compatibility scoring."""
        database.upsert_student_skills(
            self.profile["user_id"],
            [
                {"skill_key": "python", "proficiency": 88},
                {"skill_key": "sql_db", "proficiency": 76},
                {"skill_key": "ml_basics", "proficiency": 45},
            ],
            self.db_path,
        )
        gap_profile = database.get_student_skill_profile(self.profile["user_id"], self.db_path)
        self.assertTrue(any(s["skill_key"] == "python" for s in gap_profile["strengths"]))
        self.assertTrue(any(w["skill_key"] == "ml_basics" for w in gap_profile["weaknesses"]))

        job = database.create_job_opportunity(
            title="AI Engineer Trainee",
            company="TestCorp AI",
            location="Remote",
            work_mode="Remote",
            job_type="Internship",
            compensation="30k",
            target_role="ml_ai_engineer",
            required_skills=["python", "sql_db", "docker_cicd"],
            description="Build Python and SQL ML data services.",
            db_path=self.db_path,
        )
        jobs = database.list_jobs_for_user(self.profile["user_id"], self.db_path)
        matched_job = next(j for j in jobs if j["job_id"] == job["job_id"])
        self.assertEqual(matched_job["compatibility_score"], 67)
        self.assertIn("docker_cicd", matched_job["missing_skills"])

    def test_17_faculty_and_admin_rbac_analytics(self) -> None:
        """Scenario 17: Faculty feedback triggers student notification and Admin overview aggregates departments."""
        faculty = database.create_profile(
            "Prof. Verma", "ml_ai_engineer", 8, 9.2, self.db_path, email="prof@kiet.edu", role="faculty"
        )
        fb = database.add_faculty_feedback(
            self.profile["user_id"],
            faculty["user_id"],
            "DSA Prep",
            "Great progress on projects; attempt the Graph BFS quiz this week.",
            self.db_path,
        )
        self.assertEqual(fb["student_id"], self.profile["user_id"])
        notifs = database.list_notifications(self.profile["user_id"], self.db_path)
        self.assertEqual(len(notifs), 1)
        self.assertFalse(notifs[0]["is_read"])

        admin_summary = database.get_admin_overview(self.db_path)
        self.assertGreaterEqual(admin_summary["totals"]["students"], 1)
        self.assertGreaterEqual(admin_summary["totals"]["faculty"], 1)
        self.assertGreaterEqual(len(admin_summary["department_analytics"]), 1)


if __name__ == "__main__":
    unittest.main()
