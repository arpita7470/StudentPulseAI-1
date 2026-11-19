import { useEffect, useState } from "react";
import { CheckCircle2, Database, Play, Shield, XCircle } from "lucide-react";
import { fetchArchitectureStats, runPythonTestSuite } from "../lib/api";
import type { ArchitectureStats, PythonTestReport } from "../types/studentpulse";

const PIPELINE_STEPS = [
  {
    step: "01",
    module: "python/server.py (ThreadingHTTPServer)",
    role: "Persistent Python 3.11 HTTP API service handling student profiles, portfolio projects, readiness analytics, and SQLite CRUD.",
  },
  {
    step: "02",
    module: "python/schemas.py & validator.py",
    role: "Validates student alias, semester, CGPA, portfolio project URLs, assessment/coding/interview scores (0–100%), and study budget (2–40 hrs).",
  },
  {
    step: "03",
    module: "python/recommender.py",
    role: "Computes weighted 4-pillar readiness score, compares fit across 7 career roles, and identifies exact skill gaps against role benchmarks.",
  },
  {
    step: "04",
    module: "python/prompt_builder.py + Gemini AI",
    role: "Builds a data-minimized prompt (zero PII) for Google Gemini (@google/genai · gemini-4-hydrogen) with timeout and fallback protection.",
  },
  {
    step: "05",
    module: "python/output_validator.py",
    role: "Verifies AI action plans do not exceed weekly_study_hours and include structured deliverables & interview questions.",
  },
  {
    step: "06",
    module: "python/database.py (SQLite 3)",
    role: "Persists student_profile, student_project, evidence_snapshot, action_plan, and readiness_completion with primary/foreign keys.",
  },
];

const SCHEMA_TABLES = [
  {
    table: "student_profile",
    keys: "user_id (PK)",
    fields: "display_name, email, role, branch, target_role, semester, cgpa, xp_points, streak_days",
  },
  {
    table: "student_project",
    keys: "project_id (PK), user_id (FK)",
    fields: "title, summary, tech_stack_json, repo_url, live_url, has_tests, status, github_stars",
  },
  {
    table: "evidence_snapshot",
    keys: "snapshot_id (PK), user_id (FK)",
    fields: "weekly_study_hours, assessment_score, coding_score, project_level, computed_readiness, skill_gaps_json",
  },
  {
    table: "action_plan",
    keys: "plan_id (PK), snapshot_id (FK)",
    fields: "title, total_hours, content_json, source, created_at",
  },
  {
    table: "readiness_completion",
    keys: "completion_id (PK), user_id (FK), plan_id (FK)",
    fields: "status, notes, completed_at",
  },
  {
    table: "daily_task",
    keys: "task_id (PK), user_id (FK)",
    fields: "title, category, priority, target_date, completed, attachment_path, xp_reward",
  },
  {
    table: "study_note",
    keys: "note_id (PK), user_id (FK)",
    fields: "title, subject, content, file_name, file_path, mime_type, file_size",
  },
  {
    table: "student_skill",
    keys: "skill_id (PK), user_id (FK)",
    fields: "skill_key, proficiency, source, verified_score",
  },
  {
    table: "assessment",
    keys: "assessment_id (PK), created_by (FK)",
    fields: "title, category, duration_minutes, skill_keys_json",
  },
  {
    table: "assessment_result",
    keys: "result_id (PK), user_id (FK), assessment_id (FK)",
    fields: "score_pct, correct_count, total_count, weak_topics_json, ai_feedback",
  },
  {
    table: "job_opportunity",
    keys: "job_id (PK)",
    fields: "title, company, location, work_mode, target_role, required_skills_json",
  },
  {
    table: "resume_analysis",
    keys: "resume_id (PK), user_id (FK)",
    fields: "file_name, file_path, ats_score, matched_keywords_json, missing_keywords_json",
  },
];

