-- Sundown Kennels — cloud save / multiplayer foundation
-- Run this once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run

create table if not exists public.kennels (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null,
  kennel_name text generated always as (state->>'kennelName') stored,
  net_worth numeric generated always as (
    coalesce((state #>> '{netWorthHistory,-1,netWorth}')::numeric, 0)
  ) stored,
  fame numeric generated always as (coalesce((state->>'fame')::numeric, 0)) stored,
  updated_at timestamptz not null default now()
);

alter table public.kennels enable row level security;

drop policy if exists "Players can read own kennel" on public.kennels;
create policy "Players can read own kennel" on public.kennels
  for select using (auth.uid() = user_id);

drop policy if exists "Players can insert own kennel" on public.kennels;
create policy "Players can insert own kennel" on public.kennels
  for insert with check (auth.uid() = user_id);

drop policy if exists "Players can update own kennel" on public.kennels;
create policy "Players can update own kennel" on public.kennels
  for update using (auth.uid() = user_id);

-- keep updated_at fresh on every save
create or replace function public.kennels_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists kennels_set_updated_at on public.kennels;
create trigger kennels_set_updated_at
  before update on public.kennels
  for each row execute function public.kennels_set_updated_at();

-- Public, read-only leaderboard: name / net worth / fame only.
-- No dog rosters, cash, or market data exposed to other players.
create or replace view public.leaderboard as
  select kennel_name, net_worth, fame, updated_at
  from public.kennels
  order by net_worth desc;

grant select on public.leaderboard to anon, authenticated;

-- =========================================================================
-- Player marketplace — list a dog, another player buys it. The purchase
-- moves cash and the dog between kennels atomically via a SECURITY DEFINER
-- function, since normal RLS only lets a player touch their own row.
-- =========================================================================

create table if not exists public.market_listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references auth.users(id) on delete cascade,
  seller_name text not null,
  dog jsonb not null,
  price numeric not null check (price > 0),
  status text not null default 'active' check (status in ('active','sold','cancelled')),
  buyer_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  sold_at timestamptz
);

alter table public.market_listings enable row level security;

drop policy if exists "Anyone can view active or own listings" on public.market_listings;
create policy "Anyone can view active or own listings" on public.market_listings
  for select using (status = 'active' or auth.uid() = seller_id or auth.uid() = buyer_id);

drop policy if exists "Sellers can create own listings" on public.market_listings;
create policy "Sellers can create own listings" on public.market_listings
  for insert with check (auth.uid() = seller_id);

drop policy if exists "Sellers can cancel own active listings" on public.market_listings;
create policy "Sellers can cancel own active listings" on public.market_listings
  for update using (auth.uid() = seller_id and status = 'active')
  with check (status = 'cancelled');

create or replace function public.purchase_listing(p_listing_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing record;
  v_buyer_id uuid := auth.uid();
  v_buyer_state jsonb;
  v_seller_state jsonb;
  v_buyer_cash numeric;
  v_seller_cash numeric;
begin
  if v_buyer_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_listing from public.market_listings where id = p_listing_id for update;
  if not found then raise exception 'Listing not found'; end if;
  if v_listing.status <> 'active' then raise exception 'Listing is no longer available'; end if;
  if v_listing.seller_id = v_buyer_id then raise exception 'Cannot buy your own listing'; end if;

  select state into v_buyer_state from public.kennels where user_id = v_buyer_id for update;
  if v_buyer_state is null then raise exception 'Buyer kennel not found'; end if;

  v_buyer_cash := coalesce((v_buyer_state->>'cash')::numeric, 0);
  if v_buyer_cash < v_listing.price then raise exception 'Not enough cash'; end if;

  v_buyer_state := jsonb_set(v_buyer_state, '{cash}', to_jsonb(v_buyer_cash - v_listing.price));
  v_buyer_state := jsonb_set(v_buyer_state, '{dogs}', (v_buyer_state->'dogs') || jsonb_build_array(v_listing.dog));
  update public.kennels set state = v_buyer_state where user_id = v_buyer_id;

  select state into v_seller_state from public.kennels where user_id = v_listing.seller_id for update;
  if v_seller_state is not null then
    v_seller_cash := coalesce((v_seller_state->>'cash')::numeric, 0);
    update public.kennels
      set state = jsonb_set(v_seller_state, '{cash}', to_jsonb(v_seller_cash + v_listing.price))
      where user_id = v_listing.seller_id;
  end if;

  update public.market_listings set status = 'sold', buyer_id = v_buyer_id, sold_at = now() where id = p_listing_id;
end;
$$;

grant execute on function public.purchase_listing(uuid) to authenticated;

-- =========================================================================
-- Head-to-head trial challenges. One player posts a challenge with a dog
-- and a trial type; another player accepts with one of their own dogs.
-- Scoring mirrors the single-player trial formula (weighted stats + a
-- random margin) and is resolved server-side so neither side can cheat.
-- =========================================================================

create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users(id) on delete cascade,
  creator_name text not null,
  trial text not null check (trial in ('weightpull','catchcourse','treeingtrial','show')),
  dog jsonb not null,
  status text not null default 'open' check (status in ('open','completed','cancelled')),
  opponent_id uuid references auth.users(id),
  opponent_name text,
  opponent_dog jsonb,
  winner_id uuid,
  margin numeric,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table public.challenges enable row level security;

drop policy if exists "Anyone can view open or own challenges" on public.challenges;
create policy "Anyone can view open or own challenges" on public.challenges
  for select using (status = 'open' or auth.uid() = creator_id or auth.uid() = opponent_id);

drop policy if exists "Players can create own challenges" on public.challenges;
create policy "Players can create own challenges" on public.challenges
  for insert with check (auth.uid() = creator_id);

drop policy if exists "Creators can cancel own open challenges" on public.challenges;
create policy "Creators can cancel own open challenges" on public.challenges
  for update using (auth.uid() = creator_id and status = 'open')
  with check (status = 'cancelled');

create or replace function public.trial_score(p_stats jsonb, p_trial text)
returns numeric
language sql
immutable
as $$
  select case p_trial
    when 'weightpull' then (p_stats->>'gameness')::numeric*0.3 + (p_stats->>'grip')::numeric*0.35 + (p_stats->>'conformation')::numeric*0.35
    when 'catchcourse' then (p_stats->>'gameness')::numeric*0.4 + (p_stats->>'speed')::numeric*0.3 + (p_stats->>'grip')::numeric*0.3
    when 'treeingtrial' then (p_stats->>'nose')::numeric*0.5 + (p_stats->>'stamina')::numeric*0.5
    when 'show' then (p_stats->>'conformation')::numeric
    else 0
  end + (random() * 24 - 12);
$$;

create or replace function public.accept_challenge(p_challenge_id uuid, p_dog jsonb, p_opponent_name text)
returns public.challenges
language plpgsql
security definer
set search_path = public
as $$
declare
  v_challenge record;
  v_opponent_id uuid := auth.uid();
  v_score_creator numeric;
  v_score_opponent numeric;
  v_winner uuid;
  v_result public.challenges;
begin
  if v_opponent_id is null then raise exception 'Not authenticated'; end if;

  select * into v_challenge from public.challenges where id = p_challenge_id for update;
  if not found then raise exception 'Challenge not found'; end if;
  if v_challenge.status <> 'open' then raise exception 'Challenge is no longer open'; end if;
  if v_challenge.creator_id = v_opponent_id then raise exception 'Cannot accept your own challenge'; end if;

  v_score_creator := public.trial_score(v_challenge.dog->'stats', v_challenge.trial);
  v_score_opponent := public.trial_score(p_dog->'stats', v_challenge.trial);
  v_winner := case when v_score_creator >= v_score_opponent then v_challenge.creator_id else v_opponent_id end;

  update public.challenges set
    status = 'completed',
    opponent_id = v_opponent_id,
    opponent_name = p_opponent_name,
    opponent_dog = p_dog,
    winner_id = v_winner,
    margin = round(abs(v_score_creator - v_score_opponent)),
    resolved_at = now()
  where id = p_challenge_id
  returning * into v_result;

  -- winner gets +3 fame, loser +1 for showing up; both changes stay inside
  -- each player's own kennel row.
  update public.kennels set state = jsonb_set(state, '{fame}', to_jsonb(coalesce((state->>'fame')::numeric,0) + 3))
    where user_id = v_winner;
  update public.kennels set state = jsonb_set(state, '{fame}', to_jsonb(coalesce((state->>'fame')::numeric,0) + 1))
    where user_id = (case when v_winner = v_challenge.creator_id then v_opponent_id else v_challenge.creator_id end);

  return v_result;
end;
$$;

grant execute on function public.accept_challenge(uuid, jsonb, text) to authenticated;

-- Base table grants. RLS policies only take effect once the role already
-- has these — without them Postgres blocks access before policies are
-- even consulted.
grant usage on schema public to anon, authenticated;
grant select, insert, update on public.kennels to authenticated;
grant select on public.market_listings to anon, authenticated;
grant insert, update on public.market_listings to authenticated;
grant select on public.challenges to anon, authenticated;
grant insert, update on public.challenges to authenticated;

-- Realtime: let the client subscribe to live changes on these tables.
-- (wrapped so re-running this script doesn't error if already added)
do $$
begin
  alter publication supabase_realtime add table public.market_listings;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.challenges;
exception when duplicate_object then null;
end $$;
