// Сборка PDF счёта — только на сервере (читает шрифты с диска).
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { COMPANY } from "./company";
import { formatDay, formatMoney, type InvoiceRow } from "./invoices";

let fontCache: { regular: Uint8Array; bold: Uint8Array } | null = null;
async function loadFonts() {
  if (!fontCache) {
    const dir = path.join(process.cwd(), "lib", "fonts");
    const [regular, bold] = await Promise.all([
      readFile(path.join(dir, "NotoSans-Regular.ttf")),
      readFile(path.join(dir, "NotoSans-Bold.ttf")),
    ]);
    fontCache = { regular, bold };
  }
  return fontCache;
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const test = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(test, size) <= maxWidth) line = test;
    else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

export async function buildInvoicePdf(
  inv: Pick<InvoiceRow, "number" | "issued_at" | "due_date" | "items" | "total">,
  client: { name: string; phone: string; email?: string; company?: string }
) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const fonts = await loadFonts();
  const font = await doc.embedFont(fonts.regular, { subset: true });
  const bold = await doc.embedFont(fonts.bold, { subset: true });
  doc.setTitle(`Счёт № ${inv.number}`);
  doc.setAuthor(COMPANY.name);

  const page: PDFPage = doc.addPage([595.28, 841.89]); // A4
  const M = 50;
  const W = 595.28 - M * 2;
  const ink = rgb(0.09, 0.13, 0.21);
  const muted = rgb(0.42, 0.45, 0.5);
  const accent = rgb(0.91, 0.36, 0.54);
  let y = 841.89 - M;

  const text = (s: string, x: number, size = 10, f = font, color = ink) => page.drawText(s, { x, y, size, font: f, color });
  const right = (s: string, xRight: number, size = 10, f = font, color = ink) =>
    page.drawText(s, { x: xRight - f.widthOfTextAtSize(s, size), y, size, font: f, color });

  // Шапка
  text("Floria", M, 22, bold, accent);
  right("доставка цветов в Кишинёве", M + W, 10, font, muted);
  y -= 40;
  text(`Счёт на оплату № ${inv.number}`, M, 18, bold);
  y -= 20;
  text(`от ${formatDay(inv.issued_at)} · оплатить до ${formatDay(inv.due_date)}`, M, 11, font, muted);
  y -= 30;

  // Продавец / покупатель
  const colW = W / 2 - 10;
  const block = (title: string, lines: string[], x: number) => {
    let yy = y;
    page.drawText(title, { x, y: yy, size: 9, font: bold, color: muted });
    yy -= 15;
    for (const l of lines.filter(Boolean)) {
      for (const w of wrap(l, font, 10, colW)) {
        page.drawText(w, { x, y: yy, size: 10, font, color: ink });
        yy -= 13;
      }
    }
    return yy;
  };
  const yA = block("ПРОДАВЕЦ", [
    COMPANY.name,
    `IDNO: ${COMPANY.idno} · ${COMPANY.vat}`,
    COMPANY.address,
    `Банк: ${COMPANY.bank}`,
    `IBAN: ${COMPANY.iban}`,
    `BIC: ${COMPANY.bic}`,
    `Тел.: ${COMPANY.phone} · ${COMPANY.email}`,
  ], M);
  const yB = block("ПОКУПАТЕЛЬ", [client.name, client.company ?? "", `Тел.: ${client.phone}`, client.email ?? ""], M + W / 2 + 10);
  y = Math.min(yA, yB) - 20;

  // Таблица: правые края колонок
  const xQty = M + 300;
  const xPrice = M + 395;
  const xSum = M + W - 4;
  const nameW = xQty - 60 - (M + 24);
  page.drawRectangle({ x: M, y: y - 6, width: W, height: 22, color: rgb(0.96, 0.95, 0.97) });
  text("№", M + 4, 9, bold, muted);
  text("Наименование", M + 24, 9, bold, muted);
  right("Кол-во", xQty, 9, bold, muted);
  right("Цена", xPrice, 9, bold, muted);
  right("Сумма", xSum, 9, bold, muted);
  y -= 26;

  inv.items.forEach((it, i) => {
    const nameLines = wrap(it.name, font, 10, nameW);
    text(String(i + 1), M + 4);
    nameLines.forEach((l, k) => page.drawText(l, { x: M + 24, y: y - k * 13, size: 10, font, color: ink }));
    right(String(it.qty), xQty);
    right(formatMoney(it.price), xPrice);
    right(formatMoney(it.qty * it.price), xSum);
    const bottom = y - 13 * (nameLines.length - 1) - 7;
    page.drawLine({ start: { x: M, y: bottom }, end: { x: M + W, y: bottom }, thickness: 0.5, color: rgb(0.88, 0.88, 0.9) });
    y = bottom - 16;
  });

  y -= 6;
  right("Итого к оплате:", xPrice, 12, bold);
  right(formatMoney(inv.total), xSum, 12, bold, accent);
  y -= 30;
  text(`Срок оплаты: до ${formatDay(inv.due_date)}. В назначении платежа укажите «Счёт № ${inv.number}».`, M, 10);

  if (COMPANY.isDemo) {
    page.drawText("Учебный проект: реквизиты условные. Не является платёжным документом.", {
      x: M, y: M - 10, size: 8, font, color: muted,
    });
  }

  return doc.save();
}
