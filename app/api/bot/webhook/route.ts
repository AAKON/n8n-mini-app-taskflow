import { NextResponse } from "next/server";
import { upsertUserByTelegramId } from "@/lib/user-upsert";
import { getTaskSummaryForTelegramUser } from "@/lib/task-summary";
import {
  sendWelcomeMessage,
  sendTaskSummaryMessage,
  sendTelegramMessage,
} from "@/lib/telegram";

/**
 * Telegram Bot webhook.
 *
 * Configure once after deploy:
 *   curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
 *     -d "url=https://<host>/api/bot/webhook" \
 *     -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
 */

type TelegramFrom = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
};

type TelegramUpdate = {
  update_id?: number;
  message?: {
    message_id?: number;
    from?: TelegramFrom;
    text?: string;
  };
};

function displayName(from: TelegramFrom): string {
  const parts = [from.first_name, from.last_name].filter(
    (v): v is string => typeof v === "string" && v.length > 0,
  );
  if (parts.length > 0) return parts.join(" ");
  if (from.username) return from.username;
  return String(from.id);
}

export async function POST(request: Request) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: "Webhook secret not configured" },
      { status: 500 },
    );
  }

  const got = request.headers.get("x-telegram-bot-api-secret-token");
  if (got !== expected) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json({ ok: true });
  }

  const msg = update.message;
  const from = msg?.from;
  const text = msg?.text?.trim() ?? "";

  if (!from || !text) {
    return NextResponse.json({ ok: true });
  }

  const command = text.split(/\s+/)[0]?.split("@")[0]?.toLowerCase() ?? "";

  try {
    if (command === "/start") {
      const name = displayName(from);
      const { isNew } = await upsertUserByTelegramId({
        telegramId: from.id,
        name,
        username: from.username,
      });
      await sendWelcomeMessage({
        telegramId: from.id,
        userName: name,
        isNew,
      });
    } else if (command === "/tasks") {
      const summary = await getTaskSummaryForTelegramUser(from.id);
      if (!summary) {
        await sendTelegramMessage({
          chatId: from.id,
          text: "You're not registered yet. Send /start first.",
        });
      } else {
        await sendTaskSummaryMessage({
          telegramId: from.id,
          summary,
        });
      }
    }
  } catch (err) {
    console.error("bot webhook error", err);
  }

  return NextResponse.json({ ok: true });
}
