"use client";

import React from "react";
import { HeartButton } from "@/components/ui/HeartButton";
import { CollectButton } from "@/components/gallery/CollectButton";
import type { CollectConfig } from "./GalleryPieceCard";

/**
 * Phone-only stand-in for the custom wall's hover card: a bottom sheet for the
 * tapped piece, with ‹ › to walk the wall in reading order. Every control is
 * a 44px target.
 */

export interface GalleryPieceSheetProps {
  artworkId: string;
  title: string;
  medium: string;
  byLine: string;
  heartCount: number;
  /** Cross-artist link-out; the tap that opened the sheet no longer navigates. */
  linkHref: string | null;
  collect: CollectConfig | null;
  isOwner: boolean;
  isLoggedIn: boolean;
  index: number;
  total: number;
  zoomed: boolean;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
  onToggleZoom: () => void;
}

const navBtn =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#c8a040]/30 text-lg text-[#f5e6c8]/80 disabled:opacity-30";

export function GalleryPieceSheet({
  artworkId,
  title,
  medium,
  byLine,
  heartCount,
  linkHref,
  collect,
  isOwner,
  isLoggedIn,
  index,
  total,
  zoomed,
  onPrev,
  onNext,
  onClose,
  onToggleZoom,
}: GalleryPieceSheetProps) {
  return (
    <div
      role="dialog"
      aria-label={title}
      className="fixed inset-x-0 bottom-0 z-[45] border-t border-[#c8a040]/30 bg-[rgba(18,12,6,0.95)] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_rgba(0,0,0,0.35)] backdrop-blur-md"
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-serif text-base leading-snug text-[#f5e6c8]">{title}</p>
          {medium && (
            <p className="mt-0.5 text-xs capitalize text-[#c8a040]/80">{medium}</p>
          )}
          <p className="mt-0.5 text-xs text-[#c8a040]/60">
            by{" "}
            {linkHref ? (
              <a href={linkHref} className="underline underline-offset-2">
                {byLine}
              </a>
            ) : (
              byLine
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="-mr-2 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center text-xl text-[#f5e6c8]/60"
        >
          ×
        </button>
      </div>

      {(isLoggedIn || collect) && (
        <div className="mt-3 flex items-center gap-2">
          {isLoggedIn && (
            <HeartButton
              key={artworkId}
              pieceId={artworkId}
              isOwner={isOwner}
              initialHeartCount={heartCount}
              isLoggedIn={isLoggedIn}
              size="touch"
            />
          )}
          {collect && (
            <CollectButton
              key={collect.inventoryItemId}
              inventoryItemId={collect.inventoryItemId}
              priceCoins={collect.priceCoins}
              editionsRemaining={collect.editionsRemaining}
              collectorCoinBalance={collect.collectorCoinBalance}
              size="touch"
            />
          )}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        <button type="button" onClick={onPrev} disabled={index === 0} aria-label="Previous piece" className={navBtn}>
          ‹
        </button>
        <span className="w-12 text-center text-xs tabular-nums text-[#f5e6c8]/50">
          {index + 1} / {total}
        </span>
        <button type="button" onClick={onNext} disabled={index === total - 1} aria-label="Next piece" className={navBtn}>
          ›
        </button>
        <button
          type="button"
          onClick={onToggleZoom}
          className="ml-auto min-h-[44px] rounded-full border border-[#c8a040]/50 px-4 text-sm text-[#c8a040]"
        >
          {zoomed ? "see whole wall" : "see it up close"}
        </button>
      </div>
    </div>
  );
}
