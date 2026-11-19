"""Python student performance analysis, skill-gap engine, and action plan generator."""

from typing import Dict, Any, List
from python.catalog import ROLE_BENCHMARKS, REMEDIATION_CATALOG, INTERVIEW_QUESTION_BANK
from python.schemas import (
    ActionStep,
    CAREER_ROLES,
    EvidenceSnapshotInput,
    PROJECT_LEVELS,
    SKILL_OPTIONS,
    READINESS_DISCLAIMER,
)

PROJECT_DEPTH_SCORES: Dict[str, int] = {
    "none": 15,
    "academic_mini": 50,
    "deployed_fullstack": 80,
    "team_capstone": 95,
}


def compute_readiness_metrics(
    evidence: EvidenceSnapshotInput, target_role: str, cgpa: float
) -> Dict[str, Any]:
    """
    Deterministic Python algorithm calculating readiness score, sub-scores,
    matched skills, and prioritized skill gaps against target role benchmark.
    """
    required_skills = ROLE_BENCHMARKS.get(target_role, ROLE_BENCHMARKS["fullstack_dev"])
    verified_set = set(evidence.verified_skills)

    matched = [s for s in required_skills if s in verified_set]
    gaps = [s for s in required_skills if s not in verified_set]

    skill_coverage_pct = round((len(matched) / max(1, len(required_skills))) * 100)

    # Academic & Assessment Pillar (25%): blend assessment score (70%) + normalized CGPA (30%)
    cgpa_pct = min(100, round((cgpa / 10.0) * 100))
    academic_pillar = round(evidence.assessment_score * 0.7 + cgpa_pct * 0.3)

    # Technical Skill & Coding Pillar (30%): blend coding score (50%) + benchmark coverage (50%)
    technical_pillar = round(evidence.coding_score * 0.5 + skill_coverage_pct * 0.5)

    # Project Evidence Pillar (25%): project depth + count bonus + certifications bonus
    depth_base = PROJECT_DEPTH_SCORES.get(evidence.project_level, 40)
    count_bonus = min(15, evidence.project_count * 4)
    cert_bonus = min(10, evidence.certifications_count * 3)
    project_pillar = min(100, round(depth_base * 0.78 + count_bonus + cert_bonus))

    # Interview Readiness Pillar (20%): mock score + prep stage bonus
    prep_bonus = {"beginner": 0, "practicing": 8, "mock_ready": 15}.get(
        evidence.interview_prep_level, 0
    )
    interview_pillar = min(100, round(evidence.interview_score * 0.85 + prep_bonus))

    overall = round(
        academic_pillar * 0.25
        + technical_pillar * 0.30
        + project_pillar * 0.25
        + interview_pillar * 0.20
    )

    if overall >= 80:
        band = "Job-Ready"
    elif overall >= 62:
        band = "Developing Strong"
    elif overall >= 42:
        band = "Building Momentum"
    else:
        band = "Foundation Stage"

    return {
        "overall_score": overall,
        "readiness_band": band,
        "pillars": {
            "academic": academic_pillar,
            "technical_skills": technical_pillar,
            "projects": project_pillar,
            "interview_prep": interview_pillar,
        },
        "matched_skills": matched,
        "skill_gaps": gaps,
        "benchmark_total": len(required_skills),
    }


