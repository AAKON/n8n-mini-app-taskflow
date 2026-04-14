import Task from "@/models/Task";
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
              createdKey: {
                $cond: [
                  { $gte: ["$createdAt", start30] },
                  { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                  null,
                ],
              },
              doneKey: {
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
            },
          },
          {
            $facet: {
              c: [
                { $match: { createdKey: { $ne: null } } },
                { $group: { _id: "$createdKey", n: { $sum: 1 } } },
              ],
              d: [
                { $match: { doneKey: { $ne: null } } },
                { $group: { _id: "$doneKey", n: { $sum: 1 } } },
              ],
            },
          },
          {
            $project: {
              all: {
                $concatArrays: [
                  {
                    $map: {
                      input: "$c",
                      as: "x",
                      in: { _id: "$$x._id", created: "$$x.n", done: 0 },
                    },
                  },
                  {
                    $map: {
                      input: "$d",
                      as: "x",
                      in: { _id: "$$x._id", created: 0, done: "$$x.n" },
                    },
                  },
                ],
              },
            },
          },
          { $unwind: "$all" },
          {
            $group: {
              _id: "$all._id",
              created: { $sum: "$all.created" },
              done: { $sum: "$all.done" },
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

  return apiResponse({ trend, avgHours, departments });
});
