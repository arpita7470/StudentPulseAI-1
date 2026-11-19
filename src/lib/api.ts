import type {
  ActionPlan,
  ActionStatus,
  ActionStep,
  AdminOverviewData,
  ArchitectureStats,
  AssessmentItem,
  AssessmentResult,
  CareerRole,
  CompletionRecord,
  CourseItem,
  DailyTask,
  DigitalPassportData,
  EvidenceSnapshot,
  FacultyFeedbackItem,
  FacultyOverviewData,
  GamificationSummary,
  InterviewEvaluation,
  InterviewPrepLevel,
  InterviewQuestion,
  JobOpportunity,
  MentorMessage,
  MockInterviewRecord,
  NotificationItem,
  ProjectLevel,
  PythonTestReport,
  ReadinessTrendPoint,
  ResumeAnalysisRecord,
  RoleComparisonItem,
  SkillKey,
  StudentProfile,
  StudentProject,
  StudentSkillProfile,
  StudyNote,
  UserRole,
} from "../types/studentpulse";

export class ApiError extends Error {
  fieldErrors: Record<string, string>;

  constructor(message: string, fieldErrors: Record<string, string> = {}) {
    super(message);
    this.name = "ApiError";
    this.fieldErrors = fieldErrors;
  }
}

const STORAGE_KEY = "studentpulse_user_id";

function getActorHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const uid = window.localStorage.getItem(STORAGE_KEY);
  return uid ? { "X-User-Id": uid } : {};
}

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...getActorHeaders(),
      ...(options?.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(
      data?.error || `Request failed (${response.status})`,
      data?.field_errors || {}
    );
  }
  return data as T;
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read selected file."));
    reader.readAsDataURL(file);
  });
}

export function getFileDownloadUrl(relativePath: string): string {
  return `/api/files/download?path=${encodeURIComponent(relativePath)}`;
}

// Profiles & Authentication
export async function fetchProfiles(): Promise<StudentProfile[]> {
  const res = await requestJson<{ profiles: StudentProfile[] }>("/api/profiles");
  return res.profiles;
}

