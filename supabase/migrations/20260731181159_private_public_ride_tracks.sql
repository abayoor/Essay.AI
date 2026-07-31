-- Public ride geometry is written only through a fail-closed server-side sanitizer.
-- Planned route previews are intentionally not privacy-trimmed: route_path is public by design.

create or replace function public.is_valid_geo_point(p_point jsonb)
returns boolean
language plpgsql
immutable
strict
parallel safe
set search_path = pg_catalog
as $$
declare
  v_latitude numeric;
  v_longitude numeric;
begin
  if pg_catalog.jsonb_typeof(p_point) is distinct from 'object'
    or pg_catalog.jsonb_typeof(p_point -> 'lat') is distinct from 'number'
    or pg_catalog.jsonb_typeof(p_point -> 'lng') is distinct from 'number'
  then
    return false;
  end if;

  begin
    v_latitude := (p_point ->> 'lat')::numeric;
    v_longitude := (p_point ->> 'lng')::numeric;
  exception
    when others then
      return false;
  end;

  return v_latitude::text not in ('NaN', 'Infinity', '-Infinity')
    and v_longitude::text not in ('NaN', 'Infinity', '-Infinity')
    and v_latitude between -90 and 90
    and v_longitude between -180 and 180;
end;
$$;

create or replace function public.public_track_distance_m(
  p_first_latitude double precision,
  p_first_longitude double precision,
  p_second_latitude double precision,
  p_second_longitude double precision
)
returns double precision
language plpgsql
immutable
strict
parallel safe
set search_path = pg_catalog
as $$
declare
  v_earth_radius_m constant double precision := 6371000.0;
  v_first_latitude_radians double precision;
  v_second_latitude_radians double precision;
  v_latitude_delta double precision;
  v_longitude_delta double precision;
  v_haversine double precision;
begin
  v_first_latitude_radians := pg_catalog.radians(p_first_latitude);
  v_second_latitude_radians := pg_catalog.radians(p_second_latitude);
  v_latitude_delta := pg_catalog.radians(p_second_latitude - p_first_latitude);
  v_longitude_delta := pg_catalog.radians(p_second_longitude - p_first_longitude);
  v_haversine := pg_catalog.power(pg_catalog.sin(v_latitude_delta / 2.0), 2)
    + pg_catalog.cos(v_first_latitude_radians)
      * pg_catalog.cos(v_second_latitude_radians)
      * pg_catalog.power(pg_catalog.sin(v_longitude_delta / 2.0), 2);
  v_haversine := least(1.0, greatest(0.0, v_haversine));

  return v_earth_radius_m * 2.0
    * pg_catalog.atan2(pg_catalog.sqrt(v_haversine), pg_catalog.sqrt(1.0 - v_haversine));
end;
$$;

create or replace function public.public_track_point_to_segment_distance_m(
  p_point_latitude double precision,
  p_point_longitude double precision,
  p_segment_start_latitude double precision,
  p_segment_start_longitude double precision,
  p_segment_end_latitude double precision,
  p_segment_end_longitude double precision
)
returns double precision
language plpgsql
immutable
strict
parallel safe
set search_path = pg_catalog
as $$
declare
  v_earth_radius_m constant double precision := 6371000.0;
  v_segment_angle double precision;
  v_start_to_point_angle double precision;
  v_start_latitude_radians double precision;
  v_end_latitude_radians double precision;
  v_point_latitude_radians double precision;
  v_end_longitude_delta double precision;
  v_point_longitude_delta double precision;
  v_bearing_to_end double precision;
  v_bearing_to_point double precision;
  v_bearing_delta double precision;
  v_cross_track_sine double precision;
  v_cross_track_angle double precision;
  v_along_track_angle double precision;
