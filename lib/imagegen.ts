// Генерация изображений через Google Gemini (Nano Banana). Вызывается ТОЛЬКО на сервере:
// ключ GEMINI_API_KEY живёт в переменных Vercel и в браузер не попадает.

export const DAILY_LIMIT = 5;
export const ASPECTS = ["1:1", "4:5", "9:16", "16:9"] as const;
export type Aspect = (typeof ASPECTS)[number];

export const PRESETS = [
  { id: "card", label: "Открытка", text: "Праздничная открытка: букет на светлом столе, мягкий дневной свет, лепестки, место для подписи сверху." },
  { id: "post", label: "Пост в Instagram", text: "Стильный пост для Instagram цветочного магазина: букет в интерьере уютной кофейни, тёплый свет, малая глубина резкости." },
  { id: "wedding", label: "Свадьба", text: "Свадебная сцена: букет в руках невесты на фоне белого платья, нежные пастельные тона, боке." },
  { id: "birthday", label: "День рождения", text: "Букет на праздничном столе с тортом и свечами, конфетти, радостное настроение." },
] as const;

const MODEL = process.env.GEMINI_IMAGE_MODEL?.trim() || "gemini-nano-banana-2.1";

type Part = {
  text?: string;
  inlineData?: { mimeType?: string; data?: string };
  inline_data?: { mime_type?: string; data?: string };
};

export class ImageGenError extends Error {}

export async function generateImage(opts: {
  prompt: string;
  aspect: Aspect;
  source?: { data: Buffer; mimeType: string };
}): Promise<{ data: Buffer; mimeType: string; model: string }> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new ImageGenError("Сервер не настроен: в Vercel нет переменной GEMINI_API_KEY");

  const instruction = opts.source
    ? `Используй букет с этого фото как главный объект, сохрани его цветы и цвета без изменений. Помести его в новую красивую сцену. Сцена: ${opts.prompt}`
    : `Фотореалистичное изображение для цветочного магазина Floria. ${opts.prompt}`;

  const parts: Record<string, unknown>[] = [{ text: instruction }];
  if (opts.source)
    parts.push({ inline_data: { mime_type: opts.source.mimeType, data: opts.source.data.toString("base64") } });

  const res = await fetch(`https://generativelanguage.googleapis.com/v1/models/${MODEL}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { imageConfig: { aspectRatio: opts.aspect } },
    }),
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = json?.error?.message ?? `HTTP ${res.status}`;
    throw new ImageGenError(`Google вернул ошибку: ${msg}`);
  }

  const out: Part[] = json?.candidates?.[0]?.content?.parts ?? [];
  for (const p of out) {
    const inline = p.inlineData ?? (p.inline_data && { mimeType: p.inline_data.mime_type, data: p.inline_data.data });
    if (inline?.data) return { data: Buffer.from(inline.data, "base64"), mimeType: inline.mimeType ?? "image/png", model: MODEL };
  }
  const why = out.find((p) => p.text)?.text ?? json?.promptFeedback?.blockReason ?? json?.candidates?.[0]?.finishReason;
  throw new ImageGenError(`Модель не вернула картинку${why ? `: ${String(why).slice(0, 300)}` : ""}`);
}
