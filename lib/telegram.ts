import crypto from "crypto";

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
