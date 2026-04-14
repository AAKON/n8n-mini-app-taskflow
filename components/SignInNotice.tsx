"use client";

import { useState } from "react";
import { Smartphone } from "lucide-react";
import { useAppStore } from "@/lib/store";
import type { IUser } from "@/types";

export function SignInNotice() {
  const setAuth = useAppStore((s) => s.setAuth);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isDev = process.env.NODE_ENV === "development";

  const handleDevLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/dev", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const json = (await res.json().catch(() => ({}))) as {
        token?: string;
        user?: IUser;
        error?: string;
      };
      if (!res.ok || !json.token || !json.user) {
        throw new Error(json.error || "Dev login failed");
      }
      setAuth(json.token, json.user);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Dev login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tf-page flex min-h-screen items-center justify-center px-6 pb-24">
      <div className="tf-card w-full max-w-md px-6 py-8 text-center">
        <Smartphone
          className="mx-auto h-14 w-14 text-[var(--tg-hint)]"
          strokeWidth={1.25}
          aria-hidden
        />
        <h1 className="mt-4 text-lg font-semibold">Sign in with Telegram</h1>
        <p className="mt-2 text-sm text-[var(--tg-hint)]">
          TaskFlow needs Telegram to verify who you are. Open this app from your
          bot inside Telegram (Mini App).
        </p>
        {isDev ? (
          <div className="mt-5">
            <button
              type="button"
              onClick={() => void handleDevLogin()}
              disabled={loading}
              className="tf-btn-primary min-h-[44px] rounded-xl px-4 text-sm font-semibold disabled:opacity-50"
            >
              {loading ? "Signing in…" : "Dev Login (Temporary)"}
            </button>
            {error ? (
              <p className="mt-2 text-xs text-[var(--tone-danger)]">{error}</p>
            ) : (
              <p className="mt-2 text-xs text-[var(--tg-hint)]">
                Available only in local development.
              </p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
