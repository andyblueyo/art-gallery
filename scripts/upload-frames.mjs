// Phase 1a: upload the frame PNGs from public/frames into the 'frames'
// Storage bucket at the exact path stored in frames.image_path, then verify
// every object is publicly readable.
//
// Requires the service role key (the bucket is admin-write only and this
// script does not sign in as a user):
//
//   SUPABASE_SERVICE_ROLE_KEY=... node scripts/upload-frames.mjs
//
// Reads NEXT_PUBLIC_SUPABASE_URL from .env.local. Idempotent: re-running
// overwrites objects in place (upsert).

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

process.loadEnvFile(resolve(import.meta.dirname, "..", ".env.local"));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Need NEXT_PUBLIC_SUPABASE_URL (.env.local) and SUPABASE_SERVICE_ROLE_KEY (env).");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const BUCKET = "frames";
const LOCAL_DIR = resolve(import.meta.dirname, "..", "public", "frames");

// Source of truth is the DB row, not a hardcoded list, so this also proves
// the migration ran and image_path is populated.
const { data: frames, error } = await supabase
  .from("frames")
  .select("frame_file, image_path")
  .eq("kind", "frame")
  .order("frame_file");
if (error) throw error;
if (!frames?.length) throw new Error("frames table is empty — run 004_frames_catalog.sql first");

let failed = 0;
for (const { frame_file, image_path } of frames) {
  const local = resolve(LOCAL_DIR, frame_file);
  let bytes;
  try {
    bytes = await readFile(local);
  } catch {
    console.error(`MISSING local file  ${frame_file}`);
    failed++;
    continue;
  }

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(image_path, bytes, {
      contentType: "image/png",
      upsert: true,
      cacheControl: "31536000",
    });
  if (upErr) {
    console.error(`UPLOAD FAILED       ${image_path}: ${upErr.message}`);
    failed++;
    continue;
  }

  // Verify public read without any key, the way a browser will fetch it.
  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(image_path);
  const res = await fetch(publicUrl, { method: "HEAD" });
  const len = res.headers.get("content-length");
  if (!res.ok || Number(len) !== bytes.length) {
    console.error(`VERIFY FAILED       ${image_path}: HTTP ${res.status}, ${len} bytes (local ${bytes.length})`);
    failed++;
    continue;
  }
  console.log(`ok  ${image_path.padEnd(32)} ${bytes.length} bytes`);
}

console.log(`\n${frames.length - failed}/${frames.length} frames uploaded and verified.`);
if (failed) process.exit(1);
