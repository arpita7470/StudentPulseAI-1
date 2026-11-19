import { useEffect, useState, type FormEvent } from "react";
import {
  CheckCircle2,
  Circle,
  Download,
  FileText,
  FileUp,
  NotebookPen,
  Paperclip,
  Plus,
  Search,
  Target,
  Trash2,
} from "lucide-react";
import {
  createNote,
  createTask,
  deleteNote,
  deleteTask,
  fetchNotes,
  fetchTasks,
  fileToBase64,
  getFileDownloadUrl,
  toggleTask,
} from "../lib/api";
import { exportStudyNoteAsPdf } from "../lib/pdfExport";
import type { DailyTask, StudentProfile, StudyNote } from "../types/studentpulse";

interface TasksNotesViewProps {
  activeProfile: StudentProfile;
  onXpUpdated: () => void;
}

export function TasksNotesView({ activeProfile, onXpUpdated }: TasksNotesViewProps) {
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [notes, setNotes] = useState<StudyNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [taskFilter, setTaskFilter] = useState<"all" | "pending" | "completed">("all");
  const [noteSearch, setNoteSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  // New Task Form
  const [taskTitle, setTaskTitle] = useState("");
  const [taskCategory, setTaskCategory] = useState("DSA Practice");
  const [taskPriority, setTaskPriority] = useState<"low" | "medium" | "high">("high");
  const [taskDate, setTaskDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [taskFile, setTaskFile] = useState<File | null>(null);
  const [savingTask, setSavingTask] = useState(false);

  // New Note Form
  const [noteTitle, setNoteTitle] = useState("");
  const [noteSubject, setNoteSubject] = useState("Machine Learning");
  const [noteContent, setNoteContent] = useState("");
  const [noteFile, setNoteFile] = useState<File | null>(null);
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchTasks(activeProfile.user_id).catch(() => []),
      fetchNotes(activeProfile.user_id).catch(() => []),
    ])
      .then(([t, n]) => {
        setTasks(t);
        setNotes(n);
      })
      .finally(() => setLoading(false));
  }, [activeProfile.user_id]);

  async function handleAddTask(e: FormEvent) {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    setSavingTask(true);
    setError(null);
    try {
      let attachmentBase64: string | undefined;
      if (taskFile) {
        attachmentBase64 = await fileToBase64(taskFile);
      }
      const created = await createTask({
        user_id: activeProfile.user_id,
        title: taskTitle.trim(),
        category: taskCategory,
        priority: taskPriority,
        target_date: taskDate,
        attachment_name: taskFile?.name,
        attachment_base64: attachmentBase64,
      });
      setTasks((prev) => [created, ...prev]);
      setTaskTitle("");
      setTaskFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add daily task.");
    } finally {
      setSavingTask(false);
    }
  }

  async function handleToggleTask(taskId: number) {
    try {
      const updated = await toggleTask(taskId);
      setTasks((prev) => prev.map((t) => (t.task_id === taskId ? updated : t)));
      if (updated.completed) onXpUpdated();
    } catch {
      setError("Could not update task status.");
    }
  }

  async function handleDeleteTask(taskId: number) {
    try {
      await deleteTask(taskId);
      setTasks((prev) => prev.filter((t) => t.task_id !== taskId));
    } catch {
      setError("Could not delete task.");
    }
  }

  async function handleAddNote(e: FormEvent) {
    e.preventDefault();
    if (!noteTitle.trim()) return;
    setSavingNote(true);
    setError(null);
    try {
      let fileBase64: string | undefined;
      if (noteFile) {
        fileBase64 = await fileToBase64(noteFile);
      }
      const created = await createNote({
        user_id: activeProfile.user_id,
        title: noteTitle.trim(),
        subject: noteSubject.trim() || "General",
        content: noteContent.trim(),
        file_name: noteFile?.name,
        mime_type: noteFile?.type || "text/plain",
        file_base64: fileBase64,
      });
      setNotes((prev) => [created, ...prev]);
      setNoteTitle("");
      setNoteContent("");
      setNoteFile(null);
      onXpUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save study note.");
    } finally {
      setSavingNote(false);
    }
  }

  async function handleDeleteNote(noteId: number) {
    try {
      await deleteNote(noteId);
      setNotes((prev) => prev.filter((n) => n.note_id !== noteId));
    } catch {
      setError("Could not delete note.");
    }
  }

  const visibleTasks = tasks.filter((t) => {
    if (taskFilter === "pending") return !t.completed;
    if (taskFilter === "completed") return t.completed;
    return true;
  });

  const visibleNotes = notes.filter((n) => {
    const q = noteSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      n.title.toLowerCase().includes(q) ||
      n.subject.toLowerCase().includes(q) ||
      n.content.toLowerCase().includes(q) ||
      n.file_name.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs font-medium text-pine-700 dark:text-[#6ec4b0]">
          Daily Productivity & Study Resource Vault
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#14211d] dark:text-cream-50 mt-1">
          Daily Study Targets & PDF Notes Vault
        </h1>
        <p className="text-sm text-[#45554e] dark:text-[#869b92] mt-1">
          Set daily goals with file attachments, earn XP on completion, upload PDF study notes, and
          download notes anytime as real PDF documents.
        </p>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300 font-medium">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Daily Targets / Tasks */}
        <section className="lg:col-span-5 bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-pine-700 dark:text-[#6ec4b0]" />
              <h2 className="text-base font-bold text-[#14211d] dark:text-cream-50">
                Daily Targets ({tasks.filter((t) => !t.completed).length} pending)
              </h2>
            </div>
            <div className="inline-flex p-0.5 bg-cream-100 dark:bg-pine-800 rounded-lg text-[11px] font-semibold">
              {(["all", "pending", "completed"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setTaskFilter(f)}
                  className={`px-2 py-1 rounded-md capitalize ${
                    taskFilter === f
                      ? "bg-cream-50 dark:bg-pine-900 text-pine-700 dark:text-[#6ec4b0] shadow-xs"
                      : "text-[#56665f]"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <form
            onSubmit={handleAddTask}
            className="p-4 rounded-xl bg-sage-50 dark:bg-pine-950 border border-sage-200 dark:border-pine-800 space-y-3"
          >
            <div>
              <label className="block text-xs font-semibold mb-1">Today&apos;s Target</label>
              <input
                type="text"
                required
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="e.g., Complete 5 Graph BFS/DFS coding problems"
                className="w-full px-3 py-2 text-xs rounded-lg border border-sage-300 dark:border-pine-700 bg-cream-50 dark:bg-pine-900"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[11px] font-semibold mb-1">Category</label>
                <select
                  value={taskCategory}
                  onChange={(e) => setTaskCategory(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs rounded-lg border border-sage-300 dark:border-pine-700 bg-cream-50 dark:bg-pine-900"
                >
                  <option>DSA Practice</option>
                  <option>Study Notes</option>
                  <option>Project Sprint</option>
                  <option>Career Prep</option>
                  <option>Coursework</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold mb-1">Priority</label>
                <select
                  value={taskPriority}
                  onChange={(e) => setTaskPriority(e.target.value as "low" | "medium" | "high")}
                  className="w-full px-2 py-1.5 text-xs rounded-lg border border-sage-300 dark:border-pine-700 bg-cream-50 dark:bg-pine-900"
                >
                  <option value="high">High (+35 XP)</option>
                  <option value="medium">Medium (+25 XP)</option>
                  <option value="low">Low (+15 XP)</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold mb-1">Date</label>
                <input
                  type="date"
                  value={taskDate}
                  onChange={(e) => setTaskDate(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs rounded-lg border border-sage-300 dark:border-pine-700 bg-cream-50 dark:bg-pine-900"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <label className="inline-flex items-center gap-1.5 text-xs text-[#45554e] dark:text-[#c5d4cd] cursor-pointer hover:text-pine-700">
                <Paperclip className="w-3.5 h-3.5" />
                <span className="truncate max-w-[160px]">
                  {taskFile ? taskFile.name : "Attach worksheet / PDF"}
                </span>
                <input
                  type="file"
                  accept=".pdf,.txt,.md,.png,.jpg,.jpeg"
                  className="hidden"
                  onChange={(e) => setTaskFile(e.target.files?.[0] || null)}
                />
              </label>
              <button
                type="submit"
                disabled={savingTask}
                className="px-3.5 py-2 bg-pine-700 hover:bg-pine-800 disabled:opacity-60 text-white text-xs font-semibold rounded-lg flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                {savingTask ? "Adding..." : "Add Target"}
              </button>
            </div>
          </form>

          {loading ? (
            <div className="space-y-2 animate-pulse">
              <div className="h-14 bg-cream-100 dark:bg-pine-800 rounded-lg" />
              <div className="h-14 bg-cream-100 dark:bg-pine-800 rounded-lg" />
            </div>
          ) : visibleTasks.length === 0 ? (
            <div className="p-6 text-center text-xs text-[#56665f] dark:text-[#869b92] border border-dashed border-sage-200 dark:border-pine-800 rounded-lg">
              No tasks match this filter yet.
            </div>
          ) : (
            <div className="space-y-2.5">
              {visibleTasks.map((task) => (
                <div
                  key={task.task_id}
                  className="p-3 rounded-lg border border-sage-200 dark:border-pine-800 flex items-start justify-between gap-2.5"
                >
                  <button
                    type="button"
                    onClick={() => handleToggleTask(task.task_id)}
                    className="flex items-start gap-2.5 text-left min-w-0 flex-1"
                  >
                    {task.completed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                    ) : (
                      <Circle className="w-4 h-4 text-[#869b92] mt-0.5 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div
                        className={`text-xs font-semibold ${
                          task.completed
                            ? "line-through text-[#869b92]"
                            : "text-[#14211d] dark:text-cream-50"
                        }`}
                      >
                        {task.title}
                      </div>
                      <div className="text-[11px] text-[#56665f] dark:text-[#869b92] mt-0.5">
                        {task.category} · {task.priority.toUpperCase()} · {task.target_date} · +
                        {task.xp_reward} XP
                      </div>
                      {task.attachment_path && (
                        <a
                          href={getFileDownloadUrl(task.attachment_path)}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-[11px] text-pine-700 dark:text-[#6ec4b0] hover:underline mt-1"
                        >
                          <Download className="w-3 h-3" />
                          {task.attachment_name}
                        </a>
                      )}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteTask(task.task_id)}
                    aria-label="Delete task"
                    className="text-[#869b92] hover:text-red-500 p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Right: Study Notes + PDF Upload & Download Vault */}
        <section className="lg:col-span-7 bg-cream-50 dark:bg-pine-900 border border-sage-200 dark:border-pine-800 rounded-xl p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <NotebookPen className="w-4 h-4 text-ochre-600 dark:text-ochre-400" />
              <h2 className="text-base font-bold text-[#14211d] dark:text-cream-50">
                Study Notes & PDF Library ({notes.length})
              </h2>
            </div>

            <div className="relative w-full sm:w-56">
              <Search className="w-3.5 h-3.5 text-[#869b92] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={noteSearch}
                onChange={(e) => setNoteSearch(e.target.value)}
                placeholder="Search notes or PDFs..."
                className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-lg border border-sage-300 dark:border-pine-700 bg-white dark:bg-pine-950"
              />
            </div>
          </div>

          <form
            onSubmit={handleAddNote}
            className="p-4 rounded-xl bg-sage-50 dark:bg-pine-950 border border-sage-200 dark:border-pine-800 space-y-3"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Note / Document Title</label>
                <input
                  type="text"
                  required
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  placeholder="e.g., DBMS Normalization & SQL Joins Unit 3"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-sage-300 dark:border-pine-700 bg-cream-50 dark:bg-pine-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Subject / Topic</label>
                <input
                  type="text"
                  value={noteSubject}
                  onChange={(e) => setNoteSubject(e.target.value)}
                  placeholder="e.g., DBMS, Machine Learning, React"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-sage-300 dark:border-pine-700 bg-cream-50 dark:bg-pine-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">
                Study Notes Summary (exportable as PDF)
              </label>
              <textarea
                rows={3}
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="Write key formulas, interview takeaways, or revision points..."
                className="w-full px-3 py-2 text-xs rounded-lg border border-sage-300 dark:border-pine-700 bg-cream-50 dark:bg-pine-900"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-dashed border-pine-500 dark:border-pine-700 bg-cream-100/50 dark:bg-pine-950/30 text-xs font-medium text-pine-800 dark:text-[#9bd8c9] cursor-pointer">
                <FileUp className="w-3.5 h-3.5" />
                <span>{noteFile ? `Selected: ${noteFile.name}` : "Upload PDF / Notes File"}</span>
                <input
                  type="file"
                  accept=".pdf,.txt,.md,.doc,.docx"
                  className="hidden"
                  onChange={(e) => setNoteFile(e.target.files?.[0] || null)}
                />
              </label>

              <button
                type="submit"
                disabled={savingNote}
                className="px-4 py-2 bg-pine-600 hover:bg-pine-700 disabled:opacity-60 text-white text-xs font-semibold rounded-lg"
              >
                {savingNote ? "Saving Note..." : "Save Note (+20 XP)"}
              </button>
            </div>
          </form>

          {visibleNotes.length === 0 ? (
            <div className="p-6 text-center text-xs text-[#56665f] dark:text-[#869b92] border border-dashed border-sage-200 dark:border-pine-800 rounded-lg">
              No study notes saved yet. Add a note or upload a PDF above.
            </div>
          ) : (
            <div className="space-y-3">
              {visibleNotes.map((note) => (
                <article
                  key={note.note_id}
                  className="p-4 rounded-xl border border-sage-200 dark:border-pine-800 space-y-2.5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="text-[11px] font-semibold text-ochre-600 dark:text-ochre-400">
                        {note.subject} · {note.created_at}
                      </div>
                      <h3 className="text-sm font-bold text-[#14211d] dark:text-cream-50 mt-0.5">
                        {note.title}
                      </h3>
                    </div>

                    <div className="flex items-center gap-2">
                      {note.file_path && (
                        <a
                          href={getFileDownloadUrl(note.file_path)}
                          className="px-2.5 py-1.5 rounded-lg bg-cream-100 dark:bg-pine-950/50 border border-cream-200 dark:border-pine-700 text-pine-800 dark:text-[#9bd8c9] text-xs font-semibold inline-flex items-center gap-1 hover:bg-cream-100"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Download PDF/File
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => exportStudyNoteAsPdf(note)}
                        className="px-2.5 py-1.5 rounded-lg border border-sage-200 dark:border-pine-700 text-xs font-semibold text-[#2c3d37] dark:text-[#dbe6e0] hover:border-pine-600 inline-flex items-center gap-1"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        Export PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteNote(note.note_id)}
                        aria-label="Delete study note"
                        className="p-1.5 text-[#869b92] hover:text-red-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {note.content && (
                    <p className="text-xs text-[#45554e] dark:text-[#c5d4cd] whitespace-pre-line leading-relaxed">
                      {note.content}
                    </p>
                  )}
                  {note.file_name && (
                    <div className="text-[11px] text-[#56665f] dark:text-[#869b92] font-mono">
                      Attachment: {note.file_name} (
                      {note.file_size > 1024
                        ? `${Math.round(note.file_size / 1024)} KB`
                        : `${note.file_size} B`}
                      )
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
