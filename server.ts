import "dotenv/config";
import express from "express";
import type { Request, Response } from "express";
import { spawn, type ChildProcess } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";

const PORT = Number(process.env.PORT || 3000);
const PYTHON_PORT = Number(process.env.PYTHON_API_PORT || 8001);
const PYTHON_BASE_URL = `http://127.0.0.1:${PYTHON_PORT}`;
const ROOT_DIR = process.cwd();
const UPLOADS_DIR = path.resolve(ROOT_DIR, "uploads");
const ALLOWED_UPLOAD_FOLDERS = new Set(["notes", "resumes", "tasks", "projects"]);

for (const folder of ALLOWED_UPLOAD_FOLDERS) {
  fs.mkdirSync(path.join(UPLOADS_DIR, folder), { recursive: true });
}

let pythonProcess: ChildProcess | null = null;

function startPythonServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    pythonProcess = spawn("python3", ["-m", "python.server", "--port", String(PYTHON_PORT)], {
      cwd: ROOT_DIR,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let settled = false;
    pythonProcess.stdout?.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      if (!settled && text.includes("listening on")) {
        settled = true;
        resolve();
      }
    });

    pythonProcess.stderr?.on("data", (chunk: Buffer) => {
      console.error("[python.server]", chunk.toString().trim());
    });

    pythonProcess.on("exit", (code) => {
      if (!settled) {
        settled = true;
        reject(new Error(`Python API server exited early with code ${code}`));
      }
    });

    const start = Date.now();
    const poll = async () => {
      if (settled) return;
      try {
        const res = await fetch(`${PYTHON_BASE_URL}/api/health`);
        if (res.ok && !settled) {
          settled = true;
          resolve();
          return;
        }
      } catch {
        // Retry
      }
      if (Date.now() - start > 6000 && !settled) {
        settled = true;
        resolve();
      } else if (!settled) {
        setTimeout(poll, 120);
      }
    };
    setTimeout(poll, 120);
  });
}

async function callPythonHttp<T = any>(
  apiPath: string,
  method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
  body?: unknown,
  extraHeaders?: Record<string, string>
): Promise<{ status: number; data: T }> {
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(extraHeaders || {}) };
  const response = await fetch(`${PYTHON_BASE_URL}${apiPath}`, {
    method,
    headers,
    body: body !== undefined && method !== "GET" ? JSON.stringify(body) : undefined,
  });
  const data = (await response.json().catch(() => ({}))) as T;
  return { status: response.status, data };
}

function saveBase64Upload(
  folder: "notes" | "resumes" | "tasks" | "projects",
  originalName: string,
  base64Data: string
): { fileName: string; relativePath: string; size: number; buffer: Buffer } {
  const cleanedBase64 = base64Data.includes(",") ? base64Data.split(",", 2)[1] : base64Data;
  const buffer = Buffer.from(cleanedBase64, "base64");
  if (buffer.length === 0) {
    throw new Error("Uploaded file appears to be empty.");
  }
  if (buffer.length > 10 * 1024 * 1024) {
    throw new Error("Uploaded file exceeds 10 MB limit.");
  }
  const safeBase = path
    .basename(originalName || "document.pdf")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 80);
  const stamp = `${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
  const storedName = `${stamp}-${safeBase}`;
  const absPath = path.join(UPLOADS_DIR, folder, storedName);
  fs.writeFileSync(absPath, buffer);
  return {
    fileName: safeBase,
    relativePath: `${folder}/${storedName}`,
    size: buffer.length,
    buffer,
  };
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

function requireGeminiClient(): GoogleGenAI {
  const ai = getGeminiClient();
  if (!ai) {
    throw new Error("GEMINI_API_KEY is not configured on the server. Add it in Secrets to enable AI features.");
  }
  return ai;
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  const timer = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s.`)), ms)
  );
  return Promise.race([promise, timer]);
}

