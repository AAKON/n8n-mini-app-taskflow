import clsx from "clsx";

export function TaskCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={clsx(
        "flex min-h-[44px] flex-col gap-2 rounded-xl border border-black/5 bg-[var(--tg-secondary-bg)] p-3 dark:border-white/10",
        className,
      )}
      aria-hidden
    >
      <div className="flex items-start justify-between gap-2">
        <div className="h-4 flex-1 animate-pulse rounded bg-black/10 dark:bg-white/10" />
        <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-black/10 dark:bg-white/10" />
      </div>
      <div className="flex gap-2">
        <div className="h-5 w-16 animate-pulse rounded-full bg-black/10 dark:bg-white/10" />
        <div className="h-5 w-20 animate-pulse rounded-full bg-black/10 dark:bg-white/10" />
      </div>
      <div className="h-3 w-2/3 animate-pulse rounded bg-black/10 dark:bg-white/10" />
    </div>
  );
}
