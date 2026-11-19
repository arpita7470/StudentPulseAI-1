"""Data-minimized, constraint-locked AI prompt builder for StudentPulse AI."""

import json
from typing import Any, Dict, List
from python.schemas import (
    CAREER_ROLES,
    EvidenceSnapshotInput,
    PROJECT_LEVELS,
    SKILL_OPTIONS,
)
from python.catalog import REMEDIATION_CATALOG


def build_readiness_prompt(
    evidence: EvidenceSnapshotInput,
    target_role: str,
    metrics: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Build a constrained prompt for Gemini API.
    Data minimisation: NEVER includes student display_name, roll number, or email.
    """
    role_label = CAREER_ROLES.get(target_role, target_role)
    gap_labels = [SKILL_OPTIONS.get(g, g) for g in metrics["skill_gaps"]]
    matched_labels = [SKILL_OPTIONS.get(m, m) for m in metrics["matched_skills"]]
    proj_label = PROJECT_LEVELS.get(evidence.project_level, evidence.project_level)

    candidate_tasks: List[Dict[str, Any]] = [
        {
            "title": m["title"],
            "hours": m["hours"],
            "focus_skill": SKILL_OPTIONS.get(m["focus_skill"], "Interview Readiness"),
            "category": m["category"],
        }
        for m in REMEDIATION_CATALOG
    ]

    system_instruction = (
        "You are StudentPulse AI, a supportive academic and career-readiness mentor for college students. "
        "Provide practical, encouraging educational guidance ONLY. "
        "STRICT CONSTRAINTS: "
        f"1. total_hours MUST NOT exceed {evidence.weekly_study_hours} hours. "
        "2. Prioritize the student's identified skill gaps and target career role. "
        "3. Include 3 targeted, role-appropriate mock interview questions with concise rubric hints. "
        "4. Return valid JSON matching the exact schema requested."
    )

    user_prompt = (
        f"Generate a personalized weekly action plan and interview prep set:\n"
        f"- Target Career Role: {role_label}\n"
        f"- Computed Overall Readiness: {metrics['overall_score']}/100 ({metrics['readiness_band']})\n"
        f"- Weekly Study Budget: {evidence.weekly_study_hours} hours (hard ceiling)\n"
        f"- Project Evidence: {evidence.project_count} project(s) at '{proj_label}' depth\n"
        f"- Verified Skills: {json.dumps(matched_labels)}\n"
        f"- Identified Skill Gaps: {json.dumps(gap_labels)}\n\n"
        f"Reference remediation tasks:\n{json.dumps(candidate_tasks, indent=2)}\n\n"
        "Return JSON with keys: title, total_hours (integer <= weekly_study_hours), "
        "readiness_summary, action_steps (array of {title, hours, focus_skill, category, deliverable, rationale}), "
        "interview_questions (array of 3 {question, topic, hint}), and explanation."
    )

    return {
        "system_instruction": system_instruction,
        "user_prompt": user_prompt,
        "transmitted_fields": {
            "target_role": target_role,
            "overall_score": metrics["overall_score"],
            "weekly_study_hours": evidence.weekly_study_hours,
            "project_level": evidence.project_level,
            "skill_gaps": metrics["skill_gaps"],
        },
    }
