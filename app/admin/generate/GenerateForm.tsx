"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ASPECTS, DAILY_LIMIT, PRESETS, type Aspect } from "@/lib/imagegen";
import { MAX_BYTES, prepareFile } from "@/lib/image-client";

export default function GenerateForm({ remaining: initialRemaining }: { remaining: number }) {
  const router = useRouter();
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [prompt, setPrompt] = useState<string>(PRESETS[0].text);
  const [aspect, setAspect] = useState<Aspect>("1:1");
  const [state, setState] = useState<"idle" | "working">("idle");
  const [error, setError] = useState("");
  const [isLimit, setIsLimit] = useState(false);
  const [result, setResult] = useState("");
  const [remaining, setRemaining] = useState(initialRemaining);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const prepared = await prepareFile(f);
    if (prepared.size > MAX_BYTES) { setError("Фото больше 4 МБ"); return; }
    setError("");
    setPhoto(prepared);
    setPreview(URL.createObjectURL(prepared));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState("working"); setError(""); setIsLimit(false); setResult("");
    const body = new FormData();
    body.append("prompt", prompt);
    body.append("aspect", aspect);
    if (photo) body.append("photo", photo);
    try {
      const res = await fetch("/api/generate", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setIsLimit(!!data.limit);
        if (data.limit) setRemaining(0);
        setError(data.error ?? `Ошибка сервера: ${res.status}`);
      } else {
        setResult(data.url);
        setRemaining(data.remaining);
        router.refresh(); // обновить историю
      }
    } catch (err) {
      setError(`Нет связи с сервером: ${err instanceof Error ? err.message : ""}`);
    }
    setState("idle");
  }

  return (
    <div className="gen">
      <form className="form gen-form" onSubmit={onSubmit}>
        <label>
          Фото букета <span className="muted small">(необязательно, без фото нейросеть нарисует букет сама)</span>
          <input type="file" accept="image/*" onChange={onPick} />
        </label>
        {preview && (
          <div className="gen-preview">
            <img src={preview} alt="Исходное фото" />
            <button type="button" className="btn btn-small btn-outline" onClick={() => { setPhoto(null); setPreview(""); }}>Убрать фото</button>
          </div>
        )}

        <div>
          <b>Сцена</b>
          <div className="filters">
            {PRESETS.map((p) => (
              <button key={p.id} type="button" className={`chip${prompt === p.text ? " chip-active" : ""}`} onClick={() => setPrompt(p.text)}>
                {p.label}
              </button>
            ))}
          </div>
          <textarea rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} aria-label="Описание сцены" />
        </div>

        <label>
          Формат
          <select value={aspect} onChange={(e) => setAspect(e.target.value as Aspect)}>
            {ASPECTS.map((a) => (
              <option key={a} value={a}>{a}{a === "1:1" ? " — квадрат" : a === "4:5" ? " — пост" : a === "9:16" ? " — сторис" : " — баннер"}</option>
            ))}
          </select>
        </label>

        <p className="muted small">Осталось сегодня: <b>{remaining}</b> из {DAILY_LIMIT}</p>
        <button className="btn" disabled={state === "working"}>
          {state === "working" ? "Генерируем… (15–40 сек)" : "✨ Сгенерировать"}
        </button>
      </form>

      {error && (
        <div className={isLimit ? "notice notice-warn" : "notice notice-error"}>
          <b>{isLimit ? "⏳ Лимит генераций" : "Ошибка"}</b>
          <p>{error}</p>
        </div>
      )}

      {result && (
        <div className="gen-out">
          <h2 className="subhead">Результат</h2>
          <img src={result} alt="Сгенерированное изображение" />
          <a className="btn btn-small btn-outline" href={result} target="_blank" rel="noopener" download>Открыть в полном размере</a>
        </div>
      )}
    </div>
  );
}
