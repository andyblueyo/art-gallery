-- 007_fix_return_artwork.sql
-- Fixes return_artwork(): it referenced profiles.coins, which does not
-- exist (the column is coin_balance), so every return failed with
-- "column \"coins\" does not exist".
--
-- It also refunded the collector and clawed the same amount back out of
-- the artist's balance, contradicting the confirmation dialog's "no coins
-- will be refunded" copy (src/components/dashboard/MyCollection.tsx). That
-- refund/clawback could never have run in production — the coins bug
-- crashed the function before it got there. Decision: keep the return
-- coin-neutral, matching the dialog. Ownership, inventory and the
-- transaction log entry are unaffected.
--
-- Also widens transactions_type_check to allow 'return', in case it was
-- never added when this function was first created out-of-band.
--
-- Run once in the Supabase SQL editor (or via supabase db push).

begin;

alter table public.transactions drop constraint if exists transactions_type_check;
alter table public.transactions add constraint transactions_type_check check (
  type in (
    'purchase',
    'resale',
    'artist_cut',
    'donation',
    'signup_bonus',
    'artist_deletion_refund',
    'return'
  )
);

create or replace function public.return_artwork(p_inventory_item uuid)
returns void
language plpgsql
security definer
as $function$
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
  -- Fetch item metadata + snapshot fields
  SELECT ii.artwork_id, ii.edition_number, ii.owned_by,
         ii.acquired_price_coins, a.artist_id, a.title, a.file_url
  INTO v_artwork_id, v_edition_number, v_current_owner,
       v_acquired_price, v_artist_id, v_artwork_title, v_artwork_image_url
  FROM inventory_items ii
  JOIN artworks a ON a.id = ii.artwork_id
  WHERE ii.id = p_inventory_item;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory item not found';
  END IF;
  IF v_current_owner != auth.uid() THEN
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
$function$;

commit;
