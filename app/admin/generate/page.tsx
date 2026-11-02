import { redirect } from "next/navigation";
import { createServiceClient, createUserClient } from "@/lib/supabase/server";
import { DAILY_LIMIT } from "@/lib/imagegen";
import { usage } from "@/lib/imagegen-usage";
import { formatDate } from "@/lib/requests";
import AdminHeader from "../AdminHeader";
import GenerateForm from "./GenerateForm";

export const dynamic = "force-dynamic";

type Gen = { id: string; prompt: string; aspect_ratio: string; source_path: string | null; result_path: string; created_at: string };

export default async function GeneratePage() {
  const supabase = await createUserClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: rows, error }, limit] = await Promise.all([
    supabase.from("image_generations").select("*").order("created_at", { ascending: false }).limit(30).returns<Gen[]>(),
    usage(supabase),
  ]);

  // Временные ссылки на файлы из закрытого хранилища (на 1 час)
  const paths = (rows ?? []).flatMap((r) => [r.result_path, r.source_path].filter((p): p is string => !!p));
  const urls = new Map<string, string>();
  if (paths.length) {
    const { data } = await createServiceClient().storage.from("documents").createSignedUrls(paths, 3600);
    data?.forEach((d) => { if (d.path && d.signedUrl) urls.set(d.path, d.signedUrl); });
  }

  return (
    <main className="admin">
      <AdminHeader email={user.email} />
      <p><a href="/admin">← Воронка</a></p>
      <h1>Фото для каталога и постов</h1>
      <p className="muted">
        Загрузите фото букета и выберите сцену. Нейросеть Nano Banana (Google) поместит букет в красивую обстановку
        для открытки или поста. Лимит: {DAILY_LIMIT} генераций за 24 часа.
      </p>

      <GenerateForm remaining={limit.remaining} />

      <h2 className="subhead">История генераций</h2>
      {error && <p className="error">Ошибка загрузки истории: {error.message}</p>}
      {!rows?.length && !error && <p className="muted">Пока ничего не сгенерировано.</p>}
      <div className="gen-history">
        {rows?.map((r) => (
          <article key={r.id} className="gen-card">
            <div className="gen-pair">
              {r.source_path && urls.get(r.source_path) && (
                <a href={urls.get(r.source_path)} target="_blank" rel="noopener" className="gen-thumb">
                  <img src={urls.get(r.source_path)} alt="Исходное фото" /><span>Исходник</span>
                </a>
              )}
              <a href={urls.get(r.result_path)} target="_blank" rel="noopener" className="gen-thumb gen-result">
                <img src={urls.get(r.result_path)} alt="Результат" /><span>Результат</span>
              </a>
            </div>
            <p className="small">{r.prompt}</p>
            <p className="muted small">{formatDate(r.created_at)} · {r.aspect_ratio}</p>
          </article>
        ))}
      </div>
    </main>
  );
}
