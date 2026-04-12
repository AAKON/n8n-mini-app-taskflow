export function TaskDetailSkeleton() {
  return (
    <div className="min-h-screen bg-[var(--tg-bg)] pb-32 text-[var(--tg-text)]">
      <header className="sticky top-0 z-20 border-b border-black/5 bg-[var(--tg-bg)]/95 px-4 pb-3 pt-2 backdrop-blur dark:border-white/10">
        <div className="h-7 w-4/5 max-w-md animate-pulse rounded bg-black/10 dark:bg-white/10" />
        <div className="mt-3 flex gap-2">
          <div className="h-6 w-24 animate-pulse rounded-full bg-black/10 dark:bg-white/10" />
          <div className="h-6 w-20 animate-pulse rounded-full bg-black/10 dark:bg-white/10" />
        </div>
      </header>
      <div className="space-y-6 px-4 py-4">
        <section className="flex flex-wrap gap-3 border-b border-black/5 pb-4 dark:border-white/10">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 animate-pulse rounded-full bg-black/10 dark:bg-white/10" />
            <div className="space-y-2">
              <div className="h-4 w-28 animate-pulse rounded bg-black/10 dark:bg-white/10" />
              <div className="h-3 w-20 animate-pulse rounded bg-black/10 dark:bg-white/10" />
            </div>
          </div>
          <div className="h-4 w-32 animate-pulse rounded bg-black/10 dark:bg-white/10" />
          <div className="h-3 w-full animate-pulse rounded bg-black/10 dark:bg-white/10" />
        </section>
        <section>
          <div className="mb-2 h-4 w-24 animate-pulse rounded bg-black/10 dark:bg-white/10" />
          <div className="space-y-2">
            <div className="h-3 w-full animate-pulse rounded bg-black/10 dark:bg-white/10" />
            <div className="h-3 w-[92%] animate-pulse rounded bg-black/10 dark:bg-white/10" />
            <div className="h-3 w-4/5 animate-pulse rounded bg-black/10 dark:bg-white/10" />
          </div>
        </section>
        <section>
          <div className="mb-3 h-4 w-20 animate-pulse rounded bg-black/10 dark:bg-white/10" />
          <div className="h-16 w-full animate-pulse rounded-lg bg-black/10 dark:bg-white/10" />
        </section>
      </div>
    </div>
  );
}
