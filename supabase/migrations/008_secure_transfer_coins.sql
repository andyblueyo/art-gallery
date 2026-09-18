-- 008_secure_transfer_coins.sql
-- SECURITY FIX — arbitrary coin theft.
--
-- transfer_coins(buyer_id, seller_id, artist_id, p_inventory_item, price) was
-- SECURITY DEFINER (so it bypassed RLS), trusted all five parameters, never
-- compared any of them to auth.uid(), and kept Postgres's default PUBLIC
-- EXECUTE grant. The anon key ships in the client bundle, so anyone could
-- call it directly and move coins between arbitrary accounts:
--
--   supabase.rpc('transfer_coins', {
--     buyer_id: <victim>, seller_id: <attacker>, artist_id: <attacker>,
--     p_inventory_item: <any item>, price: <victim's balance> })
--
-- This replaces it with a one-argument version that takes only the item id and
-- derives buyer (auth.uid()), seller, artist and price from the database, then
-- revokes PUBLIC/anon execute.
--
-- The old five-argument version is DROPPED, not replaced: CREATE OR REPLACE
-- with a different parameter list creates an overload, which would leave the
-- vulnerable version callable.
--
-- The drop loops over every non-1-argument overload instead of naming a
-- signature, because the repo's declared signature is wrong. This file
-- originally said DROP FUNCTION ... (uuid, uuid, uuid, uuid, int), matching
-- curation_and_exchange_migration.sql. The live function is actually
-- (uuid, uuid, uuid, integer, uuid) -- price and p_inventory_item are swapped.
-- PostgREST calls by parameter name so nothing ever surfaced the difference,
-- but a literal DROP built from the repo's order matches nothing and leaves
-- the vulnerable function in place. Verified against the live DB 2026-09-18.
--
-- Money semantics are unchanged: 50% artist royalty, same split, same
-- transaction rows, same ownership transfer. Two deliberate differences:
--
--   * SET TRANSACTION ISOLATION LEVEL SERIALIZABLE is gone. It is only legal as
--     the first statement of a transaction, which a PostgREST RPC cannot
--     guarantee. Explicit FOR UPDATE locks on the inventory row and the buyer's
--     profile give the same protection against double-sell and overspend, and
--     hold regardless of how the function is called.
--   * The item is re-validated server-side (listed, not deleted, edition > 0,
--     priced, not already the buyer's) against the same predicate the gallery
--     page uses to decide what is collectable. The old version validated
--     nothing.
--
-- NOTE: inventory_items.deleted_at was added to the live database out-of-band
-- and is not in this repo's migration history. This function depends on it.
--
-- Apply this BEFORE deploying the matching app change — src/app/actions/
-- collect.ts sends only p_inventory_item. Collecting will fail in the window
-- between the two; that is preferable to leaving the hole open.

begin;

do $drop$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'transfer_coins'
      and p.pronargs <> 1
  loop
    execute format('drop function %s', f.sig);
  end loop;
end;
$drop$;

create or replace function public.transfer_coins(p_inventory_item uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_buyer       uuid := auth.uid();
  v_seller      uuid;
  v_artist      uuid;
  v_artwork     uuid;
  v_edition     int;
  v_listed      bool;
  v_price       int;
  v_balance     int;
  v_artist_cut  int;
  v_seller_gets int;
begin
  if v_buyer is null then
    raise exception 'Not authenticated';
  end if;

  -- Lock the inventory row before reading anything else: it is the contended
  -- resource, so taking the lock here is what stops two buyers collecting the
  -- same edition concurrently. Locking inventory-then-profile in this order in
  -- every path keeps the lock ordering consistent.
  select ii.owned_by, ii.artwork_id, ii.edition_number, ii.listed_for_sale,
         a.artist_id, a.price_coins
    into v_seller, v_artwork, v_edition, v_listed,
         v_artist, v_price
  from inventory_items ii
  join artworks a on a.id = ii.artwork_id
  where ii.id = p_inventory_item
    and ii.deleted_at is null
    and a.deleted_at is null
  for update of ii;

  if not found then
    raise exception 'Inventory item not found';
  end if;
  if not v_listed then
    raise exception 'This piece is not for sale';
  end if;
  if v_edition = 0 then
    raise exception 'Edition 0 is the artist''s copy and cannot be collected';
  end if;
  if v_seller = v_buyer then
    raise exception 'You already own this piece';
  end if;
  if v_price is null then
    raise exception 'This piece has no price set';
  end if;

  select coin_balance into v_balance
  from profiles
  where id = v_buyer
  for update;

  if v_balance < v_price then
    raise exception 'Insufficient coins: buyer has %, needs %', v_balance, v_price;
  end if;

  v_artist_cut  := floor(v_price * 0.5);
  v_seller_gets := v_price - v_artist_cut;

  update profiles set coin_balance = coin_balance - v_price       where id = v_buyer;
  update profiles set coin_balance = coin_balance + v_seller_gets where id = v_seller;
  update profiles set coin_balance = coin_balance + v_artist_cut  where id = v_artist;

  update inventory_items
  set owned_by           = v_buyer,
      acquired_from      = v_seller,
      listed_for_sale    = false,
      resale_price_coins = null,
      acquired_at        = now()
  where id = p_inventory_item;

  insert into transactions
    (from_user, to_user, amount, type, artwork_id, inventory_item_id, edition_number)
  values (
    v_buyer, v_seller, v_seller_gets,
    case when v_seller = v_artist then 'purchase' else 'resale' end,
    v_artwork, p_inventory_item, v_edition
  );

  -- Skipped when the seller IS the artist — no self-transfer row.
  if v_artist is distinct from v_seller then
    insert into transactions
      (from_user, to_user, amount, type, artwork_id, inventory_item_id, edition_number)
    values (
      v_seller, v_artist, v_artist_cut, 'artist_cut',
      v_artwork, p_inventory_item, v_edition
    );
  end if;
end;
$$;

revoke all on function public.transfer_coins(uuid) from public, anon;
grant execute on function public.transfer_coins(uuid) to authenticated;

commit;
