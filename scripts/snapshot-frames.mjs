// Regenerate the committed fallback catalog from the live database:
//
//   node scripts/snapshot-frames.mjs
//
// Writes src/lib/frames.fallback.json in the exact DB-row shape that
// getFrames() reads, so the fallback path and the live path share one
// adapter. Run after any admin save you want protected against a DB outage,
// then commit the result. (The deployed server cannot rewrite the repo, so
// this is a local / CI step, not something the admin portal does itself.)
//
// Both tables are public-read; the anon key from .env.local is enough.

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const ROOT = resolve(import.meta.dirname, "..");
process.loadEnvFile(resolve(ROOT, ".env.local"));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY missing from .env.local");
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false } });

const [framesRes, catsRes] = await Promise.all([
  supabase
    .from("frames")
    .select("frame_file, kind, name, category_slug, sort_order, image_path, window, bbox, aspect, crop_padding, active")
    .order("category_slug")
    .order("sort_order"),
  supabase.from("frame_categories").select("slug, name, sort_order, active").order("sort_order"),
]);
if (framesRes.error) throw framesRes.error;
if (catsRes.error) throw catsRes.error;
if (!framesRes.data?.length) throw new Error("frames table is empty — refusing to write an empty fallback");

const missingWindow = framesRes.data.filter((f) => f.kind === "frame" && !f.window).map((f) => f.frame_file);
if (missingWindow.length) console.warn(`warning: ${missingWindow.length} frame(s) have no window yet: ${missingWindow.join(", ")}`);

const out = resolve(ROOT, "src/lib/frames.fallback.json");
writeFileSync(
  out,
  JSON.stringify(
    {
      generated_at: new Date().toISOString().slice(0, 10),
      source: "scripts/snapshot-frames.mjs (live DB)",
      categories: catsRes.data,
      frames: framesRes.data,
    },
    null,
    1
  ) + "\n"
);
console.log(`wrote ${out}: ${framesRes.data.length} frames, ${catsRes.data.length} categories`);