async function generatePlanWithGemini(systemInstruction: string, userPrompt: string): Promise<string> {
  const ai = requireGeminiClient();
  const response = await withTimeout(
    ai.models.generateContent({
      model: "gemini-4-hydrogen",
      contents: userPrompt,
      config: {
        systemInstruction,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            total_hours: { type: Type.INTEGER },
            readiness_summary: { type: Type.STRING },
            action_steps: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  hours: { type: Type.INTEGER },
                  focus_skill: { type: Type.STRING },
                  category: { type: Type.STRING },
                  deliverable: { type: Type.STRING },
                  rationale: { type: Type.STRING },
                },
                required: ["title", "hours", "focus_skill", "category", "deliverable", "rationale"],
              },
            },
            interview_questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING },
                  topic: { type: Type.STRING },
                  hint: { type: Type.STRING },
                },
                required: ["question", "topic", "hint"],
              },
            },
            explanation: { type: Type.STRING },
          },
          required: [
            "title",
            "total_hours",
            "readiness_summary",
            "action_steps",
            "interview_questions",
            "explanation",
          ],
        },
      },
    }),
    15000,
    "AI readiness plan generation"
  );
  if (!response.text) {
    throw new Error("Empty text returned by AI model.");
  }
  return response.text;
}

async function evaluateInterviewWithGemini(
  question: string,
  answer: string,
  hint: string
): Promise<{ score: number; verdict: string; feedback: string; suggested_focus: string; source: string }> {
  const ai = requireGeminiClient();
  const response = await withTimeout(
    ai.models.generateContent({
      model: "gemini-4-hydrogen",
      contents: `Interview Question: ${question}\nExpected Key Concepts: ${hint}\nStudent Answer: ${answer}`,
      config: {
        systemInstruction:
          "You are a constructive technical interviewer evaluating a college student's mock answer. Return JSON with score (0-100 integer), verdict (short phrase), feedback (2-3 actionable sentences), and suggested_focus (1 concise sentence).",
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.INTEGER },
            verdict: { type: Type.STRING },
            feedback: { type: Type.STRING },
            suggested_focus: { type: Type.STRING },
          },
          required: ["score", "verdict", "feedback", "suggested_focus"],
        },
      },
    }),
    15000,
    "AI interview feedback"
  );
  const parsed = JSON.parse(response.text || "{}");
  return {
    score: Math.max(0, Math.min(100, Number(parsed.score) || 70)),
    verdict: String(parsed.verdict || "Constructive Review"),
    feedback: String(parsed.feedback || "Good effort; tie your explanation to a concrete project."),
    suggested_focus: String(parsed.suggested_focus || hint),
    source: "gemini_ai_feedback",
  };
}

async function proxyToPython(req: Request, res: Response, targetPath?: string) {
  try {
    const queryIndex = req.originalUrl.indexOf("?");
    const query = queryIndex >= 0 ? req.originalUrl.slice(queryIndex) : "";
    const apiPath = `${targetPath || req.path}${query}`;
    const method = req.method as "GET" | "POST" | "PUT" | "DELETE";
    const actorHeader: Record<string, string> = {};
    const uid = req.header("x-user-id");
    if (uid) actorHeader["X-User-Id"] = uid;

    const result = await callPythonHttp(
      apiPath,
      method,
      method === "GET" ? undefined : req.body,
      actorHeader
    );
    res.status(result.status).json(result.data);
  } catch (err: any) {
    res.status(502).json({ error: err?.message || "Python backend service unavailable." });
  }
}

