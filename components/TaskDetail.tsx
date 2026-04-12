"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dayjs from "dayjs";
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

  const loadTask = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = (await res.json()) as {
        success?: boolean;
        data?: TaskDetailModel;
        error?: string;
      };
      if (!res.ok || json.success === false || !json.data) {
        throw new Error(json.error || "Could not load task");
      }
      const t = json.data;
      setTask(t);
      document.title = `${t.title} · TaskFlow`;
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
      const json = (await res.json()) as {
        success?: boolean;
        data?: CommentRow[];
        error?: string;
      };
      if (!res.ok || json.success === false) {
        throw new Error(json.error || "Comments failed");
      }
      setComments(json.data ?? []);
    } catch {
      setComments([]);
    }
  }, [token, taskId]);

  useEffect(() => {
    void loadTask();
  }, [loadTask]);

  useEffect(() => {
    if (task) void loadComments();
  }, [task, loadComments]);

  useEffect(() => {
    showBackButton(() => router.push("/"));
    return () => {
      hideBackButton();
      document.title = "TaskFlow";
    };
  }, [router]);

  const onStepsChange = useCallback((steps: IStep[]) => {
    setTask((prev) => (prev ? { ...prev, steps } : null));
  }, []);

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
      user: {
        _id: user._id,
        name: user.name,
        username: user.username,
        avatarUrl: user.avatarUrl,
      },
    };
    setComments((c) => [...c, optimistic]);
    setCommentText("");
    setCommentSending(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/comments`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      });
      const json = (await res.json()) as {
        success?: boolean;
        data?: CommentRow;
        error?: string;
      };
      if (!res.ok || json.success === false || !json.data) {
        throw new Error(json.error || "Failed");
      }
      setComments((c) =>
        c.map((row) => (row._id === tempId ? json.data! : row)),
      );
    } catch {
      setComments((c) => c.filter((row) => row._id !== tempId));
      setCommentText(text);
      haptic("error");
    } finally {
      setCommentSending(false);
    }
  };

  if (!token || !user) {
    return <SignInNotice />;
  }

  if (loading && !task) {
    return <TaskDetailSkeleton />;
  }

  if (loadError || !task) {
    return (
      <div className="min-h-screen bg-[var(--tg-bg)] p-4 text-[var(--tg-text)]">
        <p className="text-sm text-red-500">{loadError ?? "Not found"}</p>
        <button
          type="button"
          className="mt-4 min-h-[44px] text-[var(--tg-link)]"
          onClick={() => {
            haptic("light");
            router.push("/");
          }}
        >
          Back to tasks
        </button>
      </div>
    );
  }

  const assigneeUser = task.assignee
    ? {
        _id: task.assignee._id,
        name: task.assignee.name ?? "?",
        username: task.assignee.username,
        avatarUrl: task.assignee.avatarUrl,
      }
    : task.assigneeId
      ? { _id: task.assigneeId, name: "Assignee" }
      : { _id: "none", name: "Unassigned" };

  const dueLabel = task.dueDate
    ? dayjs(task.dueDate).format("MMM D, YYYY")
    : "No due date";

  return (
    <div className="min-h-screen bg-[var(--tg-bg)] pb-32 text-[var(--tg-text)]">
      <header className="sticky top-0 z-20 border-b border-black/5 bg-[var(--tg-bg)]/95 px-4 pb-3 pt-2 backdrop-blur dark:border-white/10">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold leading-tight">{task.title}</h1>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge status={task.status} />
              <Badge priority={task.priority} />
            </div>
          </div>
          {canEdit ? (
            <button
              type="button"
              onClick={() => {
                haptic("light");
                setEditSheetOpen(true);
              }}
              className="shrink-0 rounded-lg bg-[var(--tg-secondary-bg)] px-3 py-2 text-sm font-medium text-[var(--tg-text)] min-h-[44px]"
            >
              Edit
            </button>
          ) : null}
        </div>
      </header>

      <div className="space-y-6 px-4 py-4">
        <section className="flex flex-wrap items-center gap-3 border-b border-black/5 pb-4 dark:border-white/10">
          <div className="flex min-h-[44px] items-center gap-2">
            <Avatar user={assigneeUser} size="md" />
            <div>
              <p className="text-sm font-medium">{assigneeUser.name}</p>
              {task.assignee?.username ? (
                <p className="text-xs text-[var(--tg-hint)]">
                  @{task.assignee.username}
                </p>
              ) : null}
            </div>
          </div>
          <div className="text-sm">
            <span className="text-[var(--tg-hint)]">Due </span>
            {dueLabel}
          </div>
          <div className="w-full text-xs text-[var(--tg-hint)]">
            {task.departmentPath}
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold">Description</h3>
          <p className="whitespace-pre-wrap text-sm text-[var(--tg-text)]">
            {task.description?.trim() ? task.description : "No description."}
          </p>
        </section>

        <StepList
          taskId={taskId}
          steps={task.steps}
          canEdit={canEdit}
          token={token}
          onStepsChange={onStepsChange}
        />

        <section className="space-y-3 border-t border-black/5 pt-4 dark:border-white/10">
          <h3 className="text-sm font-semibold">Comments</h3>
          <ul className="space-y-4">
            {comments.map((c) => (
              <li key={c._id} className="flex gap-2">
                <Avatar
                  user={{
                    _id: c.user?._id ?? "?",
                    name: c.user?.name ?? "?",
                    username: c.user?.username,
                    avatarUrl: c.user?.avatarUrl,
                  }}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-sm font-medium">
                      {c.user?.name ?? "Unknown"}
                    </span>
                    <time
                      className="text-xs text-[var(--tg-hint)]"
                      dateTime={c.createdAt}
                    >
                      {dayjs(c.createdAt).format("MMM D, h:mm a")}
                    </time>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--tg-text)]">
                    {c.text}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <form onSubmit={sendComment} className="flex gap-2 pt-2">
            <input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Write a comment…"
              className="min-h-[44px] flex-1 rounded-lg border border-black/10 bg-[var(--tg-secondary-bg)] px-3 text-sm dark:border-white/10"
            />
            <button
              type="submit"
              disabled={commentSending || !commentText.trim()}
              className="min-h-[44px] shrink-0 rounded-lg bg-[var(--tg-button)] px-4 text-sm font-medium text-[var(--tg-button-text)] disabled:opacity-50"
            >
              Send
            </button>
          </form>
        </section>
      </div>

      {task ? (
        <CreateTaskSheet
          isOpen={editSheetOpen}
          onClose={() => setEditSheetOpen(false)}
          editTask={toITask(task)}
          onUpdated={() => {
            setEditSheetOpen(false);
            void loadTask();
          }}
        />
      ) : null}
    </div>
  );
}
