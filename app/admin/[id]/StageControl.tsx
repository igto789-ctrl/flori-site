"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { STAGES, STAGE_KEYS, type Stage } from "@/lib/requests";
import { moveStage } from "../actions";

// Управляемый выбор этапа: после переноса список показывает новый этап,
// а не сбрасывается к старому значению.
export default function StageControl({ id, stage }: { id: string; stage: Stage }) {
  const router = useRouter();
  const [value, setValue] = useState<Stage>(stage);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (value === stage) return;
    setError("");
    startTransition(async () => {
      const res = await moveStage(id, value);
      if (res && "error" in res && res.error) setError(res.error);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="status-form">
      <label>
        Этап воронки
        <select value={value} onChange={(e) => setValue(e.target.value as Stage)} disabled={pending}>
          {STAGE_KEYS.map((s) => <option key={s} value={s}>{STAGES[s]}</option>)}
        </select>
      </label>
      <button className="btn" disabled={pending || value === stage}>{pending ? "Переносим…" : "Перенести"}</button>
      {error && <p className="error">{error}</p>}
    </form>
  );
}
