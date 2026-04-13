import { Types } from "mongoose";
import Task from "@/models/Task";
import User from "@/models/User";
import Comment from "@/models/Comment";
import ActivityLog from "@/models/ActivityLog";
import { apiError, apiResponse, withAuth } from "@/lib/api-helpers";
import { sendTaskAssignedMessage, sendStatusChangedMessage } from "@/lib/telegram";
import {
  canAccessDepartment,
  canModifyTask,
  canViewTask,
} from "@/lib/rbac";
import { leanToITask } from "@/lib/task-serialize";

const STATUSES = new Set([
  "todo",
  "in_progress",
  "review",
  "done",
]);
const PRIORITIES = new Set(["low", "medium", "high", "urgent"]);

function formatUserPop(
  u: unknown,
): { _id: string; name?: string; username?: string; avatarUrl?: string } | null {
  if (!u || typeof u !== "object") return null;
  const o = u as {
    _id: unknown;
    name?: string;
    username?: string;
    avatarUrl?: string;
  };
  return {
    _id: String(o._id),
    name: o.name,
    username: o.username,
    avatarUrl: o.avatarUrl,
  };
}

function serializeTaskDetail(task: Record<string, unknown>) {
  const assigneeId = task.assigneeId;
  const assignedById = task.assignedById;

  const assignee = formatUserPop(assigneeId);
  const assignedBy = formatUserPop(assignedById);

  const base = {
    ...task,
    _id: String(task._id),
    assigneeId: assignee ? assignee._id : task.assigneeId ? String(task.assigneeId) : undefined,
    assignedById: assignedBy
      ? assignedBy._id
      : String(task.assignedById),
    assignee,
    assignedBy,
    steps: ((task.steps as unknown[]) ?? []).map((s) => {
      const step = s as {
        _id: unknown;
        title: string;
        done: boolean;
        assigneeId?: unknown;
      };
      return {
        _id: String(step._id),
        title: step.title,
        done: step.done,
        assigneeId: step.assigneeId ? String(step.assigneeId) : undefined,
      };
    }),
  };

  return base;
}

export const GET = withAuth(async (req, user, ctx) => {
  const raw = ctx.params?.id;
  const id = Array.isArray(raw) ? raw[0] : raw;
  if (!id || !Types.ObjectId.isValid(id)) {
    return apiError("Invalid task id", 400);
  }

  const plain = await Task.findById(id).lean();
  if (!plain) {
    return apiError("Task not found", 404);
  }

  const iTask = leanToITask(plain as Parameters<typeof leanToITask>[0]);
  if (!canViewTask(user, iTask)) {
    return apiError("Forbidden", 403);
  }

  const doc = await Task.findById(id)
    .populate("assigneeId", "name username avatarUrl")
    .populate("assignedById", "name username avatarUrl")
    .lean();

  if (!doc) {
    return apiError("Task not found", 404);
  }

  return apiResponse(serializeTaskDetail(doc as Record<string, unknown>));
});

