-- Тема 3, блок 5: свой MCP-сервер для CRM.
-- Запускать ОДИН раз в Supabase: SQL Editor → New query → вставить весь файл → Run.

-- 1. В истории этапов помечаем, откуда пришла смена (например, «MCP»). Пусто — из админ-панели.
alter table public.stage_history add column if not exists changed_via text;

-- 2. Триггер истории читает пометку из настройки транзакции app.changed_via.
create or replace function public.log_stage_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  via text := nullif(current_setting('app.changed_via', true), '');
begin
  if tg_op = 'INSERT' then
    insert into stage_history (request_id, from_stage, to_stage, changed_at, changed_via)
      values (new.id, null, new.stage, new.created_at, via);
  elsif new.stage is distinct from old.stage then
    insert into stage_history (request_id, from_stage, to_stage, changed_via)
      values (new.id, old.stage, new.stage, via);
  end if;
  return new;
end $$;

-- 3. Смена этапа с пометкой: вызывает только сервер MCP (service_role).
create or replace function public.set_stage_via(p_id uuid, p_stage text, p_via text)
returns setof public.requests
language plpgsql security definer set search_path = public as $$
begin
  perform set_config('app.changed_via', p_via, true);
  return query update public.requests set stage = p_stage where id = p_id returning *;
end $$;

revoke all on function public.set_stage_via(uuid, text, text) from public, anon, authenticated;
grant execute on function public.set_stage_via(uuid, text, text) to service_role;
