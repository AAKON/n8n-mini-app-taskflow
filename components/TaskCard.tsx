"use client";

import { useRef, useState } from "react";
import dayjs from "dayjs";
import clsx from "clsx";
import { Calendar, CheckSquare, Check } from "lucide-react";
import type { ITask } from "@/types";
import { Avatar, type AvatarUser } from "@/components/ui/Avatar";
import { haptic } from "@/lib/tma";

export type TaskListTask = ITask & { assignee?: AvatarUser };

export type TaskCardProps = {
  task: TaskListTask;
  onClick: () => void;
  onComplete?: (taskId: string) => void;
};

const PRIORITY_ACCENT: Record<string, string> = {
  urgent: "border-l-[var(--tone-danger)]",
  high: "border-l-[var(--tone-warning)]",
  medium: "border-l-[var(--tone-info)]",
  low: "border-l-[var(--tg-border-strong)]",
};

const PRIORITY_LABEL: Record<string, string> = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
};

const PRIORITY_TEXT: Record<string, string> = {
  urgent: "text-[var(--tone-danger)]",
  high: "text-[var(--tone-warning)]",
  medium: "text-[var(--tone-info)]",
  low: "text-[var(--tone-neutral)]",
};

const STATUS_META: Record<string, { label: string; pill: string; dot: string }> = {
  todo: { label: "Todo", pill: "bg-[var(--tg-secondary-bg)] text-[var(--tg-hint)] border border-[var(--tg-border)]", dot: "bg-[var(--tone-neutral)]" },
  in_progress: { label: "In progress", pill: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300", dot: "bg-[var(--tone-info)]" },
  review: { label: "Review", pill: "bg-amber-500/15 text-amber-700 dark:text-amber-300", dot: "bg-[var(--tone-warning)]" },
  done: { label: "Done", pill: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", dot: "bg-[var(--tone-success)]" },
};

function dueMeta(task: ITask) {
  if (!task.dueDate) return null;
  const today = dayjs().startOf("day");
  const due = dayjs(task.dueDate).startOf("day");
  const isDone = task.status === "done";
  if (!isDone && due.isBefore(today)) {
    return { label: `Overdue · ${due.format("MMM D")}`, tone: "bg-rose-500/15 text-rose-700 dark:text-rose-300" };
  }
  if (!isDone && due.isSame(today)) {
    return { label: "Today", tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300" };
  }
  return { label: due.format("MMM D"), tone: "border border-[var(--tg-border)] bg-[var(--tg-secondary-bg)] text-[var(--tg-hint)]" };
}

function stepProgress(task: ITask): { done: number; total: number } {
  const steps = task.steps ?? [];
  return { done: steps.filter((s) => s.done).length, total: steps.length };
}

const SWIPE_THRESHOLD = 96;

export function TaskCard({ task, onClick, onComplete }: TaskCardProps) {
  const { done, total } = stepProgress(task);
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  const due = dueMeta(task);
  const status = STATUS_META[task.status] ?? STATUS_META.todo;
  const priorityAccent = PRIORITY_ACCENT[task.priority] ?? PRIORITY_ACCENT.medium;
  const isDone = task.status === "done";

  const assignee: AvatarUser = task.assignee ?? {
    _id: task.assigneeId || "unassigned",
    name: task.assigneeId ? "?" : "–",
  };

  const [dx, setDx] = useState(0);
  const [popping, setPopping] = useState(false);
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const locked = useRef<"h" | "v" | null>(null);

  const canSwipe = !!onComplete && !isDone;

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!canSwipe) return;
    startX.current = e.clientX;
    startY.current = e.clientY;
    locked.current = null;
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!canSwipe || startX.current === null || startY.current === null) return;
    const deltaX = e.clientX - startX.current;
    const deltaY = e.clientY - startY.current;
    if (locked.current === null) {
      if (Math.abs(deltaX) > 6 || Math.abs(deltaY) > 6) {
        locked.current = Math.abs(deltaX) > Math.abs(deltaY) ? "h" : "v";
      }
    }
    if (locked.current === "h" && deltaX > 0) {
      setDx(Math.min(deltaX, 160));
    }
  };

  const onPointerEnd = () => {
    if (!canSwipe) return;
    if (dx >= SWIPE_THRESHOLD && onComplete) {
      haptic("success");
      setPopping(true);
      setTimeout(() => {
        onComplete(task._id);
        setPopping(false);
        setDx(0);
      }, 250);
    } else {
      setDx(0);
    }
    startX.current = null;
    startY.current = null;
    locked.current = null;
  };

  const handleCheck = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onComplete || isDone) return;
    haptic("success");
    setPopping(true);
    setTimeout(() => {
      onComplete(task._id);
      setPopping(false);
    }, 250);
  };

  return (
    <div className="relative overflow-hidden rounded-[var(--radius-2xl)]">
      {/* Swipe action background */}
      {canSwipe ? (
        <div
          className={clsx(
            "pointer-events-none absolute inset-y-0 left-0 flex items-center justify-start pl-5",
            "bg-[var(--tone-success)]/90 text-white",
          )}
          style={{ width: `${Math.max(dx, 0)}px` }}
        >
          {dx > 24 ? <Check className="h-5 w-5" strokeWidth={3} /> : null}
        </div>
      ) : null}

      <div
        role="button"
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onClick={() => {
          if (locked.current === "h") return;
          haptic("light");
          onClick();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick();
          }
        }}
        className={clsx(
          "group relative flex w-full gap-3 rounded-[var(--radius-2xl)] border border-[var(--tg-border)] border-l-[3px] bg-[var(--tg-card-bg)] p-4 text-left",
          "shadow-[var(--shadow-sm)] hover:-translate-y-px hover:shadow-[var(--shadow-md)] active:scale-[0.985] active:shadow-none",
          "transition-transform duration-[var(--duration-base)] ease-[var(--ease-out)] transition-shadow",
          "touch-pan-y select-none",
          priorityAccent,
          isDone && "opacity-60",
        )}
        style={{ transform: `translateX(${dx}px)` }}
      >
        {/* Checkbox */}
        <button
          type="button"
          onClick={handleCheck}
          aria-label={isDone ? "Completed" : "Mark as done"}
          className={clsx(
            "relative mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition",
            isDone
              ? "border-[var(--tone-success)] bg-[var(--tone-success)] text-white"
              : "border-[var(--tg-border-strong)] hover:border-[var(--tone-success)]",
            popping && "animate-pop",
          )}
        >
          {isDone ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}
        </button>

        <div className="min-w-0 flex-1 space-y-2">
          {/* Title row */}
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <h3 className={clsx(
                "line-clamp-2 text-[15px] font-semibold leading-snug text-[var(--tg-text)]",
                isDone && "line-through",
              )}>
                {task.title}
              </h3>
              {task.departmentPath ? (
                <p className="mt-0.5 truncate text-[11px] text-[var(--tg-hint)]">
                  {task.departmentPath}
                </p>
              ) : null}
            </div>
            <Avatar user={assignee} size="sm" />
          </div>

          {/* Step progress */}
          {total > 0 ? (
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1 text-[11px] text-[var(--tg-hint)]">
                  <CheckSquare className="h-3 w-3" />
                  {done}/{total}
                </span>
                <span className="text-[11px] text-[var(--tg-hint)]">{pct}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[var(--tg-border)]">
                <div
                  className={clsx(
                    "h-full rounded-full transition-[width] duration-[var(--duration-slow)] ease-[var(--ease-out)]",
                    pct === 100 ? "bg-[var(--tone-success)]" : "bg-[var(--tg-button)]",
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          ) : null}

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-2">
            <span className={clsx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", status.pill)}>
              <span className={clsx("h-1.5 w-1.5 rounded-full", status.dot)} />
              {status.label}
            </span>
            <span className={clsx("text-[11px] font-medium", PRIORITY_TEXT[task.priority])}>
              {PRIORITY_LABEL[task.priority]}
            </span>
            {due ? (
              <span className={clsx(
                "ml-auto flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                due.tone,
              )}>
                <Calendar className="h-3 w-3" />
                {due.label}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
