import { createHmac, timingSafeEqual } from "crypto";

export type TelegramUser = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
};

const MAX_AGE_SECONDS = 24 * 60 * 60;

// Проверка подписи initData по документации Telegram:
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
// Данные из браузера не принимаются на веру: без верной подписи бота пользователь = null.
export function verifyInitData(initData: unknown): TelegramUser | null {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim().replace(/^bot/i, "");
  if (!token || typeof initData !== "string" || !initData) return null;

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("\n");

  const secret = createHmac("sha256", "WebAppData").update(token).digest();
  const expected = createHmac("sha256", secret).update(dataCheckString).digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(hash, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const authDate = Number(params.get("auth_date"));
  if (!authDate || Date.now() / 1000 - authDate > MAX_AGE_SECONDS) return null;

  try {
    const user = JSON.parse(params.get("user") ?? "null") as TelegramUser | null;
    return user && typeof user.id === "number" ? user : null;
  } catch {
    return null;
  }
}

export function telegramName(u: TelegramUser) {
  return [u.first_name, u.last_name].filter(Boolean).join(" ").trim() || u.username || `Telegram ${u.id}`;
}
