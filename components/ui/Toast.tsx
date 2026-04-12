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
            "animate-toast-in pointer-events-auto mx-auto w-full max-w-md rounded-xl px-4 py-3 text-left text-sm font-medium shadow-lg",
            t.type === "success" &&
              "bg-emerald-600/95 text-white dark:bg-emerald-700/95",
            t.type === "error" && "bg-red-600/95 text-white dark:bg-red-700/95",
            t.type === "info" &&
              "bg-sky-600/95 text-white dark:bg-sky-700/95",
          )}
        >
          {t.message}
        </button>
      ))}
    </div>
  );
}
