import type { AppTab } from "../types/studentpulse";

interface TopBarProps {
  activeTab: AppTab;
  onNavigate: (tab: AppTab) => void;
  onNewAssessment: () => void;
}

const NAV_ITEMS: Array<{ id: AppTab; label: string }> = [
  { id: "profile", label: "Student Profile" },
  { id: "evidence", label: "Evidence Input" },
  { id: "plan", label: "Readiness & Plan" },
  { id: "history", label: "Progress History" },
  { id: "architecture", label: "System & Tests" },
];

export function TopBar({ activeTab, onNavigate, onNewAssessment }: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 bg-[#FFFDF8]/95 backdrop-blur-sm border-b border-[#D7DFD4]">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single text element wordmark */}
        <button
          type="button"
          onClick={() => onNavigate("profile")}
          className="text-lg font-bold tracking-tight text-[#102A26] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#16423C]"
        >
          StudentPulse AI
        </button>

        {/* Zone 2: 5 clean single-line text nav links */}
        <nav
          aria-label="Primary navigation"
          className="hidden md:flex items-center gap-6 text-sm font-medium"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`relative py-2 whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#16423C] ${
                  isActive
                    ? "text-[#16423C] font-semibold"
                    : "text-[#4D6862] hover:text-[#102A26]"
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute left-0 right-0 -bottom-[1px] h-0.5 bg-[#16423C]"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1 primary CTA button */}
        <div className="shrink-0">
          <button
            type="button"
            onClick={onNewAssessment}
            className="px-4 py-2 text-sm font-semibold text-[#FFFDF8] bg-[#16423C] hover:bg-[#0F302B] rounded-lg transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#16423C]"
          >
            Analyze Readiness
          </button>
        </div>
      </div>

      {/* Compact mobile navigation row */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden border-t border-[#E6ECE4] px-4 py-2 flex items-center gap-4 overflow-x-auto text-xs font-medium"
      >
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={`py-1.5 whitespace-nowrap shrink-0 transition-colors ${
                isActive
                  ? "text-[#16423C] font-semibold border-b-2 border-[#16423C]"
                  : "text-[#4D6862]"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
}
