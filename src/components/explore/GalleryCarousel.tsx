"use client";

import { useEffect, useRef, useState } from "react";
import { GalleryCard, type DirectoryGallery } from "./GalleryDirectory";

// How long each gallery holds the centre before the next slides in.
const INTERVAL_MS = 4500;
// A horizontal drag longer than this (px) counts as a swipe.
const SWIPE_PX = 40;

// `from` is the previous centre, so a card that wraps round the back of the
// ring (or skips several places) can jump there instead of sliding across.
type Position = { center: number; from: number };

const stepBy = (by: number, n: number) => ({ center }: Position): Position => ({
  center: (center + by + n) % n,
  from: center,
});

// Where card i sits relative to the centre card on a ring with no ends:
// 0 is the centre, ±1 the neighbours peeking in at the sides.
function offsetOf(i: number, center: number, n: number) {
  const half = Math.floor(n / 2);
  return ((i - center + n + half) % n) - half;
}

// The landing page's example galleries: one card in the centre, its
// neighbours faded at the sides, advancing on its own. Hovering or focusing
// holds it still; clicking a side card or swiping moves it by hand.
export function GalleryCarousel({ galleries }: { galleries: DirectoryGallery[] }) {
  const n = galleries.length;
  const [{ center, from }, setPosition] = useState<Position>({ center: 0, from: 0 });
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const touchX = useRef<number | null>(null);

  useEffect(() => {
    if (n < 2 || hovered || focused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setTimeout(() => setPosition(stepBy(1, n)), INTERVAL_MS);
    return () => window.clearTimeout(id);
  }, [center, hovered, focused, n]);

  if (n === 0) return null;

  return (
    <div
      className="grid justify-items-center"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false);
      }}
      onTouchStart={(e) => {
        touchX.current = e.touches[0].clientX;
      }}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        touchX.current = null;
        if (n > 1 && Math.abs(dx) > SWIPE_PX) setPosition(stepBy(dx < 0 ? 1 : -1, n));
      }}
    >
      {galleries.map((gallery, i) => {
        const offset = offsetOf(i, center, n);
        const jumped = Math.abs(offset - offsetOf(i, from, n)) > 1;
        const side = Math.abs(offset) === 1;

        return (
          <div
            key={gallery.handle}
            className="relative w-[min(24rem,78vw)] [grid-area:1/1] motion-reduce:!transition-none"
            style={{
              transform: `translateX(calc(${offset} * (100% + 1.5rem))) scale(${offset === 0 ? 1 : 0.92})`,
              opacity: offset === 0 ? 1 : side ? 0.45 : 0,
              transition: jumped
                ? "opacity 600ms ease"
                : "transform 600ms ease, opacity 600ms ease",
              zIndex: offset === 0 ? 1 : 0,
            }}
          >
            {/* Only the centre card can be tabbed to or read out. React 18
                has no `inert` prop, so it's set on the element directly. */}
            <div ref={(el) => void el?.toggleAttribute("inert", offset !== 0)}>
              <GalleryCard gallery={gallery} />
            </div>
            {side && (
              <button
                type="button"
                tabIndex={-1}
                aria-label={`show ${gallery.displayName || gallery.handle}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setPosition(stepBy(offset, n))}
                className="absolute inset-0 cursor-pointer"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
