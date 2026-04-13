"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ListTodo, Plus, SlidersHorizontal, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTasks, type TaskTab } from "@/hooks/useTasks";
import { TaskCard } from "@/components/TaskCard";
import { CreateTaskSheet } from "@/components/CreateTaskSheet";
import { EmptyState } from "@/components/ui/EmptyState";
import { SignInNotice } from "@/components/SignInNotice";
import { Spinner } from "@/components/ui/Spinner";
import { TaskCardSkeleton } from "@/components/ui/TaskCardSkeleton";
import { hasRole } from "@/lib/rbac";
import { getTelegramWebApp, hideBackButton, haptic } from "@/lib/tma";
import type { IDepartment, TaskStatus } from "@/types";
import type { DueFilter } from "@/lib/task-filters";
import clsx from "clsx";

const STATUS_OPTIONS: { value: TaskStatus | ""; label: string }[] = [
  { value: "", label: "All" },
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

export type TaskHomeProps = {
  initialTab?: TaskTab;
};

export function TaskHome({ initialTab = "my" }: TaskHomeProps) {
  const router = useRouter();
  const { user, token } = useAuth();
  const [tab, setTab] = useState<TaskTab>(initialTab);
  const [status, setStatus] = useState<TaskStatus | "">("");
  const [dueFilter, setDueFilter] = useState<DueFilter>(null);
  const [deptFilter, setDeptFilter] = useState("");
  const [departments, setDepartments] = useState<IDepartment[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const loadSentinelRef = useRef<HTMLDivElement>(null);
  const pullRef = useRef({ startY: 0, tracking: false });

  const showTeamTab = user ? hasRole(user.role, "manager") : false;
  const showAllTab = user?.role === "admin" || user?.role === "department_head";
  const showDeptFilter = user ? hasRole(user.role, "manager") : false;

  const activeFilterCount =
    (status ? 1 : 0) + (dueFilter ? 1 : 0) + (deptFilter ? 1 : 0);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (!token || !showDeptFilter) return;
    fetch("/api/departments", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((j: { data?: IDepartment[] }) => {
        if (j.data) setDepartments(j.data);
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
    tab,
    status: status || undefined,
    userId: user?._id ?? "",
    dueFilter: dueFilter ?? undefined,
    departmentPath: deptFilter || undefined,
  });

  useEffect(() => {
    document.title = initialTab === "team" ? "Team · TaskFlow" : "TaskFlow";
    hideBackButton();
    const wa = getTelegramWebApp();
    if (wa) wa.setHeaderColor("bg_color");
  }, [initialTab]);

  useEffect(() => {
    if (!user) return;
    if (!showTeamTab && tab !== "my") setTab("my");
    if (!showAllTab && tab === "all") setTab("my");
  }, [user, showTeamTab, showAllTab, tab]);

  useEffect(() => {
    if (!user) return;
    if (initialTab === "team" && !showTeamTab) router.replace("/");
  }, [user, initialTab, showTeamTab, router]);

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

  const clearFilters = () => {
    setStatus("");
    setDueFilter(null);
    setDeptFilter("");
  };

  if (!token || !user) return <SignInNotice />;
  if (initialTab === "team" && !showTeamTab) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--tg-bg)]">
        <Spinner />
      </div>
    );
  }

  const canCreate = hasRole(user.role, "manager");

  return (
    <div className="flex min-h-screen flex-col bg-[var(--tg-bg)] pt-2">
      {/* Tab bar */}
      {showTeamTab ? (
        <div className="flex gap-1 border-b border-black/5 px-3 pb-2 dark:border-white/10">
          <TabButton active={tab === "my"} disabled={isLoading && tasks.length === 0} onClick={() => setTab("my")} label="My Tasks" />
          <TabButton active={tab === "team"} disabled={isLoading && tasks.length === 0} onClick={() => setTab("team")} label="Team" />
          {showAllTab ? (
            <TabButton active={tab === "all"} disabled={isLoading && tasks.length === 0} onClick={() => setTab("all")} label="All" />
          ) : null}
        </div>
      ) : null}

      {/* Filter header */}
      <div className="flex items-center gap-2 px-3 pt-3 pb-1">
        <div className="no-scrollbar flex flex-1 gap-2 overflow-x-auto">
          {STATUS_OPTIONS.map((o) => (
            <button
              key={o.value || "all-status"}
              type="button"
              disabled={isLoading && tasks.length === 0}
              onClick={() => { haptic("light"); setStatus(o.value); }}
              className={clsx(
                "shrink-0 rounded-full px-3 py-2 text-sm font-medium transition",
                "min-h-[40px]",
                status === o.value
                  ? "bg-[var(--tg-button)] text-[var(--tg-button-text)]"
                  : "bg-[var(--tg-secondary-bg)] text-[var(--tg-text)]",
                isLoading && tasks.length === 0 && "opacity-50",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>

        {/* Filter toggle button */}
        <button
          type="button"
          onClick={() => { haptic("light"); setShowFilters((v) => !v); }}
          className={clsx(
            "relative shrink-0 flex h-10 w-10 items-center justify-center rounded-full transition",
            showFilters || activeFilterCount > 0
              ? "bg-[var(--tg-button)] text-[var(--tg-button-text)]"
              : "bg-[var(--tg-secondary-bg)] text-[var(--tg-text)]",
          )}
        >
          <SlidersHorizontal className="h-4 w-4" />
          {activeFilterCount > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
              {activeFilterCount}
            </span>
          ) : null}
        </button>
      </div>

      {/* Expanded filters panel */}
      {showFilters ? (
        <div className="mx-3 mb-2 rounded-2xl bg-[var(--tg-secondary-bg)] p-3 space-y-3">
          {/* Due date */}
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--tg-hint)]">Due date</p>
            <div className="no-scrollbar flex gap-2 overflow-x-auto">
              {DUE_OPTIONS.map((o) => (
                <button
                  key={o.value ?? "any-due"}
                  type="button"
                  onClick={() => { haptic("light"); setDueFilter(o.value); }}
                  className={clsx(
                    "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition",
                    dueFilter === o.value
                      ? "bg-[var(--tg-button)] text-[var(--tg-button-text)]"
                      : "bg-black/5 text-[var(--tg-text)] dark:bg-white/10",
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* Department */}
          {showDeptFilter && departments.length > 0 ? (
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--tg-hint)]">Department</p>
              <div className="no-scrollbar flex gap-2 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => { haptic("light"); setDeptFilter(""); }}
                  className={clsx(
                    "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition",
                    !deptFilter
                      ? "bg-[var(--tg-button)] text-[var(--tg-button-text)]"
                      : "bg-black/5 text-[var(--tg-text)] dark:bg-white/10",
                  )}
                >
                  All
                </button>
                {[...departments].sort((a, b) => a.path.localeCompare(b.path)).map((d) => (
                  <button
                    key={d._id}
                    type="button"
                    onClick={() => { haptic("light"); setDeptFilter(deptFilter === d.path ? "" : d.path); }}
                    className={clsx(
                      "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition",
                      deptFilter === d.path
                        ? "bg-[var(--tg-button)] text-[var(--tg-button-text)]"
                        : "bg-black/5 text-[var(--tg-text)] dark:bg-white/10",
                    )}
                  >
                    {d.name}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {/* Clear all */}
          {activeFilterCount > 0 ? (
            <button
              type="button"
              onClick={() => { haptic("light"); clearFilters(); }}
              className="flex items-center gap-1.5 text-xs text-red-500 font-medium"
            >
              <X className="h-3.5 w-3.5" />
              Clear all filters
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Task count */}
      {!isLoading && tasks.length > 0 ? (
        <p className="px-4 pb-1 text-xs text-[var(--tg-hint)]">
          {total} task{total !== 1 ? "s" : ""}
        </p>
      ) : null}

      {error ? (
        <p className="px-4 py-2 text-center text-sm text-red-500">{error}</p>
      ) : null}

      {/* Task list */}
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
            {tasks.map((t) => (
              <TaskCard key={t._id} task={t} onClick={() => goTask(t._id)} />
            ))}
            <div ref={loadSentinelRef} className="h-2 w-full shrink-0" />
            {isLoadingMore ? (
              <p className="pb-6 text-center text-xs text-[var(--tg-hint)]">Loading more…</p>
            ) : null}
            {page < totalPages && !isLoadingMore ? (
              <button
                type="button"
                disabled={isLoadingMore}
                className="mx-auto mb-8 min-h-[44px] rounded-full px-4 py-2 text-sm text-[var(--tg-link)] disabled:opacity-50"
                onClick={() => { haptic("light"); void loadMore(); }}
              >
                Load more
              </button>
            ) : null}
          </>
        )}
      </div>

      {/* FAB */}
      {canCreate ? (
        <button
          type="button"
          aria-label="Create task"
          className={clsx(
            "fixed right-4 z-[60] flex h-14 w-14 items-center justify-center rounded-full shadow-lg",
            "bg-[var(--tg-button)] text-[var(--tg-button-text)]",
            "min-h-[44px] min-w-[44px] transition active:scale-95",
            "bottom-[calc(4.5rem+env(safe-area-inset-bottom))]",
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

function TabButton(props: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      disabled={props.disabled}
      onClick={() => { haptic("light"); props.onClick(); }}
      className={clsx(
        "min-h-[44px] flex-1 rounded-xl px-2 py-2 text-sm font-medium transition",
        props.active
          ? "bg-[var(--tg-button)] text-[var(--tg-button-text)]"
          : "bg-[var(--tg-secondary-bg)] text-[var(--tg-text)]",
        props.disabled && "opacity-50",
      )}
    >
      {props.label}
    </button>
  );
}
