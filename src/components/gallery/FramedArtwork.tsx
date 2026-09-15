"use client";

import { useEffect, useId, useState } from "react";
import { frameImageUrl, frameWindowBBox } from "@/lib/frames";
import { useFrameConfig } from "@/components/frames/FramesProvider";
import { FrameWindowShape } from "@/components/frames/FrameWindowShape";

export interface FramedArtworkProps {
  frame_file: string;
  artSrc: string;
  width: number;
  title: string;
  medium: string;
  artistName: string;
  fileType?: "image" | "pdf";
  className?: string;
  style?: React.CSSProperties;
  rotation?: number; 
  showTooltip?: boolean;
}

export function FramedArtwork({
  frame_file,
  artSrc,
  width,
  title,
  medium,
  artistName,
  fileType = "image",
  className = "",
  style,
  rotation = 0,
  showTooltip = true,  
}: FramedArtworkProps) {
  const frameConfig = useFrameConfig(frame_file);
  // The unframed option: no frame PNG exists, so there is nothing to overlay
  // and the box is sized from the artwork itself rather than from a frame.
  const isUnframed = frameConfig.kind === "none";
  // Resized at the CDN. Floor of 800px: wall pieces get CSS-scaled up to
  // ~3x and the picker/tray render at 2x DPR, so anything smaller goes soft.
  const frameSrc = isUnframed ? "" : frameImageUrl(frameConfig, Math.max(800, width * 2));

  // Geometry comes from the catalog's traced window (Phase 1b), normalised
  // 0..1 against the frame image. The box below is exactly the frame image
  // scaled to `width`, so bbox percentages land the art on the real window
  // at any rendered size, and the window shape clips it — a heart shows a
  // heart, a rotated tama screen shows a rotated screen.
  const bbox = frameWindowBBox(frameConfig);
  const win = frameConfig.window;
  // A plain axis-aligned rect is already exactly the bbox: no clip needed.
  const needsClip = !isUnframed && win !== null && !(win.kind === "rect" && !win.radius);
  // useId() output contains colons, which are fine in an id but not in url().
  const clipId = `fw-${useId().replace(/:/g, "")}`;
  // window is in image coords; the clipped element is the bbox.
  const toBBoxLocal = `scale(${1 / bbox.w} ${1 / bbox.h}) translate(${-bbox.x} ${-bbox.y})`;

  const [hovered, setHovered] = useState(false);

  // Framed pieces are sized synchronously from the catalog aspect, so the box
  // never renders at a placeholder height (which the editor's drag bounds and
  // the wall's measured hover card both used to see mid-load). Unframed
  // pieces have no frame to size from, so they measure the artwork itself.
  const [artAspect, setArtAspect] = useState<number | null>(null);
  useEffect(() => {
    if (!isUnframed) return;
    const img = new window.Image();
    img.onload = () => {
      if (img.naturalWidth > 0) {
        setArtAspect(img.naturalHeight / img.naturalWidth);
      }
    };
    img.src = artSrc;
  }, [isUnframed, artSrc]);

  const height = isUnframed
    ? artAspect
      ? width * artAspect
      : undefined
    : frameConfig.aspect > 0
      ? width / frameConfig.aspect
      : undefined;

  return (
    <div
      className={`group select-none ${className}`}
      style={{
        position: "relative",
        background: "transparent",
        width,
        height: height ?? "auto",
        ...style,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
    >
      <div
        className="w-full transition-transform duration-300 ease-out group-hover:scale-[1.03] group-focus-within:scale-[1.03]"
        style={{
          position: "relative",
          background: "transparent",
          height: height ?? width * 1.3,
          transformOrigin: "center center",
        }}
      >
        {needsClip && win && (
          <svg width={0} height={0} aria-hidden style={{ position: "absolute" }}>
            <defs>
              <clipPath id={clipId} clipPathUnits="objectBoundingBox">
                <FrameWindowShape window={win} imageAspect={frameConfig.aspect} transform={toBBoxLocal} />
              </clipPath>
            </defs>
          </svg>
        )}
        <div
          style={{
            position: "absolute",
            left: isUnframed ? 0 : `${bbox.x * 100}%`,
            top: isUnframed ? 0 : `${bbox.y * 100}%`,
            width: isUnframed ? "100%" : `${bbox.w * 100}%`,
            height: isUnframed ? "100%" : `${bbox.h * 100}%`,
            overflow: "hidden",
            zIndex: 1,
            backgroundColor: "transparent",
            clipPath: needsClip ? `url(#${clipId})` : undefined,
            // stands in for the frame's own depth on unframed pieces
            boxShadow: isUnframed ? "0 6px 14px rgba(0,0,0,0.35)" : undefined,
          }}
        >
          {fileType === "pdf" ? (
            <div className="flex h-full w-full flex-col items-center justify-center bg-[#f5f0e8] p-2 text-center">
              <PdfDocIcon />
              <span className="mt-1 line-clamp-2 text-[10px] leading-tight text-[#6b5d4f]">
                {title}
              </span>
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={artSrc}
              alt={title}
              onError={(e) => {
                console.error("[FramedArtwork] art image failed to load", {
                  artSrc,
                  title,
                  event: e,
                });
              }}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          )}
        </div>

        {!isUnframed && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={frameSrc}
            alt=""
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              zIndex: 2,
              pointerEvents: "none",
            }}
          />
        )}
      </div>
      {showTooltip && (
  <div
    role="tooltip"
    style={{
      position: 'absolute',
      left: '50%',
      top: '100%',
      marginTop: 12,
      transform: `translateX(-50%) rotate(${-rotation}deg)`,
      transformOrigin: 'center top',
      zIndex: 20,
    }}
    className={`pointer-events-none whitespace-nowrap rounded-md border border-[#c8a040]/40 bg-[rgba(18,12,6,0.92)] px-3 py-2 text-center shadow-lg transition-all duration-200 ${
      hovered
        ? "opacity-100"
        : "opacity-0"
    }`}
  >
    <p className="font-serif text-sm text-[#f5e6c8]">{title}</p>
    <p className="mt-0.5 text-xs capitalize text-[#c8a040]/80">
      {medium}
    </p>
    <span className="sr-only">by {artistName}</span>
  </div>
)}
    </div>
  );
}

function PdfDocIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-[#c8a040]">
      <path
        d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M14 2v6h6M8 13h8M8 17h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
