"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ListTodo, Plus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTasks, type TaskTab } from "@/hooks/useTasks";
import { TaskCard } from "@/components/TaskCard";
import { CreateTaskSheet } from "@/components/CreateTaskSheet";
import { EmptyState } from "@/components/ui/EmptyState";
import { SignInNotice } from "@/components/SignInNotice";
import { Spinner } from "@/components/ui/Spinner";
import { TaskCardSkeleton } from "@/components/ui/TaskCardSkeleton";
import { hasRole } from "@/lib/rbac";
import { getTelegramWebApp, hideBackButton, haptic } from "@/lib/tma";
import type { TaskStatus } from "@/types";
import clsx from "clsx";

const STATUS_OPTIONS: { value: TaskStatus | ""; label: string }[] = [
  { value: "", label: "All" },
  { value: "todo", label: "Todo" },
  { value: "in_progress", label: "In progress" },
  { value: "review", label: "Review" },
  { value: "done", label: "Done" },
];

export type TaskHomeProps = {
  initialTab?: TaskTab;
};

export function TaskHome({ initialTab = "my" }: TaskHomeProps) {
  const router = useRouter();
  const { user, token } = useAuth();
  const [tab, setTab] = useState<TaskTab>(initialTab);
  const [status, setStatus] = useState<TaskStatus | "">("");
  const [createOpen, setCreateOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const loadSentinelRef = useRef<HTMLDivElement>(null);
  const pullRef = useRef({ startY: 0, tracking: false });

  const showTeamTab = user ? hasRole(user.role, "manager") : false;
  const showAllTab =
    user?.role === "admin" || user?.role === "department_head";

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const {
    tasks,
    isLoading,
    isLoadingMore,
    error,
    refetch,
    prependTask,
    loadMore,
    totalPages,
    page,
  } = useTasks({
    tab,
    status: status || undefined,
    userId: user?._id ?? "",
  });

  useEffect(() => {
    document.title = initialTab === "team" ? "Team · TaskFlow" : "TaskFlow";
    hideBackButton();
    const wa = getTelegramWebApp();
    if (wa) {
      wa.setHeaderColor("bg_color");
    }
  }, [initialTab]);

  useEffect(() => {
    if (!user) return;
    if (!showTeamTab && tab !== "my") {
      setTab("my");
    }
    if (!showAllTab && tab === "all") {
      setTab("my");
    }
  }, [user, showTeamTab, showAllTab, tab]);

  useEffect(() => {
    if (!user) return;
    if (initialTab === "team" && !showTeamTab) {
      router.replace("/");
    }
  }, [user, initialTab, showTeamTab, router]);

  useEffect(() => {
    const el = loadSentinelRef.current;
    const root = scrollRef.current;
    if (!el || !root) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void loadMore();
        }
      },
      { root, rootMargin: "120px", threshold: 0 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadMore, tasks.length]);

  const onTouchStart = (e: React.TouchEvent) => {
    const sc = scrollRef.current;
    if (!sc || sc.scrollTop > 0) return;
    pullRef.current = {
      startY: e.touches[0]?.clientY ?? 0,
      tracking: true,
    };
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const sc = scrollRef.current;
    if (!sc || sc.scrollTop > 0 || !pullRef.current.tracking) return;
    const dy = (e.touches[0]?.clientY ?? 0) - pullRef.current.startY;
    if (dy > 72) {
      pullRef.current.tracking = false;
      void refetch();
    }
  };

  const onTouchEnd = () => {
    pullRef.current.tracking = false;
  };

  const goTask = useCallback(
    (id: string) => {
      router.push(`/tasks/${id}`);
    },
    [router],
  );

  if (!token || !user) {
    return <SignInNotice />;
  }

  if (initialTab === "team" && !showTeamTab) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--tg-bg)]">
        <Spinner />
      </div>
    );
  }

  const canCreate = hasRole(user.role, "manager");

  return (
    <div className="flex min-h-screen flex-col bg-[var(--tg-bg)] pt-2">
      {showTeamTab ? (
        <div className="flex gap-1 border-b border-black/5 px-3 pb-2 dark:border-white/10">
          <TabButton
            active={tab === "my"}
            disabled={isLoading && tasks.length === 0}
            onClick={() => setTab("my")}
            label="My Tasks"
          />
          <TabButton
            active={tab === "team"}
            disabled={isLoading && tasks.length === 0}
            onClick={() => setTab("team")}
            label="Team"
          />
          {showAllTab ? (
            <TabButton
              active={tab === "all"}
              disabled={isLoading && tasks.length === 0}
              onClick={() => setTab("all")}
              label="All"
            />
          ) : null}
        </div>
      ) : null}

      <div className="no-scrollbar flex gap-2 overflow-x-auto px-3 py-3">
        {STATUS_OPTIONS.map((o) => (
          <button
            key={o.value || "all"}
            type="button"
            disabled={isLoading && tasks.length === 0}
            onClick={() => {
              haptic("light");
              setStatus(o.value);
            }}
            className={clsx(
              "shrink-0 rounded-full px-3 py-2 text-sm font-medium transition",
              "min-h-[44px] min-w-[44px]",
              (status === o.value || (o.value === "" && status === ""))
                ? "bg-[var(--tg-button)] text-[var(--tg-button-text)]"
                : "bg-[var(--tg-secondary-bg)] text-[var(--tg-text)]",
              isLoading && tasks.length === 0 && "opacity-50",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>

      {error ? (
        <p className="px-4 py-2 text-center text-sm text-red-500">{error}</p>
      ) : null}

      <div
        ref={scrollRef}
        className="flex flex-1 flex-col gap-3 overflow-y-auto px-3 pb-36"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {isLoading && tasks.length === 0 ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <TaskCardSkeleton key={i} />
            ))}
          </div>
        ) : tasks.length === 0 ? (
          <EmptyState
            icon={<ListTodo className="mx-auto" strokeWidth={1.25} />}
            title="No tasks"
            description="There’s nothing here yet. Try another filter or check back later."
          />
        ) : (
          <>
            {tasks.map((t) => (
              <TaskCard
                key={t._id}
                task={t}
                onClick={() => goTask(t._id)}
              />
            ))}
            <div ref={loadSentinelRef} className="h-2 w-full shrink-0" />
            {isLoadingMore ? (
              <p className="pb-6 text-center text-xs text-[var(--tg-hint)]">
                Loading more…
              </p>
            ) : null}
            {page < totalPages && !isLoadingMore ? (
              <button
                type="button"
                disabled={isLoadingMore}
                className="mx-auto mb-8 min-h-[44px] rounded-full px-4 py-2 text-sm text-[var(--tg-link)] disabled:opacity-50"
                onClick={() => {
                  haptic("light");
                  void loadMore();
                }}
              >
                Load more
              </button>
            ) : null}
          </>
        )}
      </div>

      {canCreate ? (
        <button
          type="button"
          aria-label="Create task"
          className={clsx(
            "fixed right-4 z-[60] flex h-14 w-14 items-center justify-center rounded-full shadow-lg",
            "bg-[var(--tg-button)] text-[var(--tg-button-text)]",
            "min-h-[44px] min-w-[44px] transition active:scale-95",
            "bottom-[calc(4.5rem+env(safe-area-inset-bottom))]",
          )}
          onClick={() => {
            haptic("light");
            setCreateOpen(true);
          }}
        >
          <Plus className="h-7 w-7" strokeWidth={2} />
        </button>
      ) : null}

      <CreateTaskSheet
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(t) => {
          prependTask(t);
          void refetch();
        }}
      />
    </div>
  );
}

function TabButton(props: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      disabled={props.disabled}
      onClick={() => {
        haptic("light");
        props.onClick();
      }}
      className={clsx(
        "min-h-[44px] flex-1 rounded-lg px-2 py-2 text-sm font-medium transition",
        props.active
          ? "bg-[var(--tg-button)] text-[var(--tg-button-text)]"
          : "bg-[var(--tg-secondary-bg)] text-[var(--tg-text)]",
        props.disabled && "opacity-50",
      )}
    >
      {props.label}
    </button>
  );
}
