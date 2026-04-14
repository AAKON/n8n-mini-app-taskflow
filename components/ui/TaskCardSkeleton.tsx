import clsx from "clsx";

export function TaskCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={clsx(
        "flex min-h-[120px] gap-3 rounded-[var(--radius-2xl)] border border-[var(--tg-border)] border-l-4 border-l-[var(--tg-border-strong)] bg-[var(--tg-card-bg)] p-4 shadow-[var(--shadow-sm)]",
        className,
      )}
      aria-hidden
    >
      <div className="mt-0.5 h-6 w-6 shrink-0 animate-pulse rounded-full bg-[var(--tg-border)]" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="h-4 w-4/5 animate-pulse rounded bg-[var(--tg-border)]" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-[var(--tg-border)]" />
          </div>
          <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-[var(--tg-border)]" />
        </div>
        <div className="mt-auto flex gap-2">
          <div className="h-5 w-16 animate-pulse rounded-full bg-[var(--tg-border)]" />
          <div className="h-5 w-12 animate-pulse rounded-full bg-[var(--tg-border)]" />
          <div className="ml-auto h-5 w-14 animate-pulse rounded-full bg-[var(--tg-border)]" />
        </div>
      </div>
    </div>
  );
}
