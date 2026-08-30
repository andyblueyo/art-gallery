"use client";

import { useEffect, useState } from "react";
import { getFrameConfig, type FrameInnerPadding } from "@/lib/frames";

export type InnerPadding = FrameInnerPadding;

export interface FramedArtworkProps {
  frame_file: string;
  artSrc: string;
  width: number;
  title: string;
  medium: string;
  artistName: string;
  fileType?: "image" | "pdf";
  innerPadding?: InnerPadding;
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
  innerPadding,
  className = "",
  style,
  rotation = 0,
  showTooltip = true,  
}: FramedArtworkProps) {
  const frameConfig = getFrameConfig(frame_file);
  // The unframed option: no frame PNG exists, so there is nothing to overlay
  // and the box is sized from the artwork itself rather than from a frame.
  const isUnframed = frameConfig.file === "none";
  const frameSrc = `/frames/${frameConfig.file}`;
  const shape = frameConfig.shape;

  // cropPadding is the per-frame art window, measured from each PNG's alpha
  // channel (see scripts/frame-window-inscribe.py) and stored as 0..1
  // fractions. For polaroid/digis it's the tuned source of truth, where
  // innerPadding is just a flat 10% placeholder.
  //
  // Classic frames stay on innerPadding: their cropPadding was never tuned
  // and measures far worse (frame2 70%, frame5 69% of the box outside the
  // real window). The circle/oval/heart ones also need a non-rectangular
  // fit, which a 4-sided padding can't express.
  //
  // An explicit innerPadding prop still wins, and stays in percent units.
  const cp = frameConfig.cropPadding;
  const padding = isUnframed
    ? { top: 0, right: 0, bottom: 0, left: 0 }
    : innerPadding ??
    (frameConfig.category === "classic"
      ? frameConfig.innerPadding
      : {
          top: cp.top * 100,
          right: cp.right * 100,
          bottom: cp.bottom * 100,
          left: cp.left * 100,
        });

  const [frameAspect, setFrameAspect] = useState<number | null>(null);
  const [hovered, setHovered] = useState(false);

  // Unframed pieces are never cropped to a frame's aspect, so their box height
  // has to come from the uploaded image's own proportions.
  const aspectSrc = isUnframed ? artSrc : frameSrc;

  useEffect(() => {
    const img = new window.Image();
    img.onload = () => {
      if (img.naturalWidth > 0) {
        setFrameAspect(img.naturalHeight / img.naturalWidth);
      }
    };
    img.src = aspectSrc;
  }, [aspectSrc]);

  const height = frameAspect ? width * frameAspect : undefined;

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
        <div
          style={{
            position: "absolute",
            top: `${padding.top}%`,
            left: `${padding.left}%`,
            right: `${padding.right}%`,
            bottom: `${padding.bottom}%`,
            overflow: "hidden",
            zIndex: 1,
            backgroundColor: "transparent",
            borderRadius: shape === "rect" ? 0 : "50%",
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
