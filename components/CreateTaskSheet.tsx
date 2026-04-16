"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import dayjs from "dayjs";
import clsx from "clsx";
import { useAppStore } from "@/lib/store";
import { useAuth } from "@/hooks/useAuth";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import {
  hideMainButton,
  haptic,
  setMainButton,
} from "@/lib/tma";
import { BottomSheet } from "@/components/ui/BottomSheet";
import type { TaskListTask } from "@/components/TaskCard";
import type { ITask, TaskPriority, TaskStatus } from "@/types";

type DeptRow = {
  _id: string;
  name: string;
  path: string;
  parentPath?: string;
};

type UserRow = {
  _id: string;
  name: string;
  username?: string;
  avatarUrl?: string;
  role: string;
  departmentPath: string;
};

const PRIORITIES: TaskPriority[] = ["low", "medium", "high", "urgent"];
const STATUSES: TaskStatus[] = [
  "todo",
  "in_progress",
  "review",
  "done",
];

function toInputDate(d: string | Date | undefined): string {
  if (!d) return "";
  return dayjs(d).format("YYYY-MM-DD");
}

function useRefLatest<T>(value: T) {
  const r = useRef(value);
  r.current = value;
  return r;
}

export type CreateTaskSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (task: TaskListTask) => void;
  onUpdated?: () => void;
  editTask?: ITask;
};

