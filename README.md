# artpenny

Free portfolio galleries for human-made art. Artists get a beautiful shareable page at `artpenny.com/[handle]`.

## Stack

- Next.js 14 (App Router)
- Supabase (auth, Postgres, storage)
- Tailwind CSS
- TypeScript

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Environment variables**

   Copy `.env.local.example` to `.env.local` and add your Supabase credentials:

   ```
   NEXT_PUBLIC_SUPABASE_URL=your_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
   ```

3. **Database**

   Run `supabase/schema.sql` in the Supabase SQL editor (or `supabase/migrations/20250524_dashboard.sql` if upgrading).

   Create **public** storage buckets:
   - `artworks` — piece uploads (`[user_id]/[uuid].jpg`)
   - `avatars` — profile photos

   Apply the storage policies commented at the bottom of `schema.sql`.

4. **Run locally**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Demo gallery (no Supabase)

Without env vars, visit **[http://localhost:3000/maya-lin](http://localhost:3000/maya-lin)** to see the public gallery page with sample data.

## Project structure

```
src/
├── app/
│   ├── [handle]/          # Public gallery (core product)
│   ├── page.tsx           # Homepage
│   ├── signup/ login/     # Auth
│   └── dashboard/       # Artist dashboard (protected)
├── components/
│   ├── dashboard/       # Upload, profile editor, piece cards
│   ├── gallery/           # Salon wall, frames, see-all grid
│   ├── layout/            # Wordmark, footer
│   └── ui/                # Badge, share, heart
└── lib/
    ├── supabase/          # Client, server, middleware
    ├── data.ts            # Data fetching
    └── demo-data.ts       # Sample gallery for dev
```

## What's built

- [x] Project scaffold + Supabase client setup
- [x] `/[handle]` public gallery (wall view, grid, about, hearts, share)
- [ ] Signup / login / handle selection
- [ ] Dashboard (upload, edit, delete)
- [ ] Homepage polish, explore page

## Design tokens

| Token    | Value     |
| -------- | --------- |
| Cream bg | `#f5f0e8` |
| Text     | `#2a2018` |
| Gold     | `#8B6914` |
