import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

// Какие файлы принимаем. Фото с телефона браузер сжимает до JPEG перед отправкой.
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export const PDF_TYPE = "application/pdf";
export const MAX_FILE_BYTES = 4 * 1024 * 1024; // лимит тела запроса на Vercel — 4,5 МБ

type ImageType = (typeof IMAGE_TYPES)[number];

export function isAllowedType(type: string): type is ImageType | typeof PDF_TYPE {
  return type === PDF_TYPE || (IMAGE_TYPES as readonly string[]).includes(type);
}

const CardSchema = z.object({
  is_business_card: z.boolean(),
  reason: z.string(),
  name: z.string(),
  phone: z.string(),
  email: z.string(),
  company: z.string(),
  position: z.string(),
  website: z.string(),
  address: z.string(),
});

export type CardFields = z.infer<typeof CardSchema>;

const PROMPT = `Ты распознаёшь визитки для CRM цветочного магазина в Молдове.
Посмотри на файл и реши, визитка ли это (печатная карточка с контактами человека или компании).

Если это НЕ визитка (селфи, пейзаж, чек, скриншот, пустой лист и т.п.):
is_business_card = false, в reason коротко по-русски напиши, что на изображении, остальные поля — пустые строки.

Если это визитка: is_business_card = true, reason = "".
Перенеси данные точно как напечатано, ничего не придумывай. Если поля нет — пустая строка.
- name: имя и фамилия человека (если человека нет — название компании)
- phone: основной телефон в международном виде, например +373 69 123 456 (для молдавских номеров без кода добавь +373)
- email, company, position (должность), website, address — как на визитке.`;

// Отправляет фото или PDF в Claude и получает поля визитки в строгом формате.
export async function recognizeCard(data: Buffer, mediaType: string): Promise<CardFields> {
  const client = new Anthropic(); // ключ берётся из ANTHROPIC_API_KEY

  const file: Anthropic.ContentBlockParam =
    mediaType === PDF_TYPE
      ? { type: "document", source: { type: "base64", media_type: PDF_TYPE, data: data.toString("base64") } }
      : { type: "image", source: { type: "base64", media_type: mediaType as ImageType, data: data.toString("base64") } };

  const response = await client.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 4000,
    output_config: { effort: "low", format: zodOutputFormat(CardSchema) },
    messages: [{ role: "user", content: [file, { type: "text", text: PROMPT }] }],
  });

  if (response.stop_reason === "refusal") throw new Error("Claude отказался обрабатывать этот файл");
  if (!response.parsed_output) throw new Error("Claude вернул ответ в неожиданном формате");
  return response.parsed_output;
}
