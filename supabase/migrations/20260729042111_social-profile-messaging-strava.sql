-- Social profile, public feed, direct messages and Strava connection data.
-- Run with `npm run db:push`; do not paste this into the Dashboard by hand.

-- Existing riders receive a stable temporary username. They can change it in Settings.
alter table public.users
  add column if not exists username text,
  add column if not exists interests text[] not null default '{}',
  add column if not exists locale text not null default 'ru',
  add column if not exists theme_preference text not null default 'light';

update public.users
set username = 'rider-' || id::text
where username is null or btrim(username) = '';

alter table public.users
  alter column username set not null;

create unique index if not exists users_username_key on public.users (lower(username));

alter table public.users
  drop constraint if exists users_username_format,
  drop constraint if exists users_locale_allowed,
  drop constraint if exists users_theme_preference_allowed,
  add constraint users_username_format check (username ~ '^[a-z0-9][a-z0-9_-]{2,47}$'),
  add constraint users_locale_allowed check (locale in ('ru', 'kz', 'en')),
  add constraint users_theme_preference_allowed check (theme_preference in ('light', 'dark'));

revoke update on public.users from authenticated;
grant update (full_name, avatar_url, home_city, bio, username, interests, locale, theme_preference) on public.users to authenticated;

alter table public.ride_activities
  add column if not exists source text not null default 'manual',
  add column if not exists strava_activity_id text,
  add column if not exists strava_summary_polyline text;

alter table public.ride_activities
  drop constraint if exists ride_activities_source_allowed,
  add constraint ride_activities_source_allowed check (source in ('manual', 'strava'));

create unique index if not exists ride_activities_strava_activity_id_key
  on public.ride_activities (strava_activity_id)
  where strava_activity_id is not null;

-- New accounts always get a unique, editable username without exposing email in it.
create or replace function public.create_cycle_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email, full_name, username)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    'rider-' || new.id::text
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- The base users table remains private. This view deliberately exposes only profile
-- fields needed for author cards and /u/:username pages, never email or settings.
create or replace view public.public_profiles
with (security_invoker = false)
as
select id, username, full_name, avatar_url, home_city, bio, interests
from public.users;

revoke all on public.public_profiles from public;
grant select on public.public_profiles to authenticated;

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.users (id) on delete cascade,
  media_url text not null default '',
  media_type text not null check (media_type in ('image', 'video')),
  caption text not null default '' check (char_length(caption) <= 2200),
  ride_activity_id uuid references public.ride_activities (id) on delete set null,
  strava_distance_km numeric check (strava_distance_km is null or strava_distance_km >= 0),
  strava_elevation_gain_m numeric check (strava_elevation_gain_m is null or strava_elevation_gain_m >= 0),
  strava_duration_seconds integer check (strava_duration_seconds is null or strava_duration_seconds > 0),
  strava_summary_polyline text,
  created_at timestamptz not null default now()
);

create table public.post_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

create table public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.users (id) on delete cascade,
  comment text not null check (char_length(btrim(comment)) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index posts_created_at_idx on public.posts (created_at desc);
create index posts_user_created_at_idx on public.posts (user_id, created_at desc);
create index post_likes_post_id_idx on public.post_likes (post_id);
create index post_comments_post_created_at_idx on public.post_comments (post_id, created_at);

alter table public.posts enable row level security;
alter table public.post_likes enable row level security;
alter table public.post_comments enable row level security;

grant select, insert, update, delete on public.posts, public.post_likes, public.post_comments to authenticated;

create policy "authenticated users read the shared feed" on public.posts
  for select using (auth.role() = 'authenticated');
create policy "riders create their own posts" on public.posts
  for insert with check (auth.uid() = user_id);
create policy "riders update their own posts" on public.posts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "riders delete their own posts" on public.posts
  for delete using (auth.uid() = user_id);

create policy "authenticated users read post likes" on public.post_likes
  for select using (auth.role() = 'authenticated');
create policy "riders create their own likes" on public.post_likes
  for insert with check (auth.uid() = user_id);
create policy "riders delete their own likes" on public.post_likes
  for delete using (auth.uid() = user_id);

create policy "authenticated users read post comments" on public.post_comments
  for select using (auth.role() = 'authenticated');
create policy "riders create their own comments" on public.post_comments
  for insert with check (auth.uid() = user_id);
create policy "riders update their own comments" on public.post_comments
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "riders delete their own comments" on public.post_comments
  for delete using (auth.uid() = user_id);

-- Direct messages use an opaque canonical key, so two people cannot create duplicate dialogs.
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  direct_key text unique,
  created_at timestamptz not null default now()
);

