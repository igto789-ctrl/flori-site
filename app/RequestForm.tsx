"use client";

import { useState } from "react";
import { validateRequest, type RequestInput } from "@/lib/requests";

type Errors = Partial<Record<keyof RequestInput, string>>;

export default function RequestForm() {
  const [values, setValues] = useState<RequestInput>({ name: "", phone: "", comment: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");

  function update(field: keyof RequestInput, value: string) {
    setValues((v) => ({ ...v, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const check = validateRequest(values);
    if (!check.ok) {
      setErrors(check.errors);
      return;
    }
    setState("sending");
    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(check.value),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setState("done");
      } else {
        if (data.errors) setErrors(data.errors);
        setState("error");
      }
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div className="success">
        <h3>Спасибо, {values.name}! 🌷</h3>
        <p>Заявка принята. Флорист перезвонит вам по номеру {values.phone} в течение 15 минут.</p>
        <button className="btn btn-outline" onClick={() => { setValues({ name: "", phone: "", comment: "" }); setState("idle"); }}>
          Отправить ещё одну
        </button>
      </div>
    );
  }

  return (
    <form className="form" onSubmit={onSubmit} noValidate>
      <label>
        Имя
        <input value={values.name} onChange={(e) => update("name", e.target.value)} autoComplete="name" placeholder="Анна" aria-invalid={!!errors.name} />
        {errors.name && <span className="error">{errors.name}</span>}
      </label>
      <label>
        Телефон
        <input type="tel" value={values.phone} onChange={(e) => update("phone", e.target.value)} autoComplete="tel" placeholder="+373 69 123 456" aria-invalid={!!errors.phone} />
        {errors.phone && <span className="error">{errors.phone}</span>}
      </label>
      <label>
        Комментарий
        <textarea rows={4} value={values.comment} onChange={(e) => update("comment", e.target.value)} placeholder="Букет «Розовое утро» на субботу к 12:00" aria-invalid={!!errors.comment} />
        {errors.comment && <span className="error">{errors.comment}</span>}
      </label>
      {state === "error" && <p className="error">Не удалось отправить заявку. Проверьте данные и попробуйте ещё раз.</p>}
      <button className="btn" type="submit" disabled={state === "sending"}>
        {state === "sending" ? "Отправляем…" : "Отправить заявку"}
      </button>
    </form>
  );
}
