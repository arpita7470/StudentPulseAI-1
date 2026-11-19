import { useState, type ReactNode } from "react";
import {
  Award,
  Bell,
  BookOpen,
  Briefcase,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Compass,
  Cpu,
  FileSearch,
  FolderGit2,
  GraduationCap,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareCode,
  Mic,
  Moon,
  Radar,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  UserCheck,
  X,
} from "lucide-react";
import type {
  AppTab,
  NotificationItem,
  StudentProfile,
  UserRole,
} from "../types/studentpulse";
import { CAREER_ROLE_LABELS } from "../types/studentpulse";

interface SidebarLayoutProps {
  activeTab: AppTab;
  onNavigate: (tab: AppTab) => void;
  activeProfile: StudentProfile | null;
  isSignedIn: boolean;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  notifications: NotificationItem[];
  onMarkNotificationsRead: () => void;
  onSignOut: () => void;
  children: ReactNode;
}

interface NavGroup {
  label: string;
  items: Array<{
    id: AppTab;
    label: string;
    icon: typeof LayoutDashboard;
    roles?: UserRole[];
  }>;
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Core Workspace",
    items: [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { id: "tasks_notes", label: "Daily Targets & Notes", icon: CheckSquare },
      { id: "skill_gap", label: "AI Skill Gap Analyzer", icon: Radar },
      { id: "assessments", label: "Smart Assessments", icon: ClipboardCheck },
    ],
  },
  {
    label: "AI Career Suite",
    items: [
      { id: "roadmap", label: "Roadmap & Courses", icon: Compass },
      { id: "evidence", label: "Readiness Calculator", icon: SlidersHorizontal },
      { id: "mentor", label: "AI Career Mentor", icon: MessageSquareCode },
      { id: "interview", label: "AI Mock Interview", icon: Mic },
      { id: "resume", label: "AI Resume Analyzer", icon: FileSearch },
    ],
  },
  {
    label: "Portfolio & Growth",
    items: [
      { id: "jobs", label: "Job & Campus Feed", icon: Briefcase },
      { id: "portfolio", label: "Projects & Passport", icon: FolderGit2 },
      { id: "gamification", label: "XP & Leaderboard", icon: Award },
      { id: "history", label: "Progress Ledger", icon: History },
    ],
  },
  {
    label: "Portals & System",
    items: [
      { id: "faculty", label: "Faculty Portal", icon: UserCheck, roles: ["faculty", "admin"] },
      { id: "admin", label: "Admin Control", icon: Settings2, roles: ["admin"] },
      { id: "profile", label: "Account & Profile", icon: GraduationCap },
      { id: "architecture", label: "Python & Tests", icon: Cpu },
    ],
  },
];

