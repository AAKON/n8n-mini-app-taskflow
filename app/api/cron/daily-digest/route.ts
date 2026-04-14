import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import { getTaskSummaryForTelegramUser } from "@/lib/task-summary";
import { sendTaskSummaryMessage } from "@/lib/telegram";

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

  await connectDB();

  const users = await User.find({
    telegramId: { $exists: true, $ne: null },
  })
    .select("_id telegramId")
    .lean<{ _id: unknown; telegramId: number }[]>();

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const u of users) {
    if (typeof u.telegramId !== "number") {
      skipped++;
      continue;
    }
    const summary = await getTaskSummaryForTelegramUser(u.telegramId);
    if (!summary || summary.totalOpen === 0) {
      skipped++;
      continue;
    }
    const ok = await sendTaskSummaryMessage({
      telegramId: u.telegramId,
      summary,
    });
    if (ok) sent++;
    else failed++;
    await sleep(50);
  }

  return NextResponse.json({
    success: true,
    total: users.length,
    sent,
    skipped,
    failed,
  });
}
