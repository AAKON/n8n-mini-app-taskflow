"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import dayjs from "dayjs";
import {
  Calendar,
  Building2,
  User,
  AlignLeft,
  MessageCircle,
  Pencil,
  Send,
  Check,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useAuth } from "@/hooks/useAuth";
import { hasRole } from "@/lib/rbac";
import { hideBackButton, haptic, showBackButton } from "@/lib/tma";
import { SignInNotice } from "@/components/SignInNotice";
import { CreateTaskSheet } from "@/components/CreateTaskSheet";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { TaskDetailSkeleton } from "@/components/ui/TaskDetailSkeleton";
import { StepList } from "@/components/StepList";
import type { IStep, ITask, TaskPriority, TaskStatus } from "@/types";

type PopUser = {
  _id: string;
  name?: string;
  username?: string;
  avatarUrl?: string;
} | null;

export type TaskDetailModel = {
  _id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId?: string;
  assignedById?: string;
  assignee?: PopUser;
  assignedBy?: PopUser;
  departmentPath: string;
  dueDate?: string;
  steps: IStep[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

type CommentRow = {
  _id: string;
  text: string;
  createdAt: string;
  user: {
    _id: string;
    name?: string;
    username?: string;
    avatarUrl?: string;
  } | null;
};

const STATUS_TABS: { value: TaskStatus; label: string }[] = [
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "review", label: "Review" },
  { value: "done", label: "Done" },
];

const PRIORITY_ACCENT: Record<TaskPriority, string> = {
  urgent: "border-l-red-500",
  high: "border-l-orange-500",
  medium: "border-l-blue-400",
  low: "border-l-slate-300 dark:border-l-slate-600",
};

function toITask(t: TaskDetailModel): ITask {
  return {
    _id: t._id,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    assigneeId: t.assigneeId ?? "",
    assignedById: t.assignedById ?? "",
    departmentPath: t.departmentPath,
    dueDate: t.dueDate,
    estimatedHours: undefined,
    steps: t.steps,
    tags: t.tags ?? [],
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

export function TaskDetail({ taskId }: { taskId: string }) {
  const router = useRouter();
  const token = useAppStore((s) => s.token);
  const { user } = useAuth();

  const [task, setTask] = useState<TaskDetailModel | null>(null);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentSending, setCommentSending] = useState(false);

  const canEdit = user ? hasRole(user.role, "manager") : false;
  const canEditSteps = canEdit || (!!user && !!task && user._id === task.assigneeId);
  const canChangeStatus = canEdit || (!!user && !!task && user._id === task.assigneeId);

  const taskRef = useRef(task);
  taskRef.current = task;

  const updateTaskStatus = useCallback(async (newStatus: TaskStatus) => {
    if (!token) return;
    setTask((prev) => (prev ? { ...prev, status: newStatus } : null));
    haptic("light");
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
    } catch {
      haptic("error");
    }
  }, [token, taskId]);

  const loadTask = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = (await res.json()) as { success?: boolean; data?: TaskDetailModel; error?: string };
      if (!res.ok || json.success === false || !json.data) throw new Error(json.error || "Could not load task");
      setTask(json.data);
      document.title = `${json.data.title} · TaskFlow`;
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Error");
      setTask(null);
    } finally {
      setLoading(false);
    }
  }, [token, taskId]);

  const loadComments = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`/api/tasks/${taskId}/comments`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = (await res.json()) as { success?: boolean; data?: CommentRow[]; error?: string };
      if (!res.ok || json.success === false) throw new Error(json.error || "Comments failed");
      setComments(json.data ?? []);
    } catch {
      setComments([]);
    }
  }, [token, taskId]);

  useEffect(() => { void loadTask(); }, [loadTask]);
  useEffect(() => { if (task) void loadComments(); }, [task, loadComments]);
  useEffect(() => {
    showBackButton(() => router.push("/"));
    return () => { hideBackButton(); document.title = "TaskFlow"; };
  }, [router]);

  const onStepsChange = useCallback((newSteps: IStep[]) => {
    setTask((prev) => (prev ? { ...prev, steps: newSteps } : null));
    const current = taskRef.current;
    if (!current) return;
    const allDone = newSteps.length > 0 && newSteps.every((s) => s.done);
    const anyDone = newSteps.some((s) => s.done);
    if (allDone && current.status !== "done" && current.status !== "review") {
      void updateTaskStatus("review");
    } else if (anyDone && current.status === "todo") {
      void updateTaskStatus("in_progress");
    }
  }, [updateTaskStatus]);

  const sendComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !commentText.trim() || !user) return;
    haptic("light");
    const text = commentText.trim();
    const tempId = `tmp-${Date.now()}`;
    const optimistic: CommentRow = {
      _id: tempId,
      text,
      createdAt: new Date().toISOString(),
      user: { _id: user._id, name: user.name, username: user.username, avatarUrl: user.avatarUrl },
    };
    setComments((c) => [...c, optimistic]);
    setCommentText("");
    setCommentSending(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/comments`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const json = (await res.json()) as { success?: boolean; data?: CommentRow; error?: string };
      if (!res.ok || json.success === false || !json.data) throw new Error(json.error || "Failed");
      setComments((c) => c.map((row) => (row._id === tempId ? json.data! : row)));
    } catch {
      setComments((c) => c.filter((row) => row._id !== tempId));
      setCommentText(text);
      haptic("error");
    } finally {
      setCommentSending(false);
    }
  };

  if (!token || !user) return <SignInNotice />;
  if (loading && !task) return <TaskDetailSkeleton />;
  if (loadError || !task) {
    return (
      <div className="min-h-screen bg-[var(--tg-bg)] p-4 text-[var(--tg-text)]">
        <p className="text-sm text-red-500">{loadError ?? "Not found"}</p>
        <button type="button" className="mt-4 min-h-[44px] text-[var(--tg-link)]"
          onClick={() => { haptic("light"); router.push("/"); }}>
          Back to tasks
        </button>
      </div>
    );
  }

  const assigneeUser = task.assignee
    ? { _id: task.assignee._id, name: task.assignee.name ?? "?", username: task.assignee.username, avatarUrl: task.assignee.avatarUrl }
    : task.assigneeId
      ? { _id: task.assigneeId, name: "Assignee" }
      : { _id: "none", name: "Unassigned" };

  const isOverdue = task.dueDate && task.status !== "done" && dayjs(task.dueDate).isBefore(dayjs().startOf("day"));

  return (
    <div className={clsx(
      "min-h-screen bg-[var(--tg-bg)] pb-32 text-[var(--tg-text)]",
    )}>
      {/* Header */}
      <header className={clsx(
        "sticky top-0 z-20 border-b-4 bg-[var(--tg-bg)]/95 px-4 pb-3 pt-3 backdrop-blur",
        PRIORITY_ACCENT[task.priority],
      )}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex flex-wrap gap-1.5">
              <Badge status={task.status} />
              <Badge priority={task.priority} />
            </div>
            <h1 className="text-xl font-bold leading-tight">{task.title}</h1>
          </div>
          {canEdit ? (
            <button
              type="button"
              onClick={() => { haptic("light"); setEditSheetOpen(true); }}
              className="shrink-0 flex items-center gap-1.5 rounded-xl bg-[var(--tg-secondary-bg)] px-3 py-2 text-sm font-medium text-[var(--tg-text)] min-h-[44px]"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </button>
          ) : null}
        </div>
      </header>

      {/* Status stepper */}
      {canChangeStatus ? (
        <div className="flex gap-1.5 border-b border-black/5 px-4 py-3 dark:border-white/10">
          {STATUS_TABS.map((s, i) => {
            const statuses: TaskStatus[] = ["todo", "in_progress", "review", "done"];
            const currentIdx = statuses.indexOf(task.status);
            const isActive = task.status === s.value;
            const isPast = statuses.indexOf(s.value) < currentIdx;
            return (
              <button
                key={s.value}
                type="button"
                onClick={() => { if (!isActive) void updateTaskStatus(s.value); }}
                className={clsx(
                  "flex-1 rounded-xl py-2 text-xs font-semibold transition-colors",
                  isActive
                    ? "bg-[var(--tg-button)] text-[var(--tg-button-text)]"
                    : isPast
                      ? "bg-[var(--tg-button)]/20 text-[var(--tg-button)]"
                      : "bg-[var(--tg-secondary-bg)] text-[var(--tg-hint)]",
                )}
              >
                {i + 1}. {s.label}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="space-y-5 px-4 py-4">
        {/* Metadata card */}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center gap-2.5 rounded-2xl bg-[var(--tg-secondary-bg)] p-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--tg-bg)]">
              <User className="h-4 w-4 text-[var(--tg-hint)]" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--tg-hint)]">Assignee</p>
              <div className="flex items-center gap-1.5">
                <Avatar user={assigneeUser} size="sm" />
                <p className="truncate text-xs font-medium">{assigneeUser.name}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 rounded-2xl bg-[var(--tg-secondary-bg)] p-3">
            <div className={clsx(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
              isOverdue ? "bg-red-100 dark:bg-red-900/30" : "bg-[var(--tg-bg)]",
            )}>
              <Calendar className={clsx("h-4 w-4", isOverdue ? "text-red-500" : "text-[var(--tg-hint)]")} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--tg-hint)]">Due date</p>
              <p className={clsx("text-xs font-medium", isOverdue ? "text-red-500" : "")}>
                {task.dueDate ? dayjs(task.dueDate).format("MMM D, YYYY") : "Not set"}
              </p>
              {isOverdue ? <p className="text-[10px] text-red-400">Overdue</p> : null}
            </div>
          </div>

          <div className="col-span-2 flex items-center gap-2.5 rounded-2xl bg-[var(--tg-secondary-bg)] p-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--tg-bg)]">
              <Building2 className="h-4 w-4 text-[var(--tg-hint)]" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--tg-hint)]">Department</p>
              <p className="truncate text-xs font-medium">{task.departmentPath}</p>
            </div>
          </div>
        </div>

        {/* Description */}
        <section>
          <div className="mb-2 flex items-center gap-2">
            <AlignLeft className="h-4 w-4 text-[var(--tg-hint)]" />
            <h3 className="text-sm font-semibold">Description</h3>
          </div>
          <p className={clsx(
            "whitespace-pre-wrap rounded-2xl p-3 text-sm leading-relaxed",
            "bg-[var(--tg-secondary-bg)]",
            !task.description?.trim() && "text-[var(--tg-hint)] italic",
          )}>
            {task.description?.trim() || "No description."}
          </p>
        </section>

        {/* Steps */}
        <StepList
          taskId={taskId}
          steps={task.steps}
          canEdit={canEditSteps}
          token={token}
          onStepsChange={onStepsChange}
        />

        {/* Tags */}
        {task.tags?.length > 0 ? (
          <section>
            <div className="flex flex-wrap gap-1.5">
              {task.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-[var(--tg-secondary-bg)] px-2.5 py-0.5 text-xs text-[var(--tg-hint)]">
                  #{tag}
                </span>
              ))}
            </div>
          </section>
        ) : null}

        {/* Comments */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-[var(--tg-hint)]" />
            <h3 className="text-sm font-semibold">Comments</h3>
            {comments.length > 0 ? (
              <span className="ml-auto rounded-full bg-[var(--tg-secondary-bg)] px-2 py-0.5 text-xs text-[var(--tg-hint)]">
                {comments.length}
              </span>
            ) : null}
          </div>

          {comments.length > 0 ? (
            <ul className="space-y-3">
              {comments.map((c) => (
                <li key={c._id} className="flex gap-2.5">
                  <Avatar
                    user={{ _id: c.user?._id ?? "?", name: c.user?.name ?? "?", username: c.user?.username, avatarUrl: c.user?.avatarUrl }}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1 rounded-2xl rounded-tl-sm bg-[var(--tg-secondary-bg)] px-3 py-2.5">
                    <div className="mb-1 flex flex-wrap items-baseline gap-2">
                      <span className="text-xs font-semibold">{c.user?.name ?? "Unknown"}</span>
                      <time className="text-[10px] text-[var(--tg-hint)]" dateTime={c.createdAt}>
                        {dayjs(c.createdAt).format("MMM D, h:mm a")}
                      </time>
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{c.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm italic text-[var(--tg-hint)]">No comments yet.</p>
          )}

          <form onSubmit={sendComment} className="flex gap-2">
            <input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Write a comment…"
              className="min-h-[44px] flex-1 rounded-2xl border border-black/10 bg-[var(--tg-secondary-bg)] px-4 text-sm dark:border-white/10"
            />
            <button
              type="submit"
              disabled={commentSending || !commentText.trim()}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--tg-button)] text-[var(--tg-button-text)] disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </section>

        {/* Meta footer */}
        <p className="text-center text-[10px] text-[var(--tg-hint)]">
          Created {dayjs(task.createdAt).format("MMM D, YYYY")} · Updated {dayjs(task.updatedAt).format("MMM D")}
        </p>
      </div>

      {task ? (
        <CreateTaskSheet
          isOpen={editSheetOpen}
          onClose={() => setEditSheetOpen(false)}
          editTask={toITask(task)}
          onUpdated={() => { setEditSheetOpen(false); void loadTask(); }}
        />
      ) : null}

      {/* Sticky action bar */}
      {canChangeStatus && task.status !== "done" ? (
        <div
          className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--tg-border)] bg-[var(--tg-bg)]/95 px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 backdrop-blur"
          style={{ boxShadow: "var(--shadow-lg)" }}
        >
          <button
            type="button"
            onClick={() => { haptic("success"); void updateTaskStatus("done"); }}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 text-sm font-semibold text-white shadow-[var(--shadow-md)] transition active:scale-[0.985]"
          >
            <Check className="h-5 w-5" strokeWidth={3} />
            Mark as done
          </button>
        </div>
      ) : null}
    </div>
  );
}
