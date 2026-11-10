import { NextResponse } from "next/server";
import { createServiceClient, createUserClient } from "@/lib/supabase/server";

// Открывает PDF счёта: временная ссылка на 5 минут, только для вошедшего владельца.
export async function GET(req: Request, { params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params;
  const supabase = await createUserClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));

  const { data: inv } = await supabase.from("invoices").select("pdf_path").eq("id", invoiceId).maybeSingle();
  if (!inv?.pdf_path) return new NextResponse("PDF счёта не найден", { status: 404 });

  const { data, error } = await createServiceClient().storage.from("invoices").createSignedUrl(inv.pdf_path, 300);
  if (error || !data) return new NextResponse(`Не удалось открыть PDF: ${error?.message}`, { status: 500 });
  return NextResponse.redirect(data.signedUrl);
}
