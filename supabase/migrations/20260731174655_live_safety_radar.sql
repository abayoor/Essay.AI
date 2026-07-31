-- Live Safety Radar: trustworthy, expiring hazard reports with one confirmation per rider.
-- Existing reports remain readable; only newly written locations must pass the stricter checks.

create or replace function public.hazard_lifetime(hazard_kind text)
returns interval
language sql
immutable
strict
set search_path = pg_catalog, public
as $$
  select case hazard_kind
    when 'glass' then interval '3 days'
    when 'road_closed' then interval '2 days'
    when 'aggressive_dogs' then interval '7 days'
    when 'pothole' then interval '30 days'
    when 'no_lighting' then interval '30 days'
    else interval '7 days'
  end;
$$;

revoke all on function public.hazard_lifetime(text) from public;

alter table public.hazard_reports
  add column expires_at timestamptz,
  add column last_confirmed_at timestamptz,
  -- NULL marks a legacy row. New RPC-created rows use version 1 and must pass strict checks.
  add column safety_schema_version smallint,
  add column latitude double precision generated always as (
    case
      when jsonb_typeof(location -> 'lat') = 'number'
      then case
        when (location ->> 'lat')::numeric between -90 and 90
        then (location ->> 'lat')::double precision
        else null
      end
      else null
    end
  ) stored,
  add column longitude double precision generated always as (
    case
      when jsonb_typeof(location -> 'lng') = 'number'
      then case
        when (location ->> 'lng')::numeric between -180 and 180
        then (location ->> 'lng')::double precision
        else null
      end
      else null
    end
  ) stored;

update public.hazard_reports
set last_confirmed_at = created_at,
    expires_at = created_at + public.hazard_lifetime(hazard_type)
where last_confirmed_at is null or expires_at is null;

alter table public.hazard_reports
  alter column expires_at set default (now() + interval '7 days'),
  alter column expires_at set not null,
  alter column last_confirmed_at set default now(),
  alter column last_confirmed_at set not null,
  alter column safety_schema_version set default 1;

-- Legacy counters had no per-rider source of truth, so start the trusted count at zero.
-- This happens before strict checks are installed so malformed legacy rows cannot block deployment.
update public.hazard_reports set upvotes = 0 where upvotes <> 0;

alter table public.hazard_reports
  add constraint hazard_reports_valid_coordinates
    check (
      safety_schema_version is null
      or (safety_schema_version = 1 and latitude is not null and longitude is not null)
    ) not valid,
  add constraint hazard_reports_description_length
    check (
      safety_schema_version is null
      or (description is null or char_length(btrim(description)) between 1 and 280)
    ) not valid;

create index hazard_reports_active_location_idx
  on public.hazard_reports (latitude, longitude)
  where status = 'active';

create index hazard_reports_active_expiry_idx
  on public.hazard_reports (expires_at, last_confirmed_at desc)
  where status = 'active';

create index hazard_reports_reporter_created_idx
  on public.hazard_reports (reporter_id, created_at desc);

create table public.hazard_confirmations (
  hazard_id uuid not null references public.hazard_reports (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint hazard_confirmations_pkey primary key (hazard_id, user_id)
);

create index hazard_confirmations_user_idx
  on public.hazard_confirmations (user_id, created_at desc);

alter table public.hazard_confirmations enable row level security;

create policy "riders read own hazard confirmations"
  on public.hazard_confirmations for select
  using (auth.uid() = user_id);

create policy "riders confirm active hazards"
  on public.hazard_confirmations for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.hazard_reports
      where hazard_reports.id = hazard_confirmations.hazard_id
        and hazard_reports.reporter_id <> auth.uid()
        and hazard_reports.status = 'active'
        and hazard_reports.expires_at > now()
    )
  );

create policy "riders remove own hazard confirmations"
  on public.hazard_confirmations for delete
  using (auth.uid() = user_id);

revoke all on public.hazard_confirmations from anon, authenticated;
grant select on public.hazard_confirmations to authenticated;

