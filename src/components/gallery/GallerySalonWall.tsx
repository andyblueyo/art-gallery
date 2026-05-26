"use client";

import { useCallback, useEffect, useState } from "react";
import React from "react";
import type { Artwork } from "@/lib/types";
import { FramedArtwork } from "./FramedArtwork";
import { ArtistBubble, type ArtistBubbleData } from "./ArtistBubble";
import { GallerySeeAllGrid } from "./GallerySeeAllGrid";
import { GalleryEditorCanvas } from "./GalleryEditorCanvas";
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
  isOwner?: boolean;
  profileId?: string;
  layoutMode?: string;
}

export function GallerySalonWall({
  artist,
  artworks,
  layout,
  galleryUrl,
  totalPieceCount,
  allArtworks = [],
  isOwner = false,
  profileId = "",
  layoutMode = "auto",
}: GallerySalonWallProps) {
  const [copied, setCopied] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showAllGrid, setShowAllGrid] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const hasMoreOnGrid = totalPieceCount > layout.length;
  const isCustomLayout = layoutMode === "custom";

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (editMode) return; // editor manages overflow
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
  }, [isMobile, showAllGrid, editMode]);

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

  return (
    <>
      {/* ── Editor overlay ───────────────────────────────────── */}
      {editMode && (
        <GalleryEditorCanvas
          artworks={allArtworks}
          profileId={profileId}
          onCancel={() => setEditMode(false)}
          onSaved={() => setEditMode(false)}
        />
      )}

      {/* ── Gallery view ─────────────────────────────────────── */}
      <div className="gallery-salon-wall relative min-h-[100dvh] w-full overflow-x-hidden bg-[#ddd4b4]">
        <div className="gallery-salon-wall__texture pointer-events-none absolute inset-0" />
        <div className="gallery-salon-wall__vignette pointer-events-none absolute inset-0" />

        <header className="pointer-events-none fixed inset-x-0 top-0 z-30 flex items-start justify-between px-4 py-4 sm:px-6">
          <div className="pointer-events-auto rounded-lg bg-[rgba(18,12,6,0.35)] px-4 py-2 backdrop-blur-md">
            <span className="font-serif text-lg tracking-wide text-[#c8a040]/85">
              artpenny
            </span>
          </div>

          <div className="flex items-center gap-2">
            {isOwner && (
              <button
                type="button"
                onClick={() => setEditMode(true)}
                className="pointer-events-auto rounded-lg border border-[#c8a040]/50 bg-[rgba(18,12,6,0.55)] px-4 py-2 text-sm text-[#c8a040] backdrop-blur-md transition-colors hover:border-[#c8a040] hover:bg-[rgba(18,12,6,0.75)]"
              >
                Edit Layout
              </button>
            )}
            <button
              type="button"
              onClick={handleShare}
              className="pointer-events-auto rounded-lg border border-[#c8a040]/30 bg-[rgba(18,12,6,0.35)] px-4 py-2 text-sm text-[#f5e6c8]/90 backdrop-blur-md transition-colors hover:border-[#c8a040]/60 hover:bg-[rgba(18,12,6,0.5)]"
            >
              share gallery
            </button>
          </div>
        </header>

        {copied && (
          <div
            role="status"
            className="fixed right-4 top-[4.5rem] z-50 rounded-lg border border-[#c8a040]/40 bg-[rgba(18,12,6,0.92)] px-4 py-2 text-sm text-[#c8a040] shadow-lg"
          >
            copied ✦
          </div>
        )}

        {/* ── Custom layout ──────────────────────────────────── */}
        {isCustomLayout && allArtworks.length > 0 ? (
          <CustomLayoutView artworks={allArtworks} artistName={artist.name} />
        ) : layout.length === 0 ? (
          <main className="relative z-10 flex min-h-[100dvh] items-center justify-center px-6 pt-24">
            <p className="text-center font-serif text-lg text-[#f5e6c8]/80">
              This gallery is waiting for its first piece.
            </p>
          </main>
        ) : isMobile ? (
          /* Mobile auto layout */
          <main className="relative z-10 flex flex-col items-center gap-10 px-4 pb-28 pt-24">
            {layout.map((item, index) => {
              const art = artworks[item.artIndex];
              if (!art) return null;
              const frameFile = art.frame_file || DEFAULT_FRAME_FILE;
              const isLarger = index % 3 === 2;
              const baseWidth = 280;
              const width = isLarger ? baseWidth * 1.2 : baseWidth;
              return (
                <div
                  key={`${frameFile}-${item.artIndex}-${index}`}
                  style={{ transform: isLarger ? "scale(1.2)" : "scale(1)" }}
                >
                  <FramedArtwork
                    frame_file={frameFile}
                    artSrc={art.src}
                    width={Math.min(width, 280)}
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
        ) : (
          /* Desktop auto layout */
          <main className="relative z-10 w-full overflow-y-auto px-6 py-12 pb-28 pt-24">
            <div className="grid auto-rows-max gap-10 md:grid-cols-2 lg:grid-cols-3">
              {layout.map((item, index) => {
                const art = artworks[item.artIndex];
                if (!art) return null;
                const frameFile = art.frame_file || DEFAULT_FRAME_FILE;
                const isLarger = index % 3 === 2;
                return (
                  <div
                    key={`${frameFile}-${item.artIndex}-${index}`}
                    className="flex items-center justify-center"
                    style={{ transform: isLarger ? "scale(1.2)" : "scale(1)" }}
                  >
                    <FramedArtwork
                      frame_file={frameFile}
                      artSrc={art.src}
                      width={280}
                      title={art.title}
                      medium={art.medium}
                      artistName={artist.name}
                      fileType={art.fileType}
                      innerPadding={item.innerPadding}
                    />
                  </div>
                );
              })}
            </div>
          </main>
        )}

        {!isCustomLayout && hasMoreOnGrid && (
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
    </>
  );
}

// ── Custom layout view (read-only) ──────────────────────────────
function CustomLayoutView({
  artworks,
  artistName,
}: {
  artworks: Artwork[];
  artistName: string;
}) {
  const [hoveredId, setHoveredId] = React.useState<string | null>(null);
  const positioned = artworks.filter(a => a.position_x != null);

  if (positioned.length === 0) {
    return (
      <main className="relative z-10 flex min-h-[100dvh] items-center justify-center px-6 pt-24">
        <p className="text-center font-serif text-lg text-[#f5e6c8]/80">
          This gallery is waiting for its first piece.
        </p>
      </main>
    );
  }

  return (
    <main className="relative z-10 h-[100dvh] w-full overflow-hidden pt-14">
      {positioned.map((art, i) => {
        const xPct = art.position_x!;
        const yPct = art.position_y!;
        const rotation = art.rotation ?? 0;
        const scale = art.scale ?? 1;
        const zIndex = art.z_index ?? (i + 1);
        const baseWidth = 220;
        const baseHeight = 220 * 1.3;

        // Calculate rotated bounding box for tooltip positioning
        const radians = (rotation * Math.PI) / 180;
        const cos = Math.abs(Math.cos(radians));
        const sin = Math.abs(Math.sin(radians));
        const rotatedWidth = (baseWidth * cos + baseHeight * sin) * scale;
        const rotatedHeight = (baseWidth * sin + baseHeight * cos) * scale;
        
        // Bottom-center of the rotated artwork
        const tooltipLeft = `calc(${xPct}% + ${rotatedWidth / 2}px)`;
        const tooltipTop = `calc(${yPct}% + ${rotatedHeight}px + 12px)`;

        return (
          <React.Fragment key={art.id}>
            {/* Artwork */}
            <div
              style={{
                position: "absolute",
                left: `${xPct}%`,
                top: `${yPct}%`,
                zIndex,
                transform: `rotate(${rotation}deg) scale(${scale})`,
                transformOrigin: "top left",
              }}
              onMouseEnter={() => setHoveredId(art.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <FramedArtwork
                frame_file={art.frame_file || DEFAULT_FRAME_FILE}
                artSrc={art.file_url}
                width={baseWidth}
                title={art.title}
                medium={art.medium}
                artistName={artistName}
                fileType={art.file_type}
                showTooltip={false}
              />
            </div>
            
            {/* External tooltip - always horizontal, at visual bottom */}
            {hoveredId === art.id && (
              <div
                style={{
                  position: "absolute",
                  left: tooltipLeft,
                  top: tooltipTop,
                  transform: 'translateX(-50%)',
                  zIndex: 9999,
                }}
                className="pointer-events-none whitespace-nowrap rounded-md border border-[#c8a040]/40 bg-[rgba(18,12,6,0.92)] px-3 py-2 text-center shadow-lg"
              >
                <p className="font-serif text-sm text-[#f5e6c8]">{art.title}</p>
                <p className="mt-0.5 text-xs capitalize text-[#c8a040]/80">{art.medium}</p>
              </div>
            )}
          </React.Fragment>
        );
      })}
    </main>
  );
}







// function CustomLayoutView({
//   artworks,
//   artistName,
// }: {
//   artworks: Artwork[];
//   artistName: string;
// }) {
//   const [hoveredId, setHoveredId] = React.useState<string | null>(null);
//   const positioned = artworks.filter(a => a.position_x != null);

//   if (positioned.length === 0) {
//     return (
//       <main className="relative z-10 flex min-h-[100dvh] items-center justify-center px-6 pt-24">
//         <p className="text-center font-serif text-lg text-[#f5e6c8]/80">
//           This gallery is waiting for its first piece.
//         </p>
//       </main>
//     );
//   }

//   return (
//     <main className="relative z-10 h-[100dvh] w-full overflow-hidden pt-14">
//       {positioned.map((art, i) => {
//         const xPct = art.position_x!;
//         const yPct = art.position_y!;
//         const rotation = art.rotation ?? 0;
//         const scale = art.scale ?? 1;
//         const zIndex = art.z_index ?? (i + 1);
//         const baseWidth = 220;
//         const baseHeight = 220 * 1.3;

//                 // Calculate rotated bounding box for tooltip positioning
//                 const radians = (rotation * Math.PI) / 180;
//                 const cos = Math.abs(Math.cos(radians));
//                 const sin = Math.abs(Math.sin(radians));
//                 const rotatedWidth = (baseWidth * cos + baseHeight * sin) * scale;
//                 const rotatedHeight = (baseWidth * sin + baseHeight * cos) * scale;
                
//                 // Bottom-center of the rotated artwork
//                 const tooltipLeft = `calc(${xPct}% + ${rotatedWidth / 2}px)`;
//                 const tooltipTop = `calc(${yPct}% + ${rotatedHeight}px + 12px)`;

//                 return (
//                   <React.Fragment key={art.id}>
//                     {/* Artwork */}
//                     <div
//                       style={{
//                         position: "absolute",
//                         left: `${xPct}%`,
//                         top: `${yPct}%`,
//                         zIndex,
//                         transform: `rotate(${rotation}deg) scale(${scale})`,
//                         transformOrigin: "top left",
//                       }}
//                       onMouseEnter={() => setHoveredId(art.id)}
//                       onMouseLeave={() => setHoveredId(null)}
//                     >
//                       <FramedArtwork
//                         frame_file={art.frame_file || DEFAULT_FRAME_FILE}
//                         artSrc={art.file_url}
//                         width={baseWidth}
//                         title={art.title}
//                         medium={art.medium}
//                         artistName={artistName}
//                         fileType={art.file_type}
//                         showTooltip={false}  {/* Hide internal tooltip */}
//                       />
//                     </div>
                    
//                     {/* External tooltip - always horizontal, at visual bottom */}
//                     {hoveredId === art.id && (
//                       <div
//                         style={{
//                           position: "absolute",
//                           left: tooltipLeft,
//                           top: tooltipTop,
//                           transform: 'translateX(-50%)',
//                           zIndex: 9999,
//                         }}
//                         className="pointer-events-none whitespace-nowrap rounded-md border border-[#c8a040]/40 bg-[rgba(18,12,6,0.92)] px-3 py-2 text-center shadow-lg"
//                       >
//                         <p className="font-serif text-sm text-[#f5e6c8]">{art.title}</p>
//                         <p className="mt-0.5 text-xs capitalize text-[#c8a040]/80">{art.medium}</p>
//                       </div>
//                     )}
//                   </React.Fragment>
//                 );
//       })}
//     </main>
//   );
// }
