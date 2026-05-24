-- artpenny database schema
-- Run this in your Supabase SQL editor

-- Profiles (extends auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  handle text unique not null,
  display_name text not null default '',
  bio text default '',
  location text default '',
  instagram_url text default '',
  avatar_url text default '',
  view_count int not null default 0,
  created_at timestamptz not null default now()
);

-- Artworks
create table if not exists public.artworks (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default 'Untitled',
  medium text default '',
  description text default '',
  file_url text not null,
  file_type text not null default 'image' check (file_type in ('image', 'pdf')),
  display_order int not null default 0,
  heart_count int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists artworks_artist_id_idx on public.artworks(artist_id);
create index if not exists artworks_display_order_idx on public.artworks(artist_id, display_order);
create index if not exists profiles_handle_idx on public.profiles(handle);

-- Page views (one row per gallery visit)
create table if not exists public.page_views (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.profiles(id) on delete cascade,
  viewed_at timestamptz not null default now()
);

create index if not exists page_views_artist_id_idx on public.page_views(artist_id);

-- Hearts (anonymous fingerprint per artwork)
create table if not exists public.hearts (
  id uuid primary key default gen_random_uuid(),
  artwork_id uuid not null references public.artworks(id) on delete cascade,
  fingerprint text not null,
  created_at timestamptz not null default now(),
  unique (artwork_id, fingerprint)
);

create index if not exists hearts_artwork_id_idx on public.hearts(artwork_id);

-- Bump artwork heart_count when a heart is added
create or replace function public.increment_artwork_heart_count()
returns trigger
language plpgsql
security definer
as $$
begin
  update public.artworks
  set heart_count = heart_count + 1
  where id = new.artwork_id;
  return new;
end;
$$;

drop trigger if exists on_heart_insert on public.hearts;
create trigger on_heart_insert
  after insert on public.hearts
  for each row execute function public.increment_artwork_heart_count();

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.artworks enable row level security;
alter table public.page_views enable row level security;
alter table public.hearts enable row level security;

-- Profiles
drop policy if exists "Profiles are viewable by everyone" on public.profiles;
create policy "Profiles are viewable by everyone"
  on public.profiles for select using (true);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles for insert with check (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update using (auth.uid() = id);

-- Artworks
drop policy if exists "Artworks are viewable by everyone" on public.artworks;
create policy "public can view artworks"
  on public.artworks for select using (true);

drop policy if exists "Artists can insert their own artworks" on public.artworks;
drop policy if exists "Artists can update their own artworks" on public.artworks;
drop policy if exists "Artists can delete their own artworks" on public.artworks;
drop policy if exists "artists manage own artworks" on public.artworks;

create policy "artists manage own artworks"
  on public.artworks for all using (auth.uid() = artist_id);

-- Page views
drop policy if exists "anyone can record page views" on public.page_views;
create policy "anyone can record page views"
  on public.page_views for insert with check (true);

drop policy if exists "owners can read own page views" on public.page_views;
create policy "owners can read own page views"
  on public.page_views for select using (auth.uid() = artist_id);

-- Hearts
drop policy if exists "anyone can view hearts" on public.hearts;
create policy "anyone can view hearts"
  on public.hearts for select using (true);

drop policy if exists "anyone can add hearts" on public.hearts;
create policy "anyone can add hearts"
  on public.hearts for insert with check (true);

-- Legacy view counter on profiles (optional)
create or replace function public.increment_gallery_views(profile_handle text)
returns void
language plpgsql
security definer
as $$
begin
  update public.profiles
  set view_count = view_count + 1
  where handle = profile_handle;
end;
$$;

-- Storage: create buckets in Supabase dashboard
-- insert into storage.buckets (id, name, public) values ('artworks', 'artworks', true);
-- insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true);

-- Storage policies (artworks bucket)
-- create policy "Anyone can view artworks storage"
--   on storage.objects for select using (bucket_id = 'artworks');
-- create policy "Artists upload own artworks"
--   on storage.objects for insert with check (
--     bucket_id = 'artworks' and auth.uid()::text = (storage.foldername(name))[1]
--   );
-- create policy "Artists update own artworks storage"
--   on storage.objects for update using (
--     bucket_id = 'artworks' and auth.uid()::text = (storage.foldername(name))[1]
--   );
-- create policy "Artists delete own artworks storage"
--   on storage.objects for delete using (
--     bucket_id = 'artworks' and auth.uid()::text = (storage.foldername(name))[1]
--   );

-- Storage policies (avatars bucket)
-- create policy "Anyone can view avatars"
--   on storage.objects for select using (bucket_id = 'avatars');
-- create policy "Users upload own avatar"
--   on storage.objects for insert with check (
--     bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]
--   );
-- create policy "Users update own avatar"
--   on storage.objects for update using (
--     bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]
--   );
-- create policy "Users delete own avatar"
--   on storage.objects for delete using (
--     bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]
--   );
