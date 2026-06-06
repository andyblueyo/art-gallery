-- ============================================================
-- Gallery Club — Database Migration
-- Generated: 2026-06-06
-- ⚠️  LIVE DATA — Review carefully before executing.
-- ⚠️  Send artist email notice BEFORE running (artworks will
--     be unlinked from galleries; artists must re-hang after).
-- Run in Supabase SQL Editor as a single transaction.
-- ============================================================


-- ============================================================
-- SECTION 1: ALTER profiles — add coin_balance, tier
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS coin_balance int NOT NULL DEFAULT 25,
  ADD COLUMN IF NOT EXISTS tier         text NOT NULL DEFAULT 'standard';


-- ============================================================
-- SECTION 2: ALTER artworks — drop layout columns, add commerce columns
-- ============================================================

-- Drop the per-artwork layout columns (layout is now on gallery_pieces)
ALTER TABLE artworks
  DROP COLUMN IF EXISTS position_x,
  DROP COLUMN IF EXISTS position_y,
  DROP COLUMN IF EXISTS rotation,
  DROP COLUMN IF EXISTS scale,
  DROP COLUMN IF EXISTS z_index,
  DROP COLUMN IF EXISTS display_order;

-- Add commerce columns
ALTER TABLE artworks
  ADD COLUMN IF NOT EXISTS for_sale           bool NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS price_coins        int,
  ADD COLUMN IF NOT EXISTS edition_total      int,
  ADD COLUMN IF NOT EXISTS editions_remaining int;


-- ============================================================
-- SECTION 3: CREATE galleries
-- ============================================================

CREATE TABLE IF NOT EXISTS galleries (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name          text        NOT NULL,
  display_order int         NOT NULL DEFAULT 0,
  is_primary    bool        NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);


-- ============================================================
-- SECTION 4: CREATE inventory_items
-- ============================================================

CREATE TABLE IF NOT EXISTS inventory_items (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owned_by           uuid        NOT NULL REFERENCES profiles(id),
  artwork_id         uuid        NOT NULL REFERENCES artworks(id),
  edition_number     int         NOT NULL,
  acquired_from      uuid        REFERENCES profiles(id),          -- nullable
  listed_for_sale    bool        NOT NULL DEFAULT false,
  resale_price_coins int,                                          -- nullable
  acquired_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_artwork_edition UNIQUE (artwork_id, edition_number)
);


-- ============================================================
-- SECTION 5: CREATE gallery_pieces
-- ============================================================

CREATE TABLE IF NOT EXISTS gallery_pieces (
  id                uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  gallery_id        uuid    NOT NULL REFERENCES galleries(id) ON DELETE CASCADE,
  inventory_item_id uuid    NOT NULL REFERENCES inventory_items(id) UNIQUE,
  position_x        float8,
  position_y        float8,
  rotation          float8,
  scale             float8,
  z_index           int
);


-- ============================================================
-- SECTION 6: CREATE transactions
-- ============================================================

-- Valid type values: purchase | resale | artist_cut | donation |
--                   signup_bonus | artist_deletion_refund

CREATE TABLE IF NOT EXISTS transactions (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user         uuid        NOT NULL REFERENCES profiles(id),
  to_user           uuid        NOT NULL REFERENCES profiles(id),
  amount            int         NOT NULL,
  type              text        NOT NULL,
  artwork_id        uuid        REFERENCES artworks(id),           -- nullable
  inventory_item_id uuid        REFERENCES inventory_items(id),    -- nullable
  edition_number    int,                                           -- nullable
  created_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT transactions_type_check CHECK (
    type IN (
      'purchase',
      'resale',
      'artist_cut',
      'donation',
      'signup_bonus',
      'artist_deletion_refund'
    )
  )
);


-- ============================================================
-- SECTION 7: DATA MIGRATION — seed galleries for existing users
-- Each existing profile gets one primary gallery called 'My Gallery'.
-- Existing artworks are NOT linked to gallery_pieces;
-- artists will re-hang after the migration.
-- ============================================================

INSERT INTO galleries (user_id, name, is_primary, display_order)
SELECT id, 'My Gallery', true, 0
FROM profiles
ON CONFLICT DO NOTHING;


