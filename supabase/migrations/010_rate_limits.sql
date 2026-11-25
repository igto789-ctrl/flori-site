-- ДЗ N4, проблемы S3 и S7: лимиты частоты для публичных форм, заказов из Mini App, генераций и скана.
-- Запускать ОДИН раз в Supabase: SQL Editor → New query → вставить весь файл → Run.
-- Запускать ДО деплоя кода: без этих функций публичная форма отвечает 429 (закрыта по умолчанию).

begin;

create table if not exists public.rate_limits (
  key          text        not null,
  window_start timestamptz not null,
  count        int         not null default 0,
  primary key (key, window_start)
);
create index if not exists rate_limits_window_idx on public.rate_limits (window_start);

-- Только сервер (service_role). Политик нет, права у anon/authenticated отобраны.
alter table public.rate_limits enable row level security;
revoke all on table public.rate_limits from public, anon, authenticated;

create or replace function public.rate_window_start(p_window int) returns timestamptz
language sql stable set search_path = public, pg_temp as $$
  select to_timestamp(floor(extract(epoch from now()) / p_window) * p_window)
$$;

-- Атомарно для всех ключей: если во ВСЕХ окнах есть место — +1 везде и вернуть начала окон; иначе ничего не менять, вернуть null.
create or replace function public.take_rate_limits(p_keys text[], p_limits int[], p_windows int[])
returns timestamptz[]
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  i int;
  n int := coalesce(array_length(p_keys, 1), 0);
  starts timestamptz[] := '{}';
  ws timestamptz;
  current_count int;
begin
  if n = 0 or n <> coalesce(array_length(p_limits, 1), 0) or n <> coalesce(array_length(p_windows, 1), 0) then
    raise exception 'take_rate_limits: массивы разной длины';
  end if;

  -- Блокировки по ключам в одном порядке — без взаимных блокировок; держатся до конца транзакции.
  perform pg_advisory_xact_lock(hashtext(k)) from unnest(p_keys) as k order by k;

  for i in 1..n loop
    ws := public.rate_window_start(p_windows[i]);
    select r.count into current_count from public.rate_limits r where r.key = p_keys[i] and r.window_start = ws;
    if coalesce(current_count, 0) >= p_limits[i] then
      return null;
    end if;
    starts := starts || ws;
  end loop;

  for i in 1..n loop
    insert into public.rate_limits (key, window_start, count) values (p_keys[i], starts[i], 1)
    on conflict (key, window_start) do update set count = public.rate_limits.count + 1;
  end loop;

  -- Изредка чистим старые окна (не на каждом запросе).
  if random() < 0.02 then
    delete from public.rate_limits where window_start < now() - interval '2 days';
  end if;

  return starts;
end $$;

create or replace function public.get_rate_limit(p_key text, p_window int) returns int
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select count from public.rate_limits where key = p_key and window_start = public.rate_window_start(p_window)), 0)
$$;

revoke all on function public.rate_window_start(int) from public, anon, authenticated;
revoke all on function public.take_rate_limits(text[], int[], int[]) from public, anon, authenticated;
revoke all on function public.get_rate_limit(text, int) from public, anon, authenticated;
grant execute on function public.rate_window_start(int) to service_role;
grant execute on function public.take_rate_limits(text[], int[], int[]) to service_role;
grant execute on function public.get_rate_limit(text, int) to service_role;

commit;
