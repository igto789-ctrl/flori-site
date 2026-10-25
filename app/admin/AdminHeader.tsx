import { signOut } from "./actions";

export default function AdminHeader({ email }: { email?: string }) {
  return (
    <header className="nav">
      <a href="/admin" className="logo">🌸 Заявки</a>
      <form action={signOut} className="row">
        <span className="muted small hide-mobile">{email}</span>
        <button className="btn btn-small btn-outline">Выйти</button>
      </form>
    </header>
  );
}
