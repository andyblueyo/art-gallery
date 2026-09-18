"use client";

// /admin/frames — list grouped by category (drag to reorder, active toggle,
// live usage count), PNG upload with auto-traced window, the shape editor,
// and category management. All writes go through server actions in
// ./actions.ts; RLS on the tables is the real guard.

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  frameImageUrl,
  frameRowToConfig,
  windowToBBox,
  type FrameCategoryRow,
  type FrameConfig,
  type FrameRow,
  type FrameWindow,
} from "@/lib/frames";
import { alphaFromImage, traceWindowFromAlpha } from "@/lib/frame-tracer";
import {
  createFrame,
  deleteFrame,
  reorderFrames,
  saveFrameGeometry,
  updateFrameMeta,
} from "@/app/admin/frames/actions";
import { FrameShapeEditor } from "./FrameShapeEditor";
import { CategoryManager } from "./CategoryManager";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { SecondaryButton } from "@/components/ui/SecondaryButton";

interface Props {
  initialFrames: FrameRow[];
  initialCategories: FrameCategoryRow[];
  usage: Record<string, number>;
  loadError: string | null;
}

type Editing =
  | { kind: "edit"; row: FrameRow; window: FrameWindow }
  | {
      kind: "new";
      file: File;
      objectUrl: string;
      aspect: number;
      window: FrameWindow;
      name: string;
      key: string;
      category: string;
      flags: string[];
    };

