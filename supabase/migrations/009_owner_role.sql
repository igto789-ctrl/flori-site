-- ДЗ N4, проблема S2: доступ к данным CRM только у владельца, а не у любого вошедшего пользователя.
-- Запускать ОДИН раз в Supabase: SQL Editor → New query → вставить весь файл → Run.
--
-- ПЕРЕД запуском (по шагам из плана, делает владелец):
--   1) select id, email, coalesce(is_anonymous,false) anon from auth.users;  → должна быть ОДНА строка — ваш аккаунт;
--   2) Authentication → Hooks: нет Custom Access Token Hook;
--   3) назначить себе роль по своему id:
--      update auth.users set raw_app_meta_data = coalesce(raw_app_meta_data,'{}'::jsonb) || '{"role":"owner"}'::jsonb
--      where id = '<ваш id>' and coalesce(is_anonymous,false) = false;
--   4) выйти и снова войти в админку.
-- Весь файл выполняется одной транзакцией: если любая проверка не прошла — ничего не меняется.

begin;

-- 0. Проверки: ровно один владелец, он не анонимный; RLS включён на всех таблицах CRM.
do $$
declare
  owners int;
  no_rls text;
begin
  select count(*) into owners from auth.users
   where raw_app_meta_data->>'role' = 'owner' and coalesce(is_anonymous, false) = false;
  if owners <> 1 then
    raise exception 'Ожидался ровно 1 владелец с app_metadata.role = owner, найдено: %. Сначала назначьте роль (см. шапку файла).', owners;
  end if;
  if exists (select 1 from auth.users where raw_app_meta_data->>'role' = 'owner' and coalesce(is_anonymous, false)) then
    raise exception 'Роль owner у анонимного пользователя — так нельзя.';
  end if;

  select string_agg(relname, ', ') into no_rls from pg_class
   where relnamespace = 'public'::regnamespace
     and relname in ('requests', 'stage_history', 'invoices', 'image_generations')
     and not relrowsecurity;
  if no_rls is not null then
    raise exception 'RLS выключен на таблицах: %', no_rls;
  end if;
end $$;

-- 1. «Это владелец?» — читается из JWT (claim app_metadata). Без роли — нет доступа.
create or replace function public.is_owner() returns boolean
language sql stable set search_path = public as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'owner', false)
$$;

-- 2. Политики: отдельно по командам, (select …) считается один раз на запрос.
drop policy if exists "admin can read" on public.requests;
create policy "admin can read" on public.requests
  for select to authenticated using ((select public.is_owner()));

drop policy if exists "admin can update" on public.requests;
create policy "admin can update" on public.requests
  for update to authenticated using ((select public.is_owner())) with check ((select public.is_owner()));

drop policy if exists "admin can insert" on public.requests;
create policy "admin can insert" on public.requests
  for insert to authenticated with check ((select public.is_owner()));

drop policy if exists "admin can read history" on public.stage_history;
create policy "admin can read history" on public.stage_history
  for select to authenticated using ((select public.is_owner()));

drop policy if exists "admin can read invoices" on public.invoices;
create policy "admin can read invoices" on public.invoices
  for select to authenticated using ((select public.is_owner()));

drop policy if exists "admin can insert invoices" on public.invoices;
create policy "admin can insert invoices" on public.invoices
  for insert to authenticated with check ((select public.is_owner()));

drop policy if exists "admin can update invoices" on public.invoices;
create policy "admin can update invoices" on public.invoices
  for update to authenticated using ((select public.is_owner())) with check ((select public.is_owner()));

drop policy if exists "own generations" on public.image_generations;
create policy "own generations" on public.image_generations
  for select to authenticated using (user_id = (select auth.uid()) and (select public.is_owner()));

-- 3. Проверка по живому каталогу: на таблицах CRM не осталось ни одной политики без is_owner()
--    (например, созданной когда-то через дашборд) — иначе она пускала бы через OR.
do $$
declare
  leftovers text;
begin
  select string_agg(tablename || '.' || policyname, ', ') into leftovers from pg_policies
   where schemaname = 'public'
     and tablename in ('requests', 'stage_history', 'invoices', 'image_generations')
     and ((qual is null and with_check is null)
          or (qual is not null and qual not like '%is_owner()%')
          or (with_check is not null and with_check not like '%is_owner()%'));
  if leftovers is not null then
    raise exception 'Остались политики без is_owner(): %. Удалите их (drop policy) и запустите файл снова.', leftovers;
  end if;
end $$;

commit;
