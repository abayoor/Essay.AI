-- CycleSpace: replace EssayCoach data with the cycling-community schema.
-- The generic `entries` table is intentionally kept: GitHub keep-alive reads it daily.

drop trigger if exists set_essays_updated_at on public.essays;
drop trigger if exists on_auth_user_created on auth.users;

drop table if exists public.ai_usage_events cascade;
drop table if exists public.referrals cascade;
drop table if exists public.interview_practice_sessions cascade;
drop table if exists public.feedback_logs cascade;
drop table if exists public.essay_versions cascade;
drop table if exists public.essays cascade;
drop table if exists public.prompts cascade;
drop table if exists public.example_patterns cascade;
drop table if exists public.pattern_contributions cascade;
drop table if exists public.mentor_sessions cascade;
drop table if exists public.mentors cascade;
drop table if exists public.deadline_reminders cascade;

drop function if exists public.find_similar_essay_versions(uuid, extensions.vector, double precision, integer);
drop function if exists public.apply_referral_code(text);
drop function if exists public.consume_ai_analysis_credit();
drop function if exists public.set_updated_at();
drop function if exists public.handle_new_user();
drop index if exists public.users_referral_code_key;

alter table public.users
  drop column if exists locale,
  drop column if exists target_schools,
  drop column if exists application_type,
  drop column if exists referral_code,
  drop column if exists ai_bonus_credits,
  add column if not exists avatar_url text,
  add column if not exists home_city text,
  add column if not exists bio text;

update public.users as profile
set email = coalesce(nullif(profile.email, ''), auth_users.email, '')
from auth.users as auth_users
where profile.id = auth_users.id;

create or replace function public.create_cycle_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.create_cycle_user();

insert into public.users (id, email, full_name)
select id, coalesce(email, ''), coalesce(raw_user_meta_data ->> 'full_name', '')
from auth.users
on conflict (id) do nothing;

create table public.bikes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  brand text,
  bike_type text not null check (bike_type in ('road', 'mountain', 'gravel', 'city')),
  purchase_date date,
  total_distance_km numeric not null default 0 check (total_distance_km >= 0),
  created_at timestamptz not null default now()
);

create table public.maintenance_intervals (
  id uuid primary key default gen_random_uuid(),
  bike_id uuid not null references public.bikes (id) on delete cascade,
  component text not null check (component in ('chain', 'tires', 'brake_pads', 'cassette')),
  interval_km integer not null check (interval_km > 0),
  last_service_km numeric not null default 0 check (last_service_km >= 0),
  last_service_date date,
  unique (bike_id, component)
);

create table public.routes (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null default auth.uid() references public.users (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 120),
  description text,
  path jsonb not null default '[]'::jsonb check (jsonb_typeof(path) = 'array'),
  distance_km numeric not null default 0 check (distance_km >= 0),
  elevation_gain_m numeric not null default 0 check (elevation_gain_m >= 0),
  difficulty text not null default 'moderate' check (difficulty in ('easy', 'moderate', 'hard')),
  region text,
  created_at timestamptz not null default now()
);

create table public.route_comments (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.routes (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.users (id) on delete cascade,
  comment text not null check (char_length(trim(comment)) between 1 and 1000),
  rating integer check (rating between 1 and 5),
  created_at timestamptz not null default now()
);

create table public.ride_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.users (id) on delete cascade,
  bike_id uuid references public.bikes (id) on delete set null,
  route_id uuid references public.routes (id) on delete set null,
  distance_km numeric not null check (distance_km > 0 and distance_km <= 2000),
  duration_seconds integer check (duration_seconds > 0),
  elevation_gain_m numeric check (elevation_gain_m >= 0),
  ride_date date not null default current_date,
  created_at timestamptz not null default now()
);

create index idx_activities_user_date on public.ride_activities (user_id, ride_date desc);

create table public.segments (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.routes (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 100),
  distance_km numeric not null default 0 check (distance_km >= 0),
  start_point jsonb not null check (jsonb_typeof(start_point) = 'object'),
  end_point jsonb not null check (jsonb_typeof(end_point) = 'object')
);

