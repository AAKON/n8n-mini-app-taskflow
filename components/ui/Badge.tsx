import clsx from "clsx";
import type { TaskPriority, TaskStatus } from "@/types";

const STATUS_META: Record<
  TaskStatus,
  { label: string; dot: string; pill: string }
> = {
  todo: {
    label: "Todo",
    dot: "bg-[var(--tone-neutral)]",
    pill: "bg-[var(--tg-secondary-bg)] text-[var(--tg-hint)]",
  },
  in_progress: {
    label: "In progress",
    dot: "bg-[var(--tone-info)]",
    pill: "bg-cyan-500/15 text-cyan-800 dark:text-cyan-200",
  },
  review: {
    label: "Review",
    dot: "bg-[var(--tone-warning)]",
    pill: "bg-amber-500/15 text-amber-900 dark:text-amber-200",
  },
  done: {
    label: "Done",
    dot: "bg-[var(--tone-success)]",
    pill: "bg-emerald-500/15 text-emerald-900 dark:text-emerald-200",
  },
};

const PRIORITY_META: Record<
  TaskPriority,
  { label: string; dot: string; pill: string }
> = {
  low: {
    label: "Low",
    dot: "bg-[var(--tone-neutral)]",
    pill: "bg-[var(--tg-secondary-bg)] text-[var(--tg-hint)]",
  },
  medium: {
    label: "Medium",
    dot: "bg-[var(--tone-info)]",
    pill: "bg-cyan-500/15 text-cyan-900 dark:text-cyan-100",
  },
  high: {
    label: "High",
    dot: "bg-[var(--tone-warning)]",
    pill: "bg-amber-500/15 text-amber-900 dark:text-amber-100",
  },
  urgent: {
    label: "Urgent",
    dot: "bg-[var(--tone-danger)]",
    pill: "bg-rose-500/15 text-rose-900 dark:text-rose-100",
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
