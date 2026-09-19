-- Migration 017: you can only hang editions you own, and a sale takes the edition off the seller's walls
--
-- Live state before this (dumped 2026-09-19): "gallery_pieces_write_own" was
-- FOR ALL and only checked that the gallery belonged to the caller, never the
-- edition. inventory_item_id is unique, so anyone could hang someone else's
-- edition and block its owner from hanging it (the owner can't delete a row
-- on someone else's wall, and the editor's upsert on inventory_item_id fails).
--
-- transfer_coins also left the sold edition's gallery_pieces row in place,
-- unlike return_artwork and remove_artwork, so a buyer could be blocked the
-- same way by the seller's wall.
--
-- Checked 2026-09-19: no existing placement where the gallery owner doesn't
-- own the edition, so no data cleanup.

begin;

-- USING (existing rows): the gallery is yours, so you can still move or take
-- down anything on your walls. WITH CHECK (new/updated rows): the gallery is
-- yours AND you own the edition.
drop policy if exists "gallery_pieces_write_own" on public.gallery_pieces;

create policy "gallery_pieces_write_own"
  on public.gallery_pieces for all
  using (
    exists (
      select 1 from public.galleries g
      where g.id = gallery_pieces.gallery_id
        and g.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.galleries g
      where g.id = gallery_pieces.gallery_id
        and g.user_id = auth.uid()
    )
    and exists (
      select 1 from public.inventory_items ii
      where ii.id = gallery_pieces.inventory_item_id
        and ii.owned_by = auth.uid()
        and ii.deleted_at is null
    )
  );

-- Same body as live, plus the gallery_pieces delete after the ownership change
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

  -- Take it off the seller's walls so the buyer can hang it
  delete from gallery_pieces
  where inventory_item_id = p_inventory_item;

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

commit;