export function CreateTaskSheet({
  isOpen,
  onClose,
  onCreated,
  onUpdated,
  editTask,
}: CreateTaskSheetProps) {
  const token = useAppStore((s) => s.token);
  const { user } = useAuth();
  const isEdit = !!editTask;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [assigneeId, setAssigneeId] = useState("");
  const [departmentPath, setDepartmentPath] = useState("");
  const [startStr, setStartStr] = useState("");
  const [dueStr, setDueStr] = useState("");
  const [steps, setSteps] = useState<string[]>([]);
  const [stepInput, setStepInput] = useState("");
  const [userQuery, setUserQuery] = useState("");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [departments, setDepartments] = useState<DeptRow[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiWarn, setAiWarn] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const setAiPromptRef = useRef<((t: string) => void) | undefined>(undefined);
  const {
    isSupported: voiceSupported,
    isListening: voiceListening,
    interimTranscript,
    error: voiceErr,
    start: startVoice,
    stop: stopVoice,
  } = useSpeechRecognition("en-US", (transcript) => {
    if (transcript.trim()) setAiPromptRef.current?.(transcript.trim());
  });

  const resetFromProps = useCallback(() => {
    if (editTask) {
      setTitle(editTask.title);
      setDescription(editTask.description ?? "");
      setPriority(editTask.priority);
      setStatus(editTask.status);
      setAssigneeId(editTask.assigneeId || "");
      setDepartmentPath(editTask.departmentPath);
      setStartStr(toInputDate(editTask.startDate));
      setDueStr(toInputDate(editTask.dueDate));
    } else if (user) {
      setTitle("");
      setDescription("");
      setPriority("medium");
      setStatus("todo");
      setAssigneeId(user._id);
      setDepartmentPath(user.departmentPath || "");
      setStartStr("");
      setDueStr("");
    }
    setSteps([]);
    setStepInput("");
    setAiPrompt("");
    setAiWarn(null);
    setUserQuery("");
    setLoadErr(null);
    setSubmitErr(null);
  }, [editTask, user]);

  useEffect(() => {
    if (!isOpen) return;
    resetFromProps();
  }, [isOpen, resetFromProps]);

  useEffect(() => {
    if (!isOpen || !token) return;
    let cancelled = false;
    (async () => {
      try {
        const [uRes, dRes] = await Promise.all([
          fetch("/api/users", { headers: { Authorization: `Bearer ${token}` } }),
          fetch("/api/departments", {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);
        const uJson = (await uRes.json()) as {
          success?: boolean;
          data?: UserRow[];
        };
        const dJson = (await dRes.json()) as {
          success?: boolean;
          data?: DeptRow[];
        };
        if (cancelled) return;
        if (uRes.ok && uJson.success !== false) {
          const loadedUsers = uJson.data ?? [];
          setUsers(loadedUsers);
          // Populate the input with the selected assignee's name once users load
          setAssigneeId((prev) => {
            if (prev) {
              const match = loadedUsers.find((u) => u._id === prev);
              if (match) setUserQuery(match.name);
            }
            return prev;
          });
        }
        if (dRes.ok && dJson.success !== false) {
          setDepartments(dJson.data ?? []);
        }
      } catch {
        if (!cancelled) setLoadErr("Could not load lists");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, token]);

  // When department changes, clear the assignee so an invalid user isn't kept
  useEffect(() => {
    if (!departmentPath) return;
    setAssigneeId((prev) => {
      if (!prev) return prev;
      const selected = users.find((u) => u._id === prev);
      if (!selected) return prev;
      const inDept = selected.departmentPath === departmentPath ||
        selected.departmentPath.startsWith(departmentPath + ".");
      return inDept ? prev : "";
    });
  }, [departmentPath, users]);

  const filteredUsers = useMemo(() => {
    const q = userQuery.trim().toLowerCase();
    // Scope list to selected department (and its sub-departments)
    const deptUsers = departmentPath
      ? users.filter(
          (u) =>
            u.departmentPath === departmentPath ||
            u.departmentPath.startsWith(departmentPath + "."),
        )
      : users;
    if (!q) return deptUsers;
    return deptUsers.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        (u.username && u.username.toLowerCase().includes(q)),
    );
  }, [users, userQuery, departmentPath]);

  type AiResult = {
    title: string;
    description: string | null;
    priority: "low" | "medium" | "high" | "urgent";
    dueDate: string | null;
    assigneeId: string | null;
    steps: string[];
    warnings: string[];
  };

  const applyAiResult = useCallback((result: AiResult) => {
    if (result.title)       setTitle(result.title);
    if (result.description) setDescription(result.description);
    if (result.priority)    setPriority(result.priority);
    if (result.dueDate)     setDueStr(result.dueDate);
    if (result.assigneeId) {
      setAssigneeId(result.assigneeId);
      const matched = users.find((u) => u._id === result.assigneeId);
      if (matched) setUserQuery(matched.name);
    }
    if (result.steps?.length) setSteps(result.steps);
    setAiWarn(result.warnings?.length ? result.warnings.join(" ") : null);
  }, [users]);

  const parseWithAi = useCallback(async () => {
    if (!aiPrompt.trim() || !token) return;
    setAiLoading(true);
    setAiWarn(null);
    try {
      const res = await fetch("/api/tasks/ai-parse", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: aiPrompt.trim(),
          users: users.map((u) => ({
            _id: u._id,
            name: u.name,
            username: u.username,
            role: u.role,
            departmentPath: u.departmentPath,
          })),
          departmentPath,
          today: dayjs().format("YYYY-MM-DD"),
        }),
      });
      const json = (await res.json()) as { success?: boolean; data?: AiResult; error?: string };
      if (!res.ok || json.success === false || !json.data) {
        setAiWarn(json.error ?? "AI parse failed.");
      } else {
        applyAiResult(json.data);
      }
    } catch {
      setAiWarn("AI request failed. Try again.");
    } finally {
      setAiLoading(false);
    }
  }, [aiPrompt, token, users, departmentPath, applyAiResult]);

  // Keep ref in sync so the voice onStop callback always reaches latest setter.
  setAiPromptRef.current = (t: string) => setAiPrompt(t);

  const submit = useCallback(async () => {
    if (!token) return;
    setSubmitErr(null);
    if (!title.trim()) {
      setSubmitErr("Title is required");
      return;
    }
    setSubmitting(true);
    try {
      if (isEdit && editTask) {
        const body: Record<string, unknown> = {
          title: title.trim(),
          description,
          priority,
          status,
          assigneeId: assigneeId || null,
        };
        if (startStr) {
          body.startDate = new Date(startStr + "T12:00:00").toISOString();
        } else {
          body.startDate = null;
        }
        if (dueStr) {
          body.dueDate = new Date(dueStr + "T12:00:00").toISOString();
        } else {
          body.dueDate = null;
        }
        const res = await fetch(`/api/tasks/${editTask._id}`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });
        const json = (await res.json()) as { success?: boolean; error?: string };
        if (!res.ok || json.success === false) {
          throw new Error(json.error || "Save failed");
        }
        onUpdated?.();
        onClose();
        hideMainButton();
        haptic("success");
        return;
      }

      const resolvedDept = departmentPath.trim() || user?.departmentPath || "";
      const body: Record<string, unknown> = {
        title: title.trim(),
        departmentPath: resolvedDept,
        priority,
        description: description || undefined,
        steps: steps.map((t) => ({ title: t })),
      };
      if (assigneeId) body.assigneeId = assigneeId;
      if (startStr) {
        body.startDate = new Date(startStr + "T12:00:00").toISOString();
      }
      if (dueStr) {
        body.dueDate = new Date(dueStr + "T12:00:00").toISOString();
      }

      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as {
        success?: boolean;
        data?: TaskListTask;
        error?: string;
      };
      if (!res.ok || json.success === false || !json.data) {
        throw new Error(json.error || "Create failed");
      }
      onCreated?.(json.data);
      onClose();
      hideMainButton();
      haptic("success");
    } catch (e) {
      setSubmitErr(e instanceof Error ? e.message : "Request failed");
      haptic("error");
    } finally {
      setSubmitting(false);
    }
  }, [
    token,
    user,
    title,
    description,
    priority,
    status,
    assigneeId,
    departmentPath,
    startStr,
    dueStr,
    steps,
    isEdit,
    editTask,
    onCreated,
    onUpdated,
    onClose,
  ]);

  const submitRef = useRefLatest(submit);
  useEffect(() => {
    if (!isOpen) {
      hideMainButton();
      return;
    }
    const label = isEdit ? "Save Task" : "Create Task";
    setMainButton(label, () => {
      void submitRef.current();
    });
    return () => {
      hideMainButton();
    };
  }, [isOpen, isEdit, submitRef]);

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={() => {
        hideMainButton();
        onClose();
      }}
      title={isEdit ? "Edit task" : "New task"}
    >
      <div className="space-y-4 pb-2">
        {loadErr ? (
          <p className="text-xs text-amber-600">{loadErr}</p>
        ) : null}
        {submitErr ? (
          <p className="text-xs text-red-500">{submitErr}</p>
        ) : null}

        <label className="block text-xs font-medium text-[var(--tg-hint)]">
          Title
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="tf-input mt-1 min-h-[44px] px-3 text-sm"
          />
        </label>

        {!isEdit ? (
          <div className="rounded-xl border border-[var(--tg-border)] bg-[var(--tg-secondary-bg)]/60 p-3">
            <p className="text-xs font-medium text-[var(--tg-hint)]">AI Assistant</p>
            <p className="mt-0.5 text-xs text-[var(--tg-hint)]">
              Describe the task — AI fills the form for you.
            </p>
            <div className="mt-2 flex gap-2">
              <textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder={
                  voiceListening
                    ? interimTranscript || "Listening…"
                    : "e.g. Fix login bug, assign to Alex, high priority, due Friday"
                }
                rows={3}
                disabled={aiLoading}
                className="tf-textarea flex-1 px-3 py-2 text-sm disabled:opacity-50"
              />
              {voiceSupported ? (
                <button
                  type="button"
                  onClick={() => (voiceListening ? stopVoice() : startVoice())}
                  disabled={aiLoading}
                  title={voiceListening ? "Stop recording" : "Speak prompt"}
                  className={clsx(
                    "flex h-10 w-10 shrink-0 items-center justify-center self-start rounded-lg border text-base transition",
                    voiceListening
                      ? "border-transparent bg-red-500 text-white"
                      : "border-[var(--tg-border)] bg-[var(--tg-bg)] text-[var(--tg-text)]",
                    aiLoading && "opacity-50",
                  )}
                >
                  {voiceListening ? "⏹" : "🎤"}
                </button>
              ) : null}
            </div>
            {voiceErr ? (
              <p className="mt-1 text-xs text-red-500">{voiceErr}</p>
            ) : null}
            {aiWarn ? (
              <p className="mt-1 text-xs text-amber-600">{aiWarn}</p>
            ) : null}
            <button
              type="button"
              onClick={() => void parseWithAi()}
              disabled={!aiPrompt.trim() || aiLoading || voiceListening}
              className="mt-2 min-h-[42px] w-full rounded-lg border border-transparent bg-[var(--tg-button)] px-3 text-sm font-medium text-[var(--tg-button-text)] disabled:opacity-50"
            >
              {aiLoading ? "Thinking…" : "Parse with AI"}
            </button>
          </div>
        ) : null}

        <div>
          <p className="mb-1 text-xs font-medium text-[var(--tg-hint)]">
            Priority
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PRIORITIES.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={clsx(
                    "min-h-[44px] rounded-lg border px-2 text-sm font-medium capitalize transition",
                    priority === p
                      ? "border-transparent bg-[var(--tg-button)] text-[var(--tg-button-text)] shadow-[var(--shadow-sm)]"
                      : "border-[var(--tg-border)] bg-[var(--tg-secondary-bg)] text-[var(--tg-text)]",
                  )}
                >
                  {p}
              </button>
            ))}
          </div>
        </div>

        {isEdit ? (
          <div>
            <p className="mb-1 text-xs font-medium text-[var(--tg-hint)]">
              Status
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={clsx(
                    "min-h-[44px] rounded-lg border px-1 text-xs font-medium transition",
                    status === s
                      ? "border-transparent bg-[var(--tg-button)] text-[var(--tg-button-text)] shadow-[var(--shadow-sm)]"
                      : "border-[var(--tg-border)] bg-[var(--tg-secondary-bg)] text-[var(--tg-text)]",
                  )}
                >
                  {s.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {!isEdit ? (
          <label className="block text-xs font-medium text-[var(--tg-hint)]">
            Department
            <select
              value={departmentPath}
              onChange={(e) => {
                setDepartmentPath(e.target.value);
                setAssigneeId("");
                setUserQuery("");
              }}
              className="tf-select mt-1 min-h-[44px] px-2 text-sm"
            >
              <option value="">Select department</option>
              {departments.map((d) => (
                <option key={d._id} value={d.path}>
                  {d.name} ({d.path})
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="text-xs text-[var(--tg-hint)]">
            Department:{" "}
            <span className="text-[var(--tg-text)]">
              {editTask?.departmentPath}
            </span>
          </p>
        )}

        <div>
          <p className="mb-1 text-xs font-medium text-[var(--tg-hint)]">
            Assignee
          </p>

          {/* Search / selected-name input */}
          {(() => {
            const selectedUser = users.find((u) => u._id === assigneeId);
            const isSearching =
              departmentPath &&
              (!assigneeId || userQuery !== (selectedUser?.name ?? ""));
            return (
              <>
                <input
                  value={userQuery}
                  onChange={(e) => {
                    setUserQuery(e.target.value);
                    if (assigneeId) setAssigneeId("");
                  }}
                  placeholder={
                    !departmentPath
                      ? "Select a department first"
                      : `Search in ${departmentPath}…`
                  }
                  disabled={!departmentPath}
                  className="tf-input mb-2 min-h-[44px] px-3 text-sm disabled:opacity-50"
                />

                {/* Dropdown — visible while actively searching */}
                {isSearching ? (
                  <div
                    className="max-h-44 touch-pan-y overflow-y-auto overscroll-contain rounded-lg border border-[var(--tg-border)] bg-[var(--tg-bg)]"
                  >
                    {filteredUsers.length === 0 ? (
                      <p className="px-3 py-3 text-sm text-[var(--tg-hint)]">
                        No users found
                      </p>
                    ) : (
                      filteredUsers.map((u) => (
                        <button
                          key={u._id}
                          type="button"
                          onPointerDown={(e) => {
                            // stop only if not a scroll gesture (minimal movement)
                            e.stopPropagation();
                          }}
                          onClick={() => {
                            setAssigneeId(u._id);
                            setUserQuery(u.name);
                            haptic("light");
                          }}
                          className="flex w-full min-h-[44px] items-center px-3 py-2 text-left text-sm active:bg-[var(--tg-secondary-bg)]"
                        >
                          {u.name}
                          {u.username ? (
                            <span className="ml-2 text-xs text-[var(--tg-hint)]">
                              @{u.username}
                            </span>
                          ) : null}
                        </button>
                      ))
                    )}
                  </div>
                ) : null}
              </>
            );
          })()}
        </div>

        <label className="block text-xs font-medium text-[var(--tg-hint)]">
          Start date
          <input
            type="date"
            value={startStr}
            onChange={(e) => setStartStr(e.target.value)}
            className="tf-input mt-1 min-h-[44px] px-2 text-sm"
          />
        </label>

        <label className="block text-xs font-medium text-[var(--tg-hint)]">
          End date
          <input
            type="date"
            value={dueStr}
            onChange={(e) => setDueStr(e.target.value)}
            className="tf-input mt-1 min-h-[44px] px-2 text-sm"
          />
        </label>

        <label className="block text-xs font-medium text-[var(--tg-hint)]">
          Description
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="tf-textarea mt-1 px-3 py-2 text-sm"
          />
        </label>

        {!isEdit ? (
          <div>
            <p className="mb-1 text-xs font-medium text-[var(--tg-hint)]">Steps</p>
            <div className="flex gap-2">
              <input
                value={stepInput}
                onChange={(e) => setStepInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const t = stepInput.trim();
                    if (t) {
                      setSteps((prev) => [...prev, t]);
                      setStepInput("");
                    }
                  }
                }}
                placeholder="Step title…"
                className="tf-input min-h-[44px] flex-1 px-3 text-sm"
              />
              <button
                type="button"
                onClick={() => {
                  const t = stepInput.trim();
                  if (!t) return;
                  setSteps((prev) => [...prev, t]);
                  setStepInput("");
                }}
                className="min-h-[44px] rounded-lg border border-[var(--tg-border)] bg-[var(--tg-bg)] px-3 text-sm font-medium text-[var(--tg-text)]"
              >
                Add
              </button>
            </div>
            {steps.length > 0 ? (
              <ul className="mt-2 space-y-1">
                {steps.map((s, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-2 rounded-lg border border-[var(--tg-border)] bg-[var(--tg-secondary-bg)] px-3 py-2 text-sm"
                  >
                    <span className="flex-1 text-[var(--tg-text)]">{s}</span>
                    <button
                      type="button"
                      onClick={() => setSteps((prev) => prev.filter((_, j) => j !== i))}
                      className="text-xs text-[var(--tg-hint)] hover:text-red-500"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => void submit()}
          disabled={submitting}
          className="tf-btn-primary flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold disabled:opacity-50"
        >
          {submitting ? "Saving…" : isEdit ? "Save task" : "Create task"}
        </button>
      </div>
    </BottomSheet>
  );
}
