-- Выполните этот скрипт в Supabase: SQL Editor → New query → Run

create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 100),
  phone text not null check (char_length(phone) between 6 and 30),
  comment text not null check (char_length(comment) between 1 and 1000),
  status text not null default 'new' check (status in ('new', 'in_progress', 'closed')),
  created_at timestamptz not null default now()
);

create index if not exists requests_created_at_idx on public.requests (created_at desc);

-- Row Level Security: без входа никто не видит и не меняет заявки.
alter table public.requests enable row level security;

-- Читать и менять статус может только вошедший пользователь (владелец).
-- Регистрацию новых пользователей нужно отключить в Authentication → Sign In / Providers.
drop policy if exists "admin can read" on public.requests;
create policy "admin can read" on public.requests
  for select to authenticated using (true);

drop policy if exists "admin can update" on public.requests;
create policy "admin can update" on public.requests
  for update to authenticated using (true) with check (true);

-- Политики на insert нет специально: заявки добавляет только сервер (серверная функция на Vercel)
-- с service_role ключом, который обходит RLS и хранится только в переменных Vercel.
