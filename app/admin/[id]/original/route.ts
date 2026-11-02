import { NextResponse } from "next/server";
import { createServiceClient, createUserClient } from "@/lib/supabase/server";

// Открывает оригинал документа: временная ссылка на 5 минут, только для вошедшего владельца.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createUserClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));

  const { data: row } = await supabase.from("requests").select("document_path").eq("id", id).maybeSingle();
  if (!row?.document_path) return new NextResponse("У этой карточки нет оригинала", { status: 404 });

  const { data, error } = await createServiceClient().storage.from("documents").createSignedUrl(row.document_path, 300);
  if (error || !data) return new NextResponse(`Не удалось открыть файл: ${error?.message}`, { status: 500 });
  return NextResponse.redirect(data.signedUrl);
}
