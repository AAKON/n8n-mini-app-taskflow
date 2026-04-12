"use client";

import { useCallback, useState } from "react";
import { useAppStore } from "@/lib/store";
import { showToast } from "@/lib/toast-store";

export type ApiState<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;
};

function normalizeUrl(url: string) {
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return url.startsWith("/") ? url : `/${url}`;
}

function isNetworkError(e: unknown): boolean {
  if (e instanceof TypeError) return true;
  if (e instanceof Error) {
    if (e.message === "Failed to fetch") return true;
    if (e.name === "AbortError") return true;
  }
  return false;
}

async function parseJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function useApi() {
  const token = useAppStore((s) => s.token);
  const clearAuth = useAppStore((s) => s.clearAuth);
  const [data, setData] = useState<unknown | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const run = useCallback(
    async <T,>(
      method: string,
      url: string,
      body?: unknown,
    ): Promise<ApiState<T>> => {
      setLoading(true);
      setError(null);
      try {
        const headers: Record<string, string> = {};
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }
        const hasJsonBody =
          body !== undefined && method !== "GET" && method !== "DELETE";
        if (hasJsonBody) {
          headers["Content-Type"] = "application/json";
        }

        const res = await fetch(normalizeUrl(url), {
          method,
          headers,
          body: hasJsonBody ? JSON.stringify(body) : undefined,
        });

        const json = (await parseJson(res)) as Record<string, unknown> | null;

        if (!res.ok) {
          if (res.status === 401) {
            clearAuth();
            showToast(
              "Session expired. Please reopen the mini app to sign in again.",
              "info",
            );
          } else if (res.status >= 500) {
            showToast("Server error. Try again in a moment.", "error");
          }

          const msg =
            (typeof json?.error === "string" && json.error) ||
            res.statusText ||
            "Request failed";
          setData(null);
          setError(msg);
          setLoading(false);
          return { data: null, error: msg, loading: false };
        }

        let payload: unknown = json;
        if (json && typeof json === "object" && "success" in json) {
          const s = json as { success?: boolean; data?: unknown };
          if (s.success === false) {
            const msg =
              typeof (json as { error?: string }).error === "string"
                ? (json as { error: string }).error
                : "Request failed";
            setData(null);
            setError(msg);
            setLoading(false);
            return { data: null, error: msg, loading: false };
          }
          if ("data" in json && (json as { data: unknown }).data !== undefined) {
            payload = (json as { data: unknown }).data;
          }
        }

        setData(payload);
        setLoading(false);
        return { data: payload as T, error: null, loading: false };
      } catch (e) {
        const network = isNetworkError(e);
        if (network) {
          showToast("No connection", "error");
        }
        const msg = network
          ? "No connection"
          : e instanceof Error
            ? e.message
            : "Network error";
        setData(null);
        setError(msg);
        setLoading(false);
        return { data: null, error: msg, loading: false };
      }
    },
    [token, clearAuth],
  );

  const get = useCallback(
    <T,>(url: string) => run<T>("GET", url),
    [run],
  );
  const post = useCallback(
    <T,>(url: string, body: unknown) => run<T>("POST", url, body),
    [run],
  );
  const patch = useCallback(
    <T,>(url: string, body: unknown) => run<T>("PATCH", url, body),
    [run],
  );
  const del = useCallback(
    <T,>(url: string) => run<T>("DELETE", url),
    [run],
  );

  return {
    data,
    error,
    loading,
    get,
    post,
    patch,
    del,
  };
}
