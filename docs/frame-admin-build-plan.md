# Gallery Club — Frame Admin Portal: Build Plan

**Goal:** move frame definitions out of `src/lib/frames.ts` and into Supabase, behind an admin
portal that lets you upload frames, group them, draw the window shape directly on the frame
image, reorder, and toggle active/inactive — and make the upload crop step and the wall renderer
actually honor that window shape.

**Fixes on the way:** Heart and Nokia crop-shape bugs (both open from the 30-frame QA sweep), and
any future frame whose window isn't a plain rectangle.

**Lives at:** `galleryclub.online/admin/frames` — a route in the existing app, same repo, same
deploy, same Supabase. Not a separate site. The shape editor's preview must use the same clipping
component as the wall renderer, or the two will drift.

**Adjacent workstreams folded in:** asset compression and a real gallery loading state.

---

## Status — 2026-09-14

**Phase 0:** complete.
**Phase 1a:** complete.
**Phase 1b:** complete.
**Phase 2:** complete, pushed.
**Phase 3:** complete, pushed.
**Phase 4:** complete, pushed.
**006 (frame dimensions):** applied.
**Next:** QA regression pass, then Phase 5.

### Incident: frames rendered with their sides cut off (live, ~Sept 15)

Artwork appeared to be drawn *over* the frame — top and bottom rails visible, sides buried.
Diagnosed initially as a clip-path or art-box-sizing bug in Phase 4. It was neither.

Root cause was in Phase 2's `frameImageUrl()`: the Supabase transform endpoint **defaults to
`resize=cover`**, so requesting a width center-cropped the frame PNG and sliced its left and right
rails off. The geometry was correct the whole time; the frame graphic arriving was wrong.

Fix: add `resize=contain` to the transform URL.

Two lessons worth keeping:
- The bug was introduced in Phase 2 and surfaced in Phase 4, because Phases 2–4 all shipped in one
  push. Separate pushes exist for exactly this — the plan said so and it went unheeded.
- Still to confirm: `resize=contain` preserves ratio, but check whether it *fits* or *letterboxes*.
  The bbox math assumes the delivered image is the source scaled uniformly. If contain pads with
  transparent margins, window coordinates drift.

Done in 1a:
- `004_frames_catalog.sql` written and applied. Verification passed cold: 31 frames rows,
  30 real frames, 372 artworks rows across 31 distinct `frame_file` values, **0 unresolved**.
- Admin model live: `admin_users`, `is_admin()` (SECURITY DEFINER), RLS on both tables and the
  bucket. Bootstrapped to `badartrat` / `helloabchen@gmail.com`
  (`2b20a3ec-6a9b-481b-a235-e2f4f9b652af`) — this is the real primary account, not a test one.
- Column renamed `window` → `window_shape`; `window` is a reserved keyword in Postgres.
- All 30 PNGs uploaded to the `frames` bucket, byte-verified against local. Public read confirmed
  in a browser.

Done in 1b:
- `scripts/trace-frame-windows.mjs` — built-in PNG alpha decoder, no new packages. Seeds at the
  crop-padding box centre, floods enclosed alpha, marching squares, Douglas–Peucker, then snaps to
  rect/ellipse where the pixel mask agrees. No frame errored, no flood leaked to the border.
- `005_frame_windows_seed.sql` applied. **13 rect, 2 ellipse, 15 polygon — 0 null across
  `window_shape`, `bbox` and `aspect`.** Each update writes all three columns together and matches
  on `frame_file`.
- `aspect` holds the **image** w/h ratio, not the window's — see the resolved section below. The 1b
  report described it as recomputed from the trace; that was a misreading.
- Tuning note: the ellipse test must run before the rounded-rect test — a circle is also a
  rounded rect with radius half the side, and Circle Gold snapped wrong until the order changed.

Remaining:
- Commit 004, 005, the upload script and the tracer scripts.

