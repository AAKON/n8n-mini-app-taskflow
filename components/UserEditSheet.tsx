"use client";

import { useCallback, useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import { useAuth } from "@/hooks/useAuth";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { haptic, hideMainButton, setMainButton } from "@/lib/tma";
import type { IDepartment, IUser, Role } from "@/types";

const ROLES: Role[] = ["admin", "department_head", "manager", "member"];

export function roleLabel(r: Role): string {
  switch (r) {
    case "admin":
      return "Admin";
    case "department_head":
      return "Department head";
    case "manager":
      return "Manager";
    case "member":
      return "Member";
    default:
      return r;
  }
}

export type UserEditSheetProps = {
  user: IUser | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (u: IUser) => void;
};

export function UserEditSheet({
  user,
  isOpen,
  onClose,
  onSaved,
}: UserEditSheetProps) {
  const token = useAppStore((s) => s.token);
  const { user: authUser } = useAuth();

  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [departmentPath, setDepartmentPath] = useState("");
  const [departments, setDepartments] = useState<IDepartment[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const isSelf = !!user && !!authUser && user._id === authUser._id;

  useEffect(() => {
    if (!user) return;
    setName(user.name);
    setRole(user.role);
    setDepartmentPath(user.departmentPath ?? "");
    setErr(null);
  }, [user]);

  useEffect(() => {
    if (!isOpen || !token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/departments", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = (await res.json()) as {
          success?: boolean;
          data?: IDepartment[];
        };
        if (cancelled) return;
        if (res.ok && json.success !== false) {
          setDepartments(json.data ?? []);
        }
      } catch {
        if (!cancelled) setDepartments([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, token]);

  const save = useCallback(async () => {
    if (!token || !user) return;
    setErr(null);
    setSubmitting(true);
    try {
      if (!name.trim()) {
        setErr("Name is required");
        setSubmitting(false);
        return;
      }
      const body = isSelf
        ? { name: name.trim(), departmentPath: departmentPath.trim() }
        : { name: name.trim(), role, departmentPath: departmentPath.trim() };
      const res = await fetch(`/api/users/${user._id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as {
        success?: boolean;
        data?: IUser;
        error?: string;
      };
      if (!res.ok || json.success === false || !json.data) {
        throw new Error(json.error || "Save failed");
      }
      onSaved?.(json.data);
      haptic("success");
      onClose();
      hideMainButton();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Request failed");
      haptic("error");
    } finally {
      setSubmitting(false);
    }
  }, [
    token,
    user,
    name,
    departmentPath,
    role,
    isSelf,
    onSaved,
    onClose,
  ]);

  useEffect(() => {
    if (!isOpen) {
      hideMainButton();
      return;
    }
    setMainButton("Save user", () => {
      void save();
    });
    return () => {
      hideMainButton();
    };
  }, [isOpen, save]);

  const sortedDepts = [...departments].sort((a, b) =>
    a.path.localeCompare(b.path),
  );

  return (
    <BottomSheet
      isOpen={isOpen && !!user}
      onClose={onClose}
      title={user ? `Edit ${user.name}` : "User"}
    >
      <div className="flex flex-col gap-3 pt-2">
        <label className="flex flex-col gap-1 text-xs text-[var(--tg-hint)]">
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="tf-input min-h-[44px] px-3 text-sm"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs text-[var(--tg-hint)]">
          Role
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            disabled={isSelf}
            className="tf-select min-h-[44px] px-2 text-sm disabled:opacity-50"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {roleLabel(r)}
              </option>
            ))}
          </select>
          {isSelf ? (
            <span className="text-[11px] text-[var(--tg-hint)]">
              You cannot change your own role.
            </span>
          ) : null}
        </label>

        <label className="flex flex-col gap-1 text-xs text-[var(--tg-hint)]">
          Department
          <select
            value={departmentPath}
            onChange={(e) => setDepartmentPath(e.target.value)}
            className="tf-select min-h-[44px] px-2 text-sm"
          >
            <option value="">— None —</option>
            {sortedDepts.map((d) => (
              <option key={d._id} value={d.path}>
                {d.path} ({d.name})
              </option>
            ))}
          </select>
        </label>

        {err ? <p className="text-sm text-red-500">{err}</p> : null}

        <button
          type="button"
          disabled={submitting}
          onClick={() => void save()}
          className="tf-btn-primary mt-2 min-h-[48px] rounded-lg text-sm font-medium disabled:opacity-50"
        >
          {submitting ? "Saving…" : "Save"}
        </button>
      </div>
    </BottomSheet>
  );
}