async function startServer() {
  await startPythonServer();

  const app = express();
  app.use(express.json({ limit: "15mb" }));

  // Binary File Download (strictly contained in UPLOADS_DIR)
  app.get("/api/files/download", (req: Request, res: Response) => {
    const rel = String(req.query.path || "").trim();
    if (!rel) {
      res.status(400).json({ error: "File path query parameter is required." });
      return;
    }
    const cleanRel = rel.replace(/^\/+/, "");
    const resolved = path.resolve(UPLOADS_DIR, cleanRel);
    if (!resolved.startsWith(UPLOADS_DIR + path.sep) || !fs.existsSync(resolved)) {
      res.status(404).json({ error: "Requested file not found." });
      return;
    }
    const downloadName = path.basename(resolved).replace(/^\d+-[a-f0-9]+-/, "");
    res.download(resolved, downloadName);
  });

  // Auth & Profile Routes
  app.post("/api/auth/signup", (req, res) => proxyToPython(req, res));
  app.post("/api/auth/signin", (req, res) => proxyToPython(req, res));
  app.post("/api/auth/forgot-password", (req, res) => proxyToPython(req, res));

  app.get("/api/profiles", (req, res) => proxyToPython(req, res));
  app.post("/api/profiles", (req, res) => proxyToPython(req, res));
  app.put("/api/profiles/:id", (req, res) => proxyToPython(req, res));
  app.get("/api/profiles/:id/role-comparison", (req, res) => proxyToPython(req, res));
  app.get("/api/profiles/:id/trend", (req, res) => proxyToPython(req, res));
  app.get("/api/profiles/:id/latest-plan", (req, res) => proxyToPython(req, res));
  app.get("/api/profiles/:id/skill-profile", (req, res) => proxyToPython(req, res));
  app.post("/api/profiles/:id/skills", (req, res) => proxyToPython(req, res));

  // Projects (supports optional base64 document/screenshot attachment)
  app.get("/api/projects", (req, res) => proxyToPython(req, res));
  app.post("/api/projects", async (req: Request, res: Response) => {
    try {
      const payload = { ...(req.body || {}) };
      if (payload.attachment_base64 && payload.attachment_name) {
        const saved = saveBase64Upload("projects", String(payload.attachment_name), String(payload.attachment_base64));
        payload.attachment_name = saved.fileName;
        payload.attachment_path = saved.relativePath;
        delete payload.attachment_base64;
      }
      const result = await callPythonHttp("/api/projects", "POST", payload);
      res.status(result.status).json(result.data);
    } catch (err: any) {
      res.status(400).json({ error: err?.message || "Could not save project." });
    }
  });
  app.delete("/api/projects/:id", (req, res) => proxyToPython(req, res));

  // Daily Tasks (supports optional attachment)
  app.get("/api/tasks", (req, res) => proxyToPython(req, res));
  app.post("/api/tasks", async (req: Request, res: Response) => {
    try {
      const payload = { ...(req.body || {}) };
      if (payload.attachment_base64 && payload.attachment_name) {
        const saved = saveBase64Upload("tasks", String(payload.attachment_name), String(payload.attachment_base64));
        payload.attachment_name = saved.fileName;
        payload.attachment_path = saved.relativePath;
        delete payload.attachment_base64;
      }
      const result = await callPythonHttp("/api/tasks", "POST", payload);
      res.status(result.status).json(result.data);
    } catch (err: any) {
      res.status(400).json({ error: err?.message || "Could not create daily task." });
    }
  });
  app.post("/api/tasks/:id/toggle", (req, res) => proxyToPython(req, res));
  app.delete("/api/tasks/:id", (req, res) => proxyToPython(req, res));

  // Study Notes & PDF Vault (supports real PDF/doc upload & download)
  app.get("/api/notes", (req, res) => proxyToPython(req, res));
  app.get("/api/notes/:id", (req, res) => proxyToPython(req, res));
  app.post("/api/notes", async (req: Request, res: Response) => {
    try {
      const payload = { ...(req.body || {}) };
      if (payload.file_base64 && payload.file_name) {
        const saved = saveBase64Upload("notes", String(payload.file_name), String(payload.file_base64));
        payload.file_name = saved.fileName;
        payload.file_path = saved.relativePath;
        payload.file_size = saved.size;
        delete payload.file_base64;
      }
      const result = await callPythonHttp("/api/notes", "POST", payload);
      res.status(result.status).json(result.data);
    } catch (err: any) {
      res.status(400).json({ error: err?.message || "Could not save study note." });
    }
  });
  app.delete("/api/notes/:id", (req, res) => proxyToPython(req, res));

  // Assessments, Courses, Jobs, Gamification, Passport, Notifications
  app.get("/api/assessments", (req, res) => proxyToPython(req, res));
  app.get("/api/assessments/:id", (req, res) => proxyToPython(req, res));
  app.post("/api/assessments", (req, res) => proxyToPython(req, res));
  app.post("/api/assessments/:id/submit", (req, res) => proxyToPython(req, res));
  app.get("/api/assessment-results", (req, res) => proxyToPython(req, res));

  app.get("/api/courses", (req, res) => proxyToPython(req, res));
  app.post("/api/courses", (req, res) => proxyToPython(req, res));
  app.post("/api/courses/:id/toggle", (req, res) => proxyToPython(req, res));

  app.get("/api/mentor/messages", (req, res) => proxyToPython(req, res));
  app.delete("/api/mentor/messages", (req, res) => proxyToPython(req, res));
  app.get("/api/interviews", (req, res) => proxyToPython(req, res));
  app.get("/api/resumes", (req, res) => proxyToPython(req, res));

  app.get("/api/jobs", (req, res) => proxyToPython(req, res));
  app.post("/api/jobs", (req, res) => proxyToPython(req, res));
  app.post("/api/jobs/:id/status", (req, res) => proxyToPython(req, res));

  app.get("/api/gamification", (req, res) => proxyToPython(req, res));
  app.get("/api/passport/:id", (req, res) => proxyToPython(req, res));
  app.get("/api/notifications", (req, res) => proxyToPython(req, res));
  app.post("/api/notifications/read", (req, res) => proxyToPython(req, res));

  // Faculty & Admin RBAC Routes
  app.get("/api/faculty/overview", (req, res) => proxyToPython(req, res));
  app.post("/api/faculty/feedback", (req, res) => proxyToPython(req, res));
  app.get("/api/admin/overview", (req, res) => proxyToPython(req, res));
  app.put("/api/admin/users/:id", (req, res) => proxyToPython(req, res));
  app.get("/api/admin/settings", (req, res) => proxyToPython(req, res));
  app.put("/api/admin/settings", (req, res) => proxyToPython(req, res));

  // Readiness Plans & History
  app.get("/api/readiness-plans/:id/alternatives", (req, res) => proxyToPython(req, res));
  app.post("/api/readiness-plans/:id/modify", (req, res) => proxyToPython(req, res));
  app.post("/api/readiness-plans/:id/toggle-step", (req, res) => proxyToPython(req, res));
  app.post("/api/completions", (req, res) => proxyToPython(req, res));
  app.get("/api/history", (req, res) => proxyToPython(req, res));
  app.post("/api/architecture/run-tests", (req, res) => proxyToPython(req, res));

  // GitHub Repo Metadata Fetcher
  app.get("/api/github/repo", async (req: Request, res: Response) => {
    try {
      const repoUrl = String(req.query.url || "").trim();
      const match = repoUrl.match(/github\.com\/([^/\s]+)\/([^/\s#?]+)/i);
      if (!match) {
        res.status(400).json({ error: "Enter a valid GitHub repository URL (https://github.com/owner/repo)." });
        return;
      }
      const owner = match[1];
      const repo = match[2].replace(/\.git$/i, "");
      const ghRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
        headers: {
          "User-Agent": "StudentPulse-AI",
          Accept: "application/vnd.github+json",
        },
      });
      if (!ghRes.ok) {
        res.status(ghRes.status).json({ error: `GitHub returned status ${ghRes.status} for ${owner}/${repo}.` });
        return;
      }
      const info = (await ghRes.json()) as any;
      res.json({
        full_name: info.full_name,
        stars: Number(info.stargazers_count || 0),
        forks: Number(info.forks_count || 0),
        language: info.language || "",
        description: info.description || "",
      });
    } catch (err: any) {
      res.status(502).json({ error: err?.message || "Failed to fetch GitHub repository." });
    }
  });

  // =========================================================================
  // SERVER-SIDE GEMINI AI ENDPOINTS (gemini-4-hydrogen, real error propagation)
  // =========================================================================

  // 1. AI Career Mentor Multi-Turn Chat
  app.post("/api/ai/mentor", async (req: Request, res: Response) => {
    try {
      const userId = Number(req.body?.user_id || 0);
      const userMessage = String(req.body?.message || "").trim();
      if (!userId || !userMessage) {
        res.status(400).json({ error: "user_id and non-empty message are required." });
        return;
      }

      const ai = requireGeminiClient();

      // Gather live student context from SQLite
      const [profilesRes, skillRes, planRes, historyRes] = await Promise.all([
        callPythonHttp("/api/profiles", "GET"),
        callPythonHttp(`/api/profiles/${userId}/skill-profile`, "GET"),
        callPythonHttp(`/api/profiles/${userId}/latest-plan`, "GET"),
        callPythonHttp(`/api/mentor/messages?user_id=${userId}`, "GET"),
      ]);

      const student = (profilesRes.data?.profiles || []).find((p: any) => p.user_id === userId);
      const skillsSummary = (skillRes.data?.comparison || [])
        .map((c: any) => `${c.label}: ${c.current}% (target ${c.target}%)`)
        .join("; ");
      const readinessScore = planRes.data?.snapshot?.computed_readiness ?? "Not yet assessed";
      const recentChat = (historyRes.data?.messages || [])
        .slice(-8)
        .map((m: any) => `${m.sender === "user" ? "Student" : "Mentor"}: ${m.content}`)
        .join("\n");

      const systemInstruction = `You are the StudentPulse AI Career & Academic Mentor helping college students prepare for placements and internships.
Student Context:
- Name: ${student?.display_name || "Student"}
- Branch & Semester: ${student?.branch || "CSE"}, Semester ${student?.semester || 6}, CGPA ${student?.cgpa || 8.0}
- Target Career Role: ${skillRes.data?.target_role_label || student?.target_role || "Software Developer"}
- Overall Readiness Score: ${readinessScore}/100
- Skill Benchmarks: ${skillsSummary || "General CS foundations"}
Give practical, encouraging, concrete advice with actionable next steps, resources, or coding/interview drills. Keep responses crisp, structured, and under 240 words.`;

      const prompt = recentChat
        ? `Recent conversation:\n${recentChat}\n\nStudent: ${userMessage}`
        : `Student: ${userMessage}`;

      const response = await withTimeout(
        ai.models.generateContent({
          model: "gemini-4-hydrogen",
          contents: prompt,
          config: {
            systemInstruction,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        }),
        20000,
        "AI Career Mentor"
      );

      const replyText = (response.text || "").trim();
      if (!replyText) {
        throw new Error("Gemini returned an empty reply.");
      }

      await callPythonHttp("/api/mentor/messages", "POST", {
        user_id: userId,
        sender: "user",
        content: userMessage,
      });
      await callPythonHttp("/api/mentor/messages", "POST", {
        user_id: userId,
        sender: "assistant",
        content: replyText,
      });

      const updated = await callPythonHttp(`/api/mentor/messages?user_id=${userId}`, "GET");
      res.json({ reply: replyText, messages: updated.data?.messages || [] });
    } catch (err: any) {
      res.status(502).json({ error: err?.message || "AI Career Mentor request failed." });
    }
  });

  // 2. AI Mock Interview Question Generator
  app.post("/api/ai/interview-questions", async (req: Request, res: Response) => {
    try {
      const ai = requireGeminiClient();
      const targetRole = String(req.body?.target_role || "Full-Stack Software Developer");
      const mode = String(req.body?.mode || "technical") === "hr" ? "HR & Behavioral" : "Technical";
      const focusSkills = Array.isArray(req.body?.focus_skills) ? req.body.focus_skills.join(", ") : "";

      const response = await withTimeout(
        ai.models.generateContent({
          model: "gemini-4-hydrogen",
          contents: `Generate 3 realistic campus placement ${mode} interview questions for a student targeting ${targetRole}.${focusSkills ? ` Focus areas: ${focusSkills}.` : ""}`,
          config: {
            systemInstruction:
              "Return strictly JSON with an array of 3 interview questions, each containing question, topic, difficulty (Easy/Medium/Hard), and hint (key points a great answer covers).",
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                questions: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      question: { type: Type.STRING },
                      topic: { type: Type.STRING },
                      difficulty: { type: Type.STRING },
                      hint: { type: Type.STRING },
                    },
                    required: ["question", "topic", "difficulty", "hint"],
                  },
                },
              },
              required: ["questions"],
            },
          },
        }),
        18000,
        "AI Interview Question Generator"
      );

      const parsed = JSON.parse(response.text || "{}");
      res.json({ questions: parsed.questions || [] });
    } catch (err: any) {
      res.status(502).json({ error: err?.message || "Failed to generate mock interview questions." });
    }
  });

  // 3. AI Mock Interview Full Evaluation (3-Axis Rubric + SQLite Save)
  app.post("/api/ai/interview-evaluate", async (req: Request, res: Response) => {
    try {
      const userId = Number(req.body?.user_id || 0);
      const targetRole = String(req.body?.target_role || "fullstack_dev");
      const mode = String(req.body?.mode || "technical");
      const question = String(req.body?.question || "").trim();
      const answer = String(req.body?.answer || "").trim();
      const hint = String(req.body?.hint || "");

      if (!userId || !question || answer.length < 5) {
        res.status(400).json({ error: "user_id, question, and an answer (5+ chars) are required." });
        return;
      }

      const ai = requireGeminiClient();
      const response = await withTimeout(
        ai.models.generateContent({
          model: "gemini-4-hydrogen",
          contents: `Target Role: ${targetRole}\nInterview Mode: ${mode}\nQuestion: ${question}\nExpected Key Concepts: ${hint}\nStudent Answer: ${answer}`,
          config: {
            systemInstruction:
              "Evaluate this college student's mock interview response rigorously and constructively. Score technical_score, communication_score, and quality_score as integers 0-100, compute overall_score (0-100), provide feedback (2-3 crisp sentences), and improvements (1-2 specific actionable tips).",
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                technical_score: { type: Type.INTEGER },
                communication_score: { type: Type.INTEGER },
                quality_score: { type: Type.INTEGER },
                overall_score: { type: Type.INTEGER },
                feedback: { type: Type.STRING },
                improvements: { type: Type.STRING },
              },
              required: [
                "technical_score",
                "communication_score",
                "quality_score",
                "overall_score",
                "feedback",
                "improvements",
              ],
            },
          },
        }),
        18000,
        "AI Mock Interview Evaluator"
      );

      const parsed = JSON.parse(response.text || "{}");
      const clamp = (n: unknown) => Math.max(0, Math.min(100, Math.round(Number(n) || 65)));
      const tech = clamp(parsed.technical_score);
      const comm = clamp(parsed.communication_score);
      const qual = clamp(parsed.quality_score);
      const overall = clamp(parsed.overall_score ?? Math.round((tech + comm + qual) / 3));

      const saved = await callPythonHttp("/api/interviews", "POST", {
        user_id: userId,
        target_role: targetRole,
        mode,
        question,
        answer,
        technical_score: tech,
        communication_score: comm,
        quality_score: qual,
        overall_score: overall,
        feedback: String(parsed.feedback || ""),
        improvements: String(parsed.improvements || ""),
        source: "gemini_ai",
      });

      if (saved.status >= 400) {
        res.status(saved.status).json(saved.data);
        return;
      }
      res.status(201).json({ interview: saved.data.interview });
    } catch (err: any) {
      res.status(502).json({ error: err?.message || "Failed to evaluate mock interview." });
    }
  });

  // 4. AI Resume ATS Analyzer (PDF Upload + Text + Gemini Multimodal + SQLite Save)
  app.post("/api/ai/resume-analyze", async (req: Request, res: Response) => {
    try {
      const userId = Number(req.body?.user_id || 0);
      const targetRole = String(req.body?.target_role || "fullstack_dev");
      const jobDescription = String(req.body?.job_description || "").trim();
      const rawText = String(req.body?.resume_text || "").trim();
      const fileNameInput = String(req.body?.file_name || "resume.txt").trim();
      const fileBase64 = String(req.body?.file_base64 || "").trim();

      if (!userId || (!rawText && !fileBase64)) {
        res.status(400).json({ error: "Upload a resume PDF/TXT or paste your resume content." });
        return;
      }

      const ai = requireGeminiClient();

      let savedFileName = fileNameInput;
      let savedRelPath = "";
      let extractedText = rawText;
      const parts: Array<any> = [];

      if (fileBase64) {
        const uploaded = saveBase64Upload("resumes", fileNameInput, fileBase64);
        savedFileName = uploaded.fileName;
        savedRelPath = uploaded.relativePath;

        if (savedFileName.toLowerCase().endsWith(".pdf")) {
          // Extract text via pure-Python zlib helper AND attach PDF inlineData for multimodal accuracy
          const extRes = await callPythonHttp<{ text: string }>("/api/python/extract-pdf", "POST", {
            file_base64: uploaded.buffer.toString("base64"),
          });
          if (extRes.data?.text && !extractedText) {
            extractedText = extRes.data.text;
          }
          parts.push({
            inlineData: {
              mimeType: "application/pdf",
              data: uploaded.buffer.toString("base64"),
            },
          });
        } else {
          const textContent = uploaded.buffer.toString("utf-8").trim();
          if (textContent && !extractedText) {
            extractedText = textContent;
          }
        }
      }

      parts.push({
        text: `Analyze this student resume for the target role "${targetRole}".
${jobDescription ? `Target Job Description:\n${jobDescription}\n` : ""}
${extractedText ? `Extracted Resume Text:\n${extractedText.slice(0, 8000)}` : ""}
Return an honest ATS compatibility score (0-100), matched_keywords, missing_keywords, concrete suggestions (4-6 items), and a concise executive summary.`,
      });

      const response = await withTimeout(
        ai.models.generateContent({
          model: "gemini-4-hydrogen",
          contents: parts,
          config: {
            systemInstruction:
              "You are a technical recruiter and ATS resume auditor for engineering students. Evaluate formatting, quantified project impact, technical keyword alignment, and clarity.",
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                ats_score: { type: Type.INTEGER },
                matched_keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
                missing_keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
                suggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
                summary: { type: Type.STRING },
              },
              required: ["ats_score", "matched_keywords", "missing_keywords", "suggestions", "summary"],
            },
          },
        }),
        25000,
        "AI Resume Analyzer"
      );

      const parsed = JSON.parse(response.text || "{}");
      const saved = await callPythonHttp("/api/resumes", "POST", {
        user_id: userId,
        file_name: savedFileName,
        file_path: savedRelPath,
        extracted_text: extractedText || parsed.summary || "",
        target_role: targetRole,
        job_description: jobDescription,
        ats_score: Math.max(0, Math.min(100, Number(parsed.ats_score) || 65)),
        matched_keywords: Array.isArray(parsed.matched_keywords) ? parsed.matched_keywords : [],
        missing_keywords: Array.isArray(parsed.missing_keywords) ? parsed.missing_keywords : [],
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
        summary: String(parsed.summary || ""),
      });

      if (saved.status >= 400) {
        res.status(saved.status).json(saved.data);
        return;
      }
      res.status(201).json({ resume: saved.data.resume });
    } catch (err: any) {
      res.status(502).json({ error: err?.message || "Failed to analyze resume." });
    }
  });

  // 5. AI Skill Gap Recommendations
  app.post("/api/ai/skill-recommendations", async (req: Request, res: Response) => {
    try {
      const userId = Number(req.body?.user_id || 0);
      if (!userId) {
        res.status(400).json({ error: "user_id is required." });
        return;
      }
      const ai = requireGeminiClient();
      const skillRes = await callPythonHttp(`/api/profiles/${userId}/skill-profile`, "GET");
      const sp = skillRes.data;

      const response = await withTimeout(
        ai.models.generateContent({
          model: "gemini-4-hydrogen",
          contents: `Target Role: ${sp.target_role_label}
Overall Skill Gap: ${sp.overall_gap_pct}%
Strengths: ${(sp.strengths || []).map((s: any) => `${s.label} (${s.current}%)`).join(", ") || "None yet"}
Weaknesses/Missing: ${(sp.comparison || []).filter((c: any) => c.gap_pct > 0).map((c: any) => `${c.label}: ${c.current}% vs ${c.target}% target`).join(", ")}`,
          config: {
            systemInstruction:
              "Give personalized, high-impact recommendations to close this student's skill gaps. Return JSON with summary, priority_focus, and 4 concise recommendations.",
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                summary: { type: Type.STRING },
                priority_focus: { type: Type.STRING },
                recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
              required: ["summary", "priority_focus", "recommendations"],
            },
          },
        }),
        18000,
        "AI Skill Gap Recommendations"
      );

      res.json(JSON.parse(response.text || "{}"));
    } catch (err: any) {
      res.status(502).json({ error: err?.message || "Failed to generate skill recommendations." });
    }
  });

  // 6. AI Assessment Post-Test Weak Topic Explanation
  app.post("/api/ai/assessment-feedback", async (req: Request, res: Response) => {
    try {
      const resultId = Number(req.body?.result_id || 0);
      const title = String(req.body?.assessment_title || "Assessment");
      const scorePct = Number(req.body?.score_pct ?? 0);
      const weakTopics = Array.isArray(req.body?.weak_topics) ? req.body.weak_topics : [];

      const ai = requireGeminiClient();
      const response = await withTimeout(
        ai.models.generateContent({
          model: "gemini-4-hydrogen",
          contents: `Assessment: ${title}\nScore: ${scorePct}%\nWeak Topics: ${weakTopics.join(", ") || "None (100% score)"}`,
          config: {
            systemInstruction:
              "Provide concise, encouraging, high-value study feedback (3-4 sentences) explaining how to master the missed topics and what drill to practice next.",
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        }),
        15000,
        "AI Assessment Feedback"
      );

      const feedback = (response.text || "").trim();
      if (!feedback) {
        throw new Error("Empty AI feedback response.");
      }
      if (resultId > 0) {
        await callPythonHttp(`/api/assessment-results/${resultId}/ai-feedback`, "POST", {
          ai_feedback: feedback,
        });
      }
      res.json({ ai_feedback: feedback });
    } catch (err: any) {
      res.status(502).json({ error: err?.message || "Failed to generate AI assessment feedback." });
    }
  });

  // Hybrid Python + Gemini AI Readiness Plan Route (preserved)
  app.post("/api/readiness-plans", async (req: Request, res: Response) => {
    try {
      const prep = await callPythonHttp("/api/python/prepare-plan", "POST", req.body);
      if (prep.status >= 400) {
        res.status(prep.status).json(prep.data);
        return;
      }

      const { snapshot_id, target_role, metrics, role_comparison, evidence, prompt_bundle } = prep.data;
      let rawAiResponse: string | null = null;
      let aiError: string | null = null;

      try {
        rawAiResponse = await generatePlanWithGemini(
          prompt_bundle.system_instruction,
          prompt_bundle.user_prompt
        );
      } catch (err: any) {
        aiError = err?.message || "AI provider unavailable";
      }

      const finalized = await callPythonHttp("/api/python/finalize-plan", "POST", {
        snapshot_id,
        target_role,
        metrics,
        role_comparison,
        evidence,
        raw_ai_response: rawAiResponse,
        ai_error: aiError,
      });

      if (finalized.status >= 400) {
        res.status(finalized.status).json(finalized.data);
        return;
      }

      res.json({
        plan: finalized.data.plan,
        ai_notice: aiError
          ? `AI provider notice: ${aiError}. Served Python readiness & skill-gap plan.`
          : finalized.data.validation_issues?.length
          ? `AI output adjusted by Python validator (${finalized.data.validation_issues.join("; ")}).`
          : null,
        transmitted_fields: prompt_bundle.transmitted_fields,
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to generate readiness plan." });
    }
  });

  // Hybrid Gemini + Python Rubric Interview Evaluator (preserved)
  app.post("/api/interview-feedback", async (req: Request, res: Response) => {
    const { question, answer, hint } = req.body || {};
    if (!answer || typeof answer !== "string" || answer.trim().length < 5) {
      res.status(400).json({ error: "Please write an interview answer (at least 5 characters)." });
      return;
    }
    try {
      const evaluation = await evaluateInterviewWithGemini(
        String(question || ""),
        answer,
        String(hint || "")
      );
      res.json({ evaluation, ai_notice: null });
    } catch (err: any) {
      try {
        const fallback = await callPythonHttp("/api/python/evaluate-interview-fallback", "POST", {
          question,
          answer,
          hint,
        });
        if (fallback.status === 200 && fallback.data?.evaluation) {
          res.json({
            evaluation: fallback.data.evaluation,
            ai_notice: `AI feedback notice: ${err?.message || "unavailable"}. Used Python rubric evaluator.`,
          });
          return;
        }
      } catch {
        // Fall through
      }
      res.status(500).json({ error: err?.message || "Failed to evaluate interview response." });
    }
  });

  app.get("/api/architecture/stats", async (_req: Request, res: Response) => {
    try {
      const result = await callPythonHttp("/api/architecture/stats", "GET");
      if (result.status >= 400) {
        res.status(result.status).json(result.data);
        return;
      }
      res.json({
        ...result.data,
        python_server_mode: `Persistent Python 3.11 ThreadingHTTPServer (127.0.0.1:${PYTHON_PORT})`,
        ai_provider: "Google Gemini (@google/genai · gemini-4-hydrogen)",
        ai_key_configured: Boolean(
          process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY"
        ),
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to fetch architecture stats." });
    }
  });

  const distPath = path.resolve(ROOT_DIR, "dist");
  const isProd = process.env.NODE_ENV === "production" && fs.existsSync(distPath);

  if (isProd) {
    app.use(express.static(distPath));
    app.get("/{*path}", (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  } else {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  const cleanup = () => {
    if (pythonProcess && !pythonProcess.killed) {
      pythonProcess.kill("SIGTERM");
    }
  };
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`StudentPulse AI server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start StudentPulse AI server:", err);
  process.exit(1);
});
