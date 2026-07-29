-- GPS recordings stay private just like the rest of a rider's activities.
alter table public.ride_activities
  add column if not exists gps_track jsonb,
  add column if not exists avg_speed_kmh numeric,
  add column if not exists max_speed_kmh numeric,
  add column if not exists moving_time_seconds integer,
  add column if not exists pace_min_per_km numeric;

alter table public.ride_activities
  drop constraint if exists ride_activities_gps_track_is_array,
  drop constraint if exists ride_activities_moving_time_valid,
  drop constraint if exists ride_activities_average_speed_valid,
  drop constraint if exists ride_activities_max_speed_valid,
  drop constraint if exists ride_activities_pace_valid,
  drop constraint if exists ride_activities_source_allowed,
  add constraint ride_activities_gps_track_is_array check (gps_track is null or jsonb_typeof(gps_track) = 'array'),
  add constraint ride_activities_moving_time_valid check (moving_time_seconds is null or moving_time_seconds >= 0),
  add constraint ride_activities_average_speed_valid check (avg_speed_kmh is null or avg_speed_kmh >= 0),
  add constraint ride_activities_max_speed_valid check (max_speed_kmh is null or max_speed_kmh >= 0),
  add constraint ride_activities_pace_valid check (pace_min_per_km is null or pace_min_per_km >= 0),
  add constraint ride_activities_source_allowed check (source in ('manual', 'strava', 'gps'));

create index if not exists ride_activities_gps_recorded_at_idx
  on public.ride_activities (user_id, created_at desc)
  where source = 'gps';

alter table public.posts
  add column if not exists ride_track jsonb;

alter table public.posts
  drop constraint if exists posts_ride_track_is_array,
  add constraint posts_ride_track_is_array check (ride_track is null or jsonb_typeof(ride_track) = 'array');
