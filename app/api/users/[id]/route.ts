import { Types } from "mongoose";
import User from "@/models/User";
import { apiError, apiResponse, withAuth } from "@/lib/api-helpers";
import type { Role } from "@/types";

const ROLES: Role[] = ["admin", "department_head", "manager", "member"];

function isRole(v: unknown): v is Role {
  return typeof v === "string" && ROLES.includes(v as Role);
}

export const GET = withAuth(async (_req, _user, ctx) => {
  const raw = ctx.params?.id;
  const id = Array.isArray(raw) ? raw[0] : raw;
  if (!id || !Types.ObjectId.isValid(id)) {
    return apiError("Invalid user id", 400);
  }
  const found = await User.findById(id)
    .select("_id name username avatarUrl role departmentPath isBlocked createdAt updatedAt")
    .lean<{
      _id: unknown;
      name: string;
      username?: string;
      avatarUrl?: string;
      role: Role;
      departmentPath?: string;
      createdAt: Date;
      updatedAt: Date;
    }>();
  if (!found) {
    return apiError("User not found", 404);
  }
  return apiResponse({ ...found, _id: String(found._id) });
});

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
    name?: unknown;
    isBlocked?: unknown;
  };

  const update: { role?: Role; departmentPath?: string; name?: string; isBlocked?: boolean } = {};

  if (body.name !== undefined) {
    if (typeof body.name !== "string" || !body.name.trim()) {
      return apiError("name must be a non-empty string", 400);
    }
    update.name = body.name.trim();
  }

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

  if (body.isBlocked !== undefined) {
    if (typeof body.isBlocked !== "boolean") {
      return apiError("isBlocked must be a boolean", 400);
    }
    if (id === user._id) {
      return apiError("Cannot block yourself", 400);
    }
    update.isBlocked = body.isBlocked;
  }

  if (Object.keys(update).length === 0) {
    return apiError("No fields to update", 400);
  }

  const updated = await User.findByIdAndUpdate(
    id,
    { $set: update },
    { new: true, runValidators: true },
  )
    .select("_id name username avatarUrl role departmentPath isBlocked createdAt updatedAt")
    .lean();

  if (!updated) {
    return apiError("User not found", 404);
  }

  return apiResponse({
    ...updated,
    _id: String(updated._id),
  });
});
