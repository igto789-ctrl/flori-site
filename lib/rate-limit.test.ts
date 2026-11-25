import { describe, expect, it } from "vitest";
import { clientIp, limitKey, windowEnd } from "./rate-limit";

const req = (headers: Record<string, string>) => new Request("https://x.test/api", { headers });

describe("clientIp", () => {
  it("берёт x-real-ip", () => {
    expect(clientIp(req({ "x-real-ip": "1.2.3.4", "x-forwarded-for": "9.9.9.9" }))).toBe("1.2.3.4");
  });
  it("иначе первый адрес из x-forwarded-for без пробелов", () => {
    expect(clientIp(req({ "x-forwarded-for": " 5.6.7.8 , 10.0.0.1" }))).toBe("5.6.7.8");
  });
  it("без заголовков — unknown (общий лимит)", () => {
    expect(clientIp(req({}))).toBe("unknown");
  });
});

describe("limitKey", () => {
  it("всегда содержит размер окна, чтобы окна не пересекались", () => {
    expect(limitKey("ip", "1.2.3.4", 60)).toBe("ip:1.2.3.4:60");
    expect(limitKey("ip", "1.2.3.4", 86400)).toBe("ip:1.2.3.4:86400");
    expect(limitKey("gen", "u1", 86400)).toBe("gen:u1:86400");
  });
});

describe("windowEnd", () => {
  it("конец суточного окна — следующая полночь UTC", () => {
    expect(windowEnd(new Date("2026-11-25T13:00:00Z"), 86400).toISOString()).toBe("2026-11-26T00:00:00.000Z");
  });
});
