-- 010_transfer_coins_full_price_amount.sql
-- The purchase row's amount is the full price the buyer paid.
--
-- Confirmed from live data 2026-09-18: every purchase recorded by the original
-- function has amount = price (Soph: price 10, amount 10). 008 and 009, written
-- from the repo's copy, recorded the seller's share instead (price minus the 50%
-- royalty), so purchases made since show half. That under-reports "coins spent"
-- on the buyer's dashboard and income on the artist's.
--
-- Full price is also the self-consistent ledger for resales: buyer -> seller for
-- the full price, then the separate artist_cut row seller -> artist for the
-- royalty, netting the seller to exactly what their balance received.
--
-- Balances were never affected; only the recorded amount. The only change from
-- 009's function is the amount on the first insert. Idempotent.

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
    v_buyer, v_seller, v_price,
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

-- Repair purchases recorded at the seller's share since 008 went live. Prefers
-- the saved price paid; falls back to the artwork's price for returned pieces,
-- whose saved price return_artwork clears.
update transactions t
set amount = coalesce(ii.acquired_price_coins, a.price_coins)
from artworks a, inventory_items ii
where a.id = t.artwork_id
  and ii.id = t.inventory_item_id
  and t.type in ('purchase', 'resale')
  and t.created_at >= '2026-09-18'
  and t.amount <> coalesce(ii.acquired_price_coins, a.price_coins);

commit;
