"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import dayjs from "dayjs";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  AlertTriangle,
  ListTodo,
} from "lucide-react";
import clsx from "clsx";
import { useAuth } from "@/hooks/useAuth";
import { SignInNotice } from "@/components/SignInNotice";
import { Spinner } from "@/components/ui/Spinner";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { TaskCard, type TaskListTask } from "@/components/TaskCard";
import { hideBackButton, showBackButton } from "@/lib/tma";
import type { Role } from "@/types";

type EmployeeUser = {
  _id: string;
  name: string;
  username?: string;
  avatarUrl?: string;
  role: Role;
  departmentPath?: string;
};

type PaginatedPayload = {
  success: boolean;
  data: TaskListTask[];
  pagination: { totalPages: number; page: number; total: number };
};

const STATUS_LABEL: Record<string, string> = {
  todo: "Todo",
  in_progress: "In progress",
  review: "Review",
  done: "Done",
};

export default function EmployeeDetailPage() {
  const router = useRouter();
  const params = useParams<{ userId: string }>();
  const userId = params?.userId;
  const { user, token } = useAuth();

  const [employee, setEmployee] = useState<EmployeeUser | null>(null);
  const [tasks, setTasks] = useState<TaskListTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Employee · TaskFlow";
    showBackButton(() => router.back());
    return () => hideBackButton();
  }, [router]);

  useEffect(() => {
    if (!user) return;
    if (user.role !== "admin" && user.role !== "department_head") {
      router.replace("/");
    }
  }, [user, router]);

  useEffect(() => {
    if (!token || !userId || !user) return;
    if (user.role !== "admin" && user.role !== "department_head") return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const [uRes, tRes] = await Promise.all([
          fetch(`/api/users/${userId}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`/api/tasks?assigneeId=${userId}&limit=100`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);
        if (cancelled) return;
        const uJson = (await uRes.json()) as { data?: EmployeeUser; error?: string };
        const tJson = (await tRes.json()) as PaginatedPayload & { error?: string };
        if (!uRes.ok || !uJson.data) {
          throw new Error(uJson.error || "Failed to load employee");
        }
        if (!tRes.ok || !tJson.data) {
          throw new Error(tJson.error || "Failed to load tasks");
        }
        setEmployee(uJson.data);
        setTasks(tJson.data);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, userId, user]);

  if (!token || !user) return <SignInNotice />;
  if (user.role !== "admin" && user.role !== "department_head") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const today = dayjs().startOf("day");
  const total = tasks.length;
  const doneCount = tasks.filter((t) => t.status === "done").length;
  const openCount = total - doneCount;
  const overdueCount = tasks.filter((t) => {
    if (t.status === "done" || !t.dueDate) return false;
    return dayjs(t.dueDate).startOf("day").isBefore(today);
  }).length;
  const completionPct = total === 0 ? 0 : Math.round((doneCount / total) * 100);

  const doneDurationsMs = tasks
    .filter((t) => t.status === "done" && t.createdAt && t.updatedAt)
    .map((t) => new Date(t.updatedAt).getTime() - new Date(t.createdAt).getTime())
    .filter((ms) => ms > 0);
  const avgHours =
    doneDurationsMs.length === 0
      ? 0
      : Math.round(
          doneDurationsMs.reduce((a, b) => a + b, 0) /
            doneDurationsMs.length /
            3_600_000,
        );

  const byStatus: Record<string, TaskListTask[]> = {
    todo: [],
    in_progress: [],
    review: [],
    done: [],
  };
  for (const t of tasks) {
    (byStatus[t.status] ?? byStatus.todo)!.push(t);
  }

  return (
    <div className="tf-page min-h-screen pb-24 pt-3">
      <div className="mb-3 flex items-center gap-2 px-3">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Back"
          className="tf-icon-btn h-9 w-9"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-lg font-bold text-[var(--tg-text)]">Employee</h1>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      ) : error ? (
        <p className="px-4 text-center text-sm text-[var(--tone-danger)]">{error}</p>
      ) : employee ? (
        <div className="space-y-4 px-3">
          <section className="tf-hero tf-animate-fade-up p-4">
            <div className="flex items-center gap-3">
              <Avatar user={employee} size="lg" />
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-base font-semibold">{employee.name}</h2>
                {employee.username ? (
                  <p className="truncate text-xs text-[var(--tg-link)]">@{employee.username}</p>
                ) : null}
                {employee.departmentPath ? (
                  <p className="truncate text-[11px] text-[var(--tg-hint)]">
                    {employee.departmentPath}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="tf-stagger mt-4 grid grid-cols-3 gap-2">
              <StatTile
                icon={<Clock3 className="h-3.5 w-3.5" />}
                label="Open"
                value={openCount}
              />
              <StatTile
                icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                label="Done"
                value={doneCount}
                tone="success"
              />
              <StatTile
                icon={<AlertTriangle className="h-3.5 w-3.5" />}
                label="Overdue"
                value={overdueCount}
                tone="danger"
              />
            </div>

            <div className="mt-4">
              <div className="mb-1 flex items-center justify-between text-[11px]">
                <span className="font-semibold text-[var(--tg-hint)]">
                  Completion
                </span>
                <span className="tabular-nums text-[var(--tg-hint)]">
                  {doneCount}/{total} · {completionPct}%
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--tg-border)]">
                <div
                  className="h-full rounded-full bg-[var(--tone-success)] transition-[width] duration-500"
                  style={{ width: `${completionPct}%` }}
                />
              </div>
            </div>
          </section>

          <section className="tf-card tf-animate-fade-up p-4" style={{ animationDelay: "80ms" }}>
            <p className="text-xs font-semibold text-[var(--tg-hint)]">
              Avg. completion time
            </p>
            <p className="mt-1 text-3xl font-bold tabular-nums">
              {avgHours}
              <span className="ml-1 text-sm font-medium text-[var(--tg-hint)]">
                hours
              </span>
            </p>
            <p className="mt-1 text-[11px] text-[var(--tg-hint)]">
              Based on {doneDurationsMs.length} completed task
              {doneDurationsMs.length !== 1 ? "s" : ""}
            </p>
          </section>

          {total === 0 ? (
            <EmptyState
              icon={<ListTodo className="mx-auto" strokeWidth={1.25} />}
              title="No tasks assigned"
              description="This employee has no tasks assigned yet."
            />
          ) : (
            (["todo", "in_progress", "review", "done"] as const).map((key) =>
              byStatus[key]!.length > 0 ? (
                <div key={key} className="flex flex-col gap-3">
                  <div className="flex items-center gap-2 px-1 pt-2">
                    <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--tg-hint)]">
                      {STATUS_LABEL[key]}
                    </h2>
                    <span className="rounded-full border border-[var(--tg-border)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--tg-hint)]">
                      {byStatus[key]!.length}
                    </span>
                  </div>
                  <div className="tf-stagger flex flex-col gap-3">
                    {byStatus[key]!.map((t) => (
                      <TaskCard
                        key={t._id}
                        task={t}
                        onClick={() => router.push(`/tasks/${t._id}`)}
                      />
                    ))}
                  </div>
                </div>
              ) : null,
            )
          )}
        </div>
      ) : null}
    </div>
  );
}

function StatTile(props: {
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
