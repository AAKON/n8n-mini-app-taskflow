"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Building2, Calendar, Home, Kanban, LayoutGrid, Users } from "lucide-react";
import clsx from "clsx";
import { useAuth } from "@/hooks/useAuth";
import { haptic } from "@/lib/tma";
import type { Role } from "@/types";

type NavItem = { href: string; label: string; icon: typeof Home };

function itemsForRole(role: Role | undefined): NavItem[] {
  if (!role) return [{ href: "/", label: "Home", icon: Home }];
  if (role === "member") {
    return [
      { href: "/", label: "Home", icon: Home },
      { href: "/tasks/board", label: "Board", icon: Kanban },
      { href: "/tasks/calendar", label: "Calendar", icon: Calendar },
    ];
  }
  if (role === "manager") {
    return [
      { href: "/", label: "Home", icon: Home },
      { href: "/tasks/board", label: "Board", icon: Kanban },
      { href: "/tasks/calendar", label: "Calendar", icon: Calendar },
      { href: "/team", label: "Team", icon: Users },
    ];
  }
  if (role === "department_head") {
    return [
      { href: "/", label: "Home", icon: Home },
      { href: "/tasks/board", label: "Board", icon: Kanban },
      { href: "/admin/analytics", label: "Stats", icon: BarChart3 },
      { href: "/team", label: "Team", icon: Users },
      { href: "/departments", label: "Depts", icon: Building2 },
    ];
  }
  return [
    { href: "/", label: "Home", icon: Home },
    { href: "/tasks/board", label: "Board", icon: Kanban },
    { href: "/admin/analytics", label: "Stats", icon: BarChart3 },
    { href: "/team", label: "Team", icon: Users },
    { href: "/admin", label: "Admin", icon: LayoutGrid },
  ];
}

export function BottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const items = itemsForRole(user?.role);

  if (items.length <= 1) {
    return null;
  }

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 px-3"
      style={{
        paddingBottom: "max(10px, env(safe-area-inset-bottom))",
      }}
      aria-label="Main"
    >
      <div className="mx-auto max-w-xl rounded-[1.4rem] border border-[var(--tg-border)] bg-[var(--tg-bg)]/90 p-1.5 shadow-[var(--shadow-lg)] backdrop-blur-xl">
        <div className="flex items-stretch justify-around gap-1">
          {items.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/"
                ? pathname === "/" || pathname === ""
                : pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => haptic("light")}
                className={clsx(
                  "flex min-h-[44px] min-w-[56px] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 text-[10px] font-medium transition-colors",
                  active
                    ? "bg-[var(--tg-button)]/15 text-[var(--tg-button)]"
                    : "text-[var(--tg-hint)] hover:bg-[var(--tg-surface-hover)]",
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.3 : 2} />
                <span className="leading-tight">{label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
