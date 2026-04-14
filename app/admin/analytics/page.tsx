"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dayjs from "dayjs";
import { useAuth } from "@/hooks/useAuth";
import { SignInNotice } from "@/components/SignInNotice";
import { Spinner } from "@/components/ui/Spinner";
import { hideBackButton } from "@/lib/tma";

type Analytics = {
  trend: { date: string; created: number; done: number }[];
  avgHours: number;
  departments: {
    departmentPath: string;
    total: number;
    overdue: number;
    rate: number;
  }[];
};

export default function AnalyticsPage() {
  const router = useRouter();
  const { user, token } = useAuth();
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Analytics · TaskFlow";
    hideBackButton();
  }, []);

  useEffect(() => {
    if (!user) return;
    if (user.role !== "admin" && user.role !== "department_head") {
      router.replace("/");
    }
  }, [user, router]);

  useEffect(() => {
    if (!token || !user) return;
    if (user.role !== "admin" && user.role !== "department_head") return;
    setLoading(true);
    fetch("/api/admin/analytics", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((j: { success?: boolean; data?: Analytics; error?: string }) => {
        if (j.success === false || !j.data) {
          throw new Error(j.error || "Failed to load analytics");
        }
        setData(j.data);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token, user]);

  if (!token || !user) return <SignInNotice />;
  if (user.role !== "admin" && user.role !== "department_head") {
    return <div className="flex min-h-screen items-center justify-center"><Spinner /></div>;
  }

  return (
    <div className="tf-page min-h-screen pb-24 pt-3 text-[var(--tg-text)]">
      <div className="px-4 pb-3">
        <h1 className="text-lg font-bold">Analytics</h1>
        <p className="text-xs text-[var(--tg-hint)]">Operational overview for the last 30 days.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Spinner /></div>
      ) : error ? (
        <p className="px-4 text-center text-sm text-red-500">{error}</p>
      ) : data ? (
        <div className="space-y-4 px-3">
          <section className="tf-card p-4">
            <p className="mb-1 text-xs font-semibold text-[var(--tg-hint)]">Last 30 days</p>
            <p className="mb-3 text-sm font-semibold">Created vs. completed</p>
            <TrendChart trend={data.trend} />
            <div className="mt-3 flex items-center gap-4 text-[11px] text-[var(--tg-hint)]">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-sky-500" /> Created
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> Done
              </span>
            </div>
          </section>

          <section className="tf-card p-4">
            <p className="text-xs font-semibold text-[var(--tg-hint)]">Avg. completion time</p>
            <p className="mt-1 text-3xl font-bold tabular-nums">
              {data.avgHours}
              <span className="ml-1 text-sm font-medium text-[var(--tg-hint)]">hours</span>
            </p>
          </section>

          <section className="tf-card p-4">
            <p className="mb-3 text-sm font-semibold">Overdue rate per department</p>
            {data.departments.length === 0 ? (
              <p className="text-xs text-[var(--tg-hint)]">No data.</p>
            ) : (
              <ul className="space-y-3">
                {data.departments.map((d) => {
                  const pct = Math.round(d.rate * 100);
                  return (
                    <li key={d.departmentPath}>
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="truncate pr-2">{d.departmentPath}</span>
                        <span className="tabular-nums text-[var(--tg-hint)]">
                          {d.overdue}/{d.total} ({pct}%)
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-[var(--tg-border)]">
                        <div
                          className="h-full rounded-full bg-amber-500 transition-[width]"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}

function TrendChart({ trend }: { trend: Analytics["trend"] }) {
  const width = 320;
  const height = 120;
  const padding = 8;
  const max = Math.max(1, ...trend.map((p) => Math.max(p.created, p.done)));

  const toPath = (key: "created" | "done") => {
    if (trend.length === 0) return "";
    return trend
      .map((p, i) => {
        const x = padding + (i * (width - padding * 2)) / Math.max(1, trend.length - 1);
        const y = height - padding - (p[key] / max) * (height - padding * 2);
        return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");
  };

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label="Created vs done trend"
      >
        <path d={toPath("created")} fill="none" stroke="rgb(14 165 233)" strokeWidth={2} />
        <path d={toPath("done")} fill="none" stroke="rgb(16 185 129)" strokeWidth={2} />
      </svg>
      <div className="mt-1 flex justify-between text-[9px] text-[var(--tg-hint)]">
        <span>{dayjs(trend[0]?.date).format("MMM D")}</span>
        <span>{dayjs(trend[trend.length - 1]?.date).format("MMM D")}</span>
      </div>
    </div>
  );
}