begin
  v_segment_angle := public.public_track_distance_m(
    p_segment_start_latitude,
    p_segment_start_longitude,
    p_segment_end_latitude,
    p_segment_end_longitude
  ) / v_earth_radius_m;

  if v_segment_angle <= 0.000000000001 then
    return public.public_track_distance_m(
      p_point_latitude,
      p_point_longitude,
      p_segment_start_latitude,
      p_segment_start_longitude
    );
  end if;

  -- Bearings at an exact pole or for an antipodal segment are ambiguous. Returning zero
  -- makes the caller reject that segment instead of making a privacy-unsafe guess.
  if pg_catalog.abs(p_segment_start_latitude) >= 89.999999
    or v_segment_angle >= pg_catalog.pi() - 0.000000001
  then
    return 0.0;
  end if;

  v_start_to_point_angle := public.public_track_distance_m(
    p_segment_start_latitude,
    p_segment_start_longitude,
    p_point_latitude,
    p_point_longitude
  ) / v_earth_radius_m;
  v_start_latitude_radians := pg_catalog.radians(p_segment_start_latitude);
  v_end_latitude_radians := pg_catalog.radians(p_segment_end_latitude);
  v_point_latitude_radians := pg_catalog.radians(p_point_latitude);
  v_end_longitude_delta := pg_catalog.radians(p_segment_end_longitude - p_segment_start_longitude);
  v_point_longitude_delta := pg_catalog.radians(p_point_longitude - p_segment_start_longitude);

  v_bearing_to_end := pg_catalog.atan2(
    pg_catalog.sin(v_end_longitude_delta) * pg_catalog.cos(v_end_latitude_radians),
    pg_catalog.cos(v_start_latitude_radians) * pg_catalog.sin(v_end_latitude_radians)
      - pg_catalog.sin(v_start_latitude_radians)
        * pg_catalog.cos(v_end_latitude_radians)
        * pg_catalog.cos(v_end_longitude_delta)
  );
  v_bearing_to_point := pg_catalog.atan2(
    pg_catalog.sin(v_point_longitude_delta) * pg_catalog.cos(v_point_latitude_radians),
    pg_catalog.cos(v_start_latitude_radians) * pg_catalog.sin(v_point_latitude_radians)
      - pg_catalog.sin(v_start_latitude_radians)
        * pg_catalog.cos(v_point_latitude_radians)
        * pg_catalog.cos(v_point_longitude_delta)
  );
  v_bearing_delta := v_bearing_to_point - v_bearing_to_end;
  v_cross_track_sine := pg_catalog.sin(v_start_to_point_angle) * pg_catalog.sin(v_bearing_delta);
  v_cross_track_sine := least(1.0, greatest(-1.0, v_cross_track_sine));
  v_cross_track_angle := pg_catalog.asin(v_cross_track_sine);
  v_along_track_angle := pg_catalog.atan2(
    pg_catalog.sin(v_start_to_point_angle) * pg_catalog.cos(v_bearing_delta),
    pg_catalog.cos(v_start_to_point_angle)
  );

  if v_along_track_angle >= 0.0 and v_along_track_angle <= v_segment_angle then
    return pg_catalog.abs(v_cross_track_angle) * v_earth_radius_m;
  end if;

  return least(
    public.public_track_distance_m(
      p_point_latitude,
      p_point_longitude,
      p_segment_start_latitude,
      p_segment_start_longitude
    ),
    public.public_track_distance_m(
      p_point_latitude,
      p_point_longitude,
      p_segment_end_latitude,
      p_segment_end_longitude
    )
  );
end;
$$;

create or replace function public.sanitize_public_ride_track(p_track jsonb)
returns jsonb
language plpgsql
immutable
parallel safe
set search_path = pg_catalog
as $$
declare
  v_privacy_radius_m constant double precision := 200.0;
  v_max_source_points constant integer := 20000;
  v_target_points constant integer := 500;
  v_max_safe_chord_m constant double precision := 100000.0;
  v_track_count integer;
  v_point jsonb;
  v_point_index integer := 0;
  v_latitudes double precision[] := array[]::double precision[];
  v_longitudes double precision[] := array[]::double precision[];
  v_start_latitude double precision;
  v_start_longitude double precision;
  v_finish_latitude double precision;
  v_finish_longitude double precision;
  v_point_is_safe boolean;
  v_segment_is_safe boolean;
  v_segment_distance_m double precision;
  v_current_start integer := 0;
  v_current_distance_m double precision := 0.0;
  v_best_start integer := 0;
  v_best_end integer := 0;
  v_best_distance_m double precision := -1.0;
  v_best_count integer;
  v_full_fragment jsonb;
  v_sample_indices integer[] := array[]::integer[];
  v_sample_position integer;
  v_sample_index integer;
  v_previous_sample_index integer := 0;
  v_sampled_fragment jsonb;
