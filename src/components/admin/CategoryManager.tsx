"use client";

// Add / rename / reorder / deactivate picker groups. Slugs are fixed once
// created (frames reference them); names are free to change.

import { useState, useTransition } from "react";
import type { FrameCategoryRow } from "@/lib/frames";
import { reorderCategories, updateCategory, upsertCategory } from "@/app/admin/frames/actions";

interface Props {
  categories: FrameCategoryRow[];
  frameCounts: Record<string, number>;
  onChanged: () => void;
  onError: (msg: string) => void;
}

export function CategoryManager({ categories, frameCounts, onChanged, onError }: Props) {
  const [pending, start] = useTransition();
  const [newSlug, setNewSlug] = useState("");
  const [newName, setNewName] = useState("");
  const [names, setNames] = useState<Record<string, string>>({});

  const run = (p: Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const r = await p;
      if (!r.ok) onError(r.error ?? "failed");
      onChanged();
    });

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= categories.length) return;
    const order = categories.map((c) => c.slug);
    [order[i], order[j]] = [order[j], order[i]];
    run(reorderCategories(order));
  };

  return (
    <section className="rounded-xl border border-[#d8ceb8] bg-white/50 p-4">
      <h2 className="font-serif text-lg text-brown">categories</h2>
      <p className="mb-3 text-xs text-brown-muted">Picker tabs, in this order. Inactive groups hide from the picker; their frames keep rendering.</p>
      <ul className="divide-y divide-[#e6ddcb]">
        {categories.map((c, i) => (
          <li key={c.slug} className="flex items-center gap-3 py-2">
            <div className="flex flex-col">
              <button type="button" disabled={i === 0 || pending} onClick={() => move(i, -1)} className="text-xs text-brown-muted hover:text-brown disabled:opacity-30">▲</button>
              <button type="button" disabled={i === categories.length - 1 || pending} onClick={() => move(i, 1)} className="text-xs text-brown-muted hover:text-brown disabled:opacity-30">▼</button>
            </div>
            <code className="w-24 shrink-0 truncate text-xs text-brown-muted">{c.slug}</code>
            <input
              value={names[c.slug] ?? c.name}
              onChange={(e) => setNames((n) => ({ ...n, [c.slug]: e.target.value }))}
              onBlur={() => {
                const v = (names[c.slug] ?? c.name).trim();
                if (v && v !== c.name) run(updateCategory(c.slug, { name: v }));
              }}
              maxLength={40}
              className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-2 py-1 text-sm text-brown hover:border-[#d8ceb8] focus:border-[#c8a040] focus:outline-none"
            />
            <span className="w-16 text-right text-xs text-brown-muted">{frameCounts[c.slug] ?? 0} frames</span>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(updateCategory(c.slug, { active: !c.active }))}
              className={`rounded-full px-3 py-1 text-xs font-medium ${c.active ? "bg-[#3b2a1a] text-[#faf7f0]" : "border border-[#d8ceb8] text-brown-muted"}`}
              title={c.active ? "shown in picker" : "hidden from picker"}
            >
              {c.active ? "active" : "inactive"}
            </button>
          </li>
        ))}
      </ul>
      <form
        className="mt-3 flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!newSlug.trim() || !newName.trim()) return;
          run(upsertCategory({ slug: newSlug, name: newName }));
          setNewSlug(""); setNewName("");
        }}
      >
        <label className="text-xs text-brown-muted">
          slug
          <input value={newSlug} onChange={(e) => setNewSlug(e.target.value.toLowerCase())} placeholder="e.g. vintage" pattern="[a-z0-9][a-z0-9-]*" className="mt-1 block w-32 rounded border border-[#d8ceb8] bg-white/70 px-2 py-1 text-sm text-brown" />
        </label>
        <label className="text-xs text-brown-muted">
          name
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="tab label" maxLength={40} className="mt-1 block w-40 rounded border border-[#d8ceb8] bg-white/70 px-2 py-1 text-sm text-brown" />
        </label>
        <button type="submit" disabled={pending || !newSlug || !newName} className="rounded-lg bg-[#c8a040] px-4 py-1.5 text-sm font-medium text-[#1a1208] hover:bg-[#e0c060] disabled:opacity-50">add group</button>
      </form>
    </section>
  );
}
