export type UserRole = "student" | "faculty" | "admin";

export type AppTab =
  | "dashboard"
  | "tasks_notes"
  | "skill_gap"
  | "assessments"
  | "roadmap"
  | "plan"
  | "evidence"
  | "mentor"
  | "interview"
  | "resume"
  | "jobs"
  | "portfolio"
  | "gamification"
  | "history"
  | "profile"
  | "faculty"
  | "admin"
  | "architecture";

export type CareerRole =
  | "fullstack_dev"
  | "ml_ai_engineer"
  | "python_backend"
  | "data_analyst"
  | "cloud_devops"
  | "ui_ux_product"
  | "cybersecurity_analyst";

export type ProjectLevel =
  | "none"
  | "academic_mini"
  | "deployed_fullstack"
  | "team_capstone";

export type InterviewPrepLevel = "beginner" | "practicing" | "mock_ready";

export type SkillKey =
  | "python"
  | "java_oop"
  | "js_ts"
  | "cpp_cp"
  | "dsa"
  | "system_design"
  | "react_ui"
  | "node_express"
  | "api_integration"
  | "ui_ux_figma"
  | "mobile_dev"
  | "git_collab"
  | "sql_db"
  | "ml_basics"
  | "prompt_eng"
  | "data_viz"
  | "cloud_deploy"
  | "docker_cicd"
  | "testing_qa"
  | "cyber_sec"
  | "tech_comm"
  | "problem_solving"
  | "agile_team"
  | "interview_story";

export type ActionStatus = "completed" | "in_progress" | "skipped";

export const BRANCH_OPTIONS = [
  "CSE",
  "IT",
  "CSE (AI & ML)",
  "CSE (Data Science)",
  "ECE",
  "MCA / BCA",
  "Other",
] as const;

export interface StudentProfile {
  user_id: number;
  display_name: string;
  email?: string;
  branch?: string;
  role?: UserRole;
  target_role: CareerRole;
  semester: number;
  cgpa: number;
  xp_points?: number;
  streak_days?: number;
  communication_score?: number;
  bio?: string;
  github_username?: string;
  linkedin_url?: string;
  is_active?: boolean;
  created_at: string;
}

export interface ActionStep {
  title: string;
  hours: number;
  focus_skill: string;
  category: string;
  deliverable: string;
  rationale: string;
  completed?: boolean;
}

export interface InterviewQuestion {
  question: string;
  topic: string;
  hint: string;
  difficulty?: string;
}

export interface ReadinessMetrics {
  overall_score: number;
  readiness_band: string;
  pillars: {
    academic: number;
    technical_skills: number;
    projects: number;
    interview_prep: number;
  };
  matched_skills: SkillKey[];
  skill_gaps: SkillKey[];
  benchmark_total: number;
}

export interface RoleComparisonItem {
  role_key: CareerRole;
  role_label: string;
  overall_score: number;
  readiness_band: string;
  matched_count: number;
  benchmark_total: number;
  top_gaps: string[];
}

export interface StudentProject {
  project_id: number;
  user_id: number;
  title: string;
  summary: string;
  tech_stack: SkillKey[];
  repo_url: string;
  live_url: string;
  has_tests: boolean;
  status?: "completed" | "in_progress";
  attachment_name?: string;
  attachment_path?: string;
  github_stars?: number;
  created_at: string;
}

export interface ReadinessTrendPoint {
  snapshot_id: number;
  computed_readiness: number;
  assessment_score: number;
  coding_score: number;
  interview_score: number;
  project_count: number;
  created_at: string;
}

export interface EvidenceSnapshot {
  snapshot_id: number;
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
  computed_readiness: number;
  skill_gaps: SkillKey[];
  created_at: string;
}

