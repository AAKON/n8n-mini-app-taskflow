import { Types } from "mongoose";
import Task from "@/models/Task";
import User from "@/models/User";
import ActivityLog from "@/models/ActivityLog";
import {
  apiError,
  apiPaginatedResponse,
  apiResponse,
  withAuth,
} from "@/lib/api-helpers";
import { hasRole } from "@/lib/rbac";
import { buildTaskListFilter, type DueFilter } from "@/lib/task-filters";
import { sendTaskAssignedMessage } from "@/lib/telegram";

const STATUSES = new Set([
  "todo",
  "in_progress",
  "review",
  "done",
]);
const PRIORITIES = new Set(["low", "medium", "high", "urgent"]);

function parsePositiveInt(v: string | null, fallback: number) {
  if (v === null || v === "") return fallback;
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return n;
}

function serializeTaskLean(t: {
  _id: unknown;
  title: string;
  description?: string;
  status: string;
  priority: string;
  assigneeId?: unknown;
  assignedById: unknown;
  departmentPath: string;
  startDate?: Date;
  dueDate?: Date;
  estimatedHours?: number;
  steps?: unknown[];
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...t,
    _id: String(t._id),
    assigneeId: t.assigneeId ? String(t.assigneeId) : undefined,
    assignedById: String(t.assignedById),
    steps: (t.steps ?? []).map((s: unknown) => {
      const step = s as {
        _id: unknown;
        title: string;
        done: boolean;
        assigneeId?: unknown;
      };
      return {
        ...step,
        _id: String(step._id),
        assigneeId: step.assigneeId ? String(step.assigneeId) : undefined,
      };
    }),
  };
}

function serializeListTask(row: Record<string, unknown>) {
  const assigneeUser = row.assigneeUser as
    | {
        _id?: unknown;
        name?: string;
        username?: string;
        avatarUrl?: string;
      }
    | undefined;
  const rest = { ...row };
  delete rest.assigneeUser;
  const base = serializeTaskLean(
    rest as Parameters<typeof serializeTaskLean>[0],
  ) as Record<string, unknown>;
  if (assigneeUser && assigneeUser._id) {
    base.assignee = {
      _id: String(assigneeUser._id),
      name: assigneeUser.name ?? "?",
      username: assigneeUser.username,
      avatarUrl: assigneeUser.avatarUrl,
    };
  }
  return base;
}

export const GET = withAuth(async (req, user) => {
  const url = new URL(req.url);

  if (url.searchParams.get("summary") === "1") {
    if (user.role !== "admin") {
      return apiError("Forbidden", 403);
    }

    const filter = buildTaskListFilter(user, {});
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [agg] = await Task.aggregate<{
      total: { c: number }[];
      byStatus: { _id: string; n: number }[];
      overdue: { c: number }[];
    }>([
      { $match: filter },
      {
        $facet: {
          total: [{ $count: "c" }],
          byStatus: [{ $group: { _id: "$status", n: { $sum: 1 } } }],
          overdue: [
            {
              $match: {
                status: { $ne: "done" },
                dueDate: { $exists: true, $ne: null, $lt: startOfDay },
              },
            },
            { $count: "c" },
          ],
        },
      },
    ]);

    const total = agg?.total[0]?.c ?? 0;
    const overdue = agg?.overdue[0]?.c ?? 0;
    const activeMembers = await User.countDocuments();

    const byStatus: Record<string, number> = {
      todo: 0,
      in_progress: 0,
      review: 0,
      done: 0,
    };
    for (const row of agg?.byStatus ?? []) {
      if (row._id && typeof row.n === "number") {
        byStatus[row._id] = row.n;
      }
    }

    return apiResponse({
      total,
      byStatus,
      overdue,
      activeMembers,
    });
  }

  const status = url.searchParams.get("status");
  const priority = url.searchParams.get("priority");
  const assigneeId = url.searchParams.get("assigneeId");
  const excludeAssigneeId = url.searchParams.get("excludeAssigneeId");
  const departmentPath = url.searchParams.get("departmentPath");
  const dueFilterRaw = url.searchParams.get("dueFilter");
  const q = url.searchParams.get("q");
  const DUE_FILTERS = new Set(["overdue", "today", "week"]);
  const dueFilter: DueFilter = DUE_FILTERS.has(dueFilterRaw ?? "") ? (dueFilterRaw as DueFilter) : null;

  if (status !== null && status !== "" && !STATUSES.has(status)) {
    return apiError("Invalid status", 400);
  }
  if (
    priority !== null &&
    priority !== "" &&
    !PRIORITIES.has(priority)
  ) {
    return apiError("Invalid priority", 400);
  }
  if (assigneeId !== null && assigneeId !== "" && !Types.ObjectId.isValid(assigneeId)) {
    return apiError("Invalid assigneeId", 400);
  }
  if (
    excludeAssigneeId !== null &&
    excludeAssigneeId !== "" &&
    !Types.ObjectId.isValid(excludeAssigneeId)
  ) {
    return apiError("Invalid excludeAssigneeId", 400);
  }

  const page = parsePositiveInt(url.searchParams.get("page"), 1);
  const limit = Math.min(
    parsePositiveInt(url.searchParams.get("limit"), 20),
    100,
  );
  const skip = (page - 1) * limit;

  const filter = buildTaskListFilter(user, {
    status: status || null,
    priority: priority || null,
    assigneeId: assigneeId || null,
    excludeAssigneeId: excludeAssigneeId || null,
    departmentPath,
    dueFilter,
    q,
  });

  const farFuture = new Date(8640000000000000);

  const [agg] = await Task.aggregate<{
    meta: { total: number }[];
    data: Record<string, unknown>[];
  }>([
    { $match: filter },
    {
      $lookup: {
        from: "users",
        localField: "assigneeId",
        foreignField: "_id",
        as: "_assigneeArr",
      },
    },
    {
      $addFields: {
        assigneeUser: { $arrayElemAt: ["$_assigneeArr", 0] },
      },
    },
    { $project: { _assigneeArr: 0 } },
    {
      $addFields: {
        _sortDue: { $ifNull: ["$dueDate", farFuture] },
      },
    },
    { $sort: { _sortDue: 1, createdAt: -1 } },
    {
      $facet: {
        meta: [{ $count: "total" }],
        data: [{ $skip: skip }, { $limit: limit }],
      },
    },
  ]);

  const total = agg.meta[0]?.total ?? 0;
  const rows = agg.data ?? [];
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

  const data = rows.map((row) => serializeListTask(row));

  return apiPaginatedResponse(data, {
    page,
    limit,
    total,
    totalPages,
  });
});

