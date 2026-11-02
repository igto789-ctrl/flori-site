"use client";

import Script from "next/script";
import { useCallback, useState } from "react";
import { BOUQUETS, type Bouquet } from "@/lib/catalog";
import { formatDate } from "@/lib/requests";

type TgWebApp = {
  initData: string;
  platform: string;
  ready(): void;
  expand(): void;
  isVersionAtLeast?(v: string): boolean;
  requestFullscreen?(): void;
  disableVerticalSwipes?(): void;
  HapticFeedback?: { notificationOccurred(t: "success" | "error"): void };
};
declare global { interface Window { Telegram?: { WebApp?: TgWebApp } } }

type Me = { firstName: string; name: string; username: string | null };
type Order = { id: string; comment: string; stageLabel: string; created_at: string };

export default function MiniApp() {
  const [state, setState] = useState<"loading" | "outside" | "error" | "ready">("loading");
  const [me, setMe] = useState<Me | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState("");
  const [picked, setPicked] = useState<Bouquet | null>(null);
  const [phone, setPhone] = useState("");
  const [wish, setWish] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [phoneError, setPhoneError] = useState("");

  const initData = () => window.Telegram?.WebApp?.initData ?? "";

  const load = useCallback(async () => {
    const res = await fetch("/api/tg/me", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData: initData() }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? `Ошибка сервера: ${res.status}`);
      setState(res.status === 401 ? "outside" : "error");
      return;
    }
    setMe(data.user);
    setOrders(data.orders);
    setState("ready");
  }, []);

  function onTelegramLoaded() {
    const tg = window.Telegram?.WebApp;
    // Открыто не из Telegram (обычный браузер): данных нет, ничего не показываем.
    if (!tg || !tg.initData) {
      setState("outside");
      return;
    }
    tg.ready();
    tg.expand();
    tg.disableVerticalSwipes?.();
    const mobile = tg.platform === "ios" || tg.platform === "android";
    if (mobile && tg.isVersionAtLeast?.("8.0")) {
      try { tg.requestFullscreen?.(); } catch { /* старый клиент — остаёмся в expand */ }
    }
    load();
  }

  async function order(e: React.FormEvent) {
    e.preventDefault();
    if (!picked) return;
    setSending(true); setError(""); setPhoneError("");
    const res = await fetch("/api/tg/order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData: initData(), bouquetId: picked.id, phone, comment: wish }),
    });
    const data = await res.json().catch(() => ({}));
    setSending(false);
    if (!res.ok) {
      if (data.errors?.phone) setPhoneError(data.errors.phone);
      else setError(data.error ?? `Ошибка сервера: ${res.status}`);
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("error");
      return;
    }
    window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("success");
    setDone(true);
    load();
  }

  return (
    <main className="tg">
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="afterInteractive" onReady={onTelegramLoaded}
        onError={() => setState("outside")} />

      {state === "loading" && <p className="muted tg-center">Загрузка…</p>}

      {state === "outside" && (
        <div className="tg-center">
          <p className="tg-big">🌸</p>
          <h1>Floria в Telegram</h1>
          <p className="muted">Это приложение работает только внутри Telegram.<br />Откройте бота и нажмите кнопку «Заказать».</p>
          <a className="btn" href="https://t.me/floria777_bot">Открыть @floria777_bot</a>
        </div>
      )}

      {state === "error" && <p className="error tg-center">{error}</p>}

      {state === "ready" && me && (
        <>
          <header className="tg-head">
            <h1>Здравствуйте, {me.firstName}! 🌷</h1>
            <p className="muted">Выберите букет, и флорист перезвонит вам в течение 15 минут.</p>
          </header>

          {done ? (
            <div className="success">
              <h3>Спасибо, {me.firstName}!</h3>
              <p>Заказ «{picked?.name}» принят. Мы позвоним на номер {phone}.</p>
              <button className="btn btn-outline" onClick={() => { setDone(false); setPicked(null); setWish(""); }}>
                Заказать ещё
              </button>
            </div>
          ) : (
            <>
              <div className="tg-grid">
                {BOUQUETS.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    className={`tg-item${picked?.id === b.id ? " tg-item-active" : ""}`}
                    onClick={() => setPicked(b)}
                  >
                    <span className={`tg-emoji tone-${b.tone}`}>{b.emoji}</span>
                    <b>{b.name}</b>
                    <span className="muted small">{b.desc}</span>
                    <span className="price">{b.price} лей</span>
                  </button>
                ))}
              </div>

              {picked && (
                <form className="form tg-form" onSubmit={order}>
                  <h2 className="subhead">Заказ: {picked.name}</h2>
                  <label>
                    Телефон для связи
                    <input type="tel" value={phone} onChange={(e) => { setPhone(e.target.value); setPhoneError(""); }}
                      placeholder="+373 69 123 456" autoComplete="tel" aria-invalid={!!phoneError} />
                    {phoneError && <span className="error">{phoneError}</span>}
                  </label>
                  <label>
                    Пожелания <span className="muted small">(необязательно)</span>
                    <textarea rows={3} value={wish} onChange={(e) => setWish(e.target.value)} placeholder="Доставка в субботу к 12:00, открытка «С днём рождения»" />
                  </label>
                  {error && <p className="error">{error}</p>}
                  <button className="btn" disabled={sending}>{sending ? "Отправляем…" : `Заказать за ${picked.price} лей`}</button>
                </form>
              )}
            </>
          )}

          {orders.length > 0 && (
            <section className="tg-orders">
              <h2 className="subhead">Мои заказы</h2>
              <ul className="list">
                {orders.map((o) => (
                  <li key={o.id} className="list-item">
                    <div>
                      <b>{o.comment.split(".")[0]}</b>
                      <p className="muted small">{formatDate(o.created_at)}</p>
                    </div>
                    <span className="badge stage-new">{o.stageLabel}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </main>
  );
}
