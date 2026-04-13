"use client";

import { Smartphone } from "lucide-react";

export function SignInNotice() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--tg-bg)] px-6 pb-24 text-center text-[var(--tg-text)]">
      <Smartphone
        className="h-14 w-14 text-[var(--tg-hint)]"
        strokeWidth={1.25}
        aria-hidden
      />
      <h1 className="text-lg font-semibold">Sign in with Telegram</h1>
      <p className="max-w-sm text-sm text-[var(--tg-hint)]">
        TaskFlow needs Telegram to verify who you are. Open this app from your
        bot inside Telegram (Mini App).
      </p>
    </div>
  );
}