export async function signupStudent(payload: {
  display_name: string;
  email: string;
  password: string;
  branch: string;
  role?: "student" | "faculty";
  target_role: CareerRole;
  semester: number;
  cgpa: number;
}): Promise<StudentProfile> {
  const res = await requestJson<{ profile: StudentProfile }>("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.profile;
}

export async function signinStudent(payload: {
  email: string;
  password: string;
}): Promise<StudentProfile> {
  const res = await requestJson<{ profile: StudentProfile }>("/api/auth/signin", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.profile;
}

export async function forgotPasswordReset(payload: {
  email: string;
  new_password: string;
}): Promise<{ reset: boolean; message: string }> {
  return requestJson("/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createProfile(payload: {
  display_name: string;
  target_role: CareerRole;
  semester: number;
  cgpa: number;
  email?: string;
  branch?: string;
}): Promise<StudentProfile> {
  const res = await requestJson<{ profile: StudentProfile }>("/api/profiles", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.profile;
}

export async function updateProfile(
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
): Promise<StudentProfile> {
  const res = await requestJson<{ profile: StudentProfile }>(`/api/profiles/${userId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return res.profile;
}

// Skill Gap Analyzer
export async function fetchSkillProfile(userId: number): Promise<StudentSkillProfile> {
  return requestJson<StudentSkillProfile>(`/api/profiles/${userId}/skill-profile`);
}

export async function saveStudentSkills(
  userId: number,
  skills: Array<{ skill_key: SkillKey; proficiency: number }>
): Promise<StudentSkillProfile> {
  return requestJson<StudentSkillProfile>(`/api/profiles/${userId}/skills`, {
    method: "POST",
    body: JSON.stringify({ skills }),
  });
}

export async function fetchAiSkillRecommendations(userId: number): Promise<{
  summary: string;
  priority_focus: string;
  recommendations: string[];
}> {
  return requestJson("/api/ai/skill-recommendations", {
    method: "POST",
    body: JSON.stringify({ user_id: userId }),
  });
}

// Daily Tasks
export async function fetchTasks(userId: number): Promise<DailyTask[]> {
  const res = await requestJson<{ tasks: DailyTask[] }>(`/api/tasks?user_id=${userId}`);
  return res.tasks;
}

export async function createTask(payload: {
  user_id: number;
  title: string;
  category: string;
  priority: "low" | "medium" | "high";
  target_date?: string;
  attachment_name?: string;
  attachment_base64?: string;
}): Promise<DailyTask> {
  const res = await requestJson<{ task: DailyTask }>("/api/tasks", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.task;
}

export async function toggleTask(taskId: number): Promise<DailyTask> {
  const res = await requestJson<{ task: DailyTask }>(`/api/tasks/${taskId}/toggle`, {
    method: "POST",
  });
  return res.task;
}

export async function deleteTask(taskId: number): Promise<void> {
  await requestJson(`/api/tasks/${taskId}`, { method: "DELETE" });
}

// Study Notes & PDF Vault
export async function fetchNotes(userId: number): Promise<StudyNote[]> {
  const res = await requestJson<{ notes: StudyNote[] }>(`/api/notes?user_id=${userId}`);
  return res.notes;
}

export async function createNote(payload: {
  user_id: number;
  title: string;
  subject: string;
  content: string;
  file_name?: string;
  mime_type?: string;
  file_base64?: string;
}): Promise<StudyNote> {
  const res = await requestJson<{ note: StudyNote }>("/api/notes", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.note;
}

export async function deleteNote(noteId: number): Promise<void> {
  await requestJson(`/api/notes/${noteId}`, { method: "DELETE" });
}

// Smart Assessments
export async function fetchAssessments(): Promise<AssessmentItem[]> {
  const res = await requestJson<{ assessments: AssessmentItem[] }>("/api/assessments");
  return res.assessments;
}

export async function fetchAssessmentDetail(assessmentId: number): Promise<AssessmentItem> {
  const res = await requestJson<{ assessment: AssessmentItem }>(`/api/assessments/${assessmentId}`);
  return res.assessment;
}

export async function createAssessment(payload: {
  title: string;
  category: string;
  description: string;
  duration_minutes: number;
  skill_keys: SkillKey[];
  created_by?: number;
  questions: Array<{
    prompt: string;
    options: string[];
    correct_index: number;
    topic: string;
    explanation?: string;
  }>;
}): Promise<AssessmentItem> {
  const res = await requestJson<{ assessment: AssessmentItem }>("/api/assessments", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.assessment;
}

export async function submitAssessment(
  assessmentId: number,
  payload: { user_id: number; answers: number[]; time_taken_sec: number }
): Promise<AssessmentResult> {
  const res = await requestJson<{ result: AssessmentResult }>(
    `/api/assessments/${assessmentId}/submit`,
    { method: "POST", body: JSON.stringify(payload) }
  );
  return res.result;
}

export async function fetchAssessmentResults(userId?: number): Promise<AssessmentResult[]> {
  const q = userId ? `?user_id=${userId}` : "";
  const res = await requestJson<{ results: AssessmentResult[] }>(`/api/assessment-results${q}`);
  return res.results;
}

export async function fetchAiAssessmentFeedback(payload: {
  result_id: number;
  assessment_title: string;
  score_pct: number;
  weak_topics: string[];
}): Promise<string> {
  const res = await requestJson<{ ai_feedback: string }>("/api/ai/assessment-feedback", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.ai_feedback;
}

// Courses
export async function fetchCourses(userId?: number): Promise<CourseItem[]> {
  const q = userId ? `?user_id=${userId}` : "";
  const res = await requestJson<{ courses: CourseItem[] }>(`/api/courses${q}`);
  return res.courses;
}

export async function createCourse(payload: {
  title: string;
  provider: string;
  category: string;
  target_role: CareerRole;
  duration_hours: number;
  resource_url: string;
  skill_keys: SkillKey[];
}): Promise<CourseItem> {
  const res = await requestJson<{ course: CourseItem }>("/api/courses", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.course;
}

export async function toggleCourseProgress(
  courseId: number,
  userId: number
): Promise<{ course_id: number; completed: boolean }> {
  return requestJson(`/api/courses/${courseId}/toggle`, {
    method: "POST",
    body: JSON.stringify({ user_id: userId }),
  });
}

// AI Career Mentor
export async function fetchMentorMessages(userId: number): Promise<MentorMessage[]> {
  const res = await requestJson<{ messages: MentorMessage[] }>(
    `/api/mentor/messages?user_id=${userId}`
  );
  return res.messages;
}

export async function sendMentorMessage(
  userId: number,
  message: string
): Promise<{ reply: string; messages: MentorMessage[] }> {
  return requestJson("/api/ai/mentor", {
    method: "POST",
    body: JSON.stringify({ user_id: userId, message }),
  });
}

export async function clearMentorMessages(userId: number): Promise<void> {
  await requestJson(`/api/mentor/messages?user_id=${userId}`, { method: "DELETE" });
}

// AI Mock Interview
export async function fetchMockInterviews(userId: number): Promise<MockInterviewRecord[]> {
  const res = await requestJson<{ interviews: MockInterviewRecord[] }>(
    `/api/interviews?user_id=${userId}`
  );
  return res.interviews;
}

export async function generateInterviewQuestions(payload: {
  target_role: string;
  mode: "technical" | "hr";
  focus_skills?: string[];
}): Promise<InterviewQuestion[]> {
  const res = await requestJson<{ questions: InterviewQuestion[] }>(
    "/api/ai/interview-questions",
    { method: "POST", body: JSON.stringify(payload) }
  );
  return res.questions;
}

export async function evaluateMockInterview(payload: {
  user_id: number;
  target_role: CareerRole;
  mode: "technical" | "hr";
  question: string;
  answer: string;
  hint: string;
}): Promise<MockInterviewRecord> {
  const res = await requestJson<{ interview: MockInterviewRecord }>(
    "/api/ai/interview-evaluate",
    { method: "POST", body: JSON.stringify(payload) }
  );
  return res.interview;
}

// AI Resume Analyzer
export async function fetchResumes(userId: number): Promise<ResumeAnalysisRecord[]> {
  const res = await requestJson<{ resumes: ResumeAnalysisRecord[] }>(
    `/api/resumes?user_id=${userId}`
  );
  return res.resumes;
}

export async function analyzeResume(payload: {
  user_id: number;
  target_role: CareerRole;
  job_description: string;
  resume_text?: string;
  file_name?: string;
  file_base64?: string;
}): Promise<ResumeAnalysisRecord> {
  const res = await requestJson<{ resume: ResumeAnalysisRecord }>("/api/ai/resume-analyze", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.resume;
}

// LinkedIn-style Job Updates
export async function fetchJobs(userId: number): Promise<JobOpportunity[]> {
  const res = await requestJson<{ jobs: JobOpportunity[] }>(`/api/jobs?user_id=${userId}`);
  return res.jobs;
}

export async function setJobStatus(
  jobId: number,
  userId: number,
  status: "none" | "saved" | "applied" | "interviewing"
): Promise<{ job_id: number; status: string }> {
  return requestJson(`/api/jobs/${jobId}/status`, {
    method: "POST",
    body: JSON.stringify({ user_id: userId, status }),
  });
}

export async function createJobOpportunity(payload: {
  title: string;
  company: string;
  location: string;
  work_mode: string;
  job_type: string;
  compensation: string;
  target_role: CareerRole;
  required_skills: SkillKey[];
  description: string;
  apply_url?: string;
}): Promise<JobOpportunity> {
  const res = await requestJson<{ job: JobOpportunity }>("/api/jobs", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.job;
}

// Gamification, Passport & Notifications
export async function fetchGamification(userId: number): Promise<GamificationSummary> {
  return requestJson<GamificationSummary>(`/api/gamification?user_id=${userId}`);
}

export async function fetchDigitalPassport(userId: number): Promise<DigitalPassportData> {
  const res = await requestJson<{ passport: DigitalPassportData }>(`/api/passport/${userId}`);
  return res.passport;
}

export async function fetchNotifications(userId: number): Promise<{
  notifications: NotificationItem[];
  faculty_feedback: FacultyFeedbackItem[];
}> {
  return requestJson(`/api/notifications?user_id=${userId}`);
}

export async function markNotificationsRead(userId: number): Promise<void> {
  await requestJson("/api/notifications/read", {
    method: "POST",
    body: JSON.stringify({ user_id: userId }),
  });
}

// Faculty & Admin RBAC
export async function fetchFacultyOverview(): Promise<FacultyOverviewData> {
  return requestJson<FacultyOverviewData>("/api/faculty/overview");
}

export async function postFacultyFeedback(payload: {
  student_id: number;
  faculty_id: number;
  category: string;
  comment: string;
}): Promise<FacultyFeedbackItem> {
  const res = await requestJson<{ feedback: FacultyFeedbackItem }>("/api/faculty/feedback", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.feedback;
}

export async function fetchAdminOverview(): Promise<AdminOverviewData> {
  return requestJson<AdminOverviewData>("/api/admin/overview");
}

export async function adminUpdateUser(
  userId: number,
  payload: { role: UserRole; branch: string; is_active: boolean }
): Promise<StudentProfile> {
  const res = await requestJson<{ user: StudentProfile }>(`/api/admin/users/${userId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return res.user;
}

export async function updateAdminSettings(
  updates: Record<string, string>
): Promise<Record<string, string>> {
  const res = await requestJson<{ settings: Record<string, string> }>("/api/admin/settings", {
    method: "PUT",
    body: JSON.stringify(updates),
  });
  return res.settings;
}

// GitHub Repo Stars Fetch
export async function fetchGithubRepoMeta(url: string): Promise<{
  full_name: string;
  stars: number;
  forks: number;
  language: string;
  description: string;
}> {
  return requestJson(`/api/github/repo?url=${encodeURIComponent(url)}`);
}

// Existing Readiness & Plan, Projects, History & Architecture Endpoints
export async function generateReadinessPlan(payload: {
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
}): Promise<{
  plan: ActionPlan;
  ai_notice: string | null;
  transmitted_fields: Record<string, unknown>;
}> {
  return requestJson("/api/readiness-plans", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchAlternativeTasks(planId: number): Promise<ActionStep[]> {
  const res = await requestJson<{ alternatives: ActionStep[] }>(
    `/api/readiness-plans/${planId}/alternatives`
  );
  return res.alternatives;
}

export async function modifyActionPlan(
  planId: number,
  payload: {
    action: "swap_task" | "compress_hours" | "focus_interview";
    swap_index?: number;
    replacement?: ActionStep;
  }
): Promise<ActionPlan> {
  const res = await requestJson<{ plan: ActionPlan }>(
    `/api/readiness-plans/${planId}/modify`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
  return res.plan;
}

export async function evaluateInterviewAnswer(payload: {
  question: string;
  answer: string;
  hint: string;
}): Promise<{ evaluation: InterviewEvaluation; ai_notice: string | null }> {
  return requestJson("/api/interview-feedback", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function recordCompletion(payload: {
  user_id: number;
  plan_id: number;
  status: ActionStatus;
  notes: string;
}): Promise<CompletionRecord> {
  const res = await requestJson<{ completion: CompletionRecord }>("/api/completions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.completion;
}

export async function fetchHistory(userId?: number): Promise<CompletionRecord[]> {
  const query = userId ? `?user_id=${userId}` : "";
  const res = await requestJson<{ history: CompletionRecord[] }>(`/api/history${query}`);
  return res.history;
}

export async function fetchArchitectureStats(): Promise<ArchitectureStats> {
  return requestJson<ArchitectureStats>("/api/architecture/stats");
}

export async function runPythonTestSuite(): Promise<PythonTestReport> {
  return requestJson<PythonTestReport>("/api/architecture/run-tests", {
    method: "POST",
  });
}

export async function fetchProjects(userId: number): Promise<StudentProject[]> {
  const res = await requestJson<{ projects: StudentProject[] }>(
    `/api/projects?user_id=${userId}`
  );
  return res.projects;
}

export async function createProject(payload: {
  user_id: number;
  title: string;
  summary: string;
  tech_stack: SkillKey[];
  repo_url: string;
  live_url: string;
  has_tests: boolean;
  status?: "completed" | "in_progress";
  attachment_name?: string;
  attachment_base64?: string;
  github_stars?: number;
}): Promise<StudentProject> {
  const res = await requestJson<{ project: StudentProject }>("/api/projects", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.project;
}

export async function deleteProject(projectId: number): Promise<void> {
  await requestJson(`/api/projects/${projectId}`, { method: "DELETE" });
}

export async function toggleActionStep(
  planId: number,
  stepIndex: number
): Promise<ActionPlan> {
  const res = await requestJson<{ plan: ActionPlan }>(
    `/api/readiness-plans/${planId}/toggle-step`,
    {
      method: "POST",
      body: JSON.stringify({ step_index: stepIndex }),
    }
  );
  return res.plan;
}

export async function fetchRoleComparison(userId: number): Promise<{
  comparison: RoleComparisonItem[];
  has_snapshot: boolean;
}> {
  return requestJson(`/api/profiles/${userId}/role-comparison`);
}

export async function fetchReadinessTrend(userId: number): Promise<ReadinessTrendPoint[]> {
  const res = await requestJson<{ trend: ReadinessTrendPoint[] }>(
    `/api/profiles/${userId}/trend`
  );
  return res.trend;
}

export async function fetchLatestPlan(userId: number): Promise<{
  plan: ActionPlan | null;
  snapshot: EvidenceSnapshot | null;
}> {
  return requestJson(`/api/profiles/${userId}/latest-plan`);
}
