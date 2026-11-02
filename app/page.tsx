import RequestForm from "./RequestForm";
import { BOUQUETS } from "@/lib/catalog";


export default function Home() {
  return (
    <main>
      <header className="nav">
        <span className="logo">🌸 Floria</span>
        <a href="#order" className="btn btn-small">Заказать</a>
      </header>

      <section className="hero">
        <h1>Свежие цветы с доставкой за 2 часа</h1>
        <p>Собираем букеты в день заказа из цветов, которые привезли утром. Доставляем по всему Кишинёву.</p>
        <a href="#order" className="btn">Оставить заявку</a>
      </section>

      <section className="section">
        <h2>Популярные букеты</h2>
        <div className="grid">
          {BOUQUETS.map((b) => (
            <article key={b.name} className="card">
              <div className={`card-img tone-${b.tone}`} aria-hidden>{b.emoji}</div>
              <h3>{b.name}</h3>
              <p className="muted">{b.desc}</p>
              <p className="price">{b.price} лей</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section features">
        <div><b>🚚 Доставка 2 часа</b><p className="muted">Бесплатно от 600 лей</p></div>
        <div><b>📸 Фото перед отправкой</b><p className="muted">Покажем букет до доставки</p></div>
        <div><b>🌿 Свежесть 7 дней</b><p className="muted">Или заменим букет</p></div>
      </section>

      <section className="section" id="order">
        <h2>Оставить заявку</h2>
        <p className="muted">Напишите, какой букет и к какому дню нужен. Флорист перезвонит в течение 15 минут.</p>
        <RequestForm />
      </section>

      <footer className="footer">© {new Date().getFullYear()} Floria · Кишинёв · <a href="/admin">Вход для владельца</a></footer>
    </main>
  );
}