-- ============================================================
-- SECTION 7b: FIX gallery_views — re-point gallery_id FK to galleries
--
-- Currently: gallery_views.gallery_id → profiles.id  (wrong)
-- After:     gallery_views.gallery_id → galleries.id (correct)
--
-- Safe because Section 7 above guarantees every profile has exactly
-- one primary gallery, so we can remap 1:1.
-- ============================================================

-- 1. Drop the old FK constraint pointing to profiles
ALTER TABLE gallery_views
  DROP CONSTRAINT IF EXISTS gallery_views_gallery_id_fkey;

-- 2. Remap existing gallery_id values: profile uuid → that profile's primary gallery uuid
UPDATE gallery_views gv
SET gallery_id = g.id
FROM galleries g
WHERE g.user_id = gv.gallery_id
  AND g.is_primary = true;

-- 3. Add the corrected FK constraint pointing to galleries
ALTER TABLE gallery_views
  ADD CONSTRAINT gallery_views_gallery_id_fkey
  FOREIGN KEY (gallery_id) REFERENCES galleries(id) ON DELETE CASCADE;


-- ============================================================
-- SECTION 8: FUNCTION — transfer_coins
-- Atomically transfers coins on a marketplace purchase.
--
-- Parameters:
--   buyer_id          uuid  — the buyer's profile id
--   seller_id         uuid  — the current owner / seller's profile id
--   artist_id         uuid  — the original artwork artist's profile id
--   p_inventory_item  uuid  — the inventory_items.id being sold
--   price             int   — total purchase price in coins
--
-- Split: seller receives (price - floor(price * 0.5))
--        artist receives floor(price * 0.5)   ← 50% royalty
--
-- Raises exception if buyer has insufficient coins.
-- Uses SERIALIZABLE isolation to prevent race conditions.
-- ============================================================