export function SidebarLayout({
  activeTab,
  onNavigate,
  activeProfile,
  isSignedIn,
  darkMode,
  onToggleDarkMode,
  notifications,
  onMarkNotificationsRead,
  onSignOut,
  children,
}: SidebarLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const userRole: UserRole = activeProfile?.role || "student";
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const flatItems = NAV_GROUPS.flatMap((g) => g.items);
  const activeLabel =
    activeTab === "plan"
      ? "Weekly Readiness Action Plan"
      : flatItems.find((i) => i.id === activeTab)?.label || "StudentPulse AI";

  function handleNavClick(tab: AppTab) {
    onNavigate(tab);
    setMobileOpen(false);
  }

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#faf2e3] dark:bg-pine-900 border-r border-[#dfd0b4] dark:border-pine-800">
      {/* Brand */}
      <div className="h-16 px-4 flex items-center justify-between border-b border-[#e4d4b7] dark:border-pine-800 shrink-0">
        <button
          type="button"
          onClick={() => handleNavClick("dashboard")}
          className="flex items-center gap-2.5 text-left min-w-0"
        >
          <span className="w-9 h-9 rounded-xl bg-pine-700 dark:bg-pine-600 text-[#f3ead3] flex items-center justify-center shrink-0 shadow-xs">
            <GraduationCap className="w-5 h-5" />
          </span>
          {!collapsed && (
            <div className="min-w-0">
              <div className="text-sm font-bold tracking-tight text-pine-700 dark:text-cream-50 truncate">
                StudentPulse AI
              </div>
              <div className="text-[11px] text-[#5c6d66] dark:text-[#9eb4ab] truncate">
                Career Readiness Hub
              </div>
            </div>
          )}
        </button>

        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="hidden lg:inline-flex p-1.5 rounded-lg text-[#56665f] hover:text-pine-700 dark:text-[#9eb4ab] dark:hover:text-cream-50 hover:bg-cream-100 dark:hover:bg-pine-800 transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>

        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
          className="lg:hidden p-1.5 rounded-lg text-[#56665f] hover:text-pine-700 dark:text-[#9eb4ab]"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation Links */}
      <nav aria-label="Primary Sidebar" className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {NAV_GROUPS.map((group) => {
          const visibleItems = group.items.filter(
            (item) => !item.roles || item.roles.includes(userRole)
          );
          if (visibleItems.length === 0) return null;
          return (
            <div key={group.label} className="space-y-1">
              {!collapsed && (
                <div className="px-2.5 text-[11px] font-semibold tracking-wide text-[#756b58] dark:text-[#7e988e]">
                  {group.label}
                </div>
              )}
              {visibleItems.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    title={collapsed ? item.label : undefined}
                    onClick={() => handleNavClick(item.id)}
                    aria-current={active ? "page" : undefined}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                      active
                        ? "bg-pine-700 dark:bg-pine-600 text-[#faf2e3] font-semibold shadow-xs"
                        : "text-[#1e3531] dark:text-[#d5e0da] hover:bg-[#efe3ca] dark:hover:bg-pine-800/80"
                    } ${collapsed ? "justify-center" : ""}`}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        active ? "text-[#f0b78e]" : "text-pine-700 dark:text-[#86b8aa]"
                      }`}
                    />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </button>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Active Account Footer */}
      <div className="p-3 border-t border-[#e4d4b7] dark:border-pine-800 shrink-0">
        {activeProfile ? (
          <div className={`flex items-center gap-2.5 ${collapsed ? "justify-center" : ""}`}>
            <button
              type="button"
              onClick={() => handleNavClick("profile")}
              className="w-8 h-8 rounded-xl bg-pine-700 text-[#faf2e3] font-bold text-xs flex items-center justify-center shrink-0"
              title={activeProfile.display_name}
            >
              {activeProfile.display_name.slice(0, 2).toUpperCase()}
            </button>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-[#0f2622] dark:text-cream-50 truncate">
                  {activeProfile.display_name}
                </div>
                <div className="text-[11px] text-[#5c6d66] dark:text-[#9eb4ab] truncate capitalize tabular-nums">
                  {userRole} · {activeProfile.xp_points ?? 0} XP
                </div>
              </div>
            )}
            {!collapsed && isSignedIn && (
              <button
                type="button"
                onClick={onSignOut}
                title="Sign out"
                aria-label="Sign out"
                className="p-1.5 rounded-lg text-[#56665f] hover:text-red-700 hover:bg-red-50 dark:text-[#9eb4ab] dark:hover:text-red-400 dark:hover:bg-red-950/40"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => handleNavClick("profile")}
            className="w-full py-2 px-3 rounded-xl bg-pine-700 text-[#faf2e3] text-xs font-semibold"
          >
            {collapsed ? "In" : "Sign In / Register"}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-[#c4d6cb] dark:bg-pine-950 text-[#0f2622] dark:text-cream-50">
      {/* Desktop Collapsible Sidebar */}
      <aside
        className={`hidden lg:block shrink-0 sticky top-0 h-screen transition-all duration-200 ${
          collapsed ? "w-[72px]" : "w-[260px]"
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-pine-950/60"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="relative w-72 max-w-[85vw] h-full z-10">{sidebarContent}</div>
        </div>
      )}

      {/* Main Content Shell */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 h-16 bg-[#faf2e3]/95 dark:bg-pine-900/95 backdrop-blur border-b border-[#dfd0b4] dark:border-pine-800 px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
              className="lg:hidden p-2 rounded-xl border border-[#dfd0b4] dark:border-pine-700 text-pine-700 dark:text-cream-50"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <div className="text-sm font-bold text-pine-700 dark:text-cream-50 truncate">
                {activeLabel}
              </div>
              {activeProfile && (
                <div className="text-[11px] text-[#5c6d66] dark:text-[#9eb4ab] truncate">
                  {activeProfile.branch || "CSE"} · Sem {activeProfile.semester} ·{" "}
                  {CAREER_ROLE_LABELS[activeProfile.target_role]?.label || activeProfile.target_role}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Dark / Light Mode Toggle */}
            <button
              type="button"
              onClick={onToggleDarkMode}
              aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
              className="p-2 rounded-xl border border-[#dfd0b4] dark:border-pine-700 bg-[#f3ead3] dark:bg-pine-800 text-pine-700 dark:text-cream-50 hover:bg-[#eadcc0] dark:hover:bg-pine-700 transition-colors"
            >
              {darkMode ? (
                <Sun className="w-4 h-4 text-[#f0b78e]" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>

            {/* Notifications Bell */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  const next = !notifOpen;
                  setNotifOpen(next);
                  if (next && unreadCount > 0) {
                    onMarkNotificationsRead();
                  }
                }}
                aria-label="Notifications"
                className="p-2 rounded-xl border border-[#dfd0b4] dark:border-pine-700 bg-[#f3ead3] dark:bg-pine-800 text-pine-700 dark:text-cream-50 hover:bg-[#eadcc0] dark:hover:bg-pine-700 relative transition-colors"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-ochre-500 text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 max-w-[90vw] bg-[#faf2e3] dark:bg-pine-900 border border-[#dfd0b4] dark:border-pine-700 rounded-2xl shadow-lg p-4 z-50 space-y-3">
                  <div className="flex items-center justify-between border-b border-[#e4d4b7] dark:border-pine-800 pb-2">
                    <span className="text-xs font-bold text-pine-700 dark:text-cream-50">
                      Notifications &amp; Mentor Updates
                    </span>
                    <button
                      type="button"
                      onClick={() => setNotifOpen(false)}
                      className="text-xs text-[#56665f] hover:text-pine-700 dark:text-[#9eb4ab] dark:hover:text-cream-50"
                    >
                      Close
                    </button>
                  </div>
                  {notifications.length === 0 ? (
                    <p className="text-xs text-[#56665f] dark:text-[#9eb4ab] py-3 text-center">
                      No notifications yet.
                    </p>
                  ) : (
                    <div className="max-h-64 overflow-y-auto divide-y divide-[#e4d4b7] dark:divide-pine-800">
                      {notifications.slice(0, 6).map((n) => (
                        <div key={n.notification_id} className="py-2.5 first:pt-0 last:pb-0">
                          <div className="text-xs font-semibold text-[#0f2622] dark:text-cream-50">
                            {n.title}
                          </div>
                          <div className="text-[11px] text-[#475750] dark:text-[#c5d4cd] mt-0.5 leading-relaxed">
                            {n.message}
                          </div>
                          <div className="text-[10px] text-[#6b7b73] dark:text-[#869b92] mt-1 font-mono">
                            {n.created_at}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => handleNavClick("profile")}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#dfd0b4] dark:border-pine-700 bg-[#f3ead3] dark:bg-pine-800 text-xs font-semibold text-pine-700 dark:text-cream-50 hover:border-pine-700 whitespace-nowrap shrink-0 transition-colors"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-pine-700 dark:text-[#f0b78e]" />
              {isSignedIn ? "Switch Account" : "Sign In"}
            </button>

            <button
              type="button"
              onClick={() => handleNavClick("roadmap")}
              className="px-3.5 py-1.5 rounded-xl bg-pine-700 hover:bg-pine-800 dark:bg-pine-600 dark:hover:bg-pine-500 text-[#faf2e3] text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors shadow-xs"
            >
              <BookOpen className="w-3.5 h-3.5 text-[#f0b78e]" />
              Roadmap
            </button>
          </div>
        </header>

        <main className="flex-1 w-full max-w-[1340px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
          {children}
        </main>

        <footer className="border-t border-[#b5cabd] dark:border-pine-800 bg-[#faf2e3] dark:bg-pine-900">
          <div className="max-w-[1340px] mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3 text-xs text-[#4b6058] dark:text-[#9eb4ab]">
            <span>StudentPulse AI · Student Success, Skill &amp; Career Readiness Platform</span>
            <span>Python 3.11 + SQLite + Gemini AI · KIET University</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
