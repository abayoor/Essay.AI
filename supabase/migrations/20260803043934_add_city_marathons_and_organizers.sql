alter table public.events_calendar
  drop constraint if exists events_calendar_event_type_check;

alter table public.events_calendar
  add constraint events_calendar_event_type_check
  check (event_type in ('race', 'gran_fondo', 'club_ride', 'marathon')),
  add column if not exists organizer_id uuid default auth.uid() references public.users (id) on delete set null,
  add column if not exists organizer_name text,
  add column if not exists city text,
  add column if not exists country text,
  add column if not exists distance_km numeric(7, 1),
  add column if not exists created_at timestamptz not null default now();

alter table public.events_calendar
  add constraint events_calendar_organizer_name_check
    check (organizer_name is null or char_length(trim(organizer_name)) between 2 and 100),
  add constraint events_calendar_city_check
    check (city is null or char_length(trim(city)) between 2 and 100),
  add constraint events_calendar_country_check
    check (country is null or char_length(trim(country)) between 2 and 100),
  add constraint events_calendar_distance_check
    check (distance_km is null or distance_km between 1 and 2000);

grant insert, update, delete on public.events_calendar to authenticated;

create policy "organizers publish own cycling events"
on public.events_calendar
for insert
to authenticated
with check (
  auth.uid() = organizer_id
  and organizer_name is not null
  and city is not null
);

create policy "organizers update own cycling events"
on public.events_calendar
for update
to authenticated
using (auth.uid() = organizer_id)
with check (auth.uid() = organizer_id);

create policy "organizers delete own cycling events"
on public.events_calendar
for delete
to authenticated
using (auth.uid() = organizer_id);

create index if not exists events_calendar_city_date_idx
  on public.events_calendar (lower(city), event_date);

create index if not exists events_calendar_organizer_idx
  on public.events_calendar (organizer_id);
