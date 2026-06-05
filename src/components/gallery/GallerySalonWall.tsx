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
import { HeartButton } from "@/components/ui/HeartButton";

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
        isOwner={isOwner}
        isLoggedIn={isLoggedIn}
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
          <CustomLayoutView
            artworks={allArtworks}
            artistName={artist.name}
            isOwner={isOwner}
            isLoggedIn={isLoggedIn}
          />
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
                  className="flex flex-col items-center group"
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
                    showTooltip={false}
                  />
                  <div className="mt-3 flex items-center gap-2 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-200 [&_.opacity-0]:opacity-100">
                    <div className="whitespace-nowrap rounded-md border border-[#c8a040]/40 bg-[rgba(18,12,6,0.92)] px-3 py-2 text-center shadow-lg">
                      <p className="font-serif text-sm text-[#f5e6c8]">{art.title}</p>
                      {art.medium && <p className="mt-0.5 text-xs capitalize text-[#c8a040]/80">{art.medium}</p>}
                    </div>
                    {isLoggedIn && (
                      <div className="rounded-md border border-[#c8a040]/40 bg-[rgba(18,12,6,0.92)] px-2 py-2 shadow-lg">
                        <HeartButton
                          pieceId={art.id}
                          isOwner={isOwner}
                          initialHeartCount={art.heartCount}
                          isLoggedIn={isLoggedIn}
                        />
                      </div>
                    )}
                  </div>
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
                    className="flex flex-col items-center group"
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
                      showTooltip={false}
                    />
                    <div className="mt-3 flex items-center gap-2 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-200 [&_.opacity-0]:opacity-100">
                      <div className="whitespace-nowrap rounded-md border border-[#c8a040]/40 bg-[rgba(18,12,6,0.92)] px-3 py-2 text-center shadow-lg">
                        <p className="font-serif text-sm text-[#f5e6c8]">{art.title}</p>
                        {art.medium && <p className="mt-0.5 text-xs capitalize text-[#c8a040]/80">{art.medium}</p>}
                      </div>
                      {isLoggedIn && (
                        <div className="rounded-md border border-[#c8a040]/40 bg-[rgba(18,12,6,0.92)] px-2 py-2 shadow-lg">
                          <HeartButton
                            pieceId={art.id}
                            isOwner={isOwner}
                            initialHeartCount={art.heartCount}
                            isLoggedIn={isLoggedIn}
                          />
                        </div>
                      )}
                    </div>
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
  isOwner = false,
  isLoggedIn = false,
}: {
  artworks: Artwork[];
  artistName: string;
  isOwner?: boolean;
  isLoggedIn?: boolean;
}) {
  const [hoveredId, setHoveredId] = React.useState<string | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const CANVAS_W = 1400;
  const CANVAS_H = 1200;

  const positioned = artworks.filter((a) => a.position_x != null);

  const handleMouseEnter = (artId: string) => {
    setHoveredId(artId);
  };

  const handleMouseLeave = () => {
    setHoveredId(null);
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

          return (
            <div
              key={art.id}
              style={{
                position: "absolute",
                left: `${xPct}%`,
                top: `${yPct}%`,
                width: `${Math.round(baseWidth * scale)}px`,
                height: `${Math.round(baseWidth * scale * 1.7)}px`,
                zIndex,
              }}
              onMouseEnter={() => handleMouseEnter(art.id)}
              onMouseLeave={handleMouseLeave}
            >
              {/* Frame — rotate+scale transform */}
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  transform: `rotate(${rotation}deg) scale(${scale})`,
                  transformOrigin: "top left",
                }}
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

              {/* Title + heart row, shown below the frame on hover */}
              <div
                style={{
                  position: "absolute",
                  top: `${Math.round(baseWidth * scale * 1.35) + 8}px`,
                  left: "50%",
                  transform: "translateX(-50%)",
                  zIndex: 20,
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  opacity: hoveredId === art.id ? 1 : 0,
                  transition: "opacity 0.15s",
                  pointerEvents: hoveredId === art.id ? "auto" : "none",
                  whiteSpace: "nowrap",
                }}
                className="[&_.opacity-0]:opacity-100"
              >
                <div className="rounded-md border border-[#c8a040]/40 bg-[rgba(18,12,6,0.92)] px-3 py-2 text-center shadow-lg">
                  <p className="font-serif text-sm text-[#f5e6c8]">{art.title}</p>
                  {art.medium && <p className="mt-0.5 text-xs capitalize text-[#c8a040]/80">{art.medium}</p>}
                </div>
                {isLoggedIn && (
                  <div className="rounded-md border border-[#c8a040]/40 bg-[rgba(18,12,6,0.92)] px-2 py-2 shadow-lg">
                    <HeartButton
                      pieceId={art.id}
                      isOwner={isOwner}
                      initialHeartCount={art.heart_count ?? 0}
                      isLoggedIn={isLoggedIn}
                    />
                  </div>
                )}
              </div>
            </div>
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

