-- Slipstream Pro billing state is server-authoritative. The browser may read
-- only its own subscription; verified billing endpoints and webhooks own writes.
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users (id) on delete cascade,
  plan_key text not null default 'pro_monthly' check (plan_key = 'pro_monthly'),
  status text not null check (status in (
    'incomplete',
    'incomplete_expired',
    'trialing',
    'active',
    'past_due',
    'canceled',
    'unpaid',
    'paused'
  )),
  billing_provider text not null check (billing_provider in ('lemon_squeezy', 'stripe', 'google_play', 'app_store')),
  provider_customer_id text,
  provider_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index subscriptions_provider_customer_key
  on public.subscriptions (billing_provider, provider_customer_id)
  where provider_customer_id is not null;

create unique index subscriptions_provider_subscription_key
  on public.subscriptions (billing_provider, provider_subscription_id)
  where provider_subscription_id is not null;

comment on table public.subscriptions is 'Server-authoritative current billing subscription for each rider.';
comment on column public.subscriptions.plan_key is 'Stable public plan key; the backend maps it to a private provider price or variant ID.';

-- Optional body and goal data for Pro personalization. No medical diagnoses or
-- payment details belong in this table, and AI use requires explicit consent.
create table public.pro_rider_profiles (
  user_id uuid primary key default auth.uid() references public.users (id) on delete cascade,
  height_cm numeric(5,2) check (height_cm between 100 and 250),
  weight_kg numeric(5,2) check (weight_kg between 25 and 300),
  inseam_cm numeric(5,2) check (inseam_cm between 40 and 125),
  experience_level text check (experience_level in ('beginner', 'recreational', 'trained', 'competitive')),
  training_goal text check (training_goal in ('comfort', 'consistency', 'endurance', 'speed', 'distance', 'weight_management')),
  weekly_training_minutes integer check (weekly_training_minutes between 0 and 2400),
  preferred_bike_types text[] not null default '{}'::text[] check (cardinality(preferred_bike_types) <= 8),
  nutrition_preferences text[] not null default '{}'::text[] check (cardinality(nutrition_preferences) <= 12),
  consent_to_ai_analysis boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.pro_rider_profiles is 'Rider-provided data used for Pro recommendations only after explicit consent.';

create or replace function public.touch_pro_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger touch_subscriptions_updated_at
  before update on public.subscriptions
  for each row execute procedure public.touch_pro_updated_at();

create trigger touch_pro_rider_profiles_updated_at
  before update on public.pro_rider_profiles
  for each row execute procedure public.touch_pro_updated_at();

alter table public.subscriptions enable row level security;
alter table public.pro_rider_profiles enable row level security;

revoke all on public.subscriptions from anon, authenticated;
revoke all on public.pro_rider_profiles from anon, authenticated;

-- Customer and subscription identifiers stay unavailable to browser clients.
grant select (
  id,
  user_id,
  plan_key,
  status,
  current_period_start,
  current_period_end,
  cancel_at_period_end,
  created_at,
  updated_at
) on public.subscriptions to authenticated;

grant select, insert, update, delete on public.pro_rider_profiles to authenticated;

create policy "riders read own subscription"
  on public.subscriptions
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "riders read own pro profile"
  on public.pro_rider_profiles
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "riders create own pro profile"
  on public.pro_rider_profiles
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "riders update own pro profile"
  on public.pro_rider_profiles
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "riders delete own pro profile"
  on public.pro_rider_profiles
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- One resumable checkout per rider prevents double purchases from repeated taps
-- or two open tabs. The URL and capability token are never browser-readable.
create table public.billing_checkout_locks (
  user_id uuid primary key references public.users (id) on delete cascade,
  lock_token uuid not null default gen_random_uuid(),
  checkout_url text,
  expires_at timestamptz not null default (now() + interval '31 minutes'),
  created_at timestamptz not null default now()
);

alter table public.billing_checkout_locks enable row level security;
revoke all on public.billing_checkout_locks from anon, authenticated;

create policy "riders address own checkout lock"
  on public.billing_checkout_locks
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.reserve_pro_checkout()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  existing_url text;
  new_token uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication is required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('pro-checkout:' || current_user_id::text, 0));
  delete from public.billing_checkout_locks
  where user_id = current_user_id and expires_at <= now();

  select checkout_url into existing_url
  from public.billing_checkout_locks
  where user_id = current_user_id;

  if found then
    return jsonb_build_object('acquired', false, 'checkout_url', existing_url);
  end if;

  insert into public.billing_checkout_locks (user_id)
  values (current_user_id)
  returning lock_token into new_token;

  return jsonb_build_object('acquired', true, 'lock_token', new_token);
end;
$$;

create or replace function public.finish_pro_checkout_lock(
  provided_token uuid,
  next_checkout_url text,
  succeeded boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Authentication is required';
  end if;

  if succeeded then
    if next_checkout_url is null or next_checkout_url !~ '^https://' then
      raise exception 'A secure checkout URL is required';
    end if;
    update public.billing_checkout_locks
    set checkout_url = next_checkout_url
    where user_id = current_user_id and lock_token = provided_token;
  else
    delete from public.billing_checkout_locks
    where user_id = current_user_id and lock_token = provided_token;
  end if;
end;
$$;

revoke all on function public.reserve_pro_checkout() from public;
revoke all on function public.finish_pro_checkout_lock(uuid, text, boolean) from public;
grant execute on function public.reserve_pro_checkout() to authenticated;
grant execute on function public.finish_pro_checkout_lock(uuid, text, boolean) to authenticated;

create table public.billing_api_rate_limits (
  user_id uuid primary key references public.users (id) on delete cascade,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0)
);