export const POST = withAuth(async (req, user) => {
  if (!hasRole(user.role, "manager")) {
    return apiError("Forbidden", 403);
  }

  const body = (await req.json()) as {
    title?: unknown;
    description?: unknown;
    priority?: unknown;
    assigneeId?: unknown;
    departmentPath?: unknown;
    startDate?: unknown;
    dueDate?: unknown;
    estimatedHours?: unknown;
    tags?: unknown;
    steps?: unknown;
  };

  if (typeof body.title !== "string" || !body.title.trim()) {
    return apiError("title is required", 400);
  }
  if (typeof body.departmentPath !== "string" || !body.departmentPath.trim()) {
    return apiError("departmentPath is required", 400);
  }

  let priority = "medium";
  if (body.priority !== undefined) {
    if (
      typeof body.priority !== "string" ||
      !PRIORITIES.has(body.priority)
    ) {
      return apiError("Invalid priority", 400);
    }
    priority = body.priority;
  }

  let assignee: Types.ObjectId | undefined;
  if (body.assigneeId !== undefined && body.assigneeId !== null && body.assigneeId !== "") {
    if (typeof body.assigneeId !== "string" || !Types.ObjectId.isValid(body.assigneeId)) {
      return apiError("Invalid assigneeId", 400);
    }
    assignee = new Types.ObjectId(body.assigneeId);
  }

  let startDate: Date | undefined;
  if (body.startDate !== undefined && body.startDate !== null && body.startDate !== "") {
    const d = new Date(body.startDate as string);
    if (Number.isNaN(d.getTime())) {
      return apiError("Invalid startDate", 400);
    }
    startDate = d;
  }

  let dueDate: Date | undefined;
  if (body.dueDate !== undefined && body.dueDate !== null && body.dueDate !== "") {
    const d = new Date(body.dueDate as string);
    if (Number.isNaN(d.getTime())) {
      return apiError("Invalid dueDate", 400);
    }
    dueDate = d;
  }

  let estimatedHours: number | undefined;
  if (body.estimatedHours !== undefined && body.estimatedHours !== null) {
    const n = Number(body.estimatedHours);
    if (!Number.isFinite(n)) {
      return apiError("Invalid estimatedHours", 400);
    }
    estimatedHours = n;
  }

  let tags: string[] = [];
  if (body.tags !== undefined) {
    if (!Array.isArray(body.tags) || !body.tags.every((t) => typeof t === "string")) {
      return apiError("tags must be an array of strings", 400);
    }
    tags = body.tags;
  }

  let steps: { title: string }[] = [];
  if (body.steps !== undefined) {
    if (
      !Array.isArray(body.steps) ||
      !body.steps.every((s) => typeof s === "object" && s !== null && typeof (s as Record<string, unknown>).title === "string" && ((s as Record<string, unknown>).title as string).trim())
    ) {
      return apiError("steps must be an array of objects with a title string", 400);
    }
    steps = (body.steps as { title: string }[]).map((s) => ({ title: s.title.trim() }));
  }

  const description =
    typeof body.description === "string" ? body.description : undefined;

  const task = await Task.create({
    title: body.title.trim(),
    description,
    priority,
    assigneeId: assignee,
    assignedById: new Types.ObjectId(user._id),
    departmentPath: body.departmentPath.trim(),
    startDate,
    dueDate,
    estimatedHours,
    tags,
    steps,
  });

  await ActivityLog.create({
    taskId: task._id,
    userId: new Types.ObjectId(user._id),
    action: "created",
    meta: {},
  });

  // Notify assignee via Telegram (fire-and-forget)
  if (assignee) {
    const assigneeUser = await User.findById(assignee).select("telegramId").lean() as { telegramId?: number } | null;
    if (assigneeUser?.telegramId) {
      void sendTaskAssignedMessage({
        assigneeTelegramId: assigneeUser.telegramId,
        taskId: String(task._id),
        taskTitle: task.title,
        assignedByName: user.name,
        dueDate: dueDate,
      });
    }
  }

  const created = await Task.findById(task._id).lean();
  if (!created) {
    return apiError("Failed to load task", 500);
  }

  return apiResponse(
    serializeTaskLean(created as Parameters<typeof serializeTaskLean>[0]),
    201,
  );
});
