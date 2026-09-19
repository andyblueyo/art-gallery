-- artpenny database schema
--
-- Snapshot of the live database, taken from pg_catalog on 2026-09-19.
-- This is for building a fresh Supabase project. Do not run it against the
-- live database: change that through supabase/migrations/, then update this
-- file to match.
--
-- Extensions used (enabled by default on Supabase): pgcrypto, uuid-ossp,
-- pg_stat_statements, supabase_vault. No views, custom types or realtime
-- publications.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- Profiles (extends auth.users). Rows are inserted by the client on signup.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  handle text not null unique,
  display_name text,
  bio text,
  location text,
  instagram_url text,
  avatar_url text,
  created_at timestamptz default now(),
  layout_mode text default 'auto',
  coin_balance integer not null default 25,
  tier text not null default 'standard',
  venmo_handle text,
  cashapp_handle text,
  kofi_handle text,
  patreon_handle text,
  paypal_handle text,
  buymeacoffee_handle text
);

create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now()
);

create table public.artworks (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid references public.profiles(id) on delete cascade,
  title text not null,
  medium text,
  file_url text not null,
  file_type text default 'image',
  heart_count integer default 0,
  created_at timestamptz default now(),
  description text,
  frame_file text default 'frame1.png',
  for_sale boolean not null default false,
  price_coins integer,
  edition_total integer default 1,
  editions_remaining integer default 1,
  deleted_at timestamptz,
  constraint edition_total_max check (edition_total <= 10)
);

create table public.frame_categories (
  slug text primary key,
  name text not null,
  sort_order integer not null default 0,
  active boolean not null default true
);

create table public.frames (
  id uuid primary key default gen_random_uuid(),
  frame_file text not null unique,
  kind text not null default 'frame' check (kind in ('frame', 'none')),
  name text not null,
  category_slug text references public.frame_categories(slug) on update cascade,
  sort_order integer not null default 0,
  image_path text,
  window_shape jsonb check (
    window_shape is null
    or window_shape ->> 'kind' in ('rect', 'ellipse', 'polygon', 'path')
  ),
  bbox jsonb,
  aspect numeric,
  crop_padding jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  image_width integer,
  image_height integer,
  constraint frames_kind_shape check (
    (kind = 'none' and image_path is null and window_shape is null and category_slug is null)
    or (kind = 'frame' and image_path is not null and category_slug is not null)
  )
);

create index frames_category_sort_idx on public.frames (category_slug, sort_order);

create table public.galleries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  display_order integer not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  slug text,
  background_type text not null default 'color' check (background_type in ('color', 'image')),
  background_color text not null default '#e8ddd0',
  background_image_url text,
  background_image_mode text check (background_image_mode in ('cover', 'tile'))
);

-- One row per owned edition. Edition 0 is the artist's own copy.
create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  owned_by uuid not null references public.profiles(id),
  artwork_id uuid not null references public.artworks(id) on delete cascade,
  edition_number integer not null,
  acquired_from uuid references public.profiles(id),
  listed_for_sale boolean not null default false,
  resale_price_coins integer,
  acquired_at timestamptz not null default now(),
  acquired_price_coins integer,
  deleted_at timestamptz,
  constraint uq_artwork_edition unique (artwork_id, edition_number)
);

create table public.gallery_pieces (
  id uuid primary key default gen_random_uuid(),
  gallery_id uuid not null references public.galleries(id) on delete cascade,
  inventory_item_id uuid not null unique references public.inventory_items(id) on delete cascade,
  position_x double precision,
  position_y double precision,
  rotation double precision,
  scale double precision,
  z_index integer
);