-- Confirmation totals are derived from unique rows. Clients never write the counter directly.
create or replace function public.sync_hazard_confirmation_count()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  target_hazard_id uuid := case when tg_op = 'DELETE' then old.hazard_id else new.hazard_id end;
begin
  update public.hazard_reports as report
  set upvotes = case
        when tg_op = 'INSERT' then report.upvotes + 1
        else greatest(report.upvotes - 1, 0)
      end,
      last_confirmed_at = case
        when tg_op = 'INSERT' then statement_timestamp()
        else report.last_confirmed_at
      end,
      expires_at = case
        when tg_op = 'INSERT' then greatest(
          report.expires_at,
          statement_timestamp() + public.hazard_lifetime(report.hazard_type)
        )
        else report.expires_at
      end
  where report.id = target_hazard_id;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.sync_hazard_confirmation_count() from public;

create trigger sync_hazard_confirmation_count_after_change
  after insert or delete on public.hazard_confirmations
  for each row execute procedure public.sync_hazard_confirmation_count();

-- Creation goes through one guarded RPC: it validates input, rate-limits spam and merges duplicates.
create or replace function public.report_hazard(
  p_lat double precision,
  p_lng double precision,
  p_hazard_type text,
  p_description text default null
)
returns table (hazard_id uuid, merged boolean)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  clean_description text := nullif(btrim(p_description), '');
  duplicate_id uuid;
  duplicate_reporter_id uuid;
  new_hazard_id uuid;
  reports_last_hour integer;
  latitude_window double precision := 30.0 / 111320.0;
  longitude_window double precision;
begin
  if caller_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if p_lat is null or p_lng is null
    or p_lat::text in ('NaN', 'Infinity', '-Infinity')
    or p_lng::text in ('NaN', 'Infinity', '-Infinity')
    or p_lat < -90 or p_lat > 90
    or p_lng < -180 or p_lng > 180 then
    raise exception 'Coordinates are outside the valid range.' using errcode = '22023';
  end if;

  if p_hazard_type is null or p_hazard_type not in (
    'pothole', 'no_lighting', 'glass', 'aggressive_dogs', 'road_closed'
  ) then
    raise exception 'Unsupported hazard type.' using errcode = '22023';
  end if;

  if clean_description is not null and char_length(clean_description) > 280 then
    raise exception 'Description must be 280 characters or fewer.' using errcode = '22023';
  end if;

  -- Rate-limit checks must be serialized per rider; otherwise parallel requests could all pass.
  perform pg_advisory_xact_lock(hashtextextended('hazard-reporter:' || caller_id::text, 0));

  -- Serialize reports in the same small map cell to reduce duplicate markers from simultaneous taps.
  perform pg_advisory_xact_lock(hashtextextended(
    p_hazard_type || ':' || round(p_lat::numeric, 3)::text || ':' || round(p_lng::numeric, 3)::text,
    0
  ));

  longitude_window := 30.0 / greatest(111320.0 * abs(cos(radians(p_lat))), 1000.0);

  select report.id, report.reporter_id
  into duplicate_id, duplicate_reporter_id
  from public.hazard_reports as report
  where report.status = 'active'
    and report.expires_at > statement_timestamp()
    and report.hazard_type = p_hazard_type
    and report.latitude between p_lat - latitude_window and p_lat + latitude_window
    and report.longitude between p_lng - longitude_window and p_lng + longitude_window
    and 111320.0 * sqrt(
      power(report.latitude - p_lat, 2)
      + power(
          (report.longitude - p_lng)
          * cos(radians((report.latitude + p_lat) / 2.0)),
          2
        )
    ) <= 30.0
  order by report.upvotes desc, report.last_confirmed_at desc
  limit 1
  for update;

  if duplicate_id is not null then
    if duplicate_reporter_id <> caller_id then
      insert into public.hazard_confirmations (hazard_id, user_id)
      values (duplicate_id, caller_id)
      on conflict on constraint hazard_confirmations_pkey do nothing;
    end if;

    return query select duplicate_id, true;
    return;
  end if;

  select count(*)::integer
  into reports_last_hour
  from public.hazard_reports
  where reporter_id = caller_id
    and created_at > statement_timestamp() - interval '1 hour';

  if reports_last_hour >= 5 then
    raise exception 'Hazard report limit reached. Try again later.' using errcode = 'P0001';
  end if;

  insert into public.hazard_reports (
    reporter_id,
    location,
    hazard_type,
    description,
    status,
    upvotes,
    created_at,
    last_confirmed_at,
    expires_at,
    safety_schema_version
  ) values (
    caller_id,
    jsonb_build_object('lat', p_lat, 'lng', p_lng),
    p_hazard_type,
    clean_description,
    'active',
    0,
    statement_timestamp(),
    statement_timestamp(),
    statement_timestamp() + public.hazard_lifetime(p_hazard_type),
    1
  )
  returning id into new_hazard_id;

  return query select new_hazard_id, false;
