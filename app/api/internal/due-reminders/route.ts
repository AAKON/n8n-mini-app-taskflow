import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { validateN8nSecret } from "@/lib/n8n-auth";
import Task from "@/models/Task";

type PopulatedAssignee = {
  _id: unknown;
  telegramId?: number;
};

export async function GET(request: Request) {
  if (!validateN8nSecret(request)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

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

  const reminders: {
    telegramId: number;
    assigneeUserId: string;
    taskTitle: string;
    taskId: string;
    dueDate: string;
  }[] = [];

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

  return NextResponse.json({ success: true, data: reminders });
}