create table public.conversation_participants (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (conversation_id, user_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.users (id) on delete cascade,
  content_type text not null check (content_type in ('text', 'image', 'file', 'video', 'shared_post')),
  text_content text check (text_content is null or char_length(text_content) <= 4000),
  file_url text,
  shared_post_id uuid references public.posts (id) on delete set null,
  created_at timestamptz not null default now(),
  check (
    (content_type = 'text' and char_length(btrim(coalesce(text_content, ''))) > 0)
    or (content_type in ('image', 'file', 'video') and file_url is not null)
    or (content_type = 'shared_post' and shared_post_id is not null)
  )
);

create index conversation_participants_user_idx on public.conversation_participants (user_id, conversation_id);
create index messages_conversation_created_at_idx on public.messages (conversation_id, created_at);

-- This helper avoids recursive RLS policies while still checking auth.uid() on every query.
create or replace function public.is_conversation_participant(target_conversation_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1
    from public.conversation_participants
    where conversation_id = target_conversation_id
      and user_id = auth.uid()
  );
$$;

revoke all on function public.is_conversation_participant(uuid) from public;
grant execute on function public.is_conversation_participant(uuid) to authenticated;

alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;

grant select on public.conversations, public.conversation_participants to authenticated;
grant select, insert on public.messages to authenticated;

create policy "participants read conversations" on public.conversations
  for select using (public.is_conversation_participant(id));
create policy "participants read conversation members" on public.conversation_participants
  for select using (public.is_conversation_participant(conversation_id));
create policy "participants read every message in their conversation" on public.messages
  for select using (public.is_conversation_participant(conversation_id));
create policy "participants send messages as themselves" on public.messages
  for insert with check (
    auth.uid() = sender_id
    and public.is_conversation_participant(conversation_id)
  );

create or replace function public.get_or_create_direct_conversation(other_user_id uuid)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
  target_conversation_id uuid;
  canonical_key text;
begin
  if caller_id is null then
    raise exception 'Authentication is required.';
  end if;
  if other_user_id is null or other_user_id = caller_id then
    raise exception 'Choose another rider.';
  end if;
  if not exists (select 1 from public.users where id = other_user_id) then
    raise exception 'Rider not found.';
  end if;

  canonical_key := least(caller_id::text, other_user_id::text) || ':' || greatest(caller_id::text, other_user_id::text);
  insert into public.conversations (direct_key)
  values (canonical_key)
  on conflict (direct_key) do update set direct_key = excluded.direct_key
  returning id into target_conversation_id;

  insert into public.conversation_participants (conversation_id, user_id)
  values (target_conversation_id, caller_id), (target_conversation_id, other_user_id)
  on conflict (conversation_id, user_id) do nothing;

  return target_conversation_id;
end;
$$;

revoke all on function public.get_or_create_direct_conversation(uuid) from public;
grant execute on function public.get_or_create_direct_conversation(uuid) to authenticated;

-- Tokens are private to their owner. Vercel functions use the same user JWT,
-- never a Supabase service_role key.
create table public.strava_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique default auth.uid() references public.users (id) on delete cascade,
  strava_athlete_id text not null,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.strava_connections enable row level security;
grant select, insert, update, delete on public.strava_connections to authenticated;
create policy "riders manage only their Strava connection" on public.strava_connections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.set_strava_connection_updated_at()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_strava_connection_updated_at
  before update on public.strava_connections
  for each row execute procedure public.set_strava_connection_updated_at();

-- Media buckets. Post and avatar images are public only after an authenticated rider uploads
-- them; conversation files stay private and are read through signed URLs by participants.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('post-media', 'post-media', true, 52428800, array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm']),
  ('message-media', 'message-media', false, 52428800, array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'application/pdf'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "riders upload their avatars" on storage.objects;
drop policy if exists "riders replace their avatars" on storage.objects;
drop policy if exists "riders delete their avatars" on storage.objects;
drop policy if exists "riders upload their post media" on storage.objects;
drop policy if exists "riders replace their post media" on storage.objects;
drop policy if exists "riders delete their post media" on storage.objects;
drop policy if exists "participants upload conversation media" on storage.objects;
drop policy if exists "participants read conversation media" on storage.objects;
drop policy if exists "participants delete conversation media" on storage.objects;

create policy "riders upload their avatars" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "riders replace their avatars" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "riders delete their avatars" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "riders upload their post media" on storage.objects for insert to authenticated
  with check (bucket_id = 'post-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "riders replace their post media" on storage.objects for update to authenticated
  using (bucket_id = 'post-media' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'post-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "riders delete their post media" on storage.objects for delete to authenticated
  using (bucket_id = 'post-media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "participants upload conversation media" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'message-media'
    and public.is_conversation_participant(((storage.foldername(name))[1])::uuid)
  );
create policy "participants read conversation media" on storage.objects for select to authenticated
  using (
    bucket_id = 'message-media'
    and public.is_conversation_participant(((storage.foldername(name))[1])::uuid)
  );
create policy "participants delete conversation media" on storage.objects for delete to authenticated
  using (
    bucket_id = 'message-media'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- Realtime broadcasts are still filtered by the messages RLS policy above.
do $$
begin
  alter publication supabase_realtime add table public.messages;
exception
  when duplicate_object then null;
end;
$$;

-- Account removal is intentionally limited to the currently authenticated user.
-- Foreign keys cascade posts, messages, likes, comments, bikes and connections.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer set search_path = public, auth, storage
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null then
    raise exception 'Authentication is required.';
  end if;

  delete from storage.objects
  where (bucket_id in ('avatars', 'post-media') and (storage.foldername(name))[1] = caller_id::text)
     or (bucket_id = 'message-media' and (storage.foldername(name))[2] = caller_id::text);

  delete from auth.users where id = caller_id;
end;
$$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;
