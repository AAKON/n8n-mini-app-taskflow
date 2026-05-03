"use client";

import { useCallback, useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import type { TaskListTask } from "@/components/TaskCard";
import type { TaskStatus } from "@/types";
import type { DueFilter } from "@/lib/task-filters";

export type UseTasksFilters = {
  status?: TaskStatus | "";
  dueFilter?: DueFilter;
  departmentPath?: string;
  assigneeId?: string;
  q?: string;
};

type PaginatedPayload = {
  success: boolean;
  data: TaskListTask[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export function useTasks(filters: UseTasksFilters) {
  const token = useAppStore((s) => s.token);
  const [tasks, setTasks] = useState<TaskListTask[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buildUrl = useCallback(
    (pageNum: number) => {
      const params = new URLSearchParams();
      params.set("page", String(pageNum));
      params.set("limit", "20");
      if (filters.status) {
        params.set("status", filters.status);
      }
      if (filters.assigneeId) {
        params.set("assigneeId", filters.assigneeId);
      }
      if (filters.dueFilter) {
        params.set("dueFilter", filters.dueFilter);
      }
      if (filters.departmentPath) {
        params.set("departmentPath", filters.departmentPath);
      }
      if (filters.q && filters.q.trim()) {
        params.set("q", filters.q.trim());
      }
      return `/api/tasks?${params.toString()}`;
    },
    [filters.status, filters.dueFilter, filters.departmentPath, filters.assigneeId, filters.q],
  );

  const fetchPage = useCallback(
    async (pageNum: number, mode: "replace" | "append") => {
      if (!token) return;
      const url = buildUrl(pageNum);
      if (mode === "replace") {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }
      setError(null);
      try {
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = (await res.json()) as PaginatedPayload & {
          error?: string;
        };
        if (!res.ok || json.success === false) {
          throw new Error(
            typeof json.error === "string" ? json.error : "Failed to load tasks",
          );
        }
        const rows = json.data ?? [];
        const p = json.pagination;
        setTotal(p?.total ?? 0);
        setTotalPages(p?.totalPages ?? 0);
        setPage(pageNum);
        setTasks((prev) =>
          mode === "append" ? [...prev, ...rows] : rows,
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load tasks");
        if (mode === "replace") {
          setTasks([]);
        }
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [token, filters.userId, buildUrl],
  );

  const refetch = useCallback(async () => {
    await fetchPage(1, "replace");
  }, [fetchPage]);

  const prependTask = useCallback((task: TaskListTask) => {
    setTasks((prev) => [task, ...prev]);
  }, []);

  const loadMore = useCallback(async () => {
    if (!token || isLoading || isLoadingMore) return;
    if (page >= totalPages || totalPages === 0) return;
    await fetchPage(page + 1, "append");
  }, [
    token,
    filters.userId,
    isLoading,
    isLoadingMore,
    page,
    totalPages,
    fetchPage,
  ]);

  useEffect(() => {
    if (!token) {
      setTasks([]);
      setError(null);
      setIsLoading(false);
      return;
    }
    void fetchPage(1, "replace");
  }, [
    token,
    filters.status,
    filters.dueFilter,
    filters.departmentPath,
    filters.assigneeId,
    filters.q,
    fetchPage,
  ]);

  return {
    tasks,
    isLoading,
    isLoadingMore,
    error,
    refetch,
    prependTask,
    loadMore,
    page,
    totalPages,
    total,
  };
}
