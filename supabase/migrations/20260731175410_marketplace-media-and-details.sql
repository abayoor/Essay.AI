-- Marketplace photos and the optional "negotiable" price label.
-- Apply with `npm run db:push`; files remain writable only in the uploader's folder.

alter table public.marketplace_listings
  add column if not exists is_negotiable boolean not null default true;

alter table public.marketplace_listings
  drop constraint if exists marketplace_listings_photos_limit,
  add constraint marketplace_listings_photos_limit check (cardinality(photos) <= 6);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('marketplace-media', 'marketplace-media', true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "riders upload marketplace photos" on storage.objects;
drop policy if exists "riders update marketplace photos" on storage.objects;
drop policy if exists "riders delete marketplace photos" on storage.objects;

create policy "riders upload marketplace photos" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'marketplace-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "riders update marketplace photos" on storage.objects for update to authenticated
  using (
    bucket_id = 'marketplace-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'marketplace-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "riders delete marketplace photos" on storage.objects for delete to authenticated
  using (
    bucket_id = 'marketplace-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