def build_fallback_plan(
    evidence: EvidenceSnapshotInput,
    target_role: str,
    metrics: Dict[str, Any],
    fallback_reason: str | None = None,
) -> Dict[str, Any]:
    """Deterministically assemble a study-hour-bounded action plan targeting identified skill gaps."""
    budget = evidence.weekly_study_hours
    gaps: List[str] = metrics["skill_gaps"]

    # Prioritize modules addressing identified gaps, then interview prep, then project polish
    def rank_module(mod: Dict[str, Any]) -> tuple[int, int]:
        is_gap = 2 if mod["focus_skill"] in gaps else 0
        is_interview = 1 if (mod["focus_skill"] == "interview" and evidence.interview_score < 75) else 0
        return (is_gap + is_interview, -mod["hours"])

    ranked = sorted(REMEDIATION_CATALOG, key=rank_module, reverse=True)

    chosen: List[ActionStep] = []
    used_hours = 0

    for mod in ranked:
        remaining = budget - used_hours
        if remaining <= 0:
            break
        step_hrs = min(mod["hours"], remaining)
        if step_hrs < 1:
            continue
        skill_name = SKILL_OPTIONS.get(mod["focus_skill"], "Interview Readiness")
        chosen.append(
            ActionStep(
                title=mod["title"],
                hours=step_hrs,
                focus_skill=skill_name,
                category=mod["category"],
                deliverable=mod["deliverable"],
                rationale=mod["rationale"],
            )
        )
        used_hours += step_hrs
        if len(chosen) >= 5:
            break

    role_label = CAREER_ROLES.get(target_role, target_role)
    gap_names = [SKILL_OPTIONS.get(g, g) for g in gaps[:3]]
    gap_summary = ", ".join(gap_names) if gap_names else "role depth and mock interview polish"

    questions = INTERVIEW_QUESTION_BANK.get(
        target_role, INTERVIEW_QUESTION_BANK["fullstack_dev"]
    )

    explanation = (
        f"Calculated {metrics['overall_score']}/100 ({metrics['readiness_band']}) readiness for {role_label}. "
        f"Allocated {used_hours} of your {budget} weekly hours directly toward {gap_summary}."
    )
    if fallback_reason:
        explanation += f" ({fallback_reason})"

    return {
        "title": f"{used_hours}-Hr Weekly Action Plan · {role_label}",
        "total_hours": used_hours,
        "readiness_summary": explanation,
        "action_steps": [{**s.to_dict(), "completed": False} for s in chosen],
        "interview_questions": questions,
        "explanation": explanation,
        "safety_note": READINESS_DISCLAIMER,
        "source": "python_rule_fallback",
        "metrics": metrics,
    }


def compare_roles_for_student(
    evidence: EvidenceSnapshotInput, cgpa: float
) -> List[Dict[str, Any]]:
    """Evaluate student readiness across all career paths using identical evidence."""
    results: List[Dict[str, Any]] = []
    for role_key, role_label in CAREER_ROLES.items():
        m = compute_readiness_metrics(evidence, role_key, cgpa)
        results.append(
            {
                "role_key": role_key,
                "role_label": role_label,
                "overall_score": m["overall_score"],
                "readiness_band": m["readiness_band"],
                "matched_count": len(m["matched_skills"]),
                "benchmark_total": m["benchmark_total"],
                "top_gaps": [SKILL_OPTIONS.get(g, g) for g in m["skill_gaps"][:3]],
            }
        )
    results.sort(key=lambda r: r["overall_score"], reverse=True)
    return results


def get_alternative_tasks(
    current_titles: List[str],
    target_role: str,
    skill_gaps: List[str],
) -> List[Dict[str, Any]]:
    """Return alternative skill-building tasks not already in the student's current action plan."""
    current_set = {t.lower() for t in current_titles}
    required = set(ROLE_BENCHMARKS.get(target_role, []))
    alternatives: List[Dict[str, Any]] = []

    for mod in REMEDIATION_CATALOG:
        if mod["title"].lower() in current_set:
            continue
        skill_label = SKILL_OPTIONS.get(mod["focus_skill"], "Interview Readiness")
        is_relevant = (
            mod["focus_skill"] in skill_gaps
            or mod["focus_skill"] in required
            or mod["focus_skill"] == "interview"
        )
        if is_relevant:
            alternatives.append(
                {
                    "title": mod["title"],
                    "hours": mod["hours"],
                    "focus_skill": skill_label,
                    "category": mod["category"],
                    "deliverable": mod["deliverable"],
                    "rationale": mod["rationale"],
                }
            )
    return alternatives[:6]


