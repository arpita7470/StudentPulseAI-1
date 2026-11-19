import { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  Download,
  MessageSquare,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Target,
  X,
} from "lucide-react";
import {
  CAREER_ROLE_LABELS,
  SKILL_LABELS,
  type ActionPlan,
  type ActionStatus,
  type ActionStep,
  type InterviewEvaluation,
  type SkillKey,
  type StudentProfile,
} from "../types/studentpulse";
import {
  evaluateInterviewAnswer,
  fetchAlternativeTasks,
  modifyActionPlan,
  recordCompletion,
  toggleActionStep,
} from "../lib/api";
import { ReadinessRadar } from "./ReadinessRadar";

interface ReadinessPlanViewProps {
  activeProfile: StudentProfile;
  plan: ActionPlan;
  aiNotice: string | null;
  onPlanUpdated: (updated: ActionPlan) => void;
  onCompletionSaved: () => void;
  onBackToEvidence: () => void;
}

export function ReadinessPlanView({
  activeProfile,
  plan,
  aiNotice,
  onPlanUpdated,
  onCompletionSaved,
  onBackToEvidence,
}: ReadinessPlanViewProps) {
  const [modifying, setModifying] = useState(false);
  const [swapIndex, setSwapIndex] = useState<number | null>(null);
  const [alternatives, setAlternatives] = useState<ActionStep[]>([]);
  const [loadingAlts, setLoadingAlts] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Interactive Mock Interview State
  const [activeQuestionIdx, setActiveQuestionIdx] = useState(0);
  const [mockAnswer, setMockAnswer] = useState("");
  const [evaluatingAnswer, setEvaluatingAnswer] = useState(false);
  const [evaluation, setEvaluation] = useState<InterviewEvaluation | null>(null);
  const [evalNotice, setEvalNotice] = useState<string | null>(null);

  // Study Sprint Countdown Timer (25 min default)
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [timerRunning, setTimerRunning] = useState(false);

  // Completion Logger State
  const [completionStatus, setCompletionStatus] = useState<ActionStatus>("completed");
  const [notes, setNotes] = useState("");
  const [savingCompletion, setSavingCompletion] = useState(false);

  useEffect(() => {
    setActiveQuestionIdx(0);
    setMockAnswer("");
    setEvaluation(null);
    setEvalNotice(null);
    setSwapIndex(null);
    setActionError(null);
  }, [plan.plan_id]);

  useEffect(() => {
    if (!timerRunning) return;
    const id = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setTimerRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [timerRunning]);

  const metrics = plan.metrics;
  const steps = plan.action_steps || [];
  const questions = plan.interview_questions || [];
  const activeQuestion = questions[activeQuestionIdx];
  const completedSteps = steps.filter((s) => s.completed).length;
  const completedHours = steps
    .filter((s) => s.completed)
    .reduce((acc, s) => acc + s.hours, 0);
  const progressPct =
    steps.length > 0 ? Math.round((completedSteps / steps.length) * 100) : 0;

  async function handleToggleStep(idx: number) {
    setActionError(null);
    try {
      const updated = await toggleActionStep(plan.plan_id, idx);
      onPlanUpdated(updated);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not update step progress.");
    }
  }

  async function handleOpenSwap(idx: number) {
    setActionError(null);
    if (swapIndex === idx) {
      setSwapIndex(null);
      return;
    }
    setSwapIndex(idx);
    setLoadingAlts(true);
    try {
      const alts = await fetchAlternativeTasks(plan.plan_id);
      setAlternatives(alts);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not load alternative tasks.");
    } finally {
      setLoadingAlts(false);
    }
  }

  async function handleConfirmSwap(idx: number, replacement: ActionStep) {
    setModifying(true);
    setActionError(null);
    try {
      const updated = await modifyActionPlan(plan.plan_id, {
        action: "swap_task",
        swap_index: idx,
        replacement,
      });
      onPlanUpdated(updated);
      setSwapIndex(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to swap action step.");
    } finally {
      setModifying(false);
    }
  }

  async function handleQuickModify(action: "compress_hours" | "focus_interview") {
    setModifying(true);
    setActionError(null);
    setSwapIndex(null);
    try {
      const updated = await modifyActionPlan(plan.plan_id, { action });
      onPlanUpdated(updated);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to adjust action plan.");
    } finally {
      setModifying(false);
    }
  }

  async function handleEvaluateMockAnswer() {
    if (!activeQuestion) return;
    setActionError(null);
    setEvalNotice(null);
    setEvaluatingAnswer(true);
    try {
      const res = await evaluateInterviewAnswer({
        question: activeQuestion.question,
        answer: mockAnswer,
        hint: activeQuestion.hint,
      });
      setEvaluation(res.evaluation);
      setEvalNotice(res.ai_notice);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not evaluate answer.");
    } finally {
      setEvaluatingAnswer(false);
    }
  }

  async function handleLogCompletion() {
    setSavingCompletion(true);
    setActionError(null);
    try {
      await recordCompletion({
        user_id: activeProfile.user_id,
        plan_id: plan.plan_id,
        status: completionStatus,
        notes,
      });
      onCompletionSaved();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not save progress.");
    } finally {
      setSavingCompletion(false);
    }
  }

  function handleExportMarkdown() {
    const roleLabel =
      CAREER_ROLE_LABELS[activeProfile.target_role]?.label || activeProfile.target_role;
    const lines = [
      `# StudentPulse AI — Readiness & Action Report`,
      `**Student:** ${activeProfile.display_name} (Semester ${activeProfile.semester} · CGPA ${activeProfile.cgpa.toFixed(1)})`,
      `**Target Role:** ${roleLabel}`,
      `**Overall Readiness:** ${metrics?.overall_score ?? "—"}/100 (${metrics?.readiness_band ?? ""})`,
      `**Plan:** ${plan.title} (${plan.total_hours} hrs/week)`,
      ``,
      `## 4-Pillar Breakdown`,
      `- Assessments: ${metrics?.pillars.academic ?? 0}%`,
      `- Technical Skills & Coding: ${metrics?.pillars.technical_skills ?? 0}%`,
      `- Projects: ${metrics?.pillars.projects ?? 0}%`,
      `- Interview Prep: ${metrics?.pillars.interview_prep ?? 0}%`,
      ``,
      `## Prioritized Skill Gaps`,
      ...(metrics?.skill_gaps.length
        ? metrics.skill_gaps.map((g) => `- ${SKILL_LABELS[g as SkillKey] || g}`)
        : ["- None identified"]),
      ``,
      `## Weekly Action Modules`,
      ...steps.map(
        (s, i) =>
          `${i + 1}. [${s.completed ? "x" : " "}] **${s.title}** (${s.hours} hrs · ${s.focus_skill})\n   - Deliverable: ${s.deliverable}`
      ),
      ``,
      `## Mock Interview Prompts`,
      ...questions.map(
        (q, i) => `${i + 1}. **${q.topic}:** ${q.question}\n   - Rubric hint: ${q.hint}`
      ),
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `studentpulse-readiness-plan-${plan.plan_id}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const formatClock = (secs: number) => {
    const mm = String(Math.floor(secs / 60)).padStart(2, "0");
    const ss = String(secs % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  };

  const sourceLabel =
    plan.source === "gemini_ai_hybrid"
      ? "Gemini AI + Readiness Validator"
      : "StudentPulse Readiness & Gap Engine";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs text-[#56665f] dark:text-[#869b92]">
            {activeProfile.display_name} · {sourceLabel} · Plan #
            <span className="font-mono tabular-nums">{plan.plan_id}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#14211d] dark:text-cream-50 mt-1 [text-wrap:balance]">
            {plan.title}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportMarkdown}
            className="px-3.5 py-2 text-xs font-semibold text-[#1f2f29] dark:text-[#dbe6e0] bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-700 hover:border-pine-600 rounded-lg flex items-center gap-1.5 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Export Report (.md)
          </button>
          <button
            type="button"
            onClick={onBackToEvidence}
            className="px-3.5 py-2 text-xs font-medium text-[#1f2f29] dark:text-[#dbe6e0] bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-700 hover:border-pine-600 rounded-lg flex items-center gap-1.5 whitespace-nowrap"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Edit Evidence
          </button>
        </div>
      </div>

      {aiNotice && (
        <div
          role="status"
          className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2.5"
        >
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>{aiNotice}</div>
        </div>
      )}

      {actionError && (
        <div
          role="alert"
          className="p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-700 dark:text-red-300 font-medium"
        >
          {actionError}
        </div>
      )}

      {/* Readiness Scoreboard + SVG Radar Chart */}
      {metrics && (
        <section className="bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-7 space-y-5">
            <div className="flex flex-wrap items-baseline justify-between gap-4 pb-4 border-b border-sage-200 dark:border-pine-800">
              <div>
                <div className="text-xs text-[#56665f] dark:text-[#869b92]">
                  Computed Overall Readiness
                </div>
                <div className="flex items-baseline gap-3 mt-1">
                  <span className="text-4xl font-bold font-mono tabular-nums text-pine-700 dark:text-[#6ec4b0]">
                    {metrics.overall_score}/100
                  </span>
                  <span className="text-sm font-semibold text-[#14211d] dark:text-cream-50">
                    {metrics.readiness_band}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-[#56665f] dark:text-[#869b92]">Benchmark Coverage</div>
                <div className="text-lg font-bold font-mono tabular-nums text-[#14211d] dark:text-cream-50 mt-0.5">
                  {metrics.matched_skills.length}/{metrics.benchmark_total} skills
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <div className="text-[11px] text-[#56665f] dark:text-[#869b92]">Assessments</div>
                <div className="text-lg font-bold font-mono tabular-nums text-[#14211d] dark:text-cream-50">
                  {metrics.pillars.academic}%
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[#56665f] dark:text-[#869b92]">Skills & Coding</div>
                <div className="text-lg font-bold font-mono tabular-nums text-[#14211d] dark:text-cream-50">
                  {metrics.pillars.technical_skills}%
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[#56665f] dark:text-[#869b92]">Projects</div>
                <div className="text-lg font-bold font-mono tabular-nums text-[#14211d] dark:text-cream-50">
                  {metrics.pillars.projects}%
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[#56665f] dark:text-[#869b92]">Interview Prep</div>
                <div className="text-lg font-bold font-mono tabular-nums text-[#14211d] dark:text-cream-50">
                  {metrics.pillars.interview_prep}%
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-2 border-t border-sage-200 dark:border-pine-800">
              <div>
                <div className="font-semibold text-[#14211d] dark:text-cream-50 mb-1">
                  Verified Role Skills
                </div>
                <p className="text-[#45554e] dark:text-[#c5d4cd] leading-relaxed">
                  {metrics.matched_skills.length > 0
                    ? metrics.matched_skills
                        .map((s) => SKILL_LABELS[s as SkillKey] || s)
                        .join(" · ")
                    : "None checked yet"}
                </p>
              </div>
              <div>
                <div className="font-semibold text-[#14211d] dark:text-cream-50 mb-1">
                  Prioritized Skill Gaps
                </div>
                <p className="text-amber-600 dark:text-amber-400 font-medium leading-relaxed">
                  {metrics.skill_gaps.length > 0
                    ? metrics.skill_gaps
                        .map((g) => SKILL_LABELS[g as SkillKey] || g)
                        .join(" · ")
                    : "All benchmark role skills covered"}
                </p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 flex justify-center border-t lg:border-t-0 lg:border-l border-sage-200 dark:border-pine-800 pt-4 lg:pt-0 lg:pl-4">
            <ReadinessRadar
              academic={metrics.pillars.academic}
              technicalSkills={metrics.pillars.technical_skills}
              projects={metrics.pillars.projects}
              interviewPrep={metrics.pillars.interview_prep}
            />
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Interactive Action Checklist + Mock Interview */}
        <div className="lg:col-span-8 space-y-6">
          <section className="bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-sage-200 dark:border-pine-800">
              <div className="flex items-center gap-6">
                <div>
                  <div className="text-xs text-[#56665f] dark:text-[#869b92]">Weekly Effort</div>
                  <div className="text-2xl font-bold font-mono tabular-nums text-[#14211d] dark:text-cream-50">
                    {plan.total_hours} hrs
                  </div>
                </div>
                <div className="h-8 w-px bg-sage-200 dark:bg-pine-700" aria-hidden="true" />
                <div>
                  <div className="text-xs text-[#56665f] dark:text-[#869b92]">Checklist Progress</div>
                  <div className="text-2xl font-bold font-mono tabular-nums text-pine-700 dark:text-[#6ec4b0]">
                    {completedSteps}/{steps.length}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={modifying || plan.total_hours <= 2}
                  onClick={() => handleQuickModify("compress_hours")}
                  className="px-3 py-2 text-xs font-semibold text-[#1f2f29] dark:text-[#dbe6e0] bg-cream-100 dark:bg-pine-800 hover:bg-cream-100 dark:hover:bg-pine-950/40 disabled:opacity-50 border border-sage-200 dark:border-pine-700 rounded-lg flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Clock className="w-3.5 h-3.5" />
                  Compress (-2 hrs)
                </button>
                <button
                  type="button"
                  disabled={modifying}
                  onClick={() => handleQuickModify("focus_interview")}
                  className="px-3 py-2 text-xs font-semibold text-[#1f2f29] dark:text-[#dbe6e0] bg-cream-100 dark:bg-pine-800 hover:bg-cream-100 dark:hover:bg-pine-950/40 disabled:opacity-50 border border-sage-200 dark:border-pine-700 rounded-lg flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Target className="w-3.5 h-3.5" />
                  Prioritize Interview
                </button>
              </div>
            </div>

            {/* Live Progress Bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-[#45554e] dark:text-[#869b92]">
                <span>Check off modules as you complete them</span>
                <span className="font-mono tabular-nums font-semibold text-[#14211d] dark:text-cream-50">
                  {completedHours}/{plan.total_hours} hrs · {progressPct}%
                </span>
              </div>
              <div className="h-2 w-full bg-cream-100 dark:bg-pine-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-pine-800 to-pine-600 rounded-full transition-all duration-200"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>

            <p className="text-sm text-[#45554e] dark:text-[#c5d4cd] leading-relaxed">
              {plan.explanation}
            </p>

            <div className="divide-y divide-sage-200/70 dark:divide-pine-800">
              {steps.map((step, idx) => {
                const isSwapping = swapIndex === idx;
                const isDone = Boolean(step.completed);
                return (
                  <div key={`${step.title}-${idx}`} className="py-4 first:pt-1 last:pb-1">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <button
                          type="button"
                          aria-label={`Mark ${step.title} as ${isDone ? "incomplete" : "complete"}`}
                          onClick={() => handleToggleStep(idx)}
                          className={`mt-1 w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                            isDone
                              ? "bg-pine-700 border-pine-700 text-white"
                              : "bg-white dark:bg-pine-950 border-sage-300 dark:border-pine-700 hover:border-pine-600"
                          }`}
                        >
                          {isDone && <Check className="w-3.5 h-3.5" />}
                        </button>

                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="text-xs text-[#56665f] dark:text-[#869b92] flex flex-wrap items-center gap-1.5">
                            <span className="font-mono tabular-nums font-semibold text-pine-700 dark:text-[#6ec4b0]">
                              {String(idx + 1).padStart(2, "0")}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>{step.category}</span>
                            <span aria-hidden="true">·</span>
                            <span>{step.focus_skill}</span>
                          </div>
                          <h3
                            className={`text-base font-semibold ${
                              isDone
                                ? "line-through text-[#869b92]"
                                : "text-[#14211d] dark:text-cream-50"
                            }`}
                          >
                            {step.title}
                          </h3>
                          <p className="text-xs text-[#2c3d37] dark:text-[#c5d4cd] font-medium">
                            Deliverable: {step.deliverable}
                          </p>
                          <p className="text-xs text-[#56665f] dark:text-[#869b92]">
                            {step.rationale}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs font-mono tabular-nums font-semibold text-[#14211d] dark:text-cream-50">
                          {step.hours} hrs
                        </span>
                        <button
                          type="button"
                          disabled={modifying}
                          onClick={() => handleOpenSwap(idx)}
                          className={`px-2.5 py-1.5 text-xs font-medium rounded-md border flex items-center gap-1 transition-colors whitespace-nowrap ${
                            isSwapping
                              ? "bg-pine-700 text-white border-pine-700"
                              : "bg-white dark:bg-pine-950 text-[#2c3d37] dark:text-[#c5d4cd] border-sage-200 dark:border-pine-700 hover:border-pine-500"
                          }`}
                        >
                          {isSwapping ? (
                            <>
                              <X className="w-3 h-3" />
                              Close
                            </>
                          ) : (
                            <>
                              <RefreshCw className="w-3 h-3" />
                              Swap
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {isSwapping && (
                      <div className="mt-3 ml-8 p-4 bg-sage-50 dark:bg-pine-950 border border-sage-200 dark:border-pine-800 rounded-lg space-y-2.5">
                        <div className="text-xs font-semibold text-[#14211d] dark:text-cream-50">
                          Alternative modules from skill-gap remediation catalog:
                        </div>
                        {loadingAlts ? (
                          <div className="text-xs text-[#56665f]">Loading alternatives...</div>
                        ) : alternatives.length === 0 ? (
                          <div className="text-xs text-[#56665f]">
                            All relevant modules are already included in your weekly plan.
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {alternatives.map((alt) => (
                              <button
                                key={alt.title}
                                type="button"
                                disabled={modifying}
                                onClick={() => handleConfirmSwap(idx, alt)}
                                className="p-2.5 bg-cream-50 dark:bg-pine-900 hover:bg-cream-100 dark:hover:bg-pine-950/30 border border-sage-200 dark:border-pine-800 hover:border-pine-600 rounded-md text-left transition-colors"
                              >
                                <div className="text-xs font-semibold text-[#14211d] dark:text-cream-50">
                                  {alt.title}
                                </div>
                                <div className="text-[11px] text-[#56665f] dark:text-[#869b92] mt-0.5 font-mono tabular-nums">
                                  {alt.hours} hrs · {alt.focus_skill}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Interactive Mock Interview Preparation */}
          {questions.length > 0 && (
            <section className="bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-ochre-600 dark:text-ochre-400" />
                  <h2 className="text-base font-bold text-[#14211d] dark:text-cream-50">
                    Role-Tailored Mock Interview Practice
                  </h2>
                </div>
                <div className="inline-flex items-center gap-1 p-1 bg-cream-100 dark:bg-pine-800 rounded-lg">
                  {questions.map((q, qIdx) => (
                    <button
                      key={q.question}
                      type="button"
                      onClick={() => {
                        setActiveQuestionIdx(qIdx);
                        setEvaluation(null);
                        setEvalNotice(null);
                      }}
                      className={`px-2.5 py-1 text-xs font-mono font-semibold rounded-md transition-colors ${
                        activeQuestionIdx === qIdx
                          ? "bg-cream-50 dark:bg-pine-900 text-pine-700 dark:text-[#6ec4b0] shadow-xs"
                          : "text-[#45554e] dark:text-[#869b92] hover:text-[#14211d]"
                      }`}
                    >
                      Q{qIdx + 1}
                    </button>
                  ))}
                </div>
              </div>

              {activeQuestion && (
                <div className="space-y-3">
                  <div className="text-xs text-[#56665f] dark:text-[#869b92]">
                    Topic: {activeQuestion.topic}
                  </div>
                  <p className="text-sm font-semibold text-[#14211d] dark:text-cream-50">
                    {activeQuestion.question}
                  </p>

                  <textarea
                    rows={3}
                    value={mockAnswer}
                    onChange={(e) => setMockAnswer(e.target.value)}
                    placeholder="Write your 3–5 sentence technical explanation here for AI + rubric feedback..."
                    className="w-full px-3.5 py-2.5 text-xs rounded-lg border border-sage-300 dark:border-pine-700 bg-white dark:bg-pine-950 focus:outline-none focus:ring-2 focus:ring-pine-600/20"
                  />

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="text-[11px] text-[#56665f] dark:text-[#869b92]">
                      Rubric hint: {activeQuestion.hint}
                    </span>
                    <button
                      type="button"
                      disabled={evaluatingAnswer}
                      onClick={handleEvaluateMockAnswer}
                      className="px-4 py-2 bg-pine-600 hover:bg-pine-700 disabled:opacity-60 text-white text-xs font-semibold rounded-lg whitespace-nowrap"
                    >
                      {evaluatingAnswer ? "Evaluating..." : "Evaluate Answer"}
                    </button>
                  </div>

                  {evalNotice && (
                    <div className="p-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md text-[11px] text-amber-800 dark:text-amber-200">
                      {evalNotice}
                    </div>
                  )}

                  {evaluation && (
                    <div className="p-4 bg-sage-50 dark:bg-pine-950 border border-sage-200 dark:border-pine-800 rounded-lg space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-[#14211d] dark:text-cream-50">
                          {evaluation.verdict}
                        </span>
                        <span className="text-xs font-mono tabular-nums font-bold text-pine-700 dark:text-[#6ec4b0]">
                          Score: {evaluation.score}/100
                        </span>
                      </div>
                      <p className="text-xs text-[#45554e] dark:text-[#c5d4cd] leading-relaxed">
                        {evaluation.feedback}
                      </p>
                      <p className="text-[11px] text-[#56665f] dark:text-[#869b92]">
                        Next focus: {evaluation.suggested_focus}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}
        </div>

        {/* Right Column: Study Sprint Timer + Save Progress Log */}
        <aside className="lg:col-span-4 space-y-5">
          {/* Interactive 25-Min Focus Sprint Timer */}
          <div className="bg-gradient-to-br from-pine-800 to-pine-600 text-cream-50 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold tracking-wide text-cream-100">
                Study Focus Sprint
              </div>
              <span className="text-[11px] text-cream-100">25-min block</span>
            </div>
            <div className="text-3xl font-bold font-mono tabular-nums">
              {formatClock(secondsLeft)}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setTimerRunning((r) => !r)}
                className="flex-1 py-2 px-3 bg-white hover:bg-cream-100 text-pine-800 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5"
              >
                {timerRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                {timerRunning ? "Pause" : "Start Sprint"}
              </button>
              <button
                type="button"
                aria-label="Reset study timer"
                onClick={() => {
                  setTimerRunning(false);
                  setSecondsLeft(25 * 60);
                }}
                className="p-2 border border-white/30 hover:bg-white/10 rounded-lg text-white"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl p-6 space-y-5">
            <div>
              <div className="text-xs font-medium text-pine-700 dark:text-[#6ec4b0]">
                Readiness Tracking
              </div>
              <h2 className="text-lg font-bold text-[#14211d] dark:text-cream-50 mt-0.5">
                Save Progress Log
              </h2>
              <p className="text-xs text-[#45554e] dark:text-[#c5d4cd] mt-1 leading-relaxed">
                Record your weekly action plan status in SQLite to track readiness progression over
                the semester.
              </p>
            </div>

            <div className="space-y-2">
              <span className="block text-xs font-semibold text-[#14211d] dark:text-cream-50">
                Plan Status
              </span>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { key: "completed", label: "Completed" },
                    { key: "in_progress", label: "In Progress" },
                    { key: "skipped", label: "Skipped" },
                  ] as const
                ).map((item) => {
                  const active = completionStatus === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setCompletionStatus(item.key)}
                      className={`py-2 px-2 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap ${
                        active
                          ? "bg-pine-700 text-white border-pine-700"
                          : "bg-white dark:bg-pine-950 text-[#2c3d37] dark:text-[#c5d4cd] border-sage-200 dark:border-pine-700 hover:border-pine-500"
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label
                htmlFor="plan-notes"
                className="block text-xs font-semibold text-[#14211d] dark:text-cream-50 mb-1.5"
              >
                Outcome Notes (Optional)
              </label>
              <textarea
                id="plan-notes"
                rows={3}
                maxLength={280}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g., Finished SQL schema lab and practiced 3 interview prompts."
                className="w-full px-3 py-2 text-xs rounded-lg border border-sage-300 dark:border-pine-700 bg-white dark:bg-pine-950 focus:outline-none focus:ring-2 focus:ring-pine-600/20 resize-none"
              />
              <div className="text-[11px] text-[#56665f] dark:text-[#869b92] text-right font-mono tabular-nums mt-1">
                {notes.length}/280
              </div>
            </div>

            <button
              type="button"
              disabled={savingCompletion}
              onClick={handleLogCompletion}
              className="w-full py-2.5 px-4 bg-pine-700 hover:bg-pine-800 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              {savingCompletion ? "Saving Progress..." : "Save to Readiness Ledger"}
            </button>
          </div>

          <div className="bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl p-5 text-xs text-[#45554e] dark:text-[#c5d4cd] leading-relaxed">
            <div className="font-semibold text-[#14211d] dark:text-cream-50 mb-1">
              Academic Guidance Note
            </div>
            {plan.safety_note}
          </div>
        </aside>
      </div>
    </div>
  );
}
