import clsx from "clsx";
import type { TaskPriority, TaskStatus } from "@/types";

const STATUS_META: Record<
  TaskStatus,
  { label: string; dot: string; pill: string }
> = {
  todo: {
    label: "Todo",
    dot: "bg-zinc-400",
    pill: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300",
  },
  in_progress: {
    label: "In progress",
    dot: "bg-sky-500",
    pill: "bg-sky-500/15 text-sky-800 dark:text-sky-200",
  },
  review: {
    label: "Review",
    dot: "bg-amber-500",
    pill: "bg-amber-500/15 text-amber-900 dark:text-amber-200",
  },
  done: {
    label: "Done",
    dot: "bg-emerald-500",
    pill: "bg-emerald-500/15 text-emerald-900 dark:text-emerald-200",
  },
};

const PRIORITY_META: Record<
  TaskPriority,
  { label: string; dot: string; pill: string }
> = {
  low: {
    label: "Low",
    dot: "bg-slate-400",
    pill: "bg-slate-500/15 text-slate-800 dark:text-slate-200",
  },
  medium: {
    label: "Medium",
    dot: "bg-blue-500",
    pill: "bg-blue-500/15 text-blue-900 dark:text-blue-100",
  },
  high: {
    label: "High",
    dot: "bg-orange-500",
    pill: "bg-orange-500/15 text-orange-900 dark:text-orange-100",
  },
  urgent: {
    label: "Urgent",
    dot: "bg-red-500",
    pill: "bg-red-500/15 text-red-900 dark:text-red-100",
  },
};

type Base = {
  className?: string;
  dotClassName?: string;
};

export type BadgeProps =
  | (Base & { status: TaskStatus; priority?: never; label?: never })
  | (Base & { priority: TaskPriority; status?: never; label?: never })
  | (Base & { label: string; status?: never; priority?: never });

export function Badge(props: BadgeProps) {
  let text: string;
  let dot: string;
  let pill: string;

  if ("status" in props && props.status) {
    const m = STATUS_META[props.status];
    text = m.label;
    dot = props.dotClassName ?? m.dot;
    pill = m.pill;
  } else if ("priority" in props && props.priority) {
    const m = PRIORITY_META[props.priority];
    text = m.label;
    dot = props.dotClassName ?? m.dot;
    pill = m.pill;
  } else {
    text = props.label;
    dot = props.dotClassName ?? "bg-[var(--tg-hint)]";
    pill = "bg-[var(--tg-secondary-bg)] text-[var(--tg-text)]";
  }

  return (
    <span
      className={clsx(
        "inline-flex max-w-full items-center gap-1.5 rounded-full border border-[var(--tg-border)] px-2 py-0.5 text-xs font-medium leading-none",
        pill,
        props.className,
      )}
    >
      <span
        className={clsx("h-1.5 w-1.5 shrink-0 rounded-full", dot)}
        aria-hidden
      />
      <span className="truncate">{text}</span>
    </span>
  );
}
