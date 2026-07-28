-- EssayCoach: referral rewards and enforceable monthly AI analysis limits.

alter table public.users
  add column if not exists referral_code text,
  add column if not exists ai_bonus_credits integer not null default 0
    check (ai_bonus_credits >= 0);

update public.users
set referral_code = lower(substr(replace(id::text, '-', ''), 1, 10))
where referral_code is null;

alter table public.users
  alter column referral_code set not null;

create unique index if not exists users_referral_code_key
  on public.users (referral_code);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email, full_name, referral_code)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    lower(substr(replace(new.id::text, '-', ''), 1, 10))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_user_id uuid not null references public.users (id) on delete cascade,
  referred_user_id uuid not null references public.users (id) on delete cascade,
  reward_granted boolean not null default false,
  created_at timestamptz not null default now(),
  unique (referred_user_id),
  check (referrer_user_id <> referred_user_id)
);

create table public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  kind text not null check (kind = 'main_feedback'),
  created_at timestamptz not null default now()
);

create index idx_referrals_referrer on public.referrals (referrer_user_id, created_at desc);
create index idx_ai_usage_events_user on public.ai_usage_events (user_id, kind, created_at desc);

alter table public.referrals enable row level security;
alter table public.ai_usage_events enable row level security;

-- Пользователь может редактировать только поля профиля, а бонусы меняют только RPC-функции ниже.
revoke update on public.users from authenticated;
grant update (full_name, locale, target_schools, application_type) on public.users to authenticated;
grant select on public.referrals, public.ai_usage_events to authenticated;

create policy "users read own referrals"
  on public.referrals for select
  using (auth.uid() = referrer_user_id or auth.uid() = referred_user_id);

create policy "users read own AI usage"
  on public.ai_usage_events for select
  using (auth.uid() = user_id);

create or replace function public.apply_referral_code(input_code text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  referrer_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication is required';
  end if;

  select id into referrer_id
  from public.users
  where referral_code = lower(trim(input_code));

  if referrer_id is null then
    return jsonb_build_object('applied', false, 'reason', 'invalid_code');
  end if;
  if referrer_id = current_user_id then
    return jsonb_build_object('applied', false, 'reason', 'own_code');
  end if;
  if exists (select 1 from public.referrals where referred_user_id = current_user_id) then
    return jsonb_build_object('applied', false, 'reason', 'already_applied');
  end if;

  insert into public.referrals (referrer_user_id, referred_user_id, reward_granted)
  values (referrer_id, current_user_id, true);

  update public.users
  set ai_bonus_credits = ai_bonus_credits + 5
  where id in (referrer_id, current_user_id);

  return jsonb_build_object('applied', true, 'reward', 5);
end;
$$;

create or replace function public.consume_ai_analysis_credit()
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  monthly_free_limit constant integer := 10;
  monthly_used integer;
  bonus_credits integer;
begin
  if current_user_id is null then
    raise exception 'Authentication is required';
  end if;

  select ai_bonus_credits into bonus_credits
  from public.users
  where id = current_user_id
  for update;

  if bonus_credits is null then
    raise exception 'User profile was not found';
  end if;

  select count(*) into monthly_used
  from public.ai_usage_events
  where user_id = current_user_id
    and kind = 'main_feedback'
    and created_at >= date_trunc('month', now());

  if monthly_used < monthly_free_limit then
    insert into public.ai_usage_events (user_id, kind)
    values (current_user_id, 'main_feedback');
    return jsonb_build_object('allowed', true, 'remaining', monthly_free_limit - monthly_used - 1 + bonus_credits);
  end if;

  if bonus_credits > 0 then
    update public.users
    set ai_bonus_credits = ai_bonus_credits - 1
    where id = current_user_id;
    insert into public.ai_usage_events (user_id, kind)
    values (current_user_id, 'main_feedback');
    return jsonb_build_object('allowed', true, 'remaining', bonus_credits - 1);
  end if;

  return jsonb_build_object('allowed', false, 'remaining', 0);
end;
$$;

revoke all on function public.apply_referral_code(text) from public;
revoke all on function public.consume_ai_analysis_credit() from public;
grant execute on function public.apply_referral_code(text) to authenticated;
grant execute on function public.consume_ai_analysis_credit() to authenticated;
