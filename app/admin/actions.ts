"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createUserClient } from "@/lib/supabase/server";
import { isStage, validateClient } from "@/lib/requests";

async function requireUser() {
  const supabase = await createUserClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return supabase;
}

// Перенос карточки на другой этап. Историю записывает сама база (триггер).
export async function moveStage(id: string, stage: string) {
  if (!isStage(stage)) return { error: "Неизвестный этап" };
  const supabase = await requireUser();
  const { error } = await supabase.from("requests").update({ stage }).eq("id", id);
  revalidatePath("/admin");
  revalidatePath(`/admin/${id}`);
  return error ? { error: error.message } : { ok: true };
}

export async function saveNotes(formData: FormData) {
  const id = String(formData.get("id"));
  const notes = String(formData.get("notes") ?? "").slice(0, 5000);
  const supabase = await requireUser();
  await supabase.from("requests").update({ notes }).eq("id", id);
  revalidatePath(`/admin/${id}`);
}

export type AddClientState = { errors?: Record<string, string>; error?: string } | undefined;

export async function addClient(_prev: AddClientState, formData: FormData): Promise<AddClientState> {
  const check = validateClient(Object.fromEntries(formData));
  if (!check.ok) return { errors: check.errors };

  const supabase = await requireUser();
  const { data, error } = await supabase
    .from("requests")
    .insert({ ...check.value, source: "manual", stage: "new" })
    .select("id")
    .single();
  if (error || !data) return { error: `Не удалось сохранить: ${error?.message ?? "неизвестная ошибка"}` };

  revalidatePath("/admin");
  redirect(`/admin/${data.id}`);
}

export async function signOut() {
  const supabase = await createUserClient();
  await supabase.auth.signOut();
  redirect("/login");
}
