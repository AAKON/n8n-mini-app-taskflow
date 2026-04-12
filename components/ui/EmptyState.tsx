import clsx from "clsx";
import type { ReactNode } from "react";

export type EmptyStateProps = {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={clsx(
        "flex flex-col items-center justify-center gap-3 px-6 py-12 text-center",
        className,
      )}
    >
      <div className="text-[var(--tg-hint)] [&_svg]:h-12 [&_svg]:w-12">{icon}</div>
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-[var(--tg-text)]">{title}</h3>
        <p className="max-w-sm text-sm text-[var(--tg-hint)]">{description}</p>
      </div>
      {action ? (
        <div className="mt-2 flex min-h-[44px] items-center justify-center">
          {action}
        </div>
      ) : null}
    </div>
  );
}