begin
  if p_track is null or pg_catalog.jsonb_typeof(p_track) is distinct from 'array' then
    return null;
  end if;

  v_track_count := pg_catalog.jsonb_array_length(p_track);
  if v_track_count < 2 or v_track_count > v_max_source_points then
    return null;
  end if;

  for v_point in
    select value from pg_catalog.jsonb_array_elements(p_track)
  loop
    if not coalesce(public.is_valid_geo_point(v_point), false) then
      return null;
    end if;
    v_point_index := v_point_index + 1;
    v_latitudes := pg_catalog.array_append(v_latitudes, (v_point ->> 'lat')::double precision);
    v_longitudes := pg_catalog.array_append(v_longitudes, (v_point ->> 'lng')::double precision);
  end loop;

  v_start_latitude := v_latitudes[1];
  v_start_longitude := v_longitudes[1];
  v_finish_latitude := v_latitudes[v_track_count];
  v_finish_longitude := v_longitudes[v_track_count];

  for v_point_index in 1..v_track_count loop
    v_point_is_safe := public.public_track_distance_m(
      v_start_latitude,
      v_start_longitude,
      v_latitudes[v_point_index],
      v_longitudes[v_point_index]
    ) >= v_privacy_radius_m
      and public.public_track_distance_m(
        v_finish_latitude,
        v_finish_longitude,
        v_latitudes[v_point_index],
        v_longitudes[v_point_index]
      ) >= v_privacy_radius_m;

    if not v_point_is_safe then
      if v_current_start > 0
        and v_point_index - v_current_start >= 2
        and v_current_distance_m > v_best_distance_m
      then
        v_best_start := v_current_start;
        v_best_end := v_point_index - 1;
        v_best_distance_m := v_current_distance_m;
      end if;
      v_current_start := 0;
      v_current_distance_m := 0.0;
      continue;
    end if;

    if v_current_start = 0 then
      v_current_start := v_point_index;
      v_current_distance_m := 0.0;
      continue;
    end if;

    v_segment_distance_m := public.public_track_distance_m(
      v_latitudes[v_point_index - 1],
      v_longitudes[v_point_index - 1],
      v_latitudes[v_point_index],
      v_longitudes[v_point_index]
    );
    v_segment_is_safe := v_segment_distance_m <= v_max_safe_chord_m
      and public.public_track_point_to_segment_distance_m(
        v_start_latitude,
        v_start_longitude,
        v_latitudes[v_point_index - 1],
        v_longitudes[v_point_index - 1],
        v_latitudes[v_point_index],
        v_longitudes[v_point_index]
      ) >= v_privacy_radius_m
      and public.public_track_point_to_segment_distance_m(
        v_finish_latitude,
        v_finish_longitude,
        v_latitudes[v_point_index - 1],
        v_longitudes[v_point_index - 1],
        v_latitudes[v_point_index],
        v_longitudes[v_point_index]
      ) >= v_privacy_radius_m;

    if not v_segment_is_safe then
      if v_point_index - v_current_start >= 2
        and v_current_distance_m > v_best_distance_m
      then
        v_best_start := v_current_start;
        v_best_end := v_point_index - 1;
        v_best_distance_m := v_current_distance_m;
      end if;
      v_current_start := v_point_index;
      v_current_distance_m := 0.0;
      continue;
    end if;

    v_current_distance_m := v_current_distance_m + v_segment_distance_m;
  end loop;

  if v_current_start > 0
    and v_track_count - v_current_start + 1 >= 2
    and v_current_distance_m > v_best_distance_m
  then
    v_best_start := v_current_start;
    v_best_end := v_track_count;
    v_best_distance_m := v_current_distance_m;
  end if;

  if v_best_start = 0 or v_best_end - v_best_start + 1 < 2 or v_best_distance_m <= 0.0 then
    return null;
  end if;

  select pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object('lat', v_latitudes[safe_point_index], 'lng', v_longitudes[safe_point_index])
    order by safe_point_index
  )
  into v_full_fragment
  from pg_catalog.generate_series(v_best_start, v_best_end) as safe_points(safe_point_index);

  v_best_count := v_best_end - v_best_start + 1;
  if v_best_count <= v_target_points then
    return v_full_fragment;
  end if;

  for v_sample_position in 0..(v_target_points - 1) loop
    v_sample_index := v_best_start + pg_catalog.floor(
      (v_sample_position::double precision * (v_best_count - 1)::double precision / (v_target_points - 1)::double precision) + 0.5
    )::integer;
    v_sample_indices := pg_catalog.array_append(v_sample_indices, v_sample_index);

    if v_previous_sample_index > 0 then
      v_segment_distance_m := public.public_track_distance_m(
        v_latitudes[v_previous_sample_index],
        v_longitudes[v_previous_sample_index],
        v_latitudes[v_sample_index],
        v_longitudes[v_sample_index]
      );
      if v_segment_distance_m > v_max_safe_chord_m
        or public.public_track_point_to_segment_distance_m(
          v_start_latitude,
          v_start_longitude,
          v_latitudes[v_previous_sample_index],
          v_longitudes[v_previous_sample_index],
          v_latitudes[v_sample_index],
          v_longitudes[v_sample_index]
        ) < v_privacy_radius_m
        or public.public_track_point_to_segment_distance_m(
          v_finish_latitude,
          v_finish_longitude,
          v_latitudes[v_previous_sample_index],
          v_longitudes[v_previous_sample_index],
          v_latitudes[v_sample_index],
          v_longitudes[v_sample_index]
        ) < v_privacy_radius_m
      then
        return v_full_fragment;
      end if;
    end if;
    v_previous_sample_index := v_sample_index;
  end loop;

  select pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object('lat', v_latitudes[sampled_point_index], 'lng', v_longitudes[sampled_point_index])
    order by sample_order
  )
  into v_sampled_fragment
  from pg_catalog.unnest(v_sample_indices) with ordinality as sampled_points(sampled_point_index, sample_order);

  return v_sampled_fragment;
