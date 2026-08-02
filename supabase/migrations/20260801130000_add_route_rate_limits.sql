-- Protect the paid routing provider with an atomic per-rider allowance.
-- Anonymous riders continue to use the public BRouter fallback in the client.
create table public.route_api_rate_limits (
  user_id uuid primary key references public.users (id) on delete cascade,
  minute_started_at timestamptz not null default now(),
  minute_request_count integer not null default 0 check (minute_request_count >= 0),
  day_started_at date not null default current_date,
  day_request_count integer not null default 0 check (day_request_count >= 0),
  updated_at timestamptz not null default now()
);

alter table public.route_api_rate_limits enable row level security;
revoke all on public.route_api_rate_limits from anon, authenticated;

create policy "riders read own route rate limit"
  on public.route_api_rate_limits
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.consume_route_request()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_minute_started_at timestamptz;
  current_minute_count integer;
  current_day_started_at date;
  current_day_count integer;
  minute_limit constant integer := 24;
  daily_limit constant integer := 300;
begin
  if current_user_id is null then
    raise exception 'Authentication is required';
  end if;

  insert into public.route_api_rate_limits (user_id)
  values (current_user_id)
  on conflict (user_id) do nothing;

  select minute_started_at, minute_request_count, day_started_at, day_request_count
  into current_minute_started_at, current_minute_count, current_day_started_at, current_day_count
  from public.route_api_rate_limits
  where user_id = current_user_id
  for update;

  if current_day_started_at < current_date then
    current_day_started_at := current_date;
    current_day_count := 0;
  end if;

  if current_minute_started_at < now() - interval '1 minute' then
    current_minute_started_at := now();
    current_minute_count := 0;
  end if;

  if current_day_count >= daily_limit then
    return jsonb_build_object('allowed', false, 'reason', 'daily_limit');
  end if;

  if current_minute_count >= minute_limit then
    return jsonb_build_object('allowed', false, 'reason', 'minute_limit');
  end if;

  update public.route_api_rate_limits
  set minute_started_at = current_minute_started_at,
      minute_request_count = current_minute_count + 1,
      day_started_at = current_day_started_at,
      day_request_count = current_day_count + 1,
      updated_at = now()
  where user_id = current_user_id;

  return jsonb_build_object(
    'allowed', true,
    'minute_remaining', minute_limit - current_minute_count - 1,
    'daily_remaining', daily_limit - current_day_count - 1
  );
end;
$$;

revoke all on function public.consume_route_request() from public;
grant execute on function public.consume_route_request() to authenticated;
