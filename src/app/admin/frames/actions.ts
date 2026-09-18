"use server";

// Admin writes for the frame catalog. Every action re-checks is_admin() for a
// clear error message, but the write itself is protected by RLS regardless:
// a non-admin session gets a Postgres policy violation, not a saved row.
// After each successful write the public catalog cache is revalidated, so
// walls and the picker pick the change up on their next render.

import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { FRAMES_CACHE_TAG } from "@/lib/frames-server";
import { windowToBBox, type FrameWindow } from "@/lib/frames";

export type ActionResult = { ok: true } | { ok: false; error: string };

const ok: ActionResult = { ok: true };
const fail = (error: string): ActionResult => ({ ok: false, error });

async function adminClient() {
  const supabase = await createClient();
  const { data: isAdmin, error } = await supabase.rpc("is_admin");
  if (error) throw new Error(`is_admin check failed: ${error.message}`);
  if (!isAdmin) throw new Error("not an admin");
  return supabase;
}

function bust() {
  revalidateTag(FRAMES_CACHE_TAG);
  revalidatePath("/admin/frames");
}

function validWindow(w: unknown): w is FrameWindow {
  if (!w || typeof w !== "object") return false;
  const k = (w as { kind?: string }).kind;
  return k === "rect" || k === "ellipse" || k === "polygon" || k === "path";
}

const KEY_RE = /^[a-z0-9][a-z0-9._-]*(\/[a-z0-9][a-z0-9._-]*)*\.png$/;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;

// ── frames ──────────────────────────────────────────────────────────────────

export async function saveFrameGeometry(frameFile: string, window: FrameWindow): Promise<ActionResult> {
  try {
    if (!validWindow(window)) return fail("invalid window");
    const supabase = await adminClient();
    const bbox = windowToBBox(window);
    const { error } = await supabase.from("frames").update({ window_shape: window, bbox }).eq("frame_file", frameFile).eq("kind", "frame");
    if (error) return fail(error.message);
    bust();
    return ok;
  } catch (e) { return fail((e as Error).message); }
}

export async function updateFrameMeta(
  frameFile: string,
  patch: { name?: string; active?: boolean; category_slug?: string }
): Promise<ActionResult> {
  try {
    const supabase = await adminClient();
    const clean: Record<string, unknown> = {};
    if (patch.name !== undefined) {
      const name = patch.name.trim();
      if (!name) return fail("name is required");
      clean.name = name.slice(0, 60);
    }
    if (patch.active !== undefined) clean.active = patch.active;
    if (patch.category_slug !== undefined) clean.category_slug = patch.category_slug;
    if (!Object.keys(clean).length) return ok;
    const { error } = await supabase.from("frames").update(clean).eq("frame_file", frameFile).eq("kind", "frame");
    if (error) return fail(error.message);
    bust();
    return ok;
  } catch (e) { return fail((e as Error).message); }
}

// Sets sort_order 1..n for the given files, moving them into `categorySlug`.
export async function reorderFrames(categorySlug: string, orderedFrameFiles: string[]): Promise<ActionResult> {
  try {
    const supabase = await adminClient();
    for (let i = 0; i < orderedFrameFiles.length; i++) {
      const { error } = await supabase
        .from("frames")
        .update({ sort_order: i + 1, category_slug: categorySlug })
        .eq("frame_file", orderedFrameFiles[i])
        .eq("kind", "frame");
      if (error) return fail(error.message);
    }
    bust();
    return ok;
  } catch (e) { return fail((e as Error).message); }
}

export async function createFrame(input: {
  frame_file: string;
  name: string;
  category_slug: string;
  aspect: number;
  window: FrameWindow;
}): Promise<ActionResult> {
  try {
    const key = input.frame_file.trim();
    if (!KEY_RE.test(key)) return fail("key must look like category/name.png (lowercase, no spaces)");
    if (key === "none") return fail("reserved key");
    if (!input.name.trim()) return fail("name is required");
    if (!validWindow(input.window)) return fail("invalid window");
    if (!(input.aspect > 0)) return fail("invalid aspect");
    const supabase = await adminClient();
    const { data: last } = await supabase
      .from("frames").select("sort_order").eq("category_slug", input.category_slug)
      .order("sort_order", { ascending: false }).limit(1).maybeSingle();
    const { error } = await supabase.from("frames").insert({
      frame_file: key,
      kind: "frame",
      name: input.name.trim().slice(0, 60),
      category_slug: input.category_slug,
      sort_order: ((last as { sort_order?: number } | null)?.sort_order ?? 0) + 1,
      image_path: key, // uploaded by the client to this exact path first
      window_shape: input.window,
      bbox: windowToBBox(input.window),
      aspect: +input.aspect.toFixed(6),
      active: true,
    });
    if (error) return fail(error.message);
    bust();
    return ok;
  } catch (e) { return fail((e as Error).message); }
}

