"use client";

import { useState } from "react";
import clsx from "clsx";
import type { IStep } from "@/types";
import { haptic } from "@/lib/tma";

export type StepListProps = {
  taskId: string;
  steps: IStep[];
  canEdit: boolean;
  token: string | null;
  onStepsChange: (steps: IStep[]) => void;
};

export function StepList({
  taskId,
  steps,
  canEdit,
  token,
  onStepsChange,
}: StepListProps) {
  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [pending, setPending] = useState<string | null>(null);

  const total = steps.length;
  const doneCount = steps.filter((s) => s.done).length;
  const pct = total === 0 ? 0 : Math.round((doneCount / total) * 100);

  const toggle = async (step: IStep) => {
    if (!token || pending) return;
    const prev = steps;
    const next = steps.map((s) =>
      s._id === step._id ? { ...s, done: !s.done } : s,
    );
    onStepsChange(next);
    setPending(step._id);
    haptic("light");
    try {
      const res = await fetch(`/api/tasks/${taskId}/steps`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ stepId: step._id, done: !step.done }),
      });
      const json = (await res.json()) as {
        success?: boolean;
        data?: IStep[];
        error?: string;
      };
      if (!res.ok || json.success === false || !json.data) {
        throw new Error(json.error || "Could not update step");
      }
      onStepsChange(json.data);
    } catch {
      onStepsChange(prev);
      haptic("error");
    } finally {
      setPending(null);
    }
  };

  const addStep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newTitle.trim() || adding) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/steps`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title: newTitle.trim() }),
      });
      const json = (await res.json()) as {
        success?: boolean;
        data?: IStep[];
        error?: string;
      };
      if (!res.ok || json.success === false || !json.data) {
        throw new Error(json.error || "Could not add step");
      }
      onStepsChange(json.data);
      setNewTitle("");
      haptic("success");
    } catch {
      haptic("error");
    } finally {
      setAdding(false);
    }
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[var(--tg-text)]">Steps</h3>
        <span className="text-xs text-[var(--tg-hint)]">
          {doneCount}/{total}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--tg-secondary-bg)]">
        <div
          className="h-full rounded-full bg-[var(--tg-button)] transition-[width]"
          style={{ width: `${pct}%` }}
        />
      </div>
      <ul className="space-y-2">
        {steps.map((s) => (
          <li key={s._id}>
            <button
              type="button"
              disabled={!canEdit || !!pending}
              onClick={() => void toggle(s)}
              className={clsx(
                "flex min-h-[44px] w-full items-start gap-3 rounded-lg border border-black/5 px-3 py-2 text-left dark:border-white/10",
                canEdit ? "active:bg-[var(--tg-secondary-bg)]" : "opacity-90",
              )}
            >
              <span
                className={clsx(
                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2",
                  s.done
                    ? "border-[var(--tg-button)] bg-[var(--tg-button)] text-[var(--tg-button-text)]"
                    : "border-[var(--tg-hint)]",
                )}
                aria-hidden
              >
                {s.done ? "✓" : ""}
              </span>
              <span
                className={clsx(
                  "flex-1 text-[15px] leading-snug",
                  s.done
                    ? "text-[var(--tg-hint)] line-through"
                    : "text-[var(--tg-text)]",
                )}
              >
                {s.title}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {canEdit ? (
        <form onSubmit={addStep} className="flex gap-2 pt-1">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Add step"
            className="min-h-[44px] flex-1 rounded-lg border border-black/10 bg-[var(--tg-secondary-bg)] px-3 text-sm text-[var(--tg-text)] placeholder:text-[var(--tg-hint)] dark:border-white/10"
          />
          <button
            type="submit"
            disabled={adding || !newTitle.trim()}
            className="min-h-[44px] shrink-0 rounded-lg bg-[var(--tg-button)] px-4 text-sm font-medium text-[var(--tg-button-text)] disabled:opacity-50"
          >
            Add
          </button>
        </form>
      ) : null}
    </section>
  );
}
