"use client";

import Link from "next/link";
import { haptic } from "@/lib/tma";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--tg-bg)] px-6 text-center text-[var(--tg-text)]">
      <p className="text-sm font-medium text-[var(--tg-hint)]">TaskFlow</p>
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="max-w-sm text-sm text-[var(--tg-hint)]">
        This page doesn’t exist or was moved.
      </p>
      <Link
        href="/"
        onClick={() => haptic("light")}
        className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[var(--tg-button)] px-6 text-sm font-medium text-[var(--tg-button-text)]"
      >
        Back to home
      </Link>
    </div>
  );
}
