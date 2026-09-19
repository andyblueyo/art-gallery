-- Migration 015: only logged-in users can upload to the artworks bucket, only into their own folder
--
-- Live state before this (dumped 2026-09-19): "anyone can upload" allowed
-- INSERT on storage.objects for role public with only bucket_id = 'artworks',
-- and the bucket had no size or type limit. Anyone, logged out included,
-- could upload any file of any size to any path.
--
-- The app uploads to this bucket in two places, both under the user's id:
--   UploadZone:            <uid>/<artwork id>.<webp|jpg|pdf>  (images re-encoded to <= 2 MB, PDFs <= 5 MB)
--   GallerySettingsPanel:  <uid>/gallery-backgrounds/<ts>-<name>  (jpeg/png/webp, <= 5 MB)
-- The bucket limits below match those client-side limits. They apply to new
-- uploads only; existing files are untouched.

begin;

drop policy if exists "anyone can upload" on storage.objects;

create policy "Users can upload their own artworks"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'artworks' and auth.uid()::text = (storage.foldername(name))[1]);

update storage.buckets
set file_size_limit = 5242880,  -- 5 MB
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
where id = 'artworks';

commit;
