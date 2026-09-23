"use client";

import React from "react";
import { FramedArtwork } from "./FramedArtwork";
import { HeartButton } from "@/components/ui/HeartButton";
import { CollectButton } from "@/components/gallery/CollectButton";

/**
 * The per-artwork visual unit, shared by the auto-layout and custom-layout
 * walls. Deliberately knows nothing about placement: it takes resolved visual
 * data only, so the layout container stays the sole owner of *whether* and
 * *where* a piece renders. Callers map their own row shape (WallArtwork vs
 * GalleryPiece) into these props.
 */

export interface CollectConfig {
  inventoryItemId: string;
  priceCoins: number;
  editionsRemaining: number;
  collectorCoinBalance: number;
}

// ── Frame ────────────────────────────────────────────────────────

export interface GalleryPieceFrameProps {
  frameFile: string;
  artSrc: string;
  width: number;
  title: string;
  medium: string;
  artistName: string;
  fileType?: "image" | "pdf";
  /** Above-the-fold hint; see FramedArtwork. */
  priority?: boolean;
  /** Cross-artist link-out. Falsy renders no anchor. */
  linkHref?: string | null;
  /**
   * "none" renders FramedArtwork bare (auto layout).
   * "block" wraps it in a display:block element (custom layout, whose
   * absolutely-positioned parent expects one wrapper node).
   */
  wrapper?: "none" | "block";
}

export function GalleryPieceFrame({
  frameFile,
  artSrc,
  width,
  title,
  medium,
  artistName,
  fileType,
  priority,
  linkHref,
  wrapper = "none",
}: GalleryPieceFrameProps) {
  const framed = (
    <FramedArtwork
      frame_file={frameFile}
      artSrc={artSrc}
      width={width}
      title={title}
      medium={medium}
      artistName={artistName}
      fileType={fileType}
      priority={priority}
      showTooltip={false}
    />
  );

  if (linkHref) {
    return (
      <a
        href={linkHref}
        style={{ display: "block" }}
        onClick={(e) => e.stopPropagation()}
      >
        {framed}
      </a>
    );
  }

  if (wrapper === "block") {
    return <div style={{ display: "block" }}>{framed}</div>;
  }

  return framed;
}

// ── Overlay (tooltip + heart + collect) ──────────────────────────

/**
 * How the overlay is positioned relative to the frame.
 * - "flow": sits below the frame in normal flow, revealed by CSS group-hover.
 * - "anchored": absolutely positioned by the caller, which owns the measured
 *   offset and hover-driven opacity in its style object.
 */
export type OverlayPlacement =
  | { mode: "flow" }
  | { mode: "anchored"; style: React.CSSProperties };

export interface GalleryPieceOverlayProps {
  artworkId: string;
  title: string;
  medium: string;
  /** Renders the "by …" line when set. Auto layout omits it. */
  byLine?: string | null;
  heartCount: number;
  isOwner: boolean;
  isLoggedIn: boolean;
  collect?: CollectConfig | null;
  placement: OverlayPlacement;
}

// Phones have no hover, so under 768px the flow overlay is always shown and
// wraps instead of running off a narrow screen.
const FLOW_CLASS =
  "mt-3 flex items-center gap-2 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-200 [&_.opacity-0]:opacity-100 max-md:opacity-100 max-md:pointer-events-auto max-md:flex-wrap max-md:justify-center";
const ANCHORED_CLASS = "[&_.opacity-0]:opacity-100";

export function GalleryPieceOverlay({
  artworkId,
  title,
  medium,
  byLine,
  heartCount,
  isOwner,
  isLoggedIn,
  collect,
  placement,
}: GalleryPieceOverlayProps) {
  const isFlow = placement.mode === "flow";

  return (
    <div
      className={isFlow ? FLOW_CLASS : ANCHORED_CLASS}
      style={isFlow ? undefined : placement.style}
    >
      <div className="whitespace-nowrap max-md:whitespace-normal max-md:max-w-[280px] rounded-md border border-[#c8a040]/40 bg-[rgba(18,12,6,0.92)] px-3 py-2 text-center shadow-lg">
        <p className="font-serif text-sm text-[#f5e6c8]">{title}</p>
        {medium && (
          <p className="mt-0.5 text-xs capitalize text-[#c8a040]/80">{medium}</p>
        )}
        {byLine && (
          <p className="mt-0.5 text-xs text-[#c8a040]/60">by {byLine}</p>
        )}
      </div>
      {isLoggedIn && (
        <HeartButton
          pieceId={artworkId}
          isOwner={isOwner}
          initialHeartCount={heartCount}
          isLoggedIn={isLoggedIn}
          // Touch sizing only applies under 768px, so desktop is unaffected.
          size="touch"
        />
      )}
      {collect && (
        <CollectButton
          size="touch"
          inventoryItemId={collect.inventoryItemId}
          priceCoins={collect.priceCoins}
          editionsRemaining={collect.editionsRemaining}
          collectorCoinBalance={collect.collectorCoinBalance}
        />
      )}
    </div>
  );
}

