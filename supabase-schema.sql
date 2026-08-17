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

-- =========================================================================
-- Player stud board. One player posts a dog as available for stud;
-- another player requests breeding against it using one of their dams.
-- The stud's owner accepts (their browser generates the actual litter
-- with the game's full genetics logic) and the litter is SPLIT between
-- both kennels — whichever parent rates higher gets the better half —
-- resolved atomically server-side so neither side can tamper with the split.
-- =========================================================================

create table if not exists public.stud_offers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  owner_name text not null,
  dog jsonb not null,
  fee numeric not null default 0 check (fee >= 0),
  status text not null default 'open' check (status in ('open','cancelled')),
  created_at timestamptz not null default now()
);

alter table public.stud_offers enable row level security;

drop policy if exists "Anyone can view open or own stud offers" on public.stud_offers;
create policy "Anyone can view open or own stud offers" on public.stud_offers
  for select using (status = 'open' or auth.uid() = owner_id);

drop policy if exists "Owners can create own stud offers" on public.stud_offers;
create policy "Owners can create own stud offers" on public.stud_offers
  for insert with check (auth.uid() = owner_id);

drop policy if exists "Owners can cancel own open stud offers" on public.stud_offers;
create policy "Owners can cancel own open stud offers" on public.stud_offers
  for update using (auth.uid() = owner_id and status = 'open')
  with check (status = 'cancelled');

