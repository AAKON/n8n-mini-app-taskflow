"use client";

import dayjs from "dayjs";
import clsx from "clsx";
import type { ITask } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { Avatar, type AvatarUser } from "@/components/ui/Avatar";
import { haptic } from "@/lib/tma";

export type TaskListTask = ITask & { assignee?: AvatarUser };

export type TaskCardProps = {
  task: TaskListTask;
  onClick: () => void;
};

function isOverdue(task: ITask): boolean {
  if (task.status === "done" || !task.dueDate) return false;
  return dayjs(task.dueDate).isBefore(dayjs().startOf("day"));
}

function stepProgress(task: ITask): { done: number; total: number } {
  const steps = task.steps ?? [];
  const total = steps.length;
  const done = steps.filter((s) => s.done).length;
  return { done, total };
}

export function TaskCard({ task, onClick }: TaskCardProps) {
  const { done, total } = stepProgress(task);
  const overdue = isOverdue(task);
  const dueLabel = task.dueDate
    ? dayjs(task.dueDate).format("MMM D")
    : null;

  const assignee: AvatarUser = task.assignee ?? {
    _id: task.assigneeId || "unassigned",
    name: "?",
  };

  return (
    <button
      type="button"
      onClick={() => {
        haptic("light");
        onClick();
      }}
      className={clsx(
        "flex w-full min-h-[44px] flex-col gap-2 rounded-xl border border-black/5 bg-[var(--tg-secondary-bg)] p-3 text-left",
        "transition active:scale-[0.99] dark:border-white/10",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="line-clamp-2 flex-1 text-[15px] font-semibold leading-snug text-[var(--tg-text)]">
          {task.title}
        </h3>
        <Avatar user={assignee} size="sm" className="shrink-0" />
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge priority={task.priority} />
        <Badge status={task.status} />
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--tg-hint)]">
        {dueLabel ? (
          <span
            className={clsx(
              overdue ? "font-medium text-red-500" : "text-[var(--tg-hint)]",
            )}
          >
            Due {dueLabel}
          </span>
        ) : (
          <span>No due date</span>
        )}
        {total > 0 ? (
          <span>
            {done}/{total} steps
          </span>
        ) : (
          <span>No steps</span>
        )}
      </div>
      {task.departmentPath ? (
        <p className="truncate text-[11px] text-[var(--tg-hint)]">
          {task.departmentPath}
        </p>
      ) : null}
    </button>
  );
}
