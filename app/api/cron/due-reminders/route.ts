import { NextResponse } from "next/server";
import { getDueRemindersNext24h } from "@/lib/due-reminders";
import { logNotificationSent } from "@/lib/activity";
import { sendDueReminderMessage } from "@/lib/telegram";

export const dynamic = "force-dynamic";

function authorized(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${expected}`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ success: false }, { status: 401 });
  }

  const reminders = await getDueRemindersNext24h();

  let sent = 0;
  let failed = 0;

  for (const r of reminders) {
    const ok = await sendDueReminderMessage({
      telegramId: r.telegramId,
      taskId: r.taskId,
      taskTitle: r.taskTitle,
      dueDate: r.dueDate,
    });
    if (ok) {
      sent++;
      try {
        await logNotificationSent({
          taskId: r.taskId,
          userId: r.assigneeUserId,
          type: "reminder",
        });
      } catch {
        // logging must never block the cron run
      }
    } else {
      failed++;
    }
    // Stay well under Telegram's 30 msg/sec global limit.
    await sleep(50);
  }

  return NextResponse.json({
    success: true,
    total: reminders.length,
    sent,
    failed,
  });
}
