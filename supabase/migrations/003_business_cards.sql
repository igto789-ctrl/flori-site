-- Тема 2, блок 2: распознавание визиток.
-- Запускать ОДИН раз в Supabase: SQL Editor → New query → вставить весь файл → Run.

-- 1. Новый источник «Визитка» (card) и поля, которые есть на визитке
alter table public.requests drop constraint if exists requests_source_check;
alter table public.requests add constraint requests_source_check
  check (source in ('site', 'manual', 'card', 'telegram', 'document'));

alter table public.requests add column if not exists email text not null default '';
alter table public.requests add column if not exists company text not null default '';
-- Путь к оригиналу (фото или PDF) в хранилище Supabase Storage
alter table public.requests add column if not exists document_path text;

-- 2. Закрытое хранилище для оригиналов документов (до 5 МБ, только фото и PDF).
-- Политик доступа нет специально: файлы кладёт и выдаёт только сервер после проверки входа.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'])
on conflict (id) do update set public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
