import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { validateRequest, type RequestRow } from "@/lib/requests";
import { notifyTelegram } from "@/lib/telegram";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const { ok, errors, value } = validateRequest((body ?? {}) as Record<string, unknown>);
  if (!ok) return NextResponse.json({ errors }, { status: 400 });

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("requests")
    .insert(value)
    .select()
    .single<RequestRow>();

  if (error || !data) {
    console.error("Ошибка Supabase:", error);
    return NextResponse.json({ error: "Не удалось сохранить заявку" }, { status: 500 });
  }

  // Ждём отправку до ответа: на Vercel функция завершается сразу после ответа.
  try {
    await notifyTelegram(data);
  } catch (e) {
    console.error("Не удалось отправить в Telegram:", e);
  }

  return NextResponse.json({ ok: true });
}
