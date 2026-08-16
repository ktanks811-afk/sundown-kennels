-- Migration: player profiles, account deletion, leaderboard privacy
--
-- Run this once against the live Supabase project:
--   Dashboard -> SQL Editor -> New query -> paste -> Run
--
-- Everything here is idempotent, so running it twice is harmless.
-- Until this is applied, the Account tab cannot save a username, bio or
-- picture: PostgREST returns
--   Could not find the table 'public.profiles' in the schema cache


-- ============================================================================
-- Player profiles
-- ============================================================================
-- The kennel name is the in-game identity; this is the account identity —
-- what other players see attached to listings, challenges and the leaderboard.
-- Avatars are stored inline as a capped data URL rather than in Storage: the
-- client resizes to 256px before upload, which keeps this to tens of KB and
-- avoids a whole bucket-policy surface for what is a small image per user.

create table if not exists public.profiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  username   text,
  avatar     text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_len check (username is null or char_length(username) between 3 and 24),
  constraint profiles_avatar_len   check (avatar is null or char_length(avatar) <= 400000)
);

-- Added after the table shipped, so these are separate for existing installs.
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists show_on_leaderboard boolean not null default true;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_bio_len') then
    alter table public.profiles add constraint profiles_bio_len
      check (bio is null or char_length(bio) <= 280);
  end if;
end $$;

create unique index if not exists profiles_username_lower_idx
  on public.profiles (lower(username)) where username is not null;

alter table public.profiles enable row level security;

-- Profiles are public to signed-in players: you need to see who you're
-- trading with. Writes are owner-only.
drop policy if exists "Profiles are readable by players" on public.profiles;
create policy "Profiles are readable by players" on public.profiles
  for select to authenticated, anon using (true);

drop policy if exists "Players can insert own profile" on public.profiles;
create policy "Players can insert own profile" on public.profiles
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Players can update own profile" on public.profiles;
create policy "Players can update own profile" on public.profiles
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.profiles_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.profiles_set_updated_at();

grant select on public.profiles to anon, authenticated;
grant insert, update on public.profiles to authenticated;


-- ============================================================================
-- Account deletion
-- ============================================================================
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

-- Redefined after profiles shipped: players who switch themselves to hidden
-- drop out of the public rankings. The left join keeps anyone without a
-- profile row visible, which is the sensible default for existing players.
create or replace view public.leaderboard as
  select k.kennel_name, k.net_worth, k.fame, k.updated_at
  from public.kennels k
  left join public.profiles p on p.user_id = k.user_id
  where coalesce(p.show_on_leaderboard, true)
  order by k.net_worth desc;

grant select on public.leaderboard to anon, authenticated;
