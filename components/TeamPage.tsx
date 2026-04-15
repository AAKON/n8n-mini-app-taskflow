"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Users } from "lucide-react";
import clsx from "clsx";
import { useAuth } from "@/hooks/useAuth";
import { useAppStore } from "@/lib/store";
import { haptic, hideBackButton } from "@/lib/tma";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { SignInNotice } from "@/components/SignInNotice";
import { hasRole } from "@/lib/rbac";
import type { IDepartment, Role } from "@/types";

type TeamUser = {
  _id: string;
  name: string;
  username?: string;
  avatarUrl?: string;
  role: Role;
  departmentPath: string;
};

const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin",
  department_head: "Head",
  manager: "Manager",
  member: "Member",
};

const ROLE_COLOR: Record<Role, string> = {
  admin: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  department_head: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300",
  manager: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  member: "bg-[var(--tg-secondary-bg)] text-[var(--tg-hint)] border border-[var(--tg-border)]",
};

export function TeamPage() {
  const router = useRouter();
  const { user, token } = useAuth();
  const isLoading = useAppStore((s) => s.isLoading);
  const canViewDetails = user ? hasRole(user.role, "manager") : false;

  const [users, setUsers] = useState<TeamUser[]>([]);
  const [departments, setDepartments] = useState<IDepartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("");

  useEffect(() => {
    hideBackButton();
    document.title = "Team · TaskFlow";
    return () => { document.title = "TaskFlow"; };
  }, []);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const [uRes, dRes] = await Promise.all([
          fetch("/api/users", { headers: { Authorization: `Bearer ${token}` } }),
          fetch("/api/departments", { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        if (cancelled) return;
        const uJson = (await uRes.json()) as { success?: boolean; data?: TeamUser[] };
        const dJson = (await dRes.json()) as { success?: boolean; data?: IDepartment[] };
        if (uRes.ok && uJson.data) setUsers(uJson.data);
        if (dRes.ok && dJson.data) setDepartments(dJson.data);
      } catch {
        // silently ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      const matchesDept = !deptFilter ||
        u.departmentPath === deptFilter ||
        u.departmentPath.startsWith(deptFilter + ".");
      const matchesSearch = !q ||
        u.name.toLowerCase().includes(q) ||
        (u.username && u.username.toLowerCase().includes(q)) ||
        u.departmentPath.toLowerCase().includes(q);
      return matchesDept && matchesSearch;
    });
  }, [users, search, deptFilter]);

  const sorted = useMemo(() =>
    [...filtered].sort((a, b) =>
      a.departmentPath.localeCompare(b.departmentPath) || a.name.localeCompare(b.name)
    ), [filtered]);

  if (isLoading) return null;
  if (!token || !user) return <SignInNotice />;

  const sortedDepts = [...departments].sort((a, b) => a.path.localeCompare(b.path));

  return (
    <div className="tf-page flex min-h-screen flex-col text-[var(--tg-text)]">
      {/* Search bar */}
      <div className="px-3 pt-3">
        <div className="tf-card flex items-center gap-2 px-3 py-1">
          <Search className="h-4 w-4 shrink-0 text-[var(--tg-hint)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or department…"
            className="min-h-[44px] flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--tg-hint)]"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--tg-surface-hover)] text-xs text-[var(--tg-hint)]"
            >
              ✕
            </button>
          ) : null}
        </div>
      </div>

      {/* Department chips */}
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-3 py-2">
        <button
          type="button"
          onClick={() => { haptic("light"); setDeptFilter(""); }}
          className={clsx(
            "tf-chip shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition",
            !deptFilter
              ? "tf-chip-active"
              : "",
          )}
        >
          All
        </button>
        {sortedDepts.map((d) => (
          <button
            key={d._id}
            type="button"
            onClick={() => { haptic("light"); setDeptFilter(deptFilter === d.path ? "" : d.path); }}
            className={clsx(
              "tf-chip shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition",
              deptFilter === d.path
                ? "tf-chip-active"
                : "",
            )}
          >
            {d.name}
          </button>
        ))}
      </div>

      {/* Count */}
      <p className="px-4 pb-1 text-xs text-[var(--tg-hint)]">
        {loading ? "Loading…" : `${sorted.length} member${sorted.length !== 1 ? "s" : ""}`}
      </p>

      {/* Member list */}
      <div className="flex-1 overflow-y-auto px-3 pb-32">
        {loading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="tf-card flex items-center gap-3 p-3 animate-pulse">
                <div className="h-12 w-12 rounded-full bg-[var(--tg-border)]" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-2/5 rounded bg-[var(--tg-border)]" />
                  <div className="h-2.5 w-1/3 rounded bg-[var(--tg-border)]" />
                </div>
              </div>
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <EmptyState
            icon={<Users className="mx-auto" strokeWidth={1.25} />}
            title="No members found"
            description="Try a different search or department filter."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {sorted.map((u) => (
              <li key={u._id}>
                <button
                  type="button"
                  disabled={!canViewDetails}
                  onClick={() => {
                    if (!canViewDetails) return;
                    haptic("light");
                    router.push(`/admin/analytics/employees/${u._id}`);
                  }}
                  className={clsx(
                    "tf-card flex w-full items-center gap-3 px-3 py-3 text-left",
                    canViewDetails && "active:scale-[0.99] transition-transform",
                  )}
                >
                  <Avatar user={u} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold">{u.name}</span>
                      <span className={clsx(
                        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        ROLE_COLOR[u.role],
                      )}>
                        {ROLE_LABEL[u.role]}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2">
                      {u.username ? (
                        <span className="text-xs text-[var(--tg-link)]">@{u.username}</span>
                      ) : null}
                      {u.departmentPath ? (
                        <span className="truncate text-xs text-[var(--tg-hint)]">{u.departmentPath}</span>
                      ) : null}
                    </div>
                  </div>
                  {canViewDetails ? (
                    <svg className="h-4 w-4 shrink-0 text-[var(--tg-hint)]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
