import Task from "@/models/Task";
import User from "@/models/User";
import { apiError, apiResponse, withAuth } from "@/lib/api-helpers";
import { buildTaskListFilter } from "@/lib/task-filters";

export const GET = withAuth(async (_req, user) => {
  if (user.role !== "admin" && user.role !== "department_head") {
    return apiError("Forbidden", 403);
  }

  const filter = buildTaskListFilter(user, {});
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start30 = new Date(startOfDay.getTime() - 29 * 86_400_000);

  const [agg] = await Task.aggregate<{
    trend: { _id: string; created: number; done: number }[];
    avg: { avgMs: number }[];
    deptOverdue: { _id: string; overdue: number; total: number }[];
    employees: {
      _id: string | null;
      total: number;
      done: number;
      overdue: number;
    }[];
  }>([
    { $match: filter },
    {
      $facet: {
        trend: [
          {
            $match: {
              $or: [
                { createdAt: { $gte: start30 } },
                { status: "done", updatedAt: { $gte: start30 } },
              ],
            },
          },
          {
            $project: {
              points: [
                {
                  _id: {
                    $cond: [
                      { $gte: ["$createdAt", start30] },
                      { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                      null,
                    ],
                  },
                  created: {
                    $cond: [{ $gte: ["$createdAt", start30] }, 1, 0],
                  },
                  done: 0,
                },
                {
                  _id: {
                    $cond: [
                      {
                        $and: [
                          { $eq: ["$status", "done"] },
                          { $gte: ["$updatedAt", start30] },
                        ],
                      },
                      { $dateToString: { format: "%Y-%m-%d", date: "$updatedAt" } },
                      null,
                    ],
                  },
                  created: 0,
                  done: {
                    $cond: [
                      {
                        $and: [
                          { $eq: ["$status", "done"] },
                          { $gte: ["$updatedAt", start30] },
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
              ],
            },
          },
          { $unwind: "$points" },
          { $match: { "points._id": { $ne: null } } },
          {
            $group: {
              _id: "$points._id",
              created: { $sum: "$points.created" },
              done: { $sum: "$points.done" },
            },
          },
          { $sort: { _id: 1 } },
        ],
        avg: [
          { $match: { status: "done" } },
          {
            $project: {
              ms: { $subtract: ["$updatedAt", "$createdAt"] },
            },
          },
          { $group: { _id: null, avgMs: { $avg: "$ms" } } },
        ],
        deptOverdue: [
          {
            $group: {
              _id: "$departmentPath",
              total: { $sum: 1 },
              overdue: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $ne: ["$status", "done"] },
                        { $ne: ["$dueDate", null] },
                        { $lt: ["$dueDate", startOfDay] },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
            },
          },
          { $sort: { overdue: -1 } },
          { $limit: 8 },
        ],
        employees: [
          { $match: { assigneeId: { $ne: null } } },
          {
            $group: {
              _id: "$assigneeId",
              total: { $sum: 1 },
              done: {
                $sum: { $cond: [{ $eq: ["$status", "done"] }, 1, 0] },
              },
              overdue: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $ne: ["$status", "done"] },
                        { $ne: ["$dueDate", null] },
                        { $lt: ["$dueDate", startOfDay] },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
            },
          },
          { $sort: { total: -1 } },
          { $limit: 20 },
        ],
      },
    },
  ]);

  const trendMap = new Map<string, { created: number; done: number }>();
  for (const row of agg?.trend ?? []) {
    trendMap.set(row._id, { created: row.created, done: row.done });
  }
  const trend: { date: string; created: number; done: number }[] = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(start30.getTime() + i * 86_400_000);
    const key = d.toISOString().slice(0, 10);
    const v = trendMap.get(key) ?? { created: 0, done: 0 };
    trend.push({ date: key, created: v.created, done: v.done });
  }

  const avgMs = agg?.avg[0]?.avgMs ?? 0;
  const avgHours = avgMs > 0 ? Math.round(avgMs / 3_600_000) : 0;

  const departments = (agg?.deptOverdue ?? []).map((r) => ({
    departmentPath: r._id || "—",
    total: r.total,
    overdue: r.overdue,
    rate: r.total > 0 ? r.overdue / r.total : 0,
  }));

  const employeeRows = (agg?.employees ?? []).filter((r) => r._id);
  const userIds = employeeRows.map((r) => r._id);
  const userDocs = userIds.length
    ? await User.find({ _id: { $in: userIds } })
        .select({ name: 1, username: 1, avatarUrl: 1, departmentPath: 1 })
        .lean<
          {
            _id: unknown;
            name: string;
            username?: string;
            avatarUrl?: string;
            departmentPath?: string;
          }[]
        >()
    : [];
  const userMap = new Map(userDocs.map((u) => [String(u._id), u]));
  const employees = employeeRows.map((r) => {
    const u = userMap.get(String(r._id));
    return {
      userId: String(r._id),
      name: u?.name || "Unknown",
      username: u?.username,
      avatarUrl: u?.avatarUrl,
      departmentPath: u?.departmentPath || "",
      total: r.total,
      done: r.done,
      overdue: r.overdue,
      completionRate: r.total > 0 ? r.done / r.total : 0,
    };
  });

  return apiResponse({ trend, avgHours, departments, employees });
});
