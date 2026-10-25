"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createUserClient } from "@/lib/supabase/server";
import { isStatus } from "@/lib/requests";

export async function updateStatus(formData: FormData) {
  const id = String(formData.get("id"));
  const status = formData.get("status");
  if (!isStatus(status)) return;

  const supabase = await createUserClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase.from("requests").update({ status }).eq("id", id);
  revalidatePath("/admin");
  revalidatePath(`/admin/${id}`);
}

export async function signOut() {
  const supabase = await createUserClient();
  await supabase.auth.signOut();
  redirect("/login");
}
