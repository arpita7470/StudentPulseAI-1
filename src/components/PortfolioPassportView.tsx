import { useEffect, useState, type FormEvent } from "react";
import {
  Award,
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileDown,
  FolderGit2,
  GitBranch,
  Plus,
  Share2,
  ShieldCheck,
  Star,
  Trash2,
  Upload,
} from "lucide-react";
import {
  createProject,
  deleteProject,
  fetchDigitalPassport,
  fetchGithubRepoMeta,
  fetchProjects,
  fileToBase64,
  getFileDownloadUrl,
} from "../lib/api";
import { exportPassportAsPdf } from "../lib/pdfExport";
import {
  CAREER_ROLE_LABELS,
  SKILL_CATEGORIES,
  SKILL_LABELS,
  type DigitalPassportData,
  type SkillKey,
  type StudentProfile,
  type StudentProject,
} from "../types/studentpulse";

interface PortfolioPassportViewProps {
  activeProfile: StudentProfile;
  passportUserIdOverride?: number | null;
  onClearPassportOverride?: () => void;
  onXpUpdated: () => void;
}

export function PortfolioPassportView({
  activeProfile,
  passportUserIdOverride,
  onClearPassportOverride,
  onXpUpdated,
}: PortfolioPassportViewProps) {
  const targetUserId = passportUserIdOverride || activeProfile.user_id;
  const isOwner = targetUserId === activeProfile.user_id;

  const [subTab, setSubTab] = useState<"portfolio" | "passport">(
    passportUserIdOverride ? "passport" : "portfolio"
  );
  const [projects, setProjects] = useState<StudentProject[]>([]);
  const [passport, setPassport] = useState<DigitalPassportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Add project form state
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [liveUrl, setLiveUrl] = useState("");
  const [status, setStatus] = useState<"completed" | "in_progress">("completed");
  const [hasTests, setHasTests] = useState(true);
  const [techStack, setTechStack] = useState<SkillKey[]>(["js_ts", "react_ui"]);
  const [githubStars, setGithubStars] = useState<number>(0);
  const [fetchingGithub, setFetchingGithub] = useState(false);
  const [githubMetaNote, setGithubMetaNote] = useState<string | null>(null);
  const [attachmentName, setAttachmentName] = useState("");
  const [attachmentBase64, setAttachmentBase64] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [projs, pass] = await Promise.all([
        fetchProjects(targetUserId),
        fetchDigitalPassport(targetUserId),
      ]);
      setProjects(projs);
      setPassport(pass);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load portfolio & passport.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (passportUserIdOverride) {
      setSubTab("passport");
    }
    loadAll();
  }, [targetUserId]);

  async function handleLookupGithub() {
    if (!repoUrl.trim()) return;
    setFetchingGithub(true);
    setGithubMetaNote(null);
    try {
      const meta = await fetchGithubRepoMeta(repoUrl.trim());
      setGithubStars(meta.stars);
      setGithubMetaNote(
        `${meta.full_name} · ${meta.stars} stars · ${meta.forks} forks (${meta.language || "Code"})`
      );
      if (!summary.trim() && meta.description) {
        setSummary(meta.description);
      }
    } catch (err) {
      setGithubMetaNote(err instanceof Error ? err.message : "Could not fetch GitHub repo info.");
    } finally {
      setFetchingGithub(false);
    }
  }

  async function handleAttachmentChange(file: File | null) {
    if (!file) {
      setAttachmentName("");
      setAttachmentBase64("");
      return;
    }
    const b64 = await fileToBase64(file);
    setAttachmentName(file.name);
    setAttachmentBase64(b64);
  }

  function toggleSkill(sk: SkillKey) {
    setTechStack((prev) => (prev.includes(sk) ? prev.filter((s) => s !== sk) : [...prev, sk]));
  }

  async function handleCreateProject(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createProject({
        user_id: activeProfile.user_id,
        title: title.trim(),
        summary: summary.trim(),
        tech_stack: techStack,
        repo_url: repoUrl.trim(),
        live_url: liveUrl.trim(),
        has_tests: hasTests,
        status,
        attachment_name: attachmentName || undefined,
        attachment_base64: attachmentBase64 || undefined,
        github_stars: githubStars,
      });
      setTitle("");
      setSummary("");
      setRepoUrl("");
      setLiveUrl("");
      setAttachmentName("");
      setAttachmentBase64("");
      setGithubStars(0);
      setGithubMetaNote(null);
      setShowForm(false);
      await loadAll();
      onXpUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save project.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(projectId: number) {
    try {
      await deleteProject(projectId);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete project.");
    }
  }

  function handleCopyShareLink() {
    const shareUrl = `${window.location.origin}/#passport/${targetUserId}`;
    navigator.clipboard?.writeText(shareUrl).catch(() => undefined);
    setCopiedLink(true);
    window.setTimeout(() => setCopiedLink(false), 2000);
  }

  return (
    <div className="space-y-6">
      {/* Header & Sub-tab Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs text-[#56665f] dark:text-[#869b92]">
            Student Portfolio & Verified Skill Record
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#14211d] dark:text-cream-50 mt-0.5">
            Project Portfolio & Digital Skill Passport
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {passportUserIdOverride && onClearPassportOverride && (
            <button
              type="button"
              onClick={onClearPassportOverride}
              className="px-3 py-2 text-xs font-semibold rounded-lg border border-sage-300 dark:border-pine-700 bg-cream-50 dark:bg-pine-900"
            >
              Back to My Portfolio
            </button>
          )}
          <div className="inline-flex p-1 bg-sage-200/70 dark:bg-pine-800 rounded-lg gap-1">
            <button
              type="button"
              onClick={() => setSubTab("portfolio")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 ${
                subTab === "portfolio"
                  ? "bg-cream-50 dark:bg-pine-900 text-pine-700 dark:text-[#6ec4b0] shadow-xs"
                  : "text-[#45554e] dark:text-[#869b92]"
              }`}
            >
              <FolderGit2 className="w-3.5 h-3.5" />
              Projects ({projects.length})
            </button>
            <button
              type="button"
              onClick={() => setSubTab("passport")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 ${
                subTab === "passport"
                  ? "bg-cream-50 dark:bg-pine-900 text-ochre-600 dark:text-ochre-400 shadow-xs"
                  : "text-[#45554e] dark:text-[#869b92]"
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Digital Skill Passport
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-300 font-medium"
        >
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-4 animate-pulse">
          <div className="h-44 bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl" />
          <div className="h-44 bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl" />
        </div>
      ) : subTab === "portfolio" ? (
        <div className="space-y-6">
          {isOwner && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowForm((v) => !v)}
                className="px-4 py-2.5 bg-pine-700 hover:bg-pine-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                {showForm ? "Close Project Form" : "Add Project to Portfolio (+60 XP)"}
              </button>
            </div>
          )}

          {showForm && isOwner && (
            <form
              onSubmit={handleCreateProject}
              className="bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl p-6 space-y-4"
            >
              <h2 className="text-base font-bold text-[#14211d] dark:text-cream-50">
                Log New Project Artifact
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1">Project Title</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Campus Placement Portal"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-sage-300 dark:border-pine-700 bg-white dark:bg-pine-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Project Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as "completed" | "in_progress")}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-sage-300 dark:border-pine-700 bg-white dark:bg-pine-950"
                  >
                    <option value="completed">Completed</option>
                    <option value="in_progress">In Progress</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">GitHub Repo URL</label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={repoUrl}
                      onChange={(e) => setRepoUrl(e.target.value)}
                      placeholder="https://github.com/user/repo"
                      className="flex-1 px-3 py-2 text-sm rounded-lg border border-sage-300 dark:border-pine-700 bg-white dark:bg-pine-950"
                    />
                    <button
                      type="button"
                      disabled={fetchingGithub || !repoUrl.trim()}
                      onClick={handleLookupGithub}
                      className="px-3 py-2 text-xs font-semibold rounded-lg border border-sage-300 dark:border-pine-700 hover:border-pine-600 whitespace-nowrap"
                    >
                      {fetchingGithub ? "..." : "Fetch Stars"}
                    </button>
                  </div>
                  {githubMetaNote && (
                    <p className="text-[11px] text-pine-700 dark:text-[#6ec4b0] mt-1">
                      {githubMetaNote}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">Deployed Live URL</label>
                  <input
                    type="url"
                    value={liveUrl}
                    onChange={(e) => setLiveUrl(e.target.value)}
                    placeholder="https://demo.example.com"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-sage-300 dark:border-pine-700 bg-white dark:bg-pine-950"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold mb-1">
                    Architecture & Impact Summary
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    placeholder="Explain what problem it solves, tech stack, and measurable impact..."
                    className="w-full px-3 py-2 text-sm rounded-lg border border-sage-300 dark:border-pine-700 bg-white dark:bg-pine-950"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Attach Report / Screenshot / PDF (Optional)
                  </label>
                  <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-sage-300 dark:border-pine-700 cursor-pointer text-xs text-[#45554e] dark:text-[#c5d4cd]">
                    <Upload className="w-4 h-4 text-pine-700" />
                    <span className="truncate">{attachmentName || "Choose PDF or PNG/JPG"}</span>
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg,.md,.txt"
                      className="hidden"
                      onChange={(e) => handleAttachmentChange(e.target.files?.[0] || null)}
                    />
                  </label>
                </div>

                <div className="flex items-end pb-2">
                  <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasTests}
                      onChange={(e) => setHasTests(e.target.checked)}
                      className="rounded border-sage-300 text-pine-700"
                    />
                    Includes automated unit/integration tests
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold">
                  Verified Tech & Domain Skills ({techStack.length} selected)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 max-h-48 overflow-y-auto p-2 border border-sage-200 dark:border-pine-800 rounded-lg">
                  {SKILL_CATEGORIES.flatMap((c) => c.skills).map((sk) => {
                    const active = techStack.includes(sk);
                    return (
                      <button
                        key={sk}
                        type="button"
                        onClick={() => toggleSkill(sk)}
                        className={`px-2.5 py-1.5 rounded-md border text-[11px] font-medium flex items-center justify-between gap-1 ${
                          active
                            ? "bg-pine-700 text-white border-pine-700"
                            : "bg-sage-50 dark:bg-pine-950 text-[#2c3d37] dark:text-[#c5d4cd] border-sage-200 dark:border-pine-800"
                        }`}
                      >
                        <span className="truncate">{SKILL_LABELS[sk]}</span>
                        {active && <Check className="w-3 h-3 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 bg-pine-700 hover:bg-pine-800 disabled:opacity-60 text-white text-xs font-semibold rounded-lg"
                >
                  {saving ? "Saving Project..." : "Save Project Artifact"}
                </button>
              </div>
            </form>
          )}

          {projects.length === 0 ? (
            <div className="bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl p-8 text-center text-xs text-[#56665f] dark:text-[#869b92]">
              No projects logged yet. Add a project to automatically verify skills on your Digital
              Skill Passport.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {projects.map((proj) => (
                <div
                  key={proj.project_id}
                  className="bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl p-5 flex flex-col justify-between gap-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-base font-bold text-[#14211d] dark:text-cream-50">
                          {proj.title}
                        </h3>
                        <div className="text-[11px] text-[#56665f] dark:text-[#869b92] capitalize">
                          Status: {(proj.status || "completed").replace("_", " ")}
                          {proj.has_tests ? " · Tests Verified" : ""}
                          {(proj.github_stars ?? 0) > 0 ? ` · ${proj.github_stars} GitHub Stars` : ""}
                        </div>
                      </div>
                      {isOwner && (
                        <button
                          type="button"
                          onClick={() => handleDelete(proj.project_id)}
                          aria-label={`Delete ${proj.title}`}
                          className="p-1.5 text-[#869b92] hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-[#45554e] dark:text-[#c5d4cd] leading-relaxed">
                      {proj.summary}
                    </p>
                  </div>

                  <div className="space-y-2 pt-3 border-t border-sage-200/70 dark:border-pine-800 text-xs">
                    <div className="text-[11px] text-[#56665f] dark:text-[#869b92]">
                      {proj.tech_stack.map((k) => SKILL_LABELS[k] || k).join(" · ")}
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      {proj.repo_url && (
                        <a
                          href={proj.repo_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-pine-700 dark:text-[#6ec4b0] font-semibold hover:underline inline-flex items-center gap-1"
                        >
                          <GitBranch className="w-3.5 h-3.5" />
                          GitHub
                          {(proj.github_stars ?? 0) > 0 && (
                            <span className="inline-flex items-center gap-0.5 font-mono">
                              <Star className="w-3 h-3" />
                              {proj.github_stars}
                            </span>
                          )}
                        </a>
                      )}
                      {proj.live_url && (
                        <a
                          href={proj.live_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-ochre-600 dark:text-ochre-400 font-semibold hover:underline inline-flex items-center gap-1"
                        >
                          Live Demo
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      {proj.attachment_path && (
                        <a
                          href={getFileDownloadUrl(proj.attachment_path)}
                          className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline inline-flex items-center gap-1"
                        >
                          <FileDown className="w-3.5 h-3.5" />
                          {proj.attachment_name || "Download Report"}
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        passport && (
          <div className="space-y-6">
            {/* Digital Skill Passport Header */}
            <section className="bg-gradient-to-r from-pine-800 via-pine-700 to-pine-600 rounded-2xl p-6 sm:p-8 text-white flex flex-wrap items-center justify-between gap-6">
              <div className="space-y-2 max-w-2xl">
                <div className="text-xs font-semibold uppercase tracking-wider text-cream-100">
                  Verified StudentPulse AI Digital Skill Passport
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold">
                  {passport.profile.display_name}
                </h2>
                <p className="text-sm text-cream-100">
                  {passport.profile.branch || "CSE"} · Semester {passport.profile.semester} · CGPA{" "}
                  <span className="font-mono font-bold text-white">
                    {passport.profile.cgpa.toFixed(2)}
                  </span>{" "}
                  · Track:{" "}
                  <strong className="text-white">
                    {CAREER_ROLE_LABELS[passport.profile.target_role]?.label ||
                      passport.profile.target_role}
                  </strong>
                </p>
              </div>

              <div className="flex flex-col items-end gap-3">
                <div className="bg-white/10 backdrop-blur border border-white/20 rounded-xl px-5 py-3 text-right">
                  <div className="text-xs text-cream-100">Readiness · Level {passport.level}</div>
                  <div className="text-3xl font-bold font-mono tabular-nums">
                    {passport.readiness_score}/100
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleCopyShareLink}
                    className="px-3.5 py-2 bg-white/15 hover:bg-white/25 border border-white/25 rounded-lg text-xs font-semibold flex items-center gap-1.5"
                  >
                    {copiedLink ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
                    {copiedLink ? "Link Copied!" : "Copy Share Link"}
                    {!copiedLink && <Copy className="w-3 h-3 opacity-80" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => exportPassportAsPdf(passport)}
                    className="px-3.5 py-2 bg-white text-pine-800 hover:bg-cream-100 rounded-lg text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download PDF Passport
                  </button>
                </div>
              </div>
            </section>

            {/* Verified vs Self-Reported Skills */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <section className="bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-[#14211d] dark:text-cream-50 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    Assessment & Project Verified Skills ({passport.verified_skills.length})
                  </h3>
                </div>
                {passport.verified_skills.length === 0 ? (
                  <p className="text-xs text-[#56665f] dark:text-[#869b92]">
                    Complete a Smart Assessment or log a Project to earn verified skills.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {passport.verified_skills.map((s) => (
                      <div key={s.skill_key} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-[#1f2f29] dark:text-[#dbe6e0]">
                            {s.label}
                          </span>
                          <span className="font-mono tabular-nums text-emerald-600 dark:text-emerald-400 font-semibold">
                            {s.proficiency}% · {s.source.replace("_", " ")}
                          </span>
                        </div>
                        <div className="h-2 bg-cream-100 dark:bg-pine-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-600 rounded-full"
                            style={{ width: `${s.proficiency}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl p-6 space-y-4">
                <h3 className="text-base font-bold text-[#14211d] dark:text-cream-50">
                  Self-Reported Proficiencies ({passport.self_reported_skills.length})
                </h3>
                {passport.self_reported_skills.length === 0 ? (
                  <p className="text-xs text-[#56665f] dark:text-[#869b92]">
                    All logged skills are verified or pending update in the AI Skill Gap Analyzer.
                  </p>
                ) : (
                  <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                    {passport.self_reported_skills.map((s) => (
                      <div key={s.skill_key} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-[#2c3d37] dark:text-[#c5d4cd]">
                            {s.label}
                          </span>
                          <span className="font-mono tabular-nums text-pine-700 dark:text-[#6ec4b0] font-semibold">
                            {s.proficiency}%
                          </span>
                        </div>
                        <div className="h-1.5 bg-cream-100 dark:bg-pine-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-pine-700 rounded-full"
                            style={{ width: `${s.proficiency}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            {/* Badges, Assessments & Projects Summary */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <section className="bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl p-5 space-y-3">
                <h3 className="text-sm font-bold text-[#14211d] dark:text-cream-50 flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-500" />
                  Unlocked Badges
                </h3>
                <div className="space-y-2">
                  {passport.badges.filter((b) => b.unlocked).length === 0 ? (
                    <p className="text-xs text-[#56665f]">No badges unlocked yet.</p>
                  ) : (
                    passport.badges
                      .filter((b) => b.unlocked)
                      .map((b) => (
                        <div
                          key={b.id}
                          className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 text-xs"
                        >
                          <div className="font-bold text-[#14211d] dark:text-cream-50">{b.name}</div>
                          <div className="text-[11px] text-[#45554e] dark:text-[#869b92]">
                            {b.description}
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </section>

              <section className="bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl p-5 space-y-3">
                <h3 className="text-sm font-bold text-[#14211d] dark:text-cream-50">
                  Assessments ({passport.assessments.length})
                </h3>
                <div className="space-y-2">
                  {passport.assessments.slice(0, 5).map((a) => (
                    <div
                      key={a.result_id}
                      className="flex items-center justify-between text-xs p-2.5 rounded-lg border border-sage-200 dark:border-pine-800"
                    >
                      <span className="font-medium truncate">{a.assessment_title}</span>
                      <span className="font-mono font-bold text-pine-700 dark:text-[#6ec4b0]">
                        {a.score_pct}%
                      </span>
                    </div>
                  ))}
                  {passport.assessments.length === 0 && (
                    <p className="text-xs text-[#56665f]">No assessments recorded.</p>
                  )}
                </div>
              </section>

              <section className="bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl p-5 space-y-3">
                <h3 className="text-sm font-bold text-[#14211d] dark:text-cream-50">
                  Completed Courses ({passport.completed_courses.length})
                </h3>
                <div className="space-y-2">
                  {passport.completed_courses.map((c) => (
                    <div
                      key={c.course_id}
                      className="p-2.5 rounded-lg border border-sage-200 dark:border-pine-800 text-xs"
                    >
                      <div className="font-semibold text-[#14211d] dark:text-cream-50">{c.title}</div>
                      <div className="text-[11px] text-[#56665f]">{c.provider}</div>
                    </div>
                  ))}
                  {passport.completed_courses.length === 0 && (
                    <p className="text-xs text-[#56665f]">No completed courses yet.</p>
                  )}
                </div>
              </section>
            </div>
          </div>
        )
      )}
    </div>
  );
}
