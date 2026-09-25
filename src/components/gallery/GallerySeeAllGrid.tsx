"use client";

import Image from "next/image";
import type { Artwork } from "@/lib/types";
import { GalleryPieceSealCard } from "./GalleryPieceCard";
import { artworkImageUrl } from "@/lib/artwork-image";

interface GallerySeeAllGridProps {
  artworks: Artwork[];
  onClose: () => void;
  isOwner?: boolean;
  isLoggedIn?: boolean;
  collectableItems?: Record<string, string>;
  collectorCoinBalance?: number;
}

export function GallerySeeAllGrid({
  artworks,
  onClose,
  isOwner = false,
  isLoggedIn = false,
  collectableItems = {},
  collectorCoinBalance = 0,
}: GallerySeeAllGridProps) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#f5f0e8]">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-[#d8ceb8] bg-[#f5f0e8]/95 px-5 py-4 backdrop-blur-sm">
        <h2 className="font-serif text-xl text-brown">all work</h2>
        <button
          type="button"
          onClick={onClose}
          className="text-sm text-[#c8a040] hover:underline"
        >
          back to wall
        </button>
      </header>
      <div className="mx-auto max-w-5xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-10 p-6 pb-16">
        {artworks.map((art) => (
          <article key={art.id} className="flex flex-col items-center gap-4">
            <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-[#d8ceb8] bg-[#ede7da]">
              {art.file_type === "pdf" ? (
                <div className="flex h-full flex-col items-center justify-center p-4">
                  <span className="text-3xl text-[#c8a040]">📄</span>
                  <p className="mt-2 text-xs text-brown-muted text-center line-clamp-2">
                    {art.title}
                  </p>
                </div>
              ) : art.file_url.startsWith("http") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={artworkImageUrl(art.file_url, 800)}
                  alt={art.title}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              ) : (
                <Image
                  src={art.file_url}
                  alt={art.title}
                  fill
                  className="object-cover"
                  unoptimized
                  sizes="300px"
                />
              )}
            </div>
            <GalleryPieceSealCard
              artworkId={art.id}
              title={art.title}
              medium={art.medium}
              heartCount={art.heart_count ?? 0}
              isOwner={isOwner}
              isLoggedIn={isLoggedIn}
              collect={
                !isOwner && collectableItems[art.id] && art.for_sale && art.price_coins != null
                  ? {
                      inventoryItemId: collectableItems[art.id],
                      priceCoins: art.price_coins,
                      editionsRemaining: art.editions_remaining ?? 0,
                      collectorCoinBalance,
                    }
                  : null
              }
            />
          </article>
        ))}
      </div>
    </div>
  );
}
