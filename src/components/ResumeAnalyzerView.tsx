import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, Download, FileSearch, FileUp, Sparkles, XCircle } from "lucide-react";
import {
  analyzeResume,
  fetchResumes,
  fileToBase64,
  getFileDownloadUrl,
} from "../lib/api";
import {
  CAREER_ROLE_LABELS,
  type CareerRole,
  type ResumeAnalysisRecord,
  type StudentProfile,
} from "../types/studentpulse";

interface ResumeAnalyzerViewProps {
  activeProfile: StudentProfile;
  onXpUpdated: () => void;
}

const ROLE_KEYS = Object.keys(CAREER_ROLE_LABELS) as CareerRole[];

export function ResumeAnalyzerView({ activeProfile, onXpUpdated }: ResumeAnalyzerViewProps) {
  const [targetRole, setTargetRole] = useState<CareerRole>(activeProfile.target_role);
  const [jobDesc, setJobDesc] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [history, setHistory] = useState<ResumeAnalysisRecord[]>([]);
  const [selected, setSelected] = useState<ResumeAnalysisRecord | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTargetRole(activeProfile.target_role);
    fetchResumes(activeProfile.user_id)
      .then((list) => {
        setHistory(list);
        if (list.length > 0) setSelected(list[0]);
      })
      .catch(() => setHistory([]));
  }, [activeProfile.user_id, activeProfile.target_role]);

  async function handleAnalyze(e: FormEvent) {
    e.preventDefault();
    if (!resumeFile && !resumeText.trim()) {
      setError("Upload a PDF/TXT resume file or paste your resume text.");
      return;
    }
    setAnalyzing(true);
    setError(null);
    try {
      let b64: string | undefined;
      if (resumeFile) {
        b64 = await fileToBase64(resumeFile);
      }
      const res = await analyzeResume({
        user_id: activeProfile.user_id,
        target_role: targetRole,
        job_description: jobDesc.trim(),
        resume_text: resumeText.trim(),
        file_name: resumeFile?.name || "pasted_resume.txt",
        file_base64: b64,
      });
      setSelected(res);
      setHistory((prev) => [res, ...prev]);
      setResumeFile(null);
      onXpUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to analyze resume.");
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs font-medium text-pine-700 dark:text-[#6ec4b0]">
          ATS Keyword Extraction & Gemini Multimodal PDF Audit
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#14211d] dark:text-cream-50 mt-1">
          AI Resume Analyzer & ATS Scorer
        </h1>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300 font-medium">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Upload & Job Description Form */}
        <form
          onSubmit={handleAnalyze}
          className="lg:col-span-5 bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl p-6 space-y-4"
        >
          <div>
            <label className="block text-xs font-semibold mb-1.5">Target Role</label>
            <select
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value as CareerRole)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-sage-300 dark:border-pine-700 bg-white dark:bg-pine-950"
            >
              {ROLE_KEYS.map((rk) => (
                <option key={rk} value={rk}>
                  {CAREER_ROLE_LABELS[rk].label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5">
              Upload Resume (PDF or TXT)
            </label>
            <label className="w-full p-4 rounded-xl border-2 border-dashed border-cream-200 dark:border-pine-700 bg-cream-100/40 dark:bg-pine-950/20 flex flex-col items-center justify-center gap-1.5 cursor-pointer text-center">
              <FileUp className="w-5 h-5 text-pine-700 dark:text-[#6ec4b0]" />
              <span className="text-xs font-semibold text-[#1f2f29] dark:text-cream-50">
                {resumeFile ? resumeFile.name : "Choose .pdf or .txt resume file"}
              </span>
              <span className="text-[11px] text-[#56665f]">Max 10 MB · Saved securely on disk</span>
              <input
                type="file"
                accept=".pdf,.txt,.md"
                className="hidden"
                onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
              />
            </label>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5">
              Or Paste Resume Text (Optional if PDF uploaded)
            </label>
            <textarea
              rows={4}
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
              placeholder="Paste skills, projects, coursework, internships..."
              className="w-full px-3 py-2 text-xs rounded-lg border border-sage-300 dark:border-pine-700 bg-white dark:bg-pine-950"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5">
              Target Job Description (Optional)
            </label>
            <textarea
              rows={3}
              value={jobDesc}
              onChange={(e) => setJobDesc(e.target.value)}
              placeholder="Paste the job requirements to measure exact keyword alignment..."
              className="w-full px-3 py-2 text-xs rounded-lg border border-sage-300 dark:border-pine-700 bg-white dark:bg-pine-950"
            />
          </div>

          <button
            type="submit"
            disabled={analyzing}
            className="w-full py-2.5 bg-pine-700 hover:bg-pine-800 disabled:opacity-60 text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            {analyzing ? "Running ATS Audit..." : "Analyze Resume with Gemini AI (+30 XP)"}
          </button>
        </form>

        {/* Results Panel */}
        <section className="lg:col-span-7 space-y-5">
          {selected ? (
            <div className="bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-sage-200 dark:border-pine-800">
                <div>
                  <div className="text-xs font-semibold text-ochre-600 dark:text-ochre-400">
                    {selected.file_name} · {selected.created_at}
                  </div>
                  <h2 className="text-xl font-bold text-[#14211d] dark:text-cream-50 mt-0.5">
                    ATS Compatibility Score:{" "}
                    <span className="font-mono tabular-nums text-pine-700 dark:text-[#6ec4b0]">
                      {selected.ats_score}/100
                    </span>
                  </h2>
                </div>
                {selected.file_path && (
                  <a
                    href={getFileDownloadUrl(selected.file_path)}
                    className="px-3 py-1.5 rounded-lg border border-sage-200 dark:border-pine-700 text-xs font-semibold inline-flex items-center gap-1.5 hover:border-pine-600"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download Resume
                  </a>
                )}
              </div>

              <div className="w-full h-2.5 bg-cream-100 dark:bg-pine-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-pine-800 to-pine-600 rounded-full"
                  style={{ width: `${selected.ats_score}%` }}
                />
              </div>

              <p className="text-xs text-[#2c3d37] dark:text-[#c5d4cd] leading-relaxed">
                {selected.summary}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-4 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 space-y-2">
                  <div className="font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    Matched Keywords ({selected.matched_keywords.length})
                  </div>
                  <div className="text-[#2c3d37] dark:text-[#c5d4cd] leading-relaxed">
                    {selected.matched_keywords.join(" · ") || "None detected"}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 space-y-2">
                  <div className="font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                    <XCircle className="w-4 h-4" />
                    Missing Keywords ({selected.missing_keywords.length})
                  </div>
                  <div className="text-[#2c3d37] dark:text-[#c5d4cd] leading-relaxed">
                    {selected.missing_keywords.join(" · ") || "Great keyword alignment!"}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-bold text-[#14211d] dark:text-cream-50">
                  Actionable Improvement Suggestions
                </div>
                <ul className="space-y-1.5 text-xs text-[#2c3d37] dark:text-[#c5d4cd]">
                  {selected.suggestions.map((sug, i) => (
                    <li
                      key={i}
                      className="p-2.5 rounded-lg bg-sage-50 dark:bg-pine-950 border border-sage-200 dark:border-pine-800"
                    >
                      {i + 1}. {sug}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl p-10 text-center space-y-2">
              <FileSearch className="w-8 h-8 text-pine-700 mx-auto" />
              <div className="text-sm font-bold text-[#14211d] dark:text-cream-50">
                No Resume Audited Yet
              </div>
              <p className="text-xs text-[#56665f]">
                Upload your PDF resume on the left to extract keywords and calculate your ATS score.
              </p>
            </div>
          )}

          {history.length > 1 && (
            <div className="bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl p-4 space-y-2">
              <div className="text-xs font-bold text-[#14211d] dark:text-cream-50">
                Previous Resume Scans ({history.length})
              </div>
              <div className="flex flex-wrap gap-2">
                {history.map((h) => (
                  <button
                    key={h.resume_id}
                    type="button"
                    onClick={() => setSelected(h)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium ${
                      selected?.resume_id === h.resume_id
                        ? "bg-pine-700 text-white border-pine-700"
                        : "border-sage-200 dark:border-pine-700"
                    }`}
                  >
                    {h.file_name} ({h.ats_score}%)
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
