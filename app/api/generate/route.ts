import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createServiceClient, createUserClient } from "@/lib/supabase/server";
import { ASPECTS, DAILY_LIMIT, ImageGenError, generateImage, type Aspect } from "@/lib/imagegen";
import { GEN_WINDOW_SEC, usage } from "@/lib/imagegen-usage";
import { takeLimits } from "@/lib/rate-limit";
import { IMAGE_TYPES, MAX_FILE_BYTES } from "@/lib/scan";
import { isOwner } from "@/lib/auth";

export const maxDuration = 60;

// Браузер обращается только сюда (к нашему сайту). К Google ходит сервер со своим ключом.
export async function POST(req: Request) {
  const supabase = await createUserClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isOwner(user)) return NextResponse.json({ error: "Сначала войдите в админку" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const prompt = String(form?.get("prompt") ?? "").trim();
  const aspect = String(form?.get("aspect") ?? "1:1") as Aspect;
  const photo = form?.get("photo");
  if (prompt.length < 3) return NextResponse.json({ error: "Опишите сцену (хотя бы пару слов)" }, { status: 400 });
  if (prompt.length > 2000) return NextResponse.json({ error: "Описание слишком длинное" }, { status: 400 });
  if (!ASPECTS.includes(aspect)) return NextResponse.json({ error: "Неизвестный формат" }, { status: 400 });

  let source: { data: Buffer; mimeType: string } | undefined;
  if (photo instanceof File && photo.size > 0) {
    if (!(IMAGE_TYPES as readonly string[]).includes(photo.type))
      return NextResponse.json({ error: "Исходник должен быть фото (JPG, PNG)" }, { status: 400 });
    if (photo.size > MAX_FILE_BYTES) return NextResponse.json({ error: "Фото больше 4 МБ" }, { status: 400 });
    source = { data: Buffer.from(await photo.arrayBuffer()), mimeType: photo.type };
  }

  // Слот занимается атомарно ДО обращения к Google: параллельные запросы не обойдут лимит. Слот не возвращается.
  if (!(await takeLimits([{ kind: "gen", id: user.id, limit: DAILY_LIMIT, windowSec: GEN_WINDOW_SEC }]))) {
    const limit = await usage(user.id);
    const when = limit.nextAt?.toLocaleTimeString("ru-RU", { timeZone: "Europe/Chisinau", hour: "2-digit", minute: "2-digit" });
    return NextResponse.json(
      { limit: true, error: `Лимит исчерпан: ${DAILY_LIMIT} генераций в сутки. Следующая будет доступна${when ? ` в ${when}` : " позже"}.` },
      { status: 429 }
    );
  }

  let image;
  try {
    image = await generateImage({ prompt, aspect, source });
  } catch (e) {
    console.error("Ошибка генерации:", e);
    const message = e instanceof ImageGenError ? e.message : "Не удалось связаться с Google";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const admin = createServiceClient();
  const id = randomUUID();
  const ext = (m: string) => (m.includes("png") ? "png" : m.includes("webp") ? "webp" : "jpg");
  const resultPath = `generations/${user.id}/${id}.${ext(image.mimeType)}`;
  const sourcePath = source ? `generations/${user.id}/${id}-source.${ext(source.mimeType)}` : null;

  const up = await admin.storage.from("documents").upload(resultPath, image.data, { contentType: image.mimeType });
  if (up.error) return NextResponse.json({ error: `Не удалось сохранить результат: ${up.error.message}` }, { status: 500 });
  if (source && sourcePath) await admin.storage.from("documents").upload(sourcePath, source.data, { contentType: source.mimeType });

  const { error } = await admin.from("image_generations").insert({
    id, user_id: user.id, prompt, aspect_ratio: aspect, source_path: sourcePath, result_path: resultPath, model: image.model,
  });
  if (error) return NextResponse.json({ error: `Не удалось записать в историю: ${error.message}` }, { status: 500 });

  const { data: signed } = await admin.storage.from("documents").createSignedUrl(resultPath, 3600);
  return NextResponse.json({ id, url: signed?.signedUrl, remaining: (await usage(user.id)).remaining });
}
