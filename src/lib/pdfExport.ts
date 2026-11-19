import { jsPDF } from "jspdf";
import type { AdminOverviewData, DigitalPassportData, StudyNote } from "../types/studentpulse";
import { CAREER_ROLE_LABELS } from "../types/studentpulse";

export function exportStudyNoteAsPdf(note: StudyNote): void {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 48;
  const maxWidth = 500;
  let y = 56;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(15, 76, 69);
  doc.text("StudentPulse AI · Study Notes", margin, y);
  y += 26;

  doc.setFontSize(15);
  doc.setTextColor(15, 23, 42);
  const titleLines = doc.splitTextToSize(note.title, maxWidth);
  doc.text(titleLines, margin, y);
  y += titleLines.length * 20 + 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(`Subject: ${note.subject}   |   Saved: ${note.created_at}`, margin, y);
  y += 20;

  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y, margin + maxWidth, y);
  y += 22;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  const bodyLines = doc.splitTextToSize(note.content || "Attached study file note.", maxWidth);
  for (const line of bodyLines) {
    if (y > 760) {
      doc.addPage();
      y = 56;
    }
    doc.text(line, margin, y);
    y += 16;
  }

  const safeName = note.title.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  doc.save(`${safeName || "study_note"}.pdf`);
}

export function exportPassportAsPdf(passport: DigitalPassportData): void {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 46;
  const maxWidth = 500;
  let y = 54;

  const roleLabel =
    CAREER_ROLE_LABELS[passport.profile.target_role]?.label || passport.profile.target_role;

  doc.setFillColor(15, 76, 69);
  doc.rect(0, 0, 595, 86, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.text("StudentPulse AI · Digital Skill Passport", margin, 40);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(
    `${passport.profile.display_name} · ${passport.profile.branch || "CSE"} · Sem ${passport.profile.semester} · CGPA ${passport.profile.cgpa.toFixed(2)}`,
    margin,
    62
  );

  y = 114;
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(`Target Role: ${roleLabel}`, margin, y);
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(
    `Overall Readiness: ${passport.readiness_score}/100   |   Level ${passport.level} (${passport.xp_points} XP)   |   Verified Skills: ${passport.verified_skills.length}`,
    margin,
    y
  );
  y += 24;

  const section = (heading: string, items: string[]) => {
    if (y > 720) {
      doc.addPage();
      y = 50;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(15, 76, 69);
    doc.text(heading, margin, y);
    y += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    if (items.length === 0) {
      doc.text("None recorded yet.", margin + 8, y);
      y += 18;
      return;
    }
    for (const item of items) {
      const lines = doc.splitTextToSize(`• ${item}`, maxWidth - 10);
      for (const l of lines) {
        if (y > 760) {
          doc.addPage();
          y = 50;
        }
        doc.text(l, margin + 8, y);
        y += 14;
      }
    }
    y += 10;
  };

  section(
    "Assessment & Project Verified Skills",
    passport.verified_skills.map((s) => `${s.label} — ${s.proficiency}% (${s.source.replace("_", " ")})`)
  );
  section(
    "Self-Reported Skills",
    passport.self_reported_skills.map((s) => `${s.label} — ${s.proficiency}% (self reported)`)
  );
  section(
    "Portfolio Projects",
    passport.projects.map((p) => `${p.title}: ${p.summary}`)
  );
  section(
    "Recent Assessments",
    passport.assessments.map((a) => `${a.assessment_title}: ${a.score_pct}% (${a.correct_count}/${a.total_count})`)
  );

  const safeName = passport.profile.display_name.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  doc.save(`${safeName}_skill_passport.pdf`);
}

export function exportAdminReportAsPdf(overview: AdminOverviewData): void {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 44;
  let y = 52;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(15, 76, 69);
  doc.text("StudentPulse AI · Cohort Readiness & Analytics Report", margin, y);
  y += 22;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `Students: ${overview.totals.students}  |  Avg Readiness: ${overview.totals.avg_readiness}/100  |  At-Risk: ${overview.totals.at_risk_students}  |  Assessments: ${overview.totals.assessments}`,
    margin,
    y
  );
  y += 24;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text("Department Breakdown", margin, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  for (const dept of overview.department_analytics) {
    doc.text(
      `• ${dept.department}: ${dept.student_count} student(s), Avg Readiness ${dept.avg_readiness}/100`,
      margin + 8,
      y
    );
    y += 15;
  }

  y += 14;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Student Cohort Readiness Roster", margin, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  for (const st of overview.student_reports) {
    if (y > 760) {
      doc.addPage();
      y = 50;
    }
    const status = st.needs_support ? "Needs Support" : "On Track";
    doc.text(
      `${st.display_name} (${st.branch || "CSE"}, Sem ${st.semester}, CGPA ${st.cgpa}) — Readiness ${st.readiness_score}/100 [${status}]`,
      margin + 6,
      y
    );
    y += 14;
  }

  doc.save("studentpulse_cohort_report.pdf");
}

export function exportAdminReportAsCsv(overview: AdminOverviewData): void {
  const headers = [
    "User ID",
    "Name",
    "Email",
    "Branch",
    "Semester",
    "CGPA",
    "Target Role",
    "Readiness Score",
    "XP",
    "Needs Support",
  ];
  const rows = overview.student_reports.map((s) => [
    s.user_id,
    `"${s.display_name.replace(/"/g, '""')}"`,
    `"${(s.email || "").replace(/"/g, '""')}"`,
    `"${(s.branch || "CSE").replace(/"/g, '""')}"`,
    s.semester,
    s.cgpa,
    s.target_role,
    s.readiness_score,
    s.xp_points ?? 0,
    s.needs_support ? "Yes" : "No",
  ]);
  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "studentpulse_cohort_report.csv";
  a.click();
  URL.revokeObjectURL(url);
}
