create table public.map_places (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  place_kind text not null check (place_kind in ('history', 'home', 'work', 'favorite')),
  source_id text not null check (char_length(source_id) between 1 and 220),
  name text not null check (char_length(name) between 1 and 160),
  subtitle text not null default '' check (char_length(subtitle) <= 500),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  last_used_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, place_kind, source_id)
);

create unique index map_places_one_home_per_rider
  on public.map_places (user_id)
  where place_kind = 'home';

create unique index map_places_one_work_per_rider
  on public.map_places (user_id)
  where place_kind = 'work';

create index map_places_history_by_rider
  on public.map_places (user_id, last_used_at desc)
  where place_kind = 'history';

create or replace function public.set_map_places_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_map_places_updated_at
  before update on public.map_places
  for each row execute procedure public.set_map_places_updated_at();

alter table public.map_places enable row level security;

grant select, insert, update, delete on public.map_places to authenticated;

create policy "riders read own map places"
  on public.map_places for select
  using (auth.uid() = user_id);

create policy "riders create own map places"
  on public.map_places for insert
  with check (auth.uid() = user_id);

create policy "riders update own map places"
  on public.map_places for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "riders delete own map places"
  on public.map_places for delete
  using (auth.uid() = user_id);
