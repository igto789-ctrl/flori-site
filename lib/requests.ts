export const STATUSES = {
  new: "Новая",
  in_progress: "В работе",
  closed: "Закрыта",
} as const;

export type Status = keyof typeof STATUSES;

export type RequestRow = {
  id: string;
  name: string;
  phone: string;
  comment: string;
  status: Status;
  created_at: string;
};

export function isStatus(value: unknown): value is Status {
  return typeof value === "string" && value in STATUSES;
}

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
