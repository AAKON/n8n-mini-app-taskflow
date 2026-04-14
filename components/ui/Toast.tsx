"use client";

import { useToastStore } from "@/lib/toast-store";
import clsx from "clsx";

export type { ToastType } from "@/lib/toast-store";
export { showToast } from "@/lib/toast-store";

export function useToast() {
  const show = useToastStore((s) => s.show);
  return { show };
}

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed left-0 right-0 top-0 z-[200] flex flex-col items-stretch gap-2 px-3 pt-[max(12px,env(safe-area-inset-top))]"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => dismiss(t.id)}
          className={clsx(
            "animate-toast-in pointer-events-auto mx-auto w-full max-w-lg rounded-2xl border px-4 py-3 text-left text-sm font-medium shadow-[var(--shadow-lg)]",
            t.type === "success" &&
              "border-emerald-400/40 bg-emerald-600/95 text-white dark:border-emerald-300/30 dark:bg-emerald-700/95",
            t.type === "error" &&
              "border-red-400/40 bg-red-600/95 text-white dark:border-red-300/30 dark:bg-red-700/95",
            t.type === "info" &&
              "border-sky-400/40 bg-sky-600/95 text-white dark:border-sky-300/30 dark:bg-sky-700/95",
          )}
        >
          {t.message}
        </button>
      ))}
    </div>
  );
}
