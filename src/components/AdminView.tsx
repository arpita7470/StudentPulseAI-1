import { useEffect, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  BarChart3,
  Briefcase,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Plus,
  Save,
  Settings2,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  adminUpdateUser,
  createCourse,
  createJobOpportunity,
  fetchAdminOverview,
  updateAdminSettings,
} from "../lib/api";
import { exportAdminReportAsCsv, exportAdminReportAsPdf } from "../lib/pdfExport";
import {
  BRANCH_OPTIONS,
  CAREER_ROLE_LABELS,
  SKILL_CATEGORIES,
  SKILL_LABELS,
  type AdminOverviewData,
  type CareerRole,
  type SkillKey,
  type StudentProfile,
  type UserRole,
} from "../types/studentpulse";

interface AdminViewProps {
  activeProfile: StudentProfile;
}

const ROLE_KEYS = Object.keys(CAREER_ROLE_LABELS) as CareerRole[];

export function AdminView({ activeProfile }: AdminViewProps) {
  const [data, setData] = useState<AdminOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Settings form
  const [passingScore, setPassingScore] = useState("65");
  const [institutionName, setInstitutionName] = useState("KIET University");
  const [savingSettings, setSavingSettings] = useState(false);

  // Quick Add Course / Job toggles
  const [showAddCourse, setShowAddCourse] = useState(false);
  const [courseTitle, setCourseTitle] = useState("");
  const [courseProvider, setCourseProvider] = useState("");
  const [courseUrl, setCourseUrl] = useState("");
  const [courseRole, setCourseRole] = useState<CareerRole>("fullstack_dev");
  const [courseHours, setCourseHours] = useState("8");
  const [courseSkills, setCourseSkills] = useState<SkillKey[]>(["js_ts", "react_ui"]);

  const [showAddJob, setShowAddJob] = useState(false);
  const [jobTitle, setJobTitle] = useState("");
  const [jobCompany, setJobCompany] = useState("");
  const [jobLocation, setJobLocation] = useState("Bengaluru / Hybrid");
  const [jobComp, setJobComp] = useState("8–12 LPA");
  const [jobRole, setJobRole] = useState<CareerRole>("fullstack_dev");
  const [jobSkills, setJobSkills] = useState<SkillKey[]>(["js_ts", "react_ui", "sql_db"]);
  const [jobDesc, setJobDesc] = useState("");

  async function loadOverview() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAdminOverview();
      setData(res);
      setPassingScore(res.settings?.passing_readiness_threshold || "65");
      setInstitutionName(res.settings?.institution_name || "KIET University");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Admin overview requires an admin account."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOverview();
  }, [activeProfile.user_id]);

  async function handleUpdateUserRow(
    userId: number,
    nextRole: UserRole,
    nextBranch: string,
    nextActive: boolean
  ) {
    setError(null);
    setStatusMsg(null);
    try {
      await adminUpdateUser(userId, {
        role: nextRole,
        branch: nextBranch,
        is_active: nextActive,
      });
      setStatusMsg("User permissions updated.");
      await loadOverview();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update user.");
    }
  }

  async function handleSaveSettings(e: FormEvent) {
    e.preventDefault();
    setSavingSettings(true);
    setError(null);
    setStatusMsg(null);
    try {
      await updateAdminSettings({
        passing_readiness_threshold: passingScore,
        institution_name: institutionName,
      });
      setStatusMsg("Platform settings saved.");
      await loadOverview();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save settings.");
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleCreateCourse(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createCourse({
        title: courseTitle.trim(),
        provider: courseProvider.trim(),
        category: "technical",
        target_role: courseRole,
        duration_hours: Number(courseHours) || 8,
        resource_url: courseUrl.trim(),
        skill_keys: courseSkills,
      });
      setCourseTitle("");
      setCourseProvider("");
      setCourseUrl("");
      setShowAddCourse(false);
      setStatusMsg("New course published to Roadmap & Courses.");
      await loadOverview();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add course.");
    }
  }

  async function handleCreateJob(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createJobOpportunity({
        title: jobTitle.trim(),
        company: jobCompany.trim(),
        location: jobLocation.trim(),
        work_mode: "Hybrid",
        job_type: "Campus Placement",
        compensation: jobComp.trim(),
        target_role: jobRole,
        required_skills: jobSkills,
        description: jobDesc.trim(),
      });
      setJobTitle("");
      setJobCompany("");
      setJobDesc("");
      setShowAddJob(false);
      setStatusMsg("Campus placement opportunity posted to Job & Campus Feed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not post job.");
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs text-[#56665f] dark:text-[#869b92]">
            Admin Control Center · Platform Analytics, Users & Reports
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#14211d] dark:text-cream-50 mt-0.5">
            Institution Readiness & Operations
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => exportAdminReportAsPdf(data)}
            className="px-3.5 py-2 bg-pine-700 hover:bg-pine-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Export PDF Report
          </button>
          <button
            type="button"
            onClick={() => exportAdminReportAsCsv(data)}
            className="px-3.5 py-2 bg-cream-50 dark:bg-pine-900 border border-sage-300 dark:border-pine-700 text-xs font-semibold rounded-lg flex items-center gap-1.5"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            Export Excel CSV
          </button>
          <button
            type="button"
            onClick={() => setShowAddCourse((v) => !v)}
            className="px-3.5 py-2 bg-pine-600 hover:bg-pine-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Course
          </button>
          <button
            type="button"
            onClick={() => setShowAddJob((v) => !v)}
            className="px-3.5 py-2 bg-pine-900 dark:bg-pine-800 hover:bg-pine-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5"
          >
            <Briefcase className="w-3.5 h-3.5" />
            Post Campus Job
          </button>
        </div>
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

      {/* Add Course Modal/Form */}
      {showAddCourse && (
        <form
          onSubmit={handleCreateCourse}
          className="bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl p-5 space-y-4"
        >
          <h2 className="text-sm font-bold">Add Learning Course</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <input
              type="text"
              required
              value={courseTitle}
              onChange={(e) => setCourseTitle(e.target.value)}
              placeholder="Course title"
              className="px-3 py-2 text-xs rounded-lg border border-sage-300 dark:border-pine-700 bg-white dark:bg-pine-950"
            />
            <input
              type="text"
              required
              value={courseProvider}
              onChange={(e) => setCourseProvider(e.target.value)}
              placeholder="Provider (e.g., NPTEL)"
              className="px-3 py-2 text-xs rounded-lg border border-sage-300 dark:border-pine-700 bg-white dark:bg-pine-950"
            />
            <input
              type="url"
              required
              value={courseUrl}
              onChange={(e) => setCourseUrl(e.target.value)}
              placeholder="https://course-url"
              className="px-3 py-2 text-xs rounded-lg border border-sage-300 dark:border-pine-700 bg-white dark:bg-pine-950"
            />
            <select
              value={courseRole}
              onChange={(e) => setCourseRole(e.target.value as CareerRole)}
              className="px-3 py-2 text-xs rounded-lg border border-sage-300 dark:border-pine-700 bg-white dark:bg-pine-950"
            >
              {ROLE_KEYS.map((rk) => (
                <option key={rk} value={rk}>
                  {CAREER_ROLE_LABELS[rk].label}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              max={100}
              value={courseHours}
              onChange={(e) => setCourseHours(e.target.value)}
              placeholder="Hours"
              className="px-3 py-2 text-xs rounded-lg border border-sage-300 dark:border-pine-700 bg-white dark:bg-pine-950"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SKILL_CATEGORIES.flatMap((c) => c.skills)
              .slice(0, 10)
              .map((sk) => (
                <button
                  key={sk}
                  type="button"
                  onClick={() =>
                    setCourseSkills((p) =>
                      p.includes(sk) ? p.filter((x) => x !== sk) : [...p, sk]
                    )
                  }
                  className={`px-2 py-1 text-[11px] rounded border ${
                    courseSkills.includes(sk)
                      ? "bg-pine-700 text-white border-pine-700"
                      : "border-sage-300 dark:border-pine-700"
                  }`}
                >
                  {SKILL_LABELS[sk]}
                </button>
              ))}
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 bg-pine-700 text-white text-xs font-semibold rounded-lg"
            >
              Publish Course
            </button>
          </div>
        </form>
      )}

      {/* Post Campus Job Form */}
      {showAddJob && (
        <form
          onSubmit={handleCreateJob}
          className="bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl p-5 space-y-4"
        >
          <h2 className="text-sm font-bold">Post Campus Placement / Internship</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <input
              type="text"
              required
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="Role title (e.g., SDE Intern)"
              className="px-3 py-2 text-xs rounded-lg border border-sage-300 dark:border-pine-700 bg-white dark:bg-pine-950"
            />
            <input
              type="text"
              required
              value={jobCompany}
              onChange={(e) => setJobCompany(e.target.value)}
              placeholder="Company name"
              className="px-3 py-2 text-xs rounded-lg border border-sage-300 dark:border-pine-700 bg-white dark:bg-pine-950"
            />
            <input
              type="text"
              required
              value={jobLocation}
              onChange={(e) => setJobLocation(e.target.value)}
              placeholder="Location"
              className="px-3 py-2 text-xs rounded-lg border border-sage-300 dark:border-pine-700 bg-white dark:bg-pine-950"
            />
            <input
              type="text"
              required
              value={jobComp}
              onChange={(e) => setJobComp(e.target.value)}
              placeholder="Compensation"
              className="px-3 py-2 text-xs rounded-lg border border-sage-300 dark:border-pine-700 bg-white dark:bg-pine-950"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select
              value={jobRole}
              onChange={(e) => setJobRole(e.target.value as CareerRole)}
              className="px-3 py-2 text-xs rounded-lg border border-sage-300 dark:border-pine-700 bg-white dark:bg-pine-950"
            >
              {ROLE_KEYS.map((rk) => (
                <option key={rk} value={rk}>
                  {CAREER_ROLE_LABELS[rk].label}
                </option>
              ))}
            </select>
            <input
              type="text"
              required
              value={jobDesc}
              onChange={(e) => setJobDesc(e.target.value)}
              placeholder="Eligibility & key responsibilities..."
              className="sm:col-span-2 px-3 py-2 text-xs rounded-lg border border-sage-300 dark:border-pine-700 bg-white dark:bg-pine-950"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SKILL_CATEGORIES.flatMap((c) => c.skills)
              .slice(0, 12)
              .map((sk) => (
                <button
                  key={sk}
                  type="button"
                  onClick={() =>
                    setJobSkills((p) =>
                      p.includes(sk) ? p.filter((x) => x !== sk) : [...p, sk]
                    )
                  }
                  className={`px-2 py-1 text-[11px] rounded border ${
                    jobSkills.includes(sk)
                      ? "bg-pine-700 text-white border-pine-700"
                      : "border-sage-300 dark:border-pine-700"
                  }`}
                >
                  {SKILL_LABELS[sk]}
                </button>
              ))}
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 bg-pine-700 text-white text-xs font-semibold rounded-lg"
            >
              Publish Opportunity
            </button>
          </div>
        </form>
      )}

      {/* Platform KPI Row */}
      <section className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl p-4">
          <div className="text-xs text-[#56665f]">Total Users</div>
          <div className="text-2xl font-bold font-mono tabular-nums mt-1">
            {data.totals.total_users}
          </div>
        </div>
        <div className="bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl p-4">
          <div className="text-xs text-[#56665f]">Students</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-pine-700 mt-1">
            {data.totals.students}
          </div>
        </div>
        <div className="bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl p-4">
          <div className="text-xs text-[#56665f]">Avg Readiness</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-emerald-600 mt-1">
            {data.totals.avg_readiness}/100
          </div>
        </div>
        <div className="bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl p-4">
          <div className="text-xs text-[#56665f]">At-Risk Students</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-amber-600 mt-1">
            {data.totals.at_risk_students}
          </div>
        </div>
        <div className="bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl p-4">
          <div className="text-xs text-[#56665f]">Assessments</div>
          <div className="text-2xl font-bold font-mono tabular-nums mt-1">
            {data.totals.assessments}
          </div>
        </div>
        <div className="bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl p-4">
          <div className="text-xs text-[#56665f]">Courses</div>
          <div className="text-2xl font-bold font-mono tabular-nums mt-1">
            {data.totals.courses}
          </div>
        </div>
      </section>

      {/* Department Analytics Chart + At-Risk & Settings */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-7 bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-pine-700" />
            <h2 className="text-sm font-bold text-[#14211d] dark:text-cream-50">
              Department Readiness Analytics
            </h2>
          </div>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.department_analytics}>
                <CartesianGrid strokeDasharray="3 3" stroke="#93af9e" opacity={0.35} />
                <XAxis dataKey="department" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="avg_readiness" name="Avg Readiness" fill="#0f4c45" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="lg:col-span-5 space-y-5">
          <div className="bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-[#14211d] dark:text-cream-50">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              At-Risk Students ({data.at_risk_students.length})
            </div>
            {data.at_risk_students.length === 0 ? (
              <p className="text-xs text-[#56665f]">All students meet passing readiness threshold.</p>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {data.at_risk_students.map((s) => (
                  <div
                    key={s.user_id}
                    className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-[#14211d] dark:text-cream-50">
                        {s.display_name}
                      </div>
                      <div className="text-[11px] text-[#56665f]">
                        {s.branch} · {s.skill_gaps.length} skill gaps
                      </div>
                    </div>
                    <span className="font-mono font-bold text-amber-700 dark:text-amber-400">
                      {s.readiness_score}/100
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <form
            onSubmit={handleSaveSettings}
            className="bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl p-5 space-y-3"
          >
            <div className="flex items-center gap-2 text-sm font-bold text-[#14211d] dark:text-cream-50">
              <Settings2 className="w-4 h-4 text-ochre-600" />
              Platform Threshold Settings
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold mb-1">Institution</label>
                <input
                  type="text"
                  value={institutionName}
                  onChange={(e) => setInstitutionName(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-sage-300 dark:border-pine-700 bg-white dark:bg-pine-950"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold mb-1">Passing Readiness</label>
                <input
                  type="number"
                  min={30}
                  max={95}
                  value={passingScore}
                  onChange={(e) => setPassingScore(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-sage-300 dark:border-pine-700 bg-white dark:bg-pine-950 tabular-nums"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={savingSettings}
              className="w-full py-2 bg-pine-600 hover:bg-pine-700 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              {savingSettings ? "Saving..." : "Save Settings"}
            </button>
          </form>
        </section>
      </div>

      {/* User Role & Access Management Table */}
      <section className="bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-sage-200 dark:border-pine-800 flex items-center gap-2">
          <Users className="w-4 h-4 text-pine-700" />
          <h2 className="text-sm font-bold text-[#14211d] dark:text-cream-50">
            User Accounts & Role-Based Access ({data.users.length})
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-sage-50 dark:bg-pine-950 border-b border-sage-200 dark:border-pine-800 text-[11px] font-semibold text-[#56665f]">
                <th className="py-2.5 px-4">User</th>
                <th className="py-2.5 px-3">Role</th>
                <th className="py-2.5 px-3">Branch</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-4 text-right">XP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sage-200/70 dark:divide-pine-800">
              {data.users.map((u) => {
                const role = (u.role || "student") as UserRole;
                const branch = u.branch || "CSE";
                const isActive = u.is_active !== false;
                return (
                  <tr key={u.user_id}>
                    <td className="py-2.5 px-4">
                      <div className="font-semibold text-[#14211d] dark:text-cream-50">
                        {u.display_name}
                      </div>
                      <div className="text-[11px] text-[#56665f] font-mono">{u.email}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <select
                        value={role}
                        aria-label={`Role for ${u.display_name}`}
                        onChange={(e) =>
                          handleUpdateUserRow(
                            u.user_id,
                            e.target.value as UserRole,
                            branch,
                            isActive
                          )
                        }
                        className="px-2 py-1 text-xs rounded border border-sage-300 dark:border-pine-700 bg-white dark:bg-pine-950"
                      >
                        <option value="student">student</option>
                        <option value="faculty">faculty</option>
                        <option value="admin">admin</option>
                      </select>
                    </td>
                    <td className="py-2.5 px-3">
                      <select
                        value={branch}
                        aria-label={`Branch for ${u.display_name}`}
                        onChange={(e) =>
                          handleUpdateUserRow(u.user_id, role, e.target.value, isActive)
                        }
                        className="px-2 py-1 text-xs rounded border border-sage-300 dark:border-pine-700 bg-white dark:bg-pine-950"
                      >
                        {BRANCH_OPTIONS.map((b) => (
                          <option key={b} value={b}>
                            {b}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2.5 px-3">
                      <button
                        type="button"
                        onClick={() => handleUpdateUserRow(u.user_id, role, branch, !isActive)}
                        className={`px-2.5 py-1 rounded text-[11px] font-semibold ${
                          isActive
                            ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300"
                            : "bg-sage-200 dark:bg-pine-800 text-[#45554e]"
                        }`}
                      >
                        {isActive ? "Active" : "Paused"}
                      </button>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold">
                      {u.xp_points ?? 0}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
