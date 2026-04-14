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
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-black/5 bg-[var(--tg-bg)]/95 backdrop-blur dark:border-white/10"
      style={{
        paddingBottom: "max(8px, env(safe-area-inset-bottom))",
      }}
      aria-label="Main"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around gap-1 px-1 pt-1">
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
                "flex min-h-[44px] min-w-[56px] flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1 text-[10px] font-medium",
                active
                  ? "text-[var(--tg-button)]"
                  : "text-[var(--tg-hint)]",
              )}
            >
              <Icon className="h-5 w-5" strokeWidth={active ? 2.25 : 2} />
              <span className="leading-tight">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
