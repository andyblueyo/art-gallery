"use client";

import { useCallback, useEffect, useState } from "react";
import type { Artwork } from "@/lib/types";
import { FramedArtwork } from "./FramedArtwork";
import { ArtistBubble, type ArtistBubbleData } from "./ArtistBubble";
import { GallerySeeAllGrid } from "./GallerySeeAllGrid";
import {
  type GalleryLayoutItem,
  type WallArtwork,
} from "@/lib/gallery-wall-data";
import { DEFAULT_FRAME_FILE } from "@/lib/frames";

interface GallerySalonWallProps {
  artist: ArtistBubbleData;
  artworks: WallArtwork[];
  layout: GalleryLayoutItem[];
  galleryUrl: string;
  totalPieceCount: number;
  allArtworks?: Artwork[];
}

export function GallerySalonWall({
  artist,
  artworks,
  layout,
  galleryUrl,
  totalPieceCount,
  allArtworks = [],
}: GallerySalonWallProps) {
  const [copied, setCopied] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showAllGrid, setShowAllGrid] = useState(false);

  const hasMoreOnGrid = totalPieceCount > layout.length;

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (isMobile || showAllGrid) {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
      return;
    }
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    };
  }, [isMobile, showAllGrid]);

  const handleShare = useCallback(async () => {
    const url =
      typeof window !== "undefined" ? window.location.href : galleryUrl;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  }, [galleryUrl]);

  if (showAllGrid && allArtworks.length > 0) {
    return (
      <GallerySeeAllGrid
        artworks={allArtworks}
        onClose={() => setShowAllGrid(false)}
      />
    );
  }

  console.log(
    "wallArtworks being rendered:",
    artworks.map((a) => a.src)
  );

  return (
    <div className="gallery-salon-wall relative min-h-[100dvh] w-full overflow-x-hidden bg-[#ddd4b4]">
      <div className="gallery-salon-wall__texture pointer-events-none absolute inset-0" />
      <div className="gallery-salon-wall__vignette pointer-events-none absolute inset-0" />

      <header className="pointer-events-none fixed inset-x-0 top-0 z-30 flex items-start justify-between px-4 py-4 sm:px-6">
        <div className="pointer-events-auto rounded-lg bg-[rgba(18,12,6,0.35)] px-4 py-2 backdrop-blur-md">
          <span className="font-serif text-lg tracking-wide text-[#c8a040]/85">
            artpenny
          </span>
        </div>
        <button
          type="button"
          onClick={handleShare}
          className="pointer-events-auto rounded-lg border border-[#c8a040]/30 bg-[rgba(18,12,6,0.35)] px-4 py-2 text-sm text-[#f5e6c8]/90 backdrop-blur-md transition-colors hover:border-[#c8a040]/60 hover:bg-[rgba(18,12,6,0.5)]"
        >
          share gallery
        </button>
      </header>

      {copied && (
        <div
          role="status"
          className="fixed right-4 top-[4.5rem] z-50 rounded-lg border border-[#c8a040]/40 bg-[rgba(18,12,6,0.92)] px-4 py-2 text-sm text-[#c8a040] shadow-lg"
        >
          copied ✦
        </div>
      )}

      {layout.length === 0 ? (
        <main className="relative z-10 flex min-h-[100dvh] items-center justify-center px-6 pt-24">
          <p className="text-center font-serif text-lg text-[#f5e6c8]/80">
            This gallery is waiting for its first piece.
          </p>
        </main>
      ) : isMobile ? (
        <main className="relative z-10 flex flex-col items-center gap-10 px-4 pb-28 pt-24">
          {layout.map((item, index) => {
            const art = artworks[item.artIndex];
            if (!art) return null;
            const frameFile = art.frame_file || DEFAULT_FRAME_FILE;
            return (
              <FramedArtwork
                key={`${frameFile}-${item.artIndex}-${index}`}
                frame_file={frameFile}
                artSrc={art.src}
                width={Math.min(item.width, 280)}
                title={art.title}
                medium={art.medium}
                artistName={artist.name}
                fileType={art.fileType}
                innerPadding={item.innerPadding}
                style={{ transform: `rotate(${item.rot}deg)` }}
              />
            );
          })}
        </main>
      ) : (
        <main className="relative z-10 h-[100dvh] w-full overflow-hidden">
          {layout.map((item, index) => {
            const art = artworks[item.artIndex];
            if (!art) return null;
            const frameFile = art.frame_file || DEFAULT_FRAME_FILE;
            return (
              <div
                key={`${frameFile}-${item.artIndex}-${index}`}
                className="absolute"
                style={{
                  left: item.left,
                  top: item.top,
                  transform: `rotate(${item.rot}deg)`,
                  transformOrigin: "center center",
                }}
              >
                <FramedArtwork
                  frame_file={frameFile}
                  artSrc={art.src}
                  width={item.width}
                  title={art.title}
                  medium={art.medium}
                  artistName={artist.name}
                  fileType={art.fileType}
                  innerPadding={item.innerPadding}
                />
              </div>
            );
          })}
        </main>
      )}

      {hasMoreOnGrid && (
        <button
          type="button"
          onClick={() => setShowAllGrid(true)}
          className="fixed bottom-6 left-1/2 z-30 -translate-x-1/2 rounded-full border border-[#c8a040]/50 bg-[rgba(18,12,6,0.85)] px-5 py-2.5 text-sm text-[#f5e6c8] shadow-lg backdrop-blur-sm transition-colors hover:border-[#c8a040] hover:bg-[rgba(18,12,6,0.95)]"
        >
          see all work ({totalPieceCount})
        </button>
      )}

      <ArtistBubble artist={artist} />
    </div>
  );
}