alter table public.billing_api_rate_limits enable row level security;
revoke all on public.billing_api_rate_limits from anon, authenticated;

create policy "riders address own billing rate limit"
  on public.billing_api_rate_limits
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.consume_billing_provider_request()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_window timestamptz;
  current_count integer;
begin
  if current_user_id is null then
    raise exception 'Authentication is required';
  end if;

  insert into public.billing_api_rate_limits (user_id, request_count)
  values (current_user_id, 0)
  on conflict (user_id) do nothing;

  select window_started_at, request_count
  into current_window, current_count
  from public.billing_api_rate_limits
  where user_id = current_user_id
  for update;

  if current_window < now() - interval '1 minute' then
    update public.billing_api_rate_limits
    set window_started_at = now(), request_count = 1
    where user_id = current_user_id;
    return true;
  end if;

  if current_count >= 20 then return false; end if;

  update public.billing_api_rate_limits
  set request_count = request_count + 1
  where user_id = current_user_id;
  return true;
end;
$$;

revoke all on function public.consume_billing_provider_request() from public;
grant execute on function public.consume_billing_provider_request() to authenticated;

-- The AI endpoint consumes one server-checked credit per generated report.
-- The guarded RPC makes concurrent requests atomic and protects API costs.
create table public.pro_ai_usage_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.users (id) on delete cascade,
  reservation_token uuid not null default gen_random_uuid(),
  consent_policy_version text not null check (consent_policy_version = '2026-08-01'),
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index pro_ai_usage_events_user_created_idx
  on public.pro_ai_usage_events (user_id, created_at desc);

alter table public.pro_ai_usage_events enable row level security;
revoke all on public.pro_ai_usage_events from anon, authenticated;

create policy "riders read own pro ai usage"
  on public.pro_ai_usage_events
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.consume_pro_analysis_credit(policy_version text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  monthly_limit constant integer := 30;
  monthly_used integer;
  recent_used integer;
  daily_attempts integer;
  pending_used integer;
  reservation_id bigint;
  reservation_token uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication is required';
  end if;
  if policy_version is distinct from '2026-08-01' then
    raise exception 'Unsupported consent policy version';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(current_user_id::text, 0));

  -- Release abandoned reservations left by a crashed or timed-out function.
  update public.pro_ai_usage_events
  set status = 'failed', completed_at = now()
  where user_id = current_user_id
    and status = 'pending'
    and created_at < now() - interval '10 minutes';

  select count(*) into monthly_used
  from public.pro_ai_usage_events
  where user_id = current_user_id
    and status in ('pending', 'completed')
    and created_at >= date_trunc('month', now());

  if monthly_used >= monthly_limit then
    return jsonb_build_object('allowed', false, 'remaining', 0, 'reason', 'monthly_limit');
  end if;

  select count(*) into pending_used
  from public.pro_ai_usage_events
  where user_id = current_user_id
    and status = 'pending';

  if pending_used >= 2 then
    return jsonb_build_object(
      'allowed', false,
      'remaining', monthly_limit - monthly_used,
      'reason', 'in_flight'
    );
  end if;

  select count(*) into recent_used
  from public.pro_ai_usage_events
  where user_id = current_user_id
    and created_at >= now() - interval '1 minute';

  if recent_used >= 3 then
    return jsonb_build_object(
      'allowed', false,
      'remaining', monthly_limit - monthly_used,
      'reason', 'rate_limit'
    );
  end if;

  select count(*) into daily_attempts
  from public.pro_ai_usage_events
  where user_id = current_user_id
    and created_at >= date_trunc('day', now());

  if daily_attempts >= 50 then
    return jsonb_build_object(
      'allowed', false,
      'remaining', monthly_limit - monthly_used,
      'reason', 'daily_attempt_limit'
    );
  end if;

  insert into public.pro_ai_usage_events (user_id, status, consent_policy_version)
  values (current_user_id, 'pending', policy_version)
  returning id, pro_ai_usage_events.reservation_token
  into reservation_id, reservation_token;

  return jsonb_build_object(
    'allowed', true,
    'remaining', monthly_limit - monthly_used - 1,
    'reservation_id', reservation_id,
    'reservation_token', reservation_token
  );
end;
$$;

revoke all on function public.consume_pro_analysis_credit(text) from public;
grant execute on function public.consume_pro_analysis_credit(text) to authenticated;

create or replace function public.finish_pro_analysis_credit(
  reservation_id bigint,
  provided_token uuid,
  succeeded boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Authentication is required';
  end if;

  if succeeded then
    update public.pro_ai_usage_events
    set status = 'completed', completed_at = now()
    where id = reservation_id
      and pro_ai_usage_events.reservation_token = provided_token
      and user_id = current_user_id
      and status = 'pending';
  else
    update public.pro_ai_usage_events
    set status = 'failed', completed_at = now()
    where id = reservation_id
      and pro_ai_usage_events.reservation_token = provided_token
      and user_id = current_user_id
      and status = 'pending';
  end if;
end;
$$;

revoke all on function public.finish_pro_analysis_credit(bigint, uuid, boolean) from public;
grant execute on function public.finish_pro_analysis_credit(bigint, uuid, boolean) to authenticated;
