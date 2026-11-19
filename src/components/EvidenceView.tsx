import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  Check,
  ExternalLink,
  FolderGit2,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import {
  CAREER_ROLE_LABELS,
  INTERVIEW_PREP_LABELS,
  PROJECT_LEVEL_LABELS,
  SKILL_CATEGORIES,
  SKILL_LABELS,
  type EvidenceSnapshot,
  type InterviewPrepLevel,
  type ProjectLevel,
  type SkillKey,
  type StudentProfile,
  type StudentProject,
} from "../types/studentpulse";
import { ApiError, createProject, deleteProject, fetchProjects } from "../lib/api";
import { SafeImage } from "./SafeImage";

interface EvidenceViewProps {
  activeProfile: StudentProfile;
  latestSnapshot: EvidenceSnapshot | null;
  loading: boolean;
  onBackToProfile: () => void;
  onGeneratePlan: (payload: {
    user_id: number;
    weekly_study_hours: number;
    assessment_score: number;
    coding_score: number;
    project_count: number;
    project_level: ProjectLevel;
    interview_score: number;
    interview_prep_level: InterviewPrepLevel;
    verified_skills: SkillKey[];
    certifications_count: number;
  }) => Promise<void>;
}

const HOUR_PRESETS = [6, 10, 14, 20];
const PROJECT_KEYS = Object.keys(PROJECT_LEVEL_LABELS) as ProjectLevel[];
const PREP_KEYS = Object.keys(INTERVIEW_PREP_LABELS) as InterviewPrepLevel[];

