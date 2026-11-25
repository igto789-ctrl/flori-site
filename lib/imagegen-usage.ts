import { DAILY_LIMIT } from "@/lib/imagegen";
import { usedInWindow, windowEnd } from "@/lib/rate-limit";

export const GEN_WINDOW_SEC = 24 * 60 * 60;

// Сколько генераций занято в текущих сутках (UTC) и когда лимит обнулится.
// Тот же счётчик, что и при резервировании в /api/generate — один источник правды.
export async function usage(userId: string) {
  const used = await usedInWindow("gen", userId, GEN_WINDOW_SEC);
  const remaining = Math.max(0, DAILY_LIMIT - used);
  return { used, remaining, nextAt: remaining === 0 ? windowEnd(new Date(), GEN_WINDOW_SEC) : null };
}
