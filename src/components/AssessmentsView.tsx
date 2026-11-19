import { useEffect, useState } from "react";
import {
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Play,
  Sparkles,
  XCircle,
} from "lucide-react";
import {
  fetchAiAssessmentFeedback,
  fetchAssessmentDetail,
  fetchAssessmentResults,
  fetchAssessments,
  submitAssessment,
} from "../lib/api";
import {
  SKILL_LABELS,
  type AssessmentItem,
  type AssessmentResult,
  type StudentProfile,
} from "../types/studentpulse";

interface AssessmentsViewProps {
  activeProfile: StudentProfile;
  onXpUpdated: () => void;
}

export function AssessmentsView({ activeProfile, onXpUpdated }: AssessmentsViewProps) {
  const [assessments, setAssessments] = useState<AssessmentItem[]>([]);
  const [results, setResults] = useState<AssessmentResult[]>([]);
  const [activeQuiz, setActiveQuiz] = useState<AssessmentItem | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [latestResult, setLatestResult] = useState<AssessmentResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchAssessments().catch(() => []),
      fetchAssessmentResults(activeProfile.user_id).catch(() => []),
    ])
      .then(([list, hist]) => {
        setAssessments(list);
        setResults(hist);
      })
      .finally(() => setLoading(false));
  }, [activeProfile.user_id]);

  // Countdown Timer while quiz is active
  useEffect(() => {
    if (!activeQuiz || secondsLeft <= 0) return;
    const id = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(id);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [activeQuiz, secondsLeft > 0]);

  async function handleStartQuiz(assessmentId: number) {
    setError(null);
    setLatestResult(null);
    try {
      const detail = await fetchAssessmentDetail(assessmentId);
      const qCount = detail.questions?.length || 0;
      setAnswers(new Array(qCount).fill(-1));
      const secs = (detail.duration_minutes || 10) * 60;
      setSecondsLeft(secs);
      setTotalSeconds(secs);
      setActiveQuiz(detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load assessment.");
    }
  }

  async function handleSubmitQuiz() {
    if (!activeQuiz) return;
    setSubmitting(true);
    setError(null);
    try {
      const timeTaken = Math.max(5, totalSeconds - secondsLeft);
      const res = await submitAssessment(activeQuiz.assessment_id, {
        user_id: activeProfile.user_id,
        answers,
        time_taken_sec: timeTaken,
      });
      setLatestResult(res);
      setResults((prev) => [res, ...prev]);
      setActiveQuiz(null);
      onXpUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not grade assessment.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGenerateAiFeedback(result: AssessmentResult) {
    setAiLoading(true);
    setError(null);
    try {
      const fb = await fetchAiAssessmentFeedback({
        result_id: result.result_id,
        assessment_title: result.assessment_title,
        score_pct: result.score_pct,
        weak_topics: result.weak_topics,
      });
      setLatestResult((prev) => (prev ? { ...prev, ai_feedback: fb } : prev));
      setResults((prev) =>
        prev.map((r) => (r.result_id === result.result_id ? { ...r, ai_feedback: fb } : r))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate AI study feedback.");
    } finally {
      setAiLoading(false);
    }
  }

  const formatTimer = (sec: number) => {
    const m = String(Math.floor(sec / 60)).padStart(2, "0");
    const s = String(sec % 60).padStart(2, "0");
    return `${m}:${s}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs font-medium text-pine-700 dark:text-[#6ec4b0]">
          Timed Diagnostics · Auto-Grading & Skill Verification
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#14211d] dark:text-cream-50 mt-1">
          Smart Assessment Center
        </h1>
        <p className="text-sm text-[#45554e] dark:text-[#869b92] mt-1">
          Take timed Technical MCQ, Full-Stack & SQL, and Aptitude & Communication tests. Scores
          automatically verify skills on your Digital Skill Passport.
        </p>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300 font-medium">
          {error}
        </div>
      )}

      {/* Active Timed Test Runner */}
      {activeQuiz && (
        <section className="bg-cream-50 dark:bg-pine-900 border border-cream-200 dark:border-pine-700 rounded-xl p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-sage-200 dark:border-pine-800">
            <div>
              <div className="text-xs font-semibold text-pine-700 dark:text-[#6ec4b0]">
                {activeQuiz.category}
              </div>
              <h2 className="text-lg font-bold text-[#14211d] dark:text-cream-50">
                {activeQuiz.title}
              </h2>
            </div>

            <div className="flex items-center gap-3">
              <div className="px-3.5 py-2 rounded-lg bg-cream-100 dark:bg-pine-800 font-mono text-sm font-bold tabular-nums flex items-center gap-2 text-[#14211d] dark:text-cream-50">
                <Clock className="w-4 h-4 text-pine-700" />
                {formatTimer(secondsLeft)}
              </div>
              <button
                type="button"
                onClick={() => setActiveQuiz(null)}
                className="px-3 py-2 text-xs font-semibold text-[#45554e] dark:text-[#c5d4cd] border border-sage-300 dark:border-pine-700 rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>

          <div className="space-y-6">
            {(activeQuiz.questions || []).map((q, qIdx) => (
              <div
                key={q.question_id}
                className="p-4 rounded-xl bg-sage-50 dark:bg-pine-950 border border-sage-200 dark:border-pine-800 space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-ochre-600 dark:text-ochre-400">
                    Question {qIdx + 1} · {q.topic}
                  </span>
                </div>
                <p className="text-sm font-semibold text-[#14211d] dark:text-cream-50">{q.prompt}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {q.options.map((opt, optIdx) => {
                    const selected = answers[qIdx] === optIdx;
                    return (
                      <button
                        key={optIdx}
                        type="button"
                        onClick={() =>
                          setAnswers((prev) => prev.map((a, i) => (i === qIdx ? optIdx : a)))
                        }
                        className={`p-3 rounded-lg border text-left text-xs font-medium transition-colors ${
                          selected
                            ? "bg-pine-700 text-white border-pine-700 font-semibold"
                            : "bg-cream-50 dark:bg-pine-900 border-sage-200 dark:border-pine-700 text-[#2c3d37] dark:text-[#dbe6e0] hover:border-pine-500"
                        }`}
                      >
                        {String.fromCharCode(65 + optIdx)}. {opt}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              disabled={submitting}
              onClick={handleSubmitQuiz}
              className="px-6 py-2.5 bg-pine-700 hover:bg-pine-800 disabled:opacity-60 text-white text-sm font-semibold rounded-lg"
            >
              {submitting ? "Grading Answers..." : "Submit Assessment"}
            </button>
          </div>
        </section>
      )}

      {/* Detailed Post-Test Analysis */}
      {latestResult && (
        <section className="bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-sage-200 dark:border-pine-800">
            <div>
              <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                Assessment Graded & Skills Verified
              </div>
              <h2 className="text-xl font-bold text-[#14211d] dark:text-cream-50 mt-0.5">
                {latestResult.assessment_title} — {latestResult.score_pct}% (
                {latestResult.correct_count}/{latestResult.total_count})
              </h2>
            </div>

            <button
              type="button"
              disabled={aiLoading}
              onClick={() => handleGenerateAiFeedback(latestResult)}
              className="px-4 py-2 bg-pine-600 hover:bg-pine-700 disabled:opacity-60 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {aiLoading ? "Generating..." : "AI Weak-Topic Feedback"}
            </button>
          </div>

          <div className="p-4 rounded-xl bg-cream-100 dark:bg-pine-950/30 border border-cream-200 dark:border-pine-800 text-xs text-[#1f2f29] dark:text-[#dbe6e0] leading-relaxed">
            <strong className="font-semibold">Feedback: </strong>
            {latestResult.ai_feedback}
          </div>

          {latestResult.review && (
            <div className="space-y-2.5">
              {latestResult.review.map((item, i) => (
                <div
                  key={item.question_id}
                  className="p-3.5 rounded-lg border border-sage-200 dark:border-pine-800 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-[#14211d] dark:text-cream-50">
                      Q{i + 1}. {item.prompt}
                    </span>
                    {item.is_correct ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold shrink-0">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Correct
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-red-600 font-semibold shrink-0">
                        <XCircle className="w-3.5 h-3.5" />
                        Missed ({item.topic})
                      </span>
                    )}
                  </div>
                  <div className="text-[#45554e] dark:text-[#869b92]">
                    Correct Answer: {item.options[item.correct_index]}
                    {item.explanation ? ` — ${item.explanation}` : ""}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Available Assessments Catalog */}
      {!activeQuiz && (
        <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {loading ? (
            <div className="col-span-3 h-40 animate-pulse bg-cream-100 dark:bg-pine-800 rounded-xl" />
          ) : (
            assessments.map((a) => (
              <div
                key={a.assessment_id}
                className="bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl p-5 flex flex-col justify-between gap-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-ochre-600 dark:text-ochre-400">
                    <span>{a.category}</span>
                    <span className="font-mono tabular-nums text-[#56665f]">
                      {a.duration_minutes} mins · {a.question_count || 0} Qs
                    </span>
                  </div>
                  <h2 className="text-base font-bold text-[#14211d] dark:text-cream-50">{a.title}</h2>
                  <p className="text-xs text-[#45554e] dark:text-[#869b92] leading-relaxed">
                    {a.description}
                  </p>
                  <div className="text-[11px] text-[#56665f] dark:text-[#869b92] pt-1">
                    Verifies: {a.skill_keys.map((k) => SKILL_LABELS[k] || k).join(" · ")}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleStartQuiz(a.assessment_id)}
                  className="w-full py-2.5 bg-pine-700 hover:bg-pine-800 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5" />
                  Start Timed Assessment
                </button>
              </div>
            ))
          )}
        </section>
      )}

      {/* Previous Test History */}
      <section className="bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2 text-sm font-bold text-[#14211d] dark:text-cream-50">
          <ClipboardCheck className="w-4 h-4 text-pine-700" />
          Previous Assessment Attempts ({results.length})
        </div>

        {results.length === 0 ? (
          <p className="text-xs text-[#56665f] dark:text-[#869b92]">
            No assessments completed yet for {activeProfile.display_name}.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-sage-200 dark:border-pine-800 text-[#56665f]">
                  <th className="py-2 pr-3">Assessment</th>
                  <th className="py-2 pr-3">Score</th>
                  <th className="py-2 pr-3">Weak Topics</th>
                  <th className="py-2 pr-3">Feedback</th>
                  <th className="py-2 text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sage-200/70 dark:divide-pine-800">
                {results.map((r) => (
                  <tr key={r.result_id}>
                    <td className="py-3 pr-3 font-semibold text-[#14211d] dark:text-cream-50">
                      {r.assessment_title}
                    </td>
                    <td className="py-3 pr-3 font-mono font-bold tabular-nums text-pine-700 dark:text-[#6ec4b0]">
                      {r.score_pct}% ({r.correct_count}/{r.total_count})
                    </td>
                    <td className="py-3 pr-3 text-[#45554e] dark:text-[#c5d4cd]">
                      {r.weak_topics.length > 0 ? r.weak_topics.join(", ") : "None"}
                    </td>
                    <td className="py-3 pr-3 text-[#45554e] dark:text-[#869b92] max-w-sm">
                      {r.ai_feedback}
                    </td>
                    <td className="py-3 text-right font-mono text-[#56665f] whitespace-nowrap">
                      {r.created_at}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
