-- Migration 014: only artists can write inventory_items, and only the columns the app uses
--
-- Live state before this (dumped 2026-09-19): "inventory_items_write" was
-- FOR ALL using/with check (owned_by = auth.uid()), and authenticated held
-- table-wide INSERT/UPDATE/DELETE. So any logged-in user could:
--   * insert editions of anyone's artwork owned by themselves, beyond
--     edition_total, with any acquired_price_coins
--   * set acquired_price_coins on an edition they bought; since 012,
--     remove_artwork refunds that amount out of the artist's balance
--   * list a collected edition (resale, which the app doesn't offer yet)
--   * change artwork_id / edition_number / deleted_at on their own editions
--
-- The app only writes this table in two places, both as the artist:
--   UploadZone:  insert (owned_by, artwork_id, edition_number) for editions 0..edition_total
--   ArtworkCard: update listed_for_sale on the artist's own editions
-- Everything else goes through security definer functions (transfer_coins,
-- return_artwork, remove_artwork), which run as the table owner.
--
-- When resale is built, collectors will need their own update path
-- (listed_for_sale / resale_price_coins on editions they own).

begin;

drop policy if exists "inventory_items_write" on public.inventory_items;

create policy "inventory_items_artist_insert"
  on public.inventory_items for insert
  with check (
    owned_by = auth.uid()
    and exists (
      select 1 from public.artworks a
      where a.id = inventory_items.artwork_id
        and a.artist_id = auth.uid()
        and a.deleted_at is null
        and inventory_items.edition_number between 0 and a.edition_total
    )
  );

create policy "inventory_items_artist_update"
  on public.inventory_items for update
  using (
    owned_by = auth.uid()
    and exists (
      select 1 from public.artworks a
      where a.id = inventory_items.artwork_id
        and a.artist_id = auth.uid()
    )
  )
  with check (
    owned_by = auth.uid()
    and exists (
      select 1 from public.artworks a
      where a.id = inventory_items.artwork_id
        and a.artist_id = auth.uid()
    )
  );

revoke insert, update on public.inventory_items from anon, authenticated;

grant insert (owned_by, artwork_id, edition_number) on public.inventory_items to authenticated;
grant update (listed_for_sale) on public.inventory_items to authenticated;

commit;