export function EvidenceView({
  activeProfile,
  latestSnapshot,
  loading,
  onBackToProfile,
  onGeneratePlan,
}: EvidenceViewProps) {
  // Portfolio Projects State
  const [projects, setProjects] = useState<StudentProject[]>([]);
  const [showAddProject, setShowAddProject] = useState(false);
  const [projTitle, setProjTitle] = useState("");
  const [projSummary, setProjSummary] = useState("");
  const [projRepo, setProjRepo] = useState("");
  const [projLive, setProjLive] = useState("");
  const [projHasTests, setProjHasTests] = useState(false);
  const [projSkills, setProjSkills] = useState<SkillKey[]>(["js_ts", "react_ui"]);
  const [projCategoryFilter, setProjCategoryFilter] = useState<string>("all");
  const [projErrors, setProjErrors] = useState<Record<string, string>>({});
  const [savingProject, setSavingProject] = useState(false);

  // Readiness Evidence Form State
  const [weeklyHours, setWeeklyHours] = useState("10");
  const [assessmentScore, setAssessmentScore] = useState("78");
  const [codingScore, setCodingScore] = useState("72");
  const [projectCount, setProjectCount] = useState("2");
  const [projectLevel, setProjectLevel] = useState<ProjectLevel>("academic_mini");
  const [interviewScore, setInterviewScore] = useState("65");
  const [interviewPrepLevel, setInterviewPrepLevel] = useState<InterviewPrepLevel>("practicing");
  const [certCount, setCertCount] = useState("1");
  const [verifiedSkills, setVerifiedSkills] = useState<SkillKey[]>([
    "js_ts",
    "dsa",
    "git_collab",
    "problem_solving",
  ]);
  const [skillCategoryFilter, setSkillCategoryFilter] = useState<string>("all");
  const [skillSearch, setSkillSearch] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Prefill from student's latest SQLite snapshot when switching students
  useEffect(() => {
    if (latestSnapshot) {
      setWeeklyHours(String(latestSnapshot.weekly_study_hours));
      setAssessmentScore(String(latestSnapshot.assessment_score));
      setCodingScore(String(latestSnapshot.coding_score));
      setProjectCount(String(latestSnapshot.project_count));
      setProjectLevel(latestSnapshot.project_level);
      setInterviewScore(String(latestSnapshot.interview_score));
      setInterviewPrepLevel(latestSnapshot.interview_prep_level);
      setCertCount(String(latestSnapshot.certifications_count));
      setVerifiedSkills(
        latestSnapshot.verified_skills && latestSnapshot.verified_skills.length > 0
          ? latestSnapshot.verified_skills
          : ["js_ts", "git_collab"]
      );
    } else {
      setWeeklyHours("10");
      setAssessmentScore("75");
      setCodingScore("70");
      setProjectCount("0");
      setProjectLevel("none");
      setInterviewScore("60");
      setInterviewPrepLevel("beginner");
      setCertCount("0");
      setVerifiedSkills(["js_ts", "git_collab", "problem_solving"]);
    }
    setFieldErrors({});
    setGeneralError(null);
  }, [activeProfile.user_id, latestSnapshot?.snapshot_id]);

  useEffect(() => {
    fetchProjects(activeProfile.user_id)
      .then((loaded) => {
        setProjects(loaded);
        if (!latestSnapshot) {
          syncEvidenceFromProjects(loaded);
        }
      })
      .catch(() => setProjects([]));
  }, [activeProfile.user_id]);

  const filteredSkillCategories = useMemo(() => {
    const query = skillSearch.trim().toLowerCase();
    return SKILL_CATEGORIES.filter(
      (cat) => skillCategoryFilter === "all" || cat.id === skillCategoryFilter
    )
      .map((cat) => ({
        ...cat,
        skills: cat.skills.filter(
          (sk) => !query || SKILL_LABELS[sk].toLowerCase().includes(query)
        ),
      }))
      .filter((cat) => cat.skills.length > 0);
  }, [skillCategoryFilter, skillSearch]);

  const filteredProjSkills = useMemo(() => {
    const cats = SKILL_CATEGORIES.filter(
      (cat) => projCategoryFilter === "all" || cat.id === projCategoryFilter
    );
    return cats.flatMap((c) => c.skills);
  }, [projCategoryFilter]);

  function syncEvidenceFromProjects(list: StudentProject[]) {
    setProjectCount(String(list.length));
    const hasDeployed = list.some((p) => Boolean(p.live_url));
    const hasTests = list.some((p) => p.has_tests);
    if (hasTests && list.length >= 2) {
      setProjectLevel("team_capstone");
    } else if (hasDeployed) {
      setProjectLevel("deployed_fullstack");
    } else if (list.length > 0) {
      setProjectLevel("academic_mini");
    } else {
      setProjectLevel("none");
    }
    const stackSkills = Array.from(new Set(list.flatMap((p) => p.tech_stack)));
    if (stackSkills.length > 0) {
      setVerifiedSkills((prev) => Array.from(new Set([...prev, ...stackSkills])));
    }
  }

  function toggleSkill(skill: SkillKey) {
    setVerifiedSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  }

  function toggleProjSkill(skill: SkillKey) {
    setProjSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  }

  async function handleAddProject(e: FormEvent) {
    e.preventDefault();
    setProjErrors({});
    setSavingProject(true);
    try {
      const created = await createProject({
        user_id: activeProfile.user_id,
        title: projTitle.trim(),
        summary: projSummary.trim(),
        tech_stack: projSkills,
        repo_url: projRepo.trim(),
        live_url: projLive.trim(),
        has_tests: projHasTests,
      });
      const updated = [created, ...projects];
      setProjects(updated);
      syncEvidenceFromProjects(updated);
      setProjTitle("");
      setProjSummary("");
      setProjRepo("");
      setProjLive("");
      setProjHasTests(false);
      setShowAddProject(false);
    } catch (err) {
      if (err instanceof ApiError) {
        setProjErrors(err.fieldErrors);
      } else {
        setProjErrors({ title: "Could not save project." });
      }
    } finally {
      setSavingProject(false);
    }
  }

  async function handleDeleteProject(projectId: number) {
    try {
      await deleteProject(projectId);
      const next = projects.filter((p) => p.project_id !== projectId);
      setProjects(next);
      syncEvidenceFromProjects(next);
    } catch {
      setGeneralError("Could not delete project.");
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setGeneralError(null);

    const hours = Number(weeklyHours);
    const assess = Number(assessmentScore);
    const coding = Number(codingScore);
    const projectsNum = Number(projectCount);
    const interview = Number(interviewScore);
    const certs = Number(certCount);

    const localErrors: Record<string, string> = {};
    if (!Number.isInteger(hours) || hours < 2 || hours > 40) {
      localErrors.weekly_study_hours = "Weekly study hours must be 2–40.";
    }
    if (!Number.isInteger(assess) || assess < 0 || assess > 100) {
      localErrors.assessment_score = "Assessment score must be 0–100%.";
    }
    if (!Number.isInteger(coding) || coding < 0 || coding > 100) {
      localErrors.coding_score = "Coding score must be 0–100%.";
    }
    if (!Number.isInteger(projectsNum) || projectsNum < 0 || projectsNum > 20) {
      localErrors.project_count = "Project count must be 0–20.";
    }
    if (!Number.isInteger(interview) || interview < 0 || interview > 100) {
      localErrors.interview_score = "Mock interview score must be 0–100%.";
    }

    if (Object.keys(localErrors).length > 0) {
      setFieldErrors(localErrors);
      return;
    }

    try {
      await onGeneratePlan({
        user_id: activeProfile.user_id,
        weekly_study_hours: hours,
        assessment_score: assess,
        coding_score: coding,
        project_count: projectsNum,
        project_level: projectLevel,
        interview_score: interview,
        interview_prep_level: interviewPrepLevel,
        verified_skills: verifiedSkills,
        certifications_count: Number.isInteger(certs) ? certs : 0,
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setFieldErrors(err.fieldErrors);
        setGeneralError(err.message);
      } else {
        setGeneralError(err instanceof Error ? err.message : "Could not analyze readiness.");
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs text-[#56665f] dark:text-[#869b92]">
            Student: {activeProfile.display_name} · Target Role:{" "}
            {CAREER_ROLE_LABELS[activeProfile.target_role]?.label} · Sem {activeProfile.semester}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#14211d] dark:text-cream-50 mt-1">
            Projects Portfolio & Readiness Evidence
          </h1>
        </div>
        <button
          type="button"
          onClick={onBackToProfile}
          className="px-3.5 py-2 text-xs font-medium text-[#1f2f29] dark:text-[#dbe6e0] bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-700 hover:border-pine-600 rounded-lg flex items-center gap-1.5 whitespace-nowrap"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Account & Role Settings
        </button>
      </div>

      {/* Portfolio Projects Registry (Real SQLite CRUD) */}
      <section className="bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <FolderGit2 className="w-4 h-4 text-pine-700 dark:text-[#6ec4b0]" />
            <div>
              <h2 className="text-base font-bold text-[#14211d] dark:text-cream-50">
                Logged Project Portfolio ({projects.length})
              </h2>
              <p className="text-xs text-[#56665f] dark:text-[#869b92]">
                Adding projects automatically syncs your project depth and verified technical &
                design skills below.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowAddProject((v) => !v)}
            className="px-3.5 py-2 bg-pine-700 hover:bg-pine-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            {showAddProject ? "Close Form" : "Add Project Evidence"}
          </button>
        </div>

        {showAddProject && (
          <form
            onSubmit={handleAddProject}
            className="p-5 bg-sage-50 dark:bg-pine-950 border border-sage-200 dark:border-pine-800 rounded-lg space-y-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#14211d] dark:text-cream-50 mb-1">
                  Project Title
                </label>
                <input
                  type="text"
                  value={projTitle}
                  onChange={(e) => setProjTitle(e.target.value)}
                  placeholder="e.g., Campus Bus Live Tracker"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-sage-300 dark:border-pine-700 bg-cream-50 dark:bg-pine-900"
                />
                {projErrors.title && (
                  <p className="text-[11px] text-red-600 mt-1">{projErrors.title}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#14211d] dark:text-cream-50 mb-1">
                  GitHub Repository URL (Optional)
                </label>
                <input
                  type="url"
                  value={projRepo}
                  onChange={(e) => setProjRepo(e.target.value)}
                  placeholder="https://github.com/username/repo"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-sage-300 dark:border-pine-700 bg-cream-50 dark:bg-pine-900"
                />
                {projErrors.repo_url && (
                  <p className="text-[11px] text-red-600 mt-1">{projErrors.repo_url}</p>
                )}
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-[#14211d] dark:text-cream-50 mb-1">
                  Architecture & Impact Summary
                </label>
                <input
                  type="text"
                  value={projSummary}
                  onChange={(e) => setProjSummary(e.target.value)}
                  placeholder="Describe what you built, tech stack, architecture, and measurable outcome..."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-sage-300 dark:border-pine-700 bg-cream-50 dark:bg-pine-900"
                />
                {projErrors.summary && (
                  <p className="text-[11px] text-red-600 mt-1">{projErrors.summary}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#14211d] dark:text-cream-50 mb-1">
                  Deployed Live URL (Optional)
                </label>
                <input
                  type="url"
                  value={projLive}
                  onChange={(e) => setProjLive(e.target.value)}
                  placeholder="https://my-project.example.com"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-sage-300 dark:border-pine-700 bg-cream-50 dark:bg-pine-900"
                />
                {projErrors.live_url && (
                  <p className="text-[11px] text-red-600 mt-1">{projErrors.live_url}</p>
                )}
              </div>

              <div className="flex items-end pb-1">
                <label className="inline-flex items-center gap-2 text-xs font-medium text-[#14211d] dark:text-cream-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={projHasTests}
                    onChange={(e) => setProjHasTests(e.target.checked)}
                    className="rounded border-sage-300 text-pine-700"
                  />
                  Includes automated unit/integration tests
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[#14211d] dark:text-cream-50">
                  Skills Demonstrated ({projSkills.length} selected)
                </span>
                <div className="flex flex-wrap items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setProjCategoryFilter("all")}
                    className={`px-2 py-1 text-[11px] rounded border ${
                      projCategoryFilter === "all"
                        ? "bg-pine-700 text-white border-pine-700"
                        : "bg-cream-50 dark:bg-pine-900 text-[#45554e] dark:text-[#c5d4cd] border-sage-200 dark:border-pine-700"
                    }`}
                  >
                    All
                  </button>
                  {SKILL_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setProjCategoryFilter(cat.id)}
                      className={`px-2 py-1 text-[11px] rounded border ${
                        projCategoryFilter === cat.id
                          ? "bg-pine-700 text-white border-pine-700"
                          : "bg-cream-50 dark:bg-pine-900 text-[#45554e] dark:text-[#c5d4cd] border-sage-200 dark:border-pine-700"
                      }`}
                    >
                      {cat.label.split("&")[0].trim()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {filteredProjSkills.map((sk) => {
                  const active = projSkills.includes(sk);
                  return (
                    <button
                      key={sk}
                      type="button"
                      onClick={() => toggleProjSkill(sk)}
                      className={`px-2.5 py-1.5 rounded-md border text-[11px] font-medium transition-colors ${
                        active
                          ? "bg-pine-700 text-white border-pine-700"
                          : "bg-cream-50 dark:bg-pine-900 text-[#2c3d37] dark:text-[#c5d4cd] border-sage-200 dark:border-pine-700 hover:border-pine-500"
                      }`}
                    >
                      {SKILL_LABELS[sk]}
                    </button>
                  );
                })}
              </div>
              {projErrors.tech_stack && (
                <p className="text-[11px] text-red-600 mt-1">{projErrors.tech_stack}</p>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="submit"
                disabled={savingProject}
                className="px-4 py-2 bg-pine-700 hover:bg-pine-800 text-white text-xs font-semibold rounded-lg"
              >
                {savingProject ? "Saving..." : "Save Project to Portfolio"}
              </button>
            </div>
          </form>
        )}

        {projects.length === 0 ? (
          <div className="p-4 bg-sage-50 dark:bg-pine-950 border border-sage-200 dark:border-pine-800 rounded-lg text-xs text-[#45554e] dark:text-[#869b92]">
            No portfolio projects logged yet for {activeProfile.display_name}. Add a project above
            to auto-verify its skills.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {projects.map((proj) => (
              <div
                key={proj.project_id}
                className="p-4 border border-sage-200 dark:border-pine-800 bg-sage-50/70 dark:bg-pine-950 rounded-lg flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-[#14211d] dark:text-cream-50">
                      {proj.title}
                    </h3>
                    <button
                      type="button"
                      aria-label={`Delete ${proj.title}`}
                      onClick={() => handleDeleteProject(proj.project_id)}
                      className="text-[#869b92] hover:text-red-600 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-xs text-[#45554e] dark:text-[#c5d4cd] mt-1 leading-relaxed">
                    {proj.summary}
                  </p>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-sage-200 dark:border-pine-800">
                  <div className="text-[11px] text-[#56665f] dark:text-[#869b92]">
                    {proj.tech_stack.map((s) => SKILL_LABELS[s] || s).join(" · ")}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-[11px]">
                    {proj.has_tests && (
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        Tests Verified
                      </span>
                    )}
                    {proj.repo_url && (
                      <a
                        href={proj.repo_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-pine-700 dark:text-[#6ec4b0] hover:underline inline-flex items-center gap-1 font-medium"
                      >
                        GitHub
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    {proj.live_url && (
                      <a
                        href={proj.live_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-ochre-600 dark:text-ochre-400 hover:underline inline-flex items-center gap-1 font-medium"
                      >
                        Live Demo
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Assessment & Readiness Snapshot Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-8 bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl p-6 sm:p-8 space-y-7"
        >
          {generalError && (
            <div
              role="alert"
              className="p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-700 dark:text-red-300 font-medium"
            >
              {generalError}
            </div>
          )}

          {/* 01. Weekly Study Hours Budget */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <label htmlFor="weekly-hours" className="text-sm font-semibold text-[#14211d] dark:text-cream-50">
                01. Weekly Study & Prep Time Available (hours)
              </label>
              <span className="text-xs text-[#56665f] dark:text-[#869b92]">
                Allowed range: 2–40 hrs/week
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {HOUR_PRESETS.map((preset) => {
                const active = Number(weeklyHours) === preset;
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setWeeklyHours(String(preset));
                      setFieldErrors((p) => ({ ...p, weekly_study_hours: "" }));
                    }}
                    className={`px-3.5 py-2 rounded-lg text-xs font-semibold font-mono tabular-nums border transition-colors ${
                      active
                        ? "bg-pine-700 text-white border-pine-700"
                        : "bg-white dark:bg-pine-950 text-[#2c3d37] dark:text-[#c5d4cd] border-sage-200 dark:border-pine-700 hover:border-pine-500"
                    }`}
                  >
                    {preset} hrs
                  </button>
                );
              })}

              <div className="flex items-center gap-2 ml-auto">
                <input
                  id="weekly-hours"
                  type="number"
                  min={2}
                  max={40}
                  value={weeklyHours}
                  onChange={(e) => {
                    setWeeklyHours(e.target.value);
                    setFieldErrors((p) => ({ ...p, weekly_study_hours: "" }));
                  }}
                  className={`w-24 px-3 py-2 text-sm font-mono tabular-nums rounded-lg border bg-white dark:bg-pine-950 focus:outline-none focus:ring-2 focus:ring-pine-600/20 ${
                    fieldErrors.weekly_study_hours
                      ? "border-red-500"
                      : "border-sage-300 dark:border-pine-700"
                  }`}
                />
                <span className="text-xs text-[#56665f] dark:text-[#869b92]">hrs/wk</span>
              </div>
            </div>
            {fieldErrors.weekly_study_hours && (
              <p className="text-xs text-red-600 font-medium">{fieldErrors.weekly_study_hours}</p>
            )}
          </div>

          {/* 02. Assessments & Coding Scores */}
          <div className="space-y-4 pt-5 border-t border-sage-200 dark:border-pine-800">
            <div className="text-sm font-semibold text-[#14211d] dark:text-cream-50">
              02. Assessment & Practical Performance
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label
                  htmlFor="assess-score"
                  className="block text-xs font-semibold text-[#2c3d37] dark:text-[#c5d4cd] mb-1.5"
                >
                  Academic Assessment (%)
                </label>
                <input
                  id="assess-score"
                  type="number"
                  min={0}
                  max={100}
                  value={assessmentScore}
                  onChange={(e) => setAssessmentScore(e.target.value)}
                  className={`w-full px-3 py-2 text-sm font-mono tabular-nums rounded-lg border bg-white dark:bg-pine-950 focus:outline-none focus:ring-2 focus:ring-pine-600/20 ${
                    fieldErrors.assessment_score
                      ? "border-red-500"
                      : "border-sage-300 dark:border-pine-700"
                  }`}
                />
                {fieldErrors.assessment_score && (
                  <p className="text-xs text-red-600 mt-1">{fieldErrors.assessment_score}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="coding-score"
                  className="block text-xs font-semibold text-[#2c3d37] dark:text-[#c5d4cd] mb-1.5"
                >
                  Coding / Practical Lab (%)
                </label>
                <input
                  id="coding-score"
                  type="number"
                  min={0}
                  max={100}
                  value={codingScore}
                  onChange={(e) => setCodingScore(e.target.value)}
                  className={`w-full px-3 py-2 text-sm font-mono tabular-nums rounded-lg border bg-white dark:bg-pine-950 focus:outline-none focus:ring-2 focus:ring-pine-600/20 ${
                    fieldErrors.coding_score
                      ? "border-red-500"
                      : "border-sage-300 dark:border-pine-700"
                  }`}
                />
                {fieldErrors.coding_score && (
                  <p className="text-xs text-red-600 mt-1">{fieldErrors.coding_score}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="interview-score"
                  className="block text-xs font-semibold text-[#2c3d37] dark:text-[#c5d4cd] mb-1.5"
                >
                  Mock Interview Score (%)
                </label>
                <input
                  id="interview-score"
                  type="number"
                  min={0}
                  max={100}
                  value={interviewScore}
                  onChange={(e) => setInterviewScore(e.target.value)}
                  className={`w-full px-3 py-2 text-sm font-mono tabular-nums rounded-lg border bg-white dark:bg-pine-950 focus:outline-none focus:ring-2 focus:ring-pine-600/20 ${
                    fieldErrors.interview_score
                      ? "border-red-500"
                      : "border-sage-300 dark:border-pine-700"
                  }`}
                />
                {fieldErrors.interview_score && (
                  <p className="text-xs text-red-600 mt-1">{fieldErrors.interview_score}</p>
                )}
              </div>
            </div>
          </div>

          {/* 03. Project Evidence & Certifications */}
          <div className="space-y-4 pt-5 border-t border-sage-200 dark:border-pine-800">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm font-semibold text-[#14211d] dark:text-cream-50">
                03. Project Depth & Interview Stage
              </span>
              <span className="text-xs text-[#56665f] dark:text-[#869b92]">
                Auto-synced from portfolio above
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="project-count"
                  className="block text-xs font-semibold text-[#2c3d37] dark:text-[#c5d4cd] mb-1.5"
                >
                  Completed Projects Count
                </label>
                <input
                  id="project-count"
                  type="number"
                  min={0}
                  max={20}
                  value={projectCount}
                  onChange={(e) => setProjectCount(e.target.value)}
                  className={`w-full px-3 py-2 text-sm font-mono tabular-nums rounded-lg border bg-white dark:bg-pine-950 focus:outline-none focus:ring-2 focus:ring-pine-600/20 ${
                    fieldErrors.project_count
                      ? "border-red-500"
                      : "border-sage-300 dark:border-pine-700"
                  }`}
                />
                {fieldErrors.project_count && (
                  <p className="text-xs text-red-600 mt-1">{fieldErrors.project_count}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="cert-count"
                  className="block text-xs font-semibold text-[#2c3d37] dark:text-[#c5d4cd] mb-1.5"
                >
                  Verified Certifications
                </label>
                <input
                  id="cert-count"
                  type="number"
                  min={0}
                  max={20}
                  value={certCount}
                  onChange={(e) => setCertCount(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums rounded-lg border border-sage-300 dark:border-pine-700 bg-white dark:bg-pine-950 focus:outline-none focus:ring-2 focus:ring-pine-600/20"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {PROJECT_KEYS.map((pKey) => {
                const selected = projectLevel === pKey;
                return (
                  <button
                    key={pKey}
                    type="button"
                    onClick={() => setProjectLevel(pKey)}
                    className={`p-3 rounded-lg border text-left transition-colors ${
                      selected
                        ? "bg-cream-100 dark:bg-pine-950/40 border-pine-700"
                        : "bg-white dark:bg-pine-950 border-sage-200 dark:border-pine-800 hover:border-pine-500"
                    }`}
                  >
                    <div className="text-xs font-semibold text-[#14211d] dark:text-cream-50">
                      {PROJECT_LEVEL_LABELS[pKey].label}
                    </div>
                    <div className="text-[11px] text-[#56665f] dark:text-[#869b92] mt-0.5">
                      {PROJECT_LEVEL_LABELS[pKey].hint}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {PREP_KEYS.map((prepKey) => {
                const selected = interviewPrepLevel === prepKey;
                return (
                  <button
                    key={prepKey}
                    type="button"
                    onClick={() => setInterviewPrepLevel(prepKey)}
                    className={`p-3 rounded-lg border text-left transition-colors ${
                      selected
                        ? "bg-cream-100 dark:bg-pine-950/40 border-ochre-500"
                        : "bg-white dark:bg-pine-950 border-sage-200 dark:border-pine-800 hover:border-ochre-400"
                    }`}
                  >
                    <div className="text-xs font-semibold text-[#14211d] dark:text-cream-50">
                      {INTERVIEW_PREP_LABELS[prepKey].label}
                    </div>
                    <div className="text-[11px] text-[#56665f] dark:text-[#869b92] mt-0.5">
                      {INTERVIEW_PREP_LABELS[prepKey].hint}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 04. Verified Multi-Disciplinary Skills */}
          <div className="space-y-4 pt-5 border-t border-sage-200 dark:border-pine-800">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <span className="text-sm font-semibold text-[#14211d] dark:text-cream-50">
                  04. Verified Skills & Competencies ({verifiedSkills.length}/24 selected)
                </span>
                <p className="text-xs text-[#56665f] dark:text-[#869b92] mt-0.5">
                  Select technical, design, cloud, and soft skills you have practiced. Unchecked
                  target-role skills become prioritized gaps.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSkillCategoryFilter("all")}
                  className={`px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                    skillCategoryFilter === "all"
                      ? "bg-pine-700 text-white border-pine-700"
                      : "bg-white dark:bg-pine-950 text-[#45554e] dark:text-[#c5d4cd] border-sage-200 dark:border-pine-700 hover:border-pine-500"
                  }`}
                >
                  All (24)
                </button>
                {SKILL_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSkillCategoryFilter(cat.id)}
                    className={`px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                      skillCategoryFilter === cat.id
                        ? "bg-pine-700 text-white border-pine-700"
                        : "bg-white dark:bg-pine-950 text-[#45554e] dark:text-[#c5d4cd] border-sage-200 dark:border-pine-700 hover:border-pine-500"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-52">
                <Search className="w-3.5 h-3.5 text-[#869b92] absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={skillSearch}
                  onChange={(e) => setSkillSearch(e.target.value)}
                  placeholder="Filter skills..."
                  className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-lg border border-sage-300 dark:border-pine-700 bg-white dark:bg-pine-950 focus:outline-none focus:ring-2 focus:ring-pine-600/20"
                />
              </div>
            </div>

            <div className="space-y-5">
              {filteredSkillCategories.map((category) => (
                <div key={category.id} className="space-y-2">
                  <div className="text-xs font-semibold text-pine-700 dark:text-[#6ec4b0]">
                    {category.label}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {category.skills.map((sKey) => {
                      const selected = verifiedSkills.includes(sKey);
                      return (
                        <button
                          key={sKey}
                          type="button"
                          onClick={() => toggleSkill(sKey)}
                          className={`px-3.5 py-2.5 rounded-lg border text-xs font-medium flex items-center justify-between gap-2 transition-colors ${
                            selected
                              ? "bg-cream-100 dark:bg-pine-950/40 border-pine-700 text-pine-800 dark:text-cream-100 font-semibold"
                              : "bg-white dark:bg-pine-950 border-sage-200 dark:border-pine-800 text-[#2c3d37] dark:text-[#c5d4cd] hover:border-pine-500"
                          }`}
                        >
                          <span className="truncate">{SKILL_LABELS[sKey]}</span>
                          {selected && <Check className="w-3.5 h-3.5 text-pine-700 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-5 border-t border-sage-200 dark:border-pine-800 flex flex-wrap items-center justify-between gap-4">
            <span className="text-xs text-[#56665f] dark:text-[#869b92]">
              Computes 4-pillar readiness & cross-role fit before generating weekly action modules
            </span>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-pine-700 hover:bg-pine-800 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap"
            >
              {loading ? "Analyzing Evidence & Building Plan..." : "Compute Readiness & Action Plan"}
            </button>
          </div>
        </form>

        {/* Right Column */}
        <aside className="lg:col-span-4 space-y-5">
          <div className="bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl overflow-hidden">
            <div className="h-48 bg-cream-100 dark:bg-pine-800">
              <SafeImage
                src="/src/assets/images/ppt_study_analytics_1795089575398.jpg"
                alt="Editorial illustration of a student workspace with multi-disciplinary skill analytics and project checklists"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="p-5 space-y-1.5">
              <div className="text-xs text-[#56665f] dark:text-[#869b92]">Target Benchmark</div>
              <div className="text-base font-semibold text-[#14211d] dark:text-cream-50">
                {CAREER_ROLE_LABELS[activeProfile.target_role]?.label}
              </div>
              <p className="text-xs text-[#45554e] dark:text-[#c5d4cd] leading-relaxed">
                {CAREER_ROLE_LABELS[activeProfile.target_role]?.summary}
              </p>
            </div>
          </div>

          <div className="bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#14211d] dark:text-cream-50">
              <ShieldCheck className="w-4 h-4 text-pine-700 dark:text-[#6ec4b0]" />
              Data Minimisation & Privacy Guard
            </div>
            <p className="text-xs text-[#45554e] dark:text-[#c5d4cd] leading-relaxed">
              Your name, email, and personal identifiers stay strictly in local SQLite. Only
              non-identifying readiness parameters are transmitted to AI planning:
            </p>
            <div className="p-3 bg-sage-50 dark:bg-pine-950 border border-sage-200 dark:border-pine-800 rounded-lg font-mono text-[11px] text-[#1f2f29] dark:text-[#dbe6e0] space-y-1">
              <div>role: "{activeProfile.target_role}"</div>
              <div>study_budget: {weeklyHours || "—"} hrs/wk</div>
              <div>project_level: "{projectLevel}"</div>
              <div>verified_count: {verifiedSkills.length} skills</div>
            </div>
          </div>
        </aside>
      </div>

      {loading && (
        <div
          aria-live="polite"
          className="bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl p-6 space-y-4 animate-pulse"
        >
          <div className="h-5 w-72 bg-sage-200 dark:bg-pine-800 rounded" />
          <div className="h-4 w-full max-w-xl bg-cream-100 dark:bg-pine-800 rounded" />
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
            <div className="h-20 bg-cream-100 dark:bg-pine-800 rounded-lg" />
            <div className="h-20 bg-cream-100 dark:bg-pine-800 rounded-lg" />
            <div className="h-20 bg-cream-100 dark:bg-pine-800 rounded-lg" />
            <div className="h-20 bg-cream-100 dark:bg-pine-800 rounded-lg" />
          </div>
        </div>
      )}
    </div>
  );
}
