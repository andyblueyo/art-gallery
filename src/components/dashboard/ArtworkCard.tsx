"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { DashboardArtwork } from "@/lib/types";

interface ArtworkCardProps {
  artwork: DashboardArtwork;
  isFirst: boolean;
  isLast: boolean;
  onUpdate: (artwork: DashboardArtwork) => void;
  onDelete: (id: string) => void;
  userId: string;
}

export function ArtworkCard({
  artwork,
  isFirst: _isFirst,
  isLast: _isLast,
  onUpdate,
  onDelete,
  userId,
}: ArtworkCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(artwork.title);
  const [medium, setMedium] = useState(artwork.medium);
  const [editingPrice, setEditingPrice] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [forSale, setForSale] = useState(artwork.for_sale ?? false);
  const [priceCoins, setPriceCoins] = useState<number | string>(artwork.price_coins ?? "");
  const priceDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function saveEdit() {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("artworks")
      .update({ title: title.trim(), medium: medium.trim() })
      .eq("id", artwork.id)
      .select()
      .single();

    if (!error && data) {
      onUpdate({ ...artwork, ...(data as DashboardArtwork) });
      setEditing(false);
      setMenuOpen(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    const supabase = createClient();
    try {
      const { error } = await supabase.rpc('remove_artwork', {
        p_artwork_id: artwork.id
      });
      if (error) throw error;
      onDelete(artwork.id);
    } catch (err) {
      console.error("[delete] failed:", err);
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  async function handleToggleForSale(newValue: boolean) {
    setForSale(newValue);
    if (!newValue) setPriceCoins("");
    onUpdate({ ...artwork, for_sale: newValue, price_coins: newValue ? (typeof priceCoins === "number" ? priceCoins : null) : null });

    const supabase = createClient();

    const { error: artworkError } = await supabase
      .from("artworks")
      .update({ for_sale: newValue, price_coins: newValue ? (typeof priceCoins === "number" ? priceCoins : null) : null })
      .eq("id", artwork.id);

    if (artworkError) {
      setForSale(!newValue);
      if (!newValue) setPriceCoins(artwork.price_coins ?? "");
      onUpdate({ ...artwork });
      return;
    }

    await supabase
      .from("inventory_items")
      .update({ listed_for_sale: newValue })
      .eq("artwork_id", artwork.id)
      .eq("owned_by", userId)
      .gt("edition_number", 0);  // never list ed. 0
  }

  function handlePriceChange(val: string) {
    setPriceCoins(val);
    if (priceDebounceRef.current) clearTimeout(priceDebounceRef.current);
    const parsed = parseInt(val, 10);
    if (!val || isNaN(parsed) || parsed < 1) return;
    priceDebounceRef.current = setTimeout(async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("artworks")
        .update({ price_coins: parsed })
        .eq("id", artwork.id)
        .select()
        .single();
      if (!error && data) {
        onUpdate({ ...artwork, ...(data as DashboardArtwork), for_sale: forSale });
      }
    }, 800);
  }

  const isPdf = artwork.file_type === "pdf";
  const hearts = artwork.heart_count ?? 0;

  return (
    <article
      className={`relative rounded-xl border border-[#d8ceb8] bg-white/50 overflow-hidden ${
        artwork._uploading ? "opacity-70" : ""
      }`}
    >
      <div className="relative aspect-square bg-[#ede7da]">
        {artwork._uploading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/40">
            <span className="text-xs text-brown-muted">uploading…</span>
          </div>
        )}
        {isPdf ? (
          <div className="flex h-full flex-col items-center justify-center p-4 text-center">
            <PdfIcon />
            <p className="mt-2 text-xs text-brown-muted line-clamp-2">{artwork.title}</p>
          </div>
        ) : artwork.file_url.startsWith("blob:") ||
          artwork.file_url.startsWith("http") ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={artwork.file_url}
            alt={artwork.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <Image
            src={artwork.file_url}
            alt={artwork.title}
            fill
            className="object-cover"
            unoptimized
            sizes="(max-width: 640px) 100vw, 280px"
          />
        )}
      </div>

      <div className="p-3">
        {editing ? (
          <div className="space-y-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={50}
              className="w-full rounded border border-[#d8ceb8] px-2 py-1 text-sm"
            />
            <p className="text-right text-xs text-brown-muted">{title.length}/50</p>
            <input
              value={medium}
              onChange={(e) => setMedium(e.target.value)}
              maxLength={50}
              className="w-full rounded border border-[#d8ceb8] px-2 py-1 text-sm"
            />
            <p className="text-right text-xs text-brown-muted">{medium.length}/50</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={saveEdit}
                className="text-xs text-[#c8a040] hover:underline"
              >
                save
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setTitle(artwork.title);
                  setMedium(artwork.medium);
                }}
                className="text-xs text-brown-muted hover:underline"
              >
                cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="font-medium text-sm text-brown truncate">{artwork.title}</p>
            {artwork.medium && (
              <p className="text-xs text-brown-muted capitalize truncate">
                {artwork.medium}
              </p>
            )}
            <p className="mt-1 text-xs text-brown-muted">
              {hearts} {hearts === 1 ? "heart" : "hearts"}
            </p>
            {(!artwork.edition_total || artwork.edition_total === 1) ? (
              <p className="mt-1 text-xs text-brown-muted">1 of 1</p>
            ) : (
              <div className="mt-2 space-y-2">
                <p className="text-xs text-brown-muted">
                  {artwork.editions_remaining} of {artwork.edition_total} remaining
                </p>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={forSale}
                    onChange={(e) => handleToggleForSale(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-xs text-brown">for sale</span>
                </label>
                {forSale && (
                  <div className="mt-1">
                    {editingPrice ? (
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-brown-muted">✦</span>
                        <input
                          type="number"
                          min={1}
                          value={priceCoins}
                          onChange={(e) => handlePriceChange(e.target.value)}
                          placeholder="price in coins"
                          autoFocus
                          onBlur={() => setEditingPrice(false)}
                          onKeyDown={(e) => { if (e.key === "Enter") setEditingPrice(false); }}
                          className="w-full rounded border border-[#d8ceb8] px-2 py-1 text-xs"
                        />
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEditingPrice(true)}
                        className="flex items-center gap-1 group"
                      >
                        <span className="text-xs text-brown-muted">✦</span>
                        <span className="text-xs text-brown">
                          {priceCoins !== "" ? `${priceCoins} coins` : "set price"}
                        </span>
                        <span className="text-xs text-brown-muted opacity-0 group-hover:opacity-100 transition-opacity ml-1">
                          ✎
                        </span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <div className="absolute top-2 right-2" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          className="rounded-full bg-white/90 px-2 py-1 text-brown shadow-sm hover:bg-white"
          aria-label="Piece options"
        >
          ⋯
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-8 z-20 min-w-[140px] rounded-lg border border-[#d8ceb8] bg-[#f5f0e8] py-1 shadow-lg">
            <MenuItem
              onClick={() => {
                setEditing(true);
                setMenuOpen(false);
              }}
            >
              edit title / medium
            </MenuItem>
            <MenuItem
              onClick={() => {
                setConfirmDelete(true);
                setMenuOpen(false);
              }}
              className="text-red-700"
            >
              delete
            </MenuItem>
          </div>
        )}
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brown/40 p-4">
          <div className="w-full max-w-sm rounded-xl border border-[#d8ceb8] bg-[#f5f0e8] p-6 shadow-xl">
            <p className="font-serif text-lg text-brown">
              remove this piece from your gallery?
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="flex-1 rounded-lg border border-[#d8ceb8] py-2 text-sm"
              >
                cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 rounded-lg bg-red-700 py-2 text-sm text-white hover:bg-red-800 disabled:opacity-50"
              >
                {deleting ? "removing…" : "remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

function MenuItem({
  children,
  onClick,
  className = "",
}: {
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`block w-full px-3 py-2 text-left text-sm text-brown hover:bg-[#ede7da] ${className}`}
    >
      {children}
    </button>
  );
}

function PdfIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" className="text-[#c8a040]">
      <path
        d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M14 2v6h6" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function extractStoragePath(publicUrl: string): string | null {
  try {
    const marker = "/storage/v1/object/public/artworks/";
    const idx = publicUrl.indexOf(marker);
    if (idx === -1) return null;
    return decodeURIComponent(publicUrl.slice(idx + marker.length));
  } catch {
    return null;
  }
}
