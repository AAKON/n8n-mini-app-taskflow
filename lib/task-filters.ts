import { Types } from "mongoose";
import { escapeRegex } from "@/lib/path-utils";
import type { IUser } from "@/types";

export type DueFilter = "overdue" | "today" | "week" | null;

export type TaskListQuery = {
  status?: string | null;
  priority?: string | null;
  assigneeId?: string | null;
  departmentPath?: string | null;
  dueFilter?: DueFilter;
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
  if (query.departmentPath) {
    clauses.push({
      $or: [
        { departmentPath: query.departmentPath },
        { departmentPath: { $regex: `^${escapeRegex(query.departmentPath)}\\.` } },
      ],
    });
  }

  if (query.dueFilter) {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 86_400_000 - 1);
    const endOfWeek = new Date(startOfDay.getTime() + (7 - startOfDay.getDay()) * 86_400_000);

    if (query.dueFilter === "overdue") {
      clauses.push({
        dueDate: { $exists: true, $ne: null, $lt: startOfDay },
        status: { $ne: "done" },
      });
    } else if (query.dueFilter === "today") {
      clauses.push({ dueDate: { $gte: startOfDay, $lte: endOfDay } });
    } else if (query.dueFilter === "week") {
      clauses.push({ dueDate: { $gte: startOfDay, $lte: endOfWeek } });
    }
  }

  if (clauses.length === 0) {
    return {};
  }
  if (clauses.length === 1) {
    return clauses[0]!;
  }
  return { $and: clauses };
}
