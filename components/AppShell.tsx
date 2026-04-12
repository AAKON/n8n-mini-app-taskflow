"use client";

import { BottomNav } from "@/components/BottomNav";
import { ToastContainer } from "@/components/ui/Toast";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ToastContainer />
      <div className="pb-[calc(3.75rem+max(8px,env(safe-area-inset-bottom)))]">
        {children}
      </div>
      <BottomNav />
    </>
  );
}
