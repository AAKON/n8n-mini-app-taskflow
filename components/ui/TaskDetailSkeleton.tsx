export function TaskDetailSkeleton() {
  return (
    <div className="tf-page min-h-screen pb-32 text-[var(--tg-text)]">
      <header className="tf-topbar px-4 pb-3 pt-2">
        <div className="h-7 w-4/5 max-w-md animate-pulse rounded bg-[var(--tg-border)]" />
        <div className="mt-3 flex gap-2">
          <div className="h-6 w-24 animate-pulse rounded-full bg-[var(--tg-border)]" />
          <div className="h-6 w-20 animate-pulse rounded-full bg-[var(--tg-border)]" />
        </div>
      </header>
      <div className="space-y-6 px-4 py-4">
        <section className="flex flex-wrap gap-3 border-b border-[var(--tg-divider)] pb-4">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 animate-pulse rounded-full bg-[var(--tg-border)]" />
            <div className="space-y-2">
              <div className="h-4 w-28 animate-pulse rounded bg-[var(--tg-border)]" />
              <div className="h-3 w-20 animate-pulse rounded bg-[var(--tg-border)]" />
            </div>
          </div>
          <div className="h-4 w-32 animate-pulse rounded bg-[var(--tg-border)]" />
          <div className="h-3 w-full animate-pulse rounded bg-[var(--tg-border)]" />
        </section>
        <section>
          <div className="mb-2 h-4 w-24 animate-pulse rounded bg-[var(--tg-border)]" />
          <div className="space-y-2">
            <div className="h-3 w-full animate-pulse rounded bg-[var(--tg-border)]" />
            <div className="h-3 w-[92%] animate-pulse rounded bg-[var(--tg-border)]" />
            <div className="h-3 w-4/5 animate-pulse rounded bg-[var(--tg-border)]" />
          </div>
        </section>
        <section>
          <div className="mb-3 h-4 w-20 animate-pulse rounded bg-[var(--tg-border)]" />
          <div className="h-16 w-full animate-pulse rounded-lg bg-[var(--tg-border)]" />
        </section>
      </div>
    </div>
  );
}
