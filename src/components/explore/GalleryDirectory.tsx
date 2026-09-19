"use client";

import { useMemo, useState } from "react";
import { avatarImageUrl } from "@/lib/artwork-image";
import { getInitials } from "@/lib/initials";
import type { GalleryDirectoryEntry } from "@/lib/types";
import { WallCover } from "./WallCover";

export type DirectoryGallery = GalleryDirectoryEntry & { url: string };

// Avatars show at 36px; this covers 2–3x screens.
const AVATAR_PX = 96;

type SortKey = "recent" | "pieces" | "name";

// "recent" is the order the server already returns (newest work first).
const SORTS: { key: SortKey; label: string }[] = [
  { key: "recent", label: "recently updated" },
  { key: "pieces", label: "most pieces" },
  { key: "name", label: "a–z" },
];

const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });
const nameOf = (g: DirectoryGallery) => g.displayName || g.handle;

export function GalleryDirectory({ galleries }: { galleries: DirectoryGallery[] }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [hideEmpty, setHideEmpty] = useState(false);

  const q = query.trim().toLowerCase();

  const visible = useMemo(() => {
    const list = galleries.filter(
      (g) =>
        (!hideEmpty || g.pieceCount > 0) &&
        (!q || g.handle.includes(q) || g.displayName.toLowerCase().includes(q))
    );
    // Sorts are stable, so ties keep the recency order.
    if (sort === "pieces") list.sort((a, b) => b.pieceCount - a.pieceCount);
    else if (sort === "name") list.sort((a, b) => collator.compare(nameOf(a), nameOf(b)));
    return list;
  }, [galleries, q, hideEmpty, sort]);

  const noun = (n: number) => (n === 1 ? "gallery" : "galleries");
  const countLabel = q || hideEmpty
    ? `${visible.length} of ${galleries.length} ${noun(galleries.length)}`
    : `${galleries.length} ${noun(galleries.length)}`;

  const emptyMessage =
    galleries.length === 0 ? "no galleries yet."
    : q ? `no galleries match “${query.trim()}”.`
    : "no galleries with work up yet.";

  return (
    <>
      <div className="max-w-2xl mx-auto mb-12">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="search by name or handle"
            aria-label="Search galleries"
            className="w-full sm:flex-1 rounded-lg border border-[#D3CEBF] bg-transparent px-4 py-2.5 text-sm text-[#2C2A22] placeholder:text-[#888780] outline-none focus:border-[#2C2A22] transition-colors"
          />
          <div className="flex items-center justify-between sm:justify-start gap-4">
            <div className="relative">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                aria-label="Sort galleries"
                className="appearance-none cursor-pointer rounded-lg border border-[#D3CEBF] bg-transparent pl-4 pr-9 py-2.5 text-sm text-[#2C2A22] outline-none focus:border-[#2C2A22] transition-colors"
              >
                {SORTS.map(({ key, label }) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
              <svg
                aria-hidden
                viewBox="0 0 12 12"
                className="pointer-events-none absolute right-3.5 top-1/2 h-3 w-3 -translate-y-1/2 text-[#888780]"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 4.5 6 7.5 9 4.5" />
              </svg>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={hideEmpty}
              onClick={() => setHideEmpty((v) => !v)}
              className="inline-flex shrink-0 items-center gap-2 text-sm text-[#888780] hover:text-[#2C2A22] transition-colors"
            >
              <span
                aria-hidden
                className={`relative h-4 w-7 rounded-full transition-colors ${hideEmpty ? "bg-[#2C2A22]" : "bg-[#D3CEBF]"}`}
              >
                <span
                  className={`absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-[#F2EDE3] transition-transform ${
                    hideEmpty ? "translate-x-3" : ""
                  }`}
                />
              </span>
              hide empty
            </button>
          </div>
        </div>
        <p style={{ color: "#888780" }} className="text-xs text-center mt-3" aria-live="polite">
          {countLabel}
        </p>
      </div>

      {visible.length === 0 ? (
        <p style={{ color: "#888780" }} className="text-sm text-center italic py-12">
          {emptyMessage}
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

export function GalleryCard({ gallery }: { gallery: DirectoryGallery }) {
  const name = nameOf(gallery);
  const { pieceCount } = gallery;

  return (
    <a
      href={gallery.url}
      className="group block rounded-lg overflow-hidden transition-transform hover:scale-[1.02]"
      style={{ border: "1px solid #D3CEBF" }}
    >
      <WallCover wall={gallery.wall} />

      <div className="p-4 flex items-center gap-3" style={{ color: "#2C2A22" }}>
        {gallery.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarImageUrl(gallery.avatarUrl, AVATAR_PX)}
            alt=""
            loading="lazy"
            decoding="async"
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
