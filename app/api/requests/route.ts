import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { validateRequest, type RequestRow } from "@/lib/requests";
import { notifyTelegram } from "@/lib/telegram";
import { clientIp, takeLimits } from "@/lib/rate-limit";

export async function POST(req: Request) {
  try {
    return await handle(req);
  } catch (e) {
    console.error("Необработанная ошибка:", e);
    return NextResponse.json({ error: "Не удалось отправить заявку. Попробуйте позже или позвоните нам." }, { status: 500 });
  }
}

async function handle(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  // Ловушка для ботов: скрытое поле hp_extra люди не видят и не заполняют.
  const hp = (body as { hp?: unknown } | null)?.hp;
  if (typeof hp === "string" && hp !== "") {
    console.warn("Заявка отклонена: заполнено скрытое поле (бот)");
    return NextResponse.json({ ok: true });
  }

  const { ok, errors, value } = validateRequest((body ?? {}) as Record<string, unknown>);
  if (!ok) return NextResponse.json({ errors }, { status: 400 });

  // Не больше 5 заявок в минуту и 30 в сутки с одного IP.
  const ip = clientIp(req);
  const allowed = await takeLimits([
    { kind: "ip", id: ip, limit: 5, windowSec: 60 },
    { kind: "ip", id: ip, limit: 30, windowSec: 86400 },
  ]);
  if (!allowed) return NextResponse.json({ error: "Слишком много заявок. Попробуйте позже или позвоните нам." }, { status: 429 });

  const missing = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"].filter((k) => !process.env[k]);
  if (missing.length) {
    console.error("Не заданы переменные окружения:", missing);
    return NextResponse.json({ error: "Не удалось отправить заявку. Попробуйте позже или позвоните нам." }, { status: 500 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("requests")
    .insert({ ...value, source: "site", stage: "new" })
    .select()
    .single<RequestRow>();

  if (error || !data) {
    console.error("Ошибка Supabase:", error);
    return NextResponse.json({ error: "Не удалось отправить заявку. Попробуйте позже или позвоните нам." }, { status: 500 });
  }

  // Ждём отправку до ответа: на Vercel функция завершается сразу после ответа.
  try {
    await notifyTelegram(data);
  } catch (e) {
    console.error("Не удалось отправить в Telegram:", e);
  }

  return NextResponse.json({ ok: true });
}