export function ArchitectureView() {
  const [stats, setStats] = useState<ArchitectureStats | null>(null);
  const [testReport, setTestReport] = useState<PythonTestReport | null>(null);
  const [runningTests, setRunningTests] = useState(false);
  const [showRawOutput, setShowRawOutput] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchArchitectureStats()
      .then(setStats)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load stats."));
  }, []);

  async function handleRunTests() {
    setRunningTests(true);
    setError(null);
    try {
      const report = await runPythonTestSuite();
      setTestReport(report);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run Python unit tests.");
    } finally {
      setRunningTests(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs text-[#56665f] dark:text-[#869b92]">
            Technical Architecture & Verification · Python 3.11 HTTP Server + SQLite + Gemini AI
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#14211d] dark:text-cream-50 mt-1">
            Python Engine, Relational Schema & Live Tests
          </h1>
        </div>

        <button
          type="button"
          disabled={runningTests}
          onClick={handleRunTests}
          className="px-4 py-2.5 bg-pine-700 hover:bg-pine-800 disabled:opacity-60 text-white text-xs font-semibold rounded-lg flex items-center gap-2 whitespace-nowrap transition-colors"
        >
          <Play className="w-3.5 h-3.5" />
          {runningTests ? "Running unittest..." : "Run Python Test Suite"}
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-700 dark:text-red-300"
        >
          {error}
        </div>
      )}

      <section className="bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[#14211d] dark:text-cream-50">
              Automated Python Test Suite (`python/tests/test_studentpulse.py`)
            </h2>
            <p className="text-xs text-[#56665f] dark:text-[#869b92] mt-0.5">
              Executes `python3 -m unittest discover -s python/tests -v` live against isolated
              temporary SQLite storage.
            </p>
          </div>
          {testReport && (
            <div className="flex items-center gap-3">
              <span
                className={`text-xs font-semibold flex items-center gap-1.5 ${
                  testReport.passed
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {testReport.passed ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <XCircle className="w-4 h-4" />
                )}
                {testReport.passed
                  ? `All ${testReport.tests.length} Tests Passed`
                  : "Failures Detected"}
              </span>
              <button
                type="button"
                onClick={() => setShowRawOutput((v) => !v)}
                className="text-xs font-medium text-pine-700 dark:text-[#6ec4b0] hover:underline"
              >
                {showRawOutput ? "Hide Raw Log" : "View Raw Log"}
              </button>
            </div>
          )}
        </div>

        {!testReport ? (
          <div className="p-6 bg-sage-50 dark:bg-pine-950 border border-sage-200 dark:border-pine-800 rounded-lg text-center">
            <p className="text-xs text-[#45554e] dark:text-[#c5d4cd]">
              Click <strong>Run Python Test Suite</strong> to verify readiness scoring, skill-gap
              detection, authentication, RBAC permissions, PDF extraction, assessments, tasks/notes,
              and SQLite foreign-key persistence.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {testReport.tests.map((t) => (
                <div
                  key={t.name}
                  className="p-3.5 border border-sage-200 dark:border-pine-800 bg-sage-50 dark:bg-pine-950 rounded-lg flex items-start justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-mono font-semibold text-[#14211d] dark:text-cream-50 truncate">
                      {t.name}
                    </div>
                    {t.doc && (
                      <div className="text-xs text-[#56665f] dark:text-[#869b92] mt-1">{t.doc}</div>
                    )}
                  </div>
                  <span
                    className={`text-xs font-semibold uppercase shrink-0 ${
                      t.status === "ok"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {t.status}
                  </span>
                </div>
              ))}
            </div>

            {showRawOutput && (
              <pre className="p-4 bg-pine-950 text-cream-50 rounded-lg text-[11px] font-mono overflow-x-auto leading-relaxed">
                {testReport.output}
              </pre>
            )}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-6 bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-pine-700 dark:text-[#6ec4b0]" />
            <h2 className="text-base font-bold text-[#14211d] dark:text-cream-50">
              Python + Gemini Hybrid Execution Flow
            </h2>
          </div>
          <div className="divide-y divide-sage-200/70 dark:divide-pine-800">
            {PIPELINE_STEPS.map((item) => (
              <div key={item.step} className="py-3 first:pt-1 last:pb-1 flex items-start gap-3">
                <span className="font-mono tabular-nums text-xs font-semibold text-pine-700 dark:text-[#6ec4b0] mt-0.5">
                  {item.step}
                </span>
                <div>
                  <div className="text-xs font-mono font-semibold text-[#14211d] dark:text-cream-50">
                    {item.module}
                  </div>
                  <p className="text-xs text-[#45554e] dark:text-[#c5d4cd] mt-0.5 leading-relaxed">
                    {item.role}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="lg:col-span-6 bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-ochre-600 dark:text-ochre-400" />
              <h2 className="text-base font-bold text-[#14211d] dark:text-cream-50">
                SQLite Relational Schema (`studentpulse.db`)
              </h2>
            </div>
            {stats && (
              <span className="text-xs font-mono text-[#56665f] dark:text-[#869b92]">
                FK: {stats.stats.foreign_keys_enabled ? "ON" : "OFF"}
              </span>
            )}
          </div>

          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-sage-200 dark:border-pine-800 text-[11px] font-semibold text-[#56665f] dark:text-[#869b92]">
                  <th className="py-2 pr-3">Table</th>
                  <th className="py-2 pr-3">Keys</th>
                  <th className="py-2 text-right">Rows</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sage-200/70 dark:divide-pine-800 text-xs">
                {SCHEMA_TABLES.map((row) => {
                  const count =
                    stats?.stats.table_counts[
                      row.table as keyof typeof stats.stats.table_counts
                    ] ?? "—";
                  return (
                    <tr key={row.table}>
                      <td className="py-2.5 pr-3">
                        <div className="font-mono font-semibold text-[#14211d] dark:text-cream-50">
                          {row.table}
                        </div>
                        <div className="text-[11px] text-[#56665f] dark:text-[#869b92] mt-0.5">
                          {row.fields}
                        </div>
                      </td>
                      <td className="py-2.5 pr-3 font-mono text-[11px] text-[#45554e] dark:text-[#c5d4cd]">
                        {row.keys}
                      </td>
                      <td className="py-2.5 text-right font-mono tabular-nums font-semibold text-[#14211d] dark:text-cream-50">
                        {count}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="pt-3 border-t border-sage-200 dark:border-pine-800 text-xs text-[#45554e] dark:text-[#c5d4cd] space-y-1">
            <div>
              <strong className="font-semibold text-[#14211d] dark:text-cream-50">
                Python Runtime:
              </strong>{" "}
              {stats?.python_server_mode || "Python 3.11 ThreadingHTTPServer"}
            </div>
            <div>
              <strong className="font-semibold text-[#14211d] dark:text-cream-50">
                AI Model Integration:
              </strong>{" "}
              {stats?.ai_provider || "Google Gemini (@google/genai · gemini-4-hydrogen)"}
            </div>
            <div>
              <strong className="font-semibold text-[#14211d] dark:text-cream-50">
                Credential Security:
              </strong>{" "}
              Server-side environment variable (`GEMINI_API_KEY`) — never sent to the browser.
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
