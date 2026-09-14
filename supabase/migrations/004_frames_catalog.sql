-- 004_frames_catalog.sql
-- Phase 1a of the frames migration: move the frame catalog from
-- src/lib/frames.ts into the database.
--
--   * frame_categories  picker tabs, editable without a migration
--   * frames            one row per frame; frame_file is THE key
--   * admin_users       who may write frames/categories/bucket
--   * is_admin()        SECURITY DEFINER lookup reused by every policy
--   * storage bucket    'frames', public read, admin write
--   * backfill          31 rows (30 PNGs + the 'none' sentinel), window_shape null
--   * verification      every artworks.frame_file resolves to exactly one row
--
-- Run once in the Supabase SQL editor (or via supabase db push). The whole
-- file is one transaction: if verification fails, nothing is committed.
--
-- NOTE: the geometry column is named window_shape, not window. WINDOW is a
-- reserved keyword in Postgres (the WINDOW clause of window functions) and
-- cannot be used as a bare column name.
--
-- After it succeeds:
--   1. Grant yourself admin (see the "bootstrap" block near the bottom).
--   2. Upload the PNGs:  SUPABASE_SERVICE_ROLE_KEY=... node scripts/upload-frames.mjs

begin;

-- ---------------------------------------------------------------------------
-- 1. Admin access model
-- ---------------------------------------------------------------------------

-- A dedicated table instead of profiles.is_admin: users can already UPDATE
-- their own profiles row, and Postgres RLS is row-level, not column-level,
-- so a flag on profiles would be self-grantable through PostgREST.
create table if not exists public.admin_users (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

-- Must be SECURITY DEFINER: if this subquery were inlined into another
-- table's policy it would run under admin_users' own RLS and silently
-- return empty for everyone.
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

-- Deliberately NO insert/update/delete policies for anon/authenticated.
-- Grants happen only via the SQL editor / service role.
drop policy if exists "admins can view admin list" on public.admin_users;
create policy "admins can view admin list"
  on public.admin_users for select
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- 2. Shared updated_at trigger
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. frame_categories
-- ---------------------------------------------------------------------------

create table if not exists public.frame_categories (
  slug       text primary key,
  name       text not null,
  sort_order int  not null default 0,
  active     boolean not null default true
);

alter table public.frame_categories enable row level security;

drop policy if exists "frame_categories_read_all" on public.frame_categories;
create policy "frame_categories_read_all"
  on public.frame_categories for select
  using (true);

drop policy if exists "frame_categories_admin_write" on public.frame_categories;
create policy "frame_categories_admin_write"
  on public.frame_categories for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 4. frames
-- ---------------------------------------------------------------------------

create table if not exists public.frames (
  id            uuid primary key default gen_random_uuid(),

  -- THE key. Exact strings from frames.ts, persisted on artworks.frame_file
  -- for 372 live rows. Never rename, never re-ID.
  frame_file    text not null unique,

  -- 'frame' for real frames; 'none' for the single unframed sentinel row.
  kind          text not null default 'frame'
                check (kind in ('frame', 'none')),

  name          text not null,
  category_slug text references public.frame_categories(slug) on update cascade,
  sort_order    int  not null default 0,

  -- Storage object path inside the 'frames' bucket. Equals frame_file at
  -- migration time; kept as its own column so they can diverge later.
  image_path    text,

  -- Window geometry, normalized 0..1 against the PNG's intrinsic size.
  --   { "kind": "rect",    "x", "y", "w", "h", "radius" }
  --   { "kind": "ellipse", "cx", "cy", "rx", "ry" }
  --   { "kind": "polygon", "points": [[x,y], ...] }
  --   { "kind": "path",    "d": "M ... Z" }
  -- Null until Phase 1b traces it.
  window_shape  jsonb
                check (
                  window_shape is null
                  or window_shape->>'kind' in ('rect', 'ellipse', 'polygon', 'path')
                ),

  -- Denormalized from window_shape at save time so nothing at runtime parses
  -- a polygon to size a crop box. { "x", "y", "w", "h" } normalized 0..1.
  bbox          jsonb,

  -- Frame image w/h ratio. Backfilled from frames.ts; recomputed on save.
  aspect        numeric,

  -- Legacy 4-sided window padding from frames.ts (0..1 fractions of the
  -- image). Carried over verbatim; Phase 4 decides whether it survives.
  crop_padding  jsonb,

  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- The sentinel has no image, no category and no window shape; real frames
  -- must have an image and a category.
  constraint frames_kind_shape check (
    (kind = 'none'  and image_path is null and window_shape is null and category_slug is null)
    or
    (kind = 'frame' and image_path is not null and category_slug is not null)
  )
);

create index if not exists frames_category_sort_idx
  on public.frames (category_slug, sort_order);

drop trigger if exists frames_set_updated_at on public.frames;
create trigger frames_set_updated_at
  before update on public.frames
  for each row execute function public.set_updated_at();

alter table public.frames enable row level security;

-- Everyone can read every row, including inactive ones: the resolver must
-- still find a frame that a live artwork references even after it is
-- retired from the picker. The picker filters on kind = 'frame' and active.
drop policy if exists "frames_read_all" on public.frames;
create policy "frames_read_all"
  on public.frames for select
  using (true);

drop policy if exists "frames_admin_write" on public.frames;
create policy "frames_admin_write"
  on public.frames for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 5. Storage bucket 'frames' — public read, admin write
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, allowed_mime_types)
values ('frames', 'frames', true, array['image/png', 'image/webp', 'image/avif'])
on conflict (id) do update
  set public = excluded.public,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "frames bucket public read" on storage.objects;
