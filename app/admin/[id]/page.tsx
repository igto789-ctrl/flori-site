import { notFound, redirect } from "next/navigation";
import { createUserClient } from "@/lib/supabase/server";
import { STATUSES, formatDate, type RequestRow } from "@/lib/requests";
import { updateStatus } from "../actions";
import AdminHeader from "../AdminHeader";

export const dynamic = "force-dynamic";

export default async function RequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createUserClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: r } = await supabase.from("requests").select("*").eq("id", id).maybeSingle<RequestRow>();
  if (!r) notFound();

  return (
    <main className="admin">
      <AdminHeader email={user.email} />
      <p><a href="/admin">← Все заявки</a></p>
      <div className="detail">
        <h1>{r.name}</h1>
        <span className={`badge badge-${r.status}`}>{STATUSES[r.status]}</span>
        <dl>
          <dt>Телефон</dt><dd><a href={`tel:${r.phone.replace(/[^\d+]/g, "")}`}>{r.phone}</a></dd>
          <dt>Комментарий</dt><dd className="pre">{r.comment}</dd>
          <dt>Создана</dt><dd>{formatDate(r.created_at)}</dd>
        </dl>
        <form action={updateStatus} className="status-form">
          <input type="hidden" name="id" value={r.id} />
          <label>
            Статус
            <select name="status" defaultValue={r.status}>
              {Object.entries(STATUSES).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </label>
          <button className="btn">Сохранить</button>
        </form>
      </div>
    </main>
  );
}
