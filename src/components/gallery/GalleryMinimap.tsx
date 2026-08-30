"use client";

import React from "react";
import type { GalleryPiece } from "@/lib/types";

// ── Minimap ──────────────────────────────────────────────────────

export interface GalleryMinimapProps {
  pieces: GalleryPiece[];
  scrollRef: React.RefObject<HTMLDivElement>;
}

export function GalleryMinimap({ pieces, scrollRef }: GalleryMinimapProps) {
  const CANVAS_W = 1400;
  const CANVAS_H = 1200;
  const MAP_W = 80;
  const MAP_H = 48;

  const [vp, setVp] = React.useState({ left: 0, top: 0, width: MAP_W, height: MAP_H });
  const [idle, setIdle] = React.useState(false);
  const idleTimer = React.useRef<ReturnType<typeof setTimeout>>();

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const update = () => {
      const scaleX = MAP_W / CANVAS_W;
      const scaleY = MAP_H / CANVAS_H;
      setVp({
        left: el.scrollLeft * scaleX,
        top: window.scrollY * scaleY,
        width: Math.min(MAP_W, window.innerWidth * scaleX),
        height: Math.min(MAP_H, window.innerHeight * scaleY),
      });
      setIdle(false);
      clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => setIdle(true), 1500);
    };

    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      clearTimeout(idleTimer.current);
    };
  }, [scrollRef]);

  const positioned = pieces;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 50,
        opacity: idle ? 0.4 : 1,
        transition: "opacity 0.4s ease",
        background: "rgba(18,12,6,0.75)",
        borderRadius: 8,
        border: "0.5px solid rgba(200,160,64,0.4)",
        padding: "8px 10px",
        backdropFilter: "blur(4px)",
      }}
    >
      <p style={{ fontSize: 9, color: "rgba(200,160,64,0.6)", margin: "0 0 5px", letterSpacing: "0.05em" }}>
        YOU ARE HERE
      </p>
      <div
        style={{
          position: "relative",
          width: MAP_W,
          height: MAP_H,
          background: "#ddd4b4",
          borderRadius: 3,
          overflow: "hidden",
        }}
      >
        {positioned.map(piece => (
          <div
            key={piece.id}
            style={{
              position: "absolute",
              left: `${piece.position_x}%`,
              top: `${piece.position_y}%`,
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "rgba(200,160,64,0.75)",
              transform: "translate(-50%, -50%)",
            }}
          />
        ))}
        <div
          style={{
            position: "absolute",
            left: vp.left,
            top: vp.top,
            width: vp.width,
            height: vp.height,
            border: "1.5px solid #c8a040",
            background: "rgba(200,160,64,0.15)",
            borderRadius: 2,
            pointerEvents: "none",
          }}
        />
      </div>
    </div>
  );
}
