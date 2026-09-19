"use client";

import { useId } from "react";
import { useFrames } from "@/components/frames/FramesProvider";
import { FrameWindowShape } from "@/components/frames/FrameWindowShape";
import { frameImageUrl, frameWindowBBox, resolveFrame, type FrameConfig } from "@/lib/frames";
import { artworkImageUrl } from "@/lib/artwork-image";
import type { WallBackground, WallCover as WallCoverData, WallCoverArt } from "@/lib/types";

// A card-sized copy of a gallery wall: the same pieces, frames, positions and
// background, laid out as percentages of a reference page so it scales with
// plain CSS. The cover shows the top of the wall as it looks on arrival on a
// laptop; hovering the parent card (`group`) pans slowly down the rest.

// Custom walls — CustomLayoutView in GallerySalonWall: a 1400×1200 canvas
// under a 56px (pt-14) header, pieces 220px wide before scale.
const CANVAS_W = 1400;
const CANVAS_H = 1200;
const CANVAS_TOP = 56;
const BASE_PIECE_W = 220;

// Auto walls — the desktop grid at a 1440px viewport: px-6 pt-24 pb-28,
// three columns with gap-10, 280px pieces centred, and the hover caption
// under each piece taking its space in flow (approximated).
const AUTO_PAGE_W = 1440;
const AUTO_PAD_X = 24;
const AUTO_PAD_TOP = 96;
const AUTO_PAD_BOTTOM = 112;
const AUTO_GAP = 40;
const AUTO_PIECE_W = 280;
const AUTO_CAPTION_H = 72;
const AUTO_COL_W = (AUTO_PAGE_W - 2 * AUTO_PAD_X - 2 * AUTO_GAP) / 3;
// Unframed pieces are sized from the image once it loads; assume portrait.
const UNFRAMED_ASPECT = 0.8;

// Cards are 15:8, about the shape of a laptop screen, so nothing is squashed.
const COVER_ASPECT = 15 / 8;
// Roughly the widest a cover is ever drawn in device pixels (one-column cards
// on a phone), used to pick image sizes. Most pieces land in the 240px bucket.
const MAX_COVER_PX = 1000;

interface Placed {
  art: WallCoverArt;
  frame: FrameConfig;
  left: number;
  top: number;
  width: number;
  rotation: number;
  zIndex: number;
}

interface Page {
  width: number;
  height: number;
  placed: Placed[];
}

function placeCustom(wall: Extract<WallCoverData, { layout: "custom" }>, frames: FrameConfig[]): Page {
  return {
    width: CANVAS_W,
    height: CANVAS_TOP + CANVAS_H,
    // rotate() then scale() from the top-left corner, as on the wall, is the
    // same box as a (220 × scale)-wide piece rotated from its top-left.
    placed: wall.pieces.map((p, i) => ({
      art: p,
      frame: frames[i],
      left: (p.x / 100) * CANVAS_W,
      top: CANVAS_TOP + (p.y / 100) * CANVAS_H,
      width: BASE_PIECE_W * p.scale,
      rotation: p.rotation,
      zIndex: p.zIndex,
    })),
  };
}

function placeAuto(wall: Extract<WallCoverData, { layout: "auto" }>, frames: FrameConfig[]): Page {
  const placed: Placed[] = [];
  let top = AUTO_PAD_TOP;
  for (let start = 0; start < wall.pieces.length; start += 3) {
    let rowHeight = 0;
    wall.pieces.slice(start, start + 3).forEach((art, col) => {
      const frame = frames[start + col];
      const aspect = frame.kind === "none" ? UNFRAMED_ASPECT : frame.aspect;
      rowHeight = Math.max(rowHeight, AUTO_PIECE_W / aspect);
      placed.push({
        art,
        frame,
        left: AUTO_PAD_X + col * (AUTO_COL_W + AUTO_GAP) + (AUTO_COL_W - AUTO_PIECE_W) / 2,
        top,
        width: AUTO_PIECE_W,
        rotation: 0,
        zIndex: 1,
      });
    });
    top += rowHeight + AUTO_CAPTION_H + AUTO_GAP;
  }
  return { width: AUTO_PAGE_W, height: top - AUTO_GAP + AUTO_PAD_BOTTOM, placed };
}

// Same rules as GallerySalonWall's wallBgStyle.
function wallBackgroundStyle(bg: WallBackground): React.CSSProperties {
  return bg.type === "image" && bg.imageUrl
    ? {
        backgroundImage: `url(${bg.imageUrl})`,
        backgroundSize: bg.imageMode === "tile" ? "auto" : "cover",
        backgroundRepeat: bg.imageMode === "tile" ? "repeat" : "no-repeat",
        backgroundPosition: "center",
      }
    : { backgroundColor: bg.color };
}

