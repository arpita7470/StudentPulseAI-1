import { useEffect, useRef, useState, type FormEvent } from "react";
import { Bot, Send, Sparkles, Trash2, User } from "lucide-react";
import { clearMentorMessages, fetchMentorMessages, sendMentorMessage } from "../lib/api";
import {
  CAREER_ROLE_LABELS,
  type MentorMessage,
  type StudentProfile,
} from "../types/studentpulse";

interface MentorViewProps {
  activeProfile: StudentProfile;
}

const QUICK_STARTERS = [
  "What are my top 3 skill gaps and how should I close them this week?",
  "Give me a 2-week DSA & System Design revision schedule.",
  "How should I explain my portfolio projects in a campus placement interview?",
  "Suggest high-impact resume improvements for my target role.",
];

export function MentorView({ activeProfile }: MentorViewProps) {
  const [messages, setMessages] = useState<MentorMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchMentorMessages(activeProfile.user_id)
      .then(setMessages)
      .catch(() => setMessages([]))
      .finally(() => setLoading(false));
  }, [activeProfile.user_id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, sending]);

  async function submitPrompt(promptText: string) {
    const trimmed = promptText.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setError(null);

    const optimisticUser: MentorMessage = {
      msg_id: Date.now(),
      user_id: activeProfile.user_id,
      sender: "user",
      content: trimmed,
      created_at: "Sending...",
    };
    setMessages((prev) => [...prev, optimisticUser]);
    setInput("");

    try {
      const res = await sendMentorMessage(activeProfile.user_id, trimmed);
      setMessages(res.messages);
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.msg_id !== optimisticUser.msg_id));
      setInput(trimmed);
      setError(err instanceof Error ? err.message : "Could not reach AI Career Mentor.");
    } finally {
      setSending(false);
    }
  }

  function handleFormSubmit(e: FormEvent) {
    e.preventDefault();
    submitPrompt(input);
  }

  async function handleClear() {
    try {
      await clearMentorMessages(activeProfile.user_id);
      setMessages([]);
    } catch {
      setError("Could not clear conversation.");
    }
  }

  const roleLabel =
    CAREER_ROLE_LABELS[activeProfile.target_role]?.label || activeProfile.target_role;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs font-medium text-ochre-600 dark:text-ochre-400">
            Powered by Gemini AI · Context-Aware Career Guidance
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#14211d] dark:text-cream-50 mt-1">
            AI Career Mentor
          </h1>
          <p className="text-xs text-[#56665f] dark:text-[#869b92] mt-1">
            Tailored to {activeProfile.display_name} · Sem {activeProfile.semester} · Target:{" "}
            {roleLabel}
          </p>
        </div>

        {messages.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            className="px-3.5 py-2 text-xs font-semibold text-[#45554e] dark:text-[#c5d4cd] border border-sage-200 dark:border-pine-700 rounded-lg hover:text-red-600 flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear Chat
          </button>
        )}
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300 font-medium">
          {error}
        </div>
      )}

      <div className="bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl flex flex-col h-[560px]">
        {/* Chat Stream */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading ? (
            <div className="h-24 animate-pulse bg-cream-100 dark:bg-pine-800 rounded-xl" />
          ) : messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pine-800 to-pine-600 text-white flex items-center justify-center">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#14211d] dark:text-cream-50">
                  Ask Your AI Career & Academic Mentor
                </h2>
                <p className="text-xs text-[#56665f] dark:text-[#869b92] mt-1">
                  Your mentor reads your current skills, CGPA, and readiness benchmark to give
                  specific, honest career guidance.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
                {QUICK_STARTERS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => submitPrompt(q)}
                    className="p-2.5 rounded-lg border border-sage-200 dark:border-pine-700 hover:border-pine-600 text-left text-xs text-[#2c3d37] dark:text-[#dbe6e0] bg-sage-50 dark:bg-pine-950"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m) => {
              const isUser = m.sender === "user";
              return (
                <div
                  key={m.msg_id}
                  className={`flex items-start gap-3 ${isUser ? "justify-end" : "justify-start"}`}
                >
                  {!isUser && (
                    <div className="w-8 h-8 rounded-lg bg-cream-100 dark:bg-pine-950 text-ochre-600 dark:text-ochre-400 flex items-center justify-center shrink-0">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-xl px-4 py-3 text-xs leading-relaxed whitespace-pre-line ${
                      isUser
                        ? "bg-pine-700 text-white"
                        : "bg-cream-100 dark:bg-pine-800 text-[#1f2f29] dark:text-cream-50"
                    }`}
                  >
                    {m.content}
                  </div>
                  {isUser && (
                    <div className="w-8 h-8 rounded-lg bg-cream-100 dark:bg-pine-950 text-pine-800 dark:text-[#9bd8c9] flex items-center justify-center shrink-0">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </div>
              );
            })
          )}

          {sending && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-cream-100 dark:bg-pine-950 text-ochre-600 dark:text-ochre-400 flex items-center justify-center">
                <Bot className="w-4 h-4" />
              </div>
              <div className="px-4 py-3 rounded-xl bg-cream-100 dark:bg-pine-800 text-xs text-[#56665f]">
                Thinking through your skill profile and target role...
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input Form */}
        <form
          onSubmit={handleFormSubmit}
          className="p-4 border-t border-sage-200 dark:border-pine-800 flex items-center gap-2.5"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about DSA, internships, projects, resume feedback, or study plan..."
            className="flex-1 px-4 py-2.5 text-sm rounded-lg border border-sage-300 dark:border-pine-700 bg-white dark:bg-pine-950 focus:outline-none focus:ring-2 focus:ring-pine-600/30"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="px-4 py-2.5 bg-pine-700 hover:bg-pine-800 disabled:opacity-50 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
