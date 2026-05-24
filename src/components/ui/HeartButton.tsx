"use client";

import { useEffect, useState } from "react";
import { isArtworkHearted, toggleArtworkHeart } from "@/lib/hearts";

interface HeartButtonProps {
  artworkId: string;
  className?: string;
}

export function HeartButton({ artworkId, className = "" }: HeartButtonProps) {
  const [hearted, setHearted] = useState(false);

  useEffect(() => {
    setHearted(isArtworkHearted(artworkId));
  }, [artworkId]);

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    setHearted(toggleArtworkHeart(artworkId));
  }

  return (
    <button
      onClick={handleClick}
      aria-label={hearted ? "Remove from favorites" : "Add to favorites"}
      className={`p-2 rounded-full bg-white/90 backdrop-blur-sm shadow-sm hover:scale-110 transition-transform ${className}`}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill={hearted ? "#c0392b" : "none"}
        stroke={hearted ? "#c0392b" : "currentColor"}
        strokeWidth="2"
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    </button>
  );
}
