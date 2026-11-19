import { useEffect, useRef, useState } from "react";
import { ArrowRight, Compass } from "lucide-react";
import {
  fetchHistory,
  fetchLatestPlan,
  fetchNotifications,
  fetchProfiles,
  fetchProjects,
  generateReadinessPlan,
  markNotificationsRead,
  signinStudent,
  signupStudent,
  updateProfile,
} from "./lib/api";
import type {
  ActionPlan,
  AppTab,
  CareerRole,
  CompletionRecord,
  EvidenceSnapshot,
  InterviewPrepLevel,
  NotificationItem,
  ProjectLevel,
  SkillKey,
  StudentProfile,
} from "./types/studentpulse";
import { SidebarLayout } from "./components/SidebarLayout";
import { AuthView } from "./components/AuthView";
import { DashboardView } from "./components/DashboardView";
import { TasksNotesView } from "./components/TasksNotesView";
import { SkillGapView } from "./components/SkillGapView";
import { AssessmentsView } from "./components/AssessmentsView";
import { RoadmapCoursesView } from "./components/RoadmapCoursesView";
import { EvidenceView } from "./components/EvidenceView";
import { ReadinessPlanView } from "./components/ReadinessPlanView";
import { MentorView } from "./components/MentorView";
import { MockInterviewView } from "./components/MockInterviewView";
import { ResumeAnalyzerView } from "./components/ResumeAnalyzerView";
import { JobsFeedView } from "./components/JobsFeedView";
import { PortfolioPassportView } from "./components/PortfolioPassportView";
import { GamificationView } from "./components/GamificationView";
import { HistoryView } from "./components/HistoryView";
import { FacultyView } from "./components/FacultyView";
import { AdminView } from "./components/AdminView";
import { ArchitectureView } from "./components/ArchitectureView";

const STORAGE_KEY = "studentpulse_user_id";
const DARK_MODE_KEY = "studentpulse_dark_mode";

