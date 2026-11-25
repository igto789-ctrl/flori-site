import { describe, expect, it } from "vitest";
import { escapeHtml } from "./telegram";

describe("escapeHtml", () => {
  it("имя клиента не превращается в разметку Telegram", () => {
    expect(escapeHtml('<a href="https://x">Оплатить</a>')).toBe('&lt;a href="https://x"&gt;Оплатить&lt;/a&gt;');
  });
  it("экранирует &", () => {
    expect(escapeHtml("Цветы & Ко")).toBe("Цветы &amp; Ко");
  });
});
