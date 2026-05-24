-- Run if you already applied an older schema.sql without these tables/columns

alter table public.artworks
  add column if not exists heart_count int not null default 0;

create table if not exists public.page_views (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.profiles(id) on delete cascade,
  viewed_at timestamptz not null default now()
);

create table if not exists public.hearts (
  id uuid primary key default gen_random_uuid(),
  artwork_id uuid not null references public.artworks(id) on delete cascade,
  fingerprint text not null,
  created_at timestamptz not null default now(),
  unique (artwork_id, fingerprint)
);

alter table public.page_views enable row level security;
alter table public.hearts enable row level security;
