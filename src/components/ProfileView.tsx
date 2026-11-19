import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Check, LogIn, LogOut, UserPlus } from "lucide-react";
import {
  BRANCH_OPTIONS,
  CAREER_ROLE_LABELS,
  type CareerRole,
  type RoleComparisonItem,
  type StudentProfile,
} from "../types/studentpulse";
import { ApiError, fetchRoleComparison } from "../lib/api";
import { SafeImage } from "./SafeImage";

interface ProfileViewProps {
  profiles: StudentProfile[];
  activeProfile: StudentProfile | null;
  isSignedIn: boolean;
  onSelectProfile: (profile: StudentProfile) => void;
  onSignIn: (payload: { email: string; password: string }) => Promise<void>;
  onSignUp: (payload: {
    display_name: string;
    email: string;
    password: string;
    branch: string;
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
    }
  ) => Promise<void>;
  onContinueToEvidence: () => void;
  onOpenReadinessPlan: () => void;
}

const ROLES = Object.keys(CAREER_ROLE_LABELS) as CareerRole[];

export function ProfileView({
  profiles,
  activeProfile,
  isSignedIn,
  onSelectProfile,
  onSignIn,
  onSignUp,
  onSignOut,
  onUpdateProfile,
  onContinueToEvidence,
  onOpenReadinessPlan,
}: ProfileViewProps) {
  const [mode, setMode] = useState<"signin" | "signup" | "profiles">(
    isSignedIn ? "profiles" : "signin"
  );

  // Sign In state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Sign Up state
  const [displayName, setDisplayName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [branch, setBranch] = useState<string>("CSE");
  const [targetRole, setTargetRole] = useState<CareerRole>("fullstack_dev");
  const [semester, setSemester] = useState("6");
  const [cgpa, setCgpa] = useState("8.2");

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [roleFit, setRoleFit] = useState<RoleComparisonItem[]>([]);
  const [hasSnapshot, setHasSnapshot] = useState(false);

  useEffect(() => {
    if (!activeProfile) {
      setRoleFit([]);
      return;
    }
    fetchRoleComparison(activeProfile.user_id)
      .then((res) => {
        setRoleFit(res.comparison);
        setHasSnapshot(res.has_snapshot);
      })
      .catch(() => setRoleFit([]));
  }, [activeProfile]);

  async function handleSignInSubmit(e: FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setGeneralError(null);
    setAuthMessage(null);

    const localErrors: Record<string, string> = {};
    if (!loginEmail.trim() || !loginEmail.includes("@")) {
      localErrors.email = "Enter a valid college email address.";
    }
    if (!loginPassword || loginPassword.length < 4) {
      localErrors.password = "Enter your password.";
    }
    if (Object.keys(localErrors).length > 0) {
      setFieldErrors(localErrors);
      return;
    }

    setSubmitting(true);
    try {
      await onSignIn({ email: loginEmail.trim(), password: loginPassword });
      setLoginPassword("");
      setAuthMessage("Signed in successfully.");
      setMode("profiles");
    } catch (err) {
      if (err instanceof ApiError) {
        setFieldErrors(err.fieldErrors);
        setGeneralError(err.message);
      } else {
        setGeneralError("Could not sign in. Please check your credentials.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDemoLogin(email: string) {
    setFieldErrors({});
    setGeneralError(null);
    setAuthMessage(null);
    setLoginEmail(email);
    setLoginPassword("student123");
    setSubmitting(true);
    try {
      await onSignIn({ email, password: "student123" });
      setLoginPassword("");
      setAuthMessage(`Signed in as ${email}.`);
      setMode("profiles");
    } catch (err) {
      setGeneralError(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSignUpSubmit(e: FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setGeneralError(null);
    setAuthMessage(null);

    const localErrors: Record<string, string> = {};
    if (!displayName.trim() || displayName.trim().length < 2) {
      localErrors.display_name = "Enter your full name (at least 2 characters).";
    }
    if (!signupEmail.trim() || !signupEmail.includes("@")) {
      localErrors.email = "Enter a valid email address (e.g., rohan@kiet.edu).";
    }
    if (!signupPassword || signupPassword.length < 6) {
      localErrors.password = "Password must be at least 6 characters.";
    }
    const semNum = Number(semester);
    if (!Number.isInteger(semNum) || semNum < 1 || semNum > 8) {
      localErrors.semester = "Semester must be between 1 and 8.";
    }
    const cgpaNum = Number(cgpa);
    if (Number.isNaN(cgpaNum) || cgpaNum < 0 || cgpaNum > 10) {
      localErrors.cgpa = "CGPA must be between 0.0 and 10.0.";
    }

    if (Object.keys(localErrors).length > 0) {
      setFieldErrors(localErrors);
      return;
    }

    setSubmitting(true);
    try {
      await onSignUp({
        display_name: displayName.trim(),
        email: signupEmail.trim(),
        password: signupPassword,
        branch,
        target_role: targetRole,
        semester: semNum,
        cgpa: cgpaNum,
      });
      setDisplayName("");
      setSignupEmail("");
      setSignupPassword("");
      setAuthMessage("Account created and signed in.");
      setMode("profiles");
    } catch (err) {
      if (err instanceof ApiError) {
        setFieldErrors(err.fieldErrors);
        setGeneralError(err.message);
      } else {
        setGeneralError("Could not create student account.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRoleUpdate(newRole: CareerRole) {
    if (!activeProfile) return;
    setGeneralError(null);
    try {
      await onUpdateProfile(activeProfile.user_id, {
        display_name: activeProfile.display_name,
        target_role: newRole,
        semester: activeProfile.semester,
        cgpa: activeProfile.cgpa,
        branch: activeProfile.branch,
      });
    } catch (err) {
      setGeneralError(err instanceof Error ? err.message : "Could not update career role.");
    }
  }

  return (
    <div className="space-y-8">
      {/* 2-Column Editorial Hero Split matching PPT Cover Slide */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 bg-[#FFFDF8] border border-[#D7DFD4] rounded-xl p-6 sm:p-8 flex flex-col justify-between gap-6">
          <div className="space-y-3">
            <p className="text-xs font-semibold text-[#16423C] tracking-wide">
              AI-Powered Student Success, Skill & Career Readiness Platform · KIET
            </p>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#102A26] [text-wrap:balance]">
              Connect assessments, projects, and multi-disciplinary skills into one roadmap.
            </h1>
            <p className="text-[15px] leading-relaxed text-[#3B5751] max-w-2xl">
              StudentPulse AI unifies academics, software & design skills, portfolio projects,
              and interview readiness across 7 career tracks. Sign in or register to track your
              progress and build your weekly action plan.
            </p>
          </div>

          <div className="space-y-5">
            {/* 3-Tab Sign In / Sign Up / Saved Profiles Switcher */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex items-center gap-1 p-1 bg-[#EBF1E8] rounded-lg">
                <button
                  type="button"
                  onClick={() => {
                    setMode("signin");
                    setFieldErrors({});
                    setGeneralError(null);
                  }}
                  className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                    mode === "signin"
                      ? "bg-[#FFFDF8] text-[#102A26] shadow-xs"
                      : "text-[#4D6862] hover:text-[#102A26]"
                  }`}
                >
                  <LogIn className="w-3.5 h-3.5" />
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("signup");
                    setFieldErrors({});
                    setGeneralError(null);
                  }}
                  className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                    mode === "signup"
                      ? "bg-[#FFFDF8] text-[#102A26] shadow-xs"
                      : "text-[#4D6862] hover:text-[#102A26]"
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Sign Up
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("profiles");
                    setFieldErrors({});
                    setGeneralError(null);
                  }}
                  className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                    mode === "profiles"
                      ? "bg-[#FFFDF8] text-[#102A26] shadow-xs"
                      : "text-[#4D6862] hover:text-[#102A26]"
                  }`}
                >
                  Student Workspace ({profiles.length})
                </button>
              </div>

              {isSignedIn && activeProfile && (
                <button
                  type="button"
                  onClick={() => {
                    onSignOut();
                    setAuthMessage("Signed out.");
                    setMode("signin");
                  }}
                  className="text-xs font-semibold text-[#4D6862] hover:text-[#102A26] inline-flex items-center gap-1.5"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign Out
                </button>
              )}
            </div>

            {authMessage && (
              <div
                role="status"
                className="p-3 bg-[#E6EEE7] border border-[#A5C0AE] rounded-lg text-xs text-[#102A26] font-medium"
              >
                {authMessage}
              </div>
            )}

            {generalError && (
              <div
                role="alert"
                className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 font-medium"
              >
                {generalError}
              </div>
            )}

            {mode === "signin" && (
              <form onSubmit={handleSignInSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="login-email"
                      className="block text-xs font-semibold text-[#102A26] mb-1.5"
                    >
                      College Email
                    </label>
                    <input
                      id="login-email"
                      type="email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="e.g., ananya@kiet.edu"
                      className={`w-full px-3.5 py-2.5 text-sm rounded-lg border bg-white focus:outline-none focus:ring-2 focus:ring-[#16423C]/20 ${
                        fieldErrors.email ? "border-red-500" : "border-[#C7D3C5]"
                      }`}
                    />
                    {fieldErrors.email && (
                      <p className="text-xs text-red-600 mt-1">{fieldErrors.email}</p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="login-password"
                      className="block text-xs font-semibold text-[#102A26] mb-1.5"
                    >
                      Password
                    </label>
                    <input
                      id="login-password"
                      type="password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Enter your password"
                      className={`w-full px-3.5 py-2.5 text-sm rounded-lg border bg-white focus:outline-none focus:ring-2 focus:ring-[#16423C]/20 ${
                        fieldErrors.password ? "border-red-500" : "border-[#C7D3C5]"
                      }`}
                    />
                    {fieldErrors.password && (
                      <p className="text-xs text-red-600 mt-1">{fieldErrors.password}</p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2.5 bg-[#16423C] hover:bg-[#0F302B] disabled:opacity-60 text-[#FFFDF8] text-sm font-semibold rounded-lg transition-colors whitespace-nowrap"
                  >
                    {submitting ? "Signing In..." : "Sign In"}
                  </button>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#4D6862]">
                    <span>Quick demo login:</span>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => handleDemoLogin("ananya@kiet.edu")}
                      className="px-2.5 py-1 bg-[#F5EFE0] hover:bg-[#E6EEE7] border border-[#D7DFD4] rounded-md font-medium text-[#102A26]"
                    >
                      Ananya (AI/ML)
                    </button>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => handleDemoLogin("kabir@kiet.edu")}
                      className="px-2.5 py-1 bg-[#F5EFE0] hover:bg-[#E6EEE7] border border-[#D7DFD4] rounded-md font-medium text-[#102A26]"
                    >
                      Kabir (Full-Stack)
                    </button>
                  </div>
                </div>

                <p className="text-[11px] text-[#5E7872]">
                  New student? Switch to <strong>Sign Up</strong> to register with your name,
                  email, branch, semester, and CGPA (demo password: <code>student123</code>).
                </p>
              </form>
            )}

            {mode === "signup" && (
              <form onSubmit={handleSignUpSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="signup-name"
                      className="block text-xs font-semibold text-[#102A26] mb-1.5"
                    >
                      Full Name
                    </label>
                    <input
                      id="signup-name"
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="e.g., Priya Verma"
                      className={`w-full px-3.5 py-2.5 text-sm rounded-lg border bg-white focus:outline-none focus:ring-2 focus:ring-[#16423C]/20 ${
                        fieldErrors.display_name ? "border-red-500" : "border-[#C7D3C5]"
                      }`}
                    />
                    {fieldErrors.display_name && (
                      <p className="text-xs text-red-600 mt-1">{fieldErrors.display_name}</p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="signup-email"
                      className="block text-xs font-semibold text-[#102A26] mb-1.5"
                    >
                      College Email
                    </label>
                    <input
                      id="signup-email"
                      type="email"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      placeholder="e.g., priya@kiet.edu"
                      className={`w-full px-3.5 py-2.5 text-sm rounded-lg border bg-white focus:outline-none focus:ring-2 focus:ring-[#16423C]/20 ${
                        fieldErrors.email ? "border-red-500" : "border-[#C7D3C5]"
                      }`}
                    />
                    {fieldErrors.email && (
                      <p className="text-xs text-red-600 mt-1">{fieldErrors.email}</p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="signup-password"
                      className="block text-xs font-semibold text-[#102A26] mb-1.5"
                    >
                      Create Password (6+ chars)
                    </label>
                    <input
                      id="signup-password"
                      type="password"
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      className={`w-full px-3.5 py-2.5 text-sm rounded-lg border bg-white focus:outline-none focus:ring-2 focus:ring-[#16423C]/20 ${
                        fieldErrors.password ? "border-red-500" : "border-[#C7D3C5]"
                      }`}
                    />
                    {fieldErrors.password && (
                      <p className="text-xs text-red-600 mt-1">{fieldErrors.password}</p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="signup-branch"
                      className="block text-xs font-semibold text-[#102A26] mb-1.5"
                    >
                      Branch / Department
                    </label>
                    <select
                      id="signup-branch"
                      value={branch}
                      onChange={(e) => setBranch(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-[#C7D3C5] bg-white focus:outline-none focus:ring-2 focus:ring-[#16423C]/20"
                    >
                      {BRANCH_OPTIONS.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="student-sem"
                      className="block text-xs font-semibold text-[#102A26] mb-1.5"
                    >
                      Current Semester (1–8)
                    </label>
                    <input
                      id="student-sem"
                      type="number"
                      min={1}
                      max={8}
                      value={semester}
                      onChange={(e) => setSemester(e.target.value)}
                      className={`w-full px-3.5 py-2.5 text-sm font-mono tabular-nums rounded-lg border bg-white focus:outline-none focus:ring-2 focus:ring-[#16423C]/20 ${
                        fieldErrors.semester ? "border-red-500" : "border-[#C7D3C5]"
                      }`}
                    />
                    {fieldErrors.semester && (
                      <p className="text-xs text-red-600 mt-1">{fieldErrors.semester}</p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="student-cgpa"
                      className="block text-xs font-semibold text-[#102A26] mb-1.5"
                    >
                      Current CGPA (0.0–10.0)
                    </label>
                    <input
                      id="student-cgpa"
                      type="number"
                      step="0.1"
                      min={0}
                      max={10}
                      value={cgpa}
                      onChange={(e) => setCgpa(e.target.value)}
                      className={`w-full px-3.5 py-2.5 text-sm font-mono tabular-nums rounded-lg border bg-white focus:outline-none focus:ring-2 focus:ring-[#16423C]/20 ${
                        fieldErrors.cgpa ? "border-red-500" : "border-[#C7D3C5]"
                      }`}
                    />
                    {fieldErrors.cgpa && (
                      <p className="text-xs text-red-600 mt-1">{fieldErrors.cgpa}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="student-role"
                    className="block text-xs font-semibold text-[#102A26] mb-1.5"
                  >
                    Target Career Role
                  </label>
                  <select
                    id="student-role"
                    value={targetRole}
                    onChange={(e) => setTargetRole(e.target.value as CareerRole)}
                    className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-[#C7D3C5] bg-white focus:outline-none focus:ring-2 focus:ring-[#16423C]/20"
                  >
                    {ROLES.map((rKey) => (
                      <option key={rKey} value={rKey}>
                        {CAREER_ROLE_LABELS[rKey].label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-[#5E7872] mt-1">
                    {CAREER_ROLE_LABELS[targetRole].summary}
                  </p>
                </div>

                <div className="pt-1 flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2.5 bg-[#16423C] hover:bg-[#0F302B] disabled:opacity-60 text-[#FFFDF8] text-sm font-semibold rounded-lg transition-colors whitespace-nowrap"
                  >
                    {submitting ? "Creating Account..." : "Create Account & Sign In"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("signin")}
                    className="px-4 py-2.5 text-sm font-medium text-[#4D6862] hover:text-[#102A26]"
                  >
                    Already registered? Sign In
                  </button>
                </div>
              </form>
            )}

            {mode === "profiles" && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {profiles.map((prof) => {
                    const selected = activeProfile?.user_id === prof.user_id;
                    return (
                      <button
                        key={prof.user_id}
                        type="button"
                        onClick={() => onSelectProfile(prof)}
                        className={`text-left p-4 rounded-lg border transition-colors flex items-start justify-between gap-3 ${
                          selected
                            ? "bg-[#E6EEE7] border-[#16423C]"
                            : "bg-[#FFFDF8] border-[#D7DFD4] hover:border-[#8FA89B]"
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-[#102A26] truncate">
                            {prof.display_name}
                          </div>
                          <div className="text-xs text-[#3B5751] mt-0.5 truncate">
                            {CAREER_ROLE_LABELS[prof.target_role]?.label || prof.target_role}
                          </div>
                          <div className="text-[11px] font-mono tabular-nums text-[#5E7872] mt-1">
                            {prof.branch || "CSE"} · Sem {prof.semester} · CGPA {prof.cgpa.toFixed(1)}
                          </div>
                        </div>
                        {selected && <Check className="w-4 h-4 text-[#16423C] shrink-0 mt-0.5" />}
                      </button>
                    );
                  })}
                </div>

                {activeProfile && (
                  <div className="pt-4 border-t border-[#E6ECE4] space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-[#102A26]">
                        Target Career Path for {activeProfile.display_name}
                      </span>
                      <span className="text-xs text-[#5E7872]">7 specialized tracks</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {ROLES.map((rKey) => {
                        const isRole = activeProfile.target_role === rKey;
                        return (
                          <button
                            key={rKey}
                            type="button"
                            onClick={() => handleRoleUpdate(rKey)}
                            className={`px-3 py-2.5 rounded-lg border text-left transition-colors ${
                              isRole
                                ? "border-[#16423C] bg-[#E6EEE7] text-[#102A26]"
                                : "border-[#D7DFD4] hover:border-[#8FA89B] text-[#3B5751] bg-[#FFFDF8]"
                            }`}
                          >
                            <div className="text-xs font-semibold">
                              {CAREER_ROLE_LABELS[rKey].label}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    disabled={!activeProfile}
                    onClick={onOpenReadinessPlan}
                    className="px-4 py-2.5 bg-[#FFFDF8] border border-[#16423C] text-[#16423C] hover:bg-[#E6EEE7] disabled:opacity-50 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap"
                  >
                    View Readiness Dashboard
                  </button>
                  <button
                    type="button"
                    disabled={!activeProfile}
                    onClick={onContinueToEvidence}
                    className="px-5 py-2.5 bg-[#16423C] hover:bg-[#0F302B] disabled:bg-slate-300 text-[#FFFDF8] text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap"
                  >
                    Manage Projects & Skills
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: PPT-Matched Editorial Illustration + Active Profile Summary */}
        <div className="lg:col-span-5 bg-[#FFFDF8] border border-[#D7DFD4] rounded-xl overflow-hidden flex flex-col">
          <div className="relative h-64 lg:flex-1 min-h-[250px] bg-[#EFE8D5]">
            <SafeImage
              src="/src/assets/images/ppt_student_network_1795089575183.jpg"
              alt="Editorial illustration of a college student connected to skill nodes, project cards, and analytics"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="p-5 border-t border-[#D7DFD4] bg-[#FBF6EA] space-y-3">
            <div className="flex items-center gap-4">
              <SafeImage
                src="/src/assets/images/avatar_college_student_1795087335202.jpg"
                alt="College student profile portrait"
                className="w-12 h-12 rounded-lg object-cover shrink-0 border border-[#C7D3C5]"
              />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-[#102A26] truncate">
                  {activeProfile ? activeProfile.display_name : "Not signed in yet"}
                </div>
                <div className="text-xs text-[#3B5751] mt-0.5 truncate">
                  {activeProfile
                    ? `${activeProfile.branch || "CSE"} · Sem ${activeProfile.semester} · CGPA ${activeProfile.cgpa.toFixed(1)}`
                    : "Sign in or create an account to start"}
                </div>
                {activeProfile?.email && (
                  <div className="text-[11px] text-[#5E7872] truncate">{activeProfile.email}</div>
                )}
              </div>
            </div>

            {activeProfile && (
              <div className="pt-2 border-t border-[#E6DFC9] flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium text-[#16423C] truncate">
                  {CAREER_ROLE_LABELS[activeProfile.target_role]?.label}
                </span>
                <button
                  type="button"
                  onClick={onContinueToEvidence}
                  className="text-xs font-semibold text-[#16423C] hover:underline whitespace-nowrap"
                >
                  Open Skills & Evidence →
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Live Multi-Role Career Fit Comparison */}
      {activeProfile && roleFit.length > 0 && (
        <section className="bg-[#FFFDF8] border border-[#D7DFD4] rounded-xl p-6 space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-[#102A26]">
                Cross-Role Career Fit for {activeProfile.display_name}
              </h2>
              <p className="text-xs text-[#3B5751] mt-0.5">
                {hasSnapshot
                  ? "Calculated from your latest evidence snapshot across all 7 career tracks."
                  : "Estimated from your logged portfolio projects and CGPA — run a readiness check for full accuracy."}
              </p>
            </div>
            <button
              type="button"
              onClick={onContinueToEvidence}
              className="text-xs font-semibold text-[#16423C] hover:underline whitespace-nowrap"
            >
              Update Skills & Projects →
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
            {roleFit.map((item) => {
              const isTarget = item.role_key === activeProfile.target_role;
              return (
                <div
                  key={item.role_key}
                  className={`p-4 rounded-lg border space-y-2.5 ${
                    isTarget
                      ? "border-[#16423C] bg-[#E6EEE7]/80"
                      : "border-[#D7DFD4] bg-[#FFFDF8]"
                  }`}
                >
                  <div className="text-xs font-semibold text-[#102A26] leading-snug">
                    {item.role_label}
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-2xl font-bold font-mono tabular-nums text-[#16423C]">
                      {item.overall_score}%
                    </span>
                    <span className="text-[11px] font-mono tabular-nums text-[#5E7872]">
                      {item.matched_count}/{item.benchmark_total} skills
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-[#E3EBE3] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        isTarget ? "bg-[#16423C]" : "bg-[#8FA89B]"
                      }`}
                      style={{ width: `${item.overall_score}%` }}
                    />
                  </div>
                  <div className="text-[11px] text-[#4D6862] leading-snug">
                    {item.top_gaps.length > 0
                      ? `Top gap: ${item.top_gaps[0]}`
                      : "Benchmark complete"}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
