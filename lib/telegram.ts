import { formatDate, type RequestRow } from "./requests";

function escapeHtml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function notifyTelegram(row: RequestRow) {
  // trim и снятие префикса "bot" прощают частые ошибки при вставке токена в Vercel
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim().replace(/^bot/i, "");
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!token || !chatId) {
    console.error("TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID не заданы");
    return;
  }

  const text = [
    "🌷 <b>Новая заявка</b>",
    "",
    `<b>Имя:</b> ${escapeHtml(row.name)}`,
    `<b>Телефон:</b> ${escapeHtml(row.phone)}`,
    `<b>Комментарий:</b> ${escapeHtml(row.comment)}`,
    `<b>Время:</b> ${formatDate(row.created_at)}`,
    `<b>Статус:</b> новая`,
  ].join("\n");

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
  if (!res.ok) console.error("Ошибка Telegram:", res.status, await res.text());
}
