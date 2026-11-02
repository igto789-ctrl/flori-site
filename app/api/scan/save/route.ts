import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createServiceClient, createUserClient } from "@/lib/supabase/server";
import { validateClient } from "@/lib/requests";
import { MAX_FILE_BYTES, PDF_TYPE, isAllowedType } from "@/lib/scan";

// Шаг 2: после проверки владельцем сохраняем оригинал в Storage и создаём карточку в воронке.
export async function POST(req: Request) {
  const supabase = await createUserClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Сначала войдите в админку" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!form || !(file instanceof File) || !isAllowedType(file.type) || file.size > MAX_FILE_BYTES)
    return NextResponse.json({ error: "Файл не передан или не подходит" }, { status: 400 });

  const text = (k: string) => String(form.get(k) ?? "").trim();
  const check = validateClient({ name: text("name"), phone: text("phone"), comment: text("comment"), notes: text("notes") });
  if (!check.ok) return NextResponse.json({ errors: check.errors }, { status: 400 });

  const ext = file.type === PDF_TYPE ? "pdf" : file.type.split("/")[1].replace("jpeg", "jpg");
  const path = `cards/${randomUUID()}.${ext}`;
  const admin = createServiceClient();

  const upload = await admin.storage.from("documents").upload(path, file, { contentType: file.type });
  if (upload.error)
    return NextResponse.json({ error: `Не удалось сохранить оригинал: ${upload.error.message}` }, { status: 500 });

  const { data, error } = await supabase
    .from("requests")
    .insert({
      ...check.value,
      email: text("email").slice(0, 200),
      company: text("company").slice(0, 200),
      source: "card",
      stage: "new",
      document_path: path,
    })
    .select("id")
    .single();

  if (error || !data) {
    await admin.storage.from("documents").remove([path]); // не оставляем «сирот»
    return NextResponse.json({ error: `Не удалось создать карточку: ${error?.message}` }, { status: 500 });
  }
  return NextResponse.json({ id: data.id });
}
