-- Registration usernames are normalized and protected against duplicates in the database.
-- The availability helper reveals only whether one candidate is free; it never exposes profiles.

create unique index if not exists users_username_key
  on public.users (lower(username));

create or replace function public.is_username_available(candidate text)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select
    lower(btrim(coalesce(candidate, ''))) ~ '^[a-z0-9][a-z0-9_-]{2,47}$'
    and not exists (
      select 1
      from public.users
      where lower(username) = lower(btrim(candidate))
    );
$$;

revoke all on function public.is_username_available(text) from public;
grant execute on function public.is_username_available(text) to anon, authenticated;

create or replace function public.create_cycle_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  requested_username text := lower(btrim(coalesce(new.raw_user_meta_data ->> 'username', '')));
begin
  if requested_username !~ '^[a-z0-9][a-z0-9_-]{2,47}$' then
    requested_username := 'rider-' || new.id::text;
  end if;

  insert into public.users (id, email, full_name, username)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    requested_username
  )
  on conflict (id) do nothing;

  return new;
end;
$$;
