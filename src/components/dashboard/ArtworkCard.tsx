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
}

export function ArtworkCard({
  artwork,
  isFirst: _isFirst,
  isLast: _isLast,
  onUpdate,
  onDelete,
}: ArtworkCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(artwork.title);
  const [medium, setMedium] = useState(artwork.medium);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
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
      const path = extractStoragePath(artwork.file_url);
      if (path) {
        const { error: storageError } = await supabase.storage
          .from("artworks")
          .remove([path]);
        if (storageError) {
          console.error("[delete] storage removal failed:", storageError);
        }
      }

      const { error: dbError } = await supabase
        .from("artworks")
        .delete()
        .eq("id", artwork.id);
      if (dbError) throw dbError;

      onDelete(artwork.id);
    } catch (err) {
      console.error("[delete] failed:", err);
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
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