const DEFAULT_WINDOW: FrameWindow = { kind: "rect", x: 0.1, y: 0.1, w: 0.8, h: 0.8, radius: 0 };
const slugify = (s: string) => s.toLowerCase().replace(/\.png$/i, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

export function FramesAdmin({ initialFrames, initialCategories, usage, loadError }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [frames, setFrames] = useState(initialFrames);
  const [error, setError] = useState<string | null>(loadError);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => setFrames(initialFrames), [initialFrames]);

  const refresh = useCallback(() => router.refresh(), [router]);
  const run = (p: Promise<{ ok: boolean; error?: string }>, after?: () => void) =>
    start(async () => {
      const r = await p;
      if (!r.ok) setError(r.error ?? "failed");
      else { setError(null); after?.(); }
      refresh();
    });

  const categories = useMemo(() => [...initialCategories].sort((a, b) => a.sort_order - b.sort_order), [initialCategories]);
  const realFrames = frames.filter((f) => f.kind === "frame");
  const grouped = useMemo(() => {
    const g: Record<string, FrameRow[]> = {};
    for (const f of realFrames) (g[f.category_slug ?? "__none"] ??= []).push(f);
    for (const k of Object.keys(g)) g[k].sort((a, b) => a.sort_order - b.sort_order);
    return g;
  }, [realFrames]);
  const orphanSlugs = Object.keys(grouped).filter((k) => !categories.some((c) => c.slug === k));
  const frameCounts = Object.fromEntries(Object.entries(grouped).map(([k, v]) => [k, v.length]));

  // ── drag to reorder / move between groups ─────────────────────────────────
  const dropOn = (targetSlug: string, beforeKey: string | null) => {
    if (!dragKey || dragKey === beforeKey) return;
    const src = realFrames.find((f) => f.frame_file === dragKey);
    if (!src) return;
    const srcSlug = src.category_slug ?? "__none";
    const target = (grouped[targetSlug] ?? []).filter((f) => f.frame_file !== dragKey).map((f) => f.frame_file);
    const idx = beforeKey ? target.indexOf(beforeKey) : -1;
    if (idx === -1) target.push(dragKey); else target.splice(idx, 0, dragKey);
    // optimistic local order
    setFrames((prev) => prev.map((f) => {
      const i = target.indexOf(f.frame_file);
      if (i !== -1) return { ...f, sort_order: i + 1, category_slug: targetSlug };
      return f;
    }));
    setDragKey(null);
    start(async () => {
      let r = await reorderFrames(targetSlug, target);
      if (r.ok && srcSlug !== targetSlug && srcSlug !== "__none") {
        const rest = (grouped[srcSlug] ?? []).filter((f) => f.frame_file !== dragKey).map((f) => f.frame_file);
        r = await reorderFrames(srcSlug, rest);
      }
      if (!r.ok) setError(r.error ?? "reorder failed"); else setError(null);
      refresh();
    });
  };

  // ── upload → trace → editor ───────────────────────────────────────────────
  const onFile = async (file: File | null) => {
    if (!file) return;
    if (file.type !== "image/png") { setError("Frames must be PNG with a transparent window."); return; }
    setError(null);
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error("could not decode PNG")); img.src = objectUrl; }).catch((e) => setError((e as Error).message));
    if (!img.naturalWidth) return;
    const aspect = img.naturalWidth / img.naturalHeight;
    let window: FrameWindow = DEFAULT_WINDOW, flags: string[] = [];
    try {
      const { alpha, width, height } = alphaFromImage(img);
      const t = traceWindowFromAlpha(alpha, width, height);
      if (t) { window = t.window; flags = t.flags; } else flags = ["no enclosed transparent region found — draw the window by hand"];
    } catch (e) { flags = [`trace failed: ${(e as Error).message}`]; }
    const base = slugify(file.name) || "frame";
    const category = categories.find((c) => c.active)?.slug ?? categories[0]?.slug ?? "classic";
    setEditing({ kind: "new", file, objectUrl, aspect, window, name: base.replace(/-/g, " "), key: `${category}/${base}.png`, category, flags });
    if (fileInput.current) fileInput.current.value = "";
  };

  const saveEditing = () => {
    if (!editing) return;
    if (editing.kind === "edit") {
      run(saveFrameGeometry(editing.row.frame_file, editing.window), () => setEditing(null));
      return;
    }
    const e = editing;
    if (realFrames.some((f) => f.frame_file === e.key)) { setError(`key "${e.key}" already exists`); return; }
    start(async () => {
      // 1. the PNG, at the exact path the row will point to (bucket is admin-write via RLS)
      const supabase = createClient();
      const { error: upErr } = await supabase.storage.from("frames").upload(e.key, e.file, { contentType: "image/png", upsert: false, cacheControl: "31536000" });
      if (upErr) { setError(`upload failed: ${upErr.message}`); return; }
      // 2. the row
      const r = await createFrame({ frame_file: e.key, name: e.name, category_slug: e.category, aspect: e.aspect, window: e.window });
      if (!r.ok) { setError(`${r.error} — the PNG was uploaded to ${e.key}; fix and save again with the same key`); return; }
      URL.revokeObjectURL(e.objectUrl);
      setEditing(null); setError(null);
      refresh();
    });
  };

  const draft: FrameConfig | null = editing
    ? editing.kind === "edit"
      ? { ...frameRowToConfig(editing.row), window: editing.window, bbox: windowToBBox(editing.window) }
      : { ...frameRowToConfig({ frame_file: editing.key, kind: "frame", name: editing.name, category_slug: editing.category, sort_order: 0, image_path: editing.objectUrl, window: editing.window, bbox: windowToBBox(editing.window), aspect: editing.aspect, crop_padding: null, active: true }) }
    : null;

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl text-brown">frames</h1>
          <p className="mt-1 text-sm text-brown-muted">
            {realFrames.length} frames · {Object.values(usage).reduce((a, b) => a + b, 0)} live pieces. Saves go live within seconds; no deploy.
            Run <code className="rounded bg-[#ede7da] px-1 text-xs">node scripts/snapshot-frames.mjs</code> afterwards to refresh the committed fallback.
          </p>
        </div>
        <div
          onDragOver={(e) => { e.preventDefault(); }}
          onDrop={(e) => { e.preventDefault(); void onFile(e.dataTransfer.files?.[0] ?? null); }}
          onClick={() => fileInput.current?.click()}
          className="cursor-pointer rounded-xl border-2 border-dashed border-[#c8a040] bg-[#faf7f0]/80 px-6 py-4 text-center text-sm text-brown hover:bg-[#faf7f0]"
        >
          <input ref={fileInput} type="file" accept="image/png" className="hidden" onChange={(e) => void onFile(e.target.files?.[0] ?? null)} />
          drop a frame PNG here or <span className="text-[#c8a040] underline underline-offset-2">browse</span>
          <p className="mt-1 text-xs text-brown-muted">transparent window · the tracer proposes the shape</p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-800">
          {error} <button type="button" className="ml-2 underline" onClick={() => setError(null)}>dismiss</button>
        </div>
      )}

      {/* editor modal */}
      {editing && draft && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/50 p-4 sm:p-8" onClick={() => !pending && setEditing(null)}>
          <div className="w-full max-w-4xl rounded-2xl bg-[#f5f0e8] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex flex-wrap items-end gap-3">
              {editing.kind === "edit" ? (
                <h2 className="font-serif text-xl text-brown">{editing.row.name} <code className="ml-2 text-xs text-brown-muted">{editing.row.frame_file}</code></h2>
              ) : (
                <>
                  <label className="text-xs text-brown-muted">name
                    <input value={editing.name} maxLength={60} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="mt-1 block w-44 rounded border border-[#d8ceb8] bg-white/70 px-2 py-1 text-sm text-brown" />
                  </label>
                  <label className="text-xs text-brown-muted">category
                    <select value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value, key: editing.key.replace(/^[^/]*\//, `${e.target.value}/`) })} className="mt-1 block rounded border border-[#d8ceb8] bg-white/70 px-2 py-1 text-sm text-brown">
                      {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
                    </select>
                  </label>
                  <label className="text-xs text-brown-muted">key <span className="text-brown-muted/70">(permanent — stored on every artwork)</span>
                    <input value={editing.key} onChange={(e) => setEditing({ ...editing, key: e.target.value.toLowerCase() })} className="mt-1 block w-64 rounded border border-[#d8ceb8] bg-white/70 px-2 py-1 font-mono text-xs text-brown" />
                  </label>
                </>
              )}
            </div>
            {editing.kind === "new" && editing.flags.length > 0 && (
              <p className="mb-3 text-xs text-[#8a6d2f]">tracer: {editing.flags.join(" · ")}</p>
            )}

            <FrameShapeEditor draft={draft} onChange={(w) => setEditing({ ...editing, window: w })} />

            <div className="mt-6 flex items-center justify-between">
              <SecondaryButton onClick={() => { if (editing.kind === "new") URL.revokeObjectURL(editing.objectUrl); setEditing(null); }} disabled={pending}>cancel</SecondaryButton>
              <PrimaryButton onClick={saveEditing} disabled={pending}>{pending ? "saving…" : editing.kind === "new" ? "upload & create" : "save window"}</PrimaryButton>
            </div>
          </div>
        </div>
      )}

      {/* grouped list */}
      {[...categories.map((c) => ({ slug: c.slug, name: c.name, active: c.active })), ...orphanSlugs.map((s) => ({ slug: s, name: s === "__none" ? "(no category)" : `(missing group: ${s})`, active: false }))].map((cat) => (
        <section key={cat.slug} className={`rounded-xl border border-[#d8ceb8] bg-white/50 ${cat.active ? "" : "opacity-70"}`}>
          <header className="flex items-center gap-3 border-b border-[#e6ddcb] px-4 py-2">
            <h2 className="font-serif text-lg text-brown">{cat.name}</h2>
            <code className="text-xs text-brown-muted">{cat.slug}</code>
            {!cat.active && <span className="rounded-full border border-[#d8ceb8] px-2 py-0.5 text-[10px] uppercase tracking-wide text-brown-muted">inactive</span>}
            <span className="ml-auto text-xs text-brown-muted">{(grouped[cat.slug] ?? []).length} frames</span>
          </header>
          <ul>
            {(grouped[cat.slug] ?? []).map((f) => {
              const cfg = frameRowToConfig(f);
              const n = usage[f.frame_file] ?? 0;
              return (
                <li
                  key={f.frame_file}
                  draggable
                  onDragStart={() => setDragKey(f.frame_file)}
                  onDragEnd={() => setDragKey(null)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); dropOn(cat.slug, f.frame_file); }}
                  className={`flex items-center gap-3 border-b border-[#f0e9dc] px-4 py-2 ${dragKey === f.frame_file ? "opacity-40" : ""} ${f.active ? "" : "bg-[#ede7da]/60"}`}
                >
                  <span className="cursor-grab select-none text-brown-muted" title="drag to reorder">⋮⋮</span>
                  <div className="h-12 w-12 shrink-0 rounded bg-[#faf7f0] p-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={frameImageUrl(cfg, 240)} alt="" loading="lazy" decoding="async" className="h-full w-full object-contain" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <input
                      value={names[f.frame_file] ?? f.name}
                      onChange={(e) => setNames((s) => ({ ...s, [f.frame_file]: e.target.value }))}
                      onBlur={() => { const v = (names[f.frame_file] ?? f.name).trim(); if (v && v !== f.name) run(updateFrameMeta(f.frame_file, { name: v })); }}
                      maxLength={60}
                      className="w-full max-w-xs rounded border border-transparent bg-transparent px-1 py-0.5 text-sm text-brown hover:border-[#d8ceb8] focus:border-[#c8a040] focus:outline-none"
                    />
                    <div className="flex gap-3 truncate px-1 text-[11px] text-brown-muted">
                      <code>{f.frame_file}</code>
                      <span>{f.window ? f.window.kind : <span className="text-red-700">no window</span>}</span>
                      <span>aspect {f.aspect?.toFixed(3) ?? "?"}</span>
                    </div>
                  </div>
                  <span className={`w-20 text-right text-xs ${n ? "text-brown" : "text-brown-muted"}`} title="live pieces using this frame">
                    {n} {n === 1 ? "piece" : "pieces"}
                  </span>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(updateFrameMeta(f.frame_file, { active: !f.active }))}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${f.active ? "bg-[#3b2a1a] text-[#faf7f0]" : "border border-[#d8ceb8] text-brown-muted"}`}
                    title={f.active ? `in the picker · ${n} existing piece(s) keep rendering either way` : "hidden from the picker"}
                  >
                    {f.active ? "active" : "inactive"}
                  </button>
                  <button type="button" onClick={() => setEditing({ kind: "edit", row: f, window: f.window ?? DEFAULT_WINDOW })} className="rounded-lg border border-[#d8ceb8] px-3 py-1 text-xs text-brown hover:border-[#c8a040]/60">edit shape</button>
                  {n === 0 && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => { if (confirm(`Delete "${f.name}" (${f.frame_file})? No live pieces use it. The PNG stays in Storage.`)) run(deleteFrame(f.frame_file)); }}
                      className="rounded-lg border border-transparent px-2 py-1 text-xs text-red-700 hover:border-red-300"
                      title="hard delete — only offered at zero usage"
                    >
                      delete
                    </button>
                  )}
                </li>
              );
            })}
            <li
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); dropOn(cat.slug, null); }}
              className={`px-4 py-2 text-center text-[11px] text-brown-muted ${dragKey ? "border-2 border-dashed border-[#c8a040]/50" : ""}`}
            >
              {dragKey ? "drop here to move to the end of this group" : " "}
            </li>
          </ul>
        </section>
      ))}

      <p className="text-xs text-brown-muted">
        The unframed option (<code>none</code>) is a fixed row with no image or window and is not listed above.
      </p>

      <CategoryManager categories={categories} frameCounts={frameCounts} onChanged={refresh} onError={setError} />
    </div>
  );
}
