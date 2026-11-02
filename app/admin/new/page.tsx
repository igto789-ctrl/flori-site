import { redirect } from "next/navigation";
import { createUserClient } from "@/lib/supabase/server";
import AdminHeader from "../AdminHeader";
import NewClientForm from "./NewClientForm";

export const dynamic = "force-dynamic";

export default async function NewClientPage() {
  const supabase = await createUserClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="admin">
      <AdminHeader email={user.email} />
      <p><a href="/admin">← Воронка</a></p>
      <h1>Новый клиент</h1>
      <p className="muted">Для клиентов, которые позвонили или пришли в магазин. Источник будет «Вручную», этап «Новая».</p>
      <NewClientForm />
    </main>
  );
}
