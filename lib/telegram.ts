import crypto from "crypto";
import type { TaskSummary } from "@/lib/task-summary";

type InlineKeyboardButton = {
  text: string;
  web_app?: { url: string };
  url?: string;
};

type SendMessageOptions = {
  chatId: number;
  text: string;
  parseMode?: "Markdown" | "MarkdownV2" | "HTML";
  keyboard?: InlineKeyboardButton[][];
};

/** Generic low-level wrapper around Telegram's sendMessage. */
export async function sendTelegramMessage(
  opts: SendMessageOptions,
): Promise<boolean> {
  const token = process.env.BOT_TOKEN;
  if (!token) return false;

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: opts.chatId,
          text: opts.text,
          parse_mode: opts.parseMode ?? "Markdown",
          reply_markup: opts.keyboard
            ? { inline_keyboard: opts.keyboard }
            : undefined,
        }),
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}

/** Welcome DM after /start — includes a WebApp button that opens the mini app. */
export async function sendWelcomeMessage(params: {
  telegramId: number;
  userName: string;
  isNew: boolean;
}): Promise<boolean> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) return false;

  const greeting = params.isNew
    ? `👋 Welcome to *TaskFlow*, ${params.userName}!`
    : `👋 Welcome back, ${params.userName}!`;

  return sendTelegramMessage({
    chatId: params.telegramId,
    text: `${greeting}\n\nTap the button below to open your tasks.`,
    keyboard: [[{ text: "Open TaskFlow", web_app: { url: appUrl } }]],
  });
}

function formatSummary(summary: TaskSummary): string {
  const lines = [
    `📋 *${summary.name}'s tasks*`,
    "",
    `Open: *${summary.totalOpen}*`,
    `• Todo: ${summary.byStatus.todo}`,
    `• In Progress: ${summary.byStatus.in_progress}`,
    `• Review: ${summary.byStatus.review}`,
    `• Done: ${summary.byStatus.done}`,
  ];
  if (summary.overdue > 0) {
    lines.push("", `⚠️ Overdue: *${summary.overdue}*`);
  }
  if (summary.upcomingDueToday > 0) {
    lines.push(`📅 Due today: *${summary.upcomingDueToday}*`);
  }
  return lines.join("\n");
}

/** `/tasks` command reply + daily digest body. */
export async function sendTaskSummaryMessage(params: {
  telegramId: number;
  summary: TaskSummary;
}): Promise<boolean> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const keyboard = appUrl
    ? [[{ text: "Open TaskFlow", web_app: { url: appUrl } }]]
    : undefined;

  return sendTelegramMessage({
    chatId: params.telegramId,
    text: formatSummary(params.summary),
    keyboard,
  });
}

/** Due-reminder DM for a single task. */
export async function sendDueReminderMessage(params: {
  telegramId: number;
  taskId: string;
  taskTitle: string;
  dueDate: string | Date;
}): Promise<boolean> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) return false;

  const due = new Date(params.dueDate).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return sendTelegramMessage({
    chatId: params.telegramId,
    text: `⏰ *Reminder:* ${params.taskTitle}\nDue ${due}`,
    keyboard: [
      [
        {
          text: "Open Task",
          web_app: { url: `${appUrl}/tasks/${params.taskId}` },
        },
      ],
    ],
  });
}

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
