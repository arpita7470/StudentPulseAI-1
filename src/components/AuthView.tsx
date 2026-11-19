import { useEffect, useState, type FormEvent } from "react";
import {
  CheckCircle2,
  KeyRound,
  LogIn,
  Save,
  Shield,
  UserPlus,
  Users,
} from "lucide-react";
import {
  BRANCH_OPTIONS,
  CAREER_ROLE_LABELS,
  type CareerRole,
  type StudentProfile,
} from "../types/studentpulse";
import { ApiError, forgotPasswordReset } from "../lib/api";

interface AuthViewProps {
  profiles: StudentProfile[];
  activeProfile: StudentProfile | null;
  isSignedIn: boolean;
  onSelectProfile: (profile: StudentProfile) => Promise<void>;
  onSignIn: (payload: { email: string; password: string }) => Promise<void>;
  onSignUp: (payload: {
    display_name: string;
    email: string;
    password: string;
    branch: string;
    role: "student" | "faculty";
    target_role: CareerRole;
    semester: number;
    cgpa: number;
  }) => Promise<void>;
  onSignOut: () => void;
  onUpdateProfile: (
    userId: number,
    payload: {
      display_name: string;
      target_role: CareerRole;
      semester: number;
      cgpa: number;
      branch?: string;
      bio?: string;
      github_username?: string;
      linkedin_url?: string;
    }
  ) => Promise<void>;
  onGoToDashboard: () => void;
}

const ROLE_KEYS = Object.keys(CAREER_ROLE_LABELS) as CareerRole[];

const DEMO_CREDENTIALS = [
  { label: "Ananya Sharma (Student · AI/ML)", email: "ananya@kiet.edu", pass: "student123" },
  { label: "Kabir Verma (Student · Full-Stack)", email: "kabir@kiet.edu", pass: "student123" },
  { label: "Dr. Arvind Mehta (Faculty Mentor)", email: "prof.mehta@kiet.edu", pass: "faculty123" },
  { label: "Placement Cell Admin (Admin)", email: "admin@kiet.edu", pass: "admin123" },
];

