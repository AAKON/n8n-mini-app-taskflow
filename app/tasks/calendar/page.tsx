"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import dayjs from "dayjs";
import { MonthYearNav } from "@/components/ui/MonthYearNav";
import { useAuth } from "@/hooks/useAuth";
import { SignInNotice } from "@/components/SignInNotice";
import { Spinner } from "@/components/ui/Spinner";
import { haptic, hideBackButton } from "@/lib/tma";
import type { TaskListTask } from "@/components/TaskCard";

const PRIORITY_DOT: Record<string, string> = {
  urgent: "bg-[var(--tone-danger)]",
  high: "bg-[var(--tone-warning)]",
  medium: "bg-[var(--tone-info)]",
  low: "bg-[var(--tone-neutral)]",
};

export default function CalendarPage() {
  const router = useRouter();
  const { user, token } = useAuth();
  const [month, setMonth] = useState(() => dayjs().startOf("month"));
  const [tasks, setTasks] = useState<TaskListTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Calendar · TaskFlow";
    hideBackButton();
  }, []);

  useEffect(() => {
    if (!token || !user) return;
    setLoading(true);
    const params = new URLSearchParams({ page: "1", limit: "200" });
    if (user.role === "member") params.set("assigneeId", user._id);
    fetch(`/api/tasks?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((j: { data?: TaskListTask[] }) => setTasks(j.data ?? []))
      .finally(() => setLoading(false));
  }, [token, user]);

  const byDay = useMemo(() => {
    const map = new Map<string, TaskListTask[]>();
    for (const t of tasks) {
      if (!t.dueDate) continue;
      const key = dayjs(t.dueDate).format("YYYY-MM-DD");
      const arr = map.get(key) ?? [];
      arr.push(t);
      map.set(key, arr);
    }
    return map;
  }, [tasks]);

  const grid = useMemo(() => {
    const start = month.startOf("month");
    const firstCol = start.day();
    const days = start.daysInMonth();
    const cells: (dayjs.Dayjs | null)[] = [];
    for (let i = 0; i < firstCol; i++) cells.push(null);
    for (let d = 1; d <= days; d++) cells.push(start.date(d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [month]);

  if (!token || !user) return <SignInNotice />;

  const selectedTasks = selected ? byDay.get(selected) ?? [] : [];
  const today = dayjs().format("YYYY-MM-DD");

  return (
    <div className="tf-page min-h-screen pb-24 pt-4 text-[var(--tg-text)]">
      <div className="mb-3 px-2">
        <MonthYearNav value={month} onChange={(m) => { haptic("light"); setMonth(m); }} />
      </div>

      <div className="grid grid-cols-7 gap-1 px-2 pb-1 text-center text-[10px] font-semibold uppercase tracking-wider text-[var(--tg-hint)]">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div key={i}>{d}</div>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8"><Spinner /></div>
      ) : (
        <div className="grid grid-cols-7 gap-1 px-2">
          {grid.map((cell, i) => {
            if (!cell) return <div key={i} className="aspect-square" />;
            const key = cell.format("YYYY-MM-DD");
            const items = byDay.get(key) ?? [];
            const isToday = key === today;
            const isSelected = selected === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => { haptic("light"); setSelected(isSelected ? null : key); }}
                className={clsx(
                  "aspect-square rounded-xl border p-1 text-left transition",
                  isSelected
                    ? "border-transparent bg-[var(--tg-button)] text-[var(--tg-button-text)] shadow-[var(--shadow-sm)]"
                    : isToday
                      ? "border-[var(--tg-button)] border-2 bg-[var(--tg-card-bg)] shadow-[var(--shadow-sm)]"
                      : "border-[var(--tg-border)] bg-[var(--tg-card-bg)] shadow-[var(--shadow-sm)]",
                )}
              >
                <div className="text-[11px] font-semibold">{cell.date()}</div>
                <div className="mt-1 flex flex-wrap gap-0.5">
                  {items.slice(0, 3).map((t) => (
                    <span
                      key={t._id}
                      className={clsx("h-1.5 w-1.5 rounded-full", PRIORITY_DOT[t.priority] ?? PRIORITY_DOT.medium)}
                    />
                  ))}
                  {items.length > 3 ? (
                    <span className="text-[9px] opacity-70">+{items.length - 3}</span>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {selected ? (
        <div className="tf-card mx-3 mt-4 p-3">
          <p className="mb-2 text-xs font-semibold text-[var(--tg-hint)]">
            {dayjs(selected).format("ddd, MMM D")} · {selectedTasks.length} task{selectedTasks.length !== 1 ? "s" : ""}
          </p>
          {selectedTasks.length === 0 ? (
            <p className="text-xs text-[var(--tg-hint)]">No tasks due.</p>
          ) : (
            <ul className="space-y-1.5">
              {selectedTasks.map((t) => (
                <li key={t._id}>
                  <button
                    type="button"
                    onClick={() => router.push(`/tasks/${t._id}`)}
                    className="tf-card-muted flex w-full items-center gap-2 rounded-xl p-2 text-left"
                  >
                    <span className={clsx("h-2 w-2 shrink-0 rounded-full", PRIORITY_DOT[t.priority] ?? PRIORITY_DOT.medium)} />
                    <span className="truncate text-sm">{t.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