def modify_action_plan(
    plan: Dict[str, Any],
    action: str,
    weekly_study_hours: int,
    target_role: str,
    swap_index: int | None = None,
    replacement: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    """Apply supported student review actions while preserving the weekly study-hour ceiling."""
    steps = list(plan.get("action_steps", []))
    explanation = str(plan.get("explanation", ""))

    if action == "swap_task" and swap_index is not None and 0 <= swap_index < len(steps):
        if replacement:
            other_hrs = sum(int(s.get("hours", 2)) for i, s in enumerate(steps) if i != swap_index)
            max_allowed = max(1, weekly_study_hours - other_hrs)
            new_step = dict(replacement)
            new_step["hours"] = min(int(new_step.get("hours", 2)), max_allowed)
            steps[swap_index] = new_step
            explanation = f"Swapped action item while keeping total workload within {weekly_study_hours} hrs/week."

    elif action == "compress_hours":
        target_cap = max(2, int(plan.get("total_hours", weekly_study_hours)) - 2)
        trimmed: List[Dict[str, Any]] = []
        running = 0
        for st in steps:
            hrs = int(st.get("hours", 2))
            if running + hrs <= target_cap:
                trimmed.append(st)
                running += hrs
            elif target_cap - running >= 1 and len(trimmed) < 2:
                copy_st = dict(st)
                copy_st["hours"] = target_cap - running
                trimmed.append(copy_st)
                running += copy_st["hours"]
        if trimmed:
            steps = trimmed
        explanation = f"Compressed plan to {sum(int(s.get('hours', 1)) for s in steps)} hrs/week for a busy exam schedule."

    elif action == "focus_interview":
        role_questions = INTERVIEW_QUESTION_BANK.get(
            target_role, INTERVIEW_QUESTION_BANK["fullstack_dev"]
        )
        interview_step = {
            "title": "STAR Behavioral & Project Defense Mock Drill",
            "hours": min(2, weekly_study_hours),
            "focus_skill": "Interview Readiness",
            "category": "Interview Prep",
            "deliverable": "Practice concise architecture explanations & answer 3 role questions.",
            "rationale": "Prioritized per student request to boost upcoming interview confidence.",
        }
        if steps:
            steps[-1] = interview_step
        else:
            steps = [interview_step]
        plan["interview_questions"] = role_questions
        explanation = "Reprioritized the action plan around technical and behavioral interview readiness."

    total_hours = sum(int(s.get("hours", 1)) for s in steps)
    return {
        **plan,
        "total_hours": min(total_hours, weekly_study_hours),
        "action_steps": steps,
        "explanation": explanation,
        "readiness_summary": explanation,
        "safety_note": READINESS_DISCLAIMER,
    }


def evaluate_interview_answer_fallback(question: str, answer: str, hint: str) -> Dict[str, Any]:
    """Deterministic Python rubric evaluator when AI feedback is unavailable."""
    cleaned = answer.strip()
    words = [w for w in cleaned.split() if w]
    word_count = len(words)

    hint_keywords = [
        w.strip(".,()[]:").lower()
        for w in hint.split()
        if len(w.strip(".,()[]:")) >= 5
    ]
    matched_concepts = [kw for kw in dict.fromkeys(hint_keywords) if kw in cleaned.lower()]

    if word_count < 12:
        score = 45
        verdict = "Too Brief — Needs Technical Depth"
        feedback = (
            "Your answer is quite short. Aim for 3–5 clear sentences explaining the mechanism, "
            "a concrete example from your project, and one trade-off."
        )
    elif len(matched_concepts) >= 2 and word_count >= 25:
        score = 84
        verdict = "Strong Structured Explanation"
        feedback = (
            f"Good coverage of key concepts ({', '.join(matched_concepts[:3])}). "
            "To make it interview-ready, mention one edge case you tested."
        )
    else:
        score = 68
        verdict = "Solid Start — Add Specific Examples"
        feedback = (
            f"You explained the general idea ({word_count} words), but try incorporating concrete terms "
            f"from the rubric: {hint}"
        )

    return {
        "score": score,
        "verdict": verdict,
        "feedback": feedback,
        "suggested_focus": hint,
        "source": "python_rubric_fallback",
    }