create table public.segment_times (
  id uuid primary key default gen_random_uuid(),
  segment_id uuid not null references public.segments (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.users (id) on delete cascade,
  ride_activity_id uuid references public.ride_activities (id) on delete set null,
  time_seconds integer not null check (time_seconds > 0),
  achieved_at timestamptz not null default now()
);

create table public.group_rides (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null default auth.uid() references public.users (id) on delete cascade,
  route_id uuid references public.routes (id) on delete set null,
  title text not null check (char_length(trim(title)) between 1 and 120),
  meeting_point jsonb not null default '{}'::jsonb check (jsonb_typeof(meeting_point) = 'object'),
  scheduled_at timestamptz not null,
  max_participants integer check (max_participants > 0),
  description text,
  created_at timestamptz not null default now()
);

create table public.group_ride_participants (
  id uuid primary key default gen_random_uuid(),
  group_ride_id uuid not null references public.group_rides (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.users (id) on delete cascade,
  status text not null default 'going' check (status in ('going', 'maybe', 'not_going')),
  unique (group_ride_id, user_id)
);

create table public.hazard_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid() references public.users (id) on delete cascade,
  location jsonb not null check (jsonb_typeof(location) = 'object'),
  hazard_type text not null check (hazard_type in ('pothole', 'no_lighting', 'glass', 'aggressive_dogs', 'road_closed')),
  description text,
  photo_url text,
  upvotes integer not null default 0 check (upvotes >= 0),
  status text not null default 'active' check (status in ('active', 'resolved')),
  created_at timestamptz not null default now()
);

create table public.events_calendar (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 1 and 120),
  event_type text not null check (event_type in ('race', 'gran_fondo', 'club_ride')),
  event_date date not null,
  location text,
  registration_url text,
  description text
);

create table public.event_interest (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events_calendar (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.users (id) on delete cascade,
  unique (event_id, user_id)
);

create table public.challenge_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 80),
  is_public boolean not null default true,
  created_by uuid not null default auth.uid() references public.users (id) on delete cascade
);

create table public.challenge_group_members (
  id uuid primary key default gen_random_uuid(),
  challenge_group_id uuid not null references public.challenge_groups (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.users (id) on delete cascade,
  unique (challenge_group_id, user_id)
);

create table public.marketplace_listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null default auth.uid() references public.users (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 120),
  description text not null default '',
  price numeric not null check (price >= 0),
  category text not null check (category in ('bike', 'frame', 'wheels', 'components', 'accessories')),
  condition text not null check (condition in ('new', 'like_new', 'used', 'for_parts')),
  photos text[] not null default '{}',
  city text,
  status text not null default 'active' check (status in ('active', 'sold')),
  created_at timestamptz not null default now()
);

