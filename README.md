# Floria — сайт и CRM цветочного магазина

Лендинг цветочного магазина с формой заявки, CRM с воронкой продаж и уведомлениями в Telegram.

**Стек:** Next.js 15 (App Router) · Supabase (база + вход) · Telegram Bot API · Vercel.

| Страница | Что делает |
|---|---|
| `/` | Лендинг и форма заявки (имя, телефон, комментарий, с проверкой) |
| `/api/requests` | Серверная функция: проверяет заявку, сохраняет в Supabase, шлёт сообщение в Telegram |
| `/login` | Вход владельца (email + пароль, Supabase Auth) |
| `/admin` | CRM: доска воронки, карточки перетаскиваются между этапами |
| `/admin/new` | Добавить клиента вручную (звонок, встреча), источник «Вручную» |
| `/admin/scan` | Скан визитки: фото или PDF → Claude распознаёт контакты → экран проверки → клиент в воронке с источником «Визитка» |
| `/tg` | Telegram Mini App: каталог букетов и заказ. Пользователь определяется по подписи Telegram (проверка на сервере), заказ попадает в CRM с источником «Telegram» |
| `/admin/generate` | Генерация фото для каталога и постов (Nano Banana / Gemini): фото букета + сцена → картинка, история, лимит 5 за 24 ч |
| `/api/voice-lead` | Заявка от голосового агента ElevenLabs (источник «Голос»), доступ только с секретом `X-Voice-Secret` |
| `/api/mcp` | Свой MCP-сервер CRM: `list_requests`, `find_client`, `change_stage` (в истории с пометкой «MCP»). Доступ только с `Authorization: Bearer MCP_TOKEN` |
| `/admin/[id]` → «Счета» | Кнопка «Выставить счёт»: позиции из каталога или свои, PDF (номер по порядку, реквизиты, итог, срок оплаты) в закрытом хранилище, отправка в Telegram, статус «Не оплачен / Оплачен»; оплата переводит карточку в «Оплачено». Реквизиты — `lib/company.ts` (демо) |
| `/admin/[id]` | Карточка клиента: имя, телефон, источник, дата, заметки, история этапов с датами |

**Воронка:** Новая → Связались → Букет согласован → Оплачено → Доставлено, плюс «Отказ».
Заявка с сайта автоматически попадает в «Новая» с источником «Сайт». История переходов
записывается самой базой (триггер в `supabase/migrations/002_crm.sql`).

Без входа `/admin` перенаправляет на `/login`, а сама база закрыта Row Level Security: анонимный ключ не может прочитать ни одной заявки.

---

## Настройка (шаг за шагом)

### 1. Supabase
1. Зайдите на https://supabase.com → **New project**. Регион: Frankfurt (eu-central-1). Пароль базы сохраните.
2. **SQL Editor → New query**, вставьте содержимое файла `supabase/schema.sql`, нажмите **Run**. Затем так же запустите `supabase/migrations/002_crm.sql` (CRM). Если база из Темы 1 уже есть — запускайте только `002_crm.sql`.
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

## Распознавание визиток (Claude API)
1. Запустите в Supabase `supabase/migrations/003_business_cards.sql` (поля email/company, хранилище `documents`).
2. Получите ключ на https://console.anthropic.com → API Keys и добавьте его в Vercel как `ANTHROPIC_API_KEY`.
3. Файл сначала только распознаётся (`/api/scan`), сохраняется он и карточка после проверки (`/api/scan/save`).
   Если загружена не визитка, сервер отвечает понятным сообщением и ничего не сохраняет.
   Оригинал лежит в закрытом хранилище и открывается из карточки по временной ссылке.

## Telegram Mini App
1. Запустите `supabase/migrations/004_telegram.sql`.
2. В @BotFather: `/mybots` → бот → **Bot Settings → Menu Button** → URL `https://<сайт>/tg`, текст «Заказать».
3. Mini App шлёт `initData` на `/api/tg/me` и `/api/tg/order`; сервер проверяет подпись токеном `TELEGRAM_BOT_TOKEN`.
   В обычном браузере подписи нет, поэтому API отвечает 401, а страница просит открыть бота.

## Генерация изображений (Nano Banana)
1. Запустите `supabase/migrations/005_image_generations.sql`.
2. Ключ Google AI Studio (https://aistudio.google.com/apikey) → переменная Vercel `GEMINI_API_KEY`.
   Модель по умолчанию `gemini-nano-banana-2.1`, её можно сменить переменной `GEMINI_IMAGE_MODEL`.
3. Браузер отправляет запрос только на `/api/generate`. К Google обращается сервер, ключ в браузер не попадает.
   Результат и исходник сохраняются в Storage, запись попадает в `image_generations`. Лимит: 5 за 24 часа на пользователя (ответ 429 с понятным текстом).

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
