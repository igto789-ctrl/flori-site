// Этапы воронки продаж цветочного магазина, в порядке колонок на доске.
// "rejected" (Отказ) — отдельный конечный этап.
export const STAGES = {
  new: "Новая",
  contacted: "Связались",
  agreed: "Букет согласован",
  paid: "Оплачено",
  delivered: "Доставлено",
  rejected: "Отказ",
} as const;

export type Stage = keyof typeof STAGES;
export const STAGE_KEYS = Object.keys(STAGES) as Stage[];

export function isStage(value: unknown): value is Stage {
  return typeof value === "string" && value in STAGES;
}

// Откуда пришёл клиент. telegram и document — заготовка для следующих блоков задания.
export const SOURCES = {
  site: "Сайт",
  manual: "Вручную",
  card: "Визитка",
  telegram: "Telegram",
  document: "Документ",
} as const;

export type Source = keyof typeof SOURCES;

export type RequestRow = {
  id: string;
  name: string;
  phone: string;
  comment: string;
  notes: string;
  email?: string;
  company?: string;
  document_path?: string | null;
  source: Source;
  stage: Stage;
  created_at: string;
};

export type StageHistoryRow = {
  id: number;
  request_id: string;
  from_stage: Stage | null;
  to_stage: Stage;
  changed_at: string;
};

// Одна и та же функция форматирует время в Telegram и в админ-панели, чтобы оно совпадало.
export function formatDate(iso: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Chisinau",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export type RequestInput = { name: string; phone: string; comment: string };

// Проверка используется и в браузере (форма), и на сервере (API).
export function validateRequest(data: Partial<Record<keyof RequestInput, unknown>>) {
  const errors: Partial<Record<keyof RequestInput, string>> = {};
  const name = String(data.name ?? "").trim();
  const phone = String(data.phone ?? "").trim();
  const comment = String(data.comment ?? "").trim();

  if (name.length < 2) errors.name = "Введите имя (минимум 2 символа)";
  else if (name.length > 100) errors.name = "Слишком длинное имя";

  const digits = phone.replace(/\D/g, "");
  if (!/^\+?[\d\s()-]+$/.test(phone) || digits.length < 8 || digits.length > 15)
    errors.phone = "Введите корректный номер, например +373 69 123 456";

  if (comment.length < 3) errors.comment = "Напишите, какие цветы вам нужны";
  else if (comment.length > 1000) errors.comment = "Не более 1000 символов";

  return { errors, value: { name, phone, comment } as RequestInput, ok: Object.keys(errors).length === 0 };
}

// Ручное добавление клиента: комментарий необязателен.
export function validateClient(data: Partial<Record<"name" | "phone" | "comment" | "notes", unknown>>) {
  const { errors } = validateRequest({ ...data, comment: "ok!" });
  const comment = String(data.comment ?? "").trim();
  const notes = String(data.notes ?? "").trim();
  if (comment.length > 1000) errors.comment = "Не более 1000 символов";
  return {
    ok: Object.keys(errors).length === 0,
    errors,
    value: { name: String(data.name ?? "").trim(), phone: String(data.phone ?? "").trim(), comment, notes },
  };
}