create policy "frames bucket public read"
  on storage.objects for select
  using (bucket_id = 'frames');

drop policy if exists "frames bucket admin insert" on storage.objects;
create policy "frames bucket admin insert"
  on storage.objects for insert
  with check (bucket_id = 'frames' and public.is_admin());

drop policy if exists "frames bucket admin update" on storage.objects;
create policy "frames bucket admin update"
  on storage.objects for update
  using (bucket_id = 'frames' and public.is_admin())
  with check (bucket_id = 'frames' and public.is_admin());

drop policy if exists "frames bucket admin delete" on storage.objects;
create policy "frames bucket admin delete"
  on storage.objects for delete
  using (bucket_id = 'frames' and public.is_admin());

-- ---------------------------------------------------------------------------
-- 6. Backfill (generated from src/lib/frames.ts — do not hand-edit values)
-- ---------------------------------------------------------------------------

insert into public.frame_categories (slug, name, sort_order) values
  ('classic',  'classic',  1),
  ('polaroid', 'polaroid', 2),
  ('digis',    'digis',    3)
on conflict (slug) do nothing;

insert into public.frames
  (frame_file, kind, name, category_slug, sort_order, image_path, aspect, crop_padding)
values
  ('frame1.png', 'frame', 'Ornate Gold', 'classic', 1, 'frame1.png', 0.750000, '{"top": 0.18, "right": 0.18, "bottom": 0.18, "left": 0.18}'::jsonb),
  ('frame2.png', 'frame', 'Circle Gold', 'classic', 2, 'frame2.png', 1.000000, '{"top": 0.0, "right": 0.0, "bottom": 0.0, "left": 0.0}'::jsonb),
  ('frame3.png', 'frame', 'Thin Ornate', 'classic', 3, 'frame3.png', 0.750000, '{"top": 0.17, "right": 0.16, "bottom": 0.17, "left": 0.16}'::jsonb),
  ('frame4.png', 'frame', 'Simple Gold', 'classic', 4, 'frame4.png', 0.750000, '{"top": 0.13, "right": 0.13, "bottom": 0.13, "left": 0.13}'::jsonb),
  ('frame5.png', 'frame', 'Heart', 'classic', 5, 'frame5.png', 1.000000, '{"top": 0.0, "right": 0.15, "bottom": 0.0, "left": 0.0}'::jsonb),
  ('frame6.png', 'frame', 'Oval Gold', 'classic', 6, 'frame6.png', 0.666667, '{"top": 0.17, "right": 0.21, "bottom": 0.33, "left": 0.21}'::jsonb),
  ('frame7.png', 'frame', 'Silver Square', 'classic', 7, 'frame7.png', 1.000000, '{"top": 0.18, "right": 0.18, "bottom": 0.18, "left": 0.18}'::jsonb),
  ('frame8.png', 'frame', 'Gold Rectangular', 'classic', 8, 'frame8.png', 1.333333, '{"top": 0.1, "right": 0.0, "bottom": 0.1, "left": 0.0}'::jsonb),
  ('polaroid/cherry.png', 'frame', 'Cherry', 'polaroid', 1, 'polaroid/cherry.png', 0.821637, '{"top": 0.088, "right": 0.230, "bottom": 0.228, "left": 0.208}'::jsonb),
  ('polaroid/film.png', 'frame', 'Film', 'polaroid', 2, 'polaroid/film.png', 0.713675, '{"top": 0.193, "right": 0.167, "bottom": 0.161, "left": 0.159}'::jsonb),
  ('polaroid/film1-horizontal.png', 'frame', 'Film 1 Horizontal', 'polaroid', 3, 'polaroid/film1-horizontal.png', 1.161905, '{"top": 0.140, "right": 0.013, "bottom": 0.149, "left": 0.016}'::jsonb),
  ('polaroid/film1.png', 'frame', 'Film 1', 'polaroid', 4, 'polaroid/film1.png', 0.935829, '{"top": 0.175, "right": 0.177, "bottom": 0.207, "left": 0.192}'::jsonb),
  ('polaroid/heart-border.png', 'frame', 'Heart Border', 'polaroid', 5, 'polaroid/heart-border.png', 0.694444, '{"top": 0.062, "right": 0.102, "bottom": 0.062, "left": 0.090}'::jsonb),
  ('polaroid/red-plaid.png', 'frame', 'Red Plaid', 'polaroid', 6, 'polaroid/red-plaid.png', 0.975000, '{"top": 0.208, "right": 0.268, "bottom": 0.312, "left": 0.264}'::jsonb),
  ('polaroid/white-horizontal.png', 'frame', 'White Horizontal', 'polaroid', 7, 'polaroid/white-horizontal.png', 1.229560, '{"top": 0.234, "right": 0.126, "bottom": 0.300, "left": 0.130}'::jsonb),
  ('polaroid/white.png', 'frame', 'White', 'polaroid', 8, 'polaroid/white.png', 0.764516, '{"top": 0.174, "right": 0.290, "bottom": 0.262, "left": 0.288}'::jsonb),
  ('digis/angel-tama.png', 'frame', 'Angel Tama', 'digis', 1, 'digis/angel-tama.png', 0.926136, '{"top": 0.382, "right": 0.358, "bottom": 0.352, "left": 0.350}'::jsonb),
  ('digis/apple-tama.png', 'frame', 'Apple Tama', 'digis', 2, 'digis/apple-tama.png', 1.260753, '{"top": 0.318, "right": 0.448, "bottom": 0.289, "left": 0.146}'::jsonb),
  ('digis/blue-digi.png', 'frame', 'Blue Digi', 'digis', 3, 'digis/blue-digi.png', 1.540000, '{"top": 0.186, "right": 0.327, "bottom": 0.108, "left": 0.076}'::jsonb),
  ('digis/blue-tama.png', 'frame', 'Blue Tama', 'digis', 4, 'digis/blue-tama.png', 0.903158, '{"top": 0.311, "right": 0.289, "bottom": 0.204, "left": 0.238}'::jsonb),
  ('digis/canon-star.png', 'frame', 'Canon Star', 'digis', 5, 'digis/canon-star.png', 1.336427, '{"top": 0.340, "right": 0.463, "bottom": 0.255, "left": 0.116}'::jsonb),
  ('digis/canon-vertical.png', 'frame', 'Canon Vertical', 'digis', 6, 'digis/canon-vertical.png', 0.655642, '{"top": 0.102, "right": 0.353, "bottom": 0.464, "left": 0.210}'::jsonb),
  ('digis/canon.png', 'frame', 'Canon', 'digis', 7, 'digis/canon.png', 1.525223, '{"top": 0.351, "right": 0.464, "bottom": 0.212, "left": 0.102}'::jsonb),
  ('digis/nokia.png', 'frame', 'Nokia', 'digis', 8, 'digis/nokia.png', 0.422572, '{"top": 0.271, "right": 0.166, "bottom": 0.524, "left": 0.141}'::jsonb),
  ('digis/paint.png', 'frame', 'Paint', 'digis', 9, 'digis/paint.png', 1.310078, '{"top": 0.117, "right": 0.049, "bottom": 0.237, "left": 0.155}'::jsonb),
  ('digis/pink-digi.png', 'frame', 'Pink Digi', 'digis', 10, 'digis/pink-digi.png', 1.543860, '{"top": 0.229, "right": 0.343, "bottom": 0.114, "left": 0.090}'::jsonb),
  ('digis/pink-tama.png', 'frame', 'Pink Tama', 'digis', 11, 'digis/pink-tama.png', 0.966102, '{"top": 0.318, "right": 0.436, "bottom": 0.376, "left": 0.268}'::jsonb),
  ('digis/pink2-tama.png', 'frame', 'Pink 2 Tama', 'digis', 12, 'digis/pink2-tama.png', 0.898635, '{"top": 0.355, "right": 0.359, "bottom": 0.242, "left": 0.197}'::jsonb),
  ('digis/plaid-tama.png', 'frame', 'Plaid Tama', 'digis', 13, 'digis/plaid-tama.png', 0.757634, '{"top": 0.304, "right": 0.242, "bottom": 0.279, "left": 0.230}'::jsonb),
  ('digis/retro-tv.png', 'frame', 'Retro TV', 'digis', 14, 'digis/retro-tv.png', 1.515625, '{"top": 0.242, "right": 0.269, "bottom": 0.291, "left": 0.085}'::jsonb),
  ('none', 'none', 'No Frame', null, 0, null, null, null)
