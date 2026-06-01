"use client";

import { useCallback, useEffect, useState } from "react";
import React from "react";
import { useRouter } from "next/navigation";
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
import { createClient } from "@/lib/supabase/client";

interface GallerySalonWallProps {
  artist: ArtistBubbleData;
  artworks: WallArtwork[];
  layout: GalleryLayoutItem[];
  galleryUrl: string;
  totalPieceCount: number;
  allArtworks?: Artwork[];
  isOwner?: boolean;
  isLoggedIn?: boolean;
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
  isLoggedIn = false,
  profileId = "",
  layoutMode = "auto",
}: GallerySalonWallProps) {
  console.log("GallerySalonWall props:", { isOwner, isLoggedIn });
  const router = useRouter();
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
    document.documentElement.style.overflow = "";
    document.body.style.overflow = "";
    return () => {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    };
  }, []);

  const handleShare = useCallback(async () => {
    const url =
      typeof window !== "undefined" ? window.location.href : galleryUrl;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  }, [galleryUrl]);

  const handleReset = useCallback(async () => {
    try {
      const supabase = createClient();
      await Promise.all(
        allArtworks.map(art =>
          supabase
            .from("artworks")
            .update({
              position_x: null,
              position_y: null,
              rotation: null,
              scale: null,
              z_index: null,
            })
            .eq("id", art.id)
        )
      );
      await supabase
        .from("profiles")
        .update({ layout_mode: "auto" })
        .eq("id", profileId);
      setEditMode(false);
      router.refresh();
    } catch (error) {
      console.error("Failed to reset layout:", error);
    }
  }, [allArtworks, profileId, router]);

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
          onReset={handleReset}
        />
      )}

      {/* ── Gallery view ─────────────────────────────────────── */}
      <div className="gallery-salon-wall relative min-h-[100dvh] w-full overflow-x-hidden bg-[#ddd4b4]">
        <div className="gallery-salon-wall__texture pointer-events-none absolute inset-0" />
        <div className="gallery-salon-wall__vignette pointer-events-none absolute inset-0" />

        <header className="pointer-events-none fixed inset-x-0 top-0 z-30 flex items-start justify-between px-4 py-4 sm:px-6">
          <div className="pointer-events-auto rounded-lg bg-[rgba(18,12,6,0.35)] px-2 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm backdrop-blur-md">
            <a
              href="https://galleryclub.online"
              className="font-serif text-lg tracking-wide text-[#c8a040]/85 hover:text-[#c8a040] transition-colors"
            >
              gallery club
            </a>
          </div>

          <div className="flex items-center gap-1 flex-wrap justify-end max-w-[60vw]">
            {isOwner && (
              <a
                href="https://galleryclub.online/dashboard"
                className="pointer-events-auto rounded-lg border border-[#c8a040]/30 bg-[rgba(18,12,6,0.35)] px-2 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm text-[#f5e6c8]/90 backdrop-blur-md transition-colors hover:border-[#c8a040]/60 hover:bg-[rgba(18,12,6,0.5)]"
              >
                dashboard
              </a>
            )}
            {isOwner && (
              <button
                type="button"
                onClick={() => setEditMode(true)}
                className="pointer-events-auto rounded-lg border border-[#c8a040]/50 bg-[rgba(18,12,6,0.55)] px-2 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm text-[#c8a040] backdrop-blur-md transition-colors hover:border-[#c8a040] hover:bg-[rgba(18,12,6,0.75)]"
              >
                edit layout
              </button>
            )}
            {isLoggedIn && !isOwner && (
              <button
                type="button"
                onClick={handleShare}
                className="pointer-events-auto rounded-lg border border-[#c8a040]/30 bg-[rgba(18,12,6,0.35)] px-2 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm text-[#f5e6c8]/90 backdrop-blur-md transition-colors hover:border-[#c8a040]/60 hover:bg-[rgba(18,12,6,0.5)]"
              >
                share gallery
              </button>
            )}
            {isOwner && (
              <button
                type="button"
                onClick={handleShare}
                className="pointer-events-auto rounded-lg border border-[#c8a040]/30 bg-[rgba(18,12,6,0.35)] px-2 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm text-[#f5e6c8]/90 backdrop-blur-md transition-colors hover:border-[#c8a040]/60 hover:bg-[rgba(18,12,6,0.5)]"
              >
                share gallery
              </button>
            )}
            {!isLoggedIn && (
              <>
                <button
                  type="button"
                  onClick={handleShare}
                  className="pointer-events-auto rounded-lg border border-[#c8a040]/30 bg-[rgba(18,12,6,0.35)] px-2 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm text-[#f5e6c8]/90 backdrop-blur-md transition-colors hover:border-[#c8a040]/60 hover:bg-[rgba(18,12,6,0.5)]"
                >
                  share gallery
                </button>
                <a
                  href="https://galleryclub.online/signup"
                  className="pointer-events-auto rounded-lg border border-[#c8a040]/30 bg-[rgba(18,12,6,0.35)] px-2 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm text-[#f5e6c8]/90 backdrop-blur-md transition-colors hover:border-[#c8a040]/60 hover:bg-[rgba(18,12,6,0.5)]"
                >
                  create your gallery
                </a>
              </>
            )}
          </div>
        </header>

        {copied && (
          <div
            role="status"
            className="fixed right-4 top-[4.5rem] z-50 rounded-lg border border-[#c8a040]/40 bg-[rgba(18,12,6,0.92)] px-2 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm text-[#c8a040] shadow-lg"
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
              this gallery is waiting for its first piece.
            </p>
          </main>
        ) : isMobile ? (
          /* Mobile auto layout */
          <main className="relative z-10 flex flex-col items-center gap-10 px-4 pb-28 pt-24">
            {layout.map((item, index) => {
              const art = artworks[item.artIndex];
              if (!art) return null;
              const frameFile = art.frame_file || DEFAULT_FRAME_FILE;
              const width = 280;
              return (
                <div
                  key={`${frameFile}-${item.artIndex}-${index}`}
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
          <main className="relative z-10 w-full px-6 py-12 pb-28 pt-24">
            <div className="grid auto-rows-max gap-10 md:grid-cols-2 lg:grid-cols-3">
              {layout.map((item, index) => {
                const art = artworks[item.artIndex];
                if (!art) return null;
                const frameFile = art.frame_file || DEFAULT_FRAME_FILE;
                return (
                  <div
                    key={`${frameFile}-${item.artIndex}-${index}`}
                    className="flex items-center justify-center"
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
  const [tooltipPos, setTooltipPos] = React.useState<{ left: number; top: number } | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const itemRefsMap = React.useRef(new Map<string, React.RefObject<HTMLDivElement>>());
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const CANVAS_W = 1400;
  const CANVAS_H = 1200;

  const positioned = artworks.filter((a) => a.position_x != null);

  const getOrCreateRef = (artId: string) => {
    let ref = itemRefsMap.current.get(artId);
    if (!ref) {
      ref = React.createRef<HTMLDivElement>();
      itemRefsMap.current.set(artId, ref);
    }
    return ref;
  };

  const handleMouseEnter = (art: Artwork) => {
    setHoveredId(art.id);
    const artRef = getOrCreateRef(art.id);
    if (!artRef.current || !containerRef.current) return;
    const artRect = artRef.current.getBoundingClientRect();
    const containerRect = containerRef.current.getBoundingClientRect();
    setTooltipPos({
      left: artRect.left - containerRect.left + artRect.width / 2,
      top: artRect.bottom - containerRect.top + 12,
    });
  };

  const handleMouseLeave = () => {
    setHoveredId(null);
    setTooltipPos(null);
  };

  if (positioned.length === 0) {
    return (
      <main className="relative z-10 flex min-h-[100dvh] items-center justify-center px-6 pt-24">
        <p className="text-center font-serif text-lg text-[#f5e6c8]/80">
          this gallery is waiting for its first piece.
        </p>
      </main>
    );
  }

  return (
    <>
    {/* Outer scroll container — full viewport, scrollable in both axes on mobile */}
    <div
      ref={scrollRef} 
      className="relative z-10 w-full pt-14"
      style={{
        // On mobile: allow 2D panning. On desktop: normal doc scroll takes over.
        overflowX: "auto",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
      }}
    >
      {/* Fixed-size canvas */}
      <div
        ref={containerRef}
        style={{
          position: "relative",
          width: `${CANVAS_W}px`,
          height: `${CANVAS_H}px`,
          // On desktop (≥1400px) center the canvas; on smaller screens it scrolls
          margin: "0 auto",
        }}
      >
        {positioned.map((art, i) => {
          const xPct = art.position_x!;
          const yPct = art.position_y!;
          const rotation = art.rotation ?? 0;
          const scale = art.scale ?? 1;
          const zIndex = art.z_index ?? i + 1;
          const baseWidth = 220;
          const artRef = getOrCreateRef(art.id);

          return (
            <React.Fragment key={art.id}>
              <div
                ref={artRef}
                style={{
                  position: "absolute",
                  left: `${xPct}%`,
                  top: `${yPct}%`,
                  zIndex,
                  transform: `rotate(${rotation}deg) scale(${scale})`,
                  transformOrigin: "top left",
                }}
                onMouseEnter={() => handleMouseEnter(art)}
                onMouseLeave={handleMouseLeave}
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

              {hoveredId === art.id && tooltipPos && (
                <div
                  style={{
                    position: "absolute",
                    left: `${tooltipPos.left}px`,
                    top: `${tooltipPos.top}px`,
                    transform: "translateX(-50%)",
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
      </div>
    </div>
         {/* ← this closes the scroll div */}

      <GalleryMinimap artworks={artworks} scrollRef={scrollRef} />
    </>
  );
}

// ── Minimap ──────────────────────────────────────────────────────
function GalleryMinimap({
  artworks,
  scrollRef,
}: {
  artworks: Artwork[];
  scrollRef: React.RefObject<HTMLDivElement>;
}) {
  const CANVAS_W = 1400;
  const CANVAS_H = 1200;
  const MAP_W = 80;
  const MAP_H = 48;

  const [vp, setVp] = React.useState({ left: 0, top: 0, width: MAP_W, height: MAP_H });
  const [idle, setIdle] = React.useState(false);
  const idleTimer = React.useRef<ReturnType<typeof setTimeout>>();

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const update = () => {
      const scaleX = MAP_W / CANVAS_W;
      const scaleY = MAP_H / CANVAS_H;
      setVp({
        left: el.scrollLeft * scaleX,
        top: window.scrollY * scaleY,
        width: Math.min(MAP_W, window.innerWidth * scaleX),
        height: Math.min(MAP_H, window.innerHeight * scaleY),
      });
      setIdle(false);
      clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => setIdle(true), 1500);
    };

    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("scroll", update, { passive: true }); 
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("scroll", update);  
      window.removeEventListener("resize", update);
      clearTimeout(idleTimer.current);
    };
  }, [scrollRef]);

  const positioned = artworks.filter(a => a.position_x != null);

  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 50,
        opacity: idle ? 1 : 1,
        transition: "opacity 0.4s ease",
        background: "rgba(18,12,6,0.75)",
        borderRadius: 8,
        border: "0.5px solid rgba(200,160,64,0.4)",
        padding: "8px 10px",
        backdropFilter: "blur(4px)",
      }}
    >
      <p style={{ fontSize: 9, color: "rgba(200,160,64,0.6)", margin: "0 0 5px", letterSpacing: "0.05em" }}>
        YOU ARE HERE
      </p>
      <div
        style={{
          position: "relative",
          width: MAP_W,
          height: MAP_H,
          background: "#ddd4b4",
          borderRadius: 3,
          overflow: "hidden",
        }}
      >
        {positioned.map(art => (
          <div
            key={art.id}
            style={{
              position: "absolute",
              left: `${8 + art.position_x! * 0.84}%`,
              top: `${8 + art.position_y! * 0.84}%`,
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "rgba(200,160,64,0.75)",
              transform: "translate(-50%, -50%)",
            }}
          />
        ))}
        <div
          style={{
            position: "absolute",
            left: vp.left,
            top: vp.top,
            width: vp.width,
            height: vp.height,
            border: "1.5px solid #c8a040",
            background: "rgba(200,160,64,0.15)",
            borderRadius: 2,
            pointerEvents: "none",
          }}
        />
      </div>
    </div>
  );
}


