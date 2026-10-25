import { redirect } from "next/navigation";
import { createUserClient } from "@/lib/supabase/server";
import { STATUSES, formatDate, isStatus, type RequestRow } from "@/lib/requests";
import AdminHeader from "./AdminHeader";

export const dynamic = "force-dynamic";

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const supabase = await createUserClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { status } = await searchParams;
  const filter = isStatus(status) ? status : null;

  let query = supabase.from("requests").select("*").order("created_at", { ascending: false });
  if (filter) query = query.eq("status", filter);
  const { data, error } = await query.returns<RequestRow[]>();

  return (
    <main className="admin">
      <AdminHeader email={user.email} />
      <h1>Заявки</h1>

      <nav className="filters">
        <a href="/admin" className={!filter ? "active" : ""}>Все</a>
        {Object.entries(STATUSES).map(([key, label]) => (
          <a key={key} href={`/admin?status=${key}`} className={filter === key ? "active" : ""}>{label}</a>
        ))}
      </nav>

      {error && <p className="error">Ошибка загрузки: {error.message}</p>}
      {data && data.length === 0 && <p className="muted">Заявок нет.</p>}

      <ul className="list">
        {data?.map((r) => (
          <li key={r.id}>
            <a href={`/admin/${r.id}`} className="list-item">
              <div>
                <b>{r.name}</b> <span className="muted">· {r.phone}</span>
                <p className="muted small clamp">{r.comment}</p>
              </div>
              <div className="list-meta">
                <span className={`badge badge-${r.status}`}>{STATUSES[r.status]}</span>
                <span className="muted small">{formatDate(r.created_at)}</span>
              </div>
            </a>
          </li>
        ))}
      </ul>
    </main>
  );
}