create table if not exists public.stud_requests (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.stud_offers(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  owner_name text not null,
  requester_id uuid not null references auth.users(id) on delete cascade,
  requester_name text not null,
  stud jsonb not null,
  dam jsonb not null,
  fee numeric not null default 0,
  status text not null default 'pending' check (status in ('pending','accepted','declined','completed')),
  litter_summary jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table public.stud_requests enable row level security;

drop policy if exists "Participants can view own stud requests" on public.stud_requests;
create policy "Participants can view own stud requests" on public.stud_requests
  for select using (auth.uid() = owner_id or auth.uid() = requester_id);

drop policy if exists "Requesters can create stud requests" on public.stud_requests;
create policy "Requesters can create stud requests" on public.stud_requests
  for insert with check (auth.uid() = requester_id);

drop policy if exists "Owners can decline own pending requests" on public.stud_requests;
create policy "Owners can decline own pending requests" on public.stud_requests
  for update using (auth.uid() = owner_id and status = 'pending')
  with check (status = 'declined');

create or replace function public.overall_rating(p_stats jsonb)
returns numeric
language sql
immutable
as $$
  select ((p_stats->>'gameness')::numeric + (p_stats->>'grip')::numeric + (p_stats->>'nose')::numeric
        + (p_stats->>'stamina')::numeric + (p_stats->>'speed')::numeric + (p_stats->>'conformation')::numeric) / 6;
$$;

-- Places up to `p_pups` worth of a kennel's share into that kennel, capped
-- by remaining capacity (land + house), selling any overflow at half value.
-- Returns the cash credited from any overflow sale.
create or replace function public.place_pups(p_user_id uuid, p_pups jsonb)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state jsonb;
  v_land_cap numeric; v_house_cap numeric; v_capacity numeric;
  v_room int;
  v_kept jsonb; v_overflow jsonb;
  v_overflow_value numeric := 0;
  v_i int;
begin
  select state into v_state from public.kennels where user_id = p_user_id for update;
  if v_state is null then return 0; end if;

  -- capacity mirrors the client's LAND_SIZES / HOUSE_TYPES capacity fields;
  -- kept in sync manually since there's no shared source of truth here.
  v_land_cap := case v_state->'property'->>'landKey'
    when 'rented' then 8 when 'quarter' then 10 when 'half' then 13 when 'one' then 16
    when 'two' then 20 when 'five' then 26 when 'ten' then 33 when 'twenty' then 42
    when 'forty' then 53 when 'eighty' then 68 when 'onesixty' then 88 when 'section' then 120
    else 8 end;
  v_house_cap := case v_state->'property'->>'houseKey'
    when 'trailer' then 1 when 'doublewide' then 2 when 'starter' then 4 when 'farmhouse' then 6
    when 'ranch' then 9 when 'ranchkennel' then 14 when 'compound' then 22 when 'showcompound' then 32
    else 0 end;
  v_capacity := v_land_cap + v_house_cap;
  v_room := greatest(0, v_capacity::int - jsonb_array_length(v_state->'dogs'));

  v_kept := coalesce((select jsonb_agg(p) from (select value as p from jsonb_array_elements(p_pups) with ordinality a(value, ord) order by ord limit v_room) s), '[]'::jsonb);
  v_overflow := coalesce((select jsonb_agg(p) from (select value as p from jsonb_array_elements(p_pups) with ordinality a(value, ord) order by ord offset v_room) s), '[]'::jsonb);

  if jsonb_array_length(v_overflow) > 0 then
    select sum(round(((p->'stats'->>'gameness')::numeric + (p->'stats'->>'grip')::numeric + (p->'stats'->>'nose')::numeric
      + (p->'stats'->>'stamina')::numeric + (p->'stats'->>'speed')::numeric + (p->'stats'->>'conformation')::numeric) * 3))
      into v_overflow_value from jsonb_array_elements(v_overflow) p;
    v_overflow_value := coalesce(v_overflow_value, 0);
  end if;

  v_state := jsonb_set(v_state, '{dogs}', (v_state->'dogs') || v_kept);
  v_state := jsonb_set(v_state, '{cash}', to_jsonb(coalesce((v_state->>'cash')::numeric, 0) + v_overflow_value));
  update public.kennels set state = v_state where user_id = p_user_id;
  return v_overflow_value;
end;
$$;

create or replace function public.accept_stud_request(p_request_id uuid, p_pups jsonb)
returns public.stud_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req record;
  v_caller uuid := auth.uid();
  v_owner_rating numeric; v_requester_rating numeric;
  v_sorted jsonb;
  v_n int;
  v_owner_share jsonb; v_requester_share jsonb;
  v_owner_first boolean;
  v_owner_overflow numeric; v_requester_overflow numeric;
  v_fee numeric;
  v_owner_cash jsonb;
  v_result public.stud_requests;
begin
  if v_caller is null then raise exception 'Not authenticated'; end if;

  select * into v_req from public.stud_requests where id = p_request_id for update;
  if not found then raise exception 'Request not found'; end if;
  if v_req.status <> 'pending' then raise exception 'Request already resolved'; end if;
  if v_req.owner_id <> v_caller then raise exception 'Only the stud owner can accept'; end if;

  v_n := jsonb_array_length(p_pups);
  if v_n = 0 then raise exception 'No pups to place'; end if;

  v_owner_rating := public.overall_rating(v_req.stud->'stats');
  v_requester_rating := public.overall_rating(v_req.dam->'stats');
  v_owner_first := v_owner_rating >= v_requester_rating;

  select jsonb_agg(p order by public.overall_rating(p->'stats') desc)
    into v_sorted from jsonb_array_elements(p_pups) p;

  if v_owner_first then
    v_owner_share := (select jsonb_agg(p) from (select value as p from jsonb_array_elements(v_sorted) with ordinality a(value, ord) order by ord limit ceil(v_n / 2.0)) s);
    v_requester_share := (select jsonb_agg(p) from (select value as p from jsonb_array_elements(v_sorted) with ordinality a(value, ord) order by ord offset ceil(v_n / 2.0)) s);
  else
    v_requester_share := (select jsonb_agg(p) from (select value as p from jsonb_array_elements(v_sorted) with ordinality a(value, ord) order by ord limit ceil(v_n / 2.0)) s);
    v_owner_share := (select jsonb_agg(p) from (select value as p from jsonb_array_elements(v_sorted) with ordinality a(value, ord) order by ord offset ceil(v_n / 2.0)) s);
  end if;

  -- Put the requester's dam on the same cooldown a normal litter would —
  -- otherwise the same dam could be spammed across many stud offers for
  -- unlimited free litters.
  declare
    v_dam_idx int;
  begin
    select ord - 1 into v_dam_idx from public.kennels k, jsonb_array_elements(k.state->'dogs') with ordinality e(val, ord)
      where k.user_id = v_req.requester_id and val->>'id' = v_req.dam->>'id' limit 1;
    if v_dam_idx is not null then
      update public.kennels set state = jsonb_set(
        jsonb_set(state, array['dogs', v_dam_idx::text, 'breedCooldown'], to_jsonb(45)),
        array['dogs', v_dam_idx::text, 'health'],
        to_jsonb(greatest(0, (state->'dogs'->v_dam_idx->>'health')::numeric - 14))
      ) where user_id = v_req.requester_id;
    end if;
  end;

  v_owner_overflow := public.place_pups(v_req.owner_id, coalesce(v_owner_share, '[]'::jsonb));
  v_requester_overflow := public.place_pups(v_req.requester_id, coalesce(v_requester_share, '[]'::jsonb));

  -- stud fee: requester pays owner, if any
  v_fee := coalesce(v_req.fee, 0);
  if v_fee > 0 then
    update public.kennels set state = jsonb_set(state, '{cash}', to_jsonb(greatest(0, coalesce((state->>'cash')::numeric,0) - v_fee))) where user_id = v_req.requester_id;
    update public.kennels set state = jsonb_set(state, '{cash}', to_jsonb(coalesce((state->>'cash')::numeric,0) + v_fee)) where user_id = v_req.owner_id;
  end if;

  update public.stud_requests set
    status = 'completed',
    resolved_at = now(),
    litter_summary = jsonb_build_object(
      'total', v_n,
      'ownerGotBetterHalf', v_owner_first,
      'ownerKept', jsonb_array_length(coalesce(v_owner_share,'[]'::jsonb)),
      'requesterKept', jsonb_array_length(coalesce(v_requester_share,'[]'::jsonb)),
      'ownerOverflowValue', v_owner_overflow,
      'requesterOverflowValue', v_requester_overflow
    )
  where id = p_request_id
  returning * into v_result;

  return v_result;
end;
$$;

grant execute on function public.overall_rating(jsonb) to authenticated, anon;
grant execute on function public.place_pups(uuid, jsonb) to authenticated;
grant execute on function public.accept_stud_request(uuid, jsonb) to authenticated;

-- Base table grants. RLS policies only take effect once the role already
-- has these — without them Postgres blocks access before policies are
-- even consulted.
grant usage on schema public to anon, authenticated;
grant select, insert, update on public.kennels to authenticated;
grant select on public.market_listings to anon, authenticated;
grant insert, update on public.market_listings to authenticated;
grant select on public.challenges to anon, authenticated;
grant insert, update on public.challenges to authenticated;
grant select on public.stud_offers to anon, authenticated;
grant insert, update on public.stud_offers to authenticated;
grant select on public.stud_requests to authenticated;
grant insert, update on public.stud_requests to authenticated;

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

do $$
begin
  alter publication supabase_realtime add table public.stud_offers;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.stud_requests;
exception when duplicate_object then null;
end $$;

-- =========================================================================
-- Horses & cattle join the same multiplayer surfaces dogs use — the market,
-- challenges, and stud board tables gain a `kind` column instead of being
-- duplicated per species, and the RPCs become kind-aware (which array on
-- the kennel row to touch, which capacity pool applies, which scoring
-- weights to use). Existing dog rows/calls keep working unchanged since
-- `kind` defaults to 'dog' and old function calls (without p_kind) fall
-- back to dog behaviour.
-- =========================================================================

alter table public.market_listings add column if not exists kind text not null default 'dog' check (kind in ('dog','horse','cattle'));
alter table public.challenges add column if not exists kind text not null default 'dog' check (kind in ('dog','horse','cattle'));
alter table public.stud_offers add column if not exists kind text not null default 'dog' check (kind in ('dog','horse','cattle'));
alter table public.stud_requests add column if not exists kind text not null default 'dog' check (kind in ('dog','horse','cattle'));

-- dog trial keys don't overlap horse/cattle event keys cleanly (e.g. both
-- horses and cattle have a "halter" class) — drop the old dog-only enum
-- check so any kind's event key can be stored; validity is enforced by
-- trial_score() only recognizing real (kind, event) combinations.
alter table public.challenges drop constraint if exists challenges_trial_check;

-- Generic across all three kinds: average of whatever numeric stats exist,
-- rather than hardcoded dog stat names.
create or replace function public.overall_rating(p_stats jsonb)
returns numeric
language sql
immutable
as $$
  select coalesce(avg((value)::numeric), 0) from jsonb_each_text(p_stats) where value ~ '^-?[0-9]+(\.[0-9]+)?$';
$$;

drop function if exists public.trial_score(jsonb, text);
create or replace function public.trial_score(p_stats jsonb, p_trial text, p_kind text default 'dog')
returns numeric
language sql
immutable
as $$
  select case
    when p_kind = 'dog' and p_trial = 'weightpull' then (p_stats->>'gameness')::numeric*0.3 + (p_stats->>'grip')::numeric*0.35 + (p_stats->>'conformation')::numeric*0.35
    when p_kind = 'dog' and p_trial = 'catchcourse' then (p_stats->>'gameness')::numeric*0.4 + (p_stats->>'speed')::numeric*0.3 + (p_stats->>'grip')::numeric*0.3
    when p_kind = 'dog' and p_trial = 'treeingtrial' then (p_stats->>'nose')::numeric*0.5 + (p_stats->>'stamina')::numeric*0.5
    when p_kind = 'dog' and p_trial = 'show' then (p_stats->>'conformation')::numeric
    when p_kind = 'horse' and p_trial = 'barrelracing' then (p_stats->>'speed')::numeric*0.45 + (p_stats->>'agility')::numeric*0.35 + (p_stats->>'temperament')::numeric*0.2
    when p_kind = 'horse' and p_trial = 'reining' then (p_stats->>'agility')::numeric*0.4 + (p_stats->>'temperament')::numeric*0.35 + (p_stats->>'conformation')::numeric*0.25
    when p_kind = 'horse' and p_trial = 'racing' then (p_stats->>'speed')::numeric*0.55 + (p_stats->>'stamina')::numeric*0.45
    when p_kind = 'horse' and p_trial = 'halter' then (p_stats->>'conformation')::numeric
    when p_kind = 'horse' and p_trial = 'jumping' then (p_stats->>'agility')::numeric*0.45 + (p_stats->>'conformation')::numeric*0.3 + (p_stats->>'temperament')::numeric*0.25
    when p_kind = 'horse' and p_trial = 'pulling' then (p_stats->>'strength')::numeric*0.6 + (p_stats->>'stamina')::numeric*0.4
    when p_kind = 'cattle' and p_trial = 'halter' then (p_stats->>'conformation')::numeric*0.6 + (p_stats->>'muscle')::numeric*0.25 + (p_stats->>'temperament')::numeric*0.15
    when p_kind = 'cattle' and p_trial = 'showmanship' then (p_stats->>'temperament')::numeric*0.55 + (p_stats->>'conformation')::numeric*0.25 + (p_stats->>'muscle')::numeric*0.2
    else 0
  end + (random() * 24 - 12);
$$;

-- Kind-aware capacity: dogs use land+house, horses/cattle share the
-- pasture pool (their combined count against pasture capacity).
create or replace function public.kind_capacity(p_state jsonb, p_kind text)
returns numeric
language sql
immutable
as $$
  select case when p_kind = 'dog' then
    (case p_state->'property'->>'landKey'
      when 'rented' then 8 when 'quarter' then 10 when 'half' then 13 when 'one' then 16
      when 'two' then 20 when 'five' then 26 when 'ten' then 33 when 'twenty' then 42
      when 'forty' then 53 when 'eighty' then 68 when 'onesixty' then 88 when 'section' then 120
      else 8 end)
    + (case p_state->'property'->>'houseKey'
      when 'trailer' then 1 when 'doublewide' then 2 when 'starter' then 4 when 'farmhouse' then 6
      when 'ranch' then 9 when 'ranchkennel' then 14 when 'compound' then 22 when 'showcompound' then 32
      else 0 end)
  else
    (case p_state->'property'->>'pastureKey'
      when 'paddock' then 3 when 'horsepasture' then 7 when 'cattlepasture' then 12
      when 'mixedrange' then 20 when 'grandranch' then 35 when 'vastrange' then 60 else 0 end)
  end;
$$;
create or replace function public.kind_count(p_state jsonb, p_kind text)
returns numeric
language sql
immutable
as $$
  select case when p_kind = 'dog' then jsonb_array_length(coalesce(p_state->'dogs','[]'::jsonb))
    else jsonb_array_length(coalesce(p_state->'horses','[]'::jsonb)) + jsonb_array_length(coalesce(p_state->'cattle','[]'::jsonb))
  end;
$$;
create or replace function public.kind_field(p_kind text)
returns text
language sql
immutable
as $$
  select case p_kind when 'horse' then 'horses' when 'cattle' then 'cattle' else 'dogs' end;
$$;

drop function if exists public.purchase_listing(uuid);
create or replace function public.purchase_listing(p_listing_id uuid, p_kind text default 'dog')
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
  v_field text := public.kind_field(p_kind);
begin
  if v_buyer_id is null then raise exception 'Not authenticated'; end if;

  select * into v_listing from public.market_listings where id = p_listing_id for update;
  if not found then raise exception 'Listing not found'; end if;
  if v_listing.status <> 'active' then raise exception 'Listing is no longer available'; end if;
  if v_listing.seller_id = v_buyer_id then raise exception 'Cannot buy your own listing'; end if;

  select state into v_buyer_state from public.kennels where user_id = v_buyer_id for update;
  if v_buyer_state is null then raise exception 'Buyer kennel not found'; end if;

  v_buyer_cash := coalesce((v_buyer_state->>'cash')::numeric, 0);
  if v_buyer_cash < v_listing.price then raise exception 'Not enough cash'; end if;
  if public.kind_count(v_buyer_state, p_kind) >= public.kind_capacity(v_buyer_state, p_kind) then
    raise exception 'Not enough room for this animal';
  end if;

  v_buyer_state := jsonb_set(v_buyer_state, '{cash}', to_jsonb(v_buyer_cash - v_listing.price));
  v_buyer_state := jsonb_set(v_buyer_state, array[v_field], (coalesce(v_buyer_state->v_field,'[]'::jsonb)) || jsonb_build_array(v_listing.dog));
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

drop function if exists public.place_pups(uuid, jsonb);
create or replace function public.place_pups(p_user_id uuid, p_pups jsonb, p_kind text default 'dog')
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state jsonb;
  v_field text := public.kind_field(p_kind);
  v_room int;
  v_kept jsonb; v_overflow jsonb;
  v_overflow_value numeric := 0;
begin
  select state into v_state from public.kennels where user_id = p_user_id for update;
  if v_state is null then return 0; end if;

  v_room := greatest(0, public.kind_capacity(v_state, p_kind)::int - public.kind_count(v_state, p_kind)::int);

  v_kept := coalesce((select jsonb_agg(p) from (select value as p from jsonb_array_elements(p_pups) with ordinality a(value, ord) order by ord limit v_room) s), '[]'::jsonb);
  v_overflow := coalesce((select jsonb_agg(p) from (select value as p from jsonb_array_elements(p_pups) with ordinality a(value, ord) order by ord offset v_room) s), '[]'::jsonb);

  if jsonb_array_length(v_overflow) > 0 then
    if p_kind = 'dog' then
      select sum(round(public.overall_rating(p->'stats') * 3)) into v_overflow_value from jsonb_array_elements(v_overflow) p;
    elsif p_kind = 'horse' then
      select sum(round(public.overall_rating(p->'stats') * 27.5)) into v_overflow_value from jsonb_array_elements(v_overflow) p;
    else
      select sum(round(((p->'stats'->>'weight')::numeric / 100) * coalesce((p->>'weightLb')::numeric, 65) * 0.68)) into v_overflow_value from jsonb_array_elements(v_overflow) p;
    end if;
    v_overflow_value := coalesce(v_overflow_value, 0);
  end if;

  v_state := jsonb_set(v_state, array[v_field], (coalesce(v_state->v_field,'[]'::jsonb)) || v_kept);
  v_state := jsonb_set(v_state, '{cash}', to_jsonb(coalesce((v_state->>'cash')::numeric, 0) + v_overflow_value));
  update public.kennels set state = v_state where user_id = p_user_id;
  return v_overflow_value;
end;
$$;

drop function if exists public.accept_challenge(uuid, jsonb, text);
create or replace function public.accept_challenge(p_challenge_id uuid, p_dog jsonb, p_opponent_name text, p_kind text default 'dog')
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

  v_score_creator := public.trial_score(v_challenge.dog->'stats', v_challenge.trial, p_kind);
  v_score_opponent := public.trial_score(p_dog->'stats', v_challenge.trial, p_kind);
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

  update public.kennels set state = jsonb_set(state, '{fame}', to_jsonb(coalesce((state->>'fame')::numeric,0) + 3))
    where user_id = v_winner;
  update public.kennels set state = jsonb_set(state, '{fame}', to_jsonb(coalesce((state->>'fame')::numeric,0) + 1))
    where user_id = (case when v_winner = v_challenge.creator_id then v_opponent_id else v_challenge.creator_id end);

  return v_result;
end;
$$;

drop function if exists public.accept_stud_request(uuid, jsonb);
create or replace function public.accept_stud_request(p_request_id uuid, p_pups jsonb, p_kind text default 'dog')
returns public.stud_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req record;
  v_caller uuid := auth.uid();
  v_owner_rating numeric; v_requester_rating numeric;
  v_sorted jsonb;
  v_n int;
  v_owner_share jsonb; v_requester_share jsonb;
  v_owner_first boolean;
  v_owner_overflow numeric; v_requester_overflow numeric;
  v_fee numeric;
  v_result public.stud_requests;
  v_field text := public.kind_field(p_kind);
begin
  if v_caller is null then raise exception 'Not authenticated'; end if;

  select * into v_req from public.stud_requests where id = p_request_id for update;
  if not found then raise exception 'Request not found'; end if;
  if v_req.status <> 'pending' then raise exception 'Request already resolved'; end if;
  if v_req.owner_id <> v_caller then raise exception 'Only the stud owner can accept'; end if;

  v_n := jsonb_array_length(p_pups);
  if v_n = 0 then raise exception 'No pups to place'; end if;

  v_owner_rating := public.overall_rating(v_req.stud->'stats');
  v_requester_rating := public.overall_rating(v_req.dam->'stats');
  v_owner_first := v_owner_rating >= v_requester_rating;

  select jsonb_agg(p order by public.overall_rating(p->'stats') desc)
    into v_sorted from jsonb_array_elements(p_pups) p;

  if v_owner_first then
    v_owner_share := (select jsonb_agg(p) from (select value as p from jsonb_array_elements(v_sorted) with ordinality a(value, ord) order by ord limit ceil(v_n / 2.0)) s);
    v_requester_share := (select jsonb_agg(p) from (select value as p from jsonb_array_elements(v_sorted) with ordinality a(value, ord) order by ord offset ceil(v_n / 2.0)) s);
  else
    v_requester_share := (select jsonb_agg(p) from (select value as p from jsonb_array_elements(v_sorted) with ordinality a(value, ord) order by ord limit ceil(v_n / 2.0)) s);
    v_owner_share := (select jsonb_agg(p) from (select value as p from jsonb_array_elements(v_sorted) with ordinality a(value, ord) order by ord offset ceil(v_n / 2.0)) s);
  end if;

  declare
    v_dam_idx int;
    v_cooldown int := case p_kind when 'horse' then 60 when 'cattle' then 55 else 45 end;
    v_health_cost numeric := case p_kind when 'horse' then 18 when 'cattle' then 16 else 14 end;
  begin
    select ord - 1 into v_dam_idx from public.kennels k, jsonb_array_elements(k.state->v_field) with ordinality e(val, ord)
      where k.user_id = v_req.requester_id and val->>'id' = v_req.dam->>'id' limit 1;
    if v_dam_idx is not null then
      update public.kennels set state = jsonb_set(
        jsonb_set(state, array[v_field, v_dam_idx::text, 'breedCooldown'], to_jsonb(v_cooldown)),
        array[v_field, v_dam_idx::text, 'health'],
        to_jsonb(greatest(0, (state->v_field->v_dam_idx->>'health')::numeric - v_health_cost))
      ) where user_id = v_req.requester_id;
    end if;
  end;

  v_owner_overflow := public.place_pups(v_req.owner_id, coalesce(v_owner_share, '[]'::jsonb), p_kind);
  v_requester_overflow := public.place_pups(v_req.requester_id, coalesce(v_requester_share, '[]'::jsonb), p_kind);

  v_fee := coalesce(v_req.fee, 0);
  if v_fee > 0 then
    update public.kennels set state = jsonb_set(state, '{cash}', to_jsonb(greatest(0, coalesce((state->>'cash')::numeric,0) - v_fee))) where user_id = v_req.requester_id;
    update public.kennels set state = jsonb_set(state, '{cash}', to_jsonb(coalesce((state->>'cash')::numeric,0) + v_fee)) where user_id = v_req.owner_id;
  end if;

  update public.stud_requests set
    status = 'completed',
    resolved_at = now(),
    litter_summary = jsonb_build_object(
      'total', v_n,
      'ownerGotBetterHalf', v_owner_first,
      'ownerKept', jsonb_array_length(coalesce(v_owner_share,'[]'::jsonb)),
      'requesterKept', jsonb_array_length(coalesce(v_requester_share,'[]'::jsonb)),
      'ownerOverflowValue', v_owner_overflow,
      'requesterOverflowValue', v_requester_overflow
    )
  where id = p_request_id
  returning * into v_result;

  return v_result;
end;
$$;

grant execute on function public.kind_capacity(jsonb, text) to authenticated;
grant execute on function public.kind_count(jsonb, text) to authenticated;
grant execute on function public.kind_field(text) to authenticated;
grant execute on function public.trial_score(jsonb, text, text) to authenticated, anon;
grant execute on function public.purchase_listing(uuid, text) to authenticated;
grant execute on function public.place_pups(uuid, jsonb, text) to authenticated;
grant execute on function public.accept_challenge(uuid, jsonb, text, text) to authenticated;
grant execute on function public.accept_stud_request(uuid, jsonb, text) to authenticated;


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
    -- Saves edited with the admin tools are kept off the public board;
    -- granting yourself a million dollars shouldn't outrank a real kennel.
    and coalesce((k.state->>'adminUsed')::boolean, false) = false
  order by k.net_worth desc;

grant select on public.leaderboard to anon, authenticated;


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


-- ############################################################################
-- Phase 2: relational shape
-- ############################################################################
-- Mirrors migrations/003_phase2_relational.sql. That file is the paste-able
-- delta for the live project; this one is the whole schema from empty, and is
-- what CI applies to a throwaway Postgres on every push.
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
