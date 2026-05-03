"use client";

import { Smartphone } from "lucide-react";

export function SignInNotice() {
  return (
    <div className="tf-page flex min-h-screen items-center justify-center px-6 pb-24">
      <div className="tf-card w-full max-w-md px-6 py-8 text-center">
        <Smartphone
          className="mx-auto h-14 w-14 text-[var(--tg-hint)]"
          strokeWidth={1.25}
          aria-hidden
        />
        <h1 className="mt-4 text-lg font-semibold">Sign in with Telegram</h1>
        <p className="mt-2 text-sm text-[var(--tg-hint)]">
          TaskFlow needs Telegram to verify who you are. Open this app from your
          bot inside Telegram (Mini App).
        </p>
      </div>
    </div>
  );
}
