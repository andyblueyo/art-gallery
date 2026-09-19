-- Migration 016: return_artwork ownership check, grants, and row lock
--
-- Written from the live definition dumped 2026-09-19 (see supabase/schema.sql).
--
-- 1. Ownership check used `v_current_owner != auth.uid()`. For a logged-out
--    caller auth.uid() is null, the comparison is null, and IF treats null as
--    false, so the check passed. The call only failed later, because the
--    'return' transaction insert has from_user = auth.uid() = null and
--    from_user is NOT NULL. anon also had EXECUTE. Same bug 012 fixed in
--    remove_artwork.
--
-- 2. The item wasn't locked, so two concurrent returns of the same edition
--    could both pass the checks and restock editions_remaining twice. It also
--    didn't skip removed (soft-deleted) editions. Both now match transfer_coins.
--
-- Coin behaviour is unchanged: returns stay coin-neutral (see 007).

begin;

create or replace function public.return_artwork(p_inventory_item uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
DECLARE
  v_artwork_id         UUID;
  v_edition_number     INT;
  v_artist_id          UUID;
  v_current_owner      UUID;
  v_return_count       INT;
  v_acquired_price     INT;
  v_artwork_title      TEXT;
  v_artwork_image_url  TEXT;
BEGIN
  -- Fetch item metadata + snapshot fields; lock the edition so concurrent
  -- returns of it serialize
  SELECT ii.artwork_id, ii.edition_number, ii.owned_by,
         ii.acquired_price_coins, a.artist_id, a.title, a.file_url
  INTO v_artwork_id, v_edition_number, v_current_owner,
       v_acquired_price, v_artist_id, v_artwork_title, v_artwork_image_url
  FROM inventory_items ii
  JOIN artworks a ON a.id = ii.artwork_id
  WHERE ii.id = p_inventory_item
    AND ii.deleted_at IS NULL
    AND a.deleted_at IS NULL
  FOR UPDATE OF ii;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory item not found';
  END IF;
  -- Not `!=`: with a null auth.uid() that is null, which IF treats as false
  IF auth.uid() IS NULL OR v_current_owner IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'You do not own this item';
  END IF;
  IF v_edition_number = 0 THEN
    RAISE EXCEPTION 'Edition 0 cannot be returned';
  END IF;
  IF v_current_owner = v_artist_id THEN
    RAISE EXCEPTION 'This piece is already owned by the artist';
  END IF;

  -- Rate limit: max 3 returns per 24 hours
  SELECT COUNT(*) INTO v_return_count
  FROM transactions
  WHERE from_user = auth.uid()
    AND type = 'return'
    AND created_at > now() - interval '24 hours';
  IF v_return_count >= 3 THEN
    RAISE EXCEPTION 'Return limit reached: max 3 returns per 24 hours';
  END IF;

  -- Transfer ownership back to artist
  UPDATE inventory_items
  SET owned_by             = v_artist_id,
      acquired_from         = v_current_owner,
      acquired_price_coins  = NULL,
      listed_for_sale       = false,
      resale_price_coins    = NULL,
      acquired_at           = now()
  WHERE id = p_inventory_item;

  -- Restock editions_remaining
  UPDATE artworks
  SET editions_remaining = editions_remaining + 1
  WHERE id = v_artwork_id;

  -- Remove from gallery walls
  DELETE FROM gallery_pieces
  WHERE inventory_item_id = p_inventory_item;

  -- No coin movement: the dialog tells the collector no coins are
  -- refunded, and the artist keeps what they were already paid.

  -- Record return transaction (amount is a historical record of the
  -- piece's value at return time, not a balance movement)
  INSERT INTO transactions
    (from_user, to_user, amount, type, artwork_id, inventory_item_id, edition_number, artwork_title, artwork_image_url)
  VALUES (
    auth.uid(), v_artist_id,
    COALESCE(v_acquired_price, 0),
    'return',
    v_artwork_id, p_inventory_item, v_edition_number,
    v_artwork_title, v_artwork_image_url
  );
END;
$$;

revoke all on function public.return_artwork(uuid) from public, anon;
grant execute on function public.return_artwork(uuid) to authenticated;

commit;