// Hard delete is allowed only when no live artwork references the frame.
// The row is removed; the Storage object is left in place (harmless, and it
// keeps a re-create of the same key trivially possible).
export async function deleteFrame(frameFile: string): Promise<ActionResult> {
  try {
    const supabase = await adminClient();
    const { count, error: countErr } = await supabase
      .from("artworks").select("id", { count: "exact", head: true })
      .eq("frame_file", frameFile).is("deleted_at", null);
    if (countErr) return fail(countErr.message);
    if ((count ?? 0) > 0) return fail(`${count} live piece(s) still use this frame — deactivate it instead`);
    const { error } = await supabase.from("frames").delete().eq("frame_file", frameFile).eq("kind", "frame");
    if (error) return fail(error.message);
    bust();
    return ok;
  } catch (e) { return fail((e as Error).message); }
}

// ── categories ──────────────────────────────────────────────────────────────

export async function upsertCategory(input: { slug: string; name: string; active?: boolean; sort_order?: number }): Promise<ActionResult> {
  try {
    const slug = input.slug.trim().toLowerCase();
    if (!SLUG_RE.test(slug)) return fail("slug: lowercase letters, digits, dashes");
    if (slug === "none") return fail("reserved slug");
    const name = input.name.trim();
    if (!name) return fail("name is required");
    const supabase = await adminClient();
    const row: Record<string, unknown> = { slug, name: name.slice(0, 40) };
    if (input.active !== undefined) row.active = input.active;
    if (input.sort_order !== undefined) row.sort_order = input.sort_order;
    else {
      const { data: last } = await supabase.from("frame_categories").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
      row.sort_order = ((last as { sort_order?: number } | null)?.sort_order ?? 0) + 1;
    }
    const { error } = await supabase.from("frame_categories").upsert(row, { onConflict: "slug" });
    if (error) return fail(error.message);
    bust();
    return ok;
  } catch (e) { return fail((e as Error).message); }
}

export async function updateCategory(slug: string, patch: { name?: string; active?: boolean }): Promise<ActionResult> {
  try {
    const supabase = await adminClient();
    const clean: Record<string, unknown> = {};
    if (patch.name !== undefined) { const n = patch.name.trim(); if (!n) return fail("name is required"); clean.name = n.slice(0, 40); }
    if (patch.active !== undefined) clean.active = patch.active;
    if (!Object.keys(clean).length) return ok;
    const { error } = await supabase.from("frame_categories").update(clean).eq("slug", slug);
    if (error) return fail(error.message);
    bust();
    return ok;
  } catch (e) { return fail((e as Error).message); }
}

// Hard delete is allowed only when no frame (of either activity state) still
// references the category — the FK has no ON DELETE clause, so a stale
// reference would otherwise fail as an opaque constraint violation.
export async function deleteCategory(slug: string): Promise<ActionResult> {
  try {
    if (slug === "none") return fail("reserved slug");
    const supabase = await adminClient();
    const { count, error: countErr } = await supabase
      .from("frames").select("frame_file", { count: "exact", head: true })
      .eq("category_slug", slug);
    if (countErr) return fail(countErr.message);
    if ((count ?? 0) > 0) return fail(`${count} frame(s) still belong to this group — move or delete them first`);
    const { error } = await supabase.from("frame_categories").delete().eq("slug", slug);
    if (error) return fail(error.message);
    bust();
    return ok;
  } catch (e) { return fail((e as Error).message); }
}

export async function reorderCategories(orderedSlugs: string[]): Promise<ActionResult> {
  try {
    const supabase = await adminClient();
    for (let i = 0; i < orderedSlugs.length; i++) {
      const { error } = await supabase.from("frame_categories").update({ sort_order: i + 1 }).eq("slug", orderedSlugs[i]);
      if (error) return fail(error.message);
    }
    bust();
    return ok;
  } catch (e) { return fail((e as Error).message); }
}
