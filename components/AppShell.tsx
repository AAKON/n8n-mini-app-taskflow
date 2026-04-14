"use client";

import { BottomNav } from "@/components/BottomNav";
import { ToastContainer } from "@/components/ui/Toast";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ToastContainer />
      <div className="mx-auto w-full max-w-6xl pb-[calc(4.25rem+max(10px,env(safe-area-inset-bottom)))]">
        {children}
      </div>
      <BottomNav />
    </>
  );
}
