-- Тема 2, блок 4: генерация изображений (Nano Banana).
-- Запускать ОДИН раз в Supabase: SQL Editor → New query → вставить весь файл → Run.

create table if not exists public.image_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  prompt text not null check (char_length(prompt) between 3 and 2000),
  aspect_ratio text not null default '1:1',
  source_path text,            -- исходное фото (если загружали) в Storage
  result_path text not null,   -- результат в Storage
  model text not null,
  created_at timestamptz not null default now()
);
create index if not exists image_generations_user_idx on public.image_generations (user_id, created_at desc);

-- Каждый видит только свою историю. Записи добавляет сервер после успешной генерации.
alter table public.image_generations enable row level security;
drop policy if exists "own generations" on public.image_generations;
create policy "own generations" on public.image_generations
  for select to authenticated using (user_id = auth.uid());
