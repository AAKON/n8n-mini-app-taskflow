import { Types } from "mongoose";
import { escapeRegex } from "@/lib/path-utils";
import type { IUser } from "@/types";

export type TaskListQuery = {
  status?: string | null;
  priority?: string | null;
  assigneeId?: string | null;
  departmentPath?: string | null;
};

/** Builds Mongo filter for GET /api/tasks (role + optional query filters). */
export function buildTaskListFilter(
  user: IUser,
  query: TaskListQuery,
): Record<string, unknown> {
  const clauses: Record<string, unknown>[] = [];

  if (user.role === "member") {
    clauses.push({ assigneeId: new Types.ObjectId(user._id) });
  } else if (user.role === "department_head" || user.role === "manager") {
    if (!user.departmentPath) {
      return { _id: { $in: [] } };
    }
    clauses.push({
      $or: [
        { departmentPath: user.departmentPath },
        {
          departmentPath: {
            $regex: `^${escapeRegex(user.departmentPath)}\\.`,
          },
        },
      ],
    });
  }

  if (query.status) {
    clauses.push({ status: query.status });
  }
  if (query.priority) {
    clauses.push({ priority: query.priority });
  }
  if (query.assigneeId && Types.ObjectId.isValid(query.assigneeId)) {
    clauses.push({ assigneeId: new Types.ObjectId(query.assigneeId) });
  }
  if (
    query.departmentPath !== null &&
    query.departmentPath !== undefined &&
    query.departmentPath !== ""
  ) {
    clauses.push({ departmentPath: query.departmentPath });
  }

  if (clauses.length === 0) {
    return {};
  }
  if (clauses.length === 1) {
    return clauses[0]!;
  }
  return { $and: clauses };
}
