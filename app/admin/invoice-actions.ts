"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServiceClient, createUserClient } from "@/lib/supabase/server";
import { DEFAULT_DUE_DAYS } from "@/lib/company";
import { formatDay, formatMoney, invoiceFileName, validateItems, type InvoiceRow } from "@/lib/invoices";
import { buildInvoicePdf } from "@/lib/invoice-pdf";
import { sendTelegramDocument } from "@/lib/telegram";
import type { RequestRow } from "@/lib/requests";

async function requireUser() {
  const supabase = await createUserClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return supabase;
}

type Result = { ok?: true; error?: string; message?: string };

function addDays(isoDate: string, days: number) {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// «Выставить счёт»: номер по порядку выдаёт база, PDF сохраняется в закрытое хранилище.
export async function createInvoice(requestId: string, rawItems: unknown, dueDays: number): Promise<Result> {
  const supabase = await requireUser();
  const check = validateItems(rawItems);
  if (!check.ok) return { error: check.error };
  const days = Number.isInteger(dueDays) && dueDays >= 0 && dueDays <= 90 ? dueDays : DEFAULT_DUE_DAYS;

  const { data: client } = await supabase.from("requests").select("*").eq("id", requestId).maybeSingle<RequestRow>();
  if (!client) return { error: "Карточка не найдена" };

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Chisinau" }).format(new Date());
  const { data: inv, error } = await supabase
    .from("invoices")
    .insert({ request_id: requestId, issued_at: today, due_date: addDays(today, days), items: check.items, total: check.total })
    .select()
    .single<InvoiceRow>();
  if (error || !inv) return { error: `Не удалось создать счёт: ${error?.message ?? "неизвестная ошибка"}` };

  try {
    const pdf = await buildInvoicePdf(inv, client);
    const pdfPath = `${requestId}/${invoiceFileName(inv.number)}`;
    const service = createServiceClient();
    const up = await service.storage.from("invoices").upload(pdfPath, pdf, { contentType: "application/pdf", upsert: true });
    if (up.error) throw new Error(up.error.message);
    await supabase.from("invoices").update({ pdf_path: pdfPath }).eq("id", inv.id);
  } catch (e) {
    console.error("PDF счёта:", e);
    revalidatePath(`/admin/${requestId}`);
    return { error: `Счёт № ${inv.number} создан, но PDF не сохранился: ${e instanceof Error ? e.message : e}` };
  }

  revalidatePath(`/admin/${requestId}`);
  return { ok: true, message: `Счёт № ${inv.number} на ${formatMoney(inv.total)} создан` };
}

async function loadInvoice(invoiceId: string) {
  const supabase = await requireUser();
  const { data: inv } = await supabase.from("invoices").select("*").eq("id", invoiceId).maybeSingle<InvoiceRow>();
  if (!inv) return { supabase, inv: null, client: null };
  const { data: client } = await supabase.from("requests").select("*").eq("id", inv.request_id).maybeSingle<RequestRow>();
  return { supabase, inv, client };
}

// Отправка в Telegram: клиенту, если он пришёл из Mini App; иначе владельцу — чтобы переслать.
export async function sendInvoice(invoiceId: string): Promise<Result> {
  const { supabase, inv, client } = await loadInvoice(invoiceId);
  if (!inv || !client) return { error: "Счёт не найден" };
  if (!inv.pdf_path) return { error: "У счёта нет PDF" };

  const { data: file, error } = await createServiceClient().storage.from("invoices").download(inv.pdf_path);
  if (error || !file) return { error: `Не удалось прочитать PDF: ${error?.message}` };
  const pdf = new Uint8Array(await file.arrayBuffer());

  const caption =
    `🌸 <b>Floria — счёт № ${inv.number}</b>\n` +
    `Сумма: <b>${formatMoney(Number(inv.total))}</b>\nОплатить до: ${formatDay(inv.due_date)}`;

  let sentTo: string;
  let err: string | null;
  if (client.telegram_id) {
    err = await sendTelegramDocument(client.telegram_id, pdf, invoiceFileName(inv.number), `${client.name}, ${caption}`);
    sentTo = `клиенту в Telegram${client.telegram_username ? ` @${client.telegram_username}` : ""}`;
  } else {
    const owner = process.env.TELEGRAM_CHAT_ID?.trim();
    if (!owner) return { error: "У клиента нет Telegram, а TELEGRAM_CHAT_ID не задан" };
    err = await sendTelegramDocument(owner, pdf, invoiceFileName(inv.number),
      `${caption}\n\nДля: ${client.name}, ${client.phone}. У клиента нет Telegram — перешлите ему счёт.`);
    sentTo = "владельцу в Telegram (у клиента нет Telegram)";
  }
  if (err) return { error: `Не отправлено: ${err}` };

  await supabase.from("invoices").update({ sent_at: new Date().toISOString(), sent_to: sentTo }).eq("id", inv.id);
  revalidatePath(`/admin/${inv.request_id}`);
  return { ok: true, message: `Счёт № ${inv.number} отправлен ${sentTo}` };
}

// Отметка об оплате: счёт → «Оплачен», карточка → этап «Оплачено» (в истории с пометкой счёта).
export async function markInvoicePaid(invoiceId: string): Promise<Result> {
  const { supabase, inv, client } = await loadInvoice(invoiceId);
  if (!inv || !client) return { error: "Счёт не найден" };
  if (inv.status === "paid") return { ok: true, message: "Счёт уже оплачен" };

  const { error } = await supabase.from("invoices")
    .update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", inv.id).eq("status", "unpaid");
  if (error) return { error: error.message };

  if (client.stage !== "paid") {
    const { error: e2 } = await createServiceClient()
      .rpc("set_stage_via", { p_id: client.id, p_stage: "paid", p_via: `Счёт № ${inv.number}` });
    if (e2) return { error: `Счёт отмечен, но этап не сменился: ${e2.message}` };
  }
  revalidatePath("/admin");
  revalidatePath(`/admin/${inv.request_id}`);
  return { ok: true, message: `Счёт № ${inv.number} оплачен, карточка на этапе «Оплачено»` };
}
