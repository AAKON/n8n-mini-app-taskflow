import User from "@/models/User";
import {
  apiError,
  apiResponse,
  withAuth,
  type AuthedRouteContext,
} from "@/lib/api-helpers";
import { validateN8nSecret } from "@/lib/n8n-auth";
import connectDB from "@/lib/mongodb";
import { escapeRegex } from "@/lib/path-utils";
import type { Role } from "@/types";

const ROLES: Role[] = ["admin", "department_head", "manager", "member"];

function isRole(v: string | null): v is Role {
  return v !== null && ROLES.includes(v as Role);
}

/** Users under the same branch: exact path or nested (prefix + dot). */
function departmentSubtreeFilter(userDeptPath: string) {
  return {
    $or: [
      { departmentPath: userDeptPath },
      { departmentPath: { $regex: `^${escapeRegex(userDeptPath)}\\.` } },
    ],
  };
}

const getUsersWithJwt = withAuth(async (req, user) => {
  if (user.role === "member") {
    return apiError("Forbidden", 403);
  }

  if (
    (user.role === "department_head" || user.role === "manager") &&
    !user.departmentPath
  ) {
    return apiResponse([]);
  }

  const url = new URL(req.url);
  const departmentPathParam = url.searchParams.get("departmentPath");
  const roleParam = url.searchParams.get("role");

  if (roleParam !== null && !isRole(roleParam)) {
    return apiError("Invalid role filter", 400);
  }

  const optionalFilters: Record<string, unknown> = {};
  if (departmentPathParam !== null && departmentPathParam !== "") {
    optionalFilters.departmentPath = departmentPathParam;
  }
  if (roleParam) {
    optionalFilters.role = roleParam;
  }

  let filter: Record<string, unknown> = { ...optionalFilters };

  if (user.role === "department_head" || user.role === "manager") {
    const scope = departmentSubtreeFilter(user.departmentPath);
    filter =
      Object.keys(optionalFilters).length > 0
        ? { $and: [scope, optionalFilters] }
        : scope;
  }

  const users = await User.find(filter)
    .select("_id name username avatarUrl role departmentPath telegramId")
    .lean();

  const data = users.map((u) => ({
    ...u,
    _id: String(u._id),
  }));

  return apiResponse(data);
});

/** JWT (app) or `x-n8n-secret` (n8n digest / automation). */
export async function GET(req: Request, ctx: AuthedRouteContext) {
  await connectDB();
  if (validateN8nSecret(req)) {
    const users = await User.find({})
      .select("_id name username avatarUrl role departmentPath telegramId")
      .sort({ name: 1 })
      .lean();
    const data = users.map((u) => ({
      ...u,
      _id: String(u._id),
    }));
    return apiResponse(data);
  }
  return getUsersWithJwt(req, ctx ?? {});
}
