"use client";

import { useActionState } from "react";
import { addClient } from "../actions";

export default function NewClientForm() {
  const [state, action, pending] = useActionState(addClient, undefined);
  const e = state?.errors ?? {};
  return (
    <form action={action} className="form">
      <label>
        Имя
        <input name="name" required placeholder="Мария" aria-invalid={!!e.name} />
        {e.name && <span className="error">{e.name}</span>}
      </label>
      <label>
        Телефон
        <input name="phone" type="tel" required placeholder="+373 69 123 456" aria-invalid={!!e.phone} />
        {e.phone && <span className="error">{e.phone}</span>}
      </label>
      <label>
        Что хочет клиент <span className="muted small">(необязательно)</span>
        <textarea name="comment" rows={3} placeholder="Букет на юбилей, бюджет до 800 лей" aria-invalid={!!e.comment} />
        {e.comment && <span className="error">{e.comment}</span>}
      </label>
      <label>
        Заметки <span className="muted small">(необязательно)</span>
        <textarea name="notes" rows={3} placeholder="Позвонила в 14:30, встреча в магазине" />
      </label>
      {state?.error && <p className="error">{state.error}</p>}
      <button className="btn" disabled={pending}>{pending ? "Сохраняем…" : "Добавить в воронку"}</button>
    </form>
  );
}
