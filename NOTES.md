# gallery club — Project Log

## Stack
- Next.js 14 App Router + TypeScript
- Supabase (auth + postgres + storage)
- Tailwind CSS
- react-image-crop v11
- react-draggable
- GitHub: github.com/andyblueyo/art-gallery
- Local dev (not yet on Vercel)

## Cost Rules
- Haiku: small single-file fixes
- Sonnet: multi-file features
- Never let Claude push to git
- Add CLAUDE.md to prevent Claude running git commands
- /compact when session hits 70k+ tokens
- Start new session for each new feature

## Database Tables
- profiles (id, handle, display_name, bio, layout_mode)
- artworks (id, title, medium, file_url, frame_file, 
            position_x, position_y, rotation, scale, z_index)
- page_views
- hearts

## Frames
- 8 frames in /public/frames/frame1-8.png
- Config in src/lib/frames.ts
- Each frame has: aspect, shape, innerPadding, selectionScale

## What's Built ✅
- Artist signup/login (Supabase Auth)
- Art upload with frame selection + crop tool
- Public gallery at /[handle]
- Dashboard at /dashboard
- Gallery layout editor:
  - Edit mode toggle on /[handle] for owners
  - Free-form drag with snap-to-grid (20px)
  - Rotate (90° snap + free angle)
  - Resize (scale slider 0.5x-2x)
  - Z-index (bring forward / send back)
  - Save/cancel persists to Supabase
  - Selection box sized per frame via selectionScale
  - Tooltip uses getBoundingClientRect() for accuracy
  - layout_mode: 'auto' | 'custom' in profiles table
  - Mobile: simplified controls

## What's Next 🚧
- Artist profile bubble (bottom left, expands on click)
- Explore page (/explore) — browse all galleries
- Signup/onboarding flow (handle selection after auth)
- Mobile responsive polish
- Dashboard improvements
- Deploy to Vercel