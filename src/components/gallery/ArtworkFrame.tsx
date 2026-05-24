"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import type { Artwork, FrameShape } from "@/lib/types";
import { getFrameShape } from "@/lib/frame-utils";
import { HeartButton } from "@/components/ui/HeartButton";

interface ArtworkFrameProps {
  artwork: Artwork;
  shape?: FrameShape;
  className?: string;
  variant?: "wall" | "grid";
}

const shapeStyles: Record<
  FrameShape,
  { container: string; aspect: string }
> = {
  portrait: {
    container: "w-36 sm:w-44 md:w-48",
    aspect: "aspect-[3/4]",
  },
  landscape: {
    container: "w-48 sm:w-56 md:w-64",
    aspect: "aspect-[4/3]",
  },
  square: {
    container: "w-36 sm:w-44 md:w-48",
    aspect: "aspect-square",
  },
};

export function ArtworkFrame({
  artwork,
  shape: initialShape,
  className = "",
  variant = "wall",
}: ArtworkFrameProps) {
  const [shape, setShape] = useState<FrameShape>(initialShape ?? "square");
  const styles = shapeStyles[shape];
  const isOval = shape === "square";

  useEffect(() => {
    if (initialShape) return;
    const img = new window.Image();
    img.onload = () => {
      setShape(getFrameShape(img.naturalWidth, img.naturalHeight));
    };
    img.src = artwork.file_url;
  }, [artwork.file_url, initialShape]);

  if (variant === "grid") {
    return (
      <div className={`group ${className}`}>
        <div className="frame-base rounded-sm">
          <div className="frame-inner aspect-square relative">
            <ArtworkImage artwork={artwork} fill className="object-cover" />
            <ArtworkOverlay artwork={artwork} />
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
              <HeartButton artworkId={artwork.id} />
            </div>
          </div>
        </div>
        <div className="mt-3">
          <p className="font-medium text-brown text-sm">{artwork.title}</p>
          {artwork.medium && (
            <p className="text-brown-muted text-xs mt-0.5">{artwork.medium}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`group ${styles.container} ${className}`}>
      <div
        className={`frame-base ${isOval ? "rounded-full" : "rounded-sm"}`}
      >
        <div
          className={`frame-inner ${styles.aspect} relative ${
            isOval ? "rounded-full" : ""
          }`}
        >
          <ArtworkImage
            artwork={artwork}
            fill
            className={`object-cover ${isOval ? "rounded-full" : ""}`}
          />
          <ArtworkOverlay artwork={artwork} oval={isOval} />
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
            <HeartButton artworkId={artwork.id} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ArtworkImage({
  artwork,
  fill,
  className,
}: {
  artwork: Artwork;
  fill?: boolean;
  className?: string;
}) {
  const isExternal = artwork.file_url.startsWith("http");

  if (isExternal) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={artwork.file_url}
        alt={artwork.title}
        className={`${fill ? "absolute inset-0 w-full h-full" : ""} ${className}`}
      />
    );
  }

  return (
    <Image
      src={artwork.file_url}
      alt={artwork.title}
      fill={fill}
      className={className}
      sizes="(max-width: 768px) 50vw, 300px"
    />
  );
}

function ArtworkOverlay({
  artwork,
  oval = false,
}: {
  artwork: Artwork;
  oval?: boolean;
}) {
  return (
    <div
      className={`absolute inset-0 bg-brown/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center text-center p-4 ${
        oval ? "rounded-full" : ""
      }`}
    >
      <p className="text-cream font-medium text-sm">{artwork.title}</p>
      {artwork.medium && (
        <p className="text-cream/80 text-xs mt-1">{artwork.medium}</p>
      )}
    </div>
  );
}
