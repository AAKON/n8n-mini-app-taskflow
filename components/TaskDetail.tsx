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
  ArrowRight,
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
  startDate?: string;
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
  urgent: "border-l-[var(--tone-danger)]",
  high: "border-l-[var(--tone-warning)]",
  medium: "border-l-[var(--tone-info)]",
  low: "border-l-[var(--tg-border-strong)]",
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
    startDate: t.startDate,
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
  const [pendingStatus, setPendingStatus] = useState<TaskStatus | null>(null);

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
    if (!current || current.status === "done") return;
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
      <div className="tf-page min-h-screen p-4 text-[var(--tg-text)]">
        <p className="text-sm text-[var(--tone-danger)]">{loadError ?? "Not found"}</p>
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
      "tf-page min-h-screen pb-8 text-[var(--tg-text)]",
    )}>
      {/* Header */}
      <header className={clsx(
        "tf-topbar border-b-4 px-4 pb-3 pt-3",
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
                className="tf-btn-secondary shrink-0 flex min-h-[44px] items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-[var(--tg-text)]"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
            </button>
          ) : null}
        </div>
      </header>

      {/* Status stepper */}
      {canChangeStatus ? (
        <div className="flex gap-1.5 border-b border-[var(--tg-divider)] px-4 py-3">
          {STATUS_TABS.map((s, i) => {
            const statuses: TaskStatus[] = ["todo", "in_progress", "review", "done"];
            const currentIdx = statuses.indexOf(task.status);
            const isActive = task.status === s.value;
            const isPast = statuses.indexOf(s.value) < currentIdx;
            const locked = task.status === "done";
            return (
              <button
                key={s.value}
                type="button"
                disabled={locked || isActive}
                onClick={() => { haptic("light"); setPendingStatus(s.value); }}
                className={clsx(
                  "flex-1 rounded-xl border py-2 text-xs font-semibold transition-colors",
                  isActive
                    ? "border-transparent bg-[var(--tg-button)] text-[var(--tg-button-text)] shadow-[var(--shadow-sm)]"
                    : isPast
                      ? "border-transparent bg-[var(--tg-button)]/20 text-[var(--tg-button)]"
                      : "border-[var(--tg-border)] bg-[var(--tg-secondary-bg)] text-[var(--tg-hint)]",
                  locked && !isActive && "cursor-not-allowed opacity-40",
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
          {/* Assignee */}
          <div className="tf-card flex items-center gap-2.5 p-3">
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

          {/* Assigned by */}
          <div className="tf-card flex items-center gap-2.5 p-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--tg-bg)]">
              <User className="h-4 w-4 text-[var(--tg-hint)]" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--tg-hint)]">Assigned by</p>
              <div className="flex items-center gap-1.5">
                {task.assignedBy ? (
                  <>
                    <Avatar user={{ _id: task.assignedBy._id, name: task.assignedBy.name ?? "?", username: task.assignedBy.username, avatarUrl: task.assignedBy.avatarUrl }} size="sm" />
                    <p className="truncate text-xs font-medium">{task.assignedBy.name ?? "?"}</p>
                  </>
                ) : (
                  <p className="text-xs text-[var(--tg-hint)]">Unknown</p>
                )}
              </div>
            </div>
          </div>

          {/* Time range */}
          <div className={clsx("tf-card flex items-center gap-2.5 p-3", isOverdue && "border border-rose-400/40")}>
            <div className={clsx(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
              isOverdue ? "bg-rose-500/15" : "bg-[var(--tg-bg)]",
            )}>
              <Calendar className={clsx("h-4 w-4", isOverdue ? "text-[var(--tone-danger)]" : "text-[var(--tg-hint)]")} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--tg-hint)]">
                {isOverdue ? "Overdue" : "Timeline"}
              </p>
              {task.startDate && task.dueDate ? (
                <div className="flex items-center gap-1">
                  <span className={clsx("text-xs font-medium", isOverdue ? "text-[var(--tone-danger)]" : "")}>
                    {dayjs(task.startDate).format("MMM D")}
                  </span>
                  <ArrowRight className="h-3 w-3 shrink-0 text-[var(--tg-hint)]" />
                  <span className={clsx("text-xs font-medium", isOverdue ? "text-[var(--tone-danger)]" : "")}>
                    {dayjs(task.dueDate).format("MMM D")}
                  </span>
                </div>
              ) : task.dueDate ? (
                <p className={clsx("text-xs font-medium", isOverdue ? "text-[var(--tone-danger)]" : "")}>
                  Due {dayjs(task.dueDate).format("MMM D, YYYY")}
                </p>
              ) : task.startDate ? (
                <p className="text-xs font-medium">
                  From {dayjs(task.startDate).format("MMM D, YYYY")}
                </p>
              ) : (
                <p className="text-xs text-[var(--tg-hint)]">No dates set</p>
              )}
            </div>
          </div>

          {/* Department */}
          <div className="tf-card flex items-center gap-2.5 p-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--tg-bg)]">
              <Building2 className="h-4 w-4 text-[var(--tg-hint)]" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--tg-hint)]">Department</p>
              <p className="truncate text-xs font-medium">{task.departmentPath}</p>
            </div>
          </div>

          {/* Mark as done */}
          {canChangeStatus && task.status !== "done" ? (
            <button
              type="button"
              onClick={() => { haptic("light"); setPendingStatus("done"); }}
              className="tf-card col-span-2 flex items-center justify-center gap-2 rounded-2xl p-3 font-semibold text-[var(--tone-success)] transition active:scale-[0.97]"
            >
              <Check className="h-5 w-5" strokeWidth={2.5} />
              <span className="text-sm">Mark as done</span>
            </button>
          ) : task.status === "done" ? (
            <div className="tf-card col-span-2 flex items-center justify-center gap-2 rounded-2xl p-3">
              <Check className="h-5 w-5 text-[var(--tone-success)]" strokeWidth={2.5} />
              <span className="text-sm font-semibold text-[var(--tone-success)]">Completed</span>
            </div>
          ) : null}
        </div>

        {/* Description */}
        <section>
          <div className="mb-2 flex items-center gap-2">
            <AlignLeft className="h-4 w-4 text-[var(--tg-hint)]" />
            <h3 className="text-sm font-semibold">Description</h3>
          </div>
          <p className={clsx(
            "tf-card whitespace-pre-wrap rounded-2xl p-3 text-sm leading-relaxed",
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
                  <div className="tf-card min-w-0 flex-1 rounded-2xl rounded-tl-sm px-3 py-2.5">
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
              className="tf-input min-h-[44px] flex-1 rounded-2xl px-4 text-sm"
            />
            <button
              type="submit"
              disabled={commentSending || !commentText.trim()}
              className="tf-btn-primary flex h-11 w-11 shrink-0 items-center justify-center rounded-full disabled:opacity-40"
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

      {pendingStatus ? (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 px-4 pb-[env(safe-area-inset-bottom)]"
          onClick={() => { haptic("light"); setPendingStatus(null); }}
        >
          <div
            className="tf-card mb-4 w-full max-w-sm rounded-2xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-1 text-base font-semibold text-[var(--tg-text)]">
              Change status?
            </h3>
            <p className="mb-5 text-sm text-[var(--tg-hint)]">
              Move task to{" "}
              <span className="font-semibold text-[var(--tg-text)]">
                {STATUS_TABS.find((s) => s.value === pendingStatus)?.label}
              </span>
              ?
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { haptic("light"); setPendingStatus(null); }}
                className="tf-btn-secondary flex-1 min-h-[44px] rounded-xl text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const s = pendingStatus;
                  setPendingStatus(null);
                  haptic(s === "done" ? "success" : "light");
                  void updateTaskStatus(s);
                }}
                className="tf-btn-primary flex-1 min-h-[44px] rounded-xl text-sm font-medium"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );
}
