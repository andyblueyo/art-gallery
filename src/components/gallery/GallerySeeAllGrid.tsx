"use client";

import Image from "next/image";
import type { Artwork } from "@/lib/types";
import { HeartButton } from "@/components/ui/HeartButton";

interface GallerySeeAllGridProps {
  artworks: Artwork[];
  onClose: () => void;
  isOwner?: boolean;
  isLoggedIn?: boolean;
}

export function GallerySeeAllGrid({
  artworks,
  onClose,
  isOwner = false,
  isLoggedIn = false,
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
      <div className="mx-auto max-w-5xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 p-6 pb-16">
        {artworks.map((art) => (
          <article
            key={art.id}
            className="rounded-xl border border-[#d8ceb8] bg-white/50 overflow-hidden"
          >
            <div className="relative aspect-square bg-[#ede7da]">
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
                  src={art.file_url}
                  alt={art.title}
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
              {isLoggedIn && (
                <div className="absolute bottom-2 right-2 z-10">
                  <HeartButton
                    pieceId={art.id}
                    isOwner={isOwner}
                    initialHeartCount={art.heart_count ?? 0}
                    isLoggedIn={isLoggedIn}
                  />
                </div>
              )}
            </div>
            <div className="p-3">
              <p className="font-medium text-sm text-brown">{art.title}</p>
              {art.medium && (
                <p className="text-xs text-brown-muted capitalize">{art.medium}</p>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
