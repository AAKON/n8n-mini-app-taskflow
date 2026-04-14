import connectDB from "@/lib/mongodb";
import Task from "@/models/Task";

export type DueReminder = {
  telegramId: number;
  assigneeUserId: string;
  taskTitle: string;
  taskId: string;
  dueDate: string;
};

type PopulatedAssignee = {
  _id: unknown;
  telegramId?: number;
};

export async function getDueRemindersNext24h(): Promise<DueReminder[]> {
  await connectDB();

  const now = new Date();
  const in24 = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const tasks = await Task.find({
    status: { $ne: "done" },
    dueDate: { $gte: now, $lte: in24 },
    assigneeId: { $exists: true, $ne: null },
  })
    .populate("assigneeId", "telegramId")
    .lean();

  const reminders: DueReminder[] = [];

  for (const t of tasks) {
    const a = t.assigneeId as unknown as PopulatedAssignee | null;
    const tg = a?.telegramId;
    if (!a?._id || typeof tg !== "number" || !Number.isFinite(tg)) continue;
    if (!t.dueDate) continue;
    reminders.push({
      telegramId: tg,
      assigneeUserId: String(a._id),
      taskTitle: t.title,
      taskId: String(t._id),
      dueDate: t.dueDate.toISOString(),
    });
  }

  return reminders;
}
