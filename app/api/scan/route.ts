import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createUserClient } from "@/lib/supabase/server";
import { MAX_FILE_BYTES, isAllowedType, recognizeCard } from "@/lib/scan";

export const maxDuration = 60;

// Шаг 1: распознать файл. Здесь НИЧЕГО не сохраняется — только ответ с полями для проверки.
export async function POST(req: Request) {
  const supabase = await createUserClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Сначала войдите в админку" }, { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY)
    return NextResponse.json({ error: "Сервер не настроен: в Vercel нет переменной ANTHROPIC_API_KEY" }, { status: 500 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size === 0)
    return NextResponse.json({ error: "Выберите фото или PDF" }, { status: 400 });
  if (!isAllowedType(file.type))
    return NextResponse.json({ error: "Подходят только фото (JPG, PNG) или PDF" }, { status: 400 });
  if (file.size > MAX_FILE_BYTES)
    return NextResponse.json({ error: "Файл больше 4 МБ. Сфотографируйте ещё раз или уменьшите PDF" }, { status: 400 });

  try {
    const fields = await recognizeCard(Buffer.from(await file.arrayBuffer()), file.type);
    if (!fields.is_business_card) {
      return NextResponse.json(
        { notDocument: true, error: `Это не визитка${fields.reason ? `: ${fields.reason}` : ""}. Ничего не сохранено.` },
        { status: 422 }
      );
    }
    return NextResponse.json({ fields });
  } catch (e) {
    console.error("Ошибка распознавания:", e);
    let message = e instanceof Error ? e.message : String(e);
    if (e instanceof Anthropic.AuthenticationError) message = "неверный ANTHROPIC_API_KEY";
    else if (e instanceof Anthropic.RateLimitError) message = "слишком много запросов, попробуйте через минуту";
    else if (e instanceof Anthropic.APIError) message = `Claude API ${e.status}: ${e.message}`;
    return NextResponse.json({ error: `Не удалось распознать: ${message}` }, { status: 502 });
  }
}
