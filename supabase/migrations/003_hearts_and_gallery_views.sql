-- Migration 003: Replace hearts (fingerprint→user_id) + add gallery_views

-- 1. Drop old hearts table and triggers
drop trigger if exists on_heart_insert on public.hearts;
drop function if exists public.increment_artwork_heart_count();
drop table if exists public.hearts;

-- 2. Recreate hearts with user_id
create table public.hearts (
  id uuid primary key default gen_random_uuid(),
  piece_id uuid not null references public.artworks(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(piece_id, user_id)
);

create index if not exists hearts_piece_id_idx on public.hearts(piece_id);
create index if not exists hearts_user_id_idx on public.hearts(user_id);

-- 3. Increment / decrement triggers
create or replace function public.increment_artwork_heart_count()
returns trigger language plpgsql security definer as $$
begin
  update public.artworks set heart_count = heart_count + 1 where id = new.piece_id;
  return new;
end;
$$;

create or replace function public.decrement_artwork_heart_count()
returns trigger language plpgsql security definer as $$
begin
  update public.artworks set heart_count = greatest(0, heart_count - 1) where id = old.piece_id;
  return old;
end;
$$;

create trigger on_heart_insert
  after insert on public.hearts
  for each row execute function public.increment_artwork_heart_count();

create trigger on_heart_delete
  after delete on public.hearts
  for each row execute function public.decrement_artwork_heart_count();

-- 4. RLS on hearts
alter table public.hearts enable row level security;

-- Authenticated users can insert their own heart only
create policy "users can insert own hearts"
  on public.hearts for insert
  with check (auth.uid() = user_id);

-- Users can delete their own heart
create policy "users can delete own hearts"
  on public.hearts for delete
  using (auth.uid() = user_id);

-- Users can check if they've hearted (RLS auto-filters to their own rows)
create policy "users can view own hearts"
  on public.hearts for select
  using (auth.uid() = user_id);

-- Piece owners can see all hearts on pieces they own
create policy "piece owners can view hearts on own pieces"
  on public.hearts for select
  using (
    exists (
      select 1 from public.artworks
      where artworks.id = hearts.piece_id
        and artworks.artist_id = auth.uid()
    )
  );

-- 5. gallery_views table (gallery_id references profiles, since profiles ARE galleries)
create table if not exists public.gallery_views (
  id uuid primary key default gen_random_uuid(),
  gallery_id uuid not null references public.profiles(id) on delete cascade,
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  viewed_at timestamptz not null default now()
);

create index if not exists gallery_views_gallery_id_idx on public.gallery_views(gallery_id);

-- 6. RLS on gallery_views
alter table public.gallery_views enable row level security;

-- Authenticated non-owner visitors can insert a view row
create policy "authenticated users can insert gallery views"
  on public.gallery_views for insert
  with check (auth.uid() = viewer_id);

-- Gallery owners can read their own view counts
create policy "gallery owners can view their counts"
  on public.gallery_views for select
  using (auth.uid() = gallery_id);

-- Reset artworks heart_count to 0 (old fingerprint hearts are gone)
update public.artworks set heart_count = 0;
