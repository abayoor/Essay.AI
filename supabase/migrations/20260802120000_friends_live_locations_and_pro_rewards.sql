-- Friends, opt-in expiring live locations, promotional Pro access, and the weekly distance prize.

create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.users (id) on delete cascade,
  addressee_id uuid not null references public.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  user_low uuid generated always as (least(requester_id, addressee_id)) stored,
  user_high uuid generated always as (greatest(requester_id, addressee_id)) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requester_id <> addressee_id),
  unique (user_low, user_high)
);

create index friendships_requester_idx on public.friendships (requester_id, status);
create index friendships_addressee_idx on public.friendships (addressee_id, status);

alter table public.friendships enable row level security;
revoke all on public.friendships from anon, authenticated;
grant select on public.friendships to authenticated;

create policy "friends read their relationships"
  on public.friendships for select to authenticated
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

create or replace function public.send_friend_request(target_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing public.friendships;
  result_id uuid;
begin
  if auth.uid() is null or target_user_id is null or target_user_id = auth.uid() then
    raise exception 'invalid_friend_request';
  end if;
  if not exists (select 1 from public.users where id = target_user_id) then
    raise exception 'rider_not_found';
  end if;

  select * into existing
  from public.friendships
  where user_low = least(auth.uid(), target_user_id)
    and user_high = greatest(auth.uid(), target_user_id);

  if found and existing.status in ('pending', 'accepted') then
    return existing.id;
  end if;

  if found then
    update public.friendships
    set requester_id = auth.uid(), addressee_id = target_user_id, status = 'pending', updated_at = now()
    where id = existing.id
    returning id into result_id;
    return result_id;
  end if;

  insert into public.friendships (requester_id, addressee_id)
  values (auth.uid(), target_user_id)
  returning id into result_id;
  return result_id;
end;
$$;

create or replace function public.respond_friend_request(request_id uuid, accept_request boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.friendships
  set status = case when accept_request then 'accepted' else 'rejected' end,
      updated_at = now()
  where id = request_id
    and addressee_id = auth.uid()
    and status = 'pending';
  if not found then raise exception 'friend_request_not_found'; end if;
end;
$$;

create or replace function public.remove_friend(friend_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.friendships
  where status = 'accepted'
    and ((requester_id = auth.uid() and addressee_id = friend_user_id)
      or (addressee_id = auth.uid() and requester_id = friend_user_id));
end;
$$;

revoke all on function public.send_friend_request(uuid) from public;
revoke all on function public.respond_friend_request(uuid, boolean) from public;
revoke all on function public.remove_friend(uuid) from public;
grant execute on function public.send_friend_request(uuid) to authenticated;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;
grant execute on function public.remove_friend(uuid) to authenticated;

create table public.rider_live_locations (
  user_id uuid primary key references public.users (id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy_m double precision not null check (accuracy_m between 0 and 25000),
  heading_degrees double precision check (heading_degrees is null or heading_degrees between 0 and 360),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 minutes')
);

alter table public.rider_live_locations enable row level security;
grant select, insert, update, delete on public.rider_live_locations to authenticated;

create policy "riders manage their live location"
  on public.rider_live_locations for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and expires_at <= now() + interval '35 minutes');

create policy "accepted friends read fresh live locations"
  on public.rider_live_locations for select to authenticated
  using (
    expires_at > now()
    and updated_at > now() - interval '15 minutes'
    and exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and ((f.requester_id = auth.uid() and f.addressee_id = rider_live_locations.user_id)
          or (f.addressee_id = auth.uid() and f.requester_id = rider_live_locations.user_id))
    )
  );

create table public.pro_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  source text not null check (source in ('promo', 'weekly_prize')),
  source_key text not null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, source, source_key),
  check (ends_at is null or ends_at > starts_at)
);

alter table public.pro_entitlements enable row level security;
revoke all on public.pro_entitlements from anon, authenticated;
grant select (id, user_id, source, starts_at, ends_at, created_at) on public.pro_entitlements to authenticated;

create policy "riders read own pro rewards"
  on public.pro_entitlements for select to authenticated
  using (auth.uid() = user_id);

create or replace function public.has_pro_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.pro_entitlements
    where user_id = auth.uid()
      and starts_at <= now()
      and (ends_at is null or ends_at > now())
  );
$$;

create or replace function public.redeem_pro_promo(promo_code text)
returns table (active boolean, source text, ends_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if lower(btrim(coalesce(promo_code, ''))) <> lower('Abay8582') then
    raise exception 'invalid_promo_code';
  end if;

  insert into public.pro_entitlements (user_id, source, source_key, ends_at)
  values (auth.uid(), 'promo', 'abay8582', null)
  on conflict (user_id, source, source_key) do nothing;

  return query select true, 'promo'::text, null::timestamptz;
end;
$$;

create or replace function public.current_week_distance_leaderboard(max_rows integer default 50)
returns table (
  rank bigint,
  user_id uuid,
  username text,
  full_name text,
  avatar_url text,
  distance_km numeric,
  ride_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with totals as (
    select r.user_id, sum(r.distance_km)::numeric(12,2) as distance_km, count(*) as ride_count
    from public.ride_activities r
    where r.ride_date >= date_trunc('week', current_date)::date
      and r.ride_date < (date_trunc('week', current_date) + interval '7 days')::date
      and r.distance_km > 0
    group by r.user_id
  ), ranked as (
    select row_number() over (order by t.distance_km desc, t.ride_count desc, t.user_id) as rank,
      t.user_id, u.username, coalesce(u.full_name, u.username) as full_name, u.avatar_url,
      t.distance_km, t.ride_count
    from totals t join public.users u on u.id = t.user_id
  )
  select * from ranked order by rank limit least(greatest(max_rows, 1), 100);
$$;

create or replace function public.ensure_previous_week_pro_winner()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_start date := (date_trunc('week', current_date) - interval '7 days')::date;
  current_start date := date_trunc('week', current_date)::date;
  winner_id uuid;
begin
  select r.user_id into winner_id
  from public.ride_activities r
  where r.ride_date >= previous_start and r.ride_date < current_start and r.distance_km > 0
  group by r.user_id
  order by sum(r.distance_km) desc, count(*) desc, r.user_id
  limit 1;

  if winner_id is not null then
    insert into public.pro_entitlements (user_id, source, source_key, ends_at)
    values (winner_id, 'weekly_prize', previous_start::text, now() + interval '30 days')
    on conflict (user_id, source, source_key) do nothing;
  end if;
  return winner_id;
end;
$$;

revoke all on function public.has_pro_access() from public;
revoke all on function public.redeem_pro_promo(text) from public;
revoke all on function public.current_week_distance_leaderboard(integer) from public;
revoke all on function public.ensure_previous_week_pro_winner() from public;
grant execute on function public.has_pro_access() to authenticated;
grant execute on function public.redeem_pro_promo(text) to authenticated;
grant execute on function public.current_week_distance_leaderboard(integer) to authenticated;
grant execute on function public.ensure_previous_week_pro_winner() to authenticated;
