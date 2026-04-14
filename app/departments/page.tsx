"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useAppStore } from "@/lib/store";
import { buildTree, type DepartmentNode } from "@/lib/department-utils";
import { DepartmentTree } from "@/components/DepartmentTree";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { SignInNotice } from "@/components/SignInNotice";
import { Spinner } from "@/components/ui/Spinner";
import { getTelegramWebApp, hideBackButton, haptic, showBackButton } from "@/lib/tma";
import type { IDepartment } from "@/types";

type UserRow = {
  _id: string;
  name: string;
  username?: string;
  departmentPath: string;
};

function flattenDepartmentsSorted(depts: IDepartment[]): IDepartment[] {
  return [...depts].sort((a, b) => a.path.localeCompare(b.path));
}

export default function DepartmentsPage() {
  const router = useRouter();
  const token = useAppStore((s) => s.token);
  const { user } = useAuth();

  const [departments, setDepartments] = useState<IDepartment[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [addParentPath, setAddParentPath] = useState("");
  const [addName, setAddName] = useState("");
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addErr, setAddErr] = useState<string | null>(null);

  const [editNode, setEditNode] = useState<DepartmentNode | null>(null);
  const [editName, setEditName] = useState("");
  const [editHeadId, setEditHeadId] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editErr, setEditErr] = useState<string | null>(null);

  const canView =
    user?.role === "admin" || user?.role === "department_head";
  const isAdmin = user?.role === "admin";

  const loadAll = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [dRes, uRes] = await Promise.all([
        fetch("/api/departments", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/users", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      const dJson = (await dRes.json()) as {
        success?: boolean;
        data?: IDepartment[];
        error?: string;
      };
      const uJson = (await uRes.json()) as {
        success?: boolean;
        data?: UserRow[];
        error?: string;
      };
      if (!dRes.ok || dJson.success === false) {
        throw new Error(dJson.error || "Could not load departments");
      }
      if (!uRes.ok || uJson.success === false) {
        throw new Error(uJson.error || "Could not load users");
      }
      setDepartments(dJson.data ?? []);
      setUsers(uJson.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setDepartments([]);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!user || !canView) return;
    void loadAll();
  }, [user, canView, loadAll]);

  useEffect(() => {
    if (!user) return;
    if (!canView) {
      router.replace("/");
    }
  }, [user, canView, router]);

  useEffect(() => {
    document.title = "Departments";
    showBackButton(() => router.push("/"));
    const wa = getTelegramWebApp();
    if (wa) wa.setHeaderColor("bg_color");
    return () => {
      hideBackButton();
      document.title = "TaskFlow";
    };
  }, [router]);

  const userById = useMemo(() => {
    const m = new Map<string, UserRow>();
    for (const u of users) m.set(u._id, u);
    return m;
  }, [users]);

  const headName = useCallback(
    (headId?: string) => {
      if (!headId) return "—";
      return userById.get(headId)?.name ?? "—";
    },
    [userById],
  );

  const memberCount = useCallback(
    (path: string) =>
      users.filter(
        (u) =>
          u.departmentPath === path ||
          u.departmentPath.startsWith(`${path}.`),
      ).length,
    [users],
  );

  const tree = useMemo(() => buildTree(departments), [departments]);

  const flatDepts = useMemo(
    () => flattenDepartmentsSorted(departments),
    [departments],
  );

  const openAdd = (parentPath: string) => {
    setAddParentPath(parentPath);
    setAddName("");
    setAddErr(null);
    setAddOpen(true);
  };

  const closeAdd = () => {
    setAddOpen(false);
    setAddErr(null);
  };

  const submitAdd = async () => {
    if (!token) return;
    setAddErr(null);
    const name = addName.trim();
    if (!name) {
      setAddErr("Name is required");
      return;
    }
    setAddSubmitting(true);
    try {
      const res = await fetch("/api/departments", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          parentPath: addParentPath.trim(),
        }),
      });
      const json = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || json.success === false) {
        throw new Error(json.error || "Create failed");
      }
      haptic("success");
      closeAdd();
      await loadAll();
    } catch (e) {
      setAddErr(e instanceof Error ? e.message : "Request failed");
      haptic("error");
    } finally {
      setAddSubmitting(false);
    }
  };

  const openEdit = (node: DepartmentNode) => {
    setEditNode(node);
    setEditName(node.name);
    setEditHeadId(node.headId ?? "");
    setEditErr(null);
  };

  const closeEdit = () => {
    setEditNode(null);
    setEditErr(null);
  };

  const submitEdit = async () => {
    if (!token || !editNode) return;
    setEditErr(null);
    const name = editName.trim();
    if (!name) {
      setEditErr("Name is required");
      return;
    }
    setEditSubmitting(true);
    try {
      const body: { name: string; headId: string | null } = {
        name,
        headId: editHeadId.trim() ? editHeadId.trim() : null,
      };
      const res = await fetch(`/api/departments/${editNode._id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || json.success === false) {
        throw new Error(json.error || "Save failed");
      }
      haptic("success");
      closeEdit();
      await loadAll();
    } catch (e) {
      setEditErr(e instanceof Error ? e.message : "Request failed");
      haptic("error");
    } finally {
      setEditSubmitting(false);
    }
  };

  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => a.name.localeCompare(b.name)),
    [users],
  );

  if (!token || !user) {
    return <SignInNotice />;
  }

  if (!canView) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--tg-bg)]">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="tf-page min-h-screen pb-28 text-[var(--tg-text)]">
      <div className="tf-topbar px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-lg font-bold">Departments</h1>
          {isAdmin ? (
            <button
              type="button"
              onClick={() => openAdd("")}
              className="tf-btn-primary min-h-[44px] rounded-lg px-3 text-sm font-medium"
            >
              Add department
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="px-4 py-3 text-center text-sm text-red-500">{error}</p>
      ) : null}

      <div className="px-2 pt-2">
        {loading ? (
          <Spinner className="min-h-[40vh]" />
        ) : (
          <DepartmentTree
            nodes={tree}
            showAdminActions={isAdmin}
            headName={headName}
            memberCount={memberCount}
            onAddChild={isAdmin ? (n) => openAdd(n.path) : undefined}
            onEdit={isAdmin ? openEdit : undefined}
          />
        )}
      </div>

      <BottomSheet isOpen={addOpen} onClose={closeAdd} title="New department">
        <div className="flex flex-col gap-3 pt-2">
          <label className="flex flex-col gap-1 text-xs text-[var(--tg-hint)]">
            Name
            <input
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              className="tf-input min-h-[44px] px-3 text-sm"
              placeholder="e.g. Backend"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-[var(--tg-hint)]">
            Parent (optional)
            <select
              value={addParentPath}
              onChange={(e) => setAddParentPath(e.target.value)}
              className="tf-select min-h-[44px] px-2 text-sm"
            >
              <option value="">— Root —</option>
              {flatDepts.map((d) => (
                <option key={d._id} value={d.path}>
                  {d.path} ({d.name})
                </option>
              ))}
            </select>
          </label>
          {addErr ? (
            <p className="text-sm text-red-500">{addErr}</p>
          ) : null}
          <button
            type="button"
            disabled={addSubmitting}
            onClick={() => void submitAdd()}
            className="tf-btn-primary mt-2 min-h-[48px] rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {addSubmitting ? "Creating…" : "Create"}
          </button>
        </div>
      </BottomSheet>

      <BottomSheet
        isOpen={!!editNode}
        onClose={closeEdit}
        title="Edit department"
      >
        <div className="flex flex-col gap-3 pt-2">
          <label className="flex flex-col gap-1 text-xs text-[var(--tg-hint)]">
            Name
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="tf-input min-h-[44px] px-3 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-[var(--tg-hint)]">
            Head
            <select
              value={editHeadId}
              onChange={(e) => setEditHeadId(e.target.value)}
              className="tf-select min-h-[44px] px-2 text-sm"
            >
              <option value="">— None —</option>
              {sortedUsers.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.name}
                  {u.username ? ` (@${u.username})` : ""}
                </option>
              ))}
            </select>
          </label>
          {editErr ? (
            <p className="text-sm text-red-500">{editErr}</p>
          ) : null}
          <button
            type="button"
            disabled={editSubmitting}
            onClick={() => void submitEdit()}
            className="tf-btn-primary mt-2 min-h-[48px] rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {editSubmitting ? "Saving…" : "Save"}
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
