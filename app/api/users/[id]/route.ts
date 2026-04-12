import { Types } from "mongoose";
import User from "@/models/User";
import { apiError, apiResponse, withAuth } from "@/lib/api-helpers";
import type { Role } from "@/types";

const ROLES: Role[] = ["admin", "department_head", "manager", "member"];

function isRole(v: unknown): v is Role {
  return typeof v === "string" && ROLES.includes(v as Role);
}

export const PATCH = withAuth(async (req, user, ctx) => {
  if (user.role !== "admin") {
    return apiError("Forbidden", 403);
  }

  const raw = ctx.params?.id;
  const id = Array.isArray(raw) ? raw[0] : raw;
  if (!id || !Types.ObjectId.isValid(id)) {
    return apiError("Invalid user id", 400);
  }

  const body = (await req.json()) as {
    role?: unknown;
    departmentPath?: unknown;
  };

  const update: { role?: Role; departmentPath?: string } = {};

  if (body.role !== undefined) {
    if (!isRole(body.role)) {
      return apiError("Invalid role", 400);
    }
    update.role = body.role;
  }

  if (body.departmentPath !== undefined) {
    if (typeof body.departmentPath !== "string") {
      return apiError("departmentPath must be a string", 400);
    }
    update.departmentPath = body.departmentPath;
  }

  if (Object.keys(update).length === 0) {
    return apiError("No fields to update", 400);
  }

  const updated = await User.findByIdAndUpdate(
    id,
    { $set: update },
    { new: true, runValidators: true },
  )
    .select("_id name username avatarUrl role departmentPath createdAt updatedAt")
    .lean();

  if (!updated) {
    return apiError("User not found", 404);
  }

  return apiResponse({
    ...updated,
    _id: String(updated._id),
  });
});
