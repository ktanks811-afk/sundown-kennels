-- Migration 003: phase 2 relational shape (bundles the unapplied parts of 001 and 002)
--
--   Supabase dashboard -> SQL Editor -> New query -> paste all of this -> Run
--
-- Safe to run on a database where none, some or all of it already exists —
-- every statement is guarded. Running it twice changes nothing.
--
-- This is one paste rather than three because 001 and 002 were never fully
-- applied to the live project. Checked on 16 Aug 2026:
--
--   profiles table + columns   applied
--   delete_my_account()        cannot be seen with the anon key either way,
--                              so it is re-asserted below rather than guessed at
--   race_records               missing
--   race_leaders               missing
--
-- The last statement prints a checklist of everything this file is meant to
-- create. Read it after the run — that output is the confirmation, not the
-- absence of a red error box.


-- ============================================================================
-- 0. A record of what has been applied
-- ============================================================================
-- SQL sitting in the repo does nothing until it is pasted here, and there has
-- been no way to tell from the outside which files made it. This table is that
-- record. Later migrations can read it instead of guessing.

create table if not exists public.schema_migrations (
  version     text primary key,
  applied_at  timestamptz not null default now(),
  note        text
);

grant select on public.schema_migrations to authenticated;


-- ============================================================================
-- 1. Catch-up: the parts of 001 and 002 that never landed
-- ============================================================================

-- --- 001: account deletion -------------------------------------------------
-- A client holding only the anon key cannot delete its own auth user, so this
-- runs SECURITY DEFINER. It clears everything the player owns first, so no
-- orphaned listings or challenges are left pointing at a deleted account.

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not signed in';
  end if;

  delete from public.market_listings where seller_id = v_uid or buyer_id = v_uid;
  delete from public.challenges     where creator_id = v_uid or opponent_id = v_uid;
  delete from public.stud_offers    where owner_id = v_uid;
  delete from public.stud_requests  where requester_id = v_uid or owner_id = v_uid;
  delete from public.kennels        where user_id = v_uid;
  delete from public.profiles       where user_id = v_uid;
  delete from auth.users            where id = v_uid;
end;
$$;

grant execute on function public.delete_my_account() to authenticated;

-- --- 001: leaderboard honours the hide-me switch ---------------------------
-- The left join keeps players without a profile row visible, which is the
-- sensible default for anyone who signed up before profiles existed.

create or replace view public.leaderboard as
  select k.kennel_name, k.net_worth, k.fame, k.updated_at
  from public.kennels k
  left join public.profiles p on p.user_id = k.user_id
  where coalesce(p.show_on_leaderboard, true)
  order by k.net_worth desc;

grant select on public.leaderboard to anon, authenticated;

-- --- 002: race records -----------------------------------------------------
-- Timed horse events post a result here. The board shows the fastest run per
-- event with the holder's username, so a record has a name on it.

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

create or replace view public.race_leaders as
  select distinct on (r.event)
    r.event, r.seconds, r.horse_name, r.horse_breed, r.kennel_name,
    coalesce(p.username, r.kennel_name, 'Unknown') as holder,
    r.created_at
  from public.race_records r
  left join public.profiles p on p.user_id = r.user_id
  order by r.event, r.seconds asc, r.created_at asc;

grant select on public.race_leaders to anon, authenticated;


-- ============================================================================
-- 2. Casting helpers
-- ============================================================================
-- The projection below reads values out of a jsonb blob written by the game
-- client. A single malformed field would otherwise abort the whole statement,
-- so anything that does not look like a number becomes null instead of an
-- error. Cheaper and clearer than wrapping every cast in an exception block.

create or replace function public.safe_int(t text)
returns int language sql immutable as $$
  select case when t ~ '^-?[0-9]+$' then t::int else null end;
$$;

create or replace function public.safe_num(t text)
returns numeric language sql immutable as $$
  select case when t ~ '^-?[0-9]+(\.[0-9]+)?$' then t::numeric else null end;
$$;


-- ============================================================================
-- 3. Animals
-- ============================================================================
-- Every animal in the game currently lives inside kennels.state, a single
-- jsonb blob per player. That is fine for one player loading their own save
-- and useless for everything phase 2 exists to enable: you cannot filter,
-- sort, index or paginate across players inside a blob.
--
-- Rather than move animals out of the blob — which would mean rewriting every
-- read and write in the client before any of the new screens exist — this
-- table is a projection of it. The blob stays authoritative, a trigger keeps
-- this table in step on every save, and search reads the table. Later phases
-- can flip individual writes over one at a time; nothing has to happen at once.
--
-- Consequences worth knowing: this table is derived, so it is never written to
-- by clients, and anything written here directly is overwritten on the owner's
-- next save.

create table if not exists public.animals (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  animal_id    text not null,
  species      text not null check (species in ('dog','horse','cattle')),
  name         text,
  breed        text,
  sex          text,
  age_days     int,
  born_day     int,
  generation   int,
  registered   boolean not null default false,
  reg_number   text,
  bloodline    text,
  health       numeric,
  rating       numeric,
  colour       text,
  stats        jsonb,
  refreshed_at timestamptz not null default now(),
  unique (user_id, animal_id)
);

