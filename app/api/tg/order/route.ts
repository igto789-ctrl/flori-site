import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { telegramName, verifyInitData } from "@/lib/telegram-auth";
import { findBouquet } from "@/lib/catalog";
import { validateClient, type RequestRow } from "@/lib/requests";
import { notifyTelegram } from "@/lib/telegram";

// Заказ из Mini App → карточка в CRM: этап «Новая», источник «Telegram», имя из Telegram.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const user = verifyInitData(body.initData);
  if (!user) return NextResponse.json({ error: "Откройте приложение через бота в Telegram" }, { status: 401 });

  const bouquet = findBouquet(body.bouquetId);
  if (!bouquet) return NextResponse.json({ error: "Выберите букет" }, { status: 400 });

  let name = telegramName(user).slice(0, 100);
  if (name.length < 2) name = `${name} (Telegram)`;
  const wish = String(body.comment ?? "").trim().slice(0, 500);
  const check = validateClient({
    name,
    phone: body.phone,
    comment: `Букет «${bouquet.name}», ${bouquet.price} лей${wish ? `. ${wish}` : ""}`,
  });
  if (!check.ok) return NextResponse.json({ errors: check.errors }, { status: 400 });

  const { data, error } = await createServiceClient()
    .from("requests")
    .insert({
      name: check.value.name,
      phone: check.value.phone,
      comment: check.value.comment,
      source: "telegram",
      stage: "new",
      telegram_id: user.id,
      telegram_username: user.username ?? null,
    })
    .select()
    .single<RequestRow>();

  if (error || !data)
    return NextResponse.json({ error: `Не удалось сохранить заказ: ${error?.message}` }, { status: 500 });

  try {
    await notifyTelegram(data);
  } catch (e) {
    console.error("Не удалось отправить уведомление владельцу:", e);
  }
  return NextResponse.json({ ok: true, id: data.id });
}
