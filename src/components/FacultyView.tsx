import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardPlus,
  ExternalLink,
  FileDown,
  FolderGit2,
  MessageSquarePlus,
  Plus,
  Search,
  Send,
  Trash2,
  Users,
} from "lucide-react";
import {
  createAssessment,
  fetchFacultyOverview,
  getFileDownloadUrl,
  postFacultyFeedback,
} from "../lib/api";
import {
  CAREER_ROLE_LABELS,
  SKILL_CATEGORIES,
  SKILL_LABELS,
  type FacultyOverviewData,
  type SkillKey,
  type StudentProfile,
} from "../types/studentpulse";

interface FacultyViewProps {
  activeProfile: StudentProfile;
}

interface QuestionDraft {
  prompt: string;
  options: [string, string, string, string];
  correct_index: number;
  topic: string;
  explanation: string;
}

const EMPTY_QUESTION: QuestionDraft = {
  prompt: "",
  options: ["", "", "", ""],
  correct_index: 0,
  topic: "",
  explanation: "",
};

export function FacultyView({ activeProfile }: FacultyViewProps) {
  const [data, setData] = useState<FacultyOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const [onlyWeak, setOnlyWeak] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);

  // Feedback form
  const [fbCategory, setFbCategory] = useState("Skill Gap Guidance");
  const [fbComment, setFbComment] = useState("");
  const [postingFb, setPostingFb] = useState(false);

  // Assessment creator modal/panel
  const [showCreateAssess, setShowCreateAssess] = useState(false);
  const [assessTitle, setAssessTitle] = useState("");
  const [assessCategory, setAssessCategory] = useState("technical");
  const [assessDesc, setAssessDesc] = useState("");
  const [assessMinutes, setAssessMinutes] = useState("10");
  const [assessSkills, setAssessSkills] = useState<SkillKey[]>(["dsa", "problem_solving"]);
  const [questions, setQuestions] = useState<QuestionDraft[]>([{ ...EMPTY_QUESTION }]);
  const [creatingAssess, setCreatingAssess] = useState(false);

  async function loadOverview() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchFacultyOverview();
      setData(res);
      if (!selectedStudentId && res.students.length > 0) {
        setSelectedStudentId(res.students[0].user_id);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Faculty overview requires a faculty or admin account."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOverview();
  }, [activeProfile.user_id]);

  const filteredStudents = useMemo(() => {
    if (!data) return [];
    const q = searchQuery.trim().toLowerCase();
    return data.students.filter((st) => {
      if (onlyWeak && !st.needs_support) return false;
      if (
        q &&
        !st.display_name.toLowerCase().includes(q) &&
        !(st.branch || "").toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [data, onlyWeak, searchQuery]);

  const selectedStudent =
    data?.students.find((s) => s.user_id === selectedStudentId) || filteredStudents[0] || null;

  async function handlePostFeedback(e: FormEvent) {
    e.preventDefault();
    if (!selectedStudent || !fbComment.trim()) return;
    setPostingFb(true);
    setError(null);
    setStatusMsg(null);
    try {
      await postFacultyFeedback({
        student_id: selectedStudent.user_id,
        faculty_id: activeProfile.user_id,
        category: fbCategory,
        comment: fbComment.trim(),
      });
      setFbComment("");
      setStatusMsg(`Feedback sent to ${selectedStudent.display_name} and logged in notifications.`);
      await loadOverview();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send feedback.");
    } finally {
      setPostingFb(false);
    }
  }

  function updateQuestion(idx: number, patch: Partial<QuestionDraft>) {
    setQuestions((prev) => prev.map((q, i) => (i === idx ? { ...q, ...patch } : q)));
  }

  function updateOption(qIdx: number, optIdx: number, value: string) {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIdx) return q;
        const nextOpts = [...q.options] as [string, string, string, string];
        nextOpts[optIdx] = value;
        return { ...q, options: nextOpts };
      })
    );
  }

  async function handleCreateAssessment(e: FormEvent) {
    e.preventDefault();
    setCreatingAssess(true);
    setError(null);
    setStatusMsg(null);
    try {
      await createAssessment({
        title: assessTitle.trim(),
        category: assessCategory,
        description: assessDesc.trim(),
        duration_minutes: Number(assessMinutes) || 10,
        skill_keys: assessSkills,
        created_by: activeProfile.user_id,
        questions: questions.map((q) => ({
          prompt: q.prompt.trim(),
          options: q.options.map((o) => o.trim()),
          correct_index: q.correct_index,
          topic: q.topic.trim() || "Core Concept",
          explanation: q.explanation.trim(),
        })),
      });
      setAssessTitle("");
      setAssessDesc("");
      setQuestions([{ ...EMPTY_QUESTION }]);
      setShowCreateAssess(false);
      setStatusMsg("New assessment published to Smart Assessments module.");
      await loadOverview();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create assessment.");
    } finally {
      setCreatingAssess(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-32 bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl" />
        <div className="h-72 bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-6 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-300">
        {error}
      </div>
    );
  }

  if (!data) return null;

  const weakCount = data.students.filter((s) => s.needs_support).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs text-[#56665f] dark:text-[#869b92]">
            Faculty Mentor Portal · Cohort Monitoring & Assessment Authoring
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#14211d] dark:text-cream-50 mt-0.5">
            Faculty Workspace · {activeProfile.display_name}
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateAssess((v) => !v)}
          className="px-4 py-2.5 bg-pine-700 hover:bg-pine-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5"
        >
          <ClipboardPlus className="w-4 h-4" />
          {showCreateAssess ? "Close Assessment Builder" : "Create New Assessment"}
        </button>
      </div>

      {statusMsg && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-200 flex items-center gap-2 font-medium">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{statusMsg}</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-300 font-medium">
          {error}
        </div>
      )}

      {/* Assessment Builder */}
      {showCreateAssess && (
        <form
          onSubmit={handleCreateAssessment}
          className="bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl p-6 space-y-5"
        >
          <h2 className="text-base font-bold text-[#14211d] dark:text-cream-50">
            Publish Timed Smart Assessment
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold mb-1">Assessment Title</label>
              <input
                type="text"
                required
                value={assessTitle}
                onChange={(e) => setAssessTitle(e.target.value)}
                placeholder="e.g., Operating Systems & SQL Checkpoint"
                className="w-full px-3 py-2 text-sm rounded-lg border border-sage-300 dark:border-pine-700 bg-white dark:bg-pine-950"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Category</label>
              <select
                value={assessCategory}
                onChange={(e) => setAssessCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-sage-300 dark:border-pine-700 bg-white dark:bg-pine-950"
              >
                <option value="technical">Technical</option>
                <option value="programming">Programming</option>
                <option value="aptitude">Aptitude</option>
                <option value="logical">Logical Reasoning</option>
                <option value="communication">Communication</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Duration (minutes)</label>
              <input
                type="number"
                min={3}
                max={90}
                value={assessMinutes}
                onChange={(e) => setAssessMinutes(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-sage-300 dark:border-pine-700 bg-white dark:bg-pine-950 tabular-nums"
              />
            </div>
            <div className="md:col-span-4">
              <label className="block text-xs font-semibold mb-1">Description</label>
              <input
                type="text"
                required
                value={assessDesc}
                onChange={(e) => setAssessDesc(e.target.value)}
                placeholder="Topics covered and learning outcome..."
                className="w-full px-3 py-2 text-sm rounded-lg border border-sage-300 dark:border-pine-700 bg-white dark:bg-pine-950"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="text-xs font-semibold">Verified Skills Linked to Assessment</div>
            <div className="flex flex-wrap gap-1.5">
              {SKILL_CATEGORIES.flatMap((c) => c.skills)
                .slice(0, 12)
                .map((sk) => {
                  const active = assessSkills.includes(sk);
                  return (
                    <button
                      key={sk}
                      type="button"
                      onClick={() =>
                        setAssessSkills((prev) =>
                          prev.includes(sk) ? prev.filter((x) => x !== sk) : [...prev, sk]
                        )
                      }
                      className={`px-2.5 py-1 rounded-md border text-[11px] font-medium ${
                        active
                          ? "bg-pine-700 text-white border-pine-700"
                          : "bg-sage-50 dark:bg-pine-950 border-sage-200 dark:border-pine-800"
                      }`}
                    >
                      {SKILL_LABELS[sk]}
                    </button>
                  );
                })}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold">MCQ Questions ({questions.length})</span>
              <button
                type="button"
                onClick={() => setQuestions((p) => [...p, { ...EMPTY_QUESTION }])}
                className="px-3 py-1.5 text-xs font-semibold border border-sage-300 dark:border-pine-700 rounded-lg flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Question
              </button>
            </div>

            {questions.map((q, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl border border-sage-200 dark:border-pine-800 bg-sage-50/70 dark:bg-pine-950 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-pine-700 dark:text-[#6ec4b0]">
                    Question {idx + 1}
                  </span>
                  {questions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setQuestions((p) => p.filter((_, i) => i !== idx))}
                      className="text-[#869b92] hover:text-red-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2">
                    <input
                      type="text"
                      required
                      value={q.prompt}
                      onChange={(e) => updateQuestion(idx, { prompt: e.target.value })}
                      placeholder="Question prompt..."
                      className="w-full px-3 py-2 text-xs rounded-lg border border-sage-300 dark:border-pine-700 bg-cream-50 dark:bg-pine-900"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      required
                      value={q.topic}
                      onChange={(e) => updateQuestion(idx, { topic: e.target.value })}
                      placeholder="Topic (e.g., Indexing)"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-sage-300 dark:border-pine-700 bg-cream-50 dark:bg-pine-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {q.options.map((opt, optIdx) => (
                    <div key={optIdx} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={`correct-${idx}`}
                        checked={q.correct_index === optIdx}
                        onChange={() => updateQuestion(idx, { correct_index: optIdx })}
                      />
                      <input
                        type="text"
                        required
                        value={opt}
                        onChange={(e) => updateOption(idx, optIdx, e.target.value)}
                        placeholder={`Option ${optIdx + 1}`}
                        className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-sage-300 dark:border-pine-700 bg-cream-50 dark:bg-pine-900"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={creatingAssess}
              className="px-5 py-2.5 bg-pine-700 hover:bg-pine-800 text-white text-xs font-semibold rounded-lg"
            >
              {creatingAssess ? "Publishing..." : "Publish Assessment"}
            </button>
          </div>
        </form>
      )}

      {/* KPI Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl p-4">
          <div className="text-xs text-[#56665f] dark:text-[#869b92]">Assigned Students</div>
          <div className="text-2xl font-bold font-mono tabular-nums mt-1">
            {data.students.length}
          </div>
        </div>
        <div className="bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl p-4">
          <div className="text-xs text-[#56665f] dark:text-[#869b92]">Needs Mentor Support</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400 mt-1">
            {weakCount}
          </div>
        </div>
        <div className="bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl p-4">
          <div className="text-xs text-[#56665f] dark:text-[#869b92]">Active Assessments</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-pine-700 dark:text-[#6ec4b0] mt-1">
            {data.assessments.length}
          </div>
        </div>
      </section>

      {/* Main Split: Cohort List + Student Detail/Projects/Feedback */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <section className="lg:col-span-7 bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-sage-200 dark:border-pine-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-pine-700 dark:text-[#6ec4b0]" />
              <h2 className="text-sm font-bold text-[#14211d] dark:text-cream-50">
                Student Cohort Readiness
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setOnlyWeak((w) => !w)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border flex items-center gap-1.5 ${
                  onlyWeak
                    ? "bg-amber-600 text-white border-amber-600"
                    : "border-sage-300 dark:border-pine-700 text-[#2c3d37] dark:text-[#c5d4cd]"
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                Needs Support ({weakCount})
              </button>

              <div className="relative w-44">
                <Search className="w-3.5 h-3.5 text-[#869b92] absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search student..."
                  className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-lg border border-sage-300 dark:border-pine-700 bg-white dark:bg-pine-950"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-sage-50 dark:bg-pine-950 border-b border-sage-200 dark:border-pine-800 text-[11px] font-semibold text-[#56665f]">
                  <th className="py-2.5 px-4">Student</th>
                  <th className="py-2.5 px-3 text-right">Readiness</th>
                  <th className="py-2.5 px-3 text-right">CGPA</th>
                  <th className="py-2.5 px-3 text-right">Avg Quiz</th>
                  <th className="py-2.5 px-4 text-right">Projects</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sage-200/70 dark:divide-pine-800">
                {filteredStudents.map((st) => {
                  const selected = selectedStudent?.user_id === st.user_id;
                  return (
                    <tr
                      key={st.user_id}
                      onClick={() => setSelectedStudentId(st.user_id)}
                      className={`cursor-pointer transition-colors ${
                        selected
                          ? "bg-cream-100/80 dark:bg-pine-950/30"
                          : "hover:bg-sage-50 dark:hover:bg-pine-800/40"
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="font-bold text-[#14211d] dark:text-cream-50 flex items-center gap-1.5">
                          {st.display_name}
                          {st.needs_support && (
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          )}
                        </div>
                        <div className="text-[11px] text-[#56665f] dark:text-[#869b92]">
                          {st.branch || "CSE"} · Sem {st.semester} ·{" "}
                          {CAREER_ROLE_LABELS[st.target_role]?.label || st.target_role}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold tabular-nums text-pine-700 dark:text-[#6ec4b0]">
                        {st.readiness_score}/100
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums">
                        {st.cgpa.toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums">
                        {st.avg_assessment_score}%
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        {st.project_count}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Right: Selected Student Projects & Mentor Feedback */}
        <section className="lg:col-span-5 space-y-5">
          {selectedStudent && (
            <>
              <div className="bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-[#14211d] dark:text-cream-50 flex items-center gap-1.5">
                      <FolderGit2 className="w-4 h-4 text-pine-700" />
                      Project Submissions · {selectedStudent.display_name}
                    </h3>
                    <p className="text-[11px] text-[#56665f] dark:text-[#869b92]">
                      Review student artifacts, GitHub repositories, and uploaded reports.
                    </p>
                  </div>
                </div>

                {selectedStudent.projects.length === 0 ? (
                  <p className="text-xs text-[#56665f] dark:text-[#869b92]">
                    No project submissions recorded yet.
                  </p>
                ) : (
                  <div className="space-y-2.5 max-h-60 overflow-y-auto">
                    {selectedStudent.projects.map((p) => (
                      <div
                        key={p.project_id}
                        className="p-3 rounded-lg border border-sage-200 dark:border-pine-800 bg-sage-50 dark:bg-pine-950 space-y-1.5 text-xs"
                      >
                        <div className="font-bold text-[#14211d] dark:text-cream-50">{p.title}</div>
                        <p className="text-[11px] text-[#45554e] dark:text-[#c5d4cd]">
                          {p.summary}
                        </p>
                        <div className="flex flex-wrap gap-3 text-[11px]">
                          {p.repo_url && (
                            <a
                              href={p.repo_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-pine-700 dark:text-[#6ec4b0] font-semibold hover:underline inline-flex items-center gap-1"
                            >
                              GitHub <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                          {p.attachment_path && (
                            <a
                              href={getFileDownloadUrl(p.attachment_path)}
                              className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline inline-flex items-center gap-1"
                            >
                              <FileDown className="w-3 h-3" />
                              {p.attachment_name || "Report"}
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <form
                onSubmit={handlePostFeedback}
                className="bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl p-5 space-y-3"
              >
                <div className="flex items-center gap-2 text-sm font-bold text-[#14211d] dark:text-cream-50">
                  <MessageSquarePlus className="w-4 h-4 text-ochre-600" />
                  Send Mentor Feedback to {selectedStudent.display_name}
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">Category</label>
                  <select
                    value={fbCategory}
                    onChange={(e) => setFbCategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-sage-300 dark:border-pine-700 bg-white dark:bg-pine-950"
                  >
                    <option>Skill Gap Guidance</option>
                    <option>Project Architecture Review</option>
                    <option>Interview Readiness</option>
                    <option>Academic Support</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">Guidance Comment</label>
                  <textarea
                    rows={3}
                    required
                    value={fbComment}
                    onChange={(e) => setFbComment(e.target.value)}
                    placeholder="Provide actionable feedback for the student..."
                    className="w-full px-3 py-2 text-xs rounded-lg border border-sage-300 dark:border-pine-700 bg-white dark:bg-pine-950"
                  />
                </div>

                <button
                  type="submit"
                  disabled={postingFb}
                  className="w-full py-2.5 bg-pine-600 hover:bg-pine-700 disabled:opacity-60 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  {postingFb ? "Sending..." : "Post Feedback & Notify Student"}
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
