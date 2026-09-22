"use client";

import { useEffect, useState } from "react";

/** The custom wall is authored on a fixed canvas; both the wall and the editor use it. */
export const WALL_CANVAS_W = 1400;
export const WALL_CANVAS_H = 1200;

/** Matches the under-768px layout used everywhere else in the gallery. */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isMobile;
}

/**
 * Scale that fits the whole canvas to the viewport's width. Only the width is
 * fitted: a phone is taller than the wall's 7:6, so height is never the limit.
 */
export function useWallFitScale(): number {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const update = () =>
      setScale(Math.min(1, document.documentElement.clientWidth / WALL_CANVAS_W));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return scale;
}