export interface ActionPlan {
  plan_id: number;
  snapshot_id: number;
  title: string;
  total_hours: number;
  readiness_summary: string;
  action_steps: ActionStep[];
  interview_questions: InterviewQuestion[];
  explanation: string;
  safety_note: string;
  source: "gemini_ai_hybrid" | "python_rule_fallback";
  metrics: ReadinessMetrics;
  role_comparison?: RoleComparisonItem[];
  created_at: string;
}

export interface InterviewEvaluation {
  score: number;
  verdict: string;
  feedback: string;
  suggested_focus: string;
  source: string;
}

export interface CompletionRecord {
  completion_id: number;
  user_id: number;
  display_name: string;
  target_role: CareerRole;
  plan_id: number;
  status: ActionStatus;
  notes: string;
  completed_at: string;
  title: string;
  total_hours: number;
  source: string;
  computed_readiness: number;
  weekly_study_hours: number;
  project_level: ProjectLevel;
}

export interface DailyTask {
  task_id: number;
  user_id: number;
  title: string;
  category: string;
  priority: "low" | "medium" | "high";
  target_date: string;
  completed: boolean;
  attachment_name: string;
  attachment_path: string;
  xp_reward: number;
  created_at: string;
}

export interface StudyNote {
  note_id: number;
  user_id: number;
  title: string;
  subject: string;
  content: string;
  file_name: string;
  file_path: string;
  mime_type: string;
  file_size: number;
  created_at: string;
}

export interface SkillRecordItem {
  skill_key: SkillKey;
  label: string;
  proficiency: number;
  source: "assessment_verified" | "project_verified" | "self_reported" | "none";
  verified_score: number;
  required_for_role: boolean;
}

export interface SkillComparisonItem {
  skill_key: SkillKey;
  label: string;
  current: number;
  target: number;
  gap_pct: number;
  source: string;
}

export interface StudentSkillProfile {
  target_role: CareerRole;
  target_role_label: string;
  skills: SkillRecordItem[];
  comparison: SkillComparisonItem[];
  missing_skills: SkillComparisonItem[];
  strengths: SkillComparisonItem[];
  weaknesses: SkillComparisonItem[];
  overall_gap_pct: number;
  verified_count: number;
  self_reported_count: number;
}

export interface AssessmentItem {
  assessment_id: number;
  title: string;
  category: string;
  description: string;
  duration_minutes: number;
  skill_keys: SkillKey[];
  question_count?: number;
  questions?: Array<{
    question_id: number;
    prompt: string;
    options: string[];
    topic: string;
  }>;
}

export interface AssessmentResult {
  result_id: number;
  user_id: number;
  assessment_id: number;
  assessment_title: string;
  category: string;
  display_name?: string;
  score_pct: number;
  correct_count: number;
  total_count: number;
  weak_topics: string[];
  ai_feedback: string;
  time_taken_sec: number;
  created_at: string;
  review?: Array<{
    question_id: number;
    prompt: string;
    topic: string;
    chosen_index: number;
    correct_index: number;
    is_correct: boolean;
    explanation: string;
    options: string[];
  }>;
}

export interface CourseItem {
  course_id: number;
  title: string;
  provider: string;
  category: string;
  target_role: CareerRole;
  duration_hours: number;
  resource_url: string;
  skill_keys: SkillKey[];
  completed: boolean;
}

