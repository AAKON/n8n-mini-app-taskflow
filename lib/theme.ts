import { getTelegramWebApp } from "@/lib/tma";

export type ThemePreference = "auto" | "light" | "dark";
export type ThemeScheme = "light" | "dark";

const STORAGE_KEY = "taskflow.themePreference";
export const THEME_CHANGE_EVENT = "taskflow:theme-change";

function isThemePreference(value: unknown): value is ThemePreference {
  return value === "auto" || value === "light" || value === "dark";
}

function getSystemScheme(win: Window): ThemeScheme {
  return win.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function getTelegramScheme(): ThemeScheme | null {
  const wa = getTelegramWebApp();
  if (!wa) return null;
  return wa.colorScheme === "dark" ? "dark" : "light";
}

export function getStoredThemePreference(): ThemePreference {
  if (typeof window === "undefined") return "auto";
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return isThemePreference(raw) ? raw : "auto";
}

export function applyThemePreference(preference = getStoredThemePreference()): {
  preference: ThemePreference;
  scheme: ThemeScheme;
} {
  if (typeof window === "undefined") {
    return { preference, scheme: "light" };
  }

  const root = document.documentElement;
  const telegramScheme = getTelegramScheme();
  const scheme: ThemeScheme =
    preference === "auto"
      ? telegramScheme ?? getSystemScheme(window)
      : preference;

  if (preference === "auto") {
    // Let CSS media queries + Telegram-provided vars drive the look.
    root.classList.remove("dark");
    root.classList.remove("light");
    root.style.removeProperty("color-scheme");
  } else {
    root.classList.toggle("dark", scheme === "dark");
    root.classList.toggle("light", scheme === "light");
    root.style.colorScheme = scheme;
  }

  root.dataset.themePreference = preference;
  window.dispatchEvent(
    new CustomEvent(THEME_CHANGE_EVENT, {
      detail: { preference, scheme },
    }),
  );

  return { preference, scheme };
}

export function setThemePreference(preference: ThemePreference): {
  preference: ThemePreference;
  scheme: ThemeScheme;
} {
  if (typeof window !== "undefined") {
    if (preference === "auto") {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, preference);
    }
  }
  return applyThemePreference(preference);
}