export const PATCH = withAuth(async (req, user, ctx) => {
  const raw = ctx.params?.id;
  const id = Array.isArray(raw) ? raw[0] : raw;
  if (!id || !Types.ObjectId.isValid(id)) {
    return apiError("Invalid task id", 400);
  }

  const prev = await Task.findById(id).lean();
  if (!prev) {
    return apiError("Task not found", 404);
  }

  const iPrev = leanToITask(prev as Parameters<typeof leanToITask>[0]);
  if (!canModifyTask(user, iPrev)) {
    return apiError("Forbidden", 403);
  }

  const body = (await req.json()) as Record<string, unknown>;

  const $set: Record<string, unknown> = {};

  if (body.title !== undefined) {
    if (typeof body.title !== "string" || !body.title.trim()) {
      return apiError("Invalid title", 400);
    }
    $set.title = body.title.trim();
  }
  if (body.description !== undefined) {
    $set.description =
      body.description === null || body.description === ""
        ? undefined
        : String(body.description);
  }
  if (body.status !== undefined) {
    if (typeof body.status !== "string" || !STATUSES.has(body.status)) {
      return apiError("Invalid status", 400);
    }
    $set.status = body.status;
  }
  if (body.priority !== undefined) {
    if (typeof body.priority !== "string" || !PRIORITIES.has(body.priority)) {
      return apiError("Invalid priority", 400);
    }
    $set.priority = body.priority;
  }
  if (body.dueDate !== undefined) {
    if (body.dueDate === null || body.dueDate === "") {
      $set.dueDate = null;
    } else {
      const d = new Date(String(body.dueDate));
      if (Number.isNaN(d.getTime())) {
        return apiError("Invalid dueDate", 400);
      }
      $set.dueDate = d;
    }
  }
  if (body.assigneeId !== undefined) {
    if (body.assigneeId === null || body.assigneeId === "") {
      $set.assigneeId = null;
    } else if (
      typeof body.assigneeId === "string" &&
      Types.ObjectId.isValid(body.assigneeId)
    ) {
      $set.assigneeId = new Types.ObjectId(body.assigneeId);
    } else {
      return apiError("Invalid assigneeId", 400);
    }
  }
  if (body.tags !== undefined) {
    if (!Array.isArray(body.tags) || !body.tags.every((t) => typeof t === "string")) {
      return apiError("tags must be an array of strings", 400);
    }
    $set.tags = body.tags;
  }

  if (Object.keys($set).length === 0) {
    return apiError("No fields to update", 400);
  }

  const updated = await Task.findByIdAndUpdate(
    id,
    { $set },
    { new: true, runValidators: true },
  )
    .populate("assigneeId", "name username avatarUrl")
    .populate("assignedById", "name username avatarUrl")
    .lean();

  if (!updated) {
    return apiError("Task not found", 404);
  }

  const uid = new Types.ObjectId(user._id);

  if (
    typeof body.status === "string" &&
    body.status !== prev.status
  ) {
    await ActivityLog.create({
      taskId: new Types.ObjectId(id),
      userId: uid,
      action: "status_changed",
      meta: { from: prev.status, to: body.status },
    });

    // Notify creator — skip if they're the one updating
    const creatorId = String(prev.assignedById);
    if (creatorId && creatorId !== user._id) {
      const creator = await User.findById(creatorId).select("telegramId").lean() as { telegramId?: number } | null;
      if (creator?.telegramId) {
        void sendStatusChangedMessage({
          creatorTelegramId: creator.telegramId,
          taskId: id,
          taskTitle: String(updated?.title ?? prev.title),
          updatedByName: user.name,
          from: prev.status,
          to: body.status,
        });
      }
    }
  }

  const prevAssignee = prev.assigneeId ? String(prev.assigneeId) : "";
  const nextAssignee =
    $set.assigneeId !== undefined
      ? $set.assigneeId === null
        ? ""
        : String($set.assigneeId)
      : prevAssignee;

  if ($set.assigneeId !== undefined && nextAssignee !== prevAssignee) {
    await ActivityLog.create({
      taskId: new Types.ObjectId(id),
      userId: uid,
      action: "reassigned",
      meta: {
        from: prevAssignee || null,
        to: nextAssignee || null,
      },
    });

    // Notify new assignee via Telegram (fire-and-forget)
    if (nextAssignee) {
      const assigneeUser = await User.findById(nextAssignee).select("telegramId").lean() as { telegramId?: number } | null;
      if (assigneeUser?.telegramId) {
        void sendTaskAssignedMessage({
          assigneeTelegramId: assigneeUser.telegramId,
          taskId: id,
          taskTitle: String(updated.title ?? ""),
          assignedByName: user.name,
          dueDate: updated.dueDate as Date | null,
        });
      }
    }
  }

  return apiResponse(
    serializeTaskDetail(updated as Record<string, unknown>),
  );
});

export const DELETE = withAuth(async (req, user, ctx) => {
  if (user.role !== "admin" && user.role !== "manager") {
    return apiError("Forbidden", 403);
  }

  const raw = ctx.params?.id;
  const id = Array.isArray(raw) ? raw[0] : raw;
  if (!id || !Types.ObjectId.isValid(id)) {
    return apiError("Invalid task id", 400);
  }

  const task = await Task.findById(id).lean();
  if (!task) {
    return apiError("Task not found", 404);
  }

  const iTask = leanToITask(task as Parameters<typeof leanToITask>[0]);
  if (
    !canAccessDepartment(
      user.departmentPath,
      iTask.departmentPath,
      user.role,
    )
  ) {
    return apiError("Forbidden", 403);
  }

  const oid = new Types.ObjectId(id);

  await Comment.deleteMany({ taskId: oid });
  await ActivityLog.deleteMany({ taskId: oid });
  await Task.findByIdAndDelete(id);

  return apiResponse({ deleted: true });
});