alter table public.animals enable row level security;

-- Public on purpose: browsing other players' animals is the point of the
-- search and registry screens. Nothing sensitive lives here — no cash, no
-- inventory, no market position.
drop policy if exists "Animals are public" on public.animals;
create policy "Animals are public" on public.animals
  for select to anon, authenticated using (true);

-- No insert/update/delete policies at all. The projection function below is
-- SECURITY DEFINER and is the only thing that writes this table.

grant select on public.animals to anon, authenticated;

create index if not exists animals_species_idx    on public.animals (species);
create index if not exists animals_breed_idx      on public.animals (species, breed);
create index if not exists animals_owner_idx      on public.animals (user_id);
create index if not exists animals_rating_idx     on public.animals (species, rating desc);
create index if not exists animals_age_idx        on public.animals (species, age_days);
create index if not exists animals_registered_idx on public.animals (species, registered) where registered;
create index if not exists animals_name_idx       on public.animals (lower(name));
create index if not exists animals_bloodline_idx  on public.animals (lower(bloodline)) where bloodline is not null;

-- Rebuilds one player's rows from their save blob. Returns how many it wrote.
create or replace function public.refresh_animals(p_user_id uuid, p_state jsonb)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  delete from public.animals where user_id = p_user_id;

  insert into public.animals (
    user_id, animal_id, species, name, breed, sex, age_days, born_day,
    generation, registered, reg_number, bloodline, health, rating, colour, stats
  )
  select
    p_user_id,
    a->>'id',
    src.species,
    nullif(a->>'name', ''),
    nullif(a->>'breed', ''),
    nullif(a->>'sex', ''),
    public.safe_int(a->>'ageDays'),
    public.safe_int(a->>'bornDay'),
    coalesce(public.safe_int(a->>'generation'), 1),
    coalesce((a->>'registered')::boolean, false),
    nullif(a->>'regNumber', ''),
    nullif(a->>'bloodline', ''),
    public.safe_num(a->>'health'),
    -- Plain mean of the stat block. Species-neutral on purpose: dogs, horses
    -- and cattle each have their own six stats, and overall_rating() only
    -- knows the dog set, so using it here would rank horses on nothing.
    (
      select avg(public.safe_num(e.value))
      from jsonb_each_text(case when jsonb_typeof(a->'stats') = 'object'
                                then a->'stats' else '{}'::jsonb end) as e(key, value)
      where public.safe_num(e.value) is not null
    ),
    nullif(trim(
      coalesce(a#>>'{colorGenes,base}', '') || ' ' ||
      coalesce(nullif(a#>>'{colorGenes,pattern}', 'solid'), '')
    ), ''),
    case when jsonb_typeof(a->'stats') = 'object' then a->'stats' end
  from (values ('dog', 'dogs'), ('horse', 'horses'), ('cattle', 'cattle'))
         as src(species, state_key)
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(p_state->src.state_key) = 'array'
         then p_state->src.state_key else '[]'::jsonb end
  ) as a
  where a->>'id' is not null
  -- A save that somehow carries the same id twice would otherwise break the
  -- unique constraint and lose the whole projection for that player.
  on conflict (user_id, animal_id) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Kept in step on every save. Deliberately swallows its own failures: a
-- projection problem must never stop a player's game from saving, which is
-- the one thing in this database that genuinely cannot be lost.
create or replace function public.kennels_project_animals()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    perform public.refresh_animals(new.user_id, new.state);
  exception when others then
    raise warning 'animal projection failed for %: %', new.user_id, sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists kennels_project_animals on public.kennels;
create trigger kennels_project_animals
  after insert or update of state on public.kennels
  for each row execute function public.kennels_project_animals();

-- Backfill everyone who already has a save.
do $$
declare
  r record;
begin
  for r in select user_id, state from public.kennels loop
    begin
      perform public.refresh_animals(r.user_id, r.state);
    exception when others then
      raise warning 'backfill failed for %: %', r.user_id, sqlerrm;
    end;
  end loop;
end;
$$;


-- ============================================================================
-- 4. Competitions
-- ============================================================================
-- Entering costs money and energy now; results post on a later tick. That
-- needs somewhere for an entry to sit in the meantime, which a save blob
-- cannot provide once entries span players.
--
-- host_id null means a system-run event. Player-hosted competitions (the
-- Host Competitions screen) set it, which is why the column exists before
-- that screen does.

create table if not exists public.competitions (
  id          uuid primary key default gen_random_uuid(),
  host_id     uuid references auth.users(id) on delete set null,
  species     text not null check (species in ('dog','horse','cattle')),
  sport       text not null,
  name        text,
  entry_fee   numeric not null default 0 check (entry_fee >= 0),
  prize_pool  numeric not null default 0 check (prize_pool >= 0),
  max_entries int check (max_entries is null or max_entries > 0),
  opens_at    timestamptz not null default now(),
  resolves_at timestamptz not null,
  status      text not null default 'open'
                check (status in ('open','resolving','resolved','cancelled')),
  created_at  timestamptz not null default now()
);

create table if not exists public.competition_entries (
  id             uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  animal_id      text not null,
  animal_name    text,
  species        text not null check (species in ('dog','horse','cattle')),
  score          numeric,
  placement      int check (placement is null or placement > 0),
  winnings       numeric not null default 0,
  created_at     timestamptz not null default now(),
  unique (competition_id, user_id, animal_id)
);

alter table public.competitions enable row level security;
alter table public.competition_entries enable row level security;

drop policy if exists "Competitions are public" on public.competitions;
create policy "Competitions are public" on public.competitions
  for select to anon, authenticated using (true);

drop policy if exists "Players can host competitions" on public.competitions;
create policy "Players can host competitions" on public.competitions
  for insert to authenticated with check (auth.uid() = host_id);

drop policy if exists "Hosts can update own competitions" on public.competitions;
create policy "Hosts can update own competitions" on public.competitions
  for update to authenticated using (auth.uid() = host_id) with check (auth.uid() = host_id);

-- Results are public — a placement nobody can see is not a result.
drop policy if exists "Entries are public" on public.competition_entries;
create policy "Entries are public" on public.competition_entries
  for select to anon, authenticated using (true);

drop policy if exists "Players can enter own animals" on public.competition_entries;
create policy "Players can enter own animals" on public.competition_entries
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Players can withdraw own entries" on public.competition_entries;
create policy "Players can withdraw own entries" on public.competition_entries
  for delete to authenticated using (auth.uid() = user_id);

grant select on public.competitions to anon, authenticated;
grant insert, update on public.competitions to authenticated;
grant select on public.competition_entries to anon, authenticated;
grant insert, delete on public.competition_entries to authenticated;

create index if not exists competitions_pending_idx  on public.competitions (status, resolves_at);
create index if not exists competitions_sport_idx    on public.competitions (species, sport);
create index if not exists comp_entries_result_idx   on public.competition_entries (competition_id, placement);
create index if not exists comp_entries_user_idx     on public.competition_entries (user_id, created_at desc);


-- ============================================================================
-- 5. Search
-- ============================================================================
-- One view per facet, so the client filters and paginates against something
-- indexed rather than pulling rows down and sorting them in the browser.

create or replace view public.animal_search as
  select
    a.id, a.user_id, a.animal_id, a.species, a.name, a.breed, a.sex,
    a.age_days, a.generation, a.registered, a.bloodline, a.rating, a.colour,
    coalesce(p.username, k.kennel_name, 'Unknown') as owner_name,
    k.kennel_name
  from public.animals a
  left join public.profiles p on p.user_id = a.user_id
  left join public.kennels  k on k.user_id = a.user_id;

grant select on public.animal_search to anon, authenticated;

create or replace view public.competition_results as
  select
    c.id as competition_id, c.species, c.sport, c.name, c.resolves_at, c.status,
    e.user_id, e.animal_id, e.animal_name, e.score, e.placement, e.winnings,
    coalesce(p.username, 'Unknown') as owner_name
  from public.competitions c
  join public.competition_entries e on e.competition_id = c.id
  left join public.profiles p on p.user_id = e.user_id
  order by c.resolves_at desc, e.placement asc nulls last;

grant select on public.competition_results to anon, authenticated;


-- ============================================================================
-- 6. Record what was applied
-- ============================================================================

insert into public.schema_migrations (version, note) values
  ('001_profiles',        'player profiles, account deletion, leaderboard privacy'),
  ('002_race_records',    'timed event records and the leader board'),
  ('003_phase2_relational', 'animals projection, competitions, search views')
on conflict (version) do nothing;


-- ============================================================================
-- Verification — read this output
-- ============================================================================

select object, case when present then 'yes' else 'MISSING' end as applied
from (values
  ('table  profiles',            to_regclass('public.profiles')            is not null),
  ('table  race_records',        to_regclass('public.race_records')        is not null),
  ('view   race_leaders',        to_regclass('public.race_leaders')        is not null),
  ('view   leaderboard',         to_regclass('public.leaderboard')         is not null),
  ('table  animals',             to_regclass('public.animals')             is not null),
  ('table  competitions',        to_regclass('public.competitions')        is not null),
  ('table  competition_entries', to_regclass('public.competition_entries') is not null),
  ('view   animal_search',       to_regclass('public.animal_search')       is not null),
  ('view   competition_results', to_regclass('public.competition_results') is not null),
  ('table  schema_migrations',   to_regclass('public.schema_migrations')   is not null),
  ('func   delete_my_account',   exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                                          where n.nspname = 'public' and p.proname = 'delete_my_account')),
  ('func   refresh_animals',     exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                                          where n.nspname = 'public' and p.proname = 'refresh_animals')),
  ('trig   kennels_project_animals', exists (select 1 from pg_trigger
                                              where tgname = 'kennels_project_animals' and not tgisinternal))
) as t(object, present)
order by 1;