Done in 2:
- `src/lib/frames-server.ts` — `getFrames()` in `unstable_cache` under tag `frames`, one-hour
  safety revalidate, bare anon client (cookies are a dynamic API and can't run inside the cache).
  Throws inside the cache on failure so nothing bad is stored, then serves the snapshot.
- `src/lib/frames.fallback.json` — all 31 rows in database-row shape.
  `scripts/snapshot-frames.mjs` regenerates it from live. Run it before pushing when frames change;
  a CI step is overkill, its job is preventing an empty picker, not mirroring the DB.
- `FramesProvider` hands the server-loaded catalog to client components; context default is the
  snapshot, so nothing outside the provider sees an empty list.
- Images through the Storage transform endpoint. Widths snap to four buckets to keep the CDN cache
  hot: picker asks 240, wall asks 2× CSS width with an 800 floor. **Classic tab picker 4.9 MB →
  ~150 KB; wall 4.9 MB → ~590 KB.**
- Debt: `frames.ts` keeps a small map of the classic frames' inner padding, the circle/oval crop
  shapes, and two selection scales — not in the DB. **This must die in Phase 4.** While it exists,
  the DB and the code disagree about the same frames with the DB inert, and a frame added via the
  Phase 5 admin tool can't have inner padding or selection scale without a deploy — which undercuts
  the reason the Supabase version was chosen.
- Not yet verified by eye. "Identical by construction" is an argument, not a check; frame height now
  comes from the catalog rather than probing the PNG. Load a real gallery against production before
  pushing.

### `aspect` is the image ratio, not the window ratio — resolved

The eight frames at exactly `aspect = 1.000000` exposed it: all 30 rows store the **image** w/h
ratio, not the window's. Confirmed against pixels — frame1 800×1067 = 0.7498 (stored 0.749766),
Nokia 326×765 = 0.4261 (stored 0.426144). The 1b note claiming `aspect` was recomputed from the
trace was wrong; it's a more precise version of the same quantity `frames.ts` already held.

Nothing was broken by this. Phase 2 wants the image ratio for sizing the frame graphic, which is
why rendering matched. **The bug was queued for Phase 3**, which would have constrained crop boxes
to image ratios and fixed Nokia not at all.

`006_frame_dimensions.sql` adds `image_width` / `image_height`, backfilled from the PNGs. Verified:
0 missing, 0 mismatches against the independently-computed `aspect`.

**Two different numbers, both needed:**

| | what it is | who uses it |
|---|---|---|
| `aspect` | image w/h | `FramedArtwork`, sizing the frame graphic |
| window aspect | `(bbox.w × image_width) / (bbox.h × image_height)` | Phase 3, constraining the crop box |

Window aspect is **not stored** — it's redundant with `bbox` plus dimensions, and a third
denormalized copy is a third thing to drift. `bbox` already solves the runtime polygon-parsing
problem that justified denormalizing in 1a; this is two multiplications.

Nokia: image aspect 0.426 (tall phone) vs window aspect ≈ 1.42 (wide screen). **That gap is the
entire Nokia bug.** The eight square-canvas polaroids are the best test case — image aspect exactly
1, window aspects ranging 0.754 to 1.589.

`aspect` → `image_aspect` rename deliberately deferred: Phase 2 reads it in three places plus the
snapshot JSON, and renaming freshly-working code is churn.

Done in 3:
- `frameWindowAspect()` in `frames.ts` — bbox w/h × image aspect. The crop step reads only this,
  never the `aspect` column.
- `frameWindowBBox()` prefers the traced bbox, falls back to legacy crop padding for untraced rows,
  then the whole image — so the crop step degrades rather than breaks.
- Crop box locked to window aspect; `CropWindowOverlay` ghosts the frame at 60% opacity behind the
  selection and masks outside the window shape. `FrameWindowShape` renders rect/ellipse/polygon/path
  in 0–1 coordinates, reused by Phase 4's clip paths.
- The saved crop is still the rectangular bounding box — intentional. Phase 4 clips to shape on the
  wall.

Done in 4:
- Art box positioned from bbox as percentages of the frame box; window shape applied as clip-path in
  `objectBoundingBox` units. Framed pieces size synchronously from the catalog instead of rendering
  at a placeholder height and jumping.
- **Apple Tama root cause found:** `frames.ts` held 469/372 for a 500×500 PNG. `FramedArtwork`
  measured the true PNG while the editor's bounding box used the wrong ratio, so the two disagreed.
  The mid-QA "removed the boundary box" fix papered over a bad constant rather than fixing geometry.
  Same mismatch drove the two selection-scale fudge factors on frame7 and frame8. Both sides now
  read the same catalog aspect.
- `crop_padding` **deprecated, not deleted** — the tracer seeds from it, and untraced rows fall back
  to it via `frameWindowBBox`. The legacy shape, inner padding and selection-scale knobs are gone
  from the catalog, and the dead per-item padding override is removed from `GalleryPieceCard`,
  `GallerySalonWall` and the wall data module. One geometry source now.
- Editor drag bounds fixed: the bottom bound used the horizontal extent, and bounds ignored that a
  rotated piece's corners reach past its origin (~190px spill at 60°).

### Open before Phase 5 — run the 30-frame QA protocol

Four bugs are nominally closed; two are **unverified reasoning, not tested fixes**:
- **Hover card on rotated pieces.** Phase 4 argues synchronous sizing removes the placeholder-height
  window that caused it. Plausible, but the original anchored the card near an unrelated piece
  across the wall — a bigger displacement than placeholder height alone explains. If it's still
  broken, don't assume it's nearly fixed.
- **Apple Tama at 60°.** Real fix this time, so this confirms rather than regression-checks.
- **Drag bounds behaviour change.** Pieces parked near an edge may now clamp. Load a real gallery
  with edge-parked pieces and confirm nothing moves on load or on an incidental re-save — 372 live
  artworks, arranged by real artists.
- **heart-border:** force to a plain rect window. The tracer flagged it nearly rectangular, and its
  polygon leaves hairline gaps along the wavy edge. The frame border is opaque and sits above the
  art, so the polygon buys nothing. One update statement, not a migration.

Tracer review flags carried forward:
- Heart traced 20% off the old `cropPadding`, Oval Gold 14.8% off on the bottom edge. Both are the
  bug being fixed, but both are worth eyeballing on the contact sheet — a wrong trace there is
  invisible until someone frames a piece.
- Ten frames flagged "nearly rectangular" (IoU 0.925–0.985). Leaving them as polygons: at that IoU
  against a real photographed screen the polygon is tracking genuine off-axis geometry, not noise,
  and substituting an idealized rect would reintroduce corner gaps.

Tracked, not blocking:
- Regenerate `supabase/schema.sql` as a `supabase db dump` snapshot and fix its header — it's
  stale by many months, not just missing `frame_file`.
- `005` repair migration so the chain can rebuild production. Needs a diff of the fresh dump
  against 001–005. (Note: number it `006` now that `005` is taken.)

Tracked, not blocking:
- Regenerate `supabase/schema.sql` as a `supabase db dump` snapshot and fix its header — it's
  stale by many months, not just missing `frame_file`.
- `005` repair migration so the chain can rebuild production. Needs a diff of the fresh dump
  against 001–004.

Nothing reads any of this yet — the app is still on `frames.ts` until Phase 2 — so none of the
above is user-visible or risky to leave open briefly.

---

## Phase 0 — COMPLETE. Findings below are load-bearing for everything that follows.

### 1. The frame key is a file path string

Pieces reference a frame by the `file` field in `FRAMES`, and that exact string is persisted as
`frame_file` on `artworks`. No id, no slug, no array index. `gallery_pieces` has no frame column —
the frame lives on the artwork.

- 372 rows with `frame_file`, 0 null, 31 distinct values, all matching `frames.ts`.
- Values look like `frame1.png`, `polaroid/cherry.png`, `digis/nokia.png`.
- **`none` is a literal sentinel used by 8 artworks.** Code treats falsy as "use the default
  frame", so `none` must survive as a non-empty string.
- **`frame_file` is not in `supabase/schema.sql` or any tracked migration** — added out-of-band.
  The new migration can't assume it's documented. Follow-up (see below): `supabase/schema.sql` is
  stale well beyond this one column — it predates `inventory_items`, `gallery_pieces`, the coin
  economy and the support links, and still calls the project "artpenny". Regenerate it as a
  `supabase db dump` snapshot rather than hand-patching, and write a `005` repair migration for
  everything the chain can't rebuild.

**Consequence:** the moment images move to Storage, `digis/nokia.png` stops describing where the
file lives and becomes an opaque identifier that merely looks like a path. `frame_file` (the key)
and `image_path` (the location) are two different columns from here on, and the key is frozen
forever. Reorganizing the bucket must never touch it. This is the single highest-consequence rule
in the build.

### 2. All 30 frames are RGBA with fully transparent windows

The auto-tracer can key off alpha, so the shape editor is a touch-up tool rather than
trace-everything. Four details that determine whether the tracer works:

- **Most frames also have a transparent exterior.** Seed from the `cropPadding` box center and
  find the *enclosed* hole — do not flood from the image edge or you'll trace the outside.
- **Nokia's window is far off-center**; seeding from the image center lands on opaque phone body.
  The cropPadding box center is the correct seed for it.
- **Three frames have an opaque exterior** — `film1-horizontal`, `heart-border`, `paint`. Seed
  logic stays uniform; these are just the easy case.
- **Circle and Heart have `cropPadding` of zero**, so the derived sample box overlaps the ring.
  Their traces need manual verification — and they're the two shapes that most need to be right.

### 3. Assets: 8.44 MB across 30 PNGs, served uncompressed from `public/frames`

Plain `<img>` tags, so Next image optimization never runs. The picker renders one category tab at
a time, so per-tab load is what matters:

| Category | Files | Load |
|---|---|---|
| classic (default tab) | 8 | **4.9 MB** |
| digis | 14 | 3.1 MB |
| polaroid | 8 | 0.77 MB |

`frame8` (1.38 MB) and `frame5` (1.15 MB) dominate the worst case. 4.9 MB on the default tab of
the upload flow is the single biggest performance problem found.

### 4. Supabase Storage image transformations are enabled (Pro or above)

Resize at the CDN via the render endpoint; no `sharp` at upload. The endpoint negotiates WebP off
the `Accept` header, so alpha is preserved and format selection is automatic. Worth watching
transform billing once real traffic hits it.

*(Production returned HTTP 429 to curl, so served headers weren't verified. Not blocking.)*

---

## Phase 1a — Schema, storage, access control, backfill

### `frame_categories`

| column | type | notes |
|---|---|---|
| `slug` | text PK | `classic`, `polaroid`, `digis` |
| `name` | text | display label |
| `sort_order` | int | picker tab order |
| `active` | bool | default true |

A table rather than an enum so you can add or rename a group without a migration. This is the
"organize groups" half of the ask.

### `frames`

| column | type | notes |
|---|---|---|
| `id` | uuid PK | |
| `frame_file` | text UNIQUE NOT NULL | **the key. Exact strings from `frames.ts`. Never changes.** |
| `kind` | text | `frame` or `none` — see sentinel note |
| `name` | text | "Ornate Gold" |
| `category_slug` | text FK | → `frame_categories`, nullable for `none` |
| `sort_order` | int | order within category |
| `image_path` | text | Storage path — **separate from `frame_file`** |
| `window_shape` | jsonb | geometry, see below. **Not `window`** — reserved keyword in Postgres |
| `bbox` | jsonb | derived bounding box, denormalized at save |
| `aspect` | numeric | derived w/h ratio, denormalized at save |
| `crop_padding` | numeric | carried over; see Phase 4 on whether it survives |
| `active` | bool | default true |
| `created_at` / `updated_at` | timestamptz | |

No `slug` column. `frame_file` is the only identifier, so there's no second key to drift out of
sync with the one that's actually persisted on 372 artworks.

**The `none` sentinel gets a real row** (`frame_file = 'none'`, `kind = 'none'`, null window,
no image). The picker filters on `kind = 'frame'`; the resolver then never returns undefined for a
value that exists on a live artwork. The alternative — special-casing `none` in application code —
puts the same logic in every consumer instead of one place.

`bbox` and `aspect` are computed from `window_shape` at save time so nothing at runtime parses a polygon
to find out how big the crop box should be.

### The `window_shape` format

Discriminated union, all coordinates **normalized 0–1** against the frame image's intrinsic
dimensions:

```json
{ "kind": "rect",    "x": 0.12, "y": 0.10, "w": 0.76, "h": 0.80, "radius": 0.02 }
{ "kind": "ellipse", "cx": 0.50, "cy": 0.46, "rx": 0.32, "ry": 0.30 }
{ "kind": "polygon", "points": [[0.10,0.22],[0.90,0.22], "..." ] }
{ "kind": "path",    "d": "M 0.1 0.2 C ... Z" }
```

Normalization is load-bearing three times over: frame PNGs are different pixel sizes; CDN resizing
in Phase 2 can't invalidate the geometry; and SVG `clipPathUnits="objectBoundingBox"` consumes 0–1
natively, so the same numbers drive the crop UI, the wall renderer and the editor canvas with no
conversion anywhere.

`rect` and `ellipse` cover most frames cheaply. `polygon` / `path` cover Heart and anything else
irregular.

### Storage

Bucket `frames`, public read, admin-only write. Mirror the existing paths exactly
(`frames/frame1.png`, `frames/polaroid/cherry.png`) so `image_path` and `frame_file` coincide at
migration time and the backfill is trivially verifiable — while staying separate columns so they
can diverge later without breaking anything.

### Access control — built here, not in Phase 5

RLS on `frames` needs to exist the moment the table does, and the write policies depend on the
admin function, so the whole access model lands in this phase. Phase 5 only builds UI against it.

**Do not put `is_admin` on `profiles`.** Users can already update their own profile row (handle,
bio, support links), and Postgres RLS doesn't restrict individual columns — so that policy would
let anyone PATCH their own `is_admin` to true through PostgREST. It's pluggable with a column-level
`REVOKE` or a trigger, but both are easy to forget the next time the profile update path gets
rebuilt.

Instead, a dedicated table:

| column | type | notes |
|---|---|---|
| `user_id` | uuid PK FK | → `auth.users` |
| `granted_by` | uuid | audit trail |
| `granted_at` | timestamptz | |

No write policy for `authenticated` at all, so privilege escalation isn't something to defend
against — it's structurally impossible. Audit trail comes free.

The check is a **`SECURITY DEFINER` function `is_admin()`** that looks up `auth.uid()` in that
table. It must be `SECURITY DEFINER`: inlining the subquery into another table's policy makes that
subquery subject to `admin_users`' own RLS, which silently returns empty — the same failure mode
already hit with nested PostgREST joins.

That one function is then reused everywhere: RLS on `frames` and `frame_categories`, the Storage
bucket write policy, and later the server check in `/admin/layout.tsx`. The layout check hides the
UI; **RLS is what actually stops writes.** With a public repo, the RLS half does the real work.

Bootstrap with one SQL insert. Confirm which UUID is actually yours before granting — `badartrat`
is filed alongside `test3` as a test account.

### Backfill and verification

Backfill inserts all 31 rows (30 frames + the `none` sentinel) with `window_shape` left null — Phase 1b
fills those in. Then one verification query before anything else proceeds: every distinct
`frame_file` on `artworks` (31 values, 372 rows) must resolve to exactly one `frames` row. Anything
other than 31 clean matches means stop. This is the check that protects existing pieces, and it's
far cheaper to run now than after Phase 2 makes the DB the source of truth.

---

## Phase 1b — Auto-tracer and window backfill

Split from 1a deliberately. The migration is deterministic — write SQL, insert rows, verify. The
tracer is iterative: run it, look at 30 shapes, tune the simplification, look again. Bundling them
means the fiddly half eats the context the careful half needs.

One-off Node script, fully specified by the Phase 0 alpha findings:

1. Load PNG → seed from the `cropPadding` box center → flood the **enclosed** transparent region.
2. Marching squares on the mask → boundary polygon.
3. Douglas–Peucker simplify to ~20–40 points.
4. Snap to `rect` or `ellipse` when within tolerance — cleaner data and cheaper to render than a
   40-point polygon approximating a rectangle.
5. Normalize to 0–1, emit seed `window_shape` values for all 30 frames.
6. Flag Circle and Heart for manual review (zero `cropPadding`, unreliable seed box).

---

## Phase 2 — Read path + frame image compression (one change, not two)

Introduce `getFrames()` and route every consumer through it.

- Server fetch wrapped in `unstable_cache`, tag `'frames'`.
- Admin writes call `revalidateTag('frames')` → save in the portal, live in seconds, no deploy.
- **Committed fallback snapshot** at `src/lib/frames.fallback.json`, regenerated on every admin
  save. If the DB read fails, serve the snapshot. Without it, a bad fetch means an empty frame
  picker on production, and there's no staging to catch it first.

Because images move to Storage in Phase 1, the URLs change here regardless — so serve them through
the transform endpoint with width and quality params from the start. There's no reason to serve
unoptimized from Storage and then optimize in a later phase. Lazy-load below-the-fold frames in
the picker grid while you're in there.

Verification for this phase is no longer "nothing changed" — it's *frames render identically and
the classic tab drops from 4.9 MB to a fraction of it*.

---

## Phase 3 — Crop step honors the window shape

Where Heart and Nokia get fixed.

1. Constrain the crop box to the frame's **window aspect** —
   `(bbox.w × image_width) / (bbox.h × image_height)`. **Not the `aspect` column**, which holds the
   image ratio and is what `FramedArtwork` uses to size the frame graphic. Using `aspect` here
   fixes nothing: Nokia's image ratio is 0.426 (tall phone) while its window is ≈1.42 (wide
   screen), so the crop box would stay exactly as wrong as it is today.
2. Render the crop selection **in the window's actual shape** via clip-path, from `window_shape` —
   you see a heart while cropping a heart, a wide near-square while cropping Nokia.
3. Ideally overlay the real frame image around the crop region at reduced opacity, so the step is
   genuinely WYSIWYG rather than a shape you mentally map onto a frame.

Test cases: Nokia (0.426 vs 1.42), Heart (circular crop box today, heart-shaped window), and the
eight square-canvas polaroids where image aspect is exactly 1 and window aspects run 0.754 to 1.589.
If a frame's crop box looks unchanged after this ships, suspect the wrong number is being read.

Root cause in both open bugs is identical: crop to a tall rectangle, force-fit into a small square
window, get a distorted fragment. Constraining aspect at selection time makes that structurally
impossible.

Ship separately from Phase 4 — it touches the live upload flow and deserves its own rollback point.

---

## Phase 4 — Renderer

`GallerySalonWall.tsx` and `GalleryEditorCanvas.tsx`: position artwork using `bbox` scaled to the
rendered frame size, apply the window shape as a clip-path.

- **`crop_padding` probably becomes redundant** — the window bbox subsumes it. Decide explicitly:
  deprecate, or keep as a secondary inset. Don't leave two overlapping knobs. Note the tracer uses
  `cropPadding` as its seed, so it can't be dropped until after the backfill is done and verified.
- **Do not reintroduce rotation drift.** Apple Tama was fixed mid-QA by removing the boundary box,
  and this phase puts new geometry logic straight back into that code path. Re-test at 60° on Apple
  Tama, Ornate Gold and one polaroid before shipping.

Check whether this also fixes the open **rotated-piece title-card mispositioning** bug — the hover
card anchoring to un-rotated coordinates smells like the same transform-math family.

---

## Phase 5 — The admin portal

Route `/admin/frames`. Galleries live on subdomains, so `/admin` sits on the apex — confirm the
subdomain middleware passes apex paths through untouched. If it needs a change, `middleware.ts` is
on the `CLAUDE.md` protected list, so that's a manual edit by you. Also confirm `admin` is blocked
as a signup handle.

### Access control

Already built and enforced in Phase 1a — `admin_users` plus the `SECURITY DEFINER` `is_admin()`
function. This phase adds only the server check in `/admin/layout.tsx`, which hides the UI. RLS is
what actually stops writes; the layout check is convenience, not security.

No add/remove UI here either — granting is one SQL insert and you're n=1. When that panel does get
built: you can't revoke yourself, and the table can never drop to zero admins.

### Surface

- **List view** — grouped by category, drag to reorder, active/inactive toggle, and a **usage count
  per frame** (live pieces referencing it) so you know what you're affecting before flipping one off.
- **Upload** — drop a PNG, it goes to Storage, the tracer proposes a window.
- **Shape editor** — the centerpiece. Frame image as canvas, draw or adjust the window on top.
  Rect / ellipse / polygon modes, draggable vertices, snap-to-shape, live preview with a sample
  image clipped into the window **using the same component as the wall renderer**.
- **Category management** — add, rename, reorder, deactivate groups.
- **Active toggle, not delete.** 372 live artworks reference these frames. Inactive drops a frame
  from the picker for new uploads while existing pieces keep rendering. Reactivating is the same
  toggle. Hard delete only for a frame with zero pieces attached, and even then the toggle covers it.

---

## Phase 6 — Artwork compression

Frame images are handled in Phase 2. What's left is user artwork, which is the larger share of
gallery page weight:

- Downscale client-side before upload (canvas → WebP, max ~2000px).
- Serve display-sized transforms on the wall rather than originals.

---

## Phase 7 — Gallery loading state

Separate track; listed here so it doesn't get absorbed into another phase's scope.

The problem isn't response time — it's that layout data is cheap and images are heavy, so the wall
assembles itself visibly, piece by piece, looking broken mid-load.

1. **`src/app/[handle]/loading.tsx`** — free route-level suspense boundary.
2. **Skeleton at the real positions.** Positions, sizes and rotations arrive fast. Render them as
   empty tinted shapes in the right places, then swap images in. Far better than a spinner: the
   wall is correctly composed before a single image lands.
3. **Priority-load above-the-fold pieces**, lazy-load the rest.
4. *Optional, higher effort:* an LQIP/blurhash column on `artworks`, backfilled, so each frame
   shows a blurred version of its own artwork instantly.

No artificial minimum duration on the loader. A loading screen padded to feel intentional is
exactly the category of thing that reads as slop.

---

## Sequencing

| Phase | What | Model | Ship? |
|---|---|---|---|
| 0 | Recon | — | **done** |
| 1a | Schema, storage, access control, backfill | Sonnet | **done** |
| 1b | Tracer + window backfill | Sonnet | **done** |
| 006 | `image_width` / `image_height` + backfill | — | **applied** |
| 2 | `getFrames()` + fallback + Storage transforms | Sonnet | **done** |
| 3 | Crop step honors window | Sonnet | **done** |
| 4 | Renderer clip-path + positioning | Sonnet | **done** |
| QA | 30-frame regression protocol | agent | **next** |
| 5 | Admin portal UI | Sonnet | |
| 6 | Artwork compression | Sonnet | independent |
| 7 | Gallery loading state | Sonnet | independent |

One phase per Claude Code session, each with its own review and push.

## Risk register

1. **`frame_file` is frozen.** 372 artworks depend on those exact strings, including the `none`
   sentinel. It looks like a path but is an opaque key — reorganizing Storage must never touch it.
2. **The migration chain can't rebuild production.** `frame_file` — and likely more — exists in the
   live database but in no tracked migration, and `supabase/schema.sql` is stale by many months.
   Regenerate the dump, diff it against 001–004, and write a `005` repair migration. Until then the
   live database is the only source of truth.
3. **No staging.** Phases 2–4 touch the live upload flow. Rollback is Vercel Instant Rollback plus
   the committed fallback snapshot. Separate pushes so rollback stays surgical.
4. **Rotation drift regression** (Phase 4). Re-test at 60° before pushing.
5. **Admin escalation** if the flag ever lands on a user-writable table. See Phase 1a.
6. **Protected files** — `client.ts`, `middleware.ts`, `AuthForm.tsx`, `actions.ts` stay untouched
   by Claude Code. Any middleware change for the apex route is a manual edit.