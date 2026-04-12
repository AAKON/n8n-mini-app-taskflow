import { Types } from "mongoose";
import Task from "@/models/Task";
import Comment from "@/models/Comment";
import ActivityLog from "@/models/ActivityLog";
import { apiError, apiResponse, withAuth } from "@/lib/api-helpers";
import { canViewTask } from "@/lib/rbac";
import { leanToITask } from "@/lib/task-serialize";

export const GET = withAuth(async (req, user, ctx) => {
  const raw = ctx.params?.id;
  const taskId = Array.isArray(raw) ? raw[0] : raw;
  if (!taskId || !Types.ObjectId.isValid(taskId)) {
    return apiError("Invalid task id", 400);
  }

  const task = await Task.findById(taskId).lean();
  if (!task) {
    return apiError("Task not found", 404);
  }

  if (!canViewTask(user, leanToITask(task as Parameters<typeof leanToITask>[0]))) {
    return apiError("Forbidden", 403);
  }

  const comments = await Comment.find({ taskId: new Types.ObjectId(taskId) })
    .sort({ createdAt: 1 })
    .populate("userId", "name username avatarUrl")
    .lean();

  const data = comments.map((c) => {
    const u = c.userId as unknown;
    const author = u && typeof u === "object"
      ? (u as {
          _id: unknown;
          name?: string;
          username?: string;
          avatarUrl?: string;
        })
      : null;

    return {
      _id: String(c._id),
      taskId: String(c.taskId),
      text: c.text,
      createdAt: c.createdAt,
      user: author
        ? {
            _id: String(author._id),
            name: author.name,
            username: author.username,
            avatarUrl: author.avatarUrl,
          }
        : null,
    };
  });

  return apiResponse(data);
});

export const POST = withAuth(async (req, user, ctx) => {
  const raw = ctx.params?.id;
  const taskId = Array.isArray(raw) ? raw[0] : raw;
  if (!taskId || !Types.ObjectId.isValid(taskId)) {
    return apiError("Invalid task id", 400);
  }

  const task = await Task.findById(taskId).lean();
  if (!task) {
    return apiError("Task not found", 404);
  }

  if (!canViewTask(user, leanToITask(task as Parameters<typeof leanToITask>[0]))) {
    return apiError("Forbidden", 403);
  }

  const body = (await req.json()) as { text?: unknown };
  if (typeof body.text !== "string" || !body.text.trim()) {
    return apiError("text is required", 400);
  }

  const oid = new Types.ObjectId(taskId);
  const uid = new Types.ObjectId(user._id);

  const created = await Comment.create({
    taskId: oid,
    userId: uid,
    text: body.text.trim(),
  });

  await ActivityLog.create({
    taskId: oid,
    userId: uid,
    action: "commented",
    meta: { commentId: String(created._id) },
  });

  const populated = await Comment.findById(created._id)
    .populate("userId", "name username avatarUrl")
    .lean();

  if (!populated) {
    return apiError("Failed to load comment", 500);
  }

  const u = populated.userId as unknown;
  const author = u && typeof u === "object"
    ? (u as {
        _id: unknown;
        name?: string;
        username?: string;
        avatarUrl?: string;
      })
    : null;

  return apiResponse(
    {
      _id: String(populated._id),
      taskId: String(populated.taskId),
      text: populated.text,
      createdAt: populated.createdAt,
      user: author
        ? {
            _id: String(author._id),
            name: author.name,
            username: author.username,
            avatarUrl: author.avatarUrl,
          }
        : null,
    },
    201,
  );
});