on conflict (frame_file) do nothing;

-- ---------------------------------------------------------------------------
-- 7. Verification — every artworks.frame_file must resolve to exactly one row
-- ---------------------------------------------------------------------------

do $$
declare
  v_frames_total   int;
  v_artwork_rows   int;
  v_distinct_keys  int;
  v_null_keys      int;
  v_unresolved     text[];
begin
  select count(*) into v_frames_total from public.frames;

  select count(*), count(distinct frame_file)
    into v_artwork_rows, v_distinct_keys
    from public.artworks
   where frame_file is not null and frame_file <> '';

  -- Null/empty frame_file is not an error: every consumer already falls
  -- back to DEFAULT_FRAME_FILE for falsy values. Reported for visibility.
  select count(*) into v_null_keys
    from public.artworks
   where frame_file is null or frame_file = '';

  select coalesce(array_agg(distinct a.frame_file), '{}')
    into v_unresolved
    from public.artworks a
    left join public.frames f on f.frame_file = a.frame_file
   where a.frame_file is not null and a.frame_file <> ''
     and f.id is null;

  if v_frames_total <> 31 then
    raise exception 'frames backfill: expected 31 rows, found %', v_frames_total;
  end if;

  if array_length(v_unresolved, 1) > 0 then
    raise exception 'frames backfill: % artworks.frame_file value(s) do not resolve: %',
      array_length(v_unresolved, 1), v_unresolved;
  end if;

  raise notice 'frames backfill OK: % frames rows; % artworks rows across % distinct frame_file values all resolve; % rows with null/empty frame_file (fall back to default)',
    v_frames_total, v_artwork_rows, v_distinct_keys, v_null_keys;
end $$;

commit;

-- ---------------------------------------------------------------------------
-- 8. Bootstrap the first admin — run SEPARATELY after confirming the UUID.
--    Resolve by login email rather than pasting a UUID; badartrat and test
--    are test accounts, not the owner.
-- ---------------------------------------------------------------------------
-- insert into public.admin_users (user_id, granted_by)
-- select id, id from auth.users where email = '<your-login-email>'
-- on conflict (user_id) do nothing;
--
-- select u.email, p.handle, a.granted_at
--   from public.admin_users a
--   join auth.users u on u.id = a.user_id
--   left join public.profiles p on p.id = a.user_id;