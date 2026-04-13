import crypto from "crypto";

export async function sendTaskAssignedMessage(params: {
  assigneeTelegramId: number;
  taskId: string;
  taskTitle: string;
  assignedByName: string;
  dueDate?: Date | string | null;
}): Promise<void> {
  const token = process.env.BOT_TOKEN;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!token || !appUrl) return;

  const due = params.dueDate
    ? `\n📅 Due: ${new Date(params.dueDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`
    : "";

  const text = `📌 New task assigned by *${params.assignedByName}*:\n*${params.taskTitle}*${due}`;

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: params.assigneeTelegramId,
      text,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [[
          {
            text: "Open Task",
            web_app: { url: `${appUrl}/tasks/${params.taskId}` },
          },
        ]],
      },
    }),
  }).catch(() => {
    // never fail the API response if notification fails
  });
}

export type ParsedTelegramUser = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
};

/**
 * Validates Telegram Web App initData per
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-web-app
 */
export async function sendStatusChangedMessage(params: {
  creatorTelegramId: number;
  taskId: string;
  taskTitle: string;
  updatedByName: string;
  from: string;
  to: string;
}): Promise<void> {
  const token = process.env.BOT_TOKEN;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!token || !appUrl) return;

  const statusLabel = (s: string) =>
    s.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const text = `🔄 *${params.taskTitle}*\nStatus changed by *${params.updatedByName}*: ${statusLabel(params.from)} → ${statusLabel(params.to)}`;

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: params.creatorTelegramId,
      text,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [[
          { text: "Open Task", web_app: { url: `${appUrl}/tasks/${params.taskId}` } },
        ]],
      },
    }),
  }).catch(() => {});
}

export function validateTelegramInitData(initData: string): boolean {
  const botToken = process.env.BOT_TOKEN;
  if (!botToken) return false;

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return false;

  const allKeys = Array.from(params.keys());
  const keys = allKeys
    .filter((k, i) => k !== "hash" && allKeys.indexOf(k) === i)
    .sort();

  const dataCheckString = keys
    .map((k) => {
      const v = params.get(k);
      return `${k}=${v ?? ""}`;
    })
    .join("\n");

  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();

  const computed = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  if (computed.length !== hash.length) return false;
  try {
    return crypto.timingSafeEqual(
      Buffer.from(computed, "hex"),
      Buffer.from(hash, "hex"),
    );
  } catch {
    return false;
  }
}

export function parseTelegramUser(initData: string): ParsedTelegramUser {
  const params = new URLSearchParams(initData);
  const raw = params.get("user");
  if (!raw) {
    throw new Error('initData is missing "user"');
  }
  const user = JSON.parse(raw) as ParsedTelegramUser;
  if (typeof user.id !== "number" || typeof user.first_name !== "string") {
    throw new Error("Invalid Telegram user payload");
  }
  return user;
}