export function WallCover({ wall }: { wall: WallCoverData }) {
  const catalog = useFrames();
  const frames = wall.pieces.map((p) => resolveFrame(catalog, p.frameFile));
  const page = wall.layout === "custom" ? placeCustom(wall, frames) : placeAuto(wall, frames);

  const viewHeight = page.width / COVER_ASPECT;
  const height = Math.max(page.height, viewHeight);
  const pan = ((height - viewHeight) / height) * 100;

  return (
    <div className="relative aspect-[15/8] overflow-hidden" style={wallBackgroundStyle(wall.background)}>
      <div
        className="absolute inset-x-0 top-0 transition-transform duration-[2600ms] ease-in-out motion-reduce:transition-none group-hover:[transform:translateY(var(--pan))] group-focus-visible:[transform:translateY(var(--pan))]"
        style={{ aspectRatio: `${page.width} / ${height}`, "--pan": `-${pan}%` } as React.CSSProperties}
      >
        {page.placed.map((piece, i) => (
          <MiniPiece key={i} piece={piece} pageWidth={page.width} pageHeight={height} />
        ))}
      </div>
      <div className="gallery-salon-wall__texture pointer-events-none absolute inset-0" />
      <div className="gallery-salon-wall__vignette pointer-events-none absolute inset-0" />
      {page.placed.length === 0 && (
        <p className="absolute inset-0 flex items-center justify-center font-serif text-sm italic text-[#2C2A22]/50">
          waiting for its first piece
        </p>
      )}
    </div>
  );
}

// FramedArtwork's geometry at thumbnail size: art in the frame's window
// bbox, clipped to the window shape, frame PNG on top. No hover, skeleton or
// blur-up, so the cover stays static markup.
function MiniPiece({ piece, pageWidth, pageHeight }: { piece: Placed; pageWidth: number; pageHeight: number }) {
  const clipId = `wc-${useId().replace(/:/g, "")}`;
  const { art, frame } = piece;
  const imageWidth = Math.round((piece.width / pageWidth) * MAX_COVER_PX);

  const box: React.CSSProperties = {
    position: "absolute",
    left: `${(piece.left / pageWidth) * 100}%`,
    top: `${(piece.top / pageHeight) * 100}%`,
    width: `${(piece.width / pageWidth) * 100}%`,
    transform: piece.rotation ? `rotate(${piece.rotation}deg)` : undefined,
    transformOrigin: "top left",
    zIndex: piece.zIndex,
  };

  const artwork =
    art.fileType === "pdf" ? (
      <div className="h-full w-full bg-[#f5f0e8]" />
    ) : (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={artworkImageUrl(art.fileUrl, imageWidth)}
        alt=""
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover"
      />
    );

  if (frame.kind === "none") {
    return (
      <div style={{ ...box, aspectRatio: art.fileType === "pdf" ? UNFRAMED_ASPECT : undefined }}>
        <div className="h-full w-full shadow-[0_2px_5px_rgba(0,0,0,0.3)]">{artwork}</div>
      </div>
    );
  }

  const bbox = frameWindowBBox(frame);
  const win = frame.window;
  // A plain axis-aligned rect is already exactly the bbox: no clip needed.
  const needsClip = win !== null && !(win.kind === "rect" && !win.radius);

  return (
    <div style={{ ...box, aspectRatio: frame.aspect }}>
      {needsClip && win && (
        <svg width={0} height={0} aria-hidden style={{ position: "absolute" }}>
          <defs>
            <clipPath id={clipId} clipPathUnits="objectBoundingBox">
              <FrameWindowShape
                window={win}
                imageAspect={frame.aspect}
                transform={`scale(${1 / bbox.w} ${1 / bbox.h}) translate(${-bbox.x} ${-bbox.y})`}
              />
            </clipPath>
          </defs>
        </svg>
      )}
      <div
        style={{
          position: "absolute",
          left: `${bbox.x * 100}%`,
          top: `${bbox.y * 100}%`,
          width: `${bbox.w * 100}%`,
          height: `${bbox.h * 100}%`,
          overflow: "hidden",
          clipPath: needsClip ? `url(#${clipId})` : undefined,
        }}
      >
        {artwork}
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={frameImageUrl(frame, imageWidth)}
        alt=""
        loading="lazy"
        decoding="async"
        className="absolute inset-0 h-full w-full"
      />
    </div>
  );
}
