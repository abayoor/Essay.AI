-- Saved GPS rides remain private. Only a rider's explicit post exposes a simplified route snapshot.
alter table public.ride_activities
  add column if not exists title text,
  add column if not exists description text;

alter table public.ride_activities
  drop constraint if exists ride_activities_title_length,
  drop constraint if exists ride_activities_description_length,
  add constraint ride_activities_title_length check (title is null or char_length(trim(title)) between 1 and 120),
  add constraint ride_activities_description_length check (description is null or char_length(trim(description)) <= 1000);

create index if not exists ride_activities_user_created_at_idx
  on public.ride_activities (user_id, created_at desc);

alter table public.posts
  add column if not exists route_id uuid references public.routes (id) on delete set null,
  add column if not exists route_title text,
  add column if not exists route_description text,
  add column if not exists route_path jsonb,
  add column if not exists route_distance_km numeric,
  add column if not exists route_elevation_gain_m numeric,
  add column if not exists route_difficulty text;

alter table public.posts
  drop constraint if exists posts_route_title_length,
  drop constraint if exists posts_route_description_length,
  drop constraint if exists posts_route_path_is_array,
  drop constraint if exists posts_route_distance_valid,
  drop constraint if exists posts_route_elevation_valid,
  drop constraint if exists posts_route_difficulty_valid,
  add constraint posts_route_title_length check (route_title is null or char_length(trim(route_title)) between 1 and 120),
  add constraint posts_route_description_length check (route_description is null or char_length(trim(route_description)) <= 1000),
  add constraint posts_route_path_is_array check (route_path is null or jsonb_typeof(route_path) = 'array'),
  add constraint posts_route_distance_valid check (route_distance_km is null or route_distance_km >= 0),
  add constraint posts_route_elevation_valid check (route_elevation_gain_m is null or route_elevation_gain_m >= 0),
  add constraint posts_route_difficulty_valid check (route_difficulty is null or route_difficulty in ('easy', 'moderate', 'hard'));

create index if not exists posts_route_id_idx on public.posts (route_id) where route_id is not null;