-- Written only through record_gallery_view()
create table public.gallery_views (
  id uuid primary key default gen_random_uuid(),
  gallery_id uuid not null references public.galleries(id) on delete cascade,
  viewer_id uuid references public.profiles(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  visitor_key uuid
);

create index gallery_views_gallery_id_idx on public.gallery_views (gallery_id);
create index gallery_views_gallery_viewed_idx on public.gallery_views (gallery_id, viewed_at);

create table public.hearts (
  id uuid primary key default gen_random_uuid(),
  piece_id uuid not null references public.artworks(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (piece_id, user_id)
);

create index hearts_piece_id_idx on public.hearts (piece_id);
create index hearts_user_id_idx on public.hearts (user_id);

-- Written only by the security definer functions below
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references public.profiles(id),
  to_user uuid not null references public.profiles(id),
  amount integer not null,
  type text not null check (type in (
    'purchase', 'resale', 'artist_cut', 'donation',
    'signup_bonus', 'artist_deletion_refund', 'return'
  )),
  artwork_id uuid references public.artworks(id),
  inventory_item_id uuid references public.inventory_items(id),
  edition_number integer,
  created_at timestamptz not null default now(),
  artwork_title text,
  artwork_image_url text
);

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users where user_id = auth.uid()
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated, service_role;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.create_primary_gallery()
returns trigger
language plpgsql
security definer
as $$
BEGIN
  INSERT INTO galleries (user_id, name, is_primary, display_order)
  VALUES (NEW.id, 'My Gallery', true, 0);
  RETURN NEW;
END;
$$;

create or replace function public.increment_artwork_heart_count()
returns trigger
language plpgsql
security definer
as $$
begin
  update public.artworks set heart_count = heart_count + 1 where id = new.piece_id;
  return new;
end;
$$;

create or replace function public.decrement_artwork_heart_count()
returns trigger
language plpgsql
security definer
as $$
begin
  update public.artworks set heart_count = greatest(0, heart_count - 1) where id = old.piece_id;
  return old;
end;
$$;

create or replace function public.get_gallery_pieces(p_gallery_id uuid)
returns json
language sql
security definer
as $$
  SELECT json_agg(row_to_json(t))
  FROM (
    SELECT
      gp.id, gp.gallery_id, gp.inventory_item_id,
      gp.position_x, gp.position_y, gp.rotation, gp.scale, gp.z_index,
      json_build_object(
        'id', ii.id,
        'owned_by', ii.owned_by,
        'artwork_id', ii.artwork_id,
        'edition_number', ii.edition_number,
        'artwork', json_build_object(
          'id', a.id,
          'artist_id', a.artist_id,
          'artist_display_name', ap.display_name,
          'artist_handle', ap.handle,
          'title', a.title,
          'medium', a.medium,
          'description', a.description,
          'file_url', a.file_url,
          'file_type', a.file_type,
          'frame_file', a.frame_file,
          'heart_count', a.heart_count,
          'created_at', a.created_at,
          'for_sale', a.for_sale,
          'price_coins', a.price_coins,
          'edition_total', a.edition_total,
          'editions_remaining', a.editions_remaining
        )
      ) as inventory_item
    FROM gallery_pieces gp
    JOIN inventory_items ii ON ii.id = gp.inventory_item_id
    JOIN artworks a ON a.id = ii.artwork_id
    JOIN profiles ap ON ap.id = a.artist_id
    WHERE gp.gallery_id = p_gallery_id
      AND a.deleted_at IS NULL
      AND ii.deleted_at IS NULL
  ) t
$$;

create or replace function public.record_gallery_view(
  p_gallery_id uuid,
  p_visitor_key uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_viewer uuid := auth.uid();
  v_owner uuid;
begin
  select user_id into v_owner from public.galleries where id = p_gallery_id;
  if v_owner is null or v_owner = v_viewer then
    return;
  end if;

  -- Serialize concurrent calls for the same visitor so the dedupe check can't race
  perform pg_advisory_xact_lock(
    hashtextextended(p_gallery_id::text || coalesce(v_viewer, p_visitor_key)::text, 0)
  );

  if exists (
    select 1 from public.gallery_views
    where gallery_id = p_gallery_id
      and viewed_at > now() - interval '30 minutes'
      and case
            when v_viewer is not null then viewer_id = v_viewer
            else viewer_id is null and visitor_key = p_visitor_key
          end
  ) then
    return;
  end if;

  insert into public.gallery_views (gallery_id, viewer_id, visitor_key)
  values (p_gallery_id, v_viewer, p_visitor_key);
end;
$$;

grant execute on function public.record_gallery_view(uuid, uuid) to anon, authenticated;

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

create or replace function public.return_artwork(p_inventory_item uuid)
returns void
language plpgsql
security definer
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
$$;

-- NOTE: inserts type 'removal', which transactions_type_check does not allow,
-- so this fails whenever a collector owns an edition of the artwork.
create or replace function public.remove_artwork(p_artwork_id uuid)
returns void
language plpgsql
security definer
as $$
DECLARE
  v_artist_id         UUID;
  v_artwork_title     TEXT;
  v_artwork_image_url TEXT;
  v_item              RECORD;
BEGIN
  SELECT artist_id, title, file_url
  INTO v_artist_id, v_artwork_title, v_artwork_image_url
  FROM artworks
  WHERE id = p_artwork_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Artwork not found';
  END IF;

  IF v_artist_id != auth.uid() THEN
    RAISE EXCEPTION 'Only the artist can remove this artwork';
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

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create trigger on_profile_created
  after insert on public.profiles
  for each row execute function public.create_primary_gallery();

create trigger frames_set_updated_at
  before update on public.frames
  for each row execute function public.set_updated_at();

create trigger on_heart_insert
  after insert on public.hearts
  for each row execute function public.increment_artwork_heart_count();

create trigger on_heart_delete
  after delete on public.hearts
  for each row execute function public.decrement_artwork_heart_count();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.admin_users enable row level security;
alter table public.artworks enable row level security;
alter table public.frame_categories enable row level security;
alter table public.frames enable row level security;
alter table public.galleries enable row level security;
alter table public.inventory_items enable row level security;
alter table public.gallery_pieces enable row level security;
alter table public.gallery_views enable row level security;
alter table public.hearts enable row level security;
alter table public.transactions enable row level security;

-- Profiles
create policy "public can view profiles"
  on public.profiles for select using (true);

create policy "owners can update profile"
  on public.profiles for all using (auth.uid() = id);

-- Admin users (granted only via the SQL editor / service role)
create policy "admins can view admin list"
  on public.admin_users for select using (public.is_admin());

-- Artworks (the two select and two write policies overlap; both pairs exist live)
create policy "public can view artworks"
  on public.artworks for select using (true);

create policy "artworks_read_all"
  on public.artworks for select using (true);

create policy "artists manage own artworks"
  on public.artworks for all using (auth.uid() = artist_id);

create policy "artworks_write_own"
  on public.artworks for all
  using (artist_id = auth.uid())
  with check (artist_id = auth.uid());

-- Frames catalog
create policy "frame_categories_read_all"
  on public.frame_categories for select using (true);

create policy "frame_categories_admin_write"
  on public.frame_categories for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "frames_read_all"
  on public.frames for select using (true);

create policy "frames_admin_write"
  on public.frames for all
  using (public.is_admin())
  with check (public.is_admin());

-- Galleries
create policy "galleries_read_all"
  on public.galleries for select using (true);

create policy "galleries_write_own"
  on public.galleries for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Inventory
create policy "inventory_items_read"
  on public.inventory_items for select
  using (
    owned_by = auth.uid()
    or listed_for_sale = true
    or exists (
      select 1
      from public.gallery_pieces gp
      join public.galleries g on g.id = gp.gallery_id
      where gp.inventory_item_id = inventory_items.id
    )
  );

create policy "inventory_items_write"
  on public.inventory_items for all
  using (owned_by = auth.uid())
  with check (owned_by = auth.uid());

-- Gallery pieces
create policy "gallery_pieces_read_all"
  on public.gallery_pieces for select using (true);

create policy "gallery_pieces_write_own"
  on public.gallery_pieces for all
  using (
    exists (
      select 1 from public.galleries
      where galleries.id = gallery_pieces.gallery_id
        and galleries.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.galleries
      where galleries.id = gallery_pieces.gallery_id
        and galleries.user_id = auth.uid()
    )
  );

-- Gallery views (no insert policy: record_gallery_view() is the only writer)
create policy "gallery owners can read their views"
  on public.gallery_views for select
  using (
    exists (
      select 1 from public.galleries g
      where g.id = gallery_views.gallery_id
        and g.user_id = auth.uid()
    )
  );

-- Hearts
create policy "users can view own hearts"
  on public.hearts for select using (auth.uid() = user_id);

create policy "piece owners can view hearts on own pieces"
  on public.hearts for select
  using (
    exists (
      select 1 from public.artworks
      where artworks.id = hearts.piece_id
        and artworks.artist_id = auth.uid()
    )
  );

create policy "users can insert own hearts"
  on public.hearts for insert with check (auth.uid() = user_id);

create policy "users can delete own hearts"
  on public.hearts for delete using (auth.uid() = user_id);

-- Transactions (read-only from the client)
create policy "transactions_read_own"
  on public.transactions for select
  using (from_user = auth.uid() or to_user = auth.uid());

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, allowed_mime_types) values
  ('artworks', 'artworks', true, null),
  ('avatars', 'avatars', true, array['image/*']),
  ('frames', 'frames', true, array['image/png', 'image/webp', 'image/avif']);

-- artworks bucket
create policy "public can view files"
  on storage.objects for select using (bucket_id = 'artworks');

create policy "anyone can upload"
  on storage.objects for insert with check (bucket_id = 'artworks');

create policy "Users can update their own artworks"
  on storage.objects for update to authenticated
  using (bucket_id = 'artworks' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'artworks' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "owners can delete"
  on storage.objects for delete
  using (bucket_id = 'artworks' and auth.uid()::text = (storage.foldername(name))[1]);

-- avatars bucket
create policy "Avatars are publicly viewable"
  on storage.objects for select using (bucket_id = 'avatars');

create policy "Users can upload their own avatar"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can update their own avatar"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- frames bucket
create policy "frames bucket public read"
  on storage.objects for select using (bucket_id = 'frames');

create policy "frames bucket admin insert"
  on storage.objects for insert
  with check (bucket_id = 'frames' and public.is_admin());

create policy "frames bucket admin update"
  on storage.objects for update
  using (bucket_id = 'frames' and public.is_admin())
  with check (bucket_id = 'frames' and public.is_admin());

create policy "frames bucket admin delete"
  on storage.objects for delete
  using (bucket_id = 'frames' and public.is_admin());
