"use client";

import { useMemo, useState } from "react";
import { artworkImageUrl } from "@/lib/artwork-image";
import { getInitials } from "@/lib/initials";
import type { GalleryDirectoryEntry } from "@/lib/types";

type DirectoryGallery = GalleryDirectoryEntry & { url: string };

// Static class names so Tailwind keeps them.
const PREVIEW_COLS = ["", "grid-cols-1", "grid-cols-2", "grid-cols-3"];

export function GalleryDirectory({ galleries }: { galleries: DirectoryGallery[] }) {
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return galleries;
    return galleries.filter(
      (g) => g.handle.includes(q) || g.displayName.toLowerCase().includes(q)
    );
  }, [galleries, query]);

  const noun = (n: number) => (n === 1 ? "gallery" : "galleries");
  const countLabel = query.trim()
    ? `${visible.length} of ${galleries.length} ${noun(galleries.length)}`
    : `${galleries.length} ${noun(galleries.length)}`;

  return (
    <>
      <div className="max-w-md mx-auto mb-12">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="search by name or handle"
          aria-label="Search galleries"
          className="w-full rounded-lg border border-[#D3CEBF] bg-transparent px-4 py-2.5 text-sm text-[#2C2A22] placeholder:text-[#888780] outline-none focus:border-[#2C2A22] transition-colors"
        />
        <p style={{ color: "#888780" }} className="text-xs text-center mt-3" aria-live="polite">
          {countLabel}
        </p>
      </div>

      {visible.length === 0 ? (
        <p style={{ color: "#888780" }} className="text-sm text-center italic py-12">
          {galleries.length === 0 ? "no galleries yet." : `no galleries match “${query.trim()}”.`}
        </p>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {visible.map((gallery) => (
            <li key={gallery.handle}>
              <GalleryCard gallery={gallery} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function GalleryCard({ gallery }: { gallery: DirectoryGallery }) {
  const name = gallery.displayName || gallery.handle;
  const { previews, pieceCount } = gallery;

  return (
    <a
      href={gallery.url}
      className="block rounded-lg overflow-hidden transition-transform hover:scale-[1.02]"
      style={{ border: "1px solid #D3CEBF" }}
    >
      {previews.length > 0 ? (
        <div
          className={`h-48 grid gap-px ${PREVIEW_COLS[previews.length]}`}
          style={{ backgroundColor: "#D3CEBF" }}
        >
          {previews.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={artworkImageUrl(src, previews.length === 1 ? 800 : 480)}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          ))}
        </div>
      ) : (
        <div
          className="h-48 flex items-center justify-center text-sm italic"
          style={{ backgroundColor: "#EAE4D7", color: "#888780" }}
        >
          nothing on the walls yet
        </div>
      )}

      <div className="p-4 flex items-center gap-3" style={{ color: "#2C2A22" }}>
        {gallery.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={gallery.avatarUrl}
            alt=""
            loading="lazy"
            className="h-9 w-9 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span
            aria-hidden
            className="h-9 w-9 shrink-0 rounded-full flex items-center justify-center text-xs font-medium"
            style={{ backgroundColor: "#EAE4D7" }}
          >
            {getInitials(name)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-medium truncate">{name}</p>
          <p style={{ color: "#888780" }} className="text-xs truncate">
            {new URL(gallery.url).host}
          </p>
        </div>
        <p style={{ color: "#888780" }} className="text-xs shrink-0">
          {pieceCount} {pieceCount === 1 ? "piece" : "pieces"}
        </p>
      </div>
    </a>
  );
}
