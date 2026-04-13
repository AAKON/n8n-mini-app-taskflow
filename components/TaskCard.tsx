"use client";

import dayjs from "dayjs";
import clsx from "clsx";
import { Calendar, CheckSquare, ChevronRight } from "lucide-react";
import type { ITask } from "@/types";
import { Avatar, type AvatarUser } from "@/components/ui/Avatar";
import { haptic } from "@/lib/tma";

export type TaskListTask = ITask & { assignee?: AvatarUser };

export type TaskCardProps = {
  task: TaskListTask;
  onClick: () => void;
};

const PRIORITY_ACCENT: Record<string, string> = {
  urgent: "border-l-red-500",
  high: "border-l-orange-500",
  medium: "border-l-blue-400",
  low: "border-l-slate-300 dark:border-l-slate-600",
};

const PRIORITY_LABEL: Record<string, string> = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
};

const PRIORITY_TEXT: Record<string, string> = {
  urgent: "text-red-500",
  high: "text-orange-500",
  medium: "text-blue-500",
  low: "text-slate-400",
};

const STATUS_META: Record<string, { label: string; pill: string; dot: string }> = {
  todo: { label: "Todo", pill: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-300", dot: "bg-zinc-400" },
  in_progress: { label: "In progress", pill: "bg-sky-500/10 text-sky-700 dark:text-sky-300", dot: "bg-sky-500" },
  review: { label: "Review", pill: "bg-amber-500/10 text-amber-700 dark:text-amber-300", dot: "bg-amber-500" },
  done: { label: "Done", pill: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500" },
};

function isOverdue(task: ITask): boolean {
  if (task.status === "done" || !task.dueDate) return false;
  return dayjs(task.dueDate).isBefore(dayjs().startOf("day"));
}

function stepProgress(task: ITask): { done: number; total: number } {
  const steps = task.steps ?? [];
  return { done: steps.filter((s) => s.done).length, total: steps.length };
}

export function TaskCard({ task, onClick }: TaskCardProps) {
  const { done, total } = stepProgress(task);
  const overdue = isOverdue(task);
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  const dueLabel = task.dueDate ? dayjs(task.dueDate).format("MMM D") : null;
  const status = STATUS_META[task.status] ?? STATUS_META.todo;
  const priorityAccent = PRIORITY_ACCENT[task.priority] ?? PRIORITY_ACCENT.medium;

  const assignee: AvatarUser = task.assignee ?? {
    _id: task.assigneeId || "unassigned",
    name: task.assigneeId ? "?" : "–",
  };

  return (
    <button
      type="button"
      onClick={() => {
        haptic("light");
        onClick();
      }}
      className={clsx(
        "group flex w-full flex-col gap-3 rounded-2xl border-l-4 bg-[var(--tg-secondary-bg)] p-4 text-left",
        "shadow-sm transition active:scale-[0.985] active:shadow-none",
        priorityAccent,
      )}
    >
      {/* Top row: title + avatar */}
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug text-[var(--tg-text)]">
            {task.title}
          </h3>
          {task.departmentPath ? (
            <p className="mt-0.5 truncate text-[11px] text-[var(--tg-hint)]">
              {task.departmentPath}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <Avatar user={assignee} size="sm" />
          <ChevronRight className="h-3.5 w-3.5 text-[var(--tg-hint)] opacity-0 transition-opacity group-active:opacity-100" />
        </div>
      </div>

      {/* Step progress bar */}
      {total > 0 ? (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 text-[11px] text-[var(--tg-hint)]">
              <CheckSquare className="h-3 w-3" />
              {done}/{total} steps
            </span>
            <span className="text-[11px] text-[var(--tg-hint)]">{pct}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
            <div
              className={clsx(
                "h-full rounded-full transition-[width]",
                pct === 100 ? "bg-emerald-500" : "bg-[var(--tg-button)]",
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      ) : null}

      {/* Bottom row: status + priority + due */}
      <div className="flex flex-wrap items-center gap-2">
        <span className={clsx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", status.pill)}>
          <span className={clsx("h-1.5 w-1.5 rounded-full", status.dot)} />
          {status.label}
        </span>
        <span className={clsx("text-[11px] font-medium", PRIORITY_TEXT[task.priority])}>
          {PRIORITY_LABEL[task.priority]}
        </span>
        {dueLabel ? (
          <span className={clsx(
            "ml-auto flex items-center gap-1 text-[11px] font-medium",
            overdue ? "text-red-500" : "text-[var(--tg-hint)]",
          )}>
            <Calendar className="h-3 w-3" />
            {overdue ? "Overdue · " : ""}{dueLabel}
          </span>
        ) : null}
      </div>
    </button>
  );
}
