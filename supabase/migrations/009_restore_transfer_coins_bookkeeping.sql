-- 009_restore_transfer_coins_bookkeeping.sql
-- Puts back three things 008 silently dropped from transfer_coins, and repairs
-- the rows written while they were missing.
--
-- 008 was written from the repo's copy of transfer_coins. The live function had
-- drifted from that copy and did more; 008 replaced it without the live body
-- being read, so the extra behaviour was lost. Each item below was confirmed
-- from live data on 2026-09-18 -- every purchase before 008 has it, every
-- purchase after does not:
--
--   1. artwork_title / artwork_image_url snapshots on the transaction rows.
--      Without them the dashboard showed "--" and a broken image.
--   2. inventory_items.acquired_price_coins. return_artwork logs it as the
--      value of a returned piece, so returns of post-008 purchases logged 0.
--   3. The artworks.editions_remaining decrement. "january fire horse" -- bought
--      twice under 008, returned once -- reached 6 remaining of 5.
--
-- Money movement is unchanged from 008; balances were always correct.
--
-- Idempotent. No app change needed. Apply before the next purchase, or that
-- purchase adds more rows to repair.

begin;

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
  v_title       text;
  v_image       text;
  v_balance     int;
  v_artist_cut  int;
  v_seller_gets int;
begin
  if v_buyer is null then
    raise exception 'Not authenticated';
  end if;

  -- Lock the inventory row first: it is the contended resource, so this is what
  -- stops two buyers collecting the same edition concurrently. Always locking
  -- inventory-then-profile keeps lock ordering consistent across calls.
  select ii.owned_by, ii.artwork_id, ii.edition_number, ii.listed_for_sale,
         a.artist_id, a.price_coins, a.title, a.file_url
    into v_seller, v_artwork, v_edition, v_listed,
         v_artist, v_price, v_title, v_image
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
  set owned_by             = v_buyer,
      acquired_from        = v_seller,
      acquired_price_coins = v_price,
      listed_for_sale      = false,
      resale_price_coins   = null,
      acquired_at          = now()
  where id = p_inventory_item;

  update artworks
  set editions_remaining = editions_remaining - 1
  where id = v_artwork;

  insert into transactions
    (from_user, to_user, amount, type, artwork_id, inventory_item_id, edition_number,
     artwork_title, artwork_image_url)
  values (
    v_buyer, v_seller, v_seller_gets,
    case when v_seller = v_artist then 'purchase' else 'resale' end,
    v_artwork, p_inventory_item, v_edition,
    v_title, v_image
  );

  -- Skipped when the seller IS the artist -- no self-transfer row.
  if v_artist is distinct from v_seller then
    insert into transactions
      (from_user, to_user, amount, type, artwork_id, inventory_item_id, edition_number,
       artwork_title, artwork_image_url)
    values (
      v_seller, v_artist, v_artist_cut, 'artist_cut',
      v_artwork, p_inventory_item, v_edition,
      v_title, v_image
    );
  end if;
end;
$$;

revoke all on function public.transfer_coins(uuid) from public, anon;
grant execute on function public.transfer_coins(uuid) to authenticated;


-- Repairs. Scoped to rows written since 008 went live (2026-09-18) whose fields
-- are still blank or wrong, so anything the old function wrote is untouched.

-- 1. Title and image snapshots.
update transactions t
set artwork_title     = coalesce(t.artwork_title, a.title),
    artwork_image_url = coalesce(t.artwork_image_url, a.file_url)
from artworks a
where a.id = t.artwork_id
  and t.type in ('purchase', 'resale', 'artist_cut')
  and t.created_at >= '2026-09-18'
  and (t.artwork_title is null or t.artwork_image_url is null);

-- 2a. Price paid, for pieces still held by their post-008 buyer. (Returned
--     pieces are excluded: return_artwork clears the price deliberately.)
update inventory_items ii
set acquired_price_coins = a.price_coins
from artworks a
where a.id = ii.artwork_id
  and ii.acquired_price_coins is null
  and ii.acquired_from is not null
  and ii.owned_by <> a.artist_id
  and ii.acquired_at >= '2026-09-18';

-- 2b. Returns of post-008 purchases, which logged 0 because the price was missing.
update transactions t
set amount = a.price_coins
from artworks a
where a.id = t.artwork_id
  and t.type = 'return'
  and t.amount = 0
  and t.created_at >= '2026-09-18';

-- 3. editions_remaining, recomputed for artworks sold since 008 from the
--    invariant every correctly-maintained artwork satisfies:
--    remaining = total - editions held by collectors.
update artworks a
set editions_remaining = a.edition_total - held.n
from (
  select ii.artwork_id,
         count(*) filter (where ii.owned_by <> a2.artist_id and ii.edition_number > 0) as n
  from inventory_items ii
  join artworks a2 on a2.id = ii.artwork_id
  group by ii.artwork_id
) held
where held.artwork_id = a.id
  and a.edition_total is not null
  and a.id in (
    select artwork_id from transactions
    where type in ('purchase', 'resale') and created_at >= '2026-09-18'
  )
  and a.editions_remaining is distinct from a.edition_total - held.n;

commit;