export function AuthView({
  profiles,
  activeProfile,
  isSignedIn,
  onSelectProfile,
  onSignIn,
  onSignUp,
  onSignOut,
  onUpdateProfile,
  onGoToDashboard,
}: AuthViewProps) {
  const [authTab, setAuthTab] = useState<"signin" | "signup" | "forgot">("signin");

  // Sign-In state
  const [loginEmail, setLoginEmail] = useState("ananya@kiet.edu");
  const [loginPassword, setLoginPassword] = useState("student123");

  // Sign-Up state
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regBranch, setRegBranch] = useState<string>("CSE");
  const [regRoleType, setRegRoleType] = useState<"student" | "faculty">("student");
  const [regTargetRole, setRegTargetRole] = useState<CareerRole>("fullstack_dev");
  const [regSemester, setRegSemester] = useState("6");
  const [regCgpa, setRegCgpa] = useState("8.2");

  // Forgot Password state
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotNewPass, setForgotNewPass] = useState("");

  // Profile Edit state
  const [editName, setEditName] = useState("");
  const [editBranch, setEditBranch] = useState("CSE");
  const [editTargetRole, setEditTargetRole] = useState<CareerRole>("fullstack_dev");
  const [editSem, setEditSem] = useState("6");
  const [editCgpa, setEditCgpa] = useState("8.0");
  const [editBio, setEditBio] = useState("");
  const [editGithub, setEditGithub] = useState("");
  const [editLinkedin, setEditLinkedin] = useState("");

  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (activeProfile) {
      setEditName(activeProfile.display_name);
      setEditBranch(activeProfile.branch || "CSE");
      setEditTargetRole(activeProfile.target_role);
      setEditSem(String(activeProfile.semester));
      setEditCgpa(String(activeProfile.cgpa));
      setEditBio(activeProfile.bio || "");
      setEditGithub(activeProfile.github_username || "");
      setEditLinkedin(activeProfile.linkedin_url || "");
    }
  }, [activeProfile?.user_id]);

  async function handleSignInSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      await onSignIn({ email: loginEmail.trim(), password: loginPassword });
      setStatusMsg("Signed in successfully.");
      onGoToDashboard();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fieldErrors);
        setErrorMsg(err.message);
      } else {
        setErrorMsg(err instanceof Error ? err.message : "Sign in failed.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleDemoSignIn(email: string, pass: string) {
    setBusy(true);
    setErrors({});
    setErrorMsg(null);
    try {
      await onSignIn({ email, password: pass });
      setStatusMsg(`Signed in as ${email}`);
      onGoToDashboard();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Demo login failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSignUpSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      await onSignUp({
        display_name: regName.trim(),
        email: regEmail.trim(),
        password: regPassword,
        branch: regBranch,
        role: regRoleType,
        target_role: regTargetRole,
        semester: Number(regSemester),
        cgpa: Number(regCgpa),
      });
      setStatusMsg("Account created and signed in!");
      onGoToDashboard();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fieldErrors);
        setErrorMsg(err.message);
      } else {
        setErrorMsg(err instanceof Error ? err.message : "Registration failed.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleForgotSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      const res = await forgotPasswordReset({
        email: forgotEmail.trim(),
        new_password: forgotNewPass,
      });
      setStatusMsg(res.message);
      setLoginEmail(forgotEmail.trim());
      setLoginPassword(forgotNewPass);
      setAuthTab("signin");
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fieldErrors);
        setErrorMsg(err.message);
      } else {
        setErrorMsg(err instanceof Error ? err.message : "Password reset failed.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveProfile(e: FormEvent) {
    e.preventDefault();
    if (!activeProfile) return;
    setBusy(true);
    setErrors({});
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      await onUpdateProfile(activeProfile.user_id, {
        display_name: editName.trim(),
        branch: editBranch,
        target_role: editTargetRole,
        semester: Number(editSem),
        cgpa: Number(editCgpa),
        bio: editBio.trim(),
        github_username: editGithub.trim(),
        linkedin_url: editLinkedin.trim(),
      });
      setStatusMsg("Profile details updated in SQLite.");
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fieldErrors);
        setErrorMsg(err.message);
      } else {
        setErrorMsg(err instanceof Error ? err.message : "Update failed.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl overflow-hidden border border-[#dfd0b4] dark:border-pine-800 shadow-[0_6px_24px_-12px_rgba(15,76,69,0.2)] grid grid-cols-1 md:grid-cols-12">
        <div className="md:col-span-8 bg-[#f3ead3] dark:bg-pine-900 p-6 sm:p-8 space-y-2">
          <div className="text-xs font-semibold text-pine-700 dark:text-[#f0b78e]">
            StudentPulse AI · Identity, Roles &amp; Profile Management
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-pine-700 dark:text-cream-50">
            Sign In, Register, or Manage Your Academic Profile
          </h1>
          <p className="text-sm text-[#2d443f] dark:text-[#b7c7c0] leading-relaxed">
            Role-based access across Student, Faculty Mentor, and Placement Admin portals with
            PBKDF2 password security and instant profile switching.
          </p>
        </div>
        <div className="md:col-span-4 bg-gradient-to-b from-[#faedda] via-[#b5cabd] to-[#69897e] dark:from-[#12332e] dark:to-[#081714] p-6 flex flex-col justify-center gap-2 border-t md:border-t-0 md:border-l border-[#dfd0b4] dark:border-pine-800">
          <div className="bg-[#0f4c45]/95 dark:bg-pine-900/95 border border-[#2a6b62] rounded-xl p-4 text-[#faf2e3] space-y-1">
            <div className="text-[11px] font-semibold text-[#f0b78e]">
              KIET University Cohort
            </div>
            <div className="text-base font-bold">
              3 Portals · 1 Unified Platform
            </div>
            <p className="text-[11px] text-[#d7e5da]">
              Students · Faculty Mentors · Placement Admins
            </p>
          </div>
        </div>
      </div>

      {statusMsg && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-200 flex items-center gap-2 font-medium">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{statusMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-300 font-medium">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Auth Tabs (Sign In / Sign Up / Forgot Password) */}
        <section className="lg:col-span-6 bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl p-6 space-y-5">
          <div className="inline-flex p-1 bg-cream-100 dark:bg-pine-800 rounded-lg gap-1">
            <button
              type="button"
              onClick={() => setAuthTab("signin")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 ${
                authTab === "signin"
                  ? "bg-cream-50 dark:bg-pine-900 text-pine-700 dark:text-[#6ec4b0] shadow-xs"
                  : "text-[#45554e] dark:text-[#869b92]"
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setAuthTab("signup")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 ${
                authTab === "signup"
                  ? "bg-cream-50 dark:bg-pine-900 text-pine-700 dark:text-[#6ec4b0] shadow-xs"
                  : "text-[#45554e] dark:text-[#869b92]"
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              Sign Up
            </button>
            <button
              type="button"
              onClick={() => setAuthTab("forgot")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 ${
                authTab === "forgot"
                  ? "bg-cream-50 dark:bg-pine-900 text-pine-700 dark:text-[#6ec4b0] shadow-xs"
                  : "text-[#45554e] dark:text-[#869b92]"
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              Forgot Password
            </button>
          </div>

          {authTab === "signin" && (
            <form onSubmit={handleSignInSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5">Registered Email</label>
                <input
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="name@kiet.edu"
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-sage-300 dark:border-pine-700 bg-white dark:bg-pine-950"
                />
                {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5">Password</label>
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-sage-300 dark:border-pine-700 bg-white dark:bg-pine-950"
                />
                {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
              </div>
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setAuthTab("forgot")}
                  className="text-xs font-medium text-pine-700 dark:text-[#6ec4b0] hover:underline"
                >
                  Forgot your password?
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-5 py-2.5 bg-pine-700 hover:bg-pine-800 disabled:opacity-60 text-white text-sm font-semibold rounded-lg"
                >
                  {busy ? "Signing In..." : "Sign In"}
                </button>
              </div>
            </form>
          )}

          {authTab === "signup" && (
            <form onSubmit={handleSignUpSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="e.g., Rohan Verma"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-sage-300 dark:border-pine-700 bg-white dark:bg-pine-950"
                  />
                  {errors.display_name && (
                    <p className="text-xs text-red-500 mt-1">{errors.display_name}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="rohan@kiet.edu"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-sage-300 dark:border-pine-700 bg-white dark:bg-pine-950"
                  />
                  {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Password (6+ chars)</label>
                  <input
                    type="password"
                    required
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-sage-300 dark:border-pine-700 bg-white dark:bg-pine-950"
                  />
                  {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Account Role</label>
                  <select
                    value={regRoleType}
                    onChange={(e) => setRegRoleType(e.target.value as "student" | "faculty")}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-sage-300 dark:border-pine-700 bg-white dark:bg-pine-950"
                  >
                    <option value="student">Student</option>
                    <option value="faculty">Faculty Mentor</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Department / Branch</label>
                  <select
                    value={regBranch}
                    onChange={(e) => setRegBranch(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-sage-300 dark:border-pine-700 bg-white dark:bg-pine-950"
                  >
                    {BRANCH_OPTIONS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Target Career Track</label>
                  <select
                    value={regTargetRole}
                    onChange={(e) => setRegTargetRole(e.target.value as CareerRole)}
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
                  <label className="block text-xs font-semibold mb-1">Semester (1–8)</label>
                  <input
                    type="number"
                    min={1}
                    max={8}
                    value={regSemester}
                    onChange={(e) => setRegSemester(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-sage-300 dark:border-pine-700 bg-white dark:bg-pine-950 tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">CGPA (0–10)</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    max={10}
                    value={regCgpa}
                    onChange={(e) => setRegCgpa(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-sage-300 dark:border-pine-700 bg-white dark:bg-pine-950 tabular-nums"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={busy}
                className="w-full py-2.5 bg-pine-700 hover:bg-pine-800 disabled:opacity-60 text-white text-sm font-semibold rounded-lg"
              >
                {busy ? "Creating Account..." : "Create Account & Enter Workspace"}
              </button>
            </form>
          )}

          {authTab === "forgot" && (
            <form onSubmit={handleForgotSubmit} className="space-y-4">
              <p className="text-xs text-[#45554e] dark:text-[#869b92]">
                Enter your registered account email and choose a new password (minimum 6
                characters).
              </p>
              <div>
                <label className="block text-xs font-semibold mb-1">Registered Email</label>
                <input
                  type="email"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="ananya@kiet.edu"
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-sage-300 dark:border-pine-700 bg-white dark:bg-pine-950"
                />
                {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">New Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={forgotNewPass}
                  onChange={(e) => setForgotNewPass(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-sage-300 dark:border-pine-700 bg-white dark:bg-pine-950"
                />
                {errors.new_password && (
                  <p className="text-xs text-red-500 mt-1">{errors.new_password}</p>
                )}
              </div>
              <button
                type="submit"
                disabled={busy}
                className="w-full py-2.5 bg-pine-600 hover:bg-pine-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg"
              >
                {busy ? "Updating Password..." : "Reset Password"}
              </button>
            </form>
          )}

          {/* Quick Demo Accounts */}
          <div className="pt-4 border-t border-sage-200 dark:border-pine-800 space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#2c3d37] dark:text-[#c5d4cd]">
              <Shield className="w-3.5 h-3.5 text-ochre-600 dark:text-ochre-400" />
              1-Click Role Demo Sign-In (Student / Faculty / Admin)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {DEMO_CREDENTIALS.map((demo) => (
                <button
                  key={demo.email}
                  type="button"
                  disabled={busy}
                  onClick={() => handleDemoSignIn(demo.email, demo.pass)}
                  className="p-2.5 rounded-lg border border-sage-200 dark:border-pine-700 hover:border-pine-600 text-left bg-sage-50 dark:bg-pine-950 transition-colors"
                >
                  <div className="text-xs font-semibold text-[#14211d] dark:text-cream-50 truncate">
                    {demo.label}
                  </div>
                  <div className="text-[11px] font-mono text-[#56665f] dark:text-[#869b92] truncate mt-0.5">
                    {demo.email}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Right: Active Profile Editor + Quick Profile Switcher */}
        <section className="lg:col-span-6 space-y-6">
          {activeProfile && (
            <form
              onSubmit={handleSaveProfile}
              className="bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl p-6 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sage-200 dark:border-pine-800 pb-3">
                <div>
                  <h2 className="text-base font-bold text-[#14211d] dark:text-cream-50">
                    Profile Settings · {activeProfile.display_name}
                  </h2>
                  <div className="text-xs text-[#56665f] dark:text-[#869b92] capitalize">
                    Role: {activeProfile.role || "student"} · {isSignedIn ? "Signed In" : "Preview"}
                  </div>
                </div>
                {isSignedIn && (
                  <button
                    type="button"
                    onClick={onSignOut}
                    className="px-3 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30"
                  >
                    Sign Out
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold mb-1">Display Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-sage-300 dark:border-pine-700 bg-white dark:bg-pine-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Department</label>
                  <select
                    value={editBranch}
                    onChange={(e) => setEditBranch(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-sage-300 dark:border-pine-700 bg-white dark:bg-pine-950"
                  >
                    {BRANCH_OPTIONS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Target Role</label>
                  <select
                    value={editTargetRole}
                    onChange={(e) => setEditTargetRole(e.target.value as CareerRole)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-sage-300 dark:border-pine-700 bg-white dark:bg-pine-950"
                  >
                    {ROLE_KEYS.map((rk) => (
                      <option key={rk} value={rk}>
                        {CAREER_ROLE_LABELS[rk].label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold mb-1">Semester</label>
                    <input
                      type="number"
                      min={1}
                      max={8}
                      value={editSem}
                      onChange={(e) => setEditSem(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-sage-300 dark:border-pine-700 bg-white dark:bg-pine-950 tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">CGPA</label>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      max={10}
                      value={editCgpa}
                      onChange={(e) => setEditCgpa(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-sage-300 dark:border-pine-700 bg-white dark:bg-pine-950 tabular-nums"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">GitHub Username</label>
                  <input
                    type="text"
                    value={editGithub}
                    onChange={(e) => setEditGithub(e.target.value)}
                    placeholder="octocat"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-sage-300 dark:border-pine-700 bg-white dark:bg-pine-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">LinkedIn URL</label>
                  <input
                    type="url"
                    value={editLinkedin}
                    onChange={(e) => setEditLinkedin(e.target.value)}
                    placeholder="https://linkedin.com/in/..."
                    className="w-full px-3 py-2 text-sm rounded-lg border border-sage-300 dark:border-pine-700 bg-white dark:bg-pine-950"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold mb-1">Short Career Bio</label>
                  <textarea
                    rows={2}
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    placeholder="Highlight your focus areas and career interests..."
                    className="w-full px-3 py-2 text-sm rounded-lg border border-sage-300 dark:border-pine-700 bg-white dark:bg-pine-950"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-2 bg-pine-700 hover:bg-pine-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  Save Profile Changes
                </button>
              </div>
            </form>
          )}

          {/* Switch Active Workspace Account */}
          <div className="bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl p-6 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-[#14211d] dark:text-cream-50">
              <Users className="w-4 h-4 text-pine-700 dark:text-[#6ec4b0]" />
              Registered Workspace Accounts ({profiles.length})
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto">
              {profiles.map((p) => {
                const active = activeProfile?.user_id === p.user_id;
                return (
                  <button
                    key={p.user_id}
                    type="button"
                    onClick={() => onSelectProfile(p)}
                    className={`p-3 rounded-lg border text-left transition-colors ${
                      active
                        ? "border-pine-700 bg-cream-100 dark:bg-pine-950/40"
                        : "border-sage-200 dark:border-pine-800 hover:border-pine-500"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-[#14211d] dark:text-cream-50 truncate">
                        {p.display_name}
                      </span>
                      <span className="text-[10px] font-mono uppercase text-ochre-600 dark:text-ochre-400">
                        {p.role || "student"}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#56665f] dark:text-[#869b92] truncate mt-0.5">
                      {p.branch || "CSE"} · Sem {p.semester} · CGPA {p.cgpa.toFixed(1)}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
