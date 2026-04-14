"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import clsx from "clsx";
import {
  THEME_CHANGE_EVENT,
  applyThemePreference,
  setThemePreference,
  type ThemePreference,
  type ThemeScheme,
} from "@/lib/theme";
import { haptic } from "@/lib/tma";

type ThemeChangeDetail = {
  preference: ThemePreference;
  scheme: ThemeScheme;
};

export function ThemeToggle() {
  const [scheme, setScheme] = useState<ThemeScheme>("light");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const applied = applyThemePreference();
    setScheme(applied.scheme);
    setReady(true);

    const onThemeChanged = (event: Event) => {
      const detail = (event as CustomEvent<ThemeChangeDetail>).detail;
      if (!detail) return;
      setScheme(detail.scheme);
    };

    window.addEventListener(THEME_CHANGE_EVENT, onThemeChanged as EventListener);
    return () => {
      window.removeEventListener(
        THEME_CHANGE_EVENT,
        onThemeChanged as EventListener,
      );
    };
  }, []);

  const next = scheme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      onClick={() => {
        haptic("light");
        const applied = setThemePreference(next);
        setScheme(applied.scheme);
      }}
      className={clsx(
        "tf-icon-btn fixed right-4 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[55] h-10 w-10 rounded-full bg-[var(--tg-card-bg)]/90 shadow-[var(--shadow-md)] backdrop-blur-md",
        ready ? "opacity-100" : "pointer-events-none opacity-0",
        scheme === "dark" ? "text-[var(--brand-1)]" : "text-[var(--brand-2)]",
      )}
    >
      {scheme === "dark" ? (
        <Sun className="h-5 w-5" />
      ) : (
        <Moon className="h-5 w-5" />
      )}
    </button>
  );
}