export interface MentorMessage {
  msg_id: number;
  user_id: number;
  sender: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface MockInterviewRecord {
  interview_id: number;
  user_id: number;
  target_role: string;
  mode: string;
  question: string;
  answer: string;
  technical_score: number;
  communication_score: number;
  quality_score: number;
  overall_score: number;
  feedback: string;
  improvements: string;
  source: string;
  created_at: string;
}

export interface ResumeAnalysisRecord {
  resume_id: number;
  user_id: number;
  file_name: string;
  file_path: string;
  extracted_text: string;
  target_role: string;
  job_description: string;
  ats_score: number;
  matched_keywords: string[];
  missing_keywords: string[];
  suggestions: string[];
  summary: string;
  created_at: string;
}

export interface JobOpportunity {
  job_id: number;
  title: string;
  company: string;
  location: string;
  work_mode: string;
  job_type: string;
  compensation: string;
  target_role: CareerRole;
  required_skills: SkillKey[];
  matched_skills: SkillKey[];
  missing_skills: SkillKey[];
  compatibility_score: number;
  description: string;
  apply_url: string;
  is_sample: boolean;
  application_status: "none" | "saved" | "applied" | "interviewing";
  posted_at: string;
}

export interface GamificationSummary {
  xp_points: number;
  level: number;
  next_level_xp: number;
  streak_days: number;
  badges: Array<{
    id: string;
    name: string;
    description: string;
    unlocked: boolean;
  }>;
  challenges: Array<{
    title: string;
    current: number;
    target: number;
    xp: number;
  }>;
  leaderboard: Array<{
    user_id: number;
    display_name: string;
    branch: string;
    xp_points: number;
    streak_days: number;
    target_role: CareerRole;
  }>;
}

export interface DigitalPassportData {
  profile: StudentProfile;
  readiness_score: number;
  verified_skills: SkillRecordItem[];
  self_reported_skills: SkillRecordItem[];
  projects: StudentProject[];
  assessments: AssessmentResult[];
  interviews: MockInterviewRecord[];
  completed_courses: CourseItem[];
  badges: GamificationSummary["badges"];
  xp_points: number;
  level: number;
}

export interface NotificationItem {
  notification_id: number;
  user_id: number;
  title: string;
  message: string;
  kind: string;
  is_read: boolean;
  created_at: string;
}

export interface FacultyFeedbackItem {
  feedback_id: number;
  student_id: number;
  faculty_id: number;
  faculty_name?: string;
  category: string;
  comment: string;
  created_at: string;
}

export interface FacultyOverviewData {
  students: Array<
    StudentProfile & {
      readiness_score: number;
      project_count: number;
      projects: StudentProject[];
      assessment_count: number;
      avg_assessment_score: number;
      needs_support: boolean;
      recent_feedback: FacultyFeedbackItem[];
    }
  >;
  assessments: AssessmentItem[];
  recent_results: AssessmentResult[];
}

export interface AdminOverviewData {
  totals: {
    total_users: number;
    students: number;
    faculty: number;
    assessments: number;
    courses: number;
    at_risk_students: number;
    avg_readiness: number;
  };
  users: StudentProfile[];
  student_reports: Array<
    StudentProfile & {
      readiness_score: number;
      skill_gaps: SkillKey[];
      needs_support: boolean;
    }
  >;
  at_risk_students: Array<
    StudentProfile & {
      readiness_score: number;
      skill_gaps: SkillKey[];
      needs_support: boolean;
    }
  >;
  department_analytics: Array<{
    department: string;
    student_count: number;
    avg_readiness: number;
  }>;
  settings: Record<string, string>;
}

export interface ArchitectureStats {
  stats: {
    engine: string;
    db_file: string;
    foreign_keys_enabled: boolean;
    table_counts: Record<string, number>;
  };
  python_server_mode?: string;
  ai_provider: string;
  ai_key_configured: boolean;
}

export interface PythonTestReport {
  passed: boolean;
  exitCode: number;
  output: string;
  tests: Array<{
    name: string;
    doc: string;
    status: string;
  }>;
}

export const CAREER_ROLE_LABELS: Record<CareerRole, { label: string; summary: string }> = {
  fullstack_dev: {
    label: "Full-Stack Software Developer",
    summary: "TypeScript, React UI, Node.js REST APIs, relational SQL schemas, and cloud deployment.",
  },
  ml_ai_engineer: {
    label: "AI & Machine Learning Engineer",
    summary: "Machine learning pipelines, generative AI prompting, model benchmarking, and API workflows.",
  },
  python_backend: {
    label: "Backend & API Systems Engineer",
    summary: "Java OOP, backend services, SQL modeling, system design, Docker, and automated testing.",
  },
  data_analyst: {
    label: "Data & Analytics Engineer",
    summary: "SQL analytics, statistical modeling, visual dashboards, and business problem solving.",
  },
  cloud_devops: {
    label: "Cloud & DevOps Engineer",
    summary: "Docker, CI/CD automation, cloud deployment, security hardening, and system reliability.",
  },
  ui_ux_product: {
    label: "UI/UX & Product Designer",
    summary: "Figma prototyping, responsive React UI, user research, communication, and Agile collaboration.",
  },
  cybersecurity_analyst: {
    label: "Cybersecurity & Network Analyst",
    summary: "AppSec auditing, secure authentication, network architecture, testing, and threat modeling.",
  },
};

export const PROJECT_LEVEL_LABELS: Record<ProjectLevel, { label: string; hint: string }> = {
  none: { label: "No Projects Yet", hint: "Coursework only; ready to build first artifact." },
  academic_mini: { label: "Academic Mini-Projects", hint: "Local prototypes, coursework, or lab builds." },
  deployed_fullstack: { label: "Deployed Full-Stack App", hint: "Live URL with backend API & database." },
  team_capstone: { label: "Team Capstone + Tests", hint: "Git collaboration, unit tests, and architecture docs." },
};

export const INTERVIEW_PREP_LABELS: Record<InterviewPrepLevel, { label: string; hint: string }> = {
  beginner: { label: "Early Stage", hint: "Reviewing fundamentals and project explanations." },
  practicing: { label: "Practicing Q&A", hint: "Solving DSA problems and technical questions." },
  mock_ready: { label: "Mock Tested", hint: "Completed timed mock interviews with feedback." },
};

export const SKILL_LABELS: Record<SkillKey, string> = {
  python: "Python Programming",
  java_oop: "Java & Object-Oriented Programming",
  js_ts: "JavaScript & TypeScript",
  cpp_cp: "C++ & Competitive Coding",
  dsa: "Data Structures & Algorithms",
  system_design: "System Design & Architecture",
  react_ui: "Frontend (React / HTML / CSS)",
  node_express: "Node.js & Express APIs",
  api_integration: "REST APIs & Backend Integration",
  ui_ux_figma: "UI/UX Design & Figma",
  mobile_dev: "Mobile Apps (Flutter / React Native)",
  git_collab: "Version Control (Git & GitHub)",
  sql_db: "SQL & Database Management",
  ml_basics: "Machine Learning & Deep Learning",
  prompt_eng: "Generative AI & Prompt Engineering",
  data_viz: "Data Analytics & Visualization",
  cloud_deploy: "Cloud Computing (AWS / GCP)",
  docker_cicd: "Docker, Linux & CI/CD",
  testing_qa: "Software Testing & QA Automation",
  cyber_sec: "Cybersecurity & App Security",
  tech_comm: "Technical Communication & Docs",
  problem_solving: "Analytical Problem Solving",
  agile_team: "Team Collaboration & Agile",
  interview_story: "Resume & Project Storytelling",
};

export const SKILL_CATEGORIES: Array<{
  id: string;
  label: string;
  skills: SkillKey[];
}> = [
  {
    id: "programming",
    label: "Programming & CS Core",
    skills: ["python", "java_oop", "js_ts", "cpp_cp", "dsa", "system_design"],
  },
  {
    id: "web_design",
    label: "Web, Mobile & Product Design",
    skills: ["react_ui", "node_express", "api_integration", "ui_ux_figma", "mobile_dev", "git_collab"],
  },
  {
    id: "data_cloud",
    label: "Data, AI & Cloud",
    skills: ["sql_db", "ml_basics", "prompt_eng", "data_viz", "cloud_deploy", "docker_cicd"],
  },
  {
    id: "quality_career",
    label: "Quality, Security & Career",
    skills: ["testing_qa", "cyber_sec", "tech_comm", "problem_solving", "agile_team", "interview_story"],
  },
];
