"use client";

import Link from "next/link";
import { haptic } from "@/lib/tma";

export default function NotFound() {
  return (
    <div className="tf-page flex min-h-screen items-center justify-center px-6">
      <div className="tf-card w-full max-w-md px-6 py-8 text-center">
        <p className="text-sm font-medium text-[var(--tg-hint)]">TaskFlow</p>
        <h1 className="mt-1 text-2xl font-bold">Page not found</h1>
        <p className="mt-2 text-sm text-[var(--tg-hint)]">
          This page doesn’t exist or was moved.
        </p>
        <Link
          href="/"
          onClick={() => haptic("light")}
          className="tf-btn-primary mt-5 inline-flex min-h-[44px] w-full items-center justify-center px-6 text-sm font-medium"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
