import { notFound, redirect } from "next/navigation";
import { createUserClient } from "@/lib/supabase/server";
import { SOURCES, STAGES, formatDate, type RequestRow, type StageHistoryRow } from "@/lib/requests";
import { saveNotes } from "../actions";
import StageControl from "./StageControl";
import AdminHeader from "../AdminHeader";

export const dynamic = "force-dynamic";

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createUserClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: r }, { data: history }] = await Promise.all([
    supabase.from("requests").select("*").eq("id", id).maybeSingle<RequestRow>(),
    supabase.from("stage_history").select("*").eq("request_id", id)
      .order("changed_at", { ascending: true }).returns<StageHistoryRow[]>(),
  ]);
  if (!r) notFound();

  return (
    <main className="admin">
      <AdminHeader email={user.email} />
      <p><a href="/admin">← Воронка</a></p>
      <div className="detail">
        <h1>{r.name}</h1>
        <span className={`badge stage-${r.stage}`}>{STAGES[r.stage]}</span>
        <dl>
          <dt>Телефон</dt><dd><a href={`tel:${r.phone.replace(/[^\d+]/g, "")}`}>{r.phone}</a></dd>
          <dt>Источник</dt><dd><span className={`badge source-${r.source}`}>{SOURCES[r.source] ?? r.source}</span></dd>
          <dt>Создан</dt><dd>{formatDate(r.created_at)}</dd>
          {r.company && (<><dt>Компания</dt><dd>{r.company}</dd></>)}
          {r.email && (<><dt>Email</dt><dd><a href={`mailto:${r.email}`}>{r.email}</a></dd></>)}
          {r.document_path && (<><dt>Оригинал</dt><dd><a href={`/admin/${r.id}/original`} target="_blank" rel="noopener">📎 Открыть документ</a></dd></>)}
          {r.comment && (<><dt>Комментарий</dt><dd className="pre">{r.comment}</dd></>)}
        </dl>

        <StageControl key={r.stage} id={r.id} stage={r.stage} />

        <h2 className="subhead">Заметки</h2>
        <form key={r.notes} action={saveNotes} className="form form-full">
          <input type="hidden" name="id" value={r.id} />
          <textarea name="notes" rows={4} defaultValue={r.notes} placeholder="Например: хочет пионы, доставка в субботу к 12:00, звонить после 18:00" />
          <div><button className="btn btn-small">Сохранить заметки</button></div>
        </form>

        <h2 className="subhead">История этапов</h2>
        {!history?.length && <p className="muted">История пуста.</p>}
        <ol className="history">
          {history?.map((h) => (
            <li key={h.id}>
              <span className="muted small">{formatDate(h.changed_at)}</span>
              <span>
                {h.from_stage ? <>{STAGES[h.from_stage] ?? h.from_stage} → </> : <>Создан → </>}
                <b>{STAGES[h.to_stage] ?? h.to_stage}</b>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </main>
  );
}
