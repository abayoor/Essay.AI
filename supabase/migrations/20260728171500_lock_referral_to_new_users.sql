-- Referrals may only be claimed as part of a new account's onboarding flow.

create or replace function public.apply_referral_code(input_code text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  signup_created_at timestamptz;
  referrer_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication is required';
  end if;

  select created_at into signup_created_at
  from public.users
  where id = current_user_id;

  if signup_created_at is null or signup_created_at < now() - interval '24 hours' then
    return jsonb_build_object('applied', false, 'reason', 'not_new_user');
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
