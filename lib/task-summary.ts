import connectDB from "@/lib/mongodb";
import Task from "@/models/Task";
import User from "@/models/User";
import type { TaskStatus } from "@/types";

export type TaskSummary = {
  name: string;
  totalOpen: number;
  byStatus: Record<TaskStatus, number>;
  overdue: number;
  upcomingDueToday: number;
};

export async function getTaskSummaryForTelegramUser(
  telegramId: number,
): Promise<TaskSummary | null> {
  await connectDB();

  const user = await User.findOne({ telegramId }).lean();
  if (!user) return null;

  const assigneeFilter = { assigneeId: user._id };

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday);
  endOfToday.setHours(23, 59, 59, 999);

  const [grouped, totalOpen, overdue, upcomingDueToday] = await Promise.all([
    Task.aggregate<{ _id: string; n: number }>([
      { $match: assigneeFilter },
      { $group: { _id: "$status", n: { $sum: 1 } } },
    ]),
    Task.countDocuments({
      ...assigneeFilter,
      status: { $ne: "done" },
    }),
    Task.countDocuments({
      ...assigneeFilter,
      status: { $ne: "done" },
      dueDate: { $exists: true, $ne: null, $lt: startOfToday },
    }),
    Task.countDocuments({
      ...assigneeFilter,
      status: { $ne: "done" },
      dueDate: { $gte: startOfToday, $lte: endOfToday },
    }),
  ]);

  const byStatus: Record<TaskStatus, number> = {
    todo: 0,
    in_progress: 0,
    review: 0,
    done: 0,
  };
  for (const row of grouped) {
    if (row._id && typeof row.n === "number") {
      const k = row._id as TaskStatus;
      if (k in byStatus) {
        byStatus[k] = row.n;
      }
    }
  }

  return {
    name: user.name,
    totalOpen,
    byStatus,
    overdue,
    upcomingDueToday,
  };
}
