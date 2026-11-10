-- Тема 3, блок 4: голосовой агент на сайте.
-- Запускать ОДИН раз в Supabase: SQL Editor → New query → вставить весь файл → Run.
-- Новый источник «Голос» (voice): заявки, которые оставил голосовой агент ElevenLabs.
alter table public.requests drop constraint if exists requests_source_check;
alter table public.requests add constraint requests_source_check
  check (source in ('site', 'manual', 'card', 'telegram', 'document', 'voice'));
