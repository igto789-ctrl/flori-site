import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { telegramName, verifyInitData } from "@/lib/telegram-auth";
import { STAGES, type Stage } from "@/lib/requests";

// Кто открыл Mini App и его заказы. Только по проверенной подписи Telegram.
export async function POST(req: Request) {
  const { initData } = await req.json().catch(() => ({}));
  const user = verifyInitData(initData);
  if (!user) return NextResponse.json({ error: "Откройте приложение через бота в Telegram" }, { status: 401 });

  const { data } = await createServiceClient()
    .from("requests")
    .select("id, comment, stage, created_at")
    .eq("telegram_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10);

  return NextResponse.json({
    user: { firstName: user.first_name, name: telegramName(user), username: user.username ?? null },
    orders: (data ?? []).map((o) => ({ ...o, stageLabel: STAGES[o.stage as Stage] ?? o.stage })),
  });
}
