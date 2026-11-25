// Лимиты частоты в базе (таблица rate_limits, миграция 010). Работают на Vercel между экземплярами функций.

export type LimitKind = "ip" | "tg" | "gen" | "scan";
export type LimitRule = { kind: LimitKind; id: string; limit: number; windowSec: number };

// Ключ всегда содержит размер окна: минутное и суточное окна одного IP не смешиваются.
export function limitKey(kind: LimitKind, id: string, windowSec: number) {
  return `${kind}:${id}:${windowSec}`;
}

// IP посетителя. На Vercel эти заголовки ставит сама платформа (подменить их запросом нельзя).
export function clientIp(req: Request) {
  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real;
  const first = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return first || "unknown";
}

// Конец окна фиксированной длины, в котором находится момент `at` (окна выровнены по эпохе, т. е. по UTC).
export function windowEnd(at: Date, windowSec: number) {
  const ms = windowSec * 1000;
  return new Date(Math.floor(at.getTime() / ms) * ms + ms);
}

async function service() {
  const { createServiceClient } = await import("@/lib/supabase/server");
  return createServiceClient();
}

// Атомарно занимает слот во всех окнах сразу: либо все счётчики +1 (true), либо ни один (false).
// Ошибка базы → false: публичные формы закрываются, а не пропускают всех (fail-closed). Слоты не возвращаются.
export async function takeLimits(rules: LimitRule[]): Promise<boolean> {
  const { data, error } = await (await service()).rpc("take_rate_limits", {
    p_keys: rules.map((r) => limitKey(r.kind, r.id, r.windowSec)),
    p_limits: rules.map((r) => r.limit),
    p_windows: rules.map((r) => r.windowSec),
  });
  if (error) {
    console.error("rate limit RPC:", error.message);
    return false;
  }
  return data !== null;
}

// Сколько слотов занято в текущем окне (для «Осталось сегодня»).
export async function usedInWindow(kind: LimitKind, id: string, windowSec: number): Promise<number> {
  const { data, error } = await (await service()).rpc("get_rate_limit", {
    p_key: limitKey(kind, id, windowSec),
    p_window: windowSec,
  });
  if (error) {
    console.error("rate limit RPC:", error.message);
    return Number.MAX_SAFE_INTEGER;
  }
  return Number(data ?? 0);
}
