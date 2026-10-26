import { NextResponse } from "next/server";
import { createUserClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Диагностика Telegram для владельца: показывает, в порядке ли токен и chat id, не раскрывая их.
export async function GET() {
  const supabase = await createUserClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Сначала войдите в админку" }, { status: 401 });

  const rawToken = process.env.TELEGRAM_BOT_TOKEN ?? "";
  const token = rawToken.trim().replace(/^bot/i, "");
  const chatId = (process.env.TELEGRAM_CHAT_ID ?? "").trim();

  const result: Record<string, unknown> = {
    token_задан: rawToken.length > 0,
    token_длина: token.length,
    token_формат_похож_на_правильный: /^\d{6,12}:[A-Za-z0-9_-]{30,}$/.test(token),
    token_начало: token.slice(0, 4) + "…",
    chat_id_задан: chatId.length > 0,
    chat_id_формат_число: /^-?\d+$/.test(chatId),
  };

  if (token) {
    const me = await fetch(`https://api.telegram.org/bot${token}/getMe`).then((r) => r.json()).catch((e) => ({ error: String(e) }));
    result.проверка_токена = me.ok ? `OK, бот @${me.result.username}` : me;
  }

  if (token && chatId) {
    const sent = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: "✅ Проверка связи с сайтом Floria" }),
    }).then((r) => r.json()).catch((e) => ({ error: String(e) }));
    result.тестовое_сообщение = sent.ok ? "OK, отправлено" : sent;
  }

  return NextResponse.json(result, { headers: { "Content-Type": "application/json; charset=utf-8" } });
}