exception
  when others then
    -- Malformed or computationally unsafe input must never be published verbatim.
    return null;
end;
$$;

-- Transactional sanitizer assertions. Any regression aborts the migration.
do $$
declare
  v_short_track jsonb := pg_catalog.jsonb_build_array(
    pg_catalog.jsonb_build_object('lat', 0, 'lng', 0),
    pg_catalog.jsonb_build_object('lat', 0, 'lng', 0.001)
  );
  v_long_track jsonb;
  v_sanitized jsonb;
  v_start jsonb;
  v_finish jsonb;
begin
  if public.sanitize_public_ride_track(v_short_track) is not null then
    raise exception 'sanitize_public_ride_track assertion failed: short track must be null';
  end if;

  if public.sanitize_public_ride_track('{"not":"an array"}'::jsonb) is not null
    or public.sanitize_public_ride_track('[{"lat":91,"lng":0},{"lat":0,"lng":0}]'::jsonb) is not null
  then
    raise exception 'sanitize_public_ride_track assertion failed: invalid JSON must be null';
  end if;

  select pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object('lat', 0, 'lng', test_index::numeric / 100000)
    order by test_index
  )
  into v_long_track
  from pg_catalog.generate_series(0, 1000) as test_points(test_index);

  v_start := v_long_track -> 0;
  v_finish := v_long_track -> (pg_catalog.jsonb_array_length(v_long_track) - 1);
  v_sanitized := public.sanitize_public_ride_track(v_long_track);

  if v_sanitized is null or pg_catalog.jsonb_array_length(v_sanitized) < 2 then
    raise exception 'sanitize_public_ride_track assertion failed: safe middle fragment is missing';
  end if;
  if pg_catalog.jsonb_array_length(v_sanitized) > 500 then
    raise exception 'sanitize_public_ride_track assertion failed: safe downsample exceeds 500 points';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(v_sanitized) as returned_points(point)
    where public.public_track_distance_m(
      (v_start ->> 'lat')::double precision,
      (v_start ->> 'lng')::double precision,
      (point ->> 'lat')::double precision,
      (point ->> 'lng')::double precision
    ) < 200.0
      or public.public_track_distance_m(
        (v_finish ->> 'lat')::double precision,
        (v_finish ->> 'lng')::double precision,
        (point ->> 'lat')::double precision,
        (point ->> 'lng')::double precision
      ) < 200.0
  ) then
    raise exception 'sanitize_public_ride_track assertion failed: private endpoint point leaked';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(v_sanitized) with ordinality as segment_starts(point, point_order)
    join pg_catalog.jsonb_array_elements(v_sanitized) with ordinality as segment_ends(point, point_order)
      on segment_ends.point_order = segment_starts.point_order + 1
    where public.public_track_point_to_segment_distance_m(
      (v_start ->> 'lat')::double precision,
      (v_start ->> 'lng')::double precision,
      (segment_starts.point ->> 'lat')::double precision,
      (segment_starts.point ->> 'lng')::double precision,
      (segment_ends.point ->> 'lat')::double precision,
      (segment_ends.point ->> 'lng')::double precision
    ) < 200.0
      or public.public_track_point_to_segment_distance_m(
        (v_finish ->> 'lat')::double precision,
        (v_finish ->> 'lng')::double precision,
        (segment_starts.point ->> 'lat')::double precision,
        (segment_starts.point ->> 'lng')::double precision,
        (segment_ends.point ->> 'lat')::double precision,
        (segment_ends.point ->> 'lng')::double precision
      ) < 200.0
  ) then
    raise exception 'sanitize_public_ride_track assertion failed: private endpoint segment leaked';
  end if;
