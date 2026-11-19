import { useEffect, useState } from "react";
import { Award, CheckCircle2, Flame, Lock, Target, Trophy } from "lucide-react";
import { fetchGamification } from "../lib/api";
import { CAREER_ROLE_LABELS, type GamificationSummary, type StudentProfile } from "../types/studentpulse";

interface GamificationViewProps {
  activeProfile: StudentProfile;
}

export function GamificationView({ activeProfile }: GamificationViewProps) {
  const [summary, setSummary] = useState<GamificationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchGamification(activeProfile.user_id)
      .then((data) => {
        if (!cancelled) setSummary(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load XP summary.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeProfile.user_id, activeProfile.xp_points]);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-36 bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl" />
        <div className="h-64 bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl" />
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-300">
        {error || "Gamification data unavailable."}
      </div>
    );
  }

  const levelBaseXp = (summary.level - 1) * 250;
  const levelSpan = Math.max(1, summary.next_level_xp - levelBaseXp);
  const progressIntoLevel = Math.max(0, summary.xp_points - levelBaseXp);
  const levelPct = Math.min(100, Math.round((progressIntoLevel / levelSpan) * 100));

  return (
    <div className="space-y-6">
      {/* Level & Streak Hero */}
      <section className="bg-gradient-to-r from-pine-800 via-pine-700 to-pine-600 rounded-2xl p-6 sm:p-7 text-white grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        <div className="lg:col-span-8 space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-cream-100">
            StudentPulse Gamification · XP, Streaks & Cohort Leaderboard
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold">
            Level {summary.level} · {activeProfile.display_name}
          </h1>
          <div className="space-y-1.5 max-w-xl">
            <div className="flex justify-between text-xs text-cream-100 font-mono tabular-nums">
              <span>{summary.xp_points} XP Total</span>
              <span>Next Level at {summary.next_level_xp} XP</span>
            </div>
            <div className="h-2.5 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all"
                style={{ width: `${levelPct}%` }}
              />
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 flex items-center justify-start lg:justify-end gap-4">
          <div className="bg-white/10 backdrop-blur border border-white/20 rounded-xl px-5 py-4 flex items-center gap-3">
            <Flame className="w-8 h-8 text-amber-300" />
            <div>
              <div className="text-xs text-cream-100">Study Streak</div>
              <div className="text-2xl font-bold font-mono tabular-nums">
                {summary.streak_days} days
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Weekly Challenges & Badges */}
        <div className="lg:col-span-7 space-y-6">
          <section className="bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-pine-700 dark:text-[#6ec4b0]" />
              <h2 className="text-base font-bold text-[#14211d] dark:text-cream-50">
                Weekly Success Challenges
              </h2>
            </div>

            <div className="space-y-3">
              {summary.challenges.map((ch) => {
                const pct = Math.min(100, Math.round((ch.current / Math.max(1, ch.target)) * 100));
                const done = ch.current >= ch.target;
                return (
                  <div
                    key={ch.title}
                    className="p-3.5 rounded-xl border border-sage-200 dark:border-pine-800 bg-sage-50/70 dark:bg-pine-950 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-[#14211d] dark:text-cream-50 flex items-center gap-1.5">
                        {done && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                        {ch.title}
                      </span>
                      <span className="font-mono tabular-nums text-ochre-600 dark:text-ochre-400 font-semibold">
                        +{ch.xp} XP · {ch.current}/{ch.target}
                      </span>
                    </div>
                    <div className="h-2 bg-sage-200 dark:bg-pine-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          done ? "bg-emerald-600" : "bg-pine-700"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-500" />
              <h2 className="text-base font-bold text-[#14211d] dark:text-cream-50">
                Achievement Badges ({summary.badges.filter((b) => b.unlocked).length}/
                {summary.badges.length} unlocked)
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {summary.badges.map((badge) => (
                <div
                  key={badge.id}
                  className={`p-4 rounded-xl border flex items-start gap-3 ${
                    badge.unlocked
                      ? "border-amber-200 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/20"
                      : "border-sage-200 dark:border-pine-800 bg-sage-50/60 dark:bg-pine-950 opacity-70"
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      badge.unlocked
                        ? "bg-amber-500 text-white"
                        : "bg-sage-200 dark:bg-pine-800 text-[#56665f]"
                    }`}
                  >
                    {badge.unlocked ? <Award className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-[#14211d] dark:text-cream-50">
                      {badge.name}
                    </div>
                    <div className="text-[11px] text-[#45554e] dark:text-[#869b92] mt-0.5 leading-relaxed">
                      {badge.description}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Right: Cohort Leaderboard */}
        <section className="lg:col-span-5 bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-pine-700 dark:text-[#6ec4b0]" />
            <h2 className="text-base font-bold text-[#14211d] dark:text-cream-50">
              Student Cohort Leaderboard
            </h2>
          </div>

          <div className="divide-y divide-sage-200/70 dark:divide-pine-800">
            {summary.leaderboard.map((row, idx) => {
              const isMe = row.user_id === activeProfile.user_id;
              return (
                <div
                  key={row.user_id}
                  className={`py-3 px-2 rounded-lg flex items-center justify-between gap-3 ${
                    isMe ? "bg-cream-100 dark:bg-pine-950/30" : ""
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`w-6 h-6 rounded-md text-xs font-mono font-bold flex items-center justify-center shrink-0 ${
                        idx === 0
                          ? "bg-amber-500 text-white"
                          : idx === 1
                          ? "bg-sage-300 text-white"
                          : idx === 2
                          ? "bg-amber-700 text-white"
                          : "bg-cream-100 dark:bg-pine-800 text-[#45554e] dark:text-[#c5d4cd]"
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[#14211d] dark:text-cream-50 truncate">
                        {row.display_name} {isMe ? "(You)" : ""}
                      </div>
                      <div className="text-[11px] text-[#56665f] dark:text-[#869b92] truncate">
                        {row.branch} ·{" "}
                        {CAREER_ROLE_LABELS[row.target_role]?.label || row.target_role}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs font-mono font-bold tabular-nums text-pine-700 dark:text-[#6ec4b0]">
                      {row.xp_points} XP
                    </div>
                    <div className="text-[10px] text-[#56665f] font-mono">
                      {row.streak_days}d streak
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