end;
$$;

create or replace function public.confirm_hazard(p_hazard_id uuid)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  report public.hazard_reports%rowtype;
  confirmation_count integer;
begin
  if caller_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select * into report
  from public.hazard_reports
  where id = p_hazard_id
  for update;

  if not found then
    raise exception 'Hazard report was not found.' using errcode = 'P0002';
  end if;

  if report.reporter_id = caller_id then
    raise exception 'A reporter cannot confirm their own report.' using errcode = '42501';
  end if;

  if report.status <> 'active' or report.expires_at <= statement_timestamp() then
    raise exception 'This hazard report is no longer active.' using errcode = 'P0001';
  end if;

  insert into public.hazard_confirmations (hazard_id, user_id)
  values (p_hazard_id, caller_id)
  on conflict on constraint hazard_confirmations_pkey do nothing;

  select upvotes into confirmation_count
  from public.hazard_reports
  where id = p_hazard_id;

  return confirmation_count;
end;
$$;

create or replace function public.unconfirm_hazard(p_hazard_id uuid)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  confirmation_count integer;
begin
  if caller_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  delete from public.hazard_confirmations
  where hazard_id = p_hazard_id and user_id = caller_id;

  select upvotes into confirmation_count
  from public.hazard_reports
  where id = p_hazard_id;

  if confirmation_count is null then
    raise exception 'Hazard report was not found.' using errcode = 'P0002';
  end if;

  return confirmation_count;
end;
$$;

create or replace function public.resolve_hazard(p_hazard_id uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  update public.hazard_reports
  set status = 'resolved'
  where id = p_hazard_id and reporter_id = caller_id;

  if not found then
    raise exception 'Hazard report was not found or is not yours.' using errcode = '42501';
  end if;

  return true;
end;
$$;

-- Direct writes could bypass rate limits or forge confirmation totals. Reads remain RLS-protected.
revoke insert, update on public.hazard_reports from authenticated;
grant select, delete on public.hazard_reports to authenticated;

revoke all on function public.report_hazard(double precision, double precision, text, text) from public;
revoke all on function public.confirm_hazard(uuid) from public;
revoke all on function public.unconfirm_hazard(uuid) from public;
revoke all on function public.resolve_hazard(uuid) from public;

grant execute on function public.report_hazard(double precision, double precision, text, text) to authenticated;
grant execute on function public.confirm_hazard(uuid) to authenticated;
grant execute on function public.unconfirm_hazard(uuid) to authenticated;
grant execute on function public.resolve_hazard(uuid) to authenticated;

-- Realtime emits only hazard rows. Confirmation changes update the trusted counter through the trigger.
do $$
begin
  if exists (
    select 1 from pg_catalog.pg_publication where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'hazard_reports'
  ) then
    execute 'alter publication supabase_realtime add table public.hazard_reports';
  end if;
end;
$$;
