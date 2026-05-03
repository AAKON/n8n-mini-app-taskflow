"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

function useTypewriter(text: string, typeSpeed = 80, deleteSpeed = 40, pauseMs = 1500) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!text) { setDisplayed(""); setDone(false); return; }
    let cancelled = false;
    let timerId: ReturnType<typeof setTimeout>;

    const run = (i: number, deleting: boolean) => {
      if (cancelled) return;
      if (!deleting) {
        const next = i + 1;
        setDisplayed(text.slice(0, next));
        if (next >= text.length) {
          setDone(true);
          timerId = setTimeout(() => { setDone(false); run(next, true); }, pauseMs);
        } else {
          timerId = setTimeout(() => run(next, false), typeSpeed);
        }
      } else {
        const next = i - 1;
        setDisplayed(text.slice(0, next));
        if (next <= 0) {
          timerId = setTimeout(() => run(0, false), typeSpeed);
        } else {
          timerId = setTimeout(() => run(next, true), deleteSpeed);
        }
      }
    };

    setDisplayed("");
    setDone(false);
    timerId = setTimeout(() => run(0, false), typeSpeed);
    return () => { cancelled = true; clearTimeout(timerId); };
  }, [text, typeSpeed, deleteSpeed, pauseMs]);
  return { displayed, done };
}
import { useRouter } from "next/navigation";
import dayjs from "dayjs";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  ListTodo,
  Plus,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import type { TaskListTask } from "@/components/TaskCard";
import { Avatar } from "@/components/ui/Avatar";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { useAuth } from "@/hooks/useAuth";
import { useTasks } from "@/hooks/useTasks";
import { TaskCard } from "@/components/TaskCard";
import { CreateTaskSheet } from "@/components/CreateTaskSheet";
import { EmptyState } from "@/components/ui/EmptyState";
import { SignInNotice } from "@/components/SignInNotice";
import { TaskCardSkeleton } from "@/components/ui/TaskCardSkeleton";
import { hasRole } from "@/lib/rbac";
import { getTelegramWebApp, hideBackButton, haptic } from "@/lib/tma";
import type { IDepartment, IUser, TaskStatus } from "@/types";
import type { DueFilter } from "@/lib/task-filters";
import clsx from "clsx";

const STATUS_OPTIONS: { value: TaskStatus | ""; label: string }[] = [
  { value: "todo", label: "Todo" },
  { value: "in_progress", label: "In Progress" },
  { value: "review", label: "Review" },
  { value: "done", label: "Done" },
];

const DUE_OPTIONS: { value: DueFilter; label: string }[] = [
  { value: null, label: "Any date" },
  { value: "overdue", label: "Overdue" },
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
];

