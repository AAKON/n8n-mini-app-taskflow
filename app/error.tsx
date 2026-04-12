"use client";

import { useEffect } from "react";
import { haptic } from "@/lib/tma";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.error("[TaskFlow error boundary]", error);
    }
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--tg-bg)] px-6 text-center text-[var(--tg-text)]">
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p className="max-w-sm text-sm text-[var(--tg-hint)]">
        {error.message || "An unexpected error occurred."}
      </p>
      <button
        type="button"
        onClick={() => {
          haptic("light");
          reset();
        }}
        className="min-h-[44px] rounded-xl bg-[var(--tg-button)] px-6 text-sm font-medium text-[var(--tg-button-text)]"
      >
        Try again
      </button>
    </div>
  );
}
