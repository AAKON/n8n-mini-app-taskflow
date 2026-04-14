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
  const activeHref =
    items
      .filter(({ href }) =>
        href === "/"
          ? pathname === "/" || pathname === ""
          : pathname === href || pathname.startsWith(`${href}/`),
      )
      .sort((a, b) => b.href.length - a.href.length)[0]?.href ?? null;

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
      <div className="tf-nav-shell mx-auto max-w-[38rem] p-1.5">
        <div className="flex items-stretch justify-around gap-1">
          {items.map(({ href, label, icon: Icon }) => {
            const active = href === activeHref;
            return (
              <Link
                key={href}
                href={href}
                onClick={() => haptic("light")}
                className={clsx(
                  "tf-nav-item px-1 py-1 text-[10px] font-medium",
                  active
                    ? "tf-nav-item-active font-semibold"
                    : "hover:bg-[var(--tg-surface-hover)]",
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
