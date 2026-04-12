import { Types } from "mongoose";
import Department from "@/models/Department";
import { apiError, apiResponse, withAuth } from "@/lib/api-helpers";
import { canAccessDepartment } from "@/lib/rbac";
import { escapeRegex } from "@/lib/path-utils";

export const PATCH = withAuth(async (req, user, ctx) => {
  if (user.role !== "admin" && user.role !== "department_head") {
    return apiError("Forbidden", 403);
  }

  const raw = ctx.params?.id;
  const id = Array.isArray(raw) ? raw[0] : raw;
  if (!id || !Types.ObjectId.isValid(id)) {
    return apiError("Invalid department id", 400);
  }

  const dept = await Department.findById(id).lean();
  if (!dept) {
    return apiError("Department not found", 404);
  }

  if (
    user.role === "department_head" &&
    !canAccessDepartment(user.departmentPath, dept.path, user.role)
  ) {
    return apiError("Forbidden", 403);
  }

  const body = (await req.json()) as {
    name?: unknown;
    headId?: unknown;
  };

  const update: { name?: string; headId?: Types.ObjectId | null } = {};

  if (body.name !== undefined) {
    if (typeof body.name !== "string" || !body.name.trim()) {
      return apiError("Invalid name", 400);
    }
    update.name = body.name.trim();
  }

  if (body.headId !== undefined) {
    if (body.headId === null || body.headId === "") {
      update.headId = null;
    } else if (
      typeof body.headId === "string" &&
      Types.ObjectId.isValid(body.headId)
    ) {
      update.headId = new Types.ObjectId(body.headId);
    } else {
      return apiError("Invalid headId", 400);
    }
  }

  if (Object.keys(update).length === 0) {
    return apiError("No fields to update", 400);
  }

  const updated = await Department.findByIdAndUpdate(
    id,
    { $set: update },
    { new: true, runValidators: true },
  ).lean();

  if (!updated) {
    return apiError("Department not found", 404);
  }

  return apiResponse({
    ...updated,
    _id: String(updated._id),
    headId: updated.headId ? String(updated.headId) : undefined,
    parentPath: updated.parentPath ?? "",
  });
});

export const DELETE = withAuth(async (req, user, ctx) => {
  if (user.role !== "admin") {
    return apiError("Forbidden", 403);
  }

  const raw = ctx.params?.id;
  const id = Array.isArray(raw) ? raw[0] : raw;
  if (!id || !Types.ObjectId.isValid(id)) {
    return apiError("Invalid department id", 400);
  }

  const dept = await Department.findById(id).lean();
  if (!dept) {
    return apiError("Department not found", 404);
  }

  const hasChildren = await Department.exists({
    path: { $regex: `^${escapeRegex(dept.path)}\\.` },
  });

  if (hasChildren) {
    return apiError("Cannot delete department with child departments", 400);
  }

  await Department.findByIdAndDelete(id);

  return apiResponse({ deleted: true });
});