export function TaskHome() {
  const router = useRouter();
  const { user, token } = useAuth();
  const [status, setStatus] = useState<TaskStatus | "">("todo");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [dueFilter, setDueFilter] = useState<DueFilter>(null);
  const [deptFilter, setDeptFilter] = useState("");
  const [departments, setDepartments] = useState<IDepartment[]>([]);
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [teamMembers, setTeamMembers] = useState<Pick<IUser, "_id" | "name" | "username" | "avatarUrl">[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const loadSentinelRef = useRef<HTMLDivElement>(null);
  const pullRef = useRef({ startY: 0, tracking: false });

  const showDeptFilter = user ? hasRole(user.role, "manager") : false;

  const firstName = user?.name.trim().split(/\s+/).filter(Boolean)[0] ?? "there";
  const { displayed: typedName, done: typingDone } = useTypewriter(firstName);

  const activeFilterCount =
    (status && status !== "todo" ? 1 : 0) + (dueFilter ? 1 : 0) + (deptFilter ? 1 : 0) + (assigneeFilter ? 1 : 0);

  useEffect(() => {
    if (!token || !showDeptFilter) return;
    fetch("/api/departments", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((j: { data?: IDepartment[] }) => {
        if (j.data) setDepartments(j.data);
      })
      .catch(() => {});
    fetch("/api/users", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((j: { data?: Pick<IUser, "_id" | "name" | "username" | "avatarUrl">[] }) => {
        if (j.data) setTeamMembers(j.data);
      })
      .catch(() => {});
  }, [token, showDeptFilter]);

  const {
    tasks,
    isLoading,
    isLoadingMore,
    error,
    refetch,
    prependTask,
    loadMore,
    totalPages,
    page,
    total,
  } = useTasks({
    status: status || undefined,
    dueFilter: dueFilter ?? undefined,
    departmentPath: deptFilter || undefined,
    assigneeId: assigneeFilter || undefined,
    q: search || undefined,
  });

  useEffect(() => {
    const h = setTimeout(() => setSearch(searchInput), 250);
    return () => clearTimeout(h);
  }, [searchInput]);

  useEffect(() => {
    document.title = "TaskFlow";
    hideBackButton();
    const wa = getTelegramWebApp();
    if (wa) wa.setHeaderColor("bg_color");
  }, []);

  useEffect(() => {
    const el = loadSentinelRef.current;
    const root = scrollRef.current;
    if (!el || !root) return;
    const obs = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting) void loadMore(); },
      { root, rootMargin: "120px", threshold: 0 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadMore, tasks.length]);

  const onTouchStart = (e: React.TouchEvent) => {
    const sc = scrollRef.current;
    if (!sc || sc.scrollTop > 0) return;
    pullRef.current = { startY: e.touches[0]?.clientY ?? 0, tracking: true };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const sc = scrollRef.current;
    if (!sc || sc.scrollTop > 0 || !pullRef.current.tracking) return;
    if ((e.touches[0]?.clientY ?? 0) - pullRef.current.startY > 72) {
      pullRef.current.tracking = false;
      void refetch();
    }
  };
  const onTouchEnd = () => { pullRef.current.tracking = false; };

  const goTask = useCallback((id: string) => { router.push(`/tasks/${id}`); }, [router]);

  const handleComplete = useCallback(async (taskId: string) => {
    if (!token) return;
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "done" }),
      });
      await refetch();
    } catch {
      // silent — refetch will re-sync next time
    }
  }, [token, refetch]);

  const grouped = useMemo(() => {
    if (dueFilter) return null;
    const today = dayjs().startOf("day");
    const weekEnd = today.add(7, "day");
    const sections: Record<"overdue" | "today" | "week" | "later" | "nodue" | "done", TaskListTask[]> = {
      overdue: [], today: [], week: [], later: [], nodue: [], done: [],
    };
    for (const t of tasks) {
      if (t.status === "done") { sections.done.push(t); continue; }
      if (!t.dueDate) { sections.nodue.push(t); continue; }
      const d = dayjs(t.dueDate).startOf("day");
      if (d.isBefore(today)) sections.overdue.push(t);
      else if (d.isSame(today)) sections.today.push(t);
      else if (d.isBefore(weekEnd)) sections.week.push(t);
      else sections.later.push(t);
    }
    return sections;
  }, [tasks, dueFilter]);

  const clearFilters = () => {
    setStatus("todo");
    setDueFilter(null);
    setDeptFilter("");
    setAssigneeFilter("");
  };

  if (!token || !user) return <SignInNotice />;

  const canCreate = hasRole(user.role, "manager");
  const today = dayjs().startOf("day");
  const doneCount = tasks.filter((t) => t.status === "done").length;
  const openCount = Math.max(tasks.length - doneCount, 0);
  const overdueCount = tasks.filter((t) => {
    if (t.status === "done" || !t.dueDate) return false;
    return dayjs(t.dueDate).startOf("day").isBefore(today);
  }).length;

  return (
    <div className="tf-page flex min-h-screen flex-col pt-3">
      <div className="space-y-3 px-3">
        <section className="tf-hero tf-animate-fade-up p-4">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold leading-tight">
              Hi, <span className="tf-brand-text">{typedName}{!typingDone && <span className="animate-pulse font-thin">|</span>}</span>
            </h1>
            <p className="mt-1 text-xs text-[var(--tg-hint)]">
              {total} task{total !== 1 ? "s" : ""} in this view
            </p>
          </div>

          <div className="tf-stagger mt-4 grid grid-cols-3 gap-2">
            <MetricTile
              icon={<Clock3 className="h-3.5 w-3.5" />}
              label="Open"
              value={openCount}
            />
            <MetricTile
              icon={<CheckCircle2 className="h-3.5 w-3.5" />}
              label="Done"
              value={doneCount}
              tone="success"
            />
            <MetricTile
              icon={<AlertTriangle className="h-3.5 w-3.5" />}
              label="Overdue"
              value={overdueCount}
              tone="danger"
            />
          </div>
        </section>

        <section className="tf-card tf-animate-fade-up p-3.5" style={{ animationDelay: "80ms" }}>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--tg-hint)]" />
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search tasks…"
                className="tf-input min-h-[42px] rounded-xl py-2 pl-9 pr-9 text-sm"
              />
              {searchInput ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput("");
                    setSearch("");
                  }}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-[var(--tg-hint)] transition-colors hover:bg-[var(--tg-surface-hover)]"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => {
                haptic("light");
                setShowFilters((v) => !v);
              }}
              className={clsx(
                "relative shrink-0 flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--tg-border)] transition",
                showFilters || activeFilterCount > 0
                  ? "bg-[var(--tg-button)] text-[var(--tg-button-text)] shadow-[var(--shadow-sm)]"
                  : "bg-[var(--tg-card-bg)] text-[var(--tg-text)]",
              )}
            >
              <SlidersHorizontal className="h-4 w-4" />
              {activeFilterCount > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--brand-2)] text-[10px] font-bold text-white">
                  {activeFilterCount}
                </span>
              ) : null}
            </button>
          </div>

          <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto pb-0.5">
            {STATUS_OPTIONS.map((o) => (
              <button
                key={o.value || "all-status"}
                type="button"
                disabled={isLoading && tasks.length === 0}
                onClick={() => {
                  haptic("light");
                  setStatus(o.value);
                }}
                className={clsx(
                  "tf-chip shrink-0 rounded-full px-3 py-2 text-sm font-medium",
                  status === o.value && "tf-chip-active",
                  isLoading && tasks.length === 0 && "opacity-50",
                )}
              >
                {o.label}
              </button>
            ))}
          </div>

          <div
            className={clsx(
              "tf-collapse",
              showFilters && "tf-collapse-open",
            )}
            aria-hidden={!showFilters}
          >
            <div className="tf-collapse-inner">
              <div className="mt-3 space-y-3 rounded-xl border border-[var(--tg-border)] bg-[var(--tg-secondary-bg)]/60 p-3">
                <div>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--tg-hint)]">
                    Due date
                  </p>
                  <div className="no-scrollbar flex gap-2 overflow-x-auto">
                    {DUE_OPTIONS.map((o) => (
                      <button
                        key={o.value ?? "any-due"}
                        type="button"
                        tabIndex={showFilters ? 0 : -1}
                        onClick={() => {
                          haptic("light");
                          setDueFilter(o.value);
                        }}
                        className={clsx(
                          "tf-chip shrink-0 rounded-full px-3 py-1.5 text-xs font-medium",
                          dueFilter === o.value && "tf-chip-active",
                        )}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>

                {showDeptFilter && departments.length > 0 ? (
                  <div>
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--tg-hint)]">
                      Department
                    </p>
                    <SearchableSelect
                      placeholder="All departments"
                      value={deptFilter}
                      onChange={setDeptFilter}
                      tabIndex={showFilters ? 0 : -1}
                      options={[...departments]
                        .sort((a, b) => a.path.localeCompare(b.path))
                        .map((d) => ({ value: d.path, label: d.name }))}
                    />
                  </div>
                ) : null}

                {showDeptFilter && teamMembers.length > 0 ? (
                  <div>
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--tg-hint)]">
                      Employee
                    </p>
                    <SearchableSelect
                      placeholder="All employees"
                      value={assigneeFilter}
                      onChange={setAssigneeFilter}
                      tabIndex={showFilters ? 0 : -1}
                      options={[...teamMembers]
                        .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""))
                        .map((m) => ({
                          value: m._id,
                          label: m.name ?? m.username ?? "?",
                          prefix: (
                            <Avatar
                              user={{ _id: m._id, name: m.name ?? "?", username: m.username, avatarUrl: m.avatarUrl }}
                              size="xs"
                            />
                          ),
                        }))}
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="mt-1 flex items-center justify-between px-4 pb-1 text-xs text-[var(--tg-hint)]">
        <span>
          {total} task{total !== 1 ? "s" : ""}
        </span>
        {activeFilterCount > 0 ? (
          <button
            type="button"
            onClick={() => {
              haptic("light");
              clearFilters();
            }}
            className="inline-flex items-center gap-1 text-[var(--tg-link)]"
          >
            <X className="h-3.5 w-3.5" />
            Clear filters
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="px-4 py-2 text-center text-sm text-[var(--tone-danger)]">{error}</p>
      ) : null}

      <div
        ref={scrollRef}
        className="flex flex-1 flex-col gap-3 overflow-y-auto px-3 pb-36"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {isLoading && tasks.length === 0 ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <TaskCardSkeleton key={i} />
            ))}
          </div>
        ) : tasks.length === 0 ? (
          <EmptyState
            icon={<ListTodo className="mx-auto" strokeWidth={1.25} />}
            title="No tasks"
            description={
              activeFilterCount > 0
                ? "No tasks match your filters. Try clearing some."
                : "There's nothing here yet."
            }
          />
        ) : (
          <>
            {grouped ? (
              <>
                {(
                  [
                    ["overdue", "Overdue"],
                    ["today", "Today"],
                    ["week", "This week"],
                    ["later", "Later"],
                    ["nodue", "No due date"],
                    ["done", "Completed"],
                  ] as const
                ).map(([key, label]) =>
                  grouped[key].length > 0 ? (
                    <div key={key} className="flex flex-col gap-3">
                      <div className="flex items-center gap-2 px-1 pt-2">
                        <h2
                          className={clsx(
                            "text-[11px] font-semibold uppercase tracking-wider",
                            key === "overdue"
                              ? "text-[var(--tone-danger)]"
                              : "text-[var(--tg-hint)]",
                          )}
                        >
                          {label}
                        </h2>
                        <span className="rounded-full border border-[var(--tg-border)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--tg-hint)]">
                          {grouped[key].length}
                        </span>
                      </div>
                      <div className="tf-stagger flex flex-col gap-3">
                        {grouped[key].map((t) => (
                          <TaskCard
                            key={t._id}
                            task={t}
                            onClick={() => goTask(t._id)}
                            onComplete={handleComplete}
                          />
                        ))}
                      </div>
                    </div>
                  ) : null,
                )}
              </>
            ) : (
              <div className="tf-stagger flex flex-col gap-3">
                {tasks.map((t) => (
                  <TaskCard
                    key={t._id}
                    task={t}
                    onClick={() => goTask(t._id)}
                    onComplete={handleComplete}
                  />
                ))}
              </div>
            )}
            <div ref={loadSentinelRef} className="h-2 w-full shrink-0" />
            {isLoadingMore ? (
              <p className="pb-6 text-center text-xs text-[var(--tg-hint)]">Loading more…</p>
            ) : null}
            {page < totalPages && !isLoadingMore ? (
              <button
                type="button"
                disabled={isLoadingMore}
                className="tf-btn-secondary mx-auto mb-8 min-h-[44px] rounded-full px-4 py-2 text-sm text-[var(--tg-link)] disabled:opacity-50"
                onClick={() => { haptic("light"); void loadMore(); }}
              >
                Load more
              </button>
            ) : null}
          </>
        )}
      </div>

      {canCreate ? (
        <button
          type="button"
          aria-label="Create task"
          className={clsx(
            "tf-btn-primary tf-animate-scale-in fixed right-4 z-[60] flex h-14 w-14 items-center justify-center rounded-full shadow-[var(--shadow-lg)]",
            "min-h-[44px] min-w-[44px] transition active:scale-95",
            "bottom-[calc(4.7rem+env(safe-area-inset-bottom))]",
          )}
          onClick={() => { haptic("light"); setCreateOpen(true); }}
        >
          <Plus className="h-7 w-7" strokeWidth={2} />
        </button>
      ) : null}

      <CreateTaskSheet
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(t) => { prependTask(t); void refetch(); }}
      />
    </div>
  );
}


function MetricTile(props: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone?: "default" | "success" | "danger";
}) {
  return (
    <div
      className={clsx(
        "rounded-xl border bg-[var(--tg-card-bg)] p-2.5 shadow-[var(--shadow-sm)]",
        props.tone === "success"
          ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : props.tone === "danger"
            ? "border-rose-400/30 bg-rose-500/10 text-rose-700 dark:text-rose-300"
            : "border-[var(--tg-border)] text-[var(--tg-text)]",
      )}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="text-[11px] font-semibold uppercase tracking-wide">
          {props.label}
        </span>
        <span className="opacity-80">{props.icon}</span>
      </div>
      <p className="mt-1 text-lg font-bold tabular-nums">{props.value}</p>
    </div>
  );
}
