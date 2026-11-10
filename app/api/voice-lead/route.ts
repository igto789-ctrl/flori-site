import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { validateClient, type RequestRow } from "@/lib/requests";
import { notifyTelegram } from "@/lib/telegram";

// Заявка от голосового агента ElevenLabs (инструмент create_lead).
// Адрес защищён секретом: ElevenLabs шлёт заголовок X-Voice-Secret,
// значение лежит только в переменной VOICE_WEBHOOK_SECRET на Vercel и в настройках инструмента агента.

function secretOk(req: Request) {
  const expected = process.env.VOICE_WEBHOOK_SECRET?.trim();
  const got = req.headers.get("x-voice-secret")?.trim() ?? "";
  if (!expected) return false;
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  if (!secretOk(req)) {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) ?? {};
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  // summary — краткое содержание разговора, его агент кладёт в комментарий заявки.
  const { ok, errors, value } = validateClient({
    name: body.name,
    phone: body.phone,
    comment: `🎙 ${String(body.summary ?? "").trim()}`.slice(0, 1000),
  });
  if (!ok) {
    // Агент прочитает ошибку и переспросит клиента.
    return NextResponse.json({ ok: false, errors }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("requests")
    .insert({ name: value.name, phone: value.phone, comment: value.comment, source: "voice", stage: "new" })
    .select()
    .single<RequestRow>();

  if (error || !data) {
    console.error("Ошибка Supabase (voice):", error);
    return NextResponse.json({ ok: false, error: "Не удалось сохранить заявку" }, { status: 500 });
  }

  try {
    await notifyTelegram(data);
  } catch (e) {
    console.error("Не удалось отправить в Telegram:", e);
  }

  return NextResponse.json({ ok: true, message: "Заявка создана, флорист перезвонит в течение 15 минут" });
}
