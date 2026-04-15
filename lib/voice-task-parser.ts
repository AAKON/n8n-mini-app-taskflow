import type { TaskPriority } from "@/types";
import { escapeRegex } from "@/lib/path-utils";

export type VoiceParseResult = {
  title: string;
  description: string;
  priority?: TaskPriority;
  dueDate?: Date;
  assigneeHint?: string;
  warnings: string[];
};

export type VoiceResolvableUser = {
  _id: string;
  name: string;
  username?: string;
  departmentPath: string;
};

export type VoiceAssigneeResolution = {
  user?: VoiceResolvableUser;
  warning?: string;
};

function normalizeSpaces(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function stripFirst(text: string, fragment: string): string {
  if (!fragment.trim()) return text;
  return normalizeSpaces(text.replace(new RegExp(escapeRegex(fragment), "i"), " "));
}

const PRIORITY_RULES: Array<{ priority: TaskPriority; regex: RegExp }> = [
  { priority: "urgent", regex: /\b(urgent|critical|asap|immediately)\b/i },
  { priority: "high", regex: /\b(high priority|high)\b/i },
  { priority: "medium", regex: /\b(medium priority|normal priority|medium)\b/i },
  { priority: "low", regex: /\b(low priority|low)\b/i },
];

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function nextWeekday(base: Date, weekday: number): Date {
  const d = new Date(base);
  const delta = (weekday - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + delta);
  return d;
}

function parseDueDate(text: string, now: Date): {
  dueDate?: Date;
  consumedText?: string;
} {
  const lowered = text.toLowerCase();
  if (/\b(today)\b/.test(lowered)) {
    return { dueDate: new Date(now), consumedText: "today" };
  }
  if (/\b(tomorrow)\b/.test(lowered)) {
    return { dueDate: addDays(now, 1), consumedText: "tomorrow" };
  }
  if (/\b(next week)\b/.test(lowered)) {
    return { dueDate: addDays(now, 7), consumedText: "next week" };
  }

  const weekdays: Array<{ key: string; day: number }> = [
    { key: "sunday", day: 0 },
    { key: "monday", day: 1 },
    { key: "tuesday", day: 2 },
    { key: "wednesday", day: 3 },
    { key: "thursday", day: 4 },
    { key: "friday", day: 5 },
    { key: "saturday", day: 6 },
  ];
  for (const w of weekdays) {
    const byMatch = text.match(
      new RegExp(`\\b(?:by|on|due)\\s+(next\\s+)?${w.key}\\b`, "i"),
    );
    if (byMatch) {
      const base = byMatch[1] ? addDays(now, 7) : now;
      return { dueDate: nextWeekday(base, w.day), consumedText: byMatch[0] };
    }
    const plainMatch = text.match(new RegExp(`\\b${w.key}\\b`, "i"));
    if (plainMatch) {
      return { dueDate: nextWeekday(now, w.day), consumedText: plainMatch[0] };
    }
  }

  const dateLike = text.match(
    /\b(?:by|on|due)\s+(\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?|\d{4}[/-]\d{1,2}[/-]\d{1,2})\b/i,
  );
  if (dateLike?.[1]) {
    const parsed = new Date(dateLike[1]);
    if (!Number.isNaN(parsed.getTime())) {
      return { dueDate: parsed, consumedText: dateLike[0] };
    }
  }

  return {};
}

export function parseVoiceTaskTranscript(
  transcript: string,
  now = new Date(),
): VoiceParseResult {
  const warnings: string[] = [];
  let working = normalizeSpaces(transcript);

  working = working.replace(
    /^(please\s+)?(create|add|make)\s+(a\s+)?task(\s+to)?\s*/i,
    "",
  );

  let priority: TaskPriority | undefined;
  for (const rule of PRIORITY_RULES) {
    const match = working.match(rule.regex);
    if (!match) continue;
    priority = rule.priority;
    working = stripFirst(working, match[0]);
    break;
  }

  const dueParsed = parseDueDate(working, now);
  const dueDate = dueParsed.dueDate;
  if (dueParsed.consumedText) {
    working = stripFirst(working, dueParsed.consumedText);
  }

  let assigneeHint: string | undefined;
  const assigneeMatch =
    working.match(
      /\bassign(?:\s+this)?(?:\s+task)?\s+to\s+(@?[a-z0-9._-]+(?:\s+[a-z0-9._-]+){0,2})\b/i,
    ) ??
    working.match(
      /\b(?:assignee|owner)\s+(?:is|to)?\s*(@?[a-z0-9._-]+(?:\s+[a-z0-9._-]+){0,2})\b/i,
    ) ??
    working.match(/(@[a-z0-9._-]+)/i);
  if (assigneeMatch?.[1]) {
    assigneeHint = normalizeSpaces(assigneeMatch[1]);
    working = stripFirst(working, assigneeMatch[0]);
  }

  let description = "";
  const descMatch = working.match(/\b(?:description|details?)\s*[:\-]\s*(.+)$/i);
  if (descMatch?.[1]) {
    description = normalizeSpaces(descMatch[1]);
    working = working.slice(0, descMatch.index).trim();
  }

  working = normalizeSpaces(working.replace(/\b(for|by|on|about)\b$/i, ""));
  let title = normalizeSpaces(working);

  if (!title && description) {
    title = description.slice(0, 80).trim();
    warnings.push("Title inferred from description.");
  }
  if (!title) {
    warnings.push("Could not detect a clear title from voice input.");
  }

  return {
    title,
    description,
    priority,
    dueDate,
    assigneeHint,
    warnings,
  };
}

export function resolveVoiceAssignee(params: {
  assigneeHint: string;
  users: VoiceResolvableUser[];
  departmentPath: string;
}): VoiceAssigneeResolution {
  const hint = normalizeSpaces(params.assigneeHint);
  if (!hint) return {};
  if (!params.departmentPath) {
    return {
      warning: "Select a department first so assignee matching can work.",
    };
  }

  const scopedUsers = params.users.filter(
    (u) =>
      u.departmentPath === params.departmentPath ||
      u.departmentPath.startsWith(`${params.departmentPath}.`),
  );
  if (scopedUsers.length === 0) {
    return { warning: "No users found in the selected department." };
  }

  const loweredHint = hint.toLowerCase();
  const usernameHint = loweredHint.startsWith("@")
    ? loweredHint.slice(1)
    : loweredHint;
  const normalizedHint = normalizeToken(hint);
  const hintWords = loweredHint.replace(/^@/, "").split(/\s+/).filter(Boolean);

  const usernameExact = scopedUsers.filter(
    (u) => u.username && u.username.toLowerCase() === usernameHint,
  );
  if (usernameExact.length === 1) return { user: usernameExact[0] };
  if (usernameExact.length > 1) {
    return { warning: `Multiple assignees matched "${hint}".` };
  }

  const nameExact = scopedUsers.filter(
    (u) => normalizeToken(u.name) === normalizedHint,
  );
  if (nameExact.length === 1) return { user: nameExact[0] };
  if (nameExact.length > 1) {
    return { warning: `Multiple assignees matched "${hint}".` };
  }

  const partial = scopedUsers.filter((u) => {
    const nameLower = u.name.toLowerCase();
    return hintWords.every((w) => nameLower.includes(w));
  });
  if (partial.length === 1) return { user: partial[0] };
  if (partial.length > 1) {
    return { warning: `Assignee "${hint}" is ambiguous. Be more specific.` };
  }

  return { warning: `No assignee matched "${hint}" in this department.` };
}

