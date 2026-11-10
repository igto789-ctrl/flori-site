-- Тема 3, блок 6: счета (инвойсы) в PDF.
-- Запускать ОДИН раз в Supabase: SQL Editor → New query → вставить весь файл → Run.

-- 1. Номер счёта по порядку: последовательность в базе не выдаёт один номер дважды.
create sequence if not exists public.invoice_number_seq start 1;

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  number integer not null unique default nextval('public.invoice_number_seq'),
  request_id uuid not null references public.requests (id) on delete cascade,
  issued_at date not null default (now() at time zone 'Europe/Chisinau')::date,
  due_date date not null,
  items jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) > 0),
  total numeric(12, 2) not null check (total >= 0),
  status text not null default 'unpaid' check (status in ('unpaid', 'paid')),
  pdf_path text,
  sent_at timestamptz,
  sent_to text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
alter sequence public.invoice_number_seq owned by public.invoices.number;
create index if not exists invoices_request_idx on public.invoices (request_id, created_at desc);

-- 2. Доступ только вошедшему владельцу (как к заявкам).
alter table public.invoices enable row level security;
drop policy if exists "admin can read invoices" on public.invoices;
create policy "admin can read invoices" on public.invoices for select to authenticated using (true);
drop policy if exists "admin can insert invoices" on public.invoices;
create policy "admin can insert invoices" on public.invoices for insert to authenticated with check (true);
drop policy if exists "admin can update invoices" on public.invoices;
create policy "admin can update invoices" on public.invoices for update to authenticated using (true) with check (true);

-- 3. Закрытое хранилище PDF. Политик нет: файлы кладёт и выдаёт только сервер после проверки входа.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('invoices', 'invoices', false, 5242880, array['application/pdf'])
on conflict (id) do update set public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
