// Счета: типы, проверка позиций и форматирование (работает и в браузере, и на сервере).
// PDF собирается отдельно, только на сервере: lib/invoice-pdf.ts.
import { INVOICE_CURRENCY } from "./company";

export type InvoiceItem = { name: string; qty: number; price: number };

export type InvoiceRow = {
  id: string;
  number: number;
  request_id: string;
  issued_at: string; // YYYY-MM-DD
  due_date: string; // YYYY-MM-DD
  items: InvoiceItem[];
  total: number;
  status: "unpaid" | "paid";
  pdf_path: string | null;
  sent_at: string | null;
  sent_to: string | null;
  paid_at: string | null;
  created_at: string;
};

export const INVOICE_STATUS = { unpaid: "Не оплачен", paid: "Оплачен" } as const;

const round2 = (n: number) => Math.round(n * 100) / 100;

export function validateItems(raw: unknown): { ok: true; items: InvoiceItem[]; total: number } | { ok: false; error: string } {
  if (!Array.isArray(raw)) return { ok: false, error: "Нет позиций" };
  const items: InvoiceItem[] = [];
  for (const r of raw as Record<string, unknown>[]) {
    const name = String(r?.name ?? "").trim();
    const qty = Number(r?.qty);
    const price = Number(r?.price);
    if (!name && !qty && !price) continue; // пустая строка формы
    if (name.length < 2 || name.length > 120) return { ok: false, error: "Название позиции: от 2 до 120 символов" };
    if (!Number.isInteger(qty) || qty < 1 || qty > 1000) return { ok: false, error: `«${name}»: количество — целое от 1 до 1000` };
    if (!Number.isFinite(price) || price < 0 || price > 1_000_000) return { ok: false, error: `«${name}»: некорректная цена` };
    items.push({ name, qty, price: round2(price) });
  }
  if (items.length === 0) return { ok: false, error: "Добавьте хотя бы одну позицию" };
  if (items.length > 20) return { ok: false, error: "Не более 20 позиций" };
  const total = round2(items.reduce((s, i) => s + i.qty * i.price, 0));
  return { ok: true, items, total };
}

export function formatMoney(n: number) {
  return `${new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)} ${INVOICE_CURRENCY}`;
}

export function formatDay(isoDate: string) {
  const [y, m, d] = isoDate.slice(0, 10).split("-");
  return `${d}.${m}.${y}`;
}

export function invoiceFileName(n: number) {
  return `Floria-schet-${String(n).padStart(4, "0")}.pdf`;
}
