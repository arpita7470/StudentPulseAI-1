import { useEffect, useState } from "react";
import {
  Bookmark,
  Briefcase,
  CheckCircle2,
  ExternalLink,
  MapPin,
  PlusCircle,
  Search,
} from "lucide-react";
import { createTask, fetchJobs, setJobStatus } from "../lib/api";
import {
  CAREER_ROLE_LABELS,
  SKILL_LABELS,
  type AppTab,
  type JobOpportunity,
  type StudentProfile,
} from "../types/studentpulse";

interface JobsFeedViewProps {
  activeProfile: StudentProfile;
  onNavigate: (tab: AppTab) => void;
  onXpUpdated: () => void;
}

export function JobsFeedView({ activeProfile, onNavigate, onXpUpdated }: JobsFeedViewProps) {
  const [jobs, setJobs] = useState<JobOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modeFilter, setModeFilter] = useState<string>("all");
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchJobs(activeProfile.user_id)
      .then(setJobs)
      .catch(() => setJobs([]))
      .finally(() => setLoading(false));
  }, [activeProfile.user_id]);

  async function handleStatusChange(
    jobId: number,
    status: "none" | "saved" | "applied" | "interviewing"
  ) {
    try {
      await setJobStatus(jobId, activeProfile.user_id, status);
      setJobs((prev) =>
        prev.map((j) => (j.job_id === jobId ? { ...j, application_status: status } : j))
      );
      if (status === "applied") onXpUpdated();
    } catch {
      // ignore
    }
  }

  async function handleBridgeMissingSkills(job: JobOpportunity) {
    if (job.missing_skills.length === 0) return;
    try {
      const topSkills = job.missing_skills.slice(0, 2);
      for (const sk of topSkills) {
        await createTask({
          user_id: activeProfile.user_id,
          title: `Learn ${SKILL_LABELS[sk] || sk} for ${job.company}`,
          category: "Career Prep",
          priority: "high",
        });
      }
      setNotice(
        `Added ${topSkills.length} targeted study task(s) to Daily Targets & Notes for ${job.title}.`
      );
    } catch {
      // ignore
    }
  }

  const filtered = jobs.filter((j) => {
    if (modeFilter !== "all" && j.work_mode.toLowerCase() !== modeFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      j.title.toLowerCase().includes(q) ||
      j.company.toLowerCase().includes(q) ||
      j.description.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs font-medium text-pine-700 dark:text-[#6ec4b0]">
            Campus Drives & Curated Opportunities · Live Skill Compatibility Matching
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#14211d] dark:text-cream-50 mt-1">
            Job Updates & Placement Feed
          </h1>
        </div>
      </div>

      {notice && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-200 flex items-center justify-between gap-3">
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => onNavigate("tasks_notes")}
            className="font-semibold underline shrink-0"
          >
            Open Daily Targets
          </button>
        </div>
      )}

      {/* Search & Work Mode Filters */}
      <div className="bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-[#869b92] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search role, company, or stack..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-sage-300 dark:border-pine-700 bg-white dark:bg-pine-950"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
          {(["all", "remote", "hybrid", "on-site"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setModeFilter(m)}
              className={`px-3 py-1.5 rounded-lg border capitalize ${
                modeFilter === m
                  ? "bg-pine-700 text-white border-pine-700"
                  : "border-sage-200 dark:border-pine-700 text-[#45554e] dark:text-[#c5d4cd]"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="h-44 animate-pulse bg-cream-100 dark:bg-pine-800 rounded-xl" />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {filtered.map((job) => (
            <article
              key={job.job_id}
              className="bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl p-5 flex flex-col justify-between gap-4"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold text-ochre-600 dark:text-ochre-400">
                      {job.is_sample ? "Curated Sample Feed" : "Campus Placement Drive"} ·{" "}
                      {job.posted_at}
                    </div>
                    <h2 className="text-base font-bold text-[#14211d] dark:text-cream-50 mt-0.5">
                      {job.title}
                    </h2>
                    <div className="text-xs font-semibold text-[#2c3d37] dark:text-[#c5d4cd]">
                      {job.company} · {job.compensation}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-xl font-bold font-mono tabular-nums text-pine-700 dark:text-[#6ec4b0]">
                      {job.compatibility_score}%
                    </div>
                    <div className="text-[11px] text-[#56665f]">Skill Match</div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs text-[#56665f] dark:text-[#869b92]">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {job.location}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Briefcase className="w-3.5 h-3.5" />
                    {job.job_type}
                  </span>
                  <span>
                    Track: {CAREER_ROLE_LABELS[job.target_role]?.label || job.target_role}
                  </span>
                </div>

                <p className="text-xs text-[#45554e] dark:text-[#c5d4cd] leading-relaxed">
                  {job.description}
                </p>

                <div className="space-y-1 text-[11px] pt-1">
                  <div>
                    <strong className="text-emerald-600 dark:text-emerald-400">Matched: </strong>
                    {job.matched_skills.length > 0
                      ? job.matched_skills.map((s) => SKILL_LABELS[s] || s).join(", ")
                      : "None yet"}
                  </div>
                  {job.missing_skills.length > 0 && (
                    <div>
                      <strong className="text-amber-600 dark:text-amber-400">To Learn: </strong>
                      {job.missing_skills.map((s) => SKILL_LABELS[s] || s).join(", ")}
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-sage-200 dark:border-pine-800 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      handleStatusChange(
                        job.job_id,
                        job.application_status === "saved" ? "none" : "saved"
                      )
                    }
                    className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 ${
                      job.application_status === "saved"
                        ? "bg-cream-100 dark:bg-pine-950/50 border-pine-600 text-pine-800 dark:text-[#9bd8c9]"
                        : "border-sage-200 dark:border-pine-700 text-[#2c3d37] dark:text-[#dbe6e0]"
                    }`}
                  >
                    <Bookmark className="w-3.5 h-3.5" />
                    {job.application_status === "saved" ? "Saved" : "Save"}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleStatusChange(
                        job.job_id,
                        job.application_status === "applied" ? "interviewing" : "applied"
                      )
                    }
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 ${
                      job.application_status === "applied" ||
                      job.application_status === "interviewing"
                        ? "bg-emerald-600 text-white"
                        : "bg-pine-700 hover:bg-pine-800 text-white"
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {job.application_status === "interviewing"
                      ? "Interviewing"
                      : job.application_status === "applied"
                      ? "Applied (+15 XP)"
                      : "Mark Applied"}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {job.missing_skills.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleBridgeMissingSkills(job)}
                      className="px-2.5 py-1.5 rounded-lg border border-cream-200 dark:border-pine-700 text-ochre-600 dark:text-ochre-400 text-xs font-semibold flex items-center gap-1 hover:bg-cream-100 dark:hover:bg-pine-950/30"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      Bridge Gaps
                    </button>
                  )}
                  {job.apply_url && (
                    <a
                      href={job.apply_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-semibold text-[#45554e] dark:text-[#c5d4cd] hover:text-pine-700 inline-flex items-center gap-1"
                    >
                      Details
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
