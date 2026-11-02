import { redirect } from "next/navigation";
import { createUserClient } from "@/lib/supabase/server";
import type { RequestRow } from "@/lib/requests";
import AdminHeader from "./AdminHeader";
import Board from "./Board";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = await createUserClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("requests")
    .select("id, name, phone, comment, notes, source, stage, created_at")
    .order("created_at", { ascending: false })
    .returns<RequestRow[]>();

  return (
    <main className="admin admin-wide">
      <AdminHeader email={user.email} />
      <div className="board-head">
        <div>
          <h1>Воронка продаж</h1>
          <p className="muted small">Перетащите карточку в другую колонку или выберите этап в списке на карточке.</p>
        </div>
        <a href="/admin/new" className="btn btn-small">+ Добавить клиента</a>
      </div>
      {error && <p className="error">Ошибка загрузки: {error.message}</p>}
      <Board initial={data ?? []} />
    </main>
  );
}
