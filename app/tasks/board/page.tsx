"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { SignInNotice } from "@/components/SignInNotice";
import { Spinner } from "@/components/ui/Spinner";
import { haptic, hideBackButton } from "@/lib/tma";
import { hasRole } from "@/lib/rbac";
import type { IDepartment, TaskStatus } from "@/types";
import type { DueFilter } from "@/lib/task-filters";
import type { TaskListTask } from "@/components/TaskCard";

const COLUMNS: { status: TaskStatus; label: string; tone: string }[] = [
  { status: "todo", label: "Todo", tone: "border border-[var(--tg-border)] bg-[var(--tg-secondary-bg)] text-[var(--tg-hint)]" },
  { status: "in_progress", label: "In Progress", tone: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300" },
  { status: "review", label: "Review", tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  { status: "done", label: "Done", tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
];

const DUE_OPTIONS: { value: DueFilter; label: string }[] = [
  { value: null, label: "Any date" },
  { value: "overdue", label: "Overdue" },
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
];

type PaginatedPayload = {
  success: boolean;
  data: TaskListTask[];
  pagination: { totalPages: number; page: number };
};

export default function BoardPage() {
  const router = useRouter();
  const { user, token } = useAuth();
  const [tasks, setTasks] = useState<TaskListTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<TaskStatus | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [dueFilter, setDueFilter] = useState<DueFilter>(null);
  const [deptFilter, setDeptFilter] = useState("");
  const [departments, setDepartments] = useState<IDepartment[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const showDeptFilter = user ? hasRole(user.role, "manager") : false;
  const activeFilterCount =
    (dueFilter ? 1 : 0) + (deptFilter ? 1 : 0);

  useEffect(() => {
    document.title = "Board · TaskFlow";
    hideBackButton();
  }, []);

  useEffect(() => {
    const h = setTimeout(() => setSearch(searchInput), 250);
    return () => clearTimeout(h);
  }, [searchInput]);

  useEffect(() => {
    if (!token || !showDeptFilter) return;
    fetch("/api/departments", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((j: { data?: IDepartment[] }) => {
        if (j.data) setDepartments(j.data);
      })
      .catch(() => {});
  }, [token, showDeptFilter]);

  const loadAll = useCallback(async () => {
    if (!token || !user) return;
    setLoading(true);
    const all: TaskListTask[] = [];
    try {
      for (let page = 1; page <= 5; page++) {
        const params = new URLSearchParams({ page: String(page), limit: "50" });
        if (user.role === "member") params.set("assigneeId", user._id);
        if (search) params.set("q", search);
        if (dueFilter) params.set("dueFilter", dueFilter);
        if (deptFilter) params.set("departmentPath", deptFilter);
        const res = await fetch(`/api/tasks?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = (await res.json()) as PaginatedPayload;
        if (!json.data) break;
        all.push(...json.data);
        if (json.pagination.page >= json.pagination.totalPages) break;
      }
      setTasks(all);
    } finally {
      setLoading(false);
    }
  }, [token, user, search, dueFilter, deptFilter]);

  useEffect(() => { void loadAll(); }, [loadAll]);

  const patchStatus = async (taskId: string, status: TaskStatus) => {
    if (!token) return;
    setTasks((prev) => prev.map((t) => (t._id === taskId ? { ...t, status } : t)));
    haptic("light");
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
    } catch {
      void loadAll();
    }
  };

  const sortedDepts = useMemo(
    () => [...departments].sort((a, b) => a.path.localeCompare(b.path)),
    [departments],
  );

  const clearFilters = () => {
    setDueFilter(null);
    setDeptFilter("");
  };

  if (!token || !user) return <SignInNotice />;

  return (
    <div className="tf-page flex min-h-screen flex-col pt-4">
      <div className="mb-3 flex items-center justify-between px-4">
        <h1 className="text-lg font-bold text-[var(--tg-text)]">Board</h1>
        <button
          type="button"
          onClick={() => { haptic("light"); router.push("/"); }}
          className="tf-btn-secondary rounded-full px-3 py-1.5 text-xs text-[var(--tg-text)]"
        >
          List view
        </button>
      </div>

      <section className="tf-card tf-animate-fade-up mx-3 mb-3 p-3.5">
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

              {showDeptFilter && sortedDepts.length > 0 ? (
                <div>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--tg-hint)]">
                    Department
                  </p>
                  <div className="no-scrollbar flex gap-2 overflow-x-auto">
                    <button
                      type="button"
                      tabIndex={showFilters ? 0 : -1}
                      onClick={() => {
                        haptic("light");
                        setDeptFilter("");
                      }}
                      className={clsx(
                        "tf-chip shrink-0 rounded-full px-3 py-1.5 text-xs font-medium",
                        !deptFilter && "tf-chip-active",
                      )}
                    >
                      All
                    </button>
                    {sortedDepts.map((d) => (
                      <button
                        key={d._id}
                        type="button"
                        tabIndex={showFilters ? 0 : -1}
                        onClick={() => {
                          haptic("light");
                          setDeptFilter(deptFilter === d.path ? "" : d.path);
                        }}
                        className={clsx(
                          "tf-chip shrink-0 rounded-full px-3 py-1.5 text-xs font-medium",
                          deptFilter === d.path && "tf-chip-active",
                        )}
                      >
                        {d.name}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {activeFilterCount > 0 ? (
                <button
                  type="button"
                  onClick={() => { haptic("light"); clearFilters(); }}
                  className="inline-flex items-center gap-1 text-xs text-[var(--tg-link)]"
                >
                  <X className="h-3.5 w-3.5" />
                  Clear filters
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="flex flex-1 items-center justify-center"><Spinner /></div>
      ) : (
        <div className="no-scrollbar flex flex-1 snap-x snap-mandatory gap-3 overflow-x-auto px-3 pb-24">
          {COLUMNS.map((col) => {
            const items = tasks.filter((t) => t.status === col.status);
            return (
              <div
                key={col.status}
                onDragOver={(e) => { e.preventDefault(); setDragOver(col.status); }}
                onDragLeave={() => setDragOver((s) => (s === col.status ? null : s))}
                onDrop={() => {
                  if (dragId) void patchStatus(dragId, col.status);
                  setDragId(null);
                  setDragOver(null);
                }}
                className={clsx(
                  "tf-card-muted flex w-[84vw] max-w-[22rem] min-w-[17.5rem] shrink-0 snap-center flex-col p-2.5",
                  dragOver === col.status && "ring-2 ring-[var(--tg-button)]",
                )}
              >
                <div className="mb-2 flex items-center justify-between px-2 pt-1">
                  <span className={clsx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", col.tone)}>
                    {col.label}
                  </span>
                  <span className="text-[11px] text-[var(--tg-hint)]">{items.length}</span>
                </div>
                <div className="flex flex-col gap-2 overflow-y-auto">
                  {items.map((t) => (
                    <div
                      key={t._id}
                      draggable
                        onDragStart={() => setDragId(t._id)}
                        onDragEnd={() => setDragId(null)}
                        onClick={() => router.push(`/tasks/${t._id}`)}
                        className="cursor-grab rounded-xl border border-[var(--tg-border)] bg-[var(--tg-card-bg)] p-3.5 text-left text-[var(--tg-text)] shadow-[var(--shadow-sm)] transition hover:-translate-y-px hover:shadow-[var(--shadow-md)] active:cursor-grabbing"
                      >
                      <p className="line-clamp-2 text-sm font-medium">{t.title}</p>
                      {t.departmentPath ? (
                        <p className="mt-1 truncate text-[10px] text-[var(--tg-hint)]">{t.departmentPath}</p>
                      ) : null}
                    </div>
                  ))}
                  {items.length === 0 ? (
                    <p className="px-2 py-4 text-center text-[11px] text-[var(--tg-hint)]">Empty</p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
