import clsx from "clsx";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Minus,
  type LucideIcon,
} from "lucide-react";
import type { TaskPriority } from "@/types";

const ICONS: Record<TaskPriority, LucideIcon> = {
  low: ArrowDown,
  medium: Minus,
  high: ArrowUp,
  urgent: AlertTriangle,
};

const COLORS: Record<TaskPriority, string> = {
  low: "text-[var(--tone-neutral)]",
  medium: "text-[var(--tone-info)]",
  high: "text-[var(--tone-warning)]",
  urgent: "text-[var(--tone-danger)]",
};

export type PriorityIconProps = {
  priority: TaskPriority;
  className?: string;
  size?: number;
};

export function PriorityIcon({
  priority,
  className,
  size = 18,
}: PriorityIconProps) {
  const Icon = ICONS[priority];
  return (
    <Icon
      className={clsx(COLORS[priority], className)}
      size={size}
      aria-hidden
    />
  );
}
