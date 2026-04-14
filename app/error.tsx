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
    <div className="tf-page flex min-h-screen items-center justify-center px-6">
      <div className="tf-card w-full max-w-md px-6 py-8 text-center">
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-[var(--tg-hint)]">
          {error.message || "An unexpected error occurred."}
        </p>
        <button
          type="button"
          onClick={() => {
            haptic("light");
            reset();
          }}
          className="tf-btn-primary mt-5 min-h-[44px] w-full px-6 text-sm font-medium"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
