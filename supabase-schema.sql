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
