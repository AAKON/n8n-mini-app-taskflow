import clsx from "clsx";
import type { ReactNode } from "react";

export type EmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
};

function DefaultIllustration() {
  return (
    <svg
      viewBox="0 0 160 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="h-28 w-36"
      aria-hidden
    >
      <rect x="20" y="24" width="120" height="80" rx="14" fill="var(--tg-secondary-bg)" />
      <rect x="34" y="42" width="68" height="8" rx="4" fill="var(--tg-hint)" opacity="0.35" />
      <rect x="34" y="58" width="92" height="6" rx="3" fill="var(--tg-hint)" opacity="0.22" />
      <rect x="34" y="72" width="54" height="6" rx="3" fill="var(--tg-hint)" opacity="0.22" />
      <circle cx="118" cy="46" r="10" fill="var(--tg-button)" opacity="0.35" />
      <path
        d="M113 46l4 4 8-8"
        stroke="var(--tg-button)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

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
        "flex flex-col items-center justify-center gap-4 px-6 py-16 text-center",
        className,
      )}
    >
      <div className="text-[var(--tg-hint)] [&_svg]:h-12 [&_svg]:w-12">
        {icon ?? <DefaultIllustration />}
      </div>
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
