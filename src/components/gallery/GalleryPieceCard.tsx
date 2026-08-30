"use client";

import React from "react";
import { FramedArtwork, type InnerPadding } from "./FramedArtwork";
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
  innerPadding?: InnerPadding;
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
  innerPadding,
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
      innerPadding={innerPadding}
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

const FLOW_CLASS =
  "mt-3 flex items-center gap-2 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-200 [&_.opacity-0]:opacity-100";
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
      <div className="whitespace-nowrap rounded-md border border-[#c8a040]/40 bg-[rgba(18,12,6,0.92)] px-3 py-2 text-center shadow-lg">
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
        />
      )}
      {collect && (
        <CollectButton
          inventoryItemId={collect.inventoryItemId}
          artworkId={artworkId}
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
  innerPadding,
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
        innerPadding={innerPadding}
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
