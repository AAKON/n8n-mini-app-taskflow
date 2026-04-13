import { Types } from "mongoose";
import Task from "@/models/Task";
import { apiError, apiResponse, withAuth } from "@/lib/api-helpers";
import { canModifyTask } from "@/lib/rbac";
import { leanToITask } from "@/lib/task-serialize";

export const DELETE = withAuth(async (req, user, ctx) => {
  const raw = ctx.params?.id;
  const taskId = Array.isArray(raw) ? raw[0] : raw;
  if (!taskId || !Types.ObjectId.isValid(taskId)) {
    return apiError("Invalid task id", 400);
  }

  const task = await Task.findById(taskId).lean();
  if (!task) return apiError("Task not found", 404);

  if (!canModifyTask(user, leanToITask(task as Parameters<typeof leanToITask>[0]))) {
    return apiError("Forbidden", 403);
  }

  const body = (await req.json()) as { stepId?: unknown };
  if (typeof body.stepId !== "string" || !Types.ObjectId.isValid(body.stepId)) {
    return apiError("stepId is required", 400);
  }

  const updated = await Task.findByIdAndUpdate(
    taskId,
    { $pull: { steps: { _id: new Types.ObjectId(body.stepId) } } },
    { new: true },
  ).lean();

  if (!updated) return apiError("Task not found", 404);

  return apiResponse(serializeSteps(updated.steps ?? []));
});

function serializeSteps(
  steps: {
    _id: unknown;
    title: string;
    done: boolean;
    assigneeId?: unknown;
  }[],
) {
  return steps.map((s) => ({
    _id: String(s._id),
    title: s.title,
    done: s.done,
    assigneeId: s.assigneeId ? String(s.assigneeId) : undefined,
  }));
}

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

  if (!canModifyTask(user, leanToITask(task as Parameters<typeof leanToITask>[0]))) {
    return apiError("Forbidden", 403);
  }

  const body = (await req.json()) as {
    title?: unknown;
    assigneeId?: unknown;
  };

  if (typeof body.title !== "string" || !body.title.trim()) {
    return apiError("title is required", 400);
  }

  const step: {
    title: string;
    assigneeId?: Types.ObjectId;
  } = { title: body.title.trim() };

  if (body.assigneeId !== undefined && body.assigneeId !== null && body.assigneeId !== "") {
    if (typeof body.assigneeId !== "string" || !Types.ObjectId.isValid(body.assigneeId)) {
      return apiError("Invalid assigneeId", 400);
    }
    step.assigneeId = new Types.ObjectId(body.assigneeId);
  }

  const updated = await Task.findByIdAndUpdate(
    taskId,
    { $push: { steps: step } },
    { new: true, runValidators: true },
  ).lean();

  if (!updated) {
    return apiError("Task not found", 404);
  }

  return apiResponse(serializeSteps(updated.steps ?? []));
});

export const PATCH = withAuth(async (req, user, ctx) => {
  const raw = ctx.params?.id;
  const taskId = Array.isArray(raw) ? raw[0] : raw;
  if (!taskId || !Types.ObjectId.isValid(taskId)) {
    return apiError("Invalid task id", 400);
  }

  const task = await Task.findById(taskId).lean();
  if (!task) {
    return apiError("Task not found", 404);
  }

  if (!canModifyTask(user, leanToITask(task as Parameters<typeof leanToITask>[0]))) {
    return apiError("Forbidden", 403);
  }

  const body = (await req.json()) as {
    stepId?: unknown;
    done?: unknown;
  };

  if (typeof body.stepId !== "string" || !Types.ObjectId.isValid(body.stepId)) {
    return apiError("stepId is required", 400);
  }
  if (typeof body.done !== "boolean") {
    return apiError("done must be a boolean", 400);
  }

  const updated = await Task.findOneAndUpdate(
    { _id: taskId, "steps._id": new Types.ObjectId(body.stepId) },
    { $set: { "steps.$.done": body.done } },
    { new: true, runValidators: true },
  ).lean();

  if (!updated) {
    return apiError("Step not found", 404);
  }

  return apiResponse(serializeSteps(updated.steps ?? []));
});
