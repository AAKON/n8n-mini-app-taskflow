import Department from "@/models/Department";
import { apiError, apiResponse, withAuth } from "@/lib/api-helpers";
import { escapeRegex, slugifyName } from "@/lib/path-utils";
import type { IUser } from "@/types";

function listFilterForUser(u: IUser): Record<string, unknown> {
  if (u.role === "admin") {
    return {};
  }
  if (!u.departmentPath) {
    return { _id: { $in: [] } };
  }
  if (u.role === "member") {
    return { path: u.departmentPath };
  }
  return {
    $or: [
      { path: u.departmentPath },
      { path: { $regex: `^${escapeRegex(u.departmentPath)}\\.` } },
    ],
  };
}

export const GET = withAuth(async (req, user) => {
  if (user.role !== "admin" && !user.departmentPath) {
    return apiResponse([]);
  }

  const filter = listFilterForUser(user);
  const departments = await Department.find(filter).sort({ path: 1 }).lean();

  const data = departments.map((d) => ({
    ...d,
    _id: String(d._id),
    headId: d.headId ? String(d.headId) : undefined,
    parentPath: d.parentPath ?? "",
  }));

  return apiResponse(data);
});

export const POST = withAuth(async (req, user) => {
  if (user.role !== "admin") {
    return apiError("Forbidden", 403);
  }

  const body = (await req.json()) as {
    name?: unknown;
    parentPath?: unknown;
  };

  if (typeof body.name !== "string" || !body.name.trim()) {
    return apiError("name is required", 400);
  }

  const parentPath =
    typeof body.parentPath === "string" ? body.parentPath.trim() : "";

  if (parentPath) {
    const parent = await Department.findOne({ path: parentPath }).lean();
    if (!parent) {
      return apiError("Parent department not found", 400);
    }
  }

  const segment = slugifyName(body.name);
  if (!segment) {
    return apiError("Invalid name", 400);
  }

  const path = parentPath ? `${parentPath}.${segment}` : segment;

  const exists = await Department.findOne({ path }).lean();
  if (exists) {
    return apiError("Department path already exists", 409);
  }

  let created;
  try {
    created = await Department.create({
      name: body.name.trim(),
      path,
      parentPath: parentPath || "",
    });
  } catch (e: unknown) {
    const code = (e as { code?: number })?.code;
    if (code === 11000) {
      return apiError("Department path already exists", 409);
    }
    throw e;
  }

  const doc = await Department.findById(created._id).lean();
  if (!doc) {
    return apiError("Failed to load department", 500);
  }

  return apiResponse(
    {
      ...doc,
      _id: String(doc._id),
      headId: doc.headId ? String(doc.headId) : undefined,
      parentPath: doc.parentPath ?? "",
    },
    201,
  );
});
