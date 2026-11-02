"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SOURCES, STAGES, STAGE_KEYS, formatDate, type RequestRow, type Stage } from "@/lib/requests";
import { moveStage } from "./actions";

export default function Board({ initial }: { initial: RequestRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<Stage | null>(null);
  const [error, setError] = useState("");
  const [, startTransition] = useTransition();

  // Если данные на сервере обновились (router.refresh) — берём свежие.
  const [prevInitial, setPrevInitial] = useState(initial);
  if (initial !== prevInitial) {
    setPrevInitial(initial);
    setRows(initial);
  }

  function move(id: string, stage: Stage) {
    const card = rows.find((r) => r.id === id);
    if (!card || card.stage === stage) return;
    setError("");
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, stage } : r)));
    startTransition(async () => {
      const res = await moveStage(id, stage);
      if (res && "error" in res && res.error) {
        setError(`Не удалось перенести «${card.name}»: ${res.error}`);
        setRows((rs) => rs.map((r) => (r.id === id ? { ...r, stage: card.stage } : r)));
      }
      router.refresh();
    });
  }

  return (
    <>
      {error && <p className="error">{error}</p>}
      <div className="board">
        {STAGE_KEYS.map((stage) => {
          const cards = rows.filter((r) => r.stage === stage);
          return (
            <section
              key={stage}
              className={`column column-${stage}${over === stage ? " column-over" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setOver(stage); }}
              onDragLeave={() => setOver((o) => (o === stage ? null : o))}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                const id = e.dataTransfer.getData("text/plain") || dragId;
                if (id) move(id, stage);
              }}
            >
              <h2 className="column-title">
                {STAGES[stage]} <span className="count">{cards.length}</span>
              </h2>
              {cards.length === 0 && <p className="muted small empty">Пусто</p>}
              {cards.map((r) => (
                <article
                  key={r.id}
                  className={`deal${dragId === r.id ? " deal-dragging" : ""}`}
                  draggable
                  onDragStart={(e) => { e.dataTransfer.setData("text/plain", r.id); setDragId(r.id); }}
                  onDragEnd={() => setDragId(null)}
                >
                  <a href={`/admin/${r.id}`} className="deal-name">{r.name}</a>
                  <div className="muted small">{r.phone}</div>
                  <div className="deal-meta">
                    <span className={`badge source-${r.source}`}>{SOURCES[r.source] ?? r.source}</span>
                    <span className="muted small">{formatDate(r.created_at)}</span>
                  </div>
                  <select
                    className="deal-select"
                    aria-label="Этап"
                    value={r.stage}
                    onChange={(e) => move(r.id, e.target.value as Stage)}
                  >
                    {STAGE_KEYS.map((s) => <option key={s} value={s}>{STAGES[s]}</option>)}
                  </select>
                </article>
              ))}
            </section>
          );
        })}
      </div>
    </>
  );
}
