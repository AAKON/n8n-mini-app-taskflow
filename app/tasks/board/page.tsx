"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { useAuth } from "@/hooks/useAuth";
import { SignInNotice } from "@/components/SignInNotice";
import { Spinner } from "@/components/ui/Spinner";
import { haptic, hideBackButton } from "@/lib/tma";
import type { TaskStatus } from "@/types";
import type { TaskListTask } from "@/components/TaskCard";

const COLUMNS: { status: TaskStatus; label: string; tone: string }[] = [
  { status: "todo", label: "Todo", tone: "border border-[var(--tg-border)] bg-[var(--tg-secondary-bg)] text-[var(--tg-hint)]" },
  { status: "in_progress", label: "In Progress", tone: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300" },
  { status: "review", label: "Review", tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  { status: "done", label: "Done", tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
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

  useEffect(() => {
    document.title = "Board · TaskFlow";
    hideBackButton();
  }, []);

  const loadAll = useCallback(async () => {
    if (!token || !user) return;
    setLoading(true);
    const all: TaskListTask[] = [];
    try {
      for (let page = 1; page <= 5; page++) {
        const params = new URLSearchParams({ page: String(page), limit: "50" });
        if (user.role === "member") params.set("assigneeId", user._id);
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
  }, [token, user]);

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
