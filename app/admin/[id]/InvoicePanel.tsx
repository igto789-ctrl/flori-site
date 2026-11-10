"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BOUQUETS } from "@/lib/catalog";
import { DEFAULT_DUE_DAYS } from "@/lib/company";
import { INVOICE_STATUS, formatDay, formatMoney, type InvoiceItem, type InvoiceRow } from "@/lib/invoices";
import { createInvoice, markInvoicePaid, sendInvoice } from "../invoice-actions";

type Line = { name: string; qty: string; price: string };
const emptyLine: Line = { name: "", qty: "1", price: "" };

// Счета клиента: «Выставить счёт» (позиции из каталога или свои), список счетов,
// открыть PDF, отправить в Telegram, отметить оплату.
export default function InvoicePanel({ requestId, invoices }: { requestId: string; invoices: InvoiceRow[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<Line[]>([{ ...emptyLine }]);
  const [dueDays, setDueDays] = useState(String(DEFAULT_DUE_DAYS));
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const total = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.price) || 0), 0);

  function setLine(i: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l, k) => (k === i ? { ...l, ...patch } : l)));
  }

  function pickBouquet(i: number, id: string) {
    const b = BOUQUETS.find((x) => x.id === id);
    if (b) setLine(i, { name: `Букет «${b.name}»`, price: String(b.price) });
  }

  function run(fn: () => Promise<{ ok?: true; error?: string; message?: string }>, after?: () => void) {
    setNote(null);
    start(async () => {
      const res = await fn();
      setNote(res.error ? { ok: false, text: res.error } : { ok: true, text: res.message ?? "Готово" });
      if (!res.error) after?.();
      router.refresh();
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const items: InvoiceItem[] = lines.map((l) => ({ name: l.name, qty: Number(l.qty), price: Number(l.price) }));
    run(() => createInvoice(requestId, items, Number(dueDays)), () => {
      setOpen(false);
      setLines([{ ...emptyLine }]);
    });
  }

  return (
    <section>
      <h2 className="subhead">Счета</h2>

      {!open && (
        <button className="btn" onClick={() => setOpen(true)} disabled={pending}>🧾 Выставить счёт</button>
      )}

      {open && (
        <form onSubmit={submit} className="form form-full invoice-form">
          {lines.map((l, i) => (
            <div key={i} className="invoice-line">
              <select defaultValue="" onChange={(e) => pickBouquet(i, e.target.value)} aria-label="Букет из каталога">
                <option value="">Из каталога…</option>
                {BOUQUETS.map((b) => <option key={b.id} value={b.id}>{b.name} — {b.price} лей</option>)}
              </select>
              <input placeholder="Наименование (букет, доставка…)" value={l.name} onChange={(e) => setLine(i, { name: e.target.value })} />
              <input type="number" min={1} step={1} placeholder="Кол-во" value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value })} />
              <input type="number" min={0} step="0.01" placeholder="Цена, лей" value={l.price} onChange={(e) => setLine(i, { price: e.target.value })} />
              {lines.length > 1 && (
                <button type="button" className="btn btn-small btn-ghost" onClick={() => setLines((ls) => ls.filter((_, k) => k !== i))}>✕</button>
              )}
            </div>
          ))}
          <div className="invoice-actions">
            <button type="button" className="btn btn-small btn-ghost" onClick={() => setLines((ls) => [...ls, { ...emptyLine }])}>+ Позиция</button>
            <label className="inline">Срок оплаты, дней
              <input type="number" min={0} max={90} value={dueDays} onChange={(e) => setDueDays(e.target.value)} />
            </label>
            <b>Итого: {formatMoney(total)}</b>
          </div>
          <div className="invoice-actions">
            <button className="btn" disabled={pending}>{pending ? "Создаём PDF…" : "Создать счёт"}</button>
            <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)} disabled={pending}>Отмена</button>
          </div>
        </form>
      )}

      {note && <p className={note.ok ? "success" : "error"}>{note.text}</p>}

      {invoices.length === 0 ? (
        <p className="muted">Счетов пока нет.</p>
      ) : (
        <table className="invoice-table">
          <thead>
            <tr><th>№</th><th>Дата</th><th>Сумма</th><th>Оплатить до</th><th>Статус</th><th></th></tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id}>
                <td><b>{inv.number}</b></td>
                <td>{formatDay(inv.issued_at)}</td>
                <td>{formatMoney(Number(inv.total))}</td>
                <td>{formatDay(inv.due_date)}</td>
                <td>
                  <span className={`badge invoice-${inv.status}`}>{INVOICE_STATUS[inv.status]}</span>
                  {inv.sent_at && <div className="muted small">отправлен {inv.sent_to}</div>}
                </td>
                <td className="invoice-buttons">
                  {inv.pdf_path && <a className="btn btn-small btn-ghost" href={`/admin/invoices/${inv.id}`} target="_blank" rel="noopener">📄 PDF</a>}
                  {inv.pdf_path && (
                    <button className="btn btn-small btn-ghost" disabled={pending} onClick={() => run(() => sendInvoice(inv.id))}>
                      ✈️ {inv.sent_at ? "Ещё раз" : "В Telegram"}
                    </button>
                  )}
                  {inv.status === "unpaid" && (
                    <button className="btn btn-small" disabled={pending} onClick={() => run(() => markInvoicePaid(inv.id))}>✅ Оплачен</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
