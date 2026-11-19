import { useEffect, useState } from "react";
import {
  ArrowRight,
  Award,
  CheckCircle2,
  ClipboardCheck,
  Compass,
  FolderGit2,
  MessageSquareCode,
  Sparkles,
  Target,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  fetchAssessmentResults,
  fetchCourses,
  fetchNotifications,
  fetchProjects,
  fetchReadinessTrend,
  fetchSkillProfile,
  fetchTasks,
  toggleTask,
} from "../lib/api";
import {
  CAREER_ROLE_LABELS,
  type ActionPlan,
  type AppTab,
  type AssessmentResult,
  type CourseItem,
  type DailyTask,
  type EvidenceSnapshot,
  type FacultyFeedbackItem,
  type ReadinessTrendPoint,
  type StudentProfile,
  type StudentProject,
  type StudentSkillProfile,
} from "../types/studentpulse";

interface DashboardViewProps {
  activeProfile: StudentProfile;
  plan: ActionPlan | null;
  latestSnapshot: EvidenceSnapshot | null;
  onNavigate: (tab: AppTab) => void;
}

export function DashboardView({
  activeProfile,
  plan,
  latestSnapshot,
  onNavigate,
}: DashboardViewProps) {
  const [skillProfile, setSkillProfile] = useState<StudentSkillProfile | null>(null);
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [assessments, setAssessments] = useState<AssessmentResult[]>([]);
  const [projects, setProjects] = useState<StudentProject[]>([]);
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [trend, setTrend] = useState<ReadinessTrendPoint[]>([]);
  const [facultyFeedback, setFacultyFeedback] = useState<FacultyFeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetchSkillProfile(activeProfile.user_id).catch(() => null),
      fetchTasks(activeProfile.user_id).catch(() => []),
      fetchAssessmentResults(activeProfile.user_id).catch(() => []),
      fetchProjects(activeProfile.user_id).catch(() => []),
      fetchCourses(activeProfile.user_id).catch(() => []),
      fetchReadinessTrend(activeProfile.user_id).catch(() => []),
      fetchNotifications(activeProfile.user_id).catch(() => ({
        notifications: [],
        faculty_feedback: [],
      })),
    ])
      .then(([sp, tks, res, projs, crs, trd, notifs]) => {
        if (cancelled) return;
        setSkillProfile(sp);
        setTasks(tks);
        setAssessments(res);
        setProjects(projs);
        setCourses(crs);
        setTrend(trd);
        setFacultyFeedback(notifs.faculty_feedback || []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeProfile.user_id]);

  async function handleToggleTask(taskId: number) {
    try {
      const updated = await toggleTask(taskId);
      setTasks((prev) => prev.map((t) => (t.task_id === taskId ? updated : t)));
    } catch {
      // Ignore transient error
    }
  }

  const readinessScore =
    plan?.metrics?.overall_score ?? latestSnapshot?.computed_readiness ?? 62;
  const readinessBand =
    plan?.metrics?.readiness_band ??
    (readinessScore >= 80
      ? "Placement Ready"
      : readinessScore >= 68
      ? "Developing Strong"
      : "Building Momentum");

  const avgSkillScore =
    skillProfile && skillProfile.comparison.length > 0
      ? Math.round(
          skillProfile.comparison.reduce((acc, c) => acc + c.current, 0) /
            skillProfile.comparison.length
        )
      : latestSnapshot?.coding_score ?? 65;

  const commScore = activeProfile.communication_score ?? 72;
  const completedProjects = projects.filter((p) => p.status !== "in_progress").length;
  const projectCompletionPct =
    projects.length > 0
      ? Math.min(100, Math.round((completedProjects / Math.max(2, projects.length)) * 100))
      : 0;
  const completedCourses = courses.filter((c) => c.completed).length;
  const learningProgressPct =
    courses.length > 0 ? Math.round((completedCourses / courses.length) * 100) : 0;

  const pendingTasks = tasks.filter((t) => !t.completed);
  const roleLabel =
    CAREER_ROLE_LABELS[activeProfile.target_role]?.label || activeProfile.target_role;

  const trendChartData =
    trend.length > 0
      ? trend.map((pt, idx) => ({
          checkpoint: `#${idx + 1}`,
          Readiness: pt.computed_readiness,
          Assessment: pt.assessment_score,
          Coding: pt.coding_score,
        }))
      : [
          {
            checkpoint: "Baseline",
            Readiness: readinessScore,
            Assessment: Math.round(activeProfile.cgpa * 10),
            Coding: avgSkillScore,
          },
        ];

  const skillChartData = (skillProfile?.comparison || []).slice(0, 6).map((c) => ({
    skill: c.label.split("&")[0].split("(")[0].trim().slice(0, 14),
    Current: c.current,
    Target: c.target,
  }));

  return (
    <div className="space-y-6">
      {/* Signature Gamma-Slide Editorial Split Hero: Warm Peach Left + Peach-to-Botanical-Sage Right */}
      <section className="rounded-2xl overflow-hidden border border-[#dfd0b4] dark:border-pine-800 shadow-[0_6px_28px_-14px_rgba(15,76,69,0.22)] grid grid-cols-1 lg:grid-cols-12">
        {/* Left Warm Peach Panel (#f3ead3 exact match) */}
        <div className="lg:col-span-7 bg-[#f3ead3] dark:bg-pine-900 p-6 sm:p-9 flex flex-col justify-between gap-6">
          <div className="space-y-3">
            <div className="text-xs font-semibold text-pine-700 dark:text-[#f0b78e]">
              KIET University · {activeProfile.branch || "CSE"} · Semester {activeProfile.semester}
            </div>
            <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-pine-700 dark:text-cream-50 leading-tight">
              Welcome back, {activeProfile.display_name}
            </h1>
            <p className="text-sm text-[#2d443f] dark:text-[#b7c7c0] leading-relaxed max-w-xl">
              Target Career: <strong className="text-[#0f2622] dark:text-cream-50">{roleLabel}</strong>{" "}
              · <span className="tabular-nums font-semibold">{pendingTasks.length}</span> pending
              daily target(s) · Study streak{" "}
              <strong className="tabular-nums text-ochre-600 dark:text-[#f0b78e]">
                {activeProfile.streak_days ?? 1} days
              </strong>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate("roadmap")}
              className="px-4 py-2.5 rounded-xl bg-pine-700 hover:bg-pine-800 dark:bg-pine-600 dark:hover:bg-pine-500 text-[#faf2e3] text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shadow-xs"
            >
              Continue Learning Roadmap
              <ArrowRight className="w-3.5 h-3.5 text-[#f0b78e]" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate("evidence")}
              className="px-4 py-2.5 rounded-xl bg-[#faf2e3] dark:bg-pine-950 border border-[#d9c7a6] dark:border-pine-700 hover:border-pine-700 text-pine-700 dark:text-cream-50 text-xs font-semibold transition-colors whitespace-nowrap"
            >
              Recalculate Readiness
            </button>
          </div>
        </div>

        {/* Right Peach-to-Botanical-Sage Gradient Panel (#faedda -> #b5cabd -> #69897e exact match) */}
        <div className="lg:col-span-5 bg-gradient-to-b from-[#faedda] via-[#b5cabd] to-[#69897e] dark:from-[#12332e] dark:via-[#0d2420] dark:to-[#081714] p-6 sm:p-7 relative overflow-hidden flex items-center justify-between gap-4 border-t lg:border-t-0 lg:border-l border-[#dfd0b4] dark:border-pine-800">
          {/* Connected Node Graphic matching the slide aesthetic */}
          <svg
            aria-hidden="true"
            viewBox="0 0 260 180"
            className="absolute right-0 bottom-0 w-64 h-44 opacity-45 dark:opacity-25 pointer-events-none"
          >
            <path
              d="M25 45 C75 45, 85 95, 130 95 S185 45, 230 45 M40 135 C90 135, 100 95, 130 95 S175 135, 225 135"
              fill="none"
              stroke="#0f4c45"
              strokeWidth="2.4"
            />
            <rect x="14" y="24" width="38" height="44" rx="8" fill="#0f4c45" />
            <rect x="206" y="22" width="42" height="48" rx="8" fill="#16514d" />
            <rect x="22" y="112" width="44" height="44" rx="8" fill="#16514d" />
            <rect x="196" y="114" width="46" height="42" rx="8" fill="#0f4c45" />
            <circle cx="130" cy="95" r="14" fill="#d98254" />
            <circle cx="164" cy="44" r="9" fill="#f0b78e" />
          </svg>

          <div className="relative z-10 bg-[#0f4c45]/95 dark:bg-pine-900/95 border border-[#2a6b62] dark:border-pine-700 rounded-2xl p-5 w-full max-w-[260px] text-[#faf2e3] shadow-md">
            <div className="text-xs font-medium text-[#d7e5da]">
              Overall Career Readiness
            </div>
            <div className="flex items-baseline gap-2 mt-1.5">
              <span className="text-4xl sm:text-5xl font-bold font-mono tabular-nums text-[#faedda]">
                {readinessScore}
              </span>
              <span className="text-sm text-[#b5cabd] font-mono">/100</span>
            </div>
            <div className="mt-2 pt-2 border-t border-[#236159] flex items-center justify-between text-xs">
              <span className="font-semibold text-[#faf2e3]">{readinessBand}</span>
              <span className="font-mono tabular-nums text-[#f0b78e] font-semibold">
                {activeProfile.xp_points ?? 0} XP
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 5 Core Metric Cards */}
      <section className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-[#faf2e3] dark:bg-pine-900 border border-[#dfd0b4] dark:border-pine-800 rounded-2xl p-4 shadow-[0_2px_10px_-6px_rgba(15,76,69,0.16)]">
          <div className="text-xs text-[#556962] dark:text-[#9eb4ab]">Academic CGPA</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-pine-700 dark:text-cream-50 mt-1">
            {activeProfile.cgpa.toFixed(2)}
          </div>
          <div className="text-[11px] text-[#5c6d66] dark:text-[#9eb4ab] mt-1">
            Scale 10.0 · Sem {activeProfile.semester}
          </div>
        </div>

        <div className="bg-[#faf2e3] dark:bg-pine-900 border border-[#dfd0b4] dark:border-pine-800 rounded-2xl p-4 shadow-[0_2px_10px_-6px_rgba(15,76,69,0.16)]">
          <div className="text-xs text-[#556962] dark:text-[#9eb4ab]">Technical Skill Score</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-pine-600 dark:text-[#7acdb8] mt-1">
            {avgSkillScore}%
          </div>
          <div className="text-[11px] text-[#5c6d66] dark:text-[#9eb4ab] mt-1">
            {skillProfile?.verified_count ?? 0} verified skills
          </div>
        </div>

        <div className="bg-[#faf2e3] dark:bg-pine-900 border border-[#dfd0b4] dark:border-pine-800 rounded-2xl p-4 shadow-[0_2px_10px_-6px_rgba(15,76,69,0.16)]">
          <div className="text-xs text-[#556962] dark:text-[#9eb4ab]">Communication</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-ochre-600 dark:text-[#f0b78e] mt-1">
            {commScore}%
          </div>
          <div className="text-[11px] text-[#5c6d66] dark:text-[#9eb4ab] mt-1">
            Interviews &amp; soft skills
          </div>
        </div>

        <div className="bg-[#faf2e3] dark:bg-pine-900 border border-[#dfd0b4] dark:border-pine-800 rounded-2xl p-4 shadow-[0_2px_10px_-6px_rgba(15,76,69,0.16)]">
          <div className="text-xs text-[#556962] dark:text-[#9eb4ab]">Project Completion</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-pine-700 dark:text-cream-50 mt-1">
            {projectCompletionPct}%
          </div>
          <div className="text-[11px] text-[#5c6d66] dark:text-[#9eb4ab] mt-1">
            {projects.length} portfolio project(s)
          </div>
        </div>

        <div className="col-span-2 lg:col-span-1 bg-[#faf2e3] dark:bg-pine-900 border border-[#dfd0b4] dark:border-pine-800 rounded-2xl p-4 shadow-[0_2px_10px_-6px_rgba(15,76,69,0.16)]">
          <div className="text-xs text-[#556962] dark:text-[#9eb4ab]">Learning Progress</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-pine-600 dark:text-[#86d2c1] mt-1">
            {learningProgressPct}%
          </div>
          <div className="text-[11px] text-[#5c6d66] dark:text-[#9eb4ab] mt-1">
            {completedCourses}/{courses.length} courses · {activeProfile.xp_points ?? 0} XP
          </div>
        </div>
      </section>

      {/* Interactive Recharts Analytics Row */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 bg-[#faf2e3] dark:bg-pine-900 border border-[#dfd0b4] dark:border-pine-800 rounded-2xl p-5 space-y-3 shadow-[0_2px_12px_-6px_rgba(15,76,69,0.14)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-pine-700 dark:text-cream-50">
                Readiness &amp; Assessment Trajectory
              </h2>
              <p className="text-xs text-[#5c6d66] dark:text-[#9eb4ab]">
                Tracked across stored SQLite evidence checkpoints
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate("evidence")}
              className="text-xs font-semibold text-pine-700 dark:text-[#f0b78e] hover:underline whitespace-nowrap"
            >
              Update Score
            </button>
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#93af9e" opacity={0.45} />
                <XAxis dataKey="checkpoint" tick={{ fontSize: 11, fill: "#4b6058" }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#4b6058" }} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="Readiness"
                  stroke="#0f4c45"
                  fill="#0f4c45"
                  fillOpacity={0.2}
                  strokeWidth={2.3}
                />
                <Area
                  type="monotone"
                  dataKey="Coding"
                  stroke="#d98254"
                  fill="#d98254"
                  fillOpacity={0.14}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-6 bg-[#faf2e3] dark:bg-pine-900 border border-[#dfd0b4] dark:border-pine-800 rounded-2xl p-5 space-y-3 shadow-[0_2px_12px_-6px_rgba(15,76,69,0.14)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-pine-700 dark:text-cream-50">
                Role Benchmark Skill Comparison
              </h2>
              <p className="text-xs text-[#5c6d66] dark:text-[#9eb4ab]">
                Current proficiency vs 75% industry target ({roleLabel})
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate("skill_gap")}
              className="text-xs font-semibold text-pine-700 dark:text-[#f0b78e] hover:underline whitespace-nowrap"
            >
              Open Analyzer
            </button>
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={skillChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#93af9e" opacity={0.45} />
                <XAxis dataKey="skill" tick={{ fontSize: 10, fill: "#4b6058" }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#4b6058" }} />
                <Tooltip />
                <Bar dataKey="Current" fill="#0f4c45" radius={[5, 5, 0, 0]} />
                <Bar dataKey="Target" fill="#d98254" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Bottom 3 Columns: Pending Daily Targets, Recent Assessments & AI Recommendations */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Pending Daily Tasks */}
        <div className="lg:col-span-4 bg-[#faf2e3] dark:bg-pine-900 border border-[#dfd0b4] dark:border-pine-800 rounded-2xl p-5 space-y-4 shadow-[0_2px_12px_-6px_rgba(15,76,69,0.14)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-pine-700 dark:text-[#f0b78e]" />
              <h2 className="text-sm font-bold text-pine-700 dark:text-cream-50">
                Today&apos;s Daily Targets ({pendingTasks.length})
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate("tasks_notes")}
              className="text-xs font-semibold text-pine-700 dark:text-[#f0b78e] hover:underline"
            >
              Manage
            </button>
          </div>

          {loading ? (
            <div className="space-y-2 animate-pulse">
              <div className="h-10 bg-[#f3ead3] dark:bg-pine-800 rounded-xl" />
              <div className="h-10 bg-[#f3ead3] dark:bg-pine-800 rounded-xl" />
            </div>
          ) : tasks.length === 0 ? (
            <div className="p-4 rounded-xl bg-[#f3ead3] dark:bg-pine-950 text-xs text-[#5c6d66] dark:text-[#9eb4ab]">
              No daily targets added yet. Set today&apos;s study goal in Daily Targets &amp; Notes.
            </div>
          ) : (
            <div className="space-y-2">
              {tasks.slice(0, 4).map((t) => (
                <button
                  key={t.task_id}
                  type="button"
                  onClick={() => handleToggleTask(t.task_id)}
                  className="w-full p-2.5 rounded-xl border border-[#e4d4b7] dark:border-pine-800 hover:border-pine-700 flex items-start gap-2.5 text-left transition-colors bg-[#fffaf0]/80 dark:bg-pine-950/50"
                >
                  <CheckCircle2
                    className={`w-4 h-4 mt-0.5 shrink-0 ${
                      t.completed ? "text-pine-600 dark:text-[#7acdb8]" : "text-[#b5cabd] dark:text-pine-700"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div
                      className={`text-xs font-semibold truncate ${
                        t.completed
                          ? "line-through text-[#7a8a82]"
                          : "text-[#0f2622] dark:text-cream-50"
                      }`}
                    >
                      {t.title}
                    </div>
                    <div className="text-[11px] text-[#5c6d66] dark:text-[#9eb4ab] tabular-nums">
                      {t.category} · +{t.xp_reward} XP
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Recent Assessments */}
        <div className="lg:col-span-4 bg-[#faf2e3] dark:bg-pine-900 border border-[#dfd0b4] dark:border-pine-800 rounded-2xl p-5 space-y-4 shadow-[0_2px_12px_-6px_rgba(15,76,69,0.14)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-pine-700 dark:text-[#f0b78e]" />
              <h2 className="text-sm font-bold text-pine-700 dark:text-cream-50">
                Recent Assessments
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate("assessments")}
              className="text-xs font-semibold text-pine-700 dark:text-[#f0b78e] hover:underline"
            >
              Take Test
            </button>
          </div>

          {assessments.length === 0 ? (
            <div className="p-4 rounded-xl bg-[#f3ead3] dark:bg-pine-950 text-xs text-[#5c6d66] dark:text-[#9eb4ab]">
              Attempt a timed Technical, Aptitude, or Communication quiz to verify skills on your
              Skill Passport.
            </div>
          ) : (
            <div className="space-y-2.5">
              {assessments.slice(0, 3).map((res) => (
                <div
                  key={res.result_id}
                  className="p-3 rounded-xl border border-[#e4d4b7] dark:border-pine-800 bg-[#fffaf0]/80 dark:bg-pine-950/50 space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[#0f2622] dark:text-cream-50 truncate">
                      {res.assessment_title}
                    </span>
                    <span className="text-xs font-mono font-bold tabular-nums text-pine-700 dark:text-[#f0b78e]">
                      {res.score_pct}%
                    </span>
                  </div>
                  <div className="text-[11px] text-[#5c6d66] dark:text-[#9eb4ab]">
                    {res.weak_topics.length > 0
                      ? `Weak topics: ${res.weak_topics.join(", ")}`
                      : "All topics mastered"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* AI Recommendations & Quick Launch */}
        <div className="lg:col-span-4 bg-[#faf2e3] dark:bg-pine-900 border border-[#dfd0b4] dark:border-pine-800 rounded-2xl p-5 space-y-4 shadow-[0_2px_12px_-6px_rgba(15,76,69,0.14)]">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-ochre-500" />
            <h2 className="text-sm font-bold text-pine-700 dark:text-cream-50">
              Next Recommended Actions
            </h2>
          </div>

          <div className="space-y-2.5 text-xs">
            {skillProfile && skillProfile.missing_skills.length > 0 && (
              <div className="p-3 rounded-xl bg-[#f3ead3] dark:bg-pine-800/70 border border-[#e4d4b7] dark:border-pine-700">
                <div className="font-semibold text-pine-700 dark:text-cream-50">
                  Close {skillProfile.missing_skills.length} Missing Benchmark Skill(s)
                </div>
                <p className="text-[#405752] dark:text-[#b7c7c0] mt-0.5">
                  Focus on {skillProfile.missing_skills.slice(0, 3).map((s) => s.label).join(", ")}.
                </p>
              </div>
            )}

            {facultyFeedback.length > 0 && (
              <div className="p-3 rounded-xl bg-[#dfece4] dark:bg-pine-950 border border-[#b5cabd] dark:border-pine-800">
                <div className="font-semibold text-pine-700 dark:text-[#f0b78e]">
                  Faculty Note ({facultyFeedback[0].faculty_name || "Mentor"})
                </div>
                <p className="text-[#2f4540] dark:text-[#b7c7c0] mt-0.5 line-clamp-2">
                  {facultyFeedback[0].comment}
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => onNavigate("mentor")}
                className="p-2.5 rounded-xl border border-[#dfd0b4] dark:border-pine-700 hover:border-pine-700 flex items-center justify-between text-xs font-semibold bg-[#fffaf0]/80 dark:bg-pine-950/50 transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <MessageSquareCode className="w-3.5 h-3.5 text-pine-700 dark:text-[#7acdb8]" />
                  AI Mentor
                </span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onNavigate("jobs")}
                className="p-2.5 rounded-xl border border-[#dfd0b4] dark:border-pine-700 hover:border-pine-700 flex items-center justify-between text-xs font-semibold bg-[#fffaf0]/80 dark:bg-pine-950/50 transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-pine-700 dark:text-[#7acdb8]" />
                  Jobs Feed
                </span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onNavigate("portfolio")}
                className="p-2.5 rounded-xl border border-[#dfd0b4] dark:border-pine-700 hover:border-pine-700 flex items-center justify-between text-xs font-semibold bg-[#fffaf0]/80 dark:bg-pine-950/50 transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <FolderGit2 className="w-3.5 h-3.5 text-pine-700 dark:text-[#7acdb8]" />
                  Passport
                </span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onNavigate("gamification")}
                className="p-2.5 rounded-xl border border-[#dfd0b4] dark:border-pine-700 hover:border-pine-700 flex items-center justify-between text-xs font-semibold bg-[#fffaf0]/80 dark:bg-pine-950/50 transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-ochre-500" />
                  Badges
                </span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
