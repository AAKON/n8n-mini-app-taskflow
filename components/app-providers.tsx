"use client";

import { useEffect } from "react";
import "@twa-dev/sdk";
import { useAppStore } from "@/lib/store";
import { getInitData, getTelegramWebApp } from "@/lib/tma";
import { applyThemePreference, getStoredThemePreference } from "@/lib/theme";
import type { IUser } from "@/types";
import { StoreProvider } from "@/components/store-provider";

function applyThemeFromWebApp() {
  const wa = getTelegramWebApp();
  if (wa) {
    const root = document.documentElement;
    const p = wa.themeParams;

    if (p.bg_color) root.style.setProperty("--tg-bg", p.bg_color);
    if (p.text_color) root.style.setProperty("--tg-text", p.text_color);
    if (p.hint_color) root.style.setProperty("--tg-hint", p.hint_color);
    if (p.link_color) root.style.setProperty("--tg-link", p.link_color);
    if (p.button_color) root.style.setProperty("--tg-button", p.button_color);
    if (p.button_text_color) {
      root.style.setProperty("--tg-button-text", p.button_text_color);
    }
    if (p.secondary_bg_color) {
      root.style.setProperty("--tg-secondary-bg", p.secondary_bg_color);
    }
    if (p.header_bg_color) {
      root.style.setProperty("--tg-header-bg", p.header_bg_color);
      wa.setHeaderColor(p.header_bg_color);
    }
  }

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
        applyThemeFromWebApp();
        setLoading(false);
      }
    })();

    const wa = getTelegramWebApp();
    const onTheme = () => applyThemeFromWebApp();
    wa?.onEvent("themeChanged", onTheme);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemTheme = () => {
      if (getStoredThemePreference() === "auto") {
        applyThemeFromWebApp();
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