end;
$$;

-- Existing ride snapshots are sanitized once. Legacy summary polylines are never exposed again;
-- summary-only posts intentionally lose the map while retaining their stats and media.
update public.posts
set ride_track = public.sanitize_public_ride_track(ride_track),
    strava_summary_polyline = null
where ride_track is not null
   or strava_summary_polyline is not null;

create or replace function public.create_public_post(
  p_caption text,
  p_media_url text,
  p_media_type text,
  p_ride_activity_id uuid,
  p_distance_km numeric,
  p_elevation_gain_m numeric,
  p_duration_seconds integer,
  p_ride_track jsonb,
  p_route_id uuid,
  p_route_title text,
  p_route_description text,
  p_route_path jsonb,
  p_route_distance_km numeric,
  p_route_elevation_gain_m numeric,
  p_route_difficulty text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_caller_id uuid := auth.uid();
  v_caption text := pg_catalog.btrim(coalesce(p_caption, ''));
  v_media_url text := nullif(pg_catalog.btrim(p_media_url), '');
  v_route_title text := case when p_route_title is null then null else pg_catalog.btrim(p_route_title) end;
  v_route_description text := case
    when p_route_description is null then null
    else nullif(pg_catalog.btrim(p_route_description), '')
  end;
  v_has_ride boolean;
  v_has_route boolean;
  v_safe_ride_track jsonb;
  v_post_id uuid;
begin
  if v_caller_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;

  if pg_catalog.char_length(v_caption) > 2200 then
    raise exception using errcode = '22023', message = 'Caption is too long.';
  end if;

  if (v_media_url is null) <> (p_media_type is null) then
    raise exception using errcode = '22023', message = 'Media URL and type must be provided together.';
  end if;
  if v_media_url is not null then
    if p_media_type not in ('image', 'video')
      or pg_catalog.char_length(v_media_url) > 4096
      or v_media_url !~* '^https?://'
    then
      raise exception using errcode = '22023', message = 'Media payload is invalid.';
    end if;
  end if;

  v_has_ride := p_ride_activity_id is not null
    or p_distance_km is not null
    or p_elevation_gain_m is not null
    or p_duration_seconds is not null
    or p_ride_track is not null;
  if v_has_ride then
    if p_distance_km is null or p_elevation_gain_m is null or p_duration_seconds is null then
      raise exception using errcode = '22023', message = 'Ride statistics are incomplete.';
    end if;
    if p_distance_km::text in ('NaN', 'Infinity', '-Infinity')
      or p_distance_km < 0
      or p_distance_km > 2000
      or p_elevation_gain_m::text in ('NaN', 'Infinity', '-Infinity')
      or p_elevation_gain_m < 0
      or p_elevation_gain_m > 100000
      or p_duration_seconds <= 0
      or p_duration_seconds > 31536000
    then
      raise exception using errcode = '22023', message = 'Ride statistics are invalid.';
    end if;
  end if;

  if p_ride_activity_id is not null and not exists (
    select 1
    from public.ride_activities
    where id = p_ride_activity_id
      and user_id = v_caller_id
  ) then
    raise exception using errcode = '42501', message = 'Ride activity does not belong to the current rider.';
  end if;
  v_safe_ride_track := public.sanitize_public_ride_track(p_ride_track);

  v_has_route := p_route_id is not null
    or p_route_title is not null
    or p_route_description is not null
    or p_route_path is not null
    or p_route_distance_km is not null
    or p_route_elevation_gain_m is not null
    or p_route_difficulty is not null;
  if v_has_route then
    if v_route_title is null
      or pg_catalog.char_length(v_route_title) not between 1 and 120
      or p_route_path is null
      or pg_catalog.jsonb_typeof(p_route_path) is distinct from 'array'
      or pg_catalog.jsonb_array_length(p_route_path) not between 2 and 20000
      or p_route_distance_km is null
      or p_route_elevation_gain_m is null
      or p_route_difficulty is null
      or p_route_difficulty not in ('easy', 'moderate', 'hard')
    then
      raise exception using errcode = '22023', message = 'Route preview is incomplete.';
    end if;
    if pg_catalog.char_length(coalesce(v_route_description, '')) > 1000
      or p_route_distance_km::text in ('NaN', 'Infinity', '-Infinity')
      or p_route_distance_km < 0
      or p_route_distance_km > 100000
      or p_route_elevation_gain_m::text in ('NaN', 'Infinity', '-Infinity')
      or p_route_elevation_gain_m < 0
      or p_route_elevation_gain_m > 100000
      or exists (
        select 1
        from pg_catalog.jsonb_array_elements(p_route_path) as route_points(point)
        where not coalesce(public.is_valid_geo_point(point), false)
      )
    then
      raise exception using errcode = '22023', message = 'Route preview is invalid.';
    end if;
    if p_route_id is not null and not exists (
      select 1 from public.routes where id = p_route_id
    ) then
      raise exception using errcode = '23503', message = 'Route not found.';
    end if;
  end if;

  if v_caption = '' and v_media_url is null and not v_has_ride and not v_has_route then
    raise exception using errcode = '22023', message = 'Post content is required.';
  end if;

  insert into public.posts (
    user_id,
    media_url,
    media_type,
    caption,
    ride_activity_id,
    strava_distance_km,
    strava_elevation_gain_m,
    strava_duration_seconds,
    strava_summary_polyline,
    ride_track,
    route_id,
    route_title,
    route_description,
    route_path,
    route_distance_km,
    route_elevation_gain_m,
    route_difficulty
  )
  values (
    v_caller_id,
    v_media_url,
    p_media_type,
    v_caption,
    p_ride_activity_id,
    p_distance_km,
    p_elevation_gain_m,
    p_duration_seconds,
    null,
    v_safe_ride_track,
    p_route_id,
    v_route_title,
    v_route_description,
    p_route_path,
    p_route_distance_km,
    p_route_elevation_gain_m,
    p_route_difficulty
  )
  returning id into v_post_id;

  return v_post_id;
end;
$$;

-- Table writes are denied even if a client ignores the UI. The definer RPC above forces
-- auth.uid(), validates every field, and is the sole authenticated creation path.
revoke insert, update on public.posts from PUBLIC, anon, authenticated;
drop policy if exists "riders create their own posts" on public.posts;
drop policy if exists "riders update their own posts" on public.posts;
grant select, delete on public.posts to authenticated;

revoke all on function public.is_valid_geo_point(jsonb) from PUBLIC, anon, authenticated;
revoke all on function public.public_track_distance_m(double precision, double precision, double precision, double precision) from PUBLIC, anon, authenticated;
revoke all on function public.public_track_point_to_segment_distance_m(double precision, double precision, double precision, double precision, double precision, double precision) from PUBLIC, anon, authenticated;
revoke all on function public.sanitize_public_ride_track(jsonb) from PUBLIC, anon, authenticated;
revoke all on function public.create_public_post(text, text, text, uuid, numeric, numeric, integer, jsonb, uuid, text, text, jsonb, numeric, numeric, text) from PUBLIC, anon, authenticated;
grant execute on function public.create_public_post(text, text, text, uuid, numeric, numeric, integer, jsonb, uuid, text, text, jsonb, numeric, numeric, text) to authenticated;

do $$
begin
  if pg_catalog.has_table_privilege('authenticated', 'public.posts', 'INSERT')
    or pg_catalog.has_table_privilege('authenticated', 'public.posts', 'UPDATE')
  then
    raise exception 'posts privilege assertion failed: authenticated still has a direct write path';
  end if;
  if not pg_catalog.has_table_privilege('authenticated', 'public.posts', 'DELETE') then
    raise exception 'posts privilege assertion failed: authenticated delete was lost';
  end if;
  if pg_catalog.has_function_privilege(
    'authenticated',
    'public.sanitize_public_ride_track(jsonb)',
    'EXECUTE'
  ) then
    raise exception 'posts privilege assertion failed: sanitizer must not be directly callable';
  end if;
  if not pg_catalog.has_function_privilege(
    'authenticated',
    'public.create_public_post(text,text,text,uuid,numeric,numeric,integer,jsonb,uuid,text,text,jsonb,numeric,numeric,text)',
    'EXECUTE'
  ) then
    raise exception 'posts privilege assertion failed: create RPC is unavailable';
  end if;
end;
$$;
