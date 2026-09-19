-- Migration 012: make remove_artwork work for collected pieces, and lock it down
--
-- Written from the live definition dumped 2026-09-19 (see supabase/schema.sql).
--
-- 1. remove_artwork inserts 'removal' transactions (the dashboard's
--    TransactionTable reads them), but 007 rebuilt transactions_type_check
--    without 'removal'. Any removal of a piece a collector owned failed and
--    rolled back. The table holds no 'removal' rows, so the refund path has
--    never completed since then.
--
-- 2. Ownership check used `v_artist_id != auth.uid()`. For a logged-out caller
--    auth.uid() is null, the comparison is null, and IF treats null as false,
--    so anon could remove any uncollected artwork. anon also had EXECUTE.
--
-- 3. Nothing stopped a second call on an already-removed artwork. Collectors
--    keep their (soft-deleted) editions, so each call refunded them again.
--
-- Refund rule (decided 2026-09-19): each collector gets back what they paid,
-- the artist pays all of it, and the artist's balance may go negative.

begin;

-- 1. Allow 'removal'
alter table public.transactions drop constraint if exists transactions_type_check;
alter table public.transactions add constraint transactions_type_check check (
  type in (
    'purchase',
    'resale',
    'artist_cut',
    'donation',
    'signup_bonus',
    'artist_deletion_refund',
    'return',
    'removal'
  )
);

-- 2 + 3. Same body as live, with the ownership check, the already-removed
-- guard, a row lock, and a pinned search_path
create or replace function public.remove_artwork(p_artwork_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
DECLARE
  v_artist_id         UUID;
  v_artwork_title     TEXT;
  v_artwork_image_url TEXT;
  v_deleted_at        TIMESTAMPTZ;
  v_item              RECORD;
BEGIN
  -- Lock the artwork so two concurrent calls can't both pass the
  -- already-removed check
  SELECT artist_id, title, file_url, deleted_at
  INTO v_artist_id, v_artwork_title, v_artwork_image_url, v_deleted_at
  FROM artworks
  WHERE id = p_artwork_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Artwork not found';
  END IF;

  -- Not `!=`: with a null auth.uid() that is null, which IF treats as false
  IF auth.uid() IS NULL OR v_artist_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Only the artist can remove this artwork';
  END IF;

  IF v_deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'This artwork has already been removed';
  END IF;

  UPDATE artworks
  SET deleted_at = now()
  WHERE id = p_artwork_id;

  FOR v_item IN
    SELECT id, owned_by, edition_number, acquired_price_coins
    FROM inventory_items
    WHERE artwork_id = p_artwork_id
      AND edition_number > 0
      AND owned_by != v_artist_id
  LOOP
    UPDATE profiles
    SET coin_balance = coin_balance + COALESCE(v_item.acquired_price_coins, 0)
    WHERE id = v_item.owned_by;

    UPDATE profiles
    SET coin_balance = coin_balance - COALESCE(v_item.acquired_price_coins, 0)
    WHERE id = v_artist_id;

    DELETE FROM gallery_pieces
    WHERE inventory_item_id = v_item.id;

    UPDATE inventory_items
    SET deleted_at = now()
    WHERE id = v_item.id;

    INSERT INTO transactions
      (from_user, to_user, amount, type, artwork_id, inventory_item_id, edition_number, artwork_title, artwork_image_url)
    VALUES (
      v_artist_id, v_item.owned_by,
      COALESCE(v_item.acquired_price_coins, 0),
      'removal',
      p_artwork_id, v_item.id, v_item.edition_number,
      v_artwork_title, v_artwork_image_url
    );
  END LOOP;

  -- Remove gallery_pieces for all editions including edition 0
  DELETE FROM gallery_pieces
  WHERE inventory_item_id IN (
    SELECT id FROM inventory_items
    WHERE artwork_id = p_artwork_id
  );

  -- Soft delete all inventory items including edition 0
  UPDATE inventory_items
  SET deleted_at = now()
  WHERE artwork_id = p_artwork_id;
END;
$$;

revoke all on function public.remove_artwork(uuid) from public, anon;
grant execute on function public.remove_artwork(uuid) to authenticated;

commit;
