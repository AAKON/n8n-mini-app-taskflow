"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useAppStore } from "@/lib/store";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { SignInNotice } from "@/components/SignInNotice";
import { Spinner } from "@/components/ui/Spinner";
import { UserEditSheet, roleLabel } from "@/components/UserEditSheet";
import { getTelegramWebApp, hideBackButton } from "@/lib/tma";
import type { IUser, TaskStatus } from "@/types";
import clsx from "clsx";

type Summary = {
  total: number;
  byStatus: Record<string, number>;
  overdue: number;
  activeMembers: number;
};

const STATUS_ORDER: TaskStatus[] = [
  "todo",
  "in_progress",
  "review",
  "done",
];

const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "Todo",
  in_progress: "In progress",
  review: "Review",
  done: "Done",
};

export default function AdminPage() {
  const router = useRouter();
  const token = useAppStore((s) => s.token);
  const { user } = useAuth();

  const [tab, setTab] = useState<"users" | "stats">("users");
  const [users, setUsers] = useState<IUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [usersErr, setUsersErr] = useState<string | null>(null);

  const [summary, setSummary] = useState<Summary | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [statsErr, setStatsErr] = useState<string | null>(null);

  const [editUser, setEditUser] = useState<IUser | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const loadUsers = useCallback(async () => {
    if (!token) return;
    setLoadingUsers(true);
    setUsersErr(null);
    try {
      const res = await fetch("/api/users", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = (await res.json()) as {
        success?: boolean;
        data?: IUser[];
        error?: string;
      };
      if (!res.ok || json.success === false) {
        throw new Error(json.error || "Could not load users");
      }
      setUsers(json.data ?? []);
    } catch (e) {
      setUsersErr(e instanceof Error ? e.message : "Error");
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  }, [token]);

  const loadStats = useCallback(async () => {
    if (!token) return;
    setLoadingStats(true);
    setStatsErr(null);
    try {
      const res = await fetch("/api/tasks?summary=1", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = (await res.json()) as {
        success?: boolean;
        data?: Summary;
        error?: string;
      };
      if (!res.ok || json.success === false || !json.data) {
        throw new Error(json.error || "Could not load stats");
      }
      setSummary(json.data);
    } catch (e) {
      setStatsErr(e instanceof Error ? e.message : "Error");
      setSummary(null);
    } finally {
      setLoadingStats(false);
    }
  }, [token]);

  useEffect(() => {
    if (user?.role !== "admin") return;
    void loadUsers();
  }, [user, loadUsers]);

  useEffect(() => {
    if (user?.role !== "admin" || tab !== "stats") return;
    void loadStats();
  }, [user, tab, loadStats]);

  useEffect(() => {
    document.title = "Admin · TaskFlow";
    hideBackButton();
    const wa = getTelegramWebApp();
    if (wa) wa.setHeaderColor("bg_color");
  }, []);

  useEffect(() => {
    if (!user) return;
    if (user.role !== "admin") {
      router.replace("/");
    }
  }, [user, router]);

  const onUserSaved = (u: IUser) => {
    setUsers((list) => list.map((x) => (x._id === u._id ? u : x)));
  };

  if (!token || !user) {
    return <SignInNotice />;
  }

  if (user.role !== "admin") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--tg-bg)]">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="tf-page min-h-screen text-[var(--tg-text)]">
      <header className="tf-topbar px-4 py-3">
        <h1 className="text-lg font-bold">Admin</h1>
        <div className="mt-3 flex gap-1 rounded-lg border border-[var(--tg-border)] bg-[var(--tg-secondary-bg)] p-1">
          <button
            type="button"
            onClick={() => setTab("users")}
            className={clsx(
              "min-h-[40px] flex-1 rounded-md border text-sm font-medium transition",
              tab === "users"
                ? "border-transparent bg-[var(--tg-button)] text-[var(--tg-button-text)] shadow-[var(--shadow-sm)]"
                : "border-transparent text-[var(--tg-text)]",
            )}
          >
            Users
          </button>
          <button
            type="button"
            onClick={() => setTab("stats")}
            className={clsx(
              "min-h-[40px] flex-1 rounded-md border text-sm font-medium transition",
              tab === "stats"
                ? "border-transparent bg-[var(--tg-button)] text-[var(--tg-button-text)] shadow-[var(--shadow-sm)]"
                : "border-transparent text-[var(--tg-text)]",
            )}
          >
            Stats
          </button>
        </div>
      </header>

      {tab === "users" ? (
        <div className="px-3 pt-3">
          {usersErr ? (
            <p className="text-center text-sm text-red-500">{usersErr}</p>
          ) : null}
          {loadingUsers ? (
            <Spinner className="min-h-[40vh]" />
          ) : (
            <ul className="space-y-2">
              {users.map((u) => (
                <li key={u._id}>
                  <button
                    type="button"
                    onClick={() => {
                      setEditUser(u);
                      setSheetOpen(true);
                    }}
                    className="tf-card flex w-full min-h-[56px] items-center gap-3 px-3 py-2 text-left"
                  >
                    <Avatar user={u} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{u.name}</p>
                      {u.username ? (
                        <p className="truncate text-xs text-[var(--tg-hint)]">
                          @{u.username}
                        </p>
                      ) : null}
                      <p className="mt-0.5 truncate text-xs text-[var(--tg-hint)]">
                        {u.departmentPath || "—"}
                      </p>
                    </div>
                    <Badge label={roleLabel(u.role)} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="space-y-4 px-3 py-4">
          {statsErr ? (
            <p className="text-center text-sm text-red-500">{statsErr}</p>
          ) : null}
          {loadingStats ? (
            <Spinner className="min-h-[40vh]" />
          ) : summary ? (
            <>
              <section className="tf-card rounded-xl p-4">
                <p className="text-xs font-medium text-[var(--tg-hint)]">
                  Total tasks
                </p>
                <p className="mt-1 text-3xl font-bold tabular-nums">
                  {summary.total}
                </p>
              </section>

              <section className="tf-card rounded-xl p-4">
                <p className="mb-3 text-sm font-semibold">By status</p>
                <ul className="space-y-3">
                  {STATUS_ORDER.map((s) => {
                    const n = summary.byStatus[s] ?? 0;
                    const pct =
                      summary.total > 0
                        ? Math.round((n / summary.total) * 100)
                        : 0;
                    return (
                      <li key={s}>
                        <div className="mb-1 flex justify-between text-xs">
                          <span>{STATUS_LABEL[s]}</span>
                          <span className="tabular-nums text-[var(--tg-hint)]">
                            {n} ({pct}%)
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-[var(--tg-border)]">
                          <div
                            className="h-full rounded-full bg-[var(--tg-button)] transition-[width]"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>

              <div className="grid grid-cols-2 gap-3">
                <section className="tf-card rounded-xl p-4">
                  <p className="text-xs font-medium text-[var(--tg-hint)]">
                    Overdue
                  </p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
                    {summary.overdue}
                  </p>
                </section>
                <section className="tf-card rounded-xl p-4">
                  <p className="text-xs font-medium text-[var(--tg-hint)]">
                    Active members
                  </p>
                  <p className="mt-1 text-2xl font-bold tabular-nums">
                    {summary.activeMembers}
                  </p>
                  <p className="mt-1 text-[10px] leading-tight text-[var(--tg-hint)]">
                    Registered users in the app
                  </p>
                </section>
              </div>
            </>
          ) : null}
        </div>
      )}

      <UserEditSheet
        user={editUser}
        isOpen={sheetOpen}
        onClose={() => {
          setSheetOpen(false);
          setEditUser(null);
        }}
        onSaved={onUserSaved}
      />
    </div>
  );
}
