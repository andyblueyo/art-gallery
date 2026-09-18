import { createClient } from "@/lib/supabase/server";
import type { FrameCategoryRow, FrameRow } from "@/lib/frames";
import { FramesAdmin } from "@/components/admin/FramesAdmin";

export const dynamic = "force-dynamic";

export default async function AdminFramesPage() {
  // Read straight from the DB, not through the cached getFrames(): the admin
  // must see the row they just saved, not the public cache.
  const supabase = await createClient();
  const [framesRes, categoriesRes, usageRes] = await Promise.all([
    supabase
      .from("frames")
      .select("frame_file, kind, name, category_slug, sort_order, image_path, window, bbox, aspect, crop_padding, active")
      .order("sort_order"),
    supabase.from("frame_categories").select("slug, name, sort_order, active").order("sort_order"),
    // Live pieces per frame — what flipping a frame inactive would affect.
    supabase.from("artworks").select("frame_file").is("deleted_at", null),
  ]);

  const frames = (framesRes.data ?? []) as unknown as FrameRow[];
  const categories = (categoriesRes.data ?? []) as unknown as FrameCategoryRow[];
  const usage: Record<string, number> = {};
  for (const row of usageRes.data ?? []) {
    const key = (row as { frame_file: string | null }).frame_file || "frame1.png"; // falsy → default frame, as the walls do
    usage[key] = (usage[key] ?? 0) + 1;
  }

  const loadError = framesRes.error?.message ?? categoriesRes.error?.message ?? null;

  return (
    <FramesAdmin
      initialFrames={frames}
      initialCategories={categories}
      usage={usage}
      loadError={loadError}
    />
  );
}
