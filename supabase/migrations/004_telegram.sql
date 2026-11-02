-- Тема 2, блок 3: Telegram Mini App.
-- Запускать ОДИН раз в Supabase: SQL Editor → New query → вставить весь файл → Run.

-- Кто из Telegram оставил заявку (id проверен сервером по подписи бота)
alter table public.requests add column if not exists telegram_id bigint;
alter table public.requests add column if not exists telegram_username text;
create index if not exists requests_telegram_id_idx on public.requests (telegram_id);