// ── Wall label (phone tap card) ──────────────────────────────────

export interface GalleryPieceLabelProps
  extends Omit<GalleryPieceOverlayProps, "placement"> {
  /** Makes the artist's name a link; null for the wall owner's own work. */
  byLineHref?: string | null;
}

/**
 * The phone wall's card for a tapped piece, styled as a cream gallery wall
 * label: caption on the left, heart top right, and Collect across the foot
 * only when the piece is for sale, so a label for a piece that isn't simply
 * ends after the medium. Positioning is the caller's job.
 */
export function GalleryPieceLabel({
  artworkId,
  title,
  medium,
  byLine,
  byLineHref,
  heartCount,
  isOwner,
  isLoggedIn,
  collect,
}: GalleryPieceLabelProps) {
  return (
    <div className="w-60 rounded-[3px] bg-[#f7f0e1] px-3.5 pb-3 pt-3.5 text-[#2a1d10] shadow-[0_1px_0_#d9ccb0,0_10px_22px_rgba(30,20,10,0.35)]">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-serif text-lg italic leading-snug text-[#1f150b]">{title}</p>
          {byLine && (
            <p className="mt-1 text-xs text-[#5c4a33]">
              by{" "}
              {byLineHref ? (
                <a href={byLineHref} className="text-[#8a5f12] underline underline-offset-2">
                  {byLine}
                </a>
              ) : (
                byLine
              )}
            </p>
          )}
          {medium && <p className="mt-px text-xs capitalize text-[#5c4a33]">{medium}</p>}
        </div>
        {isLoggedIn && (
          // Pulled into the corner so the 44px target doesn't pad the card.
          <div className="-mr-2.5 -mt-2.5 shrink-0">
            <HeartButton
              pieceId={artworkId}
              isOwner={isOwner}
              initialHeartCount={heartCount}
              isLoggedIn={isLoggedIn}
              size="touch"
              tone="light"
            />
          </div>
        )}
      </div>
      {collect && (
        <CollectButton
          inventoryItemId={collect.inventoryItemId}
          priceCoins={collect.priceCoins}
          editionsRemaining={collect.editionsRemaining}
          collectorCoinBalance={collect.collectorCoinBalance}
          variant="label"
        />
      )}
    </div>
  );
}

// ── Flow-layout composition ──────────────────────────────────────

export interface GalleryPieceCardProps
  extends GalleryPieceFrameProps,
    Omit<GalleryPieceOverlayProps, "placement"> {}

/**
 * Frame + flow-positioned overlay inside a `group` wrapper. Used by both
 * auto-layout paths, whose card bodies are identical.
 */
export function GalleryPieceCard({
  frameFile,
  artSrc,
  width,
  title,
  medium,
  artistName,
  fileType,
  priority,
  linkHref,
  wrapper,
  artworkId,
  byLine,
  heartCount,
  isOwner,
  isLoggedIn,
  collect,
}: GalleryPieceCardProps) {
  return (
    <div className="flex flex-col items-center group">
      <GalleryPieceFrame
        frameFile={frameFile}
        artSrc={artSrc}
        width={width}
        title={title}
        medium={medium}
        artistName={artistName}
        fileType={fileType}
        priority={priority}
        linkHref={linkHref}
        wrapper={wrapper}
      />
      <GalleryPieceOverlay
        artworkId={artworkId}
        title={title}
        medium={medium}
        byLine={byLine}
        heartCount={heartCount}
        isOwner={isOwner}
        isLoggedIn={isLoggedIn}
        collect={collect}
        placement={{ mode: "flow" }}
      />
    </div>
  );
}
