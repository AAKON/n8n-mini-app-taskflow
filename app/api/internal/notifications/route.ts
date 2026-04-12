import { Types } from "mongoose";
import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { validateN8nSecret } from "@/lib/n8n-auth";
import ActivityLog from "@/models/ActivityLog";

const TYPES = new Set(["assigned", "reminder", "commented"]);

export async function POST(request: Request) {
  if (!validateN8nSecret(request)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  let body: {
    taskId?: unknown;
    userId?: unknown;
    type?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON" },
      { status: 400 },
    );
  }

  if (typeof body.taskId !== "string" || !Types.ObjectId.isValid(body.taskId)) {
    return NextResponse.json(
      { success: false, error: "taskId is required" },
      { status: 400 },
    );
  }
  if (typeof body.userId !== "string" || !Types.ObjectId.isValid(body.userId)) {
    return NextResponse.json(
      { success: false, error: "userId is required" },
      { status: 400 },
    );
  }
  if (typeof body.type !== "string" || !TYPES.has(body.type)) {
    return NextResponse.json(
      {
        success: false,
        error: 'type must be "assigned", "reminder", or "commented"',
      },
      { status: 400 },
    );
  }

  await connectDB();

  await ActivityLog.create({
    taskId: new Types.ObjectId(body.taskId),
    userId: new Types.ObjectId(body.userId),
    action: "notification_sent",
    meta: { type: body.type },
  });

  return NextResponse.json({ success: true, ok: true });
}
