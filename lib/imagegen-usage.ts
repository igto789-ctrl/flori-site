import type { createUserClient } from "@/lib/supabase/server";
import { DAILY_LIMIT } from "@/lib/imagegen";

const DAY_MS = 24 * 60 * 60 * 1000;

// Сколько генераций пользователь сделал за последние 24 часа и когда освободится следующая.
export async function usage(supabase: Awaited<ReturnType<typeof createUserClient>>) {
  const since = new Date(Date.now() - DAY_MS).toISOString();
  const { data } = await supabase
    .from("image_generations")
    .select("created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: true });
  const used = data?.length ?? 0;
  const nextAt = used >= DAILY_LIMIT && data?.[0] ? new Date(new Date(data[0].created_at).getTime() + DAY_MS) : null;
  return { used, remaining: Math.max(0, DAILY_LIMIT - used), nextAt };
}
