# Floria — сайт заявок на цветы

Лендинг цветочного магазина с формой заявки, админ-панелью и уведомлениями в Telegram.

**Стек:** Next.js 15 (App Router) · Supabase (база + вход) · Telegram Bot API · Vercel.

| Страница | Что делает |
|---|---|
| `/` | Лендинг и форма заявки (имя, телефон, комментарий, с проверкой) |
| `/api/requests` | Серверная функция: проверяет заявку, сохраняет в Supabase, шлёт сообщение в Telegram |
| `/login` | Вход владельца (email + пароль, Supabase Auth) |
| `/admin` | Список заявок, свежие сверху, фильтр по статусу |
| `/admin/[id]` | Карточка заявки и смена статуса |

Без входа `/admin` перенаправляет на `/login`, а сама база закрыта Row Level Security: анонимный ключ не может прочитать ни одной заявки.

---

## Настройка (шаг за шагом)

### 1. Supabase
1. Зайдите на https://supabase.com → **New project**. Регион: Frankfurt (eu-central-1). Пароль базы сохраните.
2. **SQL Editor → New query**, вставьте содержимое файла `supabase/schema.sql`, нажмите **Run**.
3. **Authentication → Users → Add user → Create new user**: ваш email и пароль, галочка **Auto Confirm User**. Это логин в админку.
4. **Authentication → Sign In / Providers**: выключите **Allow new users to sign up**, чтобы никто другой не смог зарегистрироваться.
5. **Project Settings → API Keys** (в старом интерфейсе **API**) скопируйте:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` `secret` key → `SUPABASE_SERVICE_ROLE_KEY` (никому не показывать!)

### 2. Telegram-бот
1. В Telegram откройте **@BotFather** → `/newbot`, задайте имя и username (должен заканчиваться на `bot`).
2. BotFather пришлёт токен вида `123456:ABC...` → это `TELEGRAM_BOT_TOKEN`.
3. Откройте своего бота и нажмите **Start** (иначе бот не сможет вам писать).
4. Узнайте свой chat id: напишите **@userinfobot**, он ответит числом `Id` → это `TELEGRAM_CHAT_ID`.

### 3. GitHub
Создайте пустой репозиторий и загрузите туда код (без файлов `.env*`, они уже в `.gitignore`).

### 4. Vercel
1. https://vercel.com → войти через GitHub → **Add New → Project** → выберите репозиторий.
2. Перед **Deploy** откройте **Environment Variables** и добавьте 5 переменных из `.env.example` с реальными значениями.
3. **Deploy**. Через минуту сайт будет по ссылке вида `https://<имя>.vercel.app`.
4. Если переменные меняли после деплоя: **Deployments → … → Redeploy**.

### 5. Проверка для сдачи
1. Откройте сайт с телефона, отправьте тестовую заявку → увидите «Спасибо».
2. В Telegram придёт сообщение с именем, телефоном, комментарием и временем → скриншот.
3. Откройте `/admin`, войдите → та же заявка вверху списка с тем же именем и временем → скриншот.

## Локальный запуск
```bash
cp .env.example .env.local   # заполнить значения
npm install
npm run dev                  # http://localhost:3000
```

## Безопасность
- Все ключи только в переменных окружения Vercel (и в локальном `.env.local`, который не попадает в Git).
- `service_role` ключ и токен бота используются только на сервере (`/api/requests`), в браузер не попадают.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` по замыслу публичный, но с RLS он не даёт читать или менять заявки без входа.
