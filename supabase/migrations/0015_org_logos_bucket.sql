-- 0015_org_logos_bucket.sql — public storage bucket for organization logos.
--
-- Org logos are tiny (one per org), admin-managed, and rendered unauthenticated
-- on the volunteer-facing Youth Republic pages, so the bucket is public-read.
-- Volunteer-uploaded content stays on Cloudflare R2 in the youth-republic
-- project; this bucket only holds platform-owned branding.
--
-- File path convention: "<organization_id>/<filename>".

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'org-logos',
  'org-logos',
  true,
  524288, -- 512 KB
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "org logos are publicly readable" on storage.objects;
drop policy if exists "org admins write their org logo" on storage.objects;
drop policy if exists "org admins update their org logo" on storage.objects;
drop policy if exists "org admins delete their org logo" on storage.objects;

-- Public read. The bucket is already public, but an explicit SELECT policy keeps
-- the storage API consistent for anon + authenticated callers.
create policy "org logos are publicly readable"
  on storage.objects for select
  using (bucket_id = 'org-logos');

-- Writes are limited to an admin of the org that owns the first path segment
-- (platform owners pass via is_org_admin_or_above). A malformed path fails the
-- uuid cast and is denied.
create policy "org admins write their org logo"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'org-logos'
    and is_org_admin_or_above((storage.foldername(name))[1]::uuid)
  );

create policy "org admins update their org logo"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'org-logos'
    and is_org_admin_or_above((storage.foldername(name))[1]::uuid)
  )
  with check (
    bucket_id = 'org-logos'
    and is_org_admin_or_above((storage.foldername(name))[1]::uuid)
  );

create policy "org admins delete their org logo"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'org-logos'
    and is_org_admin_or_above((storage.foldername(name))[1]::uuid)
  );
