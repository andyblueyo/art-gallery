-- Migration 018: artists can only write the artwork columns the app edits
--
-- Live state before this (dumped 2026-09-19): "artists manage own artworks"
-- and "artworks_write_own" were both FOR ALL on artist_id = auth.uid(), and
-- authenticated held table-wide INSERT/UPDATE/DELETE. So an artist could,
-- with the anon key:
--   * set heart_count or editions_remaining to anything
--   * set deleted_at directly, hiding a collected piece without the refunds
--     remove_artwork pays
--   * change file_url after a sale, swapping the image collectors bought
--   * set a negative price_coins: transfer_coins' balance check then always
--     passes and the buyer is paid instead of charged. With negative balances
--     allowed (012), a throwaway artist account could hand out unlimited coins
--   * insert artworks with any of the above preset, or hard-delete unsold ones
--
-- Checked 2026-09-19: no price below 1, every heart_count matches its hearts,
-- every file_url is in the artist's own storage folder, and no edition count
-- looks edited. So no data cleanup, and the constraint below applies cleanly.
--
-- The app writes this table in two places:
--   UploadZone:  insert (id, artist_id, title, medium, description, file_url,
--                file_type, frame_file, edition_total, editions_remaining)
--   ArtworkCard: update title, medium, for_sale, price_coins
-- description is granted for update too (same kind of field as title).
-- heart_count, editions_remaining and deleted_at are now written only by the
-- security definer functions and heart triggers, which run as the table owner.

begin;

drop policy if exists "artists manage own artworks" on public.artworks;
drop policy if exists "artworks_write_own" on public.artworks;

create policy "artists insert own artworks"
  on public.artworks for insert
  with check (
    artist_id = auth.uid()
    and editions_remaining = edition_total
    and file_url like '%/storage/v1/object/public/artworks/' || auth.uid()::text || '/%'
  );

create policy "artists update own artworks"
  on public.artworks for update
  using (artist_id = auth.uid() and deleted_at is null)
  with check (artist_id = auth.uid() and deleted_at is null);

revoke insert, update on public.artworks from anon, authenticated;

grant insert (
  id, artist_id, title, medium, description, file_url, file_type, frame_file,
  edition_total, editions_remaining
) on public.artworks to authenticated;

grant update (title, medium, description, for_sale, price_coins)
  on public.artworks to authenticated;

-- Same floor as the price input in ArtworkCard
alter table public.artworks
  add constraint price_coins_min check (price_coins is null or price_coins >= 1);

commit;
