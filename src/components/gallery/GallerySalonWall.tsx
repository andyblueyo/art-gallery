"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import React from "react";
import { useRouter } from "next/navigation";
import type { Artwork, GalleryPiece, InventoryTrayItem } from "@/lib/types";
import {
  GalleryPieceCard,
  GalleryPieceFrame,
  GalleryPieceOverlay,
  type CollectConfig,
} from "./GalleryPieceCard";
import { GalleryMinimap } from "./GalleryMinimap";
import { GalleryScrollHint } from "./GalleryScrollHint";
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
  handle?: string;
  artworks: WallArtwork[];
  layout: GalleryLayoutItem[];
  galleryUrl: string;
  totalPieceCount: number;
  allArtworks?: Artwork[];
  galleryPieces?: GalleryPiece[];
  unplacedInventory?: InventoryTrayItem[];
  isOwner?: boolean;
  isLoggedIn?: boolean;
  profileId?: string;
  layoutMode?: string;
  collectorCoinBalance?: number | null;
  collectableItems?: Record<string, string>;
  backgroundType?: 'color' | 'image';
  backgroundColor?: string;
  backgroundImageUrl?: string | null;
  backgroundImageMode?: 'cover' | 'tile' | null;
  gallery?: {
    id: string;
    name: string | null;
    slug: string | null;
    isPrimary: boolean;
    backgroundType: 'color' | 'image';
    backgroundColor: string;
    backgroundImageUrl: string | null;
    backgroundImageMode: 'cover' | 'tile' | null;
  } | null;
}

