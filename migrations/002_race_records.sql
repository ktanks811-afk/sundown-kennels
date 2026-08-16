-- Migration 002: race records
--
-- Run in Supabase -> SQL Editor -> New query -> Run.
-- Idempotent; safe to run twice. Requires 001 (profiles) first.



-- ============================================================================
-- Race records
-- ============================================================================
-- Timed horse events (barrel racing, flat racing) post a result here. The
-- board shows the fastest run per event with the holder's username, so a
-- record has a name on it rather than being an anonymous number.

create table if not exists public.race_records (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  event       text not null,
  seconds     numeric not null check (seconds > 0 and seconds < 600),
  horse_name  text not null,
  horse_breed text,
  kennel_name text,
  created_at  timestamptz not null default now()
);

create index if not exists race_records_event_seconds_idx
  on public.race_records (event, seconds asc);

alter table public.race_records enable row level security;

drop policy if exists "Race records are public" on public.race_records;
create policy "Race records are public" on public.race_records
  for select to anon, authenticated using (true);

drop policy if exists "Players can post own race records" on public.race_records;
create policy "Players can post own race records" on public.race_records
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Players can delete own race records" on public.race_records;
create policy "Players can delete own race records" on public.race_records
  for delete to authenticated using (auth.uid() = user_id);

grant select on public.race_records to anon, authenticated;
grant insert, delete on public.race_records to authenticated;

-- Fastest run per event, with whoever holds it. distinct on is the cheap
-- Postgres way to take one row per group without a window function.
create or replace view public.race_leaders as
  select distinct on (r.event)
    r.event, r.seconds, r.horse_name, r.horse_breed, r.kennel_name,
    coalesce(p.username, r.kennel_name, 'Unknown') as holder,
    r.created_at
  from public.race_records r
  left join public.profiles p on p.user_id = r.user_id
  order by r.event, r.seconds asc, r.created_at asc;

grant select on public.race_leaders to anon, authenticated;
