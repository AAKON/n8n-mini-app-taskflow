import { Types } from "mongoose";
import connectDB from "@/lib/mongodb";
import ActivityLog from "@/models/ActivityLog";

export type NotificationType = "assigned" | "reminder" | "commented";

export async function logNotificationSent(input: {
  taskId: string;
  userId: string;
  type: NotificationType;
}): Promise<void> {
  await connectDB();

  await ActivityLog.create({
    taskId: new Types.ObjectId(input.taskId),
    userId: new Types.ObjectId(input.userId),
    action: "notification_sent",
    meta: { type: input.type },
  });
}
