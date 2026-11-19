import { useEffect, useState } from "react";
import { Mic, MicOff, Sparkles } from "lucide-react";
import {
  evaluateMockInterview,
  fetchMockInterviews,
  generateInterviewQuestions,
} from "../lib/api";
import {
  CAREER_ROLE_LABELS,
  type CareerRole,
  type InterviewQuestion,
  type MockInterviewRecord,
  type StudentProfile,
} from "../types/studentpulse";

interface MockInterviewViewProps {
  activeProfile: StudentProfile;
  onXpUpdated: () => void;
}

const ROLE_KEYS = Object.keys(CAREER_ROLE_LABELS) as CareerRole[];

export function MockInterviewView({ activeProfile, onXpUpdated }: MockInterviewViewProps) {
  const [targetRole, setTargetRole] = useState<CareerRole>(activeProfile.target_role);
  const [mode, setMode] = useState<"technical" | "hr">("technical");
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [answer, setAnswer] = useState("");
  const [history, setHistory] = useState<MockInterviewRecord[]>([]);
  const [latestEval, setLatestEval] = useState<MockInterviewRecord | null>(null);
  const [generating, setGenerating] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTargetRole(activeProfile.target_role);
    fetchMockInterviews(activeProfile.user_id)
      .then(setHistory)
      .catch(() => setHistory([]));
  }, [activeProfile.user_id, activeProfile.target_role]);

  async function handleGenerateQuestions() {
    setGenerating(true);
    setError(null);
    setLatestEval(null);
    try {
      const qs = await generateInterviewQuestions({
        target_role: CAREER_ROLE_LABELS[targetRole]?.label || targetRole,
        mode,
      });
      setQuestions(qs);
      setActiveIdx(0);
      setAnswer("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate interview questions.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleEvaluate() {
    const q = questions[activeIdx];
    if (!q || answer.trim().length < 5) {
      setError("Write or dictate at least a short interview response first.");
      return;
    }
    setEvaluating(true);
    setError(null);
    try {
      const saved = await evaluateMockInterview({
        user_id: activeProfile.user_id,
        target_role: targetRole,
        mode,
        question: q.question,
        answer: answer.trim(),
        hint: q.hint,
      });
      setLatestEval(saved);
      setHistory((prev) => [saved, ...prev]);
      onXpUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Interview evaluation failed.");
    } finally {
      setEvaluating(false);
    }
  }

  function handleVoiceToggle() {
    const SpeechRec =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      setError("Voice dictation is not supported in this browser; please type your answer.");
      return;
    }
    if (listening) {
      setListening(false);
      return;
    }
    const recognition = new SpeechRec();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript || "";
      setAnswer((prev) => (prev ? `${prev} ${transcript}` : transcript));
      setListening(false);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    setListening(true);
    recognition.start();
  }

  const activeQ = questions[activeIdx];

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs font-medium text-pine-700 dark:text-[#6ec4b0]">
          Gemini AI Interviewer · 3-Axis Technical & Communication Rubric
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#14211d] dark:text-cream-50 mt-1">
          AI Mock Interview Simulator
        </h1>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300 font-medium">
          {error}
        </div>
      )}

      <section className="bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl p-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-5">
            <label className="block text-xs font-semibold mb-1.5">Target Role</label>
            <select
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value as CareerRole)}
              className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-sage-300 dark:border-pine-700 bg-white dark:bg-pine-950"
            >
              {ROLE_KEYS.map((rk) => (
                <option key={rk} value={rk}>
                  {CAREER_ROLE_LABELS[rk].label}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-4">
            <label className="block text-xs font-semibold mb-1.5">Interview Mode</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMode("technical")}
                className={`py-2.5 text-xs font-semibold rounded-lg border ${
                  mode === "technical"
                    ? "bg-pine-700 text-white border-pine-700"
                    : "border-sage-300 dark:border-pine-700 text-[#2c3d37] dark:text-[#c5d4cd]"
                }`}
              >
                Technical Round
              </button>
              <button
                type="button"
                onClick={() => setMode("hr")}
                className={`py-2.5 text-xs font-semibold rounded-lg border ${
                  mode === "hr"
                    ? "bg-pine-600 text-white border-ochre-500"
                    : "border-sage-300 dark:border-pine-700 text-[#2c3d37] dark:text-[#c5d4cd]"
                }`}
              >
                HR & Behavioral
              </button>
            </div>
          </div>

          <div className="md:col-span-3">
            <button
              type="button"
              disabled={generating}
              onClick={handleGenerateQuestions}
              className="w-full py-2.5 px-4 bg-pine-700 hover:bg-pine-800 disabled:opacity-60 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {generating ? "Generating..." : "Generate 3 Questions"}
            </button>
          </div>
        </div>

        {questions.length > 0 && activeQ && (
          <div className="pt-4 border-t border-sage-200 dark:border-pine-800 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-semibold text-ochre-600 dark:text-ochre-400">
                {activeQ.topic} {activeQ.difficulty ? `· ${activeQ.difficulty}` : ""}
              </div>
              <div className="inline-flex gap-1 p-1 bg-cream-100 dark:bg-pine-800 rounded-lg">
                {questions.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setActiveIdx(i);
                      setLatestEval(null);
                    }}
                    className={`px-2.5 py-1 text-xs font-mono font-semibold rounded-md ${
                      activeIdx === i
                        ? "bg-cream-50 dark:bg-pine-900 text-pine-700 shadow-xs"
                        : "text-[#56665f]"
                    }`}
                  >
                    Q{i + 1}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-base font-bold text-[#14211d] dark:text-cream-50">{activeQ.question}</p>

            <textarea
              rows={4}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Explain your approach clearly (or click Dictate to speak your answer)..."
              className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-sage-300 dark:border-pine-700 bg-white dark:bg-pine-950"
            />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-[#56665f] dark:text-[#869b92]">
                Hint: {activeQ.hint}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleVoiceToggle}
                  className={`px-3 py-2 text-xs font-semibold rounded-lg border flex items-center gap-1.5 ${
                    listening
                      ? "bg-red-50 border-red-400 text-red-600"
                      : "border-sage-300 dark:border-pine-700 text-[#2c3d37] dark:text-[#dbe6e0]"
                  }`}
                >
                  {listening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                  {listening ? "Listening..." : "Voice Dictate"}
                </button>
                <button
                  type="button"
                  disabled={evaluating}
                  onClick={handleEvaluate}
                  className="px-4 py-2 bg-pine-600 hover:bg-pine-700 disabled:opacity-60 text-white text-xs font-semibold rounded-lg"
                >
                  {evaluating ? "Evaluating..." : "Submit for AI Review (+35 XP)"}
                </button>
              </div>
            </div>
          </div>
        )}

        {latestEval && (
          <div className="p-5 rounded-xl bg-sage-50 dark:bg-pine-950 border border-sage-200 dark:border-pine-800 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <div className="text-[11px] text-[#56665f]">Overall Score</div>
                <div className="text-2xl font-bold font-mono tabular-nums text-pine-700 dark:text-[#6ec4b0]">
                  {latestEval.overall_score}/100
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[#56665f]">Technical Depth</div>
                <div className="text-xl font-bold font-mono tabular-nums text-[#14211d] dark:text-cream-50">
                  {latestEval.technical_score}%
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[#56665f]">Communication</div>
                <div className="text-xl font-bold font-mono tabular-nums text-ochre-600 dark:text-ochre-400">
                  {latestEval.communication_score}%
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[#56665f]">Answer Quality</div>
                <div className="text-xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                  {latestEval.quality_score}%
                </div>
              </div>
            </div>
            <p className="text-xs text-[#2c3d37] dark:text-[#c5d4cd] leading-relaxed">
              <strong>Feedback:</strong> {latestEval.feedback}
            </p>
            <p className="text-xs text-[#45554e] dark:text-[#869b92]">
              <strong>Actionable Improvement:</strong> {latestEval.improvements}
            </p>
          </div>
        )}
      </section>

      {/* Persisted Mock Interview History */}
      <section className="bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl p-6 space-y-3">
        <h2 className="text-sm font-bold text-[#14211d] dark:text-cream-50">
          Saved Mock Interview History ({history.length})
        </h2>
        {history.length === 0 ? (
          <p className="text-xs text-[#56665f] dark:text-[#869b92]">
            Generate a question set above and submit an answer to record your first AI evaluation.
          </p>
        ) : (
          <div className="space-y-3">
            {history.map((item) => (
              <div
                key={item.interview_id}
                className="p-4 rounded-lg border border-sage-200 dark:border-pine-800 space-y-1.5 text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-[#14211d] dark:text-cream-50">
                    {item.question}
                  </span>
                  <span className="font-mono font-bold tabular-nums text-pine-700 dark:text-[#6ec4b0]">
                    Overall {item.overall_score}% (Tech {item.technical_score}% · Comm{" "}
                    {item.communication_score}%)
                  </span>
                </div>
                <p className="text-[#45554e] dark:text-[#c5d4cd]">{item.feedback}</p>
                <div className="text-[11px] text-[#869b92] font-mono">
                  {item.mode.toUpperCase()} · {item.created_at}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
