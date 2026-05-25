"use client";

import { useEffect, useState } from "react";

export type InnerPadding = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

const DEFAULT_INNER_PADDING: InnerPadding = {
  top: 14,
  right: 13,
  bottom: 14,
  left: 13,
};

export interface FramedArtworkProps {
  frameSrc: string;
  artSrc: string;
  width: number;
  title: string;
  medium: string;
  artistName: string;
  fileType?: "image" | "pdf";
  innerPadding?: InnerPadding;
  className?: string;
  style?: React.CSSProperties;
}

export function FramedArtwork({
  frameSrc,
  artSrc,
  width,
  title,
  medium,
  artistName,
  fileType = "image",
  innerPadding = DEFAULT_INNER_PADDING,
  className = "",
  style,
}: FramedArtworkProps) {
  console.log("FramedArtwork rendering:", { artSrc, frameSrc, width });

  const [frameAspect, setFrameAspect] = useState<number | null>(null);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    const img = new window.Image();
    img.onload = () => {
      if (img.naturalWidth > 0) {
        setFrameAspect(img.naturalHeight / img.naturalWidth);
      }
    };
    img.src = frameSrc;
  }, [frameSrc]);

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
            top: `${innerPadding.top}%`,
            left: `${innerPadding.left}%`,
            right: `${innerPadding.right}%`,
            bottom: `${innerPadding.bottom}%`,
            overflow: "hidden",
            zIndex: 1,
            backgroundColor: "transparent",
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

        {/* eslint-disable-next-line @next/next/no-img-element */}
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
      </div>

      <div
        role="tooltip"
        className={`pointer-events-none absolute left-1/2 top-full z-20 mt-3 -translate-x-1/2 whitespace-nowrap rounded-md border border-[#c8a040]/40 bg-[rgba(18,12,6,0.92)] px-3 py-2 text-center shadow-lg transition-all duration-200 ${
          hovered
            ? "translate-y-0 opacity-100"
            : "-translate-y-1 opacity-0"
        }`}
      >
        <p className="font-serif text-sm text-[#f5e6c8]">{title}</p>
        <p className="mt-0.5 text-xs capitalize text-[#c8a040]/80">
          {medium}
        </p>
        <span className="sr-only">by {artistName}</span>
      </div>
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