export function GallerySalonWall({
  artist,
  handle = "",
  artworks,
  layout,
  galleryUrl,
  totalPieceCount,
  allArtworks = [],
  galleryPieces,
  unplacedInventory = [],
  isOwner = false,
  isLoggedIn = false,
  profileId = "",
  layoutMode = "auto",
  collectorCoinBalance = null,
  collectableItems = {},
  backgroundType,
  backgroundColor,
  backgroundImageUrl,
  backgroundImageMode,
  gallery = null,
}: GallerySalonWallProps) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showAllGrid, setShowAllGrid] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const hasMoreOnGrid = totalPieceCount > layout.length;
  const isCustomLayout = layoutMode === "custom";

  const wallBgStyle: React.CSSProperties = backgroundType === 'image' && backgroundImageUrl
    ? {
        backgroundImage: `url(${backgroundImageUrl})`,
        backgroundSize: backgroundImageMode === 'tile' ? 'auto' : 'cover',
        backgroundRepeat: backgroundImageMode === 'tile' ? 'repeat' : 'no-repeat',
        backgroundPosition: 'center',
      }
    : { backgroundColor: backgroundColor ?? '#e8ddd0' };

  const artworkMap = useMemo(
    () => new Map(allArtworks.map((a) => [a.id, a])),
    [allArtworks]
  );

  // Auto-layout resolves sale data through allArtworks; the custom layout reads
  // it off the piece instead. Kept separate so each wall keeps its own rules.
  const resolveAutoCollect = useCallback(
    (artworkId: string): CollectConfig | null => {
      if (isOwner || !collectableItems[artworkId]) return null;
      const full = artworkMap.get(artworkId);
      if (!full?.for_sale || !full.price_coins) return null;
      return {
        inventoryItemId: collectableItems[artworkId],
        priceCoins: full.price_coins,
        editionsRemaining: full.editions_remaining ?? 0,
        collectorCoinBalance: collectorCoinBalance ?? 0,
      };
    },
    [isOwner, collectableItems, artworkMap, collectorCoinBalance]
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
          handle={handle}
          placedPieces={galleryPieces ?? []}
          unplacedInventory={unplacedInventory}
          profileId={profileId}
          onCancel={() => setEditMode(false)}
          onSaved={() => setEditMode(false)}
          onReset={handleReset}
          gallery={gallery ?? {
            id: '',
            name: '',
            slug: '',
            isPrimary: false,
            backgroundType: (backgroundType ?? 'color') as 'color' | 'image',
            backgroundColor: backgroundColor ?? '#e8ddd0',
            backgroundImageUrl: backgroundImageUrl ?? null,
            backgroundImageMode: (backgroundImageMode ?? null) as 'cover' | 'tile' | null,
          }}
        />
      )}

      {/* ── Gallery view ─────────────────────────────────────── */}
      <div className="gallery-salon-wall relative min-h-[100dvh] w-full overflow-x-hidden" style={wallBgStyle}>
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
        {(isCustomLayout || (galleryPieces && galleryPieces.length > 0)) && galleryPieces && galleryPieces.length > 0 ? (
          <CustomLayoutView
            pieces={galleryPieces}
            artistName={artist.name}
            handle={handle}
            isOwner={isOwner}
            isLoggedIn={isLoggedIn}
            collectableItems={collectableItems}
            collectorCoinBalance={collectorCoinBalance}
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
                <GalleryPieceCard
                  key={`${frameFile}-${item.artIndex}-${index}`}
                  frameFile={frameFile}
                  artSrc={art.src}
                  width={Math.min(width, 280)}
                  title={art.title}
                  medium={art.medium}
                  artistName={artist.name}
                  fileType={art.fileType}
                  innerPadding={item.innerPadding}
                  artworkId={art.id}
                  heartCount={art.heartCount}
                  isOwner={isOwner}
                  isLoggedIn={isLoggedIn}
                  collect={resolveAutoCollect(art.id)}
                />
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
                  <GalleryPieceCard
                    key={`${frameFile}-${item.artIndex}-${index}`}
                    frameFile={frameFile}
                    artSrc={art.src}
                    width={280}
                    title={art.title}
                    medium={art.medium}
                    artistName={artist.name}
                    fileType={art.fileType}
                    innerPadding={item.innerPadding}
                    artworkId={art.id}
                    heartCount={art.heartCount}
                    isOwner={isOwner}
                    isLoggedIn={isLoggedIn}
                    collect={resolveAutoCollect(art.id)}
                  />
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
  handle = "",
  isOwner = false,
  isLoggedIn = false,
  collectableItems = {},
  collectorCoinBalance = null,
}: {
  pieces: GalleryPiece[];
  artistName: string;
  handle?: string;
  isOwner?: boolean;
  isLoggedIn?: boolean;
  collectableItems?: Record<string, string>;
  collectorCoinBalance?: number | null;
}) {
  const [hoveredId, setHoveredId] = React.useState<string | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const frameRefs = React.useRef<Record<string, HTMLDivElement | null>>({});
  const wrapperRefs = React.useRef<Record<string, HTMLDivElement | null>>({});
  const [tooltipPos, setTooltipPos] = React.useState<
    Record<string, { left: number; top: number }>
  >({});

  const CANVAS_W = 1400;
  const CANVAS_H = 1200;
  /** Gap in px between the frame's lowest visible edge and the hover card. */
  const TOOLTIP_GAP = 16;

  /**
   * The tooltip lives in the piece's unrotated wrapper, so it can't inherit the
   * frame's rotate()/scale(). Measure the frame's post-transform box instead:
   * getBoundingClientRect is axis-aligned around the rotated frame, so its
   * horizontal centre is the artwork's true centre and its bottom edge is the
   * artwork's lowest visible point at any angle.
   */
  const handleMouseEnter = (pieceId: string) => {
    setHoveredId(pieceId);
    const frameEl = frameRefs.current[pieceId];
    const wrapperEl = wrapperRefs.current[pieceId];
    if (frameEl && wrapperEl) {
      const frameRect = frameEl.getBoundingClientRect();
      const wrapperRect = wrapperEl.getBoundingClientRect();
      setTooltipPos((prev) => ({
        ...prev,
        [pieceId]: {
          left: frameRect.left + frameRect.width / 2 - wrapperRect.left,
          top: frameRect.bottom - wrapperRect.top + TOOLTIP_GAP,
        },
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
            const tip = tooltipPos[piece.id];

            return (
              <div
                key={piece.id}
                ref={(el) => { wrapperRefs.current[piece.id] = el; }}
                style={{
                  position: "absolute",
                  left: `${piece.position_x}%`,
                  top: `${piece.position_y}%`,
                  // Width stays: the overlay's pre-measurement `left: 50%`
                  // resolves against it. Height is deliberately unset — both
                  // children are absolutely positioned, so a box height would
                  // only ever have been a hit area, and this box is not one.
                  width: `${Math.round(baseWidth * scale)}px`,
                  zIndex: hoveredId === piece.id ? 9999 : zIndex,
                  // A positioning box, not a hit target. It can't know the
                  // frame's aspect ratio or rotation, so hovering it would
                  // claim space the artwork doesn't occupy and steal hover
                  // from the piece below. Only the transformed frame and the
                  // visible overlay take pointer events; their events bubble
                  // up here, so the handlers below still fire.
                  pointerEvents: "none",
                }}
                onMouseEnter={() => handleMouseEnter(piece.id)}
                onMouseLeave={handleMouseLeave}
              >
                <div
                  ref={(el) => { frameRefs.current[piece.id] = el; }}
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    transform: `rotate(${rotation}deg) scale(${scale})`,
                    transformOrigin: "top left",
                    // The hit area for the whole piece. Hit testing respects
                    // the transform above, so it tracks the frame's real
                    // rendered corners at any rotation or scale.
                    pointerEvents: "auto",
                  }}
                >
                <GalleryPieceFrame
                  wrapper="block"
                  linkHref={
                    (art as any).artist_handle?.toLowerCase() !== handle?.toLowerCase()
                      ? `https://${(art as any).artist_handle}.galleryclub.online`
                      : null
                  }
                  frameFile={art.frame_file || DEFAULT_FRAME_FILE}
                  artSrc={art.file_url}
                  width={baseWidth}
                  title={art.title}
                  medium={art.medium}
                  artistName={(art as any).artist_display_name || artistName}
                  fileType={art.file_type}
                />
                </div>
                <GalleryPieceOverlay
                  placement={{
                    mode: "anchored",
                    style: {
                      position: "absolute",
                      // The box's top edge sits flush with the frame's bottom
                      // and paddingTop re-creates the gap as transparent
                      // space, so the card looks unchanged but is contiguous
                      // with the frame: the cursor can travel down to the
                      // heart and collect buttons without crossing a dead
                      // strip that would fire mouseleave and hide the card.
                      //
                      // The un-measured fallback is a placeholder that never
                      // paints — handleMouseEnter batches the measurement with
                      // setHoveredId, so the first visible render already has
                      // `tip`. (It's a width standing in for a height; there's
                      // no honest height to use before measuring.)
                      top: tip ? `${tip.top - TOOLTIP_GAP}px` : `${Math.round(baseWidth * scale)}px`,
                      paddingTop: `${TOOLTIP_GAP}px`,
                      left: tip ? `${tip.left}px` : "50%",
                      transform: "translateX(-50%)",
                      zIndex: 20,
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      opacity: hoveredId === piece.id ? 1 : 0,
                      transition: "opacity 0.15s",
                      pointerEvents: hoveredId === piece.id ? "auto" : "none",
                      whiteSpace: "nowrap",
                    },
                  }}
                  artworkId={art.id}
                  title={art.title}
                  medium={art.medium}
                  byLine={(art as any).artist_display_name || artistName}
                  heartCount={art.heart_count ?? 0}
                  isOwner={isOwner}
                  isLoggedIn={isLoggedIn}
                  collect={
                    !isOwner && piece.inventory_item?.artwork_id && collectableItems[piece.inventory_item.artwork_id] && art.for_sale && art.price_coins != null
                      ? {
                          inventoryItemId: collectableItems[piece.inventory_item.artwork_id],
                          priceCoins: art.price_coins,
                          editionsRemaining: art.editions_remaining ?? 0,
                          collectorCoinBalance: collectorCoinBalance ?? 0,
                        }
                      : null
                  }
                />
              </div>
            );
          })}
        </div>
      </div>
      <GalleryScrollHint scrollRef={scrollRef} />
      <GalleryMinimap pieces={pieces} scrollRef={scrollRef} />
    </>
  );
}
