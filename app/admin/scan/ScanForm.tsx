"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MAX_BYTES, prepareFile } from "@/lib/image-client";

type Fields = {
  name: string; phone: string; email: string; company: string;
  position: string; website: string; address: string;
};

export default function ScanForm() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [fields, setFields] = useState<Fields | null>(null);
  const [notes, setNotes] = useState("");
  const [state, setState] = useState<"idle" | "reading" | "review" | "saving">("idle");
  const [error, setError] = useState("");
  const [notDocument, setNotDocument] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function reset() {
    setFile(null); setPreview(""); setFields(null); setNotes("");
    setError(""); setNotDocument(false); setErrors({}); setState("idle");
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;
    reset();
    setState("reading");
    const prepared = await prepareFile(picked);
    if (prepared.size > MAX_BYTES) {
      setError("Файл больше 4 МБ. Сфотографируйте ещё раз или уменьшите PDF.");
      setState("idle");
      return;
    }
    setFile(prepared);
    setPreview(URL.createObjectURL(prepared));

    const body = new FormData();
    body.append("file", prepared);
    try {
      const res = await fetch("/api/scan", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotDocument(!!data.notDocument);
        setError(data.error ?? `Ошибка сервера: ${res.status}`);
        setState("idle");
        return;
      }
      const f = data.fields as Fields;
      setFields(f);
      setNotes([f.position && `Должность: ${f.position}`, f.website && `Сайт: ${f.website}`, f.address && `Адрес: ${f.address}`]
        .filter(Boolean).join("\n"));
      setState("review");
    } catch (err) {
      setError(`Нет связи с сервером: ${err instanceof Error ? err.message : ""}`);
      setState("idle");
    }
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !fields) return;
    setState("saving"); setError(""); setErrors({});
    const body = new FormData();
    body.append("file", file);
    for (const k of ["name", "phone", "email", "company"] as const) body.append(k, fields[k]);
    body.append("notes", notes);
    body.append("comment", "Добавлен со скана визитки");
    const res = await fetch("/api/scan/save", { method: "POST", body });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.id) {
      router.push(`/admin/${data.id}`);
      return;
    }
    if (data.errors) setErrors(data.errors);
    setError(data.error ?? "Проверьте поля, отмеченные красным");
    setState("review");
  }

  const set = (k: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setFields((f) => (f ? { ...f, [k]: e.target.value } : f));

  return (
    <div className="scan">
      {state !== "review" && state !== "saving" && (
        <label className="upload">
          <input type="file" accept="image/*,application/pdf" onChange={onPick} disabled={state === "reading"} hidden />
          <span className="btn">{state === "reading" ? "Распознаём… (10–30 сек)" : "📷 Выбрать фото или PDF"}</span>
        </label>
      )}

      {error && (
        <div className={notDocument ? "notice notice-warn" : "notice notice-error"}>
          <b>{notDocument ? "⚠️ Документ не распознан" : "Ошибка"}</b>
          <p>{error}</p>
          {notDocument && <p className="small">Загрузите фото или PDF визитки.</p>}
        </div>
      )}

      {preview && file && (
        <div className="scan-grid">
          <div className="scan-preview">
            {file.type === "application/pdf"
              ? <iframe src={preview} title="PDF" />
              : <img src={preview} alt="Загруженный файл" />}
          </div>

          {fields && (
            <form className="form" onSubmit={onSave}>
              <h2 className="subhead">Проверьте данные</h2>
              <p className="muted small">Исправьте, если Claude ошибся. Пока вы не нажмёте «Сохранить», ничего не записывается.</p>
              <label>Имя<input value={fields.name} onChange={set("name")} aria-invalid={!!errors.name} />
                {errors.name && <span className="error">{errors.name}</span>}</label>
              <label>Телефон<input type="tel" value={fields.phone} onChange={set("phone")} aria-invalid={!!errors.phone} />
                {errors.phone && <span className="error">{errors.phone}</span>}</label>
              <label>Email<input type="email" value={fields.email} onChange={set("email")} /></label>
              <label>Компания<input value={fields.company} onChange={set("company")} /></label>
              <label>Заметки<textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
              <div className="row">
                <button className="btn" disabled={state === "saving"}>{state === "saving" ? "Сохраняем…" : "Сохранить в воронку"}</button>
                <button type="button" className="btn btn-outline" onClick={reset}>Отмена</button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
