import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Radar as RadarIcon,
  Save,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  fetchAiSkillRecommendations,
  fetchSkillProfile,
  saveStudentSkills,
} from "../lib/api";
import {
  SKILL_CATEGORIES,
  type SkillKey,
  type StudentProfile,
  type StudentSkillProfile,
} from "../types/studentpulse";

interface SkillGapViewProps {
  activeProfile: StudentProfile;
}

export function SkillGapView({ activeProfile }: SkillGapViewProps) {
  const [skillProfile, setSkillProfile] = useState<StudentSkillProfile | null>(null);
  const [draftScores, setDraftScores] = useState<Record<string, number>>({});
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiRecs, setAiRecs] = useState<{
    summary: string;
    priority_focus: string;
    recommendations: string[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setAiRecs(null);
    fetchSkillProfile(activeProfile.user_id)
      .then((sp) => {
        setSkillProfile(sp);
        const map: Record<string, number> = {};
        sp.skills.forEach((s) => {
          map[s.skill_key] = s.proficiency;
        });
        setDraftScores(map);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load skills."))
      .finally(() => setLoading(false));
  }, [activeProfile.user_id]);

  async function handleSaveProficiencies() {
    setSaving(true);
    setError(null);
    setSavedNotice(null);
    try {
      const updates = Object.entries(draftScores).map(([skill_key, proficiency]) => ({
        skill_key: skill_key as SkillKey,
        proficiency,
      }));
      const updated = await saveStudentSkills(activeProfile.user_id, updates);
      setSkillProfile(updated);
      setSavedNotice("Skill proficiencies saved & benchmark gaps recalculated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save skill scores.");
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerateAiGuidance() {
    setAiLoading(true);
    setError(null);
    try {
      const recs = await fetchAiSkillRecommendations(activeProfile.user_id);
      setAiRecs(recs);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not fetch AI skill gap recommendations."
      );
    } finally {
      setAiLoading(false);
    }
  }

  const comparisonData = (skillProfile?.comparison || []).map((c) => ({
    skill: c.label.split("&")[0].split("(")[0].trim().slice(0, 15),
    Current: c.current,
    Target: c.target,
    Gap: c.gap_pct,
  }));

  const visibleSkillKeys = new Set(
    SKILL_CATEGORIES.filter((c) => activeCategory === "all" || c.id === activeCategory).flatMap(
      (c) => c.skills
    )
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs font-medium text-pine-700 dark:text-[#6ec4b0]">
            Role Benchmark Analyzer · {skillProfile?.target_role_label || activeProfile.target_role}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#14211d] dark:text-cream-50 mt-1">
            AI Skill Gap Analyzer & Proficiency Matrix
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={aiLoading}
            onClick={handleGenerateAiGuidance}
            className="px-4 py-2 bg-pine-600 hover:bg-pine-700 disabled:opacity-60 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {aiLoading ? "Analyzing Gaps..." : "Get AI Gap Insights"}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSaveProficiencies}
            className="px-4 py-2 bg-pine-700 hover:bg-pine-800 disabled:opacity-60 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? "Saving..." : "Save & Recalculate"}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300 font-medium">
          {error}
        </div>
      )}

      {savedNotice && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300 font-medium">
          {savedNotice}
        </div>
      )}

      {/* Summary KPIs */}
      {skillProfile && (
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl p-4">
            <div className="text-xs text-[#56665f] dark:text-[#869b92]">Overall Role Skill Gap</div>
            <div className="text-2xl font-bold font-mono tabular-nums text-pine-700 dark:text-[#6ec4b0] mt-1">
              {skillProfile.overall_gap_pct}%
            </div>
            <div className="text-[11px] text-[#56665f] mt-0.5">Average gap below 75% target</div>
          </div>

          <div className="bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl p-4">
            <div className="text-xs text-[#56665f] dark:text-[#869b92]">Verified Skills</div>
            <div className="text-2xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">
              {skillProfile.verified_count}
            </div>
            <div className="text-[11px] text-[#56665f] mt-0.5">
              Proven via Quizzes & Projects
            </div>
          </div>

          <div className="bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl p-4">
            <div className="text-xs text-[#56665f] dark:text-[#869b92]">Self-Reported Skills</div>
            <div className="text-2xl font-bold font-mono tabular-nums text-[#14211d] dark:text-cream-50 mt-1">
              {skillProfile.self_reported_count}
            </div>
            <div className="text-[11px] text-[#56665f] mt-0.5">Take quizzes to verify</div>
          </div>

          <div className="bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl p-4">
            <div className="text-xs text-[#56665f] dark:text-[#869b92]">Missing Benchmark Skills</div>
            <div className="text-2xl font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400 mt-1">
              {skillProfile.missing_skills.length}
            </div>
            <div className="text-[11px] text-[#56665f] mt-0.5">0% logged on target stack</div>
          </div>
        </section>
      )}

      {/* AI Personalized Gap Recommendations */}
      {aiRecs && (
        <section className="bg-cream-100/70 dark:bg-pine-950/30 border border-cream-200 dark:border-pine-700 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-pine-800 dark:text-ochre-400">
            <Sparkles className="w-4 h-4" />
            Gemini AI Skill Gap Action Brief · Priority: {aiRecs.priority_focus}
          </div>
          <p className="text-xs text-[#2c3d37] dark:text-[#c5d4cd] leading-relaxed">
            {aiRecs.summary}
          </p>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-[#1f2f29] dark:text-[#dbe6e0]">
            {aiRecs.recommendations.map((rec, i) => (
              <li
                key={i}
                className="p-2.5 rounded-lg bg-cream-50 dark:bg-pine-900 border border-cream-200 dark:border-pine-700"
              >
                {i + 1}. {rec}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Radar + Comparison Bar Charts */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl p-5 space-y-2">
          <div className="flex items-center gap-2 text-sm font-bold text-[#14211d] dark:text-cream-50">
            <RadarIcon className="w-4 h-4 text-pine-700" />
            Role Competency Radar
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={comparisonData}>
                <PolarGrid stroke="#93af9e" opacity={0.4} />
                <PolarAngleAxis dataKey="skill" tick={{ fontSize: 10 }} />
                <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9 }} />
                <Radar
                  name="Current"
                  dataKey="Current"
                  stroke="#0f4c45"
                  fill="#0f4c45"
                  fillOpacity={0.3}
                />
                <Radar
                  name="Target"
                  dataKey="Target"
                  stroke="#d98254"
                  fill="#d98254"
                  fillOpacity={0.08}
                />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-7 bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl p-5 space-y-2">
          <div className="text-sm font-bold text-[#14211d] dark:text-cream-50">
            Skill Proficiency vs Target Benchmark (75%)
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparisonData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#93af9e" opacity={0.35} />
                <XAxis dataKey="skill" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="Current" fill="#0f4c45" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Gap" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Strengths & Weaknesses */}
      {skillProfile && (
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              Role Strengths ({skillProfile.strengths.length})
            </div>
            {skillProfile.strengths.length === 0 ? (
              <p className="text-xs text-[#56665f]">
                Raise required skills to 75%+ or pass domain assessments to unlock strengths.
              </p>
            ) : (
              <div className="space-y-2">
                {skillProfile.strengths.map((s) => (
                  <div key={s.skill_key} className="flex items-center justify-between text-xs">
                    <span className="font-medium text-[#1f2f29] dark:text-[#dbe6e0]">{s.label}</span>
                    <span className="font-mono font-bold tabular-nums text-emerald-600">
                      {s.current}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-amber-700 dark:text-amber-400">
              <AlertTriangle className="w-4 h-4" />
              Weaknesses & Missing Gaps ({skillProfile.weaknesses.length})
            </div>
            {skillProfile.weaknesses.length === 0 ? (
              <p className="text-xs text-[#56665f]">
                No critical skill weaknesses detected below 60% for this career track.
              </p>
            ) : (
              <div className="space-y-2">
                {skillProfile.weaknesses.map((w) => (
                  <div key={w.skill_key} className="flex items-center justify-between text-xs">
                    <span className="font-medium text-[#1f2f29] dark:text-[#dbe6e0]">{w.label}</span>
                    <span className="font-mono font-bold tabular-nums text-amber-600">
                      {w.current}% (gap {w.gap_pct}%)
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Interactive Proficiency Editor across all 24 Multi-Disciplinary Skills */}
      <section className="bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-[#14211d] dark:text-cream-50">
              Multi-Disciplinary Skill Matrix (24 Skills)
            </h2>
            <p className="text-xs text-[#56665f] dark:text-[#869b92]">
              Verified skills come from Smart Assessments and Portfolio Projects; adjust sliders to
              evaluate your current baseline.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setActiveCategory("all")}
              className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border ${
                activeCategory === "all"
                  ? "bg-pine-700 text-white border-pine-700"
                  : "border-sage-200 dark:border-pine-700 text-[#45554e] dark:text-[#c5d4cd]"
              }`}
            >
              All Domains
            </button>
            {SKILL_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border ${
                  activeCategory === cat.id
                    ? "bg-pine-700 text-white border-pine-700"
                    : "border-sage-200 dark:border-pine-700 text-[#45554e] dark:text-[#c5d4cd]"
                }`}
              >
                {cat.label.split("&")[0].trim()}
              </button>
            ))}
          </div>
        </div>

        {loading || !skillProfile ? (
          <div className="h-40 animate-pulse bg-cream-100 dark:bg-pine-800 rounded-xl" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {skillProfile.skills
              .filter((s) => visibleSkillKeys.has(s.skill_key))
              .map((s) => {
                const val = draftScores[s.skill_key] ?? s.proficiency;
                const isVerified =
                  s.source === "assessment_verified" || s.source === "project_verified";
                return (
                  <div
                    key={s.skill_key}
                    className="p-3.5 rounded-xl border border-sage-200 dark:border-pine-800 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs font-semibold text-[#14211d] dark:text-cream-50">
                          {s.label}
                        </div>
                        <div className="text-[11px] text-[#56665f] dark:text-[#869b92] flex items-center gap-1 mt-0.5">
                          {isVerified ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                              <ShieldCheck className="w-3 h-3" />
                              {s.source === "assessment_verified"
                                ? "Assessment Verified"
                                : "Project Verified"}
                            </span>
                          ) : s.source === "self_reported" ? (
                            <span>Self-reported</span>
                          ) : (
                            <span>Not logged</span>
                          )}
                          {s.required_for_role && <span>· Core for Role</span>}
                        </div>
                      </div>
                      <span className="text-xs font-mono font-bold tabular-nums text-pine-700 dark:text-[#6ec4b0]">
                        {val}%
                      </span>
                    </div>

                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={val}
                      onChange={(e) =>
                        setDraftScores((prev) => ({
                          ...prev,
                          [s.skill_key]: Number(e.target.value),
                        }))
                      }
                      className="w-full accent-pine-700 cursor-pointer"
                    />
                  </div>
                );
              })}
          </div>
        )}
      </section>
    </div>
  );
}