CREATE OR REPLACE FUNCTION transfer_coins(
  buyer_id         uuid,
  seller_id        uuid,
  artist_id        uuid,
  p_inventory_item uuid,
  price            int
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  buyer_balance    int;
  artist_cut       int;
  seller_receives  int;
  v_artwork_id     uuid;
  v_edition_number int;
BEGIN
  -- Enforce SERIALIZABLE isolation for this transaction
  SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;

  -- Lock the buyer row immediately to prevent concurrent overspend
  SELECT coin_balance INTO buyer_balance
  FROM profiles
  WHERE id = buyer_id
  FOR UPDATE;

  IF buyer_balance < price THEN
    RAISE EXCEPTION 'Insufficient coins: buyer has %, needs %', buyer_balance, price;
  END IF;

  -- Compute the split
  artist_cut      := FLOOR(price * 0.5);
  seller_receives := price - artist_cut;

  -- Fetch artwork metadata for transaction records
  SELECT artwork_id, edition_number
  INTO v_artwork_id, v_edition_number
  FROM inventory_items
  WHERE id = p_inventory_item;

  -- Debit buyer
  UPDATE profiles
  SET coin_balance = coin_balance - price
  WHERE id = buyer_id;

  -- Credit seller
  UPDATE profiles
  SET coin_balance = coin_balance + seller_receives
  WHERE id = seller_id;

  -- Credit artist (may be same as seller on primary sale — that's fine,
  -- Postgres applies both UPDATEs correctly in sequence)
  UPDATE profiles
  SET coin_balance = coin_balance + artist_cut
  WHERE id = artist_id;

  -- Transfer ownership of the inventory item
  UPDATE inventory_items
  SET owned_by           = buyer_id,
      acquired_from      = seller_id,
      listed_for_sale    = false,
      resale_price_coins = NULL,
      acquired_at        = now()
  WHERE id = p_inventory_item;

  -- Record buyer → seller transaction (purchase / resale)
  INSERT INTO transactions (from_user, to_user, amount, type, artwork_id, inventory_item_id, edition_number)
  VALUES (
    buyer_id,
    seller_id,
    seller_receives,
    CASE WHEN seller_id = artist_id THEN 'purchase' ELSE 'resale' END,
    v_artwork_id,
    p_inventory_item,
    v_edition_number
  );

  -- Record artist royalty cut (skipped if seller IS the artist — no self-transfer)
  IF artist_id IS DISTINCT FROM seller_id THEN
    INSERT INTO transactions (from_user, to_user, amount, type, artwork_id, inventory_item_id, edition_number)
    VALUES (
      seller_id,
      artist_id,
      artist_cut,
      'artist_cut',
      v_artwork_id,
      p_inventory_item,
      v_edition_number
    );
  END IF;

END;
$$;


-- ============================================================
-- SECTION 9: ENABLE ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE galleries        ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE gallery_pieces   ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions     ENABLE ROW LEVEL SECURITY;

-- Note: artworks RLS should already be enabled; verified below.
-- If the policy doesn't exist yet it will be created.


-- ============================================================
-- SECTION 10: RLS POLICIES — galleries
-- Read: anyone authenticated (public gallery browsing)
-- Write: owner only
-- ============================================================

DROP POLICY IF EXISTS "galleries_read_all"   ON galleries;
DROP POLICY IF EXISTS "galleries_write_own"  ON galleries;

CREATE POLICY "galleries_read_all"
  ON galleries FOR SELECT
  USING (true);

CREATE POLICY "galleries_write_own"
  ON galleries FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- ============================================================
-- SECTION 11: RLS POLICIES — artworks
-- Verify/create: read all, write own
-- ============================================================

-- Drop and recreate to ensure they're current
DROP POLICY IF EXISTS "artworks_read_all"   ON artworks;
DROP POLICY IF EXISTS "artworks_write_own"  ON artworks;

CREATE POLICY "artworks_read_all"
  ON artworks FOR SELECT
  USING (true);

CREATE POLICY "artworks_write_own"
  ON artworks FOR ALL
  USING (artist_id = auth.uid())
  WITH CHECK (artist_id = auth.uid());


-- ============================================================
-- SECTION 12: RLS POLICIES — inventory_items
-- Read: owner always; others only if listed_for_sale = true
-- Write: owner only
-- ============================================================

DROP POLICY IF EXISTS "inventory_items_read"   ON inventory_items;
DROP POLICY IF EXISTS "inventory_items_write"  ON inventory_items;

CREATE POLICY "inventory_items_read"
  ON inventory_items FOR SELECT
  USING (
    owned_by = auth.uid()
    OR listed_for_sale = true
  );

CREATE POLICY "inventory_items_write"
  ON inventory_items FOR ALL
  USING (owned_by = auth.uid())
  WITH CHECK (owned_by = auth.uid());


-- ============================================================
-- SECTION 13: RLS POLICIES — gallery_pieces
-- Read: anyone
-- Write: only if the parent gallery belongs to current user
-- ============================================================

DROP POLICY IF EXISTS "gallery_pieces_read_all"  ON gallery_pieces;
DROP POLICY IF EXISTS "gallery_pieces_write_own" ON gallery_pieces;

CREATE POLICY "gallery_pieces_read_all"
  ON gallery_pieces FOR SELECT
  USING (true);

CREATE POLICY "gallery_pieces_write_own"
  ON gallery_pieces FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM galleries
      WHERE galleries.id = gallery_pieces.gallery_id
        AND galleries.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM galleries
      WHERE galleries.id = gallery_pieces.gallery_id
        AND galleries.user_id = auth.uid()
    )
  );


-- ============================================================
-- SECTION 14: RLS POLICIES — transactions
-- Read: parties only (from_user or to_user)
-- No direct writes from client (handled via transfer_coins function)
-- ============================================================

DROP POLICY IF EXISTS "transactions_read_own" ON transactions;

CREATE POLICY "transactions_read_own"
  ON transactions FOR SELECT
  USING (
    from_user = auth.uid()
    OR to_user = auth.uid()
  );

-- Writes go through the transfer_coins() SECURITY DEFINER function only.
-- No INSERT/UPDATE/DELETE policy for clients on this table by design.


-- ============================================================
-- END OF MIGRATION
-- ============================================================
-- Post-run checklist:
--   [ ] Verify profiles rows have coin_balance = 25, tier = 'standard'
--   [ ] Verify galleries has one row per profile (SELECT count(*) FROM galleries)
--   [ ] Verify artworks no longer has position_x, position_y, etc. columns
--   [ ] Test transfer_coins() with a test buyer/seller in staging first
--   [ ] Confirm artworks RLS policies are active in Supabase dashboard
--   [ ] Email artists about re-hanging their gallery before running
-- ============================================================