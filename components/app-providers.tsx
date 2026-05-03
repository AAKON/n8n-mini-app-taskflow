"use client";

import { useEffect } from "react";
import "@twa-dev/sdk";
import { useAppStore } from "@/lib/store";
import { getInitData, getTelegramWebApp } from "@/lib/tma";
import { applyThemePreference, getStoredThemePreference } from "@/lib/theme";
import type { IUser } from "@/types";
import { StoreProvider } from "@/components/store-provider";

function applyAppTheme() {
  applyThemePreference();
}

async function bootstrapAuth(
  setAuth: (t: string, u: IUser) => void,
  clearAuth: () => void,
) {
  const wa = getTelegramWebApp();
  wa?.ready();
  wa?.expand();

  const initData = getInitData();

  if (!initData.trim()) {
    // if (process.env.NODE_ENV === "development") {
    //   try {
    //     const devRes = await fetch("/api/auth/dev", { method: "POST" });
    //     const devJson = (await devRes.json().catch(() => ({}))) as {
    //       token?: string;
    //       user?: IUser;
    //     };
    //     if (devRes.ok && devJson.token && devJson.user) {
    //       setAuth(devJson.token, devJson.user);
    //       return;
    //     }
    //   } catch {
    //     // fall through to clearAuth
    //   }
    // }
    clearAuth();
    return;
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15_000);
  let res: Response;
  try {
    res = await fetch("/api/auth/telegram", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData }),
      signal: controller.signal,
    });
  } catch {
    clearTimeout(timeout);
    clearAuth();
    return;
  }
  clearTimeout(timeout);

  const json = (await res.json().catch(() => ({}))) as {
    token?: string;
    user?: IUser;
    error?: string;
  };

  if (!res.ok || !json.token || !json.user) {
    clearAuth();
    return;
  }

  setAuth(json.token, json.user as IUser);
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  const setAuth = useAppStore((s) => s.setAuth);
  const clearAuth = useAppStore((s) => s.clearAuth);
  const setLoading = useAppStore((s) => s.setLoading);
  const isLoading = useAppStore((s) => s.isLoading);

  useEffect(() => {
    (async () => {
      try {
        await bootstrapAuth(setAuth, clearAuth);
      } catch {
        clearAuth();
      } finally {
        applyAppTheme();
        setLoading(false);
      }
    })();

    const wa = getTelegramWebApp();
    const onTheme = () => applyAppTheme();
    wa?.onEvent("themeChanged", onTheme);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemTheme = () => {
      if (getStoredThemePreference() === "auto") {
        applyAppTheme();
      }
    };
    media.addEventListener("change", onSystemTheme);

    return () => {
      wa?.offEvent("themeChanged", onTheme);
      media.removeEventListener("change", onSystemTheme);
    };
  }, [setAuth, clearAuth, setLoading]);

  return (
    <StoreProvider>
      {isLoading ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--tg-bg)]/95 px-6 text-[var(--tg-text)] backdrop-blur-sm">
          <div className="tf-card w-full max-w-xs px-6 py-5 text-center">
            <div
              className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-[var(--tg-border-strong)] border-t-[var(--tg-button)]"
              aria-hidden
            />
            <p className="mt-3 text-sm text-[var(--tg-hint)]">Loading…</p>
          </div>
        </div>
      ) : (
        children
      )}
    </StoreProvider>
  );
}
