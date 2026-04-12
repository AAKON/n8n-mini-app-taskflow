import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { validateN8nSecret } from "@/lib/n8n-auth";
import Task from "@/models/Task";
import User from "@/models/User";
import type { TaskStatus } from "@/types";

export async function POST(request: Request) {
  if (!validateN8nSecret(request)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  let body: { telegramId?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON" },
      { status: 400 },
    );
  }

  const telegramId =
    typeof body.telegramId === "number"
      ? body.telegramId
      : typeof body.telegramId === "string"
        ? Number.parseInt(body.telegramId, 10)
        : NaN;

  if (!Number.isFinite(telegramId)) {
    return NextResponse.json(
      { success: false, error: "telegramId is required" },
      { status: 400 },
    );
  }

  await connectDB();

  const user = await User.findOne({ telegramId }).lean();
  if (!user) {
    return NextResponse.json(
      { success: false, error: "User not found" },
      { status: 404 },
    );
  }

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
      dueDate: {
        $gte: startOfToday,
        $lte: endOfToday,
      },
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

  return NextResponse.json({
    success: true,
    data: {
      name: user.name,
      totalOpen,
      byStatus,
      overdue,
      upcomingDueToday,
    },
  });
}
