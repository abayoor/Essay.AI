alter table public.posts
  alter column media_url drop not null,
  alter column media_type drop not null;

alter table public.posts
  drop constraint if exists posts_media_payload_valid;

alter table public.posts
  add constraint posts_media_payload_valid check (
    (media_url is null and media_type is null)
    or (media_url is not null and media_type in ('image', 'video'))
  );