function parsePassportHash(): number | null {
  if (typeof window === "undefined") return null;
  const match = window.location.hash.match(/^#passport\/(\d+)$/);
  return match ? Number(match[1]) : null;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>(() =>
    parsePassportHash() ? "portfolio" : "dashboard"
  );
  const [passportOverrideId, setPassportOverrideId] = useState<number | null>(() =>
    parsePassportHash()
  );

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(DARK_MODE_KEY) === "true";
  });

  const [profiles, setProfiles] = useState<StudentProfile[]>([]);
  const [activeProfile, setActiveProfile] = useState<StudentProfile | null>(null);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const latestRoleRef = useRef<StudentProfile["role"]>("student");

  const [plan, setPlan] = useState<ActionPlan | null>(null);
  const [latestSnapshot, setLatestSnapshot] = useState<EvidenceSnapshot | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [aiNotice, setAiNotice] = useState<string | null>(null);

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [history, setHistory] = useState<CompletionRecord[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [justLoggedBanner, setJustLoggedBanner] = useState(false);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);

  // Sync Tailwind dark class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    window.localStorage.setItem(DARK_MODE_KEY, String(darkMode));
  }, [darkMode]);

  // Listen to #passport/<id> hash navigation
  useEffect(() => {
    const onHash = () => {
      const id = parsePassportHash();
      if (id) {
        setPassportOverrideId(id);
        setActiveTab("portfolio");
      }
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  async function loadProfilePlanAndNotifications(userId: number) {
    setLoadingPlan(true);
    try {
      const [latest, notifRes] = await Promise.all([
        fetchLatestPlan(userId).catch(() => ({ plan: null, snapshot: null })),
        fetchNotifications(userId).catch(() => ({ notifications: [], faculty_feedback: [] })),
      ]);
      setPlan(latest.plan);
      setLatestSnapshot(latest.snapshot);
      setNotifications(notifRes.notifications || []);
      setAiNotice(null);
    } finally {
      setLoadingPlan(false);
    }
  }

  async function refreshProfilesAndActive() {
    try {
      const loadedProfiles = await fetchProfiles();
      setProfiles(loadedProfiles);
      if (activeProfile) {
        const updated = loadedProfiles.find((p) => p.user_id === activeProfile.user_id);
        if (updated) {
          setActiveProfile(updated);
        }
      }
    } catch {
      // Ignore background refresh error
    }
  }

  async function loadInitialData() {
    setLoadingInitial(true);
    setBootstrapError(null);
    try {
      const [loadedProfiles, loadedHistory] = await Promise.all([
        fetchProfiles(),
        fetchHistory(),
      ]);
      setProfiles(loadedProfiles);
      setHistory(loadedHistory);

      const savedIdRaw = window.localStorage.getItem(STORAGE_KEY);
      const savedId = savedIdRaw ? Number(savedIdRaw) : null;
      const savedMatch = savedId
        ? loadedProfiles.find((p) => p.user_id === savedId)
        : undefined;

      if (savedMatch) {
        setActiveProfile(savedMatch);
        latestRoleRef.current = savedMatch.role;
        setIsSignedIn(true);
        await loadProfilePlanAndNotifications(savedMatch.user_id);
      } else if (loadedProfiles.length > 0) {
        const chosen = loadedProfiles[0];
        setActiveProfile(chosen);
        latestRoleRef.current = chosen.role;
        setIsSignedIn(true);
        window.localStorage.setItem(STORAGE_KEY, String(chosen.user_id));
        await loadProfilePlanAndNotifications(chosen.user_id);
      }
    } catch (err) {
      setBootstrapError(
        err instanceof Error ? err.message : "Could not connect to StudentPulse backend."
      );
    } finally {
      setLoadingInitial(false);
    }
  }

  useEffect(() => {
    loadInitialData();
  }, []);

  async function handleSelectProfile(prof: StudentProfile) {
    latestRoleRef.current = prof.role;
    setActiveProfile(prof);
    setIsSignedIn(true);
    window.localStorage.setItem(STORAGE_KEY, String(prof.user_id));
    if (prof.role === "faculty") {
      setActiveTab("faculty");
    } else if (prof.role === "admin") {
      setActiveTab("admin");
    } else if (activeTab === "faculty" || activeTab === "admin") {
      setActiveTab("dashboard");
    }
    await loadProfilePlanAndNotifications(prof.user_id);
  }

  async function handleSignIn(payload: { email: string; password: string }) {
    const profile = await signinStudent(payload);
    latestRoleRef.current = profile.role;
    setProfiles((prev) =>
      prev.some((p) => p.user_id === profile.user_id)
        ? prev.map((p) => (p.user_id === profile.user_id ? profile : p))
        : [...prev, profile]
    );
    setActiveProfile(profile);
    setIsSignedIn(true);
    window.localStorage.setItem(STORAGE_KEY, String(profile.user_id));
    await loadProfilePlanAndNotifications(profile.user_id);
  }

  async function handleSignUp(payload: {
    display_name: string;
    email: string;
    password: string;
    branch: string;
    role: "student" | "faculty";
    target_role: CareerRole;
    semester: number;
    cgpa: number;
  }) {
    const created = await signupStudent(payload);
    latestRoleRef.current = created.role;
    setProfiles((prev) => [...prev, created]);
    setActiveProfile(created);
    setIsSignedIn(true);
    window.localStorage.setItem(STORAGE_KEY, String(created.user_id));
    setPlan(null);
    setLatestSnapshot(null);
    setNotifications([]);
    setAiNotice(null);
  }

  function handleSignOut() {
    window.localStorage.removeItem(STORAGE_KEY);
    setIsSignedIn(false);
    setActiveTab("profile");
  }

  async function handleUpdateProfile(
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
  ) {
    const updated = await updateProfile(userId, payload);
    setProfiles((prev) => prev.map((p) => (p.user_id === userId ? updated : p)));
    if (activeProfile?.user_id === userId) {
      setActiveProfile(updated);
    }
  }

  async function handleGeneratePlan(payload: {
    user_id: number;
    weekly_study_hours: number;
    assessment_score: number;
    coding_score: number;
    project_count: number;
    project_level: ProjectLevel;
    interview_score: number;
    interview_prep_level: InterviewPrepLevel;
    verified_skills: SkillKey[];
    certifications_count: number;
  }) {
    setGenerating(true);
    try {
      const result = await generateReadinessPlan(payload);
      setPlan(result.plan);
      setAiNotice(result.ai_notice);
      const latest = await fetchLatestPlan(payload.user_id).catch(() => null);
      if (latest?.snapshot) {
        setLatestSnapshot(latest.snapshot);
      }
      setActiveTab("plan");
    } finally {
      setGenerating(false);
    }
  }

  async function handleQuickBaselinePlan() {
    if (!activeProfile) return;
    setGenerating(true);
    try {
      const projs = await fetchProjects(activeProfile.user_id).catch(() => []);
      const skills = Array.from(new Set(projs.flatMap((p) => p.tech_stack)));
      await handleGeneratePlan({
        user_id: activeProfile.user_id,
        weekly_study_hours: 10,
        assessment_score: 76,
        coding_score: 70,
        project_count: projs.length,
        project_level: projs.some((p) => p.live_url)
          ? "deployed_fullstack"
          : projs.length > 0
          ? "academic_mini"
          : "none",
        interview_score: 62,
        interview_prep_level: "practicing",
        verified_skills:
          skills.length > 0 ? skills : ["js_ts", "git_collab", "problem_solving"],
        certifications_count: 1,
      });
    } finally {
      setGenerating(false);
    }
  }

  async function handleCompletionSaved() {
    const updatedHistory = await fetchHistory();
    setHistory(updatedHistory);
    setJustLoggedBanner(true);
    setActiveTab("history");
  }

  async function handleMarkNotificationsRead() {
    if (!activeProfile) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    await markNotificationsRead(activeProfile.user_id).catch(() => undefined);
  }

  function handleNavigate(tab: AppTab) {
    setJustLoggedBanner(false);
    if (tab !== "portfolio") {
      setPassportOverrideId(null);
      if (window.location.hash.startsWith("#passport/")) {
        window.history.replaceState(null, "", window.location.pathname);
      }
    }
    setActiveTab(tab);
  }

  return (
    <SidebarLayout
      activeTab={activeTab}
      onNavigate={handleNavigate}
      activeProfile={activeProfile}
      isSignedIn={isSignedIn}
      darkMode={darkMode}
      onToggleDarkMode={() => setDarkMode((d) => !d)}
      notifications={notifications}
      onMarkNotificationsRead={handleMarkNotificationsRead}
      onSignOut={handleSignOut}
    >
      {bootstrapError && (
        <div
          role="alert"
          className="mb-6 p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs text-red-700 dark:text-red-300"
        >
          <span>{bootstrapError}</span>
          <button
            type="button"
            onClick={loadInitialData}
            className="px-3 py-1.5 bg-cream-50 dark:bg-pine-900 border border-red-300 dark:border-red-700 rounded-md font-semibold"
          >
            Retry
          </button>
        </div>
      )}

      {loadingInitial ? (
        <div className="space-y-6 animate-pulse">
          <div className="h-40 bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-2xl" />
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="h-28 bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl" />
            <div className="h-28 bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl" />
            <div className="h-28 bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl" />
            <div className="h-28 bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl" />
          </div>
        </div>
      ) : (
        <>
          {activeTab === "dashboard" && activeProfile && (
            <DashboardView
              activeProfile={activeProfile}
              plan={plan}
              latestSnapshot={latestSnapshot}
              onNavigate={handleNavigate}
            />
          )}

          {activeTab === "tasks_notes" && activeProfile && (
            <TasksNotesView
              activeProfile={activeProfile}
              onXpUpdated={refreshProfilesAndActive}
            />
          )}

          {activeTab === "skill_gap" && activeProfile && (
            <SkillGapView activeProfile={activeProfile} />
          )}

          {activeTab === "assessments" && activeProfile && (
            <AssessmentsView
              activeProfile={activeProfile}
              onXpUpdated={refreshProfilesAndActive}
            />
          )}

          {activeTab === "roadmap" && activeProfile && (
            <RoadmapCoursesView
              activeProfile={activeProfile}
              plan={plan}
              generating={generating}
              onPlanUpdated={(updated) => setPlan(updated)}
              onQuickGeneratePlan={handleQuickBaselinePlan}
              onNavigate={handleNavigate}
              onXpUpdated={refreshProfilesAndActive}
            />
          )}

          {activeTab === "evidence" && activeProfile && (
            <EvidenceView
              activeProfile={activeProfile}
              latestSnapshot={latestSnapshot}
              loading={generating}
              onBackToProfile={() => handleNavigate("profile")}
              onGeneratePlan={handleGeneratePlan}
            />
          )}

          {activeTab === "plan" && activeProfile && (
            loadingPlan ? (
              <div className="space-y-6 animate-pulse">
                <div className="h-56 bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl" />
                <div className="h-64 bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl" />
              </div>
            ) : plan ? (
              <ReadinessPlanView
                activeProfile={activeProfile}
                plan={plan}
                aiNotice={aiNotice}
                onPlanUpdated={(updated) => setPlan(updated)}
                onCompletionSaved={handleCompletionSaved}
                onBackToEvidence={() => handleNavigate("evidence")}
              />
            ) : (
              <section className="bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl p-8 sm:p-10 text-center space-y-4">
                <Compass className="w-10 h-10 text-pine-700 mx-auto" />
                <h1 className="text-2xl font-bold text-[#14211d] dark:text-cream-50">
                  No Readiness Plan Generated Yet for {activeProfile.display_name}
                </h1>
                <p className="text-sm text-[#45554e] dark:text-[#c5d4cd] max-w-xl mx-auto leading-relaxed">
                  Run a quick baseline analysis or customize your academic scores, verified
                  skills, and projects to generate a tailored weekly action plan.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    disabled={generating}
                    onClick={handleQuickBaselinePlan}
                    className="px-5 py-2.5 bg-pine-700 hover:bg-pine-800 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap"
                  >
                    {generating ? "Analyzing Readiness..." : "Run Quick Readiness Check"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleNavigate("evidence")}
                    className="px-5 py-2.5 bg-white dark:bg-pine-950 border border-sage-300 dark:border-pine-700 hover:border-pine-600 text-[#14211d] dark:text-cream-50 text-sm font-semibold rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap"
                  >
                    Customize Evidence & Skills
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </section>
            )
          )}

          {activeTab === "mentor" && activeProfile && (
            <MentorView activeProfile={activeProfile} />
          )}

          {activeTab === "interview" && activeProfile && (
            <MockInterviewView
              activeProfile={activeProfile}
              onXpUpdated={refreshProfilesAndActive}
            />
          )}

          {activeTab === "resume" && activeProfile && (
            <ResumeAnalyzerView
              activeProfile={activeProfile}
              onXpUpdated={refreshProfilesAndActive}
            />
          )}

          {activeTab === "jobs" && activeProfile && (
            <JobsFeedView
              activeProfile={activeProfile}
              onNavigate={handleNavigate}
              onXpUpdated={refreshProfilesAndActive}
            />
          )}

          {activeTab === "portfolio" && activeProfile && (
            <PortfolioPassportView
              activeProfile={activeProfile}
              passportUserIdOverride={passportOverrideId}
              onClearPassportOverride={() => {
                setPassportOverrideId(null);
                window.history.replaceState(null, "", window.location.pathname);
              }}
              onXpUpdated={refreshProfilesAndActive}
            />
          )}

          {activeTab === "gamification" && activeProfile && (
            <GamificationView activeProfile={activeProfile} />
          )}

          {activeTab === "history" && (
            <HistoryView
              activeProfile={activeProfile}
              history={history}
              loading={loadingInitial}
              justLoggedBanner={justLoggedBanner}
              onDismissBanner={() => setJustLoggedBanner(false)}
              onStartNewAssessment={() => handleNavigate("evidence")}
            />
          )}

          {activeTab === "faculty" && activeProfile && (
            <FacultyView activeProfile={activeProfile} />
          )}

          {activeTab === "admin" && activeProfile && (
            <AdminView activeProfile={activeProfile} />
          )}

          {activeTab === "profile" && (
            <AuthView
              profiles={profiles}
              activeProfile={activeProfile}
              isSignedIn={isSignedIn}
              onSelectProfile={handleSelectProfile}
              onSignIn={handleSignIn}
              onSignUp={handleSignUp}
              onSignOut={handleSignOut}
              onUpdateProfile={handleUpdateProfile}
              onGoToDashboard={() => {
                if (latestRoleRef.current === "admin") handleNavigate("admin");
                else if (latestRoleRef.current === "faculty") handleNavigate("faculty");
                else handleNavigate("dashboard");
              }}
            />
          )}

          {activeTab === "architecture" && <ArchitectureView />}
        </>
      )}
    </SidebarLayout>
  );
}
