"use client";

import { useState } from "react";
import clsx from "clsx";
import { CheckCircle2, Circle, ListChecks, Plus, Trash2 } from "lucide-react";
import type { IStep } from "@/types";
import { haptic } from "@/lib/tma";

export type StepListProps = {
  taskId: string;
  steps: IStep[];
  canEdit: boolean;
  token: string | null;
  onStepsChange: (steps: IStep[]) => void;
};

export function StepList({ taskId, steps, canEdit, token, onStepsChange }: StepListProps) {
  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const total = steps.length;
  const doneCount = steps.filter((s) => s.done).length;
  const pct = total === 0 ? 0 : Math.round((doneCount / total) * 100);

  const toggle = async (step: IStep) => {
    if (!token || pending) return;
    const prev = steps;
    const next = steps.map((s) => s._id === step._id ? { ...s, done: !s.done } : s);
    onStepsChange(next);
    setPending(step._id);
    haptic("light");
    try {
      const res = await fetch(`/api/tasks/${taskId}/steps`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ stepId: step._id, done: !step.done }),
      });
      const json = (await res.json()) as { success?: boolean; data?: IStep[]; error?: string };
      if (!res.ok || json.success === false || !json.data) throw new Error();
      onStepsChange(json.data);
    } catch {
      onStepsChange(prev);
      haptic("error");
    } finally {
      setPending(null);
    }
  };

  const removeStep = async (stepId: string) => {
    if (!token || deleting) return;
    const prev = steps;
    onStepsChange(steps.filter((s) => s._id !== stepId));
    setDeleting(stepId);
    haptic("light");
    try {
      const res = await fetch(`/api/tasks/${taskId}/steps`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ stepId }),
      });
      const json = (await res.json()) as { success?: boolean; data?: IStep[] };
      if (!res.ok || json.success === false || !json.data) throw new Error();
      onStepsChange(json.data);
    } catch {
      onStepsChange(prev);
      haptic("error");
    } finally {
      setDeleting(null);
    }
  };

  const addStep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newTitle.trim() || adding) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/steps`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim() }),
      });
      const json = (await res.json()) as { success?: boolean; data?: IStep[]; error?: string };
      if (!res.ok || json.success === false || !json.data) throw new Error();
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
      {/* Header */}
      <div className="flex items-center gap-2">
        <ListChecks className="h-4 w-4 text-[var(--tg-hint)]" />
        <h3 className="text-sm font-semibold text-[var(--tg-text)]">Steps</h3>
        {total > 0 ? (
          <span className="ml-auto text-xs font-medium text-[var(--tg-hint)]">
            {doneCount}/{total} · {pct}%
          </span>
        ) : null}
      </div>

      {/* Progress bar */}
      {total > 0 ? (
        <div className="h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
          <div
            className={clsx(
              "h-full rounded-full transition-[width] duration-300",
              pct === 100 ? "bg-emerald-500" : "bg-[var(--tg-button)]",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : null}

      {/* Step list */}
      {total > 0 ? (
        <ul className="space-y-2">
          {steps.map((s) => (
            <li key={s._id} className="flex items-center gap-2">
              <button
                type="button"
                disabled={!canEdit || !!pending || !!deleting}
                onClick={() => void toggle(s)}
                className={clsx(
                  "flex min-h-[44px] flex-1 items-center gap-3 rounded-xl px-3 py-2 text-left transition",
                  "bg-[var(--tg-secondary-bg)]",
                  canEdit ? "active:opacity-75" : "opacity-90",
                  s.done && "opacity-70",
                )}
              >
                {s.done ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-[var(--tg-button)]" />
                ) : (
                  <Circle className="h-5 w-5 shrink-0 text-[var(--tg-hint)]" />
                )}
                <span className={clsx(
                  "flex-1 text-sm leading-snug",
                  s.done ? "text-[var(--tg-hint)] line-through" : "text-[var(--tg-text)]",
                )}>
                  {s.title}
                </span>
              </button>
              {canEdit ? (
                <button
                  type="button"
                  disabled={!!deleting || !!pending}
                  onClick={() => void removeStep(s._id)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[var(--tg-hint)] transition active:bg-red-100 active:text-red-500 disabled:opacity-40 dark:active:bg-red-900/30"
                  aria-label="Remove step"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm italic text-[var(--tg-hint)]">No steps yet.</p>
      )}

      {/* Add step */}
      {canEdit ? (
        <form onSubmit={addStep} className="flex gap-2">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Add a step…"
            className="min-h-[44px] flex-1 rounded-xl border border-black/10 bg-[var(--tg-secondary-bg)] px-3 text-sm text-[var(--tg-text)] placeholder:text-[var(--tg-hint)] dark:border-white/10"
          />
          <button
            type="submit"
            disabled={adding || !newTitle.trim()}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--tg-button)] text-[var(--tg-button-text)] disabled:opacity-50"
          >
            <Plus className="h-5 w-5" />
          </button>
        </form>
      ) : null}
    </section>
  );
}
