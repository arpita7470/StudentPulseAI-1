import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock,
  Download,
  PlayCircle,
  Search,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { fetchReadinessTrend } from "../lib/api";
import {
  CAREER_ROLE_LABELS,
  type ActionStatus,
  type CompletionRecord,
  type ReadinessTrendPoint,
  type StudentProfile,
} from "../types/studentpulse";

interface HistoryViewProps {
  activeProfile: StudentProfile | null;
  history: CompletionRecord[];
  loading: boolean;
  justLoggedBanner: boolean;
  onDismissBanner: () => void;
  onStartNewAssessment: () => void;
}

function formatShortDate(dateStr: string): string {
  const parts = dateStr.split(" ")[0]?.split("-");
  if (parts && parts.length === 3) {
    return `${parts[1]}/${parts[2]}`;
  }
  return dateStr.slice(0, 10);
}

function ReadinessTrendChart({
  trend,
  studentName,
}: {
  trend: ReadinessTrendPoint[];
  studentName: string;
}) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  useEffect(() => {
    setSelectedIndex(trend.length > 0 ? trend.length - 1 : null);
  }, [trend.length]);

  const width = 680;
  const height = 220;
  const padLeft = 40;
  const padRight = 24;
  const padTop = 18;
  const padBottom = 34;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const getX = (index: number) => {
    if (trend.length <= 1) return padLeft + chartW / 2;
    return padLeft + (index / (trend.length - 1)) * chartW;
  };
  const getY = (score: number) => {
    const clamped = Math.max(0, Math.min(100, score));
    return padTop + ((100 - clamped) / 100) * chartH;
  };

  const buildPolyline = (selector: (pt: ReadinessTrendPoint) => number) =>
    trend.map((pt, idx) => `${getX(idx).toFixed(1)},${getY(selector(pt)).toFixed(1)}`).join(" ");

  const activePoint =
    selectedIndex !== null && trend[selectedIndex]
      ? trend[selectedIndex]
      : trend[trend.length - 1] ?? null;

  const firstScore = trend[0]?.computed_readiness ?? 0;
  const latestScore = trend[trend.length - 1]?.computed_readiness ?? 0;
  const delta = latestScore - firstScore;

  return (
    <section className="bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-pine-700 dark:text-[#6ec4b0]" />
            <h2 className="text-base font-bold text-[#14211d] dark:text-cream-50">
              Longitudinal Readiness Progression · {studentName}
            </h2>
          </div>
          <p className="text-xs text-[#56665f] dark:text-[#869b92] mt-1">
            Tracks `computed_readiness` alongside assessment, coding, and interview scores across
            stored SQLite `evidence_snapshot` checkpoints.
          </p>
        </div>

        {trend.length >= 2 && (
          <div className="text-right">
            <div className="text-xs text-[#56665f] dark:text-[#869b92]">Net Growth</div>
            <div
              className={`text-lg font-bold font-mono tabular-nums ${
                delta >= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-amber-600 dark:text-amber-400"
              }`}
            >
              {delta >= 0 ? `+${delta}` : delta} pts
            </div>
          </div>
        )}
      </div>

      {trend.length === 0 ? (
        <div className="p-6 bg-sage-50 dark:bg-pine-950 border border-sage-200 dark:border-pine-800 rounded-lg text-center text-xs text-[#56665f] dark:text-[#869b92]">
          No `evidence_snapshot` checkpoints logged yet for {studentName}. Run an analysis to plot
          the first data point.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
          <div className="lg:col-span-8">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="w-full h-auto select-none"
              role="img"
              aria-label={`Readiness progression chart for ${studentName}`}
            >
              {[0, 25, 50, 75, 100].map((tick) => {
                const y = getY(tick);
                return (
                  <g key={tick}>
                    <line
                      x1={padLeft}
                      y1={y}
                      x2={width - padRight}
                      y2={y}
                      stroke="currentColor"
                      className="text-[#dbe6e0] dark:text-[#1f2f29]"
                      strokeWidth="1"
                      strokeDasharray={tick === 0 ? undefined : "3 3"}
                    />
                    <text
                      x={padLeft - 8}
                      y={y + 3.5}
                      textAnchor="end"
                      className="fill-[#56665f] dark:fill-[#869b92] text-[10px] font-mono tabular-nums"
                    >
                      {tick}
                    </text>
                  </g>
                );
              })}

              <line
                x1={padLeft}
                y1={getY(80)}
                x2={width - padRight}
                y2={getY(80)}
                stroke="#d98254"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              <text
                x={width - padRight}
                y={getY(80) - 4}
                textAnchor="end"
                className="fill-ochre-500 dark:fill-ochre-400 text-[9px] font-mono"
              >
                80 Placement Target
              </text>

              {trend.length > 1 && (
                <>
                  <polyline
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="1.5"
                    strokeOpacity="0.85"
                    points={buildPolyline((p) => p.assessment_score)}
                  />
                  <polyline
                    fill="none"
                    stroke="#d98254"
                    strokeWidth="1.5"
                    strokeOpacity="0.85"
                    points={buildPolyline((p) => p.coding_score)}
                  />
                  <polyline
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="1.5"
                    strokeOpacity="0.85"
                    points={buildPolyline((p) => p.interview_score)}
                  />
                  <polyline
                    fill="none"
                    stroke="#0f4c45"
                    strokeWidth="2.75"
                    points={buildPolyline((p) => p.computed_readiness)}
                  />
                </>
              )}

              {trend.map((pt, idx) => {
                const cx = getX(idx);
                const isSelected = idx === selectedIndex;
                return (
                  <g
                    key={pt.snapshot_id}
                    className="cursor-pointer"
                    onClick={() => setSelectedIndex(idx)}
                  >
                    <circle cx={cx} cy={getY(pt.assessment_score)} r="3" fill="#10b981" />
                    <circle cx={cx} cy={getY(pt.coding_score)} r="3" fill="#d98254" />
                    <circle cx={cx} cy={getY(pt.interview_score)} r="3" fill="#f59e0b" />
                    <circle
                      cx={cx}
                      cy={getY(pt.computed_readiness)}
                      r={isSelected ? "6" : "4.5"}
                      fill="#0f4c45"
                      stroke="#ffffff"
                      strokeWidth="2"
                    />
                    <text
                      x={cx}
                      y={height - 10}
                      textAnchor="middle"
                      className={`text-[10px] font-mono ${
                        isSelected
                          ? "fill-pine-700 dark:fill-[#6ec4b0] font-semibold"
                          : "fill-[#56665f] dark:fill-[#869b92]"
                      }`}
                    >
                      #{pt.snapshot_id} ({formatShortDate(pt.created_at)})
                    </text>
                  </g>
                );
              })}
            </svg>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-[#45554e] dark:text-[#869b92] mt-1">
              <span className="inline-flex items-center gap-1.5 font-semibold text-pine-700 dark:text-[#6ec4b0]">
                <span className="w-3 h-0.5 bg-pine-700 inline-block" />
                Overall Readiness
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-emerald-500 inline-block" />
                Assessments
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-pine-600 inline-block" />
                Coding
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-amber-500 inline-block" />
                Interview
              </span>
            </div>
          </div>

          {activePoint && (
            <div className="lg:col-span-4 border border-sage-200 dark:border-pine-800 rounded-lg p-4 bg-sage-50 dark:bg-pine-950 space-y-3">
              <div className="flex items-center justify-between border-b border-sage-200 dark:border-pine-800 pb-2">
                <span className="text-xs font-semibold text-[#14211d] dark:text-cream-50">
                  Checkpoint #{activePoint.snapshot_id}
                </span>
                <span className="text-[11px] font-mono text-[#56665f] dark:text-[#869b92]">
                  {activePoint.created_at}
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-[#45554e] dark:text-[#c5d4cd]">Overall Readiness</span>
                <span className="text-2xl font-bold font-mono tabular-nums text-pine-700 dark:text-[#6ec4b0]">
                  {activePoint.computed_readiness}/100
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                <div>
                  <span className="text-[#56665f] dark:text-[#869b92]">Assessments</span>
                  <div className="font-mono tabular-nums font-semibold text-[#14211d] dark:text-cream-50">
                    {activePoint.assessment_score}%
                  </div>
                </div>
                <div>
                  <span className="text-[#56665f] dark:text-[#869b92]">Coding</span>
                  <div className="font-mono tabular-nums font-semibold text-[#14211d] dark:text-cream-50">
                    {activePoint.coding_score}%
                  </div>
                </div>
                <div>
                  <span className="text-[#56665f] dark:text-[#869b92]">Interview</span>
                  <div className="font-mono tabular-nums font-semibold text-[#14211d] dark:text-cream-50">
                    {activePoint.interview_score}%
                  </div>
                </div>
                <div>
                  <span className="text-[#56665f] dark:text-[#869b92]">Projects</span>
                  <div className="font-mono tabular-nums font-semibold text-[#14211d] dark:text-cream-50">
                    {activePoint.project_count} built
                  </div>
                </div>
              </div>
              {trend.length === 1 && (
                <p className="text-[11px] text-[#56665f] dark:text-[#869b92] pt-1 border-t border-sage-200 dark:border-pine-800">
                  Submit a new evidence check after completing action steps to plot your growth
                  trajectory.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export function HistoryView({
  activeProfile,
  history,
  loading,
  justLoggedBanner,
  onDismissBanner,
  onStartNewAssessment,
}: HistoryViewProps) {
  const [scope, setScope] = useState<"active" | "all">("active");
  const [statusFilter, setStatusFilter] = useState<"all" | ActionStatus>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [trend, setTrend] = useState<ReadinessTrendPoint[]>([]);
  const [trendLoading, setTrendLoading] = useState(false);

  useEffect(() => {
    if (!activeProfile) {
      setTrend([]);
      return;
    }
    let cancelled = false;
    setTrendLoading(true);
    fetchReadinessTrend(activeProfile.user_id)
      .then((points) => {
        if (!cancelled) setTrend(points);
      })
      .catch(() => {
        if (!cancelled) setTrend([]);
      })
      .finally(() => {
        if (!cancelled) setTrendLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeProfile?.user_id, history.length]);

  const scopedRows = useMemo(() => {
    return history.filter((row) => {
      if (scope === "active" && activeProfile && row.user_id !== activeProfile.user_id) {
        return false;
      }
      if (statusFilter !== "all" && row.status !== statusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          row.title.toLowerCase().includes(q) ||
          row.display_name.toLowerCase().includes(q) ||
          row.notes.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [history, scope, activeProfile, statusFilter, searchQuery]);

  const metrics = useMemo(() => {
    const base =
      scope === "active" && activeProfile
        ? history.filter((h) => h.user_id === activeProfile.user_id)
        : history;
    const total = base.length;
    const completed = base.filter((h) => h.status === "completed").length;
    const avgReadiness =
      total > 0
        ? Math.round(base.reduce((acc, r) => acc + r.computed_readiness, 0) / total)
        : 0;
    const hours = base
      .filter((h) => h.status !== "skipped")
      .reduce((acc, row) => acc + row.total_hours, 0);
    return { total, completed, avgReadiness, hours };
  }, [history, scope, activeProfile]);

  function handleExportCsv() {
    const header = [
      "completion_id",
      "student",
      "target_role",
      "plan_title",
      "status",
      "computed_readiness",
      "total_hours",
      "completed_at",
      "notes",
    ];
    const escapeCsv = (val: string | number) => `"${String(val).replace(/"/g, '""')}"`;
    const rows = scopedRows.map((row) =>
      [
        row.completion_id,
        row.display_name,
        CAREER_ROLE_LABELS[row.target_role]?.label || row.target_role,
        row.title,
        row.status,
        row.computed_readiness,
        row.total_hours,
        row.completed_at,
        row.notes,
      ]
        .map(escapeCsv)
        .join(",")
    );
    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `studentpulse-history-${activeProfile?.display_name.replace(/[^a-zA-Z0-9_-]/g, "_") || "all"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs text-[#56665f] dark:text-[#869b92]">
            SQLite Progress Ledger · Longitudinal Student Readiness Tracking
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#14211d] dark:text-cream-50 mt-1">
            Readiness & Action Plan History
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {scopedRows.length > 0 && (
            <button
              type="button"
              onClick={handleExportCsv}
              className="px-3.5 py-2.5 bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-700 hover:border-pine-600 text-[#1f2f29] dark:text-[#dbe6e0] text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
          )}
          <button
            type="button"
            onClick={onStartNewAssessment}
            className="px-4 py-2.5 bg-pine-700 hover:bg-pine-800 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap"
          >
            Run New Readiness Check
          </button>
        </div>
      </div>

      {justLoggedBanner && (
        <div
          role="status"
          className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-2.5 text-sm font-medium text-emerald-900 dark:text-emerald-200">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>
              Action plan progress recorded in SQLite (`readiness_completion` table).
            </span>
          </div>
          <button
            type="button"
            onClick={onDismissBanner}
            className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:underline shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl p-5">
          <div className="text-xs text-[#56665f] dark:text-[#869b92]">Plans Tracked</div>
          <div className="text-3xl font-bold font-mono tabular-nums text-[#14211d] dark:text-cream-50 mt-1">
            {metrics.total}
          </div>
          <div className="text-xs text-[#45554e] dark:text-[#869b92] mt-1">
            {metrics.completed} completed
          </div>
        </div>

        <div className="bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl p-5">
          <div className="text-xs text-[#56665f] dark:text-[#869b92]">Average Readiness Score</div>
          <div className="text-3xl font-bold font-mono tabular-nums text-pine-700 dark:text-[#6ec4b0] mt-1">
            {metrics.avgReadiness}/100
          </div>
          <div className="text-xs text-[#45554e] dark:text-[#869b92] mt-1">
            Weighted across 4 readiness pillars
          </div>
        </div>

        <div className="bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl p-5">
          <div className="text-xs text-[#56665f] dark:text-[#869b92]">Prep Hours Committed</div>
          <div className="text-3xl font-bold font-mono tabular-nums text-[#14211d] dark:text-cream-50 mt-1">
            {metrics.hours} hrs
          </div>
          <div className="text-xs text-[#45554e] dark:text-[#869b92] mt-1">
            Excludes skipped action plans
          </div>
        </div>
      </div>

      {activeProfile && !trendLoading && (
        <ReadinessTrendChart trend={trend} studentName={activeProfile.display_name} />
      )}

      <div className="bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-sage-200 dark:border-pine-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-1 p-1 bg-cream-100 dark:bg-pine-800 rounded-lg">
              <button
                type="button"
                onClick={() => setScope("active")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  scope === "active"
                    ? "bg-cream-50 dark:bg-pine-900 text-pine-700 dark:text-[#6ec4b0] shadow-xs"
                    : "text-[#45554e] dark:text-[#869b92] hover:text-[#14211d]"
                }`}
              >
                {activeProfile ? activeProfile.display_name : "Active Student"}
              </button>
              <button
                type="button"
                onClick={() => setScope("all")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  scope === "all"
                    ? "bg-cream-50 dark:bg-pine-900 text-pine-700 dark:text-[#6ec4b0] shadow-xs"
                    : "text-[#45554e] dark:text-[#869b92] hover:text-[#14211d]"
                }`}
              >
                All Students
              </button>
            </div>

            <div className="inline-flex items-center gap-1 p-1 bg-cream-100 dark:bg-pine-800 rounded-lg">
              {(["all", "completed", "in_progress", "skipped"] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    statusFilter === st
                      ? "bg-cream-50 dark:bg-pine-900 text-pine-700 dark:text-[#6ec4b0] font-semibold shadow-xs"
                      : "text-[#45554e] dark:text-[#869b92] hover:text-[#14211d]"
                  }`}
                >
                  {st === "in_progress" ? "In Progress" : st.charAt(0).toUpperCase() + st.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-[#869b92] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search plan or note..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-sage-300 dark:border-pine-700 bg-white dark:bg-pine-950 focus:outline-none focus:ring-2 focus:ring-pine-600/20"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-6 space-y-3 animate-pulse">
            <div className="h-9 bg-cream-100 dark:bg-pine-800 rounded" />
            <div className="h-9 bg-cream-100 dark:bg-pine-800 rounded" />
          </div>
        ) : scopedRows.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <Clock className="w-8 h-8 text-[#c5d4cd] dark:text-[#45554e] mx-auto" />
            <div className="text-sm font-semibold text-[#14211d] dark:text-cream-50">
              No readiness logs found for this filter
            </div>
            <p className="text-xs text-[#56665f] dark:text-[#869b92] max-w-md mx-auto">
              Submit student evidence, review your generated action plan, and save your progress
              status to record your first milestone.
            </p>
            <button
              type="button"
              onClick={onStartNewAssessment}
              className="mt-2 px-4 py-2 bg-pine-700 hover:bg-pine-800 text-white text-xs font-semibold rounded-lg"
            >
              Analyze Readiness
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-sage-200 dark:border-pine-800 bg-sage-50 dark:bg-pine-950 text-[11px] font-semibold text-[#56665f] dark:text-[#869b92]">
                  <th className="py-2.5 px-4">Action Plan</th>
                  <th className="py-2.5 px-4">Student & Role</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Readiness</th>
                  <th className="py-2.5 px-4 text-right">Hours</th>
                  <th className="py-2.5 px-4 text-right">Logged (UTC)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sage-200/70 dark:divide-pine-800 text-xs">
                {scopedRows.map((row) => (
                  <tr
                    key={row.completion_id}
                    className="hover:bg-sage-50 dark:hover:bg-pine-800/40 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="font-semibold text-[#14211d] dark:text-cream-50">
                        {row.title}
                      </div>
                      {row.notes && (
                        <div className="text-[11px] text-[#56665f] dark:text-[#869b92] mt-0.5 line-clamp-1">
                          {row.notes}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-[#2c3d37] dark:text-[#c5d4cd] whitespace-nowrap">
                      <div>{row.display_name}</div>
                      <div className="text-[11px] text-[#56665f] dark:text-[#869b92]">
                        {CAREER_ROLE_LABELS[row.target_role]?.label || row.target_role}
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {row.status === "completed" && (
                        <span className="inline-flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Completed
                        </span>
                      )}
                      {row.status === "in_progress" && (
                        <span className="inline-flex items-center gap-1.5 font-medium text-amber-600 dark:text-amber-400">
                          <PlayCircle className="w-3.5 h-3.5" />
                          In Progress
                        </span>
                      )}
                      {row.status === "skipped" && (
                        <span className="inline-flex items-center gap-1.5 font-medium text-[#56665f]">
                          <XCircle className="w-3.5 h-3.5" />
                          Skipped
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-pine-700 dark:text-[#6ec4b0] whitespace-nowrap">
                      {row.computed_readiness}/100
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-[#14211d] dark:text-cream-50 whitespace-nowrap">
                      {row.total_hours} hrs
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-[#56665f] dark:text-[#869b92] whitespace-nowrap">
                      {row.completed_at}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
