import { redirect } from "next/navigation";
import { createUserClient } from "@/lib/supabase/server";
import AdminHeader from "../AdminHeader";
import ScanForm from "./ScanForm";

export const dynamic = "force-dynamic";

export default async function ScanPage() {
  const supabase = await createUserClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="admin">
      <AdminHeader email={user.email} />
      <p><a href="/admin">← Воронка</a></p>
      <h1>Скан визитки</h1>
      <p className="muted">
        Сфотографируйте визитку телефоном или загрузите PDF. Claude распознает контакты,
        вы проверите их, и клиент появится в воронке на этапе «Новая» с источником «Визитка».
      </p>
      <ScanForm />
    </main>
  );
}
