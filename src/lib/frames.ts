// Frame catalog: types, the DB-row → FrameConfig adapter, URL builder and the
// committed fallback snapshot. Isomorphic — no server-only imports here.
//
// Source of truth is public.frames / public.frame_categories (see
// supabase/migrations/004_frames_catalog.sql). Server code loads it through
// getFrames() in ./frames-server.ts; client components read it from
// <FramesProvider> via useFrames() / useFrameConfig().
//
// The identifier everywhere is `frame_file` (FrameConfig.file): the exact
// string persisted on artworks.frame_file. Never rename or re-ID.

import fallbackSnapshot from "./frames.fallback.json";

// Slug from frame_categories. "none" is the pseudo-category of the unframed
// sentinel row and is never a picker tab.
export type FrameCategory = string;

export interface FrameInnerPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

// Window geometry, normalised 0..1 against the frame PNG's intrinsic size.
// Consumed natively by SVG clipPathUnits="objectBoundingBox".
export type FrameWindow =
  | { kind: "rect"; x: number; y: number; w: number; h: number; radius?: number }
  | { kind: "ellipse"; cx: number; cy: number; rx: number; ry: number }
  | { kind: "polygon"; points: [number, number][] }
  | { kind: "path"; d: string };

export interface FrameBBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

// ── DB rows (also the shape of frames.fallback.json) ────────────────────────
export interface FrameRow {
  frame_file: string;
  kind: "frame" | "none";
  name: string;
  category_slug: string | null;
  sort_order: number;
  image_path: string | null;
  window: FrameWindow | null;
  bbox: FrameBBox | null;
  aspect: number | null;
  crop_padding: FrameInnerPadding | null;
  active: boolean;
}

export interface FrameCategoryRow {
  slug: string;
  name: string;
  sort_order: number;
  active: boolean;
}

// ── App-facing shapes ───────────────────────────────────────────────────────
export interface FrameConfig {
  file: string; // == frame_file, THE key
  kind: "frame" | "none";
  label: string;
  category: FrameCategory;
  sortOrder: number;
  active: boolean;
  imagePath: string | null;
  aspect: number; // frame image w/h
  window: FrameWindow | null;
  bbox: FrameBBox | null;
  // DEPRECATED. The hand-measured 4-sided window inset that predates
  // `window`/`bbox`. Nothing renders from it any more; it survives only as
  // the auto-tracer's seed (scripts/trace-frame-windows.mjs) and as the
  // frameWindowBBox() fallback for a row that has not been traced yet.
  cropPadding: FrameInnerPadding; // 0..1 fractions of the image
}

export interface FrameCategoryConfig {
  id: string;
  label: string;
  sortOrder: number;
  active: boolean;
}

export interface FrameCatalog {
  frames: FrameConfig[]; // every row, including inactive and the "none" sentinel
  categories: FrameCategoryConfig[];
}

export const DEFAULT_FRAME_FILE = "frame1.png";
export const NO_FRAME_FILE = "none";

const ZERO_PAD: FrameInnerPadding = { top: 0, right: 0, bottom: 0, left: 0 };

export function frameRowToConfig(row: FrameRow): FrameConfig {
  return {
    file: row.frame_file,
    kind: row.kind,
    label: row.name,
    category: row.category_slug ?? NO_FRAME_FILE,
    sortOrder: row.sort_order,
    active: row.active,
    imagePath: row.image_path,
    aspect: row.aspect ?? 1,
    window: row.window,
    bbox: row.bbox,
    cropPadding: row.crop_padding ?? ZERO_PAD,
  };
}

export function catalogFromRows(
  frameRows: FrameRow[],
  categoryRows: FrameCategoryRow[]
): FrameCatalog {
  const categories = [...categoryRows]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((c) => ({ id: c.slug, label: c.name, sortOrder: c.sort_order, active: c.active }));
  const catOrder = new Map(categories.map((c, i) => [c.id, i]));
  const frames = frameRows.map(frameRowToConfig).sort((a, b) => {
    const ca = catOrder.get(a.category) ?? Number.MAX_SAFE_INTEGER;
    const cb = catOrder.get(b.category) ?? Number.MAX_SAFE_INTEGER;
    return ca - cb || a.sortOrder - b.sortOrder || a.file.localeCompare(b.file);
  });
  return { frames, categories };
}

// Committed snapshot served when the DB read fails (or before the frames
// table exists). Regenerate with: node scripts/snapshot-frames.mjs
export const FALLBACK_CATALOG: FrameCatalog = catalogFromRows(
  fallbackSnapshot.frames as FrameRow[],
  fallbackSnapshot.categories as FrameCategoryRow[]
);

// Falsy or unknown frame_file resolves to the default frame, never undefined —
// same contract as the old getFrameConfig(), so no consumer needs a null check.
export function resolveFrame(
  catalog: FrameCatalog,
  frameFile: string | null | undefined
): FrameConfig {
  const { frames } = catalog;
  const fallback = frames.find((f) => f.file === DEFAULT_FRAME_FILE) ?? frames[0];
  if (!frameFile) return fallback;
  return frames.find((f) => f.file === frameFile) ?? fallback;
}

// ── Window geometry helpers ─────────────────────────────────────────────────
const FULL_BBOX: FrameBBox = { x: 0, y: 0, w: 1, h: 1 };

// Bounding box of the art window in image-normalised coords. Prefers the
// traced bbox; falls back to the legacy cropPadding box (pre-Phase-1b rows),
// then to the whole image.
export function frameWindowBBox(
  frame: Pick<FrameConfig, "bbox" | "cropPadding">
): FrameBBox {
  const b = frame.bbox;
  if (b && b.w > 0 && b.h > 0) return b;
  const cp = frame.cropPadding;
  const w = 1 - cp.left - cp.right;
  const h = 1 - cp.top - cp.bottom;
  if (w > 0 && h > 0 && (w < 1 || h < 1)) return { x: cp.left, y: cp.top, w, h };
  return FULL_BBOX;
}

// w/h of the art window itself, in image pixels — what a crop box must be
// constrained to. NOT `aspect`: that is the frame graphic's ratio (Nokia is
// 0.43, a tall phone) while its window is 1.42 (a wide screen).
export function frameWindowAspect(
  frame: Pick<FrameConfig, "aspect" | "bbox" | "cropPadding">
): number {
  const image = frame.aspect > 0 ? frame.aspect : 1;
  const b = frameWindowBBox(frame);
  return (b.w / b.h) * image;
}

// ── Images ──────────────────────────────────────────────────────────────────
// Frame PNGs live in the public `frames` Storage bucket and are served through
// Supabase's image transformation endpoint, which resizes and (when the
// browser accepts it) re-encodes to WebP, alpha preserved. Widths snap to a
// few buckets so the CDN cache stays hot.
export const FRAME_IMAGE_WIDTHS = [240, 480, 800, 1200] as const;
export const FRAME_IMAGE_QUALITY = 80;

export function frameImageUrl(
  frame: Pick<FrameConfig, "imagePath">,
  width: number,
  quality: number = FRAME_IMAGE_QUALITY
): string {
  if (!frame.imagePath) return "";
  const w = FRAME_IMAGE_WIDTHS.find((b) => b >= width) ?? FRAME_IMAGE_WIDTHS[FRAME_IMAGE_WIDTHS.length - 1];
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Without Supabase configured (local demo mode) fall back to the static copy.
  if (!base) return `/frames/${frame.imagePath}`;
  return `${base}/storage/v1/render/image/public/frames/${frame.imagePath}?width=${w}&resize=contain&quality=${quality}`;
}
