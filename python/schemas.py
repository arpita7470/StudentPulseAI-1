"""Input and domain schemas for StudentPulse AI."""

from dataclasses import dataclass, field
from typing import List, Dict, Any

CAREER_ROLES: Dict[str, str] = {
    "fullstack_dev": "Full-Stack Software Developer",
    "ml_ai_engineer": "AI & Machine Learning Engineer",
    "python_backend": "Backend & API Systems Engineer",
    "data_analyst": "Data & Analytics Engineer",
    "cloud_devops": "Cloud & DevOps Engineer",
    "ui_ux_product": "UI/UX & Product Designer",
    "cybersecurity_analyst": "Cybersecurity & Network Analyst",
}

PROJECT_LEVELS: Dict[str, str] = {
    "none": "No Projects Yet",
    "academic_mini": "Academic Mini-Projects (Local)",
    "deployed_fullstack": "Deployed Full-Stack / Live App",
    "team_capstone": "Team Capstone + Git Workflow & Tests",
}

INTERVIEW_PREP_LEVELS: Dict[str, str] = {
    "beginner": "Early Stage (Concepts Only)",
    "practicing": "Practicing DSA & Technical Q&A",
    "mock_ready": "Mock Interview Tested",
}

BRANCH_OPTIONS: List[str] = [
    "CSE",
    "IT",
    "CSE (AI & ML)",
    "CSE (Data Science)",
    "ECE",
    "MCA / BCA",
    "Other",
]

SKILL_OPTIONS: Dict[str, str] = {
    # Programming & CS Core
    "python": "Python Programming",
    "java_oop": "Java & Object-Oriented Programming",
    "js_ts": "JavaScript & TypeScript",
    "cpp_cp": "C++ & Competitive Coding",
    "dsa": "Data Structures & Algorithms",
    "system_design": "System Design & Architecture",
    # Web, Mobile & Product Design
    "react_ui": "Frontend (React / HTML / CSS)",
    "node_express": "Node.js & Express APIs",
    "api_integration": "REST APIs & Backend Integration",
    "ui_ux_figma": "UI/UX Design & Figma",
    "mobile_dev": "Mobile Apps (Flutter / React Native)",
    "git_collab": "Version Control (Git & GitHub)",
    # Data, AI & Cloud
    "sql_db": "SQL & Database Management",
    "ml_basics": "Machine Learning & Deep Learning",
    "prompt_eng": "Generative AI & Prompt Engineering",
    "data_viz": "Data Analytics & Visualization",
    "cloud_deploy": "Cloud Computing (AWS / GCP)",
    "docker_cicd": "Docker, Linux & CI/CD",
    # Quality, Security & Professional Readiness
    "testing_qa": "Software Testing & QA Automation",
    "cyber_sec": "Cybersecurity & App Security",
    "tech_comm": "Technical Communication & Docs",
    "problem_solving": "Analytical Problem Solving",
    "agile_team": "Team Collaboration & Agile",
    "interview_story": "Resume & Project Storytelling",
}

ACTION_STATUSES = {"completed", "in_progress", "skipped"}

READINESS_DISCLAIMER = (
    "Advisory academic and career-readiness guidance only. Use readiness scores and "
    "action plans alongside faculty mentorship, coursework milestones, and portfolio reviews."
)


@dataclass
class StudentProfileInput:
    display_name: str
    target_role: str
    semester: int
    cgpa: float
    email: str = ""
    branch: str = "CSE"


@dataclass
class EvidenceSnapshotInput:
    user_id: int
    weekly_study_hours: int
    assessment_score: int
    coding_score: int
    project_count: int
    project_level: str
    interview_score: int
    interview_prep_level: str
    verified_skills: List[str] = field(default_factory=list)
    certifications_count: int = 0


@dataclass
class ActionStep:
    title: str
    hours: int
    focus_skill: str
    category: str
    deliverable: str
    rationale: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "title": self.title,
            "hours": self.hours,
            "focus_skill": self.focus_skill,
            "category": self.category,
            "deliverable": self.deliverable,
            "rationale": self.rationale,
        }
