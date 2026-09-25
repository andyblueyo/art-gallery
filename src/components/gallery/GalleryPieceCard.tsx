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

// ── Overlay (seal card placed under a frame) ─────────────────────

/**
 * How the overlay is positioned relative to the frame.
 * - "flow": sits below the frame in normal flow, revealed by CSS group-hover.
 * - "anchored": absolutely positioned by the caller, which owns the measured
 *   offset and hover-driven opacity in its style object.
 */
export type OverlayPlacement =
  | { mode: "flow" }
  | { mode: "anchored"; style: React.CSSProperties };

export interface GalleryPieceOverlayProps extends GalleryPieceSealCardProps {
  placement: OverlayPlacement;
}

// Phones have no hover, so under 768px the flow overlay is always shown.
const FLOW_CLASS =
  "mt-4 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-200 max-md:opacity-100 max-md:pointer-events-auto";

export function GalleryPieceOverlay({ placement, ...card }: GalleryPieceOverlayProps) {
  const isFlow = placement.mode === "flow";

  return (
    <div
      className={isFlow ? FLOW_CLASS : undefined}
      style={isFlow ? undefined : placement.style}
    >
      <GalleryPieceSealCard {...card} />
    </div>
  );
}

// ── Seal card (title card + heart seal + collect) ────────────────

export interface GalleryPieceSealCardProps {
  artworkId: string;
  title: string;
  medium: string;
  /** Renders the "by …" line when set. Auto layout omits it. */
  byLine?: string | null;
  /** Makes the artist's name a link; null for the wall owner's own work. */
  byLineHref?: string | null;
  heartCount: number;
  isOwner: boolean;
  isLoggedIn: boolean;
  collect?: CollectConfig | null;
}

/**
 * The card under a gallery piece, shared by the desktop hover, the auto
 * layout, the phone tap and the "see all" grid: a dark, centred title card
 * with the heart as a round seal on its top edge, and a full-width Collect
 * button below it only when the piece is for sale. Positioning is the
 * caller's job.
 *
 * It hugs its text: 160px for a short title, growing to 224px before long
 * titles wrap. Collect shares the card's width, so a for-sale card is at
 * least as wide as the button's label.
 *
 * The seal overhangs the card by half its height; that overhang is padding on
 * the wrapper (not a margin) so callers that measure this element, like the
 * phone label, get its full height.
 */
export function GalleryPieceSealCard({
  artworkId,
  title,
  medium,
  byLine,
  byLineHref,
  heartCount,
  isOwner,
  isLoggedIn,
  collect,
}: GalleryPieceSealCardProps) {
  return (
    <div className={`flex w-fit min-w-[160px] max-w-[224px] flex-col gap-3 ${isLoggedIn ? "pt-[22px]" : ""}`}>
      <div
        className={`relative rounded-md border border-[#c8a040]/40 bg-[rgba(18,12,6,0.92)] px-4 pb-2.5 text-center shadow-[0_6px_14px_rgba(0,0,0,0.25)] ${
          isLoggedIn ? "pt-6" : "pt-2.5"
        }`}
      >
        {isLoggedIn && (
          <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2">
            <HeartButton
              pieceId={artworkId}
              isOwner={isOwner}
              initialHeartCount={heartCount}
            />
          </div>
        )}
        <p className="text-balance font-serif text-base italic leading-[1.3] text-[#f5e6c8] [overflow-wrap:anywhere]">
          {title}
        </p>
        {byLine && (
          <p className="mt-1 text-xs text-[#c8a040]/70">
            by{" "}
            {byLineHref ? (
              <a href={byLineHref} className="text-[#c8a040] underline underline-offset-2 hover:text-[#e9c877]">
                {byLine}
              </a>
            ) : (
              byLine
            )}
          </p>
        )}
        {medium && (
          <p className="mt-px text-balance text-xs capitalize leading-[1.35] text-[#c8a040]/85 [overflow-wrap:anywhere]">
            {medium}
          </p>
        )}
      </div>
      {collect && (
        <CollectButton
          inventoryItemId={collect.inventoryItemId}
          priceCoins={collect.priceCoins}
          editionsRemaining={collect.editionsRemaining}
          collectorCoinBalance={collect.collectorCoinBalance}
        />
      )}
    </div>
  );
}

// ── Flow-layout composition ──────────────────────────────────────

export interface GalleryPieceCardProps
  extends GalleryPieceFrameProps,
    GalleryPieceSealCardProps {}

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
