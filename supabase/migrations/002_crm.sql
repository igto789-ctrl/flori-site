-- Тема 2, блок 1: CRM с воронкой.
-- Запускать ОДИН раз в Supabase: SQL Editor → New query → вставить весь файл → Run.
-- Существующие заявки сохраняются: статус переносится в этап воронки.

-- 1. Новые поля карточки клиента
alter table public.requests add column if not exists source text not null default 'site';
alter table public.requests add column if not exists stage  text not null default 'new';
alter table public.requests add column if not exists notes  text not null default '';

alter table public.requests drop constraint if exists requests_source_check;
alter table public.requests add constraint requests_source_check
  check (source in ('site', 'manual', 'telegram', 'document'));

alter table public.requests drop constraint if exists requests_stage_check;
alter table public.requests add constraint requests_stage_check
  check (stage in ('new', 'contacted', 'agreed', 'paid', 'delivered', 'rejected'));

-- У клиента, добавленного вручную, комментария может не быть
alter table public.requests drop constraint if exists requests_comment_check;
alter table public.requests add constraint requests_comment_check check (char_length(comment) <= 1000);
alter table public.requests alter column comment set default '';

-- 2. Перенос старых статусов в этапы (только если старая колонка ещё есть)
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'requests' and column_name = 'status') then
    update public.requests set stage = case status
      when 'in_progress' then 'contacted'
      when 'closed' then 'paid'
      else 'new' end;
    alter table public.requests drop column status;
  end if;
end $$;

create index if not exists requests_stage_idx on public.requests (stage);

-- 3. История переходов по этапам
create table if not exists public.stage_history (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.requests (id) on delete cascade,
  from_stage text,
  to_stage text not null,
  changed_at timestamptz not null default now()
);
create index if not exists stage_history_request_idx on public.stage_history (request_id, changed_at);

alter table public.stage_history enable row level security;
drop policy if exists "admin can read history" on public.stage_history;
create policy "admin can read history" on public.stage_history
  for select to authenticated using (true);

-- История пишется автоматически самой базой: при создании карточки и при смене этапа.
create or replace function public.log_stage_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into stage_history (request_id, from_stage, to_stage, changed_at)
      values (new.id, null, new.stage, new.created_at);
  elsif new.stage is distinct from old.stage then
    insert into stage_history (request_id, from_stage, to_stage) values (new.id, old.stage, new.stage);
  end if;
  return new;
end $$;

drop trigger if exists requests_stage_history on public.requests;
create trigger requests_stage_history
  after insert or update of stage on public.requests
  for each row execute function public.log_stage_change();

-- Для уже существующих заявок — стартовая запись в истории
insert into public.stage_history (request_id, from_stage, to_stage, changed_at)
select r.id, null, r.stage, r.created_at from public.requests r
where not exists (select 1 from public.stage_history h where h.request_id = r.id);

-- 4. Владелец (вошедший пользователь) может добавлять клиентов вручную
drop policy if exists "admin can insert" on public.requests;
create policy "admin can insert" on public.requests
  for insert to authenticated with check (true);
