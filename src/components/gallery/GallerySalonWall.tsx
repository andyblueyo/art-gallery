"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import React from "react";
import { useRouter } from "next/navigation";
import type { Artwork } from "@/lib/types";
import type { GalleryPiece } from "@/lib/types";
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
import { CollectButton } from "@/components/gallery/CollectButton";

interface GallerySalonWallProps {
  artist: ArtistBubbleData;
  artworks: WallArtwork[];
  layout: GalleryLayoutItem[];
  galleryUrl: string;
  totalPieceCount: number;
  allArtworks?: Artwork[];
  galleryPieces?: GalleryPiece[];
  isOwner?: boolean;
  isLoggedIn?: boolean;
  profileId?: string;
  layoutMode?: string;
  collectorCoinBalance?: number | null;
  collectableItems?: Record<string, string>;
}

export function GallerySalonWall({
  artist,
  artworks,
  layout,
  galleryUrl,
  totalPieceCount,
  allArtworks = [],
  galleryPieces,
  isOwner = false,
  isLoggedIn = false,
  profileId = "",
  layoutMode = "auto",
  collectorCoinBalance = null,
  collectableItems = {},
}: GallerySalonWallProps) {
  console.log("GallerySalonWall props:", { isOwner, isLoggedIn });
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showAllGrid, setShowAllGrid] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const hasMoreOnGrid = totalPieceCount > layout.length;
  const isCustomLayout = layoutMode === "custom";

  const artworkMap = useMemo(
    () => new Map(allArtworks.map((a) => [a.id, a])),
    [allArtworks]
  );

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
      const { data: gallery } = await supabase
        .from("galleries")
        .select("id")
        .eq("user_id", profileId)
        .eq("is_primary", true)
        .single();

      if (gallery) {
        await supabase
          .from("gallery_pieces")
          .delete()
          .eq("gallery_id", gallery.id);
      }

      await supabase
        .from("profiles")
        .update({ layout_mode: "auto" })
        .eq("id", profileId);

      setEditMode(false);
      router.refresh();
    } catch (error) {
      console.error("Failed to reset layout:", error);
    }
  }, [profileId, router]);

  if (showAllGrid && allArtworks.length > 0) {
    return (
      <GallerySeeAllGrid
        artworks={allArtworks}
        onClose={() => setShowAllGrid(false)}
        isOwner={isOwner}
        isLoggedIn={isLoggedIn}
        collectableItems={collectableItems}
        collectorCoinBalance={collectorCoinBalance ?? undefined}
      />
    );
  }

  return (
    <>
      {/* ── Editor overlay ───────────────────────────────────── */}
      {editMode && (
        <GalleryEditorCanvas
          placedPieces={galleryPieces ?? []}
          unplacedInventory={[]}
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
        {isCustomLayout && galleryPieces && galleryPieces.length > 0 ? (
          <CustomLayoutView
            pieces={galleryPieces}
            artistName={artist.name}
            isOwner={isOwner}
            isLoggedIn={isLoggedIn}
            collectableItems={collectableItems}
            collectorCoinBalance={collectorCoinBalance}
            allArtworks={allArtworks}
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
                        <HeartButton
                          pieceId={art.id}
                          isOwner={isOwner}
                          initialHeartCount={art.heartCount}
                          isLoggedIn={isLoggedIn}
                        />
                    )}
                    {!isOwner && collectableItems[art.id] && (() => {
                      const full = artworkMap.get(art.id);
                      if (!full?.for_sale || !full.price_coins) return null;
                      return (
                        <CollectButton
                          inventoryItemId={collectableItems[art.id]}
                          artworkId={art.id}
                          priceCoins={full.price_coins}
                          editionsRemaining={full.editions_remaining ?? 0}
                          collectorCoinBalance={collectorCoinBalance ?? 0}
                        />
                      );
                    })()}
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
                          <HeartButton
                            pieceId={art.id}
                            isOwner={isOwner}
                            initialHeartCount={art.heartCount}
                            isLoggedIn={isLoggedIn}
                          />
                      )}
                      {!isOwner && collectableItems[art.id] && (() => {
                        const full = artworkMap.get(art.id);
                        if (!full?.for_sale || !full.price_coins) return null;
                        return (
                          <CollectButton
                            inventoryItemId={collectableItems[art.id]}
                            artworkId={art.id}
                            priceCoins={full.price_coins}
                            editionsRemaining={full.editions_remaining ?? 0}
                            collectorCoinBalance={collectorCoinBalance ?? 0}
                          />
                        );
                      })()}
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
  pieces,
  artistName,
  isOwner = false,
  isLoggedIn = false,
  collectableItems = {},
  collectorCoinBalance = null,
  allArtworks = []
}: {
  pieces: GalleryPiece[];
  artistName: string;
  isOwner?: boolean;
  isLoggedIn?: boolean;
  collectableItems?: Record<string, string>;
  collectorCoinBalance?: number | null;
  allArtworks?: Artwork[];
}) {
  const [hoveredId, setHoveredId] = React.useState<string | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const frameRefs = React.useRef<Record<string, HTMLDivElement | null>>({});
  const [tooltipTops, setTooltipTops] = React.useState<Record<string, number>>({});

  const CANVAS_W = 1400;
  const CANVAS_H = 1200;

  const DEFAULT_POSITIONS = [
    { xPct: 4, yPct: 8, rot: -2 },
    { xPct: 22, yPct: 5, rot: 1 },
    { xPct: 43, yPct: 6, rot: 0 },
    { xPct: 62, yPct: 4, rot: -1 },
    { xPct: 80, yPct: 7, rot: 2 },
    { xPct: 5, yPct: 50, rot: 1 },
    { xPct: 25, yPct: 47, rot: 0 },
    { xPct: 50, yPct: 49, rot: -1 },
    { xPct: 68, yPct: 46, rot: 1 },
    { xPct: 84, yPct: 50, rot: -2 },
  ];
  
  const placedArtworkIds = new Set(
    pieces.map(p => p.inventory_item?.artwork_id).filter(Boolean)
  );
  
  const unplacedArtworks = allArtworks.filter(a => !placedArtworkIds.has(a.id));

  const handleMouseEnter = (pieceId: string) => {
    setHoveredId(pieceId);
    const el = frameRefs.current[pieceId];
    if (el) {
      const artScale = parseFloat(el.getAttribute("data-scale") ?? "1");
      setTooltipTops((prev) => ({
        ...prev,
        [pieceId]: el.offsetHeight * artScale + 8,
      }));
    }
  };

  const handleMouseLeave = () => setHoveredId(null);

  if (pieces.length === 0) {
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
      <div
        ref={scrollRef}
        className="relative z-10 w-full pt-14"
        style={{ overflowX: "auto", overflowY: "auto", WebkitOverflowScrolling: "touch" }}
      >
        <div style={{ position: "relative", width: `${CANVAS_W}px`, height: `${CANVAS_H}px`, margin: "0 auto" }}>
          {pieces.map((piece, i) => {
            const art = piece.inventory_item?.artwork;
            if (!art) return null;
            const rotation = piece.rotation ?? 0;
            const scale = piece.scale ?? 1;
            const zIndex = piece.z_index ?? i + 1;
            const baseWidth = 220;

            return (
              <div
                key={piece.id}
                style={{
                  position: "absolute",
                  left: `${piece.position_x}%`,
                  top: `${piece.position_y}%`,
                  width: `${Math.round(baseWidth * scale)}px`,
                  height: `${Math.round(baseWidth * scale * 1.7)}px`,
                  zIndex: hoveredId === piece.id ? 9999 : zIndex,
                }}
                onMouseEnter={() => handleMouseEnter(piece.id)}
                onMouseLeave={handleMouseLeave}
              >
                <div
                  ref={(el) => { frameRefs.current[piece.id] = el; }}
                  data-scale={scale}
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
                <div
                  style={{
                    position: "absolute",
                    top: `${tooltipTops[piece.id] ?? Math.round(baseWidth * scale) + 8}px`,
                    left: "50%",
                    transform: "translateX(-50%)",
                    zIndex: 20,
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    opacity: hoveredId === piece.id ? 1 : 0,
                    transition: "opacity 0.15s",
                    pointerEvents: hoveredId === piece.id ? "auto" : "none",
                    whiteSpace: "nowrap",
                  }}
                  className="[&_.opacity-0]:opacity-100"
                >
                  <div className="rounded-md border border-[#c8a040]/40 bg-[rgba(18,12,6,0.92)] px-3 py-2 text-center shadow-lg">
                    <p className="font-serif text-sm text-[#f5e6c8]">{art.title}</p>
                    {art.medium && <p className="mt-0.5 text-xs capitalize text-[#c8a040]/80">{art.medium}</p>}
                  </div>
                  {isLoggedIn && (
                    <HeartButton
                      pieceId={art.id}
                      isOwner={isOwner}
                      initialHeartCount={art.heart_count ?? 0}
                      isLoggedIn={isLoggedIn}
                    />
                  )}
                  {!isOwner && piece.inventory_item?.artwork_id && collectableItems[piece.inventory_item.artwork_id] && art.for_sale && art.price_coins != null && (
                    <CollectButton
                      inventoryItemId={collectableItems[piece.inventory_item.artwork_id]}
                      artworkId={art.id}
                      priceCoins={art.price_coins}
                      editionsRemaining={art.editions_remaining ?? 0}
                      collectorCoinBalance={collectorCoinBalance ?? 0}
                    />
                  )}
                </div>
              </div>
            );
          })}
          {unplacedArtworks.map((art, i) => {
            const def = DEFAULT_POSITIONS[i % DEFAULT_POSITIONS.length];
            return (
              <div
                key={art.id}
                style={{
                  position: "absolute",
                  left: `${def.xPct}%`,
                  top: `${def.yPct}%`,
                  width: `${Math.round(220)}px`,
                  height: `${Math.round(220 * 1.7)}px`,
                  zIndex: hoveredId === art.id ? 9999 : pieces.length + i + 1,
                }}
                onMouseEnter={() => handleMouseEnter(art.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <div
                  ref={(el) => { frameRefs.current[art.id] = el; }}
                  data-scale="1"
                  style={{ transform: `rotate(${def.rot}deg)`, transformOrigin: "top left" }}
                >
                  <FramedArtwork
                    frame_file={art.frame_file || DEFAULT_FRAME_FILE}
                    artSrc={art.file_url}
                    width={220}
                    title={art.title}
                    medium={art.medium}
                    artistName={artistName}
                    fileType={art.file_type}
                    showTooltip={false}
                  />
                </div>
                <div
                  style={{
                    position: "absolute",
                    top: `${tooltipTops[art.id] ?? 220 + 8}px`,
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
                    <HeartButton
                      pieceId={art.id}
                      isOwner={isOwner}
                      initialHeartCount={art.heart_count ?? 0}
                      isLoggedIn={isLoggedIn}
                    />
                  )} 
                  {!isOwner && collectableItems[art.id] && art.for_sale && art.price_coins != null && (
                    <CollectButton
                      inventoryItemId={collectableItems[art.id]}
                      artworkId={art.id}
                      priceCoins={art.price_coins}
                      editionsRemaining={art.editions_remaining ?? 0}
                      collectorCoinBalance={collectorCoinBalance ?? 0}
                    />
                  )} 
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <GalleryMinimap pieces={pieces} scrollRef={scrollRef} />
    </>
  );
}

// ── Minimap ──────────────────────────────────────────────────────
function GalleryMinimap({
  pieces,
  scrollRef,
}: {
  pieces: GalleryPiece[];
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

  const positioned = pieces;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 50,
        opacity: idle ? 0.4 : 1,
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
        {positioned.map(piece => (
          <div
            key={piece.id}
            style={{
              position: "absolute",
              left: `${piece.position_x}%`,
              top: `${piece.position_y}%`,
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

