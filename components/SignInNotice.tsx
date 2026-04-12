"use client";

import { useState } from "react";
import { Smartphone } from "lucide-react";
import { useAppStore } from "@/lib/store";
import type { IUser } from "@/types";
import { haptic } from "@/lib/tma";

const isDev =
  typeof process !== "undefined" && process.env.NODE_ENV === "development";

export function SignInNotice() {
  const setAuth = useAppStore((s) => s.setAuth);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const devSignIn = async () => {
    setErr(null);
    setBusy(true);
    haptic("light");
    try {
      const res = await fetch("/api/auth/dev", { method: "POST" });
      const json = (await res.json().catch(() => ({}))) as {
        token?: string;
        user?: IUser;
        error?: string;
      };
      if (!res.ok || !json.token || !json.user) {
        throw new Error(json.error || "Dev sign-in failed");
      }
      setAuth(json.token, json.user);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not sign in");
      haptic("error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--tg-bg)] px-6 pb-24 text-center text-[var(--tg-text)]">
      <Smartphone
        className="h-14 w-14 text-[var(--tg-hint)]"
        strokeWidth={1.25}
        aria-hidden
      />
      <h1 className="text-lg font-semibold">Sign in with Telegram</h1>
      <p className="max-w-sm text-sm text-[var(--tg-hint)]">
        TaskFlow needs Telegram to verify who you are. Open this app from your
        bot inside Telegram (Mini App).
      </p>
      {isDev ? (
        <div className="mt-4 w-full max-w-sm space-y-2">
          <p className="text-xs text-[var(--tg-hint)]">
            Development: sign in without Telegram if MongoDB is running.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void devSignIn()}
            className="min-h-[44px] w-full rounded-xl bg-[var(--tg-button)] px-4 text-sm font-medium text-[var(--tg-button-text)] disabled:opacity-50"
          >
            {busy ? "Signing in…" : "Dev sign-in (local only)"}
          </button>
          {err ? <p className="text-sm text-red-500">{err}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
