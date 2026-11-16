# Gallery Club — Codebase Audit (Phase 1, read-only)

Date: 2026-09-28. Scope: everything under `src/`, `supabase/`, `scripts/`, config, and docs. Truth source for the database is `supabase/schema.sql` (live dump from 2026-09-19); migrations were compared against it. No files were modified other than this one.

Checks run: `npx tsc --noEmit` (clean), `npx next lint` (7 `no-img-element` warnings only), `npm audit` (1 critical, 8 high, 1 moderate, 1 low), `git log -p` scan for keys (none; `.env.local` never committed), and three parallel deep reviews of the wall/editor, dashboard/explore, and frames/SQL areas whose findings are folded in below.

Confidence key: **confirmed** = code path traced end to end; **suspected** = plausible from the code but depends on runtime state I can't see (live DB, Vercel, Supabase Auth settings).

---

## 1. Architecture (10 lines)

1. **Routing.** Next 14 App Router. Public galleries live at `src/app/[handle]/page.tsx`; `src/middleware.ts` rewrites `<handle>.galleryclub.online/<path>` (and `<handle>.localhost:3000`) to `/<handle><path>`. Apex routes: `/`, `/explore`, `/login`, `/signup`, `/dashboard`, `/admin/frames`, `/terms`, `/privacy`.
2. **Auth.** Supabase Auth through `@supabase/ssr`; cookies are set with `domain=.galleryclub.online` in prod so every subdomain shares the session. Middleware only refreshes tokens and bounces signed-in users off `/login|/signup`; the `/dashboard` guard is commented out, so protection lives in the server components (`dashboard/page.tsx`, `admin/layout.tsx`) and inside each server action.
3. **Login/signup are client-side** in `AuthForm.tsx` (`signInWithPassword`, then `signUp` + a direct `profiles` insert). The server action in `src/app/login/actions.tsx` is imported but never called, contrary to CLAUDE.md.
4. **Server-side reads** use the cookie-bound client (`lib/supabase/server.ts` → `lib/data.ts`, `[handle]/page.tsx`). The explore directory and frame catalog use a cookie-free anon client inside `unstable_cache` (60 s and 1 h + tag respectively). Everything else on a gallery page is per-request and uncached.
5. **Client-side reads/writes** go straight to PostgREST with the anon key + user JWT: hearts, dashboard lists, artwork metadata, for-sale toggles, layout saves, profile edits, uploads. RLS plus column grants (migrations 013/014/018) are the only guard.
6. **Money and editions** change only inside `SECURITY DEFINER` functions (`transfer_coins`, `return_artwork`, `remove_artwork`) that derive the actor from `auth.uid()`; `collect.ts`/`return-artwork.ts` server actions and `ArtworkCard.tsx` call them.
7. **Upload flow.** `UploadZone.tsx`: pick → frame → crop → canvas re-encode to WebP ≤2000 px (PDFs raw) → `storage.artworks/<uid>/<uuid>.<ext>` → insert `artworks` (RLS checks the URL is in the user's folder) → N sequential `inventory_items` inserts for editions 0..N. Avatars and wall backgrounds are uploaded raw. Display goes through Supabase image transforms (`lib/artwork-image.ts`).
8. **Wall rendering.** `GallerySalonWall.tsx` (952 lines) picks custom canvas (`gallery_pieces` via `get_gallery_pieces` RPC), auto grid, or mobile column; `GalleryEditorCanvas.tsx` (843 lines) handles drag/save; `FramedArtwork.tsx` composes frame PNG + art.
9. **Admin.** `admin_users` + `is_admin()`; frames catalog and `frames` bucket are admin-write via RLS; server actions re-check `is_admin()`.
10. **Deploy.** Vercel. App code reads only `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`. The service-role key appears only in `scripts/upload-frames.mjs` via `process.env` (correct). No `headers()` in `next.config.mjs`, so no security headers of our own.

---

## 2. Findings

### CRITICAL

**C1. Next.js 14.2.21 carries unpatched advisories, and the image optimizer accepts any `*.supabase.co` host**
- `package.json:16`, `next.config.mjs:4-8`
- `npm audit` lists 30+ advisories against `next@14.2.21`. Several have a 14.x fix (`14.2.25` middleware auth bypass GHSA-f82v-jwr5-mffw, `14.2.32` middleware SSRF GHSA-4342-x723-ch2f, `14.2.35` RSC DoS), but the newest have **no 14.x patch at all**: unauthenticated RCE in Image Optimization via AVIF (GHSA-2xp9-vwfh-vxw4, fixed only in 15.5.24 / 16.3.3, CVSS 9.5), Server Action endpoint disclosure (GHSA-955p-x3mx-jcvp, 15.5.21), RSC cache poisoning, request-body cache confusion, and others fixed only in 15.5.x. The 14.x line is effectively end-of-life.
- `remotePatterns` uses `hostname: "**.supabase.co"`, so `/_next/image?url=https://<anyone-elses-project>.supabase.co/...` is accepted. That turns the optimizer into a free proxy for arbitrary Supabase-hosted files and is exactly the input path the AVIF advisory needs. Our own `avatars` bucket also allows `image/*` (AVIF included).
- Why it matters: this is the only finding where an unauthenticated stranger might get code execution or poison cached responses. Whether Vercel's hosted optimizer is patched platform-side is unknown to me, so exploitability on Vercel is **suspected**; presence of the vulnerable version is **confirmed**.
- Fix: upgrade to Next ≥15.5.24 (or ≥16.3.3) and `eslint-config-next` to match — this is a dependency change and needs your go-ahead; expect `params`/`cookies()` to become async in 15. Independently and immediately: set `remotePatterns[0].hostname` to the exact project host (`<project-ref>.supabase.co`) and drop `images.unsplash.com`/`picsum.photos` (demo only).
- Confidence: confirmed (version + config), suspected (live exploitability).

### HIGH

**H1. `profiles.handle` is browser-writable with no database constraint, and it is interpolated into links on other people's walls**
- `supabase/schema.sql:19` (plain `text unique`, case-sensitive), `:700-703` (`handle` in the authenticated UPDATE grant); `src/lib/handle.ts:1-24` (client-only validation; reserved list lacks `terms`, `privacy`, and common squat words); `GallerySalonWall.tsx:654-659, 677` (`https://${artistHandle}.galleryclub.online`, then `window.location.href = href` on double-tap); `GalleryPieceCard.tsx:71-77`; `MyCollection.tsx:85`; `src/app/page.tsx:79`.
- Any signed-in user can `PATCH /rest/v1/profiles?id=eq.<me> {"handle":"evil.com/#"}` with the anon key. Every collector who hangs one of that artist's pieces then renders `<a href="https://evil.com/#.galleryclub.online">` and phones navigate to it on double-tap: phishing from a trusted domain. The same hole allows `Admin`/`Terms`/`WWW` (case-insensitive squatting; the unique index is case-sensitive so `Alice` and `alice` coexist and `Alice` is unreachable), spaces/unicode (breaks subdomain routing), and impersonating apex routes (`terms.galleryclub.online` currently rewrites to `/terms`, so a `terms` handle would shadow the ToS page).
- Fix: migration adding `check (handle ~ '^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$')` plus a reserved-words check (or a `before insert/update` trigger that also lowercases), and `create unique index on profiles (lower(handle))`. In code: `linkHrefFor` and every gallery-URL builder must return `null` unless the handle matches `HANDLE_REGEX`; add `terms`, `privacy`, `mail`, `support`, `help`, `status`, `about`, `blog`, `galleryclub`, `official`, `staff`, `security` to `RESERVED_HANDLES`. Before writing the migration: a query for handles that would violate the check.
- Confidence: confirmed.

**H2. The `artworks` insert policy's `file_url` check is an unanchored `LIKE`, so `file_url` may point at any host**
- `supabase/schema.sql:721`: `file_url like '%/storage/v1/object/public/artworks/' || auth.uid()::text || '/%'`.
- `https://attacker.example/x?p=/storage/v1/object/public/artworks/<my-uid>/y` passes. The wall then loads art from the attacker's server (visitor IP/UA logging on every gallery that hangs the piece), the attacker can swap content at will after selling editions (defeating the intent of migration 018), and `artworkImageUrl()` rewrites it to `attacker.example/storage/v1/render/...`, so the transform path is also attacker-controlled.
- Fix: anchor the pattern to the project URL, e.g. `file_url like 'https://<project-ref>.supabase.co/storage/v1/object/public/artworks/' || auth.uid()::text || '/%'`; longer term store the storage *path* and build URLs server-side. Check first: `select count(*) from artworks where file_url not like 'https://<project-ref>.supabase.co/%'`.
- Confidence: confirmed.

**H3. Storage UPDATE policy lets an artist overwrite the bytes behind a sold edition**
- `supabase/schema.sql:898-901` ("Users can update their own artworks" on `storage.objects`).
- Migration 018 locked `file_url` after insert so a sold image can't be swapped, but the object at that URL can still be replaced with `upload(path, blob, { upsert: true })`. Nothing in `src/` needs this policy: `UploadZone.tsx:324` uses `upsert: false`, and `GallerySettingsPanel.tsx:148-152` uses timestamped names so its `upsert: true` never updates. (The CDN cache masks the swap for a while, which makes it worse, not better.)
- Fix: `drop policy "Users can update their own artworks" on storage.objects;` (or restrict it to the `gallery-backgrounds/` prefix). Consider the same for `avatars` only if avatars stop using `upsert`.
- Confidence: confirmed.

**H4. Signup is two non-atomic steps; any failure orphans an auth user who can then never log in**
- `src/components/auth/AuthForm.tsx:80-109` (check handle → `auth.signUp` → `profiles.insert`), `src/app/dashboard/page.tsx:45-70` (`!profile → redirect("/signup")`).
- The handle check is a TOCTOU race (two signups with the same handle both pass, the second insert hits the unique index). If Supabase email confirmation is on, `signUp` returns a user but no session, so the insert runs as `anon` and RLS rejects it. Network blips do the same. In every case the `auth.users` row exists, the `profiles` row doesn't, `/dashboard` redirects to `/signup`, and re-signing up fails with "already registered". There is no self-heal path. (`src/app/page.tsx:79` then renders `https://undefined.galleryclub.online` for such a user.)
- Fix: create the profile in the database — an `after insert on auth.users` trigger reading `raw_user_meta_data->>'handle'`/`display_name` (pass them via `signUp({ options: { data } })`), with the H1 constraint doing validation — or move signup into a server action that does both and deletes the auth user on profile failure. Add a "finish setting up your gallery" state in `dashboard/page.tsx` for `user && !profile`. Check first: `select count(*) from auth.users u left join profiles p on p.id = u.id where p.id is null`.
- Confidence: confirmed (flow), suspected (how often it fires).

**H5. The for-sale toggle is two browser writes that can diverge, and it silently wipes the price**
- `src/components/dashboard/ArtworkCard.tsx:81-106` (artworks then inventory_items; second result discarded), `:84, 90, 109` (`priceCoins` is stored as a string, so `typeof priceCoins === "number"` is false after typing and `price_coins: null` is written).
- The public wall shows "Collect" from `artworks.for_sale && price_coins` (`GallerySalonWall.tsx:136, 686`), collectable items come from `inventory_items.listed_for_sale` (`[handle]/page.tsx:91`), and `transfer_coins` checks `listed_for_sale` + `price_coins`. If the second write fails on un-listing, editions the artist believes withdrawn are still buyable by a direct RPC call. Toggling on after typing a price lists editions with `price_coins = null` ("no price set" for every buyer).
- Fix: one `SECURITY DEFINER` RPC `set_artwork_for_sale(p_artwork_id, p_for_sale, p_price)` that validates `p_price >= 1` when listing and updates both tables in one transaction; then revoke the `inventory_items` UPDATE grant from `authenticated`.
- Confidence: confirmed.

**H6. Upload creates edition rows with N sequential inserts and no transaction; this has already corrupted 9 live artworks**
- `src/components/dashboard/UploadZone.tsx:365-384`; `supabase/migrations/019_backfill_missing_editions.sql:3-7` documents the fallout.
- A dropped request mid-loop leaves `editions_remaining = N` with fewer than N rows; the missing edition can never be sold. The user only sees "contact support".
- Fix: create editions in the database — `after insert on artworks` trigger (SECURITY DEFINER) inserting `generate_series(0, new.edition_total)` — and revoke the `inventory_items` INSERT grant from `authenticated`. Minimal alternative: one batched `insert([...])`.
- Confidence: confirmed.

**H7. The demo-data fallback silently masks a broken production**
- `src/lib/supabase/config.ts:1-7` (`url.includes("supabase")` — false for a custom API domain), `src/middleware.ts:33-35` (skips subdomain routing entirely), `src/lib/data.ts:9-12, 31-33, 57-59`, `src/lib/directory-server.ts:221-228`, `src/app/dashboard/page.tsx:13-38` (renders setup instructions), `src/app/[handle]/page.tsx:66`.
- A missing or mistyped env var on Vercel (or a future custom Supabase domain) turns the live site into the demo: `maya-lin`/`mika` galleries appear, every real subdomain 404s, and the dashboard shows "add your Supabase URL to .env.local" to the public. Nothing fails loudly.
- Fix: in `config.ts`, `if (process.env.NODE_ENV === "production" && !configured) throw new Error(...)` at module load, and gate demo data behind an explicit `NEXT_PUBLIC_DEMO_MODE=true` instead of "env missing". Drop the `includes("supabase")` heuristic.
- Confidence: confirmed.

### MEDIUM

**M1. No security headers**
- `next.config.mjs` has no `headers()`. There is no CSP, `frame-ancestors`/`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, or `Permissions-Policy` (Vercel adds HSTS). Gallery pages can be framed, so the Collect button (a server action that spends coins) is clickjackable; with the parent-domain cookie, any XSS on any subdomain is a full account takeover, and CSP is the only backstop.
- Fix: add `headers()` returning `Content-Security-Policy: frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`; then a report-only CSP (`img-src` will need the Supabase host, unsplash/picsum only in demo).
- Confidence: confirmed.

**M2. `record_gallery_view` is callable by `anon` with any `visitor_key`; view counts are freely inflatable and the table is unbounded**
- `supabase/schema.sql:306-346`, `src/components/gallery/ViewCounter.tsx:34-38`.
- A loop of `rpc('record_gallery_view', { p_gallery_id, p_visitor_key: uuid() })` adds a row per call. The 30-minute dedupe only covers the *same* key.
- Fix: cap anonymous rows per gallery per minute inside the function (count recent `viewer_id is null` rows and return early), or record anonymous views by a hash of `inet_client_addr()` + day instead of a client key.
- Confidence: confirmed.

**M3. Avatars and wall backgrounds are uploaded raw: EXIF/GPS retained, no size limit on avatars, MIME is client-declared**
- `src/components/dashboard/ProfileEditor.tsx:66-82` (uploads `file` as-is with `contentType: file.type`), `src/components/gallery/GallerySettingsPanel.tsx:113-121, 148-152` (only a 5 MB client check, original filename in the path), `supabase/schema.sql:887` (`avatars`: `file_size_limit null`, `image/*`).
- Artwork images are re-encoded through canvas (`lib/resize.ts`), which strips metadata — good. Avatars and backgrounds are not, so photos taken on phones publish GPS coordinates. `image/*` is checked against the request header only, so any bytes can be stored as an "image" of any size. PDFs are also uploaded raw (author metadata).
- Fix: run avatars and backgrounds through `encodeArtworkFile()` (already exists) before upload; set `avatars` to 2 MB and `['image/jpeg','image/png','image/webp']`; name background objects `<uuid>.<ext>`; strip PDF metadata or document that PDFs are published as-is.
- Confidence: confirmed.

**M4. `profiles` is fully public, including `coin_balance` and `tier`**
- `supabase/schema.sql:679-680` (`for select using (true)`), and the browser fetches `select("*")` in `dashboard/page.tsx:53`, `data.ts:17`.
- Anyone with the anon key can list every user's coin balance. Support handles are intentionally public; balances are not.
- Fix: `revoke select on profiles from anon, authenticated; grant select (id, handle, display_name, bio, location, instagram_url, avatar_url, layout_mode, created_at, venmo_handle, ...) on profiles to anon, authenticated;` and read the viewer's own `coin_balance` through a small `security definer` function or a policy-scoped view. Note `[handle]/page.tsx:82-86` and `dashboard/page.tsx:53` read `coin_balance` for the current user and would need that path.
- Confidence: confirmed.

**M5. Public gallery page is fully dynamic and makes 6–8 uncached Supabase round trips per view; `getGalleryByHandle` runs twice**
- `src/app/[handle]/page.tsx:24` (metadata) and `:47` (page) both call `getGalleryByHandle` (2 queries each); then `getPrimaryGallery`, `get_gallery_pieces`, `auth.getUser()`, and for signed-in visitors 2–3 more. `src/lib/supabase/middleware.ts:37-39` adds an auth call per request. Nothing is cached because everything goes through the cookie-bound client.
- At 10× traffic this is the first thing to hit Supabase API limits and the p95. Next may dedupe the identical GETs inside one render, but that is not guaranteed for supabase-js.
- Fix: wrap `getGalleryByHandle`/`getPrimaryGallery`/`getGalleryPieces` in React `cache()`; move the public part of the page (profile, artworks, pieces, background) behind the anon client + `unstable_cache` tagged `gallery:<handle>`, revalidated from the editor/profile save paths; keep viewer-specific state (`isOwner`, balance, collectables) in a `Suspense` child.
- Confidence: confirmed (call count), suspected (dedupe).

**M6. `HeartButton` issues `auth.getUser()` plus a `hearts` select per piece, with no in-flight guard or rollback**
- `src/components/ui/HeartButton.tsx:26-39, 41-61`; mounted per piece via `GalleryPieceCard.tsx:172-179`.
- A signed-in visitor on a 25-piece wall fires ~50 requests on load (each `getUser()` is a network call to the auth server). Rapid double-click sends insert and delete concurrently; a failed write leaves the UI desynced and the promise rejects unhandled.
- Fix: fetch the viewer's hearted ids once on the server (`hearts where user_id = me and piece_id in (...)`) and pass `initialHearted`; read the user id from one place; disable while pending and revert on `error`.
- Confidence: confirmed.

**M7. Image sizing wastes egress: 800 px floor for 220 px pieces, originals for 40–60 px thumbnails, `priority` on half the wall**
- `FramedArtwork.tsx:48, 52` (`Math.max(800, width * 2)`), `GallerySalonWall.tsx:809` (`priority` when `position_y < 40`), `TransactionTable.tsx:92-96, 155-159` (`artwork_image_url` never passed through `artworkImageUrl`, so up to 5 MB per row), `ProfileCard.tsx:24-30` and `ArtistBubble.tsx:54, 67` (raw `avatar_url` for a 56–60 px circle; `avatarImageUrl()` exists and is used in `GalleryDirectory.tsx:153`), `GallerySeeAllGrid.tsx:51` (800 px for ~300 px cells), `FramedArtwork.tsx:102-111` (unframed pieces download the full original just to measure aspect), `GalleryCarousel.tsx:65-100` (every featured wall's images mount at once).
- Fix: bucket art by `width * devicePixelRatio * scale`; use `artworkImageUrl(url, 240)` and `avatarImageUrl(url, 120)` for thumbnails with `loading="lazy"`; cap eager loads to the first few pieces; measure aspect from the display `<img>`'s `onLoad`.
- Confidence: confirmed (carousel: suspected).

**M8. Directory loader reads every profile and artwork per rebuild, plus one RPC per custom wall**
- `src/lib/directory-server.ts:155-214` (`selectAllRows` pages through all rows every 60 s cache miss; `Promise.all` of `get_gallery_pieces` per gallery with any placement).
- Fine at hundreds of rows; at 100× uploads it's a full-table scan of `artworks` and hundreds of RPCs per minute, on the landing page's critical path. `HIDDEN_HANDLES` (`:109-115`) hardcodes test accounts.
- Fix: a SQL view/RPC `gallery_directory()` returning one row per gallery with its cover pieces as JSON (index on `artworks (artist_id, created_at desc) where deleted_at is null`), paginate `/explore`, and mark hidden accounts with a `profiles` flag instead of a code list.
- Confidence: confirmed.

**M9. Missing indexes on every hot filter column**
- `supabase/schema.sql` defines indexes only on `frames`, `gallery_views`, and `hearts` (`:96, 147-148, 158-159`). No index on `gallery_pieces.gallery_id` (`get_gallery_pieces`, editor deletes, directory), `galleries.user_id` (every page load, RLS on `gallery_views`), `artworks.artist_id` (`data.ts:40`, `Dashboard.tsx:35`), `inventory_items.owned_by` (`[handle]/page.tsx:90,121`, `MyCollection.tsx:24`, RLS per row), `transactions.from_user/to_user` (`TransactionTable.tsx:214`, RLS, `return_artwork` rate limit). `gallery_views_gallery_id_idx` is a redundant prefix of the composite.
- Fix (one migration): `gallery_pieces (gallery_id)`; `unique galleries (user_id) where is_primary` (also fixes M10); `artworks (artist_id, created_at desc) where deleted_at is null`; `inventory_items (owned_by) where deleted_at is null`; `transactions (from_user, created_at desc)`, `transactions (to_user, created_at desc)`. Confirm the live state first with `select indexname, indexdef from pg_indexes where schemaname='public'`.
- Confidence: confirmed (queries), suspected (live index list — the dump is hand-written).

**M10. Nothing enforces one primary gallery per user; the app assumes it everywhere**
- `supabase/schema.sql:98-110` (no constraint; `galleries_write_own` is `FOR ALL` with table-wide grants, so the owner can set `is_primary` on several rows), `data.ts:71-77, 92-98`, `GalleryEditorCanvas.tsx:265-274`, `GallerySalonWall.tsx:175-180` (all `.single()`), `GallerySettingsPanel.tsx:93-97, 163` (star toggles state but `is_primary` is commented out of the update; `slug` is saved but nothing routes on it).
- Two primaries → `.single()` errors → gallery renders with no pieces and the editor can't save. Self-inflicted only, but silent.
- Fix: the partial unique index from M9; remove or wire the star and slug controls.
- Confidence: confirmed.

**M11. Editor save/reset ignore write errors, are non-atomic, key items by `artwork_id`, and don't handle null geometry**
- `GalleryEditorCanvas.tsx:298-316` (`delete` and `profiles.update` results unchecked), `GallerySalonWall.tsx:183-192` (same in reset; `router.refresh()` runs regardless), `GalleryEditorCanvas.tsx:75-90, 210-243` (`CanvasItem.id = artwork_id`, so two editions of one artwork on a wall — legal per `gallery_pieces` unique on `inventory_item_id` — collide: duplicate React keys, `updateItem` hits the first, tray hang collides), `:85-88, 368-377, 543-551` (`position_x/y`, `rotation`, `scale`, `z_index` are nullable in `schema.sql:131-135`; `scale(null)` → 0 px piece, `-` in the rotation input → `NaN`), `GallerySalonWall.tsx:113-114, 320, 420` (`layout_mode` is effectively dead: the branch reduces to `galleryPieces.length > 0`, so a stale `'auto'` puts the "see all" button over a custom wall).
- Fix: one `save_gallery_layout(p_gallery_id uuid, p_pieces jsonb)` RPC (upsert + delete-orphans + `layout_mode` in one transaction, ownership via `owns_inventory_item`); key by `inventoryItemId`; coalesce on load; `Number.isFinite` guards; `not null default` on the geometry columns; pick one source of truth for custom vs auto.
- Confidence: confirmed.

**M12. Settings panel re-saves a removed background and leaks blob URLs**
- `GallerySettingsPanel.tsx:62, 127-132, 145` (`bgImageUrl` is never updated; "remove image" clears only the preview; save writes the original URL back), `:122, 172` and `GalleryEditorCanvas.tsx:94-102` (after save the editor keeps a `blob:` URL; `URL.createObjectURL` never revoked; no `router.refresh()`), `:148-152` (original filename in the object key; old backgrounds never deleted).
- Fix: a single `imageUrl` state that remove sets to null and save uses; revoke blobs; `router.refresh()` after save; `<uuid>.<ext>` names and delete the previous object.
- Confidence: confirmed.

**M13. Sales table mislabels clawbacks and overstates "coins earned"**
- `TransactionTable.tsx:70-74, 89` (sales embed `buyer` via `transactions_from_user_fkey`, but `remove_artwork` writes clawback rows as `from_user = artist`, so the artist's own handle appears in the "collector" column), `:77-83` (`coins earned` sums `purchase` only; `remove_artwork` debits the artist per clawback and the purchases side already subtracts removals at `:130`).
- Fix: embed both `from:profiles!transactions_from_user_fkey(handle)` and `to:profiles!transactions_to_user_fkey(handle)` and pick by `type`; subtract removal amounts. This also removes the second `profiles` round trip (`:204, 220-239`) and ~40 lines.
- Confidence: confirmed.

**M14. Dashboard lists swallow errors and show empty states; delete errors are only logged; balance goes stale**
- `MyCollection.tsx:21-28`, `TransactionTable.tsx:211-218` (only `data` destructured → "no sales yet" on any error), `ArtworkCard.tsx:64-79` (`console.error` only; modal closes, piece stays), `Dashboard.tsx:91` (`coin_balance` is the server snapshot; `remove_artwork` changes it), `ArtworkCard.tsx:48-62` (`saveEdit` swallows errors, allows empty title), `MyCollection.tsx:37` and `CollectButton.tsx:34-46` (server-action calls without try/catch → unhandled rejection leaves buttons disabled or shows "Collected ✓" after a failure; nothing refreshes after a successful collect so balances and "left" counts go stale).
- Fix: keep an `error` state per list; surface RPC errors in the modal; `router.refresh()` after collect/return/remove; try/catch/finally around every server-action call.
- Confidence: confirmed.

**M15. Collected PDFs render as broken images**
- `MyCollection.tsx:23, 87-93` (select omits `file_type`; `artworkImageUrl` returns `.pdf` URLs unchanged), `TransactionTable.tsx:92-96, 155-159`.
- Fix: select `file_type` and reuse the PDF placeholder branch from `ArtworkCard.tsx:142-146`.
- Confidence: confirmed.

**M16. Return button is hover-only, so unreachable on touch devices**
- `MyCollection.tsx:103-111` (`opacity-0 group-hover:opacity-100`). The project has invested heavily in phone support for the wall; this tab has no mobile affordance. UI change — needs your call.
- Confidence: confirmed.

**M17. Unused login server action with an unvalidated redirect; `?next=` is ignored**
- `src/app/login/actions.tsx:10, 32` (`redirect(next || "/dashboard")` with caller-supplied `next`; exported as a server action so it is a live endpoint even though `AuthForm.tsx:66-74` never calls it), `AuthForm.tsx:18` (`next` read and discarded), `admin/layout.tsx:13` (redirects to `/login?next=/admin/frames`, which login ignores). CLAUDE.md says login must use this action; the code doesn't.
- Fix: decide which way to go. If keeping the server action: validate `next` (`startsWith("/") && !startsWith("//")`), wire `AuthForm` to it, and drop the client `signInWithPassword`. If not: delete `actions.tsx` and update CLAUDE.md. Either way honor `next` on success.
- Confidence: confirmed.

**M18. Subdomain routing has no escape hatch for apex-only paths**
- `src/middleware.ts:44-47` rewrites every path on a subdomain, so `artist.galleryclub.online/dashboard` → `/artist/dashboard` → 404, and the `/login → /dashboard` redirect in `lib/supabase/middleware.ts:53-58` lands there too. Components work around it with hard-coded `https://galleryclub.online/...` (`GallerySalonWall.tsx:246, 257, 300`, `not-found.tsx:14`, `DashboardNav.tsx:40`, `MyCollection.tsx:85`), which breaks local and preview deployments. `middleware.ts:11, 23` hardcode port 3000.
- Fix: in the middleware, if `subdomain` is set and `pathname` starts with a known apex route (`/dashboard`, `/login`, `/signup`, `/explore`, `/admin`, `/terms`, `/privacy`), redirect to the apex origin; then replace the hard-coded URLs with `getGalleryUrl`/a shared `apexUrl()`.
- Confidence: confirmed.

**M19. No cap on uploads per user; the 25-piece limit is dead code**
- `UploadZone.tsx:22, 94` (`IMAGE_LIMIT` unused; `isGalleryFull = false`). Storage is the main cost line and there is no server-side limit either.
- Fix: enforce in the DB (`before insert on artworks` trigger counting live rows for `auth.uid()`), surface the count in the UI.
- Confidence: confirmed.

**M20. Frames admin: geometry validated by `kind` only; upload-then-insert strands PNGs**
- `src/app/admin/frames/actions.ts:32-36` and `schema.sql:78-81` accept `{kind:"polygon"}` with no `points`; `FrameWindowShape.tsx:26` then throws in every `FramedArtwork`/`WallCover`, unmounting every wall and the explore page. `FramesAdmin.tsx:145-153` uploads with `upsert: false` before the server validates the key; on any `createFrame` failure the object is stranded and the suggested retry fails with "resource already exists". Admin-only surface, so integrity rather than privilege, but one typo takes the site down.
- Fix: structural validation in `validWindow` (finite numbers in [0,1], ≥3 points, `d` charset/length cap); `FrameWindowShape` returns `null` for malformed input; validate the key before upload and `remove()` on insert failure.
- Confidence: confirmed.

**M21. Migration history cannot rebuild the live schema, and its ordering is hazardous**
- No `001`/`002`; `profiles`, `artworks` base, `create_primary_gallery`, `get_gallery_pieces`, the artworks/avatars buckets and their policies, `galleries.slug/background_*`, `artworks.deleted_at/description`, `inventory_items.acquired_price_coins/deleted_at`, `transactions.artwork_title/artwork_image_url`, and `frames.image_width/height` (006 has only UPDATEs) exist in `schema.sql` with no migration. `curation_and_exchange_migration.sql` sorts after `020_` and recreates the exploitable 5-argument `transfer_coins` (`:145-227`) that 008 removed. A stray `005_frame_windows_seed.sql.bak` sits in the folder. `003:88-90` created a `gallery_views` INSERT policy under a name that `011:62` did not drop, so a browser-insert path may still exist live despite the "only writer" comment at `schema.sql:845`. `get_gallery_pieces` (`schema.sql:262-304`) is `SECURITY DEFINER` without `set search_path`, unlike every other definer function.
- Fix: rename the curation file to `000_...` or move it to `supabase/migrations/archive/`; delete the `.bak`; add a `021_recreate_get_gallery_pieces.sql` with `set search_path = public` and explicit grants; drop the duplicate `artworks` SELECT policy (`schema.sql:710-714`). Verify first: `select policyname, cmd, roles from pg_policies where tablename = 'gallery_views';`.
- Confidence: confirmed (repo), suspected (live policy state).

**M22. Storage objects are never deleted**
- No `.remove(` anywhere in `src/`. `remove_artwork` soft-deletes rows but the public file stays served forever; avatar re-uploads with a different extension and every background change leave orphans; the "owners can delete" policy (`schema.sql:903-905`) is unused.
- Fix: a `storage.objects` cleanup in `remove_artwork` is not possible from SQL alone on Supabase; instead have the dashboard call `storage.remove([path])` after a successful `remove_artwork`, and delete the previous avatar/background on replace. Consider a scheduled job for orphans.
- Confidence: confirmed.

**M23. Frames fallback snapshot has drifted and is never regenerated**
- `src/lib/frames.fallback.json` (`generated_at 2026-09-14`) equals the `005` seed byte-for-byte; `docs/frame-admin-build-plan.md` says it is regenerated on every admin save, but `FramesAdmin.tsx:174` only prints a reminder. In a DB outage walls render stale geometry. The 33 KB pretty-printed JSON also ships in the client bundle via `createContext(FALLBACK_CATALOG)` (`FramesProvider.tsx:18`) and again in the RSC payload from `layout.tsx:24`.
- Fix: regenerate in CI/pre-push (`scripts/snapshot-frames.mjs` exists), minify, and make the context default `null`.
- Confidence: confirmed (drift vs seed), suspected (drift vs live).

### LOW

**L1.** `supabase/schema.sql:710-714` — two identical `SELECT using (true)` policies on `artworks`. Harmless; drop one. Confirmed.

**L2.** `GallerySalonWall.tsx:116-123`, `GalleryEditorCanvas.tsx:336-343`, `WallCover.tsx:132` — `background_image_url`/`background_color` interpolated raw into inline `style` (`url(${...})`). Owner-writable free text; self-defacement / tracking pixel only, but validate (`^#[0-9a-f]{6}$`, URL must start with the artworks bucket origin) and add DB checks. Confirmed path, impact suspected.

**L3.** `ArtistBubble.tsx:54, 67`, `[handle]/page.tsx:41` — `avatar_url` is free text rendered into `<img src>` and the page favicon; can point anywhere (visitor tracking). Constrain to the avatars bucket origin. Confirmed.

**L4.** `[handle]/page.tsx:124`, `GalleryEditorCanvas.tsx:311`, `TransactionTable.tsx:71-72, 116-117, 214` — PostgREST filters built by string interpolation (`.not("id","in",`(${ids.join(",")})`)`, `.or(...)`). All inputs are server-derived UUIDs today, so not exploitable, but it is the filter-injection pattern. Prefer `.in()` with arrays. Confirmed.

**L5.** `src/app/[handle]/page.tsx:138-152` — seven `(item.artwork as any)` casts; `GallerySettingsPanel.tsx:173` `err: any`; `MyCollection.tsx:12, 27` `any[]`; `data.ts:110`, `directory-server.ts:205`, `frames-server.ts:39-40` `as unknown as`; `types.ts:67-71` types nullable DB columns as non-null. Type the select shapes. Confirmed.

**L6.** Dead code (delete): `src/app/login/actions.tsx` (see M17); `data.ts:68-78` `getPrimaryGalleryId`; `gallery-wall-data.ts:1-8, 29-41` (`WallArtist`, `galleryLayout`; `GalleryLayoutItem.frameFile/left/top/width/rot` never read — the auto wall uses only `artIndex`); `demo-data.ts:133` `DEMO_HANDLE` (and the demo profile's `handle` is `test-art` while it is keyed as `maya-lin`); `ArtworkCard.tsx:369-378` `extractStoragePath`, `:11-12, 20-21` `isFirst/isLast`; `GalleryEditorCanvas.tsx:19-30` `DEFAULT_POSITIONS`, `:73, 138-147` `canvasDims`; `useWallFit.ts:10-20` `useIsMobile` exported but re-implemented in `GallerySalonWall.tsx:147-153` and `GalleryEditorCanvas.tsx:130-136`; `MyPurchases.tsx`/`MySales.tsx` pass-through wrappers; `scripts/trace-frame-windows.mjs` (parses a `FRAMES` array that no longer exists and would overwrite `005`); `GalleryPieceCard` `linkHref`/`wrapper` props with no caller; `artworks.description` UPDATE grant never used. Confirmed.

**L7.** Repo/deploy bloat: `public/frames/` (8.5 MB, frames are served from Storage; only `scripts/upload-frames.mjs` reads them) and `public/art/badartrat-preview.png` (5.5 MB, referenced nowhere) are deployed as static assets on every build; `scripts/output/*` artifacts and `supabase/migrations/005_frame_windows_seed.sql.bak` are committed. Move bootstrap PNGs out of `public/`, delete the preview. Confirmed.

**L8.** Duplication: gallery-URL logic ×4 (`lib/url.ts`, `DashboardNav.tsx:12-24` with an SSR/client hydration mismatch, `MyCollection.tsx:85`, `GallerySalonWall.tsx:657`); sign-out ×2 (`SiteNav.tsx:5-10` server action vs `DashboardNav.tsx:29-34` client); `1400×1200` and `220` constants (`GalleryEditorCanvas.tsx:17, 73, 526-527`, `GalleryMinimap.tsx:14-15`, `GallerySalonWall.tsx:483` vs `useWallFit.ts:6-7`); `getInitials` (`ArtistBubble.tsx:23-30` vs `lib/initials.ts`); wall-background style object ×3; tab bar JSX ×4 in `Dashboard.tsx:105-146` (with conflicting `text-sm text-xl`); privacy/terms pages hand-roll nav and footer and export no `metadata`. Confirmed.

**L9.** Oversized files: `GallerySalonWall.tsx` (952; `CustomLayoutView` alone is ~500 lines with 8 effects), `UploadZone.tsx` (863), `GalleryEditorCanvas.tsx` (843). Natural splits: `CustomLayoutView` + `usePhoneSelection` hook; canvas / tray / mobile controls; upload steps. Opinion.

**L10.** `GalleryEditorCanvas.tsx:175-188, 238` — z-order "forward/back" increments by 1 instead of swapping, so ties make the buttons appear to do nothing. `:190-208, 728` — `storeSelected` rebuilds tray items with `artistId: ""`, `editionNumber: 0`. Confirmed.

**L11.** `ArtworkCard.tsx:108-125` — price debounce: `0`/empty skips the write (UI empty, DB keeps old price), timer never cleared on unmount, `onUpdate` uses the `artwork` captured when typing began. `:38-46` — a `document` mousedown listener per card for its whole lifetime. `:33-34, 94-96` — `forSale`/`priceCoins` duplicate props as local state. Confirmed.

**L12.** `GallerySalonWall.tsx:164-170` — `navigator.clipboard.writeText` rejection unhandled (insecure context / denied). `:272-298` — "share gallery" rendered three times under exclusive conditions. `:371, 399` — list keys are index-based instead of `art.id`. Confirmed.

**L13.** `src/lib/data.ts:21-23, 44-46` — `.single()` not-found (PGRST116) on every unknown handle is logged as `console.error`; `getArtworksByArtistId` demo branch ignores `artistId`. Confirmed.

**L14.** `GalleryDirectory.tsx:171` — `new URL(gallery.url).host` in render for every card on every keystroke; throws on any malformed URL. Send `host` from the server. Suspected.

**L15.** `TextInput.tsx:26, 85, 90-94` — `maxLength` is ignored by browsers for `type="number"` yet the counter renders. Confirmed.

**L16.** Frames subsystem (admin-only): `actions.ts:78-92, 205-215` reorder is N sequential updates without a transaction and orphan groups render as drop targets (FK error surfaced raw); `actions.ts:94-123` trusts client-supplied `aspect` and never writes `image_width/height` (006's columns are read nowhere); `frame-tracer.ts:59-95` allocates a full `W*H` mask per transparent region (noisy alpha → tab hang); `frames.ts:197-206` path bbox mis-pairs relative/arc commands; `admin/frames/page.tsx:24-29` ignores `usageRes.error` so every frame shows "0 pieces" and offers delete (server re-counts, so no data loss); `frames` bucket has no size limit (`schema.sql:888`). Confirmed / suspected as noted by the frames reviewer.

**L17.** Docs drift: `README.md` says dashboard/signup are unbuilt, storage buckets are unlimited, and policies are "commented at the bottom of schema.sql"; `NOTES.md` lists a `page_views` table that isn't live; `SECURITY.md` has a broken heading and typos; `docs/frame-admin-build-plan.md` types `crop_padding` as numeric (live: jsonb) and lists Phase 5 as not started. Confirmed.

**L18.** `src/middleware.ts:11, 23` hardcode `localhost:3000`; `src/app/dashboard/page.tsx:9-10` `SKIP_AUTH` bypass is correctly gated on `NODE_ENV === "development"` (note only). Confirmed.

---

## 3. Quick wins (low effort, high value)

Each is a small, self-contained change; the SQL ones are one-statement migrations I will write and show, not apply.

1. **Drop the storage UPDATE policy on `artworks`** (H3) — one `drop policy`.
2. **Anchor the `file_url` LIKE to the project URL** (H2) — recreate one policy.
3. **Handle CHECK constraint + `lower(handle)` unique index** (H1) — one migration; add `terms`/`privacy` and squat words to `RESERVED_HANDLES`; make `linkHrefFor` validate.
4. **Narrow `remotePatterns` to the project host and drop unsplash/picsum** (C1) — two lines in `next.config.mjs`.
5. **Add `headers()`** with `frame-ancestors 'none'`, `nosniff`, referrer and permissions policies (M1) — ~15 lines.
6. **Fail fast in production when Supabase env is missing** (H7) — 3 lines in `config.ts`.
7. **Check the `error` on the six ignored writes** (`GalleryEditorCanvas.tsx:298-316`, `GallerySalonWall.tsx:183-192`, `ArtworkCard.tsx:100-105`, `MyCollection.tsx:21-28`, `TransactionTable.tsx:211-218`) (M11, M14, H5).
8. **Index migration** (M9) — six `create index` statements including the one-primary partial unique.
9. **Wrap gallery loaders in React `cache()`** (M5) — removes the duplicate profile+artworks queries per view.
10. **Fix the sales table embed and "coins earned"** (M13) — ~10 lines, deletes ~40.
11. **Re-encode avatars through `encodeArtworkFile`** before upload (M3) — strips GPS, caps size; one call.
12. **Thumbnail URLs**: `artworkImageUrl(url, 240)` in `TransactionTable`, `avatarImageUrl(url, 120)` in `ProfileCard`/`ArtistBubble` (M7).
13. **Delete dead code and the 14 MB of unreferenced `public/` assets** (L6, L7).
14. **Rename/archive `curation_and_exchange_migration.sql`, delete the `.bak`** (M21).

## 4. Decisions I need from you before Phase 2

- **Next.js upgrade** (C1): 15.5.x or 16.x. Both are dependency changes and 15 makes `params`/`cookies()` async across every page and the middleware. I will not touch this without a yes.
- **Which login path is canonical** (M17): server action (per CLAUDE.md) or client-side (per the code).
- **Signup hardening approach** (H4): DB trigger on `auth.users` vs server action.
- **Whether `coin_balance` should stay publicly readable** (M4).
- **Mobile return button** (M16) is a UI change.
- **Verification queries to run first** (per your preference to run SQL yourself): `pg_policies` for `gallery_views`; `pg_indexes` for `public`; handles violating the regex or colliding case-insensitively; `file_url` not on the project host; users with >1 primary gallery; `auth.users` without a `profiles` row.

## 5. Verified OK (so you don't have to re-check)

- No service-role key in app code or `NEXT_PUBLIC_*`; `.env.local` never committed; no JWT-shaped strings in history.
- `transfer_coins`, `return_artwork`, `remove_artwork` derive the actor from `auth.uid()`, lock inventory-then-profile, reject edition 0 / self-purchase / null price, and are `revoke`d from `anon`. Bodies in `schema.sql` match the last migration for each (017, 016, 012).
- Column grants match every browser write in `src/` (profiles, artworks, inventory_items).
- Storage insert policies scope writes to `<uid>/` for `artworks` and `avatars`; the `artworks` bucket enforces 5 MB and a MIME allowlist.
- Artwork images are canvas re-encoded (EXIF stripped); object keys are `<uid>/<uuid>.<ext>`.
- No `dangerouslySetInnerHTML`; every `target="_blank"` has `rel="noopener noreferrer"`; support-link hrefs are `base + handle` and cannot escape the platform host.
- Every admin server action re-checks `is_admin()`; the admin layout 404s non-admins.
- Server actions authenticate inside the action (the mitigation the endpoint-disclosure advisory recommends).
