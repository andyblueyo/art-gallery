// Server-side frame catalog loader. Import only from server components,
// route handlers and server actions (it pulls in next/cache).
//
//   const catalog = await getFrames();
//
// The DB read is wrapped in unstable_cache under FRAMES_CACHE_TAG, so an
// admin save only has to call revalidateTag(FRAMES_CACHE_TAG) for every
// server render to pick the change up within seconds, no deploy needed.
// If the read fails for any reason, the committed snapshot in
// frames.fallback.json is served instead — never an empty picker.

import { unstable_cache } from "next/cache";
import { createAnonClient } from "./supabase/anon";
import {
  catalogFromRows,
  FALLBACK_CATALOG,
  type FrameCatalog,
  type FrameCategoryRow,
  type FrameRow,
} from "./frames";

export const FRAMES_CACHE_TAG = "frames";

const FRAME_COLUMNS =
  "frame_file, kind, name, category_slug, sort_order, image_path, window:window_shape, bbox, aspect, crop_padding, active";
const CATEGORY_COLUMNS = "slug, name, sort_order, active";

// Throws on any failure so nothing bad is ever written into the cache; the
// caller decides what to serve instead. Both tables are public-read, so the
// anon client is enough.
async function fetchCatalogFromDb(): Promise<FrameCatalog> {
  const supabase = createAnonClient();
  const [framesRes, categoriesRes] = await Promise.all([
    supabase.from("frames").select(FRAME_COLUMNS),
    supabase.from("frame_categories").select(CATEGORY_COLUMNS),
  ]);
  if (framesRes.error) throw framesRes.error;
  if (categoriesRes.error) throw categoriesRes.error;
  const frames = (framesRes.data ?? []) as unknown as FrameRow[];
  const categories = (categoriesRes.data ?? []) as unknown as FrameCategoryRow[];
  if (frames.length === 0) throw new Error("frames table returned no rows");
  return catalogFromRows(frames, categories);
}

const getCachedCatalog = unstable_cache(fetchCatalogFromDb, ["frames-catalog"], {
  tags: [FRAMES_CACHE_TAG],
  revalidate: 60 * 60, // safety net; admin saves revalidate by tag
});

export async function getFrames(): Promise<FrameCatalog> {
  try {
    return await getCachedCatalog();
  } catch (err) {
    console.error("[frames] DB read failed, serving fallback snapshot", err);
    return FALLBACK_CATALOG;
  }
}
