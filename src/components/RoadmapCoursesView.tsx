import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  Compass,
  ExternalLink,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import {
  fetchCourses,
  fetchRoleComparison,
  toggleActionStep,
  toggleCourseProgress,
} from "../lib/api";
import {
  CAREER_ROLE_LABELS,
  SKILL_LABELS,
  type ActionPlan,
  type AppTab,
  type CareerRole,
  type CourseItem,
  type RoleComparisonItem,
  type SkillKey,
  type StudentProfile,
} from "../types/studentpulse";

interface RoadmapCoursesViewProps {
  activeProfile: StudentProfile;
  plan: ActionPlan | null;
  generating: boolean;
  onPlanUpdated: (updated: ActionPlan) => void;
  onQuickGeneratePlan: () => Promise<void>;
  onNavigate: (tab: AppTab) => void;
  onXpUpdated: () => void;
}

const ROLE_KEYS = Object.keys(CAREER_ROLE_LABELS) as CareerRole[];

export function RoadmapCoursesView({
  activeProfile,
  plan,
  generating,
  onPlanUpdated,
  onQuickGeneratePlan,
  onNavigate,
  onXpUpdated,
}: RoadmapCoursesViewProps) {
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [roleComparison, setRoleComparison] = useState<RoleComparisonItem[]>([]);
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "completed">("all");
  const [loading, setLoading] = useState(true);
  const [busyCourseId, setBusyCourseId] = useState<number | null>(null);
  const [togglingStepIdx, setTogglingStepIdx] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetchCourses(activeProfile.user_id).catch(() => []),
      fetchRoleComparison(activeProfile.user_id).catch(() => ({
        comparison: [],
        has_snapshot: false,
      })),
    ])
      .then(([crs, cmp]) => {
        if (cancelled) return;
        setCourses(crs);
        setRoleComparison(cmp.comparison || []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeProfile.user_id]);

  async function handleToggleCourse(courseId: number) {
    setBusyCourseId(courseId);
    setError(null);
    try {
      const res = await toggleCourseProgress(courseId, activeProfile.user_id);
      setCourses((prev) =>
        prev.map((c) => (c.course_id === courseId ? { ...c, completed: res.completed } : c))
      );
      onXpUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update course progress.");
    } finally {
      setBusyCourseId(null);
    }
  }

  async function handleToggleRoadmapStep(idx: number) {
    if (!plan) return;
    setTogglingStepIdx(idx);
    setError(null);
    try {
      const updated = await toggleActionStep(plan.plan_id, idx);
      onPlanUpdated(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update roadmap topic.");
    } finally {
      setTogglingStepIdx(null);
    }
  }

  const filteredCourses = useMemo(() => {
    return courses.filter((c) => {
      if (roleFilter !== "all" && c.target_role !== roleFilter) return false;
      if (statusFilter === "completed" && !c.completed) return false;
      if (statusFilter === "pending" && c.completed) return false;
      return true;
    });
  }, [courses, roleFilter, statusFilter]);

  const completedCourses = courses.filter((c) => c.completed).length;
  const coursePct = courses.length > 0 ? Math.round((completedCourses / courses.length) * 100) : 0;

  const steps = plan?.action_steps || [];
  const completedSteps = steps.filter((s) => s.completed).length;
  const roadmapPct = steps.length > 0 ? Math.round((completedSteps / steps.length) * 100) : 0;

  const roleMeta = CAREER_ROLE_LABELS[activeProfile.target_role];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <section className="bg-gradient-to-r from-pine-800 via-pine-700 to-pine-600 rounded-2xl p-6 text-white flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1.5 max-w-2xl">
          <div className="text-xs font-semibold uppercase tracking-wider text-cream-100">
            Personalized AI Learning Roadmap & Curated Courses
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            {roleMeta?.label || activeProfile.target_role}
          </h1>
          <p className="text-sm text-cream-100 leading-relaxed">{roleMeta?.summary}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => onNavigate("evidence")}
            className="px-4 py-2.5 bg-white/15 hover:bg-white/25 border border-white/25 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Readiness Calculator
          </button>
          <button
            type="button"
            onClick={() => onNavigate("profile")}
            className="px-4 py-2.5 bg-white text-pine-800 hover:bg-cream-100 text-xs font-semibold rounded-lg"
          >
            Change Target Role
          </button>
        </div>
      </section>

      {error && (
        <div
          role="alert"
          className="p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-300 font-medium"
        >
          {error}
        </div>
      )}

      {/* Weekly AI Action Roadmap */}
      <section className="bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Compass className="w-5 h-5 text-pine-700 dark:text-[#6ec4b0]" />
            <div>
              <h2 className="text-base font-bold text-[#14211d] dark:text-cream-50">
                Weekly Personalized Learning Roadmap
              </h2>
              <p className="text-xs text-[#56665f] dark:text-[#869b92]">
                Action modules tailored from your assessment scores, skill gaps, and project depth.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {plan && (
              <button
                type="button"
                onClick={() => onNavigate("plan")}
                className="px-3.5 py-2 bg-pine-700 hover:bg-pine-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5"
              >
                Open Full Plan & Sprint Timer
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              disabled={generating}
              onClick={onQuickGeneratePlan}
              className="px-3.5 py-2 bg-pine-600 hover:bg-pine-700 disabled:opacity-60 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {generating ? "Generating..." : plan ? "Regenerate Plan" : "Generate AI Roadmap"}
            </button>
          </div>
        </div>

        {!plan ? (
          <div className="p-6 rounded-xl bg-sage-50 dark:bg-pine-950 border border-sage-200 dark:border-pine-800 text-center space-y-3">
            <p className="text-sm font-semibold text-[#14211d] dark:text-cream-50">
              No weekly roadmap generated yet for {activeProfile.display_name}
            </p>
            <p className="text-xs text-[#56665f] dark:text-[#869b92] max-w-lg mx-auto">
              Click <strong>Generate AI Roadmap</strong> for an instant personalized path, or use
              the Readiness Calculator to enter custom assessment and project scores.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="font-semibold text-[#1f2f29] dark:text-[#dbe6e0]">
                {plan.title} ·{" "}
                <span className="font-mono tabular-nums text-pine-700 dark:text-[#6ec4b0]">
                  {plan.total_hours} hrs/week
                </span>
              </div>
              <div className="font-mono tabular-nums text-[#45554e] dark:text-[#c5d4cd]">
                {completedSteps}/{steps.length} topics completed ({roadmapPct}%)
              </div>
            </div>
            <div className="h-2 bg-cream-100 dark:bg-pine-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-pine-800 to-pine-600 rounded-full transition-all"
                style={{ width: `${roadmapPct}%` }}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {steps.map((step, idx) => (
                <button
                  key={`${step.title}-${idx}`}
                  type="button"
                  disabled={togglingStepIdx === idx}
                  onClick={() => handleToggleRoadmapStep(idx)}
                  className={`p-4 rounded-xl border text-left transition-colors flex items-start gap-3 ${
                    step.completed
                      ? "bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900"
                      : "bg-sage-50/70 dark:bg-pine-950 border-sage-200 dark:border-pine-800 hover:border-pine-500"
                  }`}
                >
                  <CheckCircle2
                    className={`w-4 h-4 mt-0.5 shrink-0 ${
                      step.completed
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-[#c5d4cd] dark:text-[#45554e]"
                    }`}
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-2 text-[11px] text-[#56665f] dark:text-[#869b92]">
                      <span>
                        {step.category} · {step.focus_skill}
                      </span>
                      <span className="font-mono tabular-nums font-semibold">{step.hours}h</span>
                    </div>
                    <div
                      className={`text-sm font-semibold ${
                        step.completed
                          ? "line-through text-[#869b92]"
                          : "text-[#14211d] dark:text-cream-50"
                      }`}
                    >
                      {step.title}
                    </div>
                    <div className="text-xs text-[#45554e] dark:text-[#c5d4cd]">
                      Deliverable: {step.deliverable}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Cross-Role Career Fit Comparison */}
      {roleComparison.length > 0 && (
        <section className="bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl p-6 space-y-4">
          <div>
            <h2 className="text-base font-bold text-[#14211d] dark:text-cream-50">
              Cross-Role Career Fit Comparison
            </h2>
            <p className="text-xs text-[#56665f] dark:text-[#869b92]">
              See how your current skills align across all 7 industry tracks.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {roleComparison.slice(0, 4).map((rc) => {
              const isCurrent = rc.role_key === activeProfile.target_role;
              return (
                <div
                  key={rc.role_key}
                  className={`p-4 rounded-xl border ${
                    isCurrent
                      ? "border-pine-600 bg-cream-100/70 dark:bg-pine-950/30"
                      : "border-sage-200 dark:border-pine-800 bg-sage-50/60 dark:bg-pine-950"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[#14211d] dark:text-cream-50 truncate">
                      {rc.role_label}
                    </span>
                    <span className="text-sm font-mono font-bold tabular-nums text-pine-700 dark:text-[#6ec4b0]">
                      {rc.overall_score}%
                    </span>
                  </div>
                  <div className="text-[11px] text-[#56665f] dark:text-[#869b92] mt-1">
                    {rc.matched_count}/{rc.benchmark_total} benchmark skills · {rc.readiness_band}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Courses & Curated Resources Tracker */}
      <section className="bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-5 h-5 text-ochre-600 dark:text-ochre-400" />
            <div>
              <h2 className="text-base font-bold text-[#14211d] dark:text-cream-50">
                Curated Courses & Learning Resources ({completedCourses}/{courses.length} completed ·{" "}
                {coursePct}%)
              </h2>
              <p className="text-xs text-[#56665f] dark:text-[#869b92]">
                Complete a recommended course to earn +40 XP and boost your learning progress.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              aria-label="Filter courses by target role"
              className="px-3 py-1.5 text-xs rounded-lg border border-sage-300 dark:border-pine-700 bg-white dark:bg-pine-950"
            >
              <option value="all">All Career Tracks</option>
              {ROLE_KEYS.map((rk) => (
                <option key={rk} value={rk}>
                  {CAREER_ROLE_LABELS[rk].label}
                </option>
              ))}
            </select>

            <div className="inline-flex p-1 bg-cream-100 dark:bg-pine-800 rounded-lg gap-1">
              {(["all", "pending", "completed"] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md capitalize ${
                    statusFilter === st
                      ? "bg-cream-50 dark:bg-pine-900 text-pine-700 dark:text-[#6ec4b0] shadow-xs"
                      : "text-[#45554e] dark:text-[#869b92]"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
            <div className="h-36 bg-cream-100 dark:bg-pine-800 rounded-xl" />
            <div className="h-36 bg-cream-100 dark:bg-pine-800 rounded-xl" />
            <div className="h-36 bg-cream-100 dark:bg-pine-800 rounded-xl" />
          </div>
        ) : filteredCourses.length === 0 ? (
          <div className="p-6 text-center text-xs text-[#56665f] dark:text-[#869b92] bg-sage-50 dark:bg-pine-950 rounded-xl">
            No courses match this filter.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCourses.map((course) => (
              <div
                key={course.course_id}
                className={`p-4 rounded-xl border flex flex-col justify-between gap-3 transition-colors ${
                  course.completed
                    ? "border-emerald-200 dark:border-emerald-900 bg-emerald-50/40 dark:bg-emerald-950/15"
                    : "border-sage-200 dark:border-pine-800 bg-sage-50/50 dark:bg-pine-950"
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-[11px] text-[#56665f] dark:text-[#869b92]">
                    <span className="font-semibold text-pine-700 dark:text-[#6ec4b0]">
                      {course.provider}
                    </span>
                    <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                      <Clock className="w-3 h-3" />
                      {course.duration_hours} hrs
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-[#14211d] dark:text-cream-50 leading-snug">
                    {course.title}
                  </h3>
                  <div className="text-[11px] text-[#56665f] dark:text-[#869b92]">
                    {CAREER_ROLE_LABELS[course.target_role]?.label || course.target_role}
                  </div>
                  <div className="text-[11px] text-[#45554e] dark:text-[#c5d4cd]">
                    Skills: {course.skill_keys.map((k) => SKILL_LABELS[k] || k).join(" · ")}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-sage-200 dark:border-pine-800">
                  <a
                    href={course.resource_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-pine-700 dark:text-[#6ec4b0] hover:underline inline-flex items-center gap-1"
                  >
                    Open Resource
                    <ExternalLink className="w-3 h-3" />
                  </a>

                  <button
                    type="button"
                    disabled={busyCourseId === course.course_id}
                    onClick={() => handleToggleCourse(course.course_id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                      course.completed
                        ? "bg-emerald-600 text-white hover:bg-emerald-700"
                        : "bg-cream-50 dark:bg-pine-900 border border-sage-300 dark:border-pine-700 text-[#1f2f29] dark:text-[#dbe6e0] hover:border-pine-600"
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {course.completed ? "Completed" : "Mark Done (+40 XP)"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