create or replace function public.refresh_bike_distance(target_bike_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if target_bike_id is null then return; end if;
  update public.bikes
  set total_distance_km = coalesce((
    select sum(distance_km) from public.ride_activities where bike_id = target_bike_id
  ), 0)
  where id = target_bike_id;
end;
$$;

create or replace function public.sync_bike_distance()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then perform public.refresh_bike_distance(old.bike_id); end if;
  if tg_op in ('INSERT', 'UPDATE') then perform public.refresh_bike_distance(new.bike_id); end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger refresh_bike_distance_after_activity
  after insert or update or delete on public.ride_activities
  for each row execute procedure public.sync_bike_distance();

alter table public.users enable row level security;
alter table public.bikes enable row level security;
alter table public.maintenance_intervals enable row level security;
alter table public.routes enable row level security;
alter table public.route_comments enable row level security;
alter table public.ride_activities enable row level security;
alter table public.segments enable row level security;
alter table public.segment_times enable row level security;
alter table public.group_rides enable row level security;
alter table public.group_ride_participants enable row level security;
alter table public.hazard_reports enable row level security;
alter table public.events_calendar enable row level security;
alter table public.event_interest enable row level security;
alter table public.challenge_groups enable row level security;
alter table public.challenge_group_members enable row level security;
alter table public.marketplace_listings enable row level security;

revoke all on public.users from authenticated;
grant select, update (full_name, avatar_url, home_city, bio) on public.users to authenticated;
grant select, insert, update, delete on public.bikes, public.maintenance_intervals, public.ride_activities to authenticated;
grant select, insert, update, delete on public.routes, public.route_comments to authenticated;
grant select, insert, update, delete on public.segments, public.segment_times to authenticated;
grant select, insert, update, delete on public.group_rides, public.group_ride_participants to authenticated;
grant select, insert, update, delete on public.hazard_reports, public.event_interest to authenticated;
grant select on public.events_calendar to authenticated;
grant select, insert, update, delete on public.challenge_groups, public.challenge_group_members to authenticated;
grant select, insert, update, delete on public.marketplace_listings to authenticated;

create policy "riders read own profile" on public.users for select using (auth.uid() = id);
create policy "riders update own profile" on public.users for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "riders manage own bikes" on public.bikes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "riders manage own maintenance" on public.maintenance_intervals for all using (exists (select 1 from public.bikes where bikes.id = maintenance_intervals.bike_id and bikes.user_id = auth.uid())) with check (exists (select 1 from public.bikes where bikes.id = maintenance_intervals.bike_id and bikes.user_id = auth.uid()));
create policy "riders manage own activities" on public.ride_activities for all using (auth.uid() = user_id) with check (auth.uid() = user_id and (bike_id is null or exists (select 1 from public.bikes where bikes.id = ride_activities.bike_id and bikes.user_id = auth.uid())));
create policy "riders read routes" on public.routes for select using (auth.role() = 'authenticated');
create policy "riders create routes" on public.routes for insert with check (auth.uid() = creator_id);
create policy "riders update own routes" on public.routes for update using (auth.uid() = creator_id) with check (auth.uid() = creator_id);
create policy "riders delete own routes" on public.routes for delete using (auth.uid() = creator_id);
create policy "riders read route comments" on public.route_comments for select using (auth.role() = 'authenticated');
create policy "riders create route comments" on public.route_comments for insert with check (auth.uid() = user_id);
create policy "riders update own route comments" on public.route_comments for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "riders delete own route comments" on public.route_comments for delete using (auth.uid() = user_id);
create policy "riders read segments" on public.segments for select using (auth.role() = 'authenticated');
create policy "route creators manage segments" on public.segments for all using (exists (select 1 from public.routes where routes.id = segments.route_id and routes.creator_id = auth.uid())) with check (exists (select 1 from public.routes where routes.id = segments.route_id and routes.creator_id = auth.uid()));
create policy "riders read segment times" on public.segment_times for select using (auth.role() = 'authenticated');
create policy "riders create own segment times" on public.segment_times for insert with check (auth.uid() = user_id and (ride_activity_id is null or exists (select 1 from public.ride_activities where ride_activities.id = segment_times.ride_activity_id and ride_activities.user_id = auth.uid())));
create policy "riders manage own segment times" on public.segment_times for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "riders delete own segment times" on public.segment_times for delete using (auth.uid() = user_id);
create policy "riders read group rides" on public.group_rides for select using (auth.role() = 'authenticated');
create policy "riders create group rides" on public.group_rides for insert with check (auth.uid() = creator_id);
create policy "riders manage own group rides" on public.group_rides for update using (auth.uid() = creator_id) with check (auth.uid() = creator_id);
create policy "riders delete own group rides" on public.group_rides for delete using (auth.uid() = creator_id);
create policy "riders read group participants" on public.group_ride_participants for select using (auth.role() = 'authenticated');
create policy "riders join group rides" on public.group_ride_participants for insert with check (auth.uid() = user_id);
create policy "riders update own participation" on public.group_ride_participants for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "riders leave group rides" on public.group_ride_participants for delete using (auth.uid() = user_id);
create policy "riders read hazards" on public.hazard_reports for select using (auth.role() = 'authenticated');
create policy "riders create hazards" on public.hazard_reports for insert with check (auth.uid() = reporter_id);
create policy "riders manage own hazards" on public.hazard_reports for update using (auth.uid() = reporter_id) with check (auth.uid() = reporter_id);
create policy "riders delete own hazards" on public.hazard_reports for delete using (auth.uid() = reporter_id);
create policy "riders read events" on public.events_calendar for select using (auth.role() = 'authenticated');
create policy "riders read own event interest" on public.event_interest for select using (auth.uid() = user_id);
create policy "riders manage own event interest" on public.event_interest for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "riders read public challenge groups" on public.challenge_groups for select using (is_public or created_by = auth.uid());
create policy "riders create challenge groups" on public.challenge_groups for insert with check (auth.uid() = created_by);
create policy "riders manage own challenge groups" on public.challenge_groups for update using (auth.uid() = created_by) with check (auth.uid() = created_by);
create policy "riders delete own challenge groups" on public.challenge_groups for delete using (auth.uid() = created_by);
create policy "riders read challenge members" on public.challenge_group_members for select using (exists (select 1 from public.challenge_groups where challenge_groups.id = challenge_group_members.challenge_group_id and (challenge_groups.is_public or challenge_groups.created_by = auth.uid())));
create policy "riders manage own challenge membership" on public.challenge_group_members for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "riders read marketplace" on public.marketplace_listings for select using (auth.role() = 'authenticated');
create policy "riders create listings" on public.marketplace_listings for insert with check (auth.uid() = seller_id);
create policy "riders manage own listings" on public.marketplace_listings for update using (auth.uid() = seller_id) with check (auth.uid() = seller_id);
create policy "riders delete own listings" on public.marketplace_listings for delete using (auth.uid() = seller_id);

revoke all on function public.refresh_bike_distance(uuid) from public;
revoke all on function public.sync_bike_distance() from public;
