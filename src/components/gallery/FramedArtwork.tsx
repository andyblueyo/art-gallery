"use client";

import Image from "next/image";
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
  const isExternalArt = artSrc.startsWith("http");

  return (
    <div
      className={`group relative select-none ${className}`}
      style={{
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
        className="relative w-full transition-transform duration-300 ease-out group-hover:scale-[1.03] group-focus-within:scale-[1.03]"
        style={{
          height: height ?? width * 1.3,
          transformOrigin: "center center",
        }}
      >
        <div
          className="absolute overflow-hidden"
          style={{
            top: `${innerPadding.top}%`,
            right: `${innerPadding.right}%`,
            bottom: `${innerPadding.bottom}%`,
            left: `${innerPadding.left}%`,
            zIndex: 1,
          }}
        >
          {fileType === "pdf" ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#f5f0e8] p-2 text-center">
              <PdfDocIcon />
              <span className="mt-1 line-clamp-2 text-[10px] leading-tight text-[#6b5d4f]">
                {title}
              </span>
            </div>
          ) : isExternalArt ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={artSrc}
              alt={title}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <Image
              src={artSrc}
              alt={title}
              fill
              className="object-cover"
              sizes={`${width}px`}
              unoptimized
            />
          )}
        </div>

        <Image
          src={frameSrc}
          alt=""
          fill
          className="pointer-events-none object-contain"
          style={{ zIndex: 2 }}
          sizes={`${width}px`}
          unoptimized
          aria-hidden
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
