import type { FrameShape } from "@/lib/types";

export function getFrameShape(
  width: number,
  height: number
): FrameShape {
  const ratio = width / height;
  if (ratio > 1.15) return "landscape";
  if (ratio < 0.85) return "portrait";
  return "square";
}

export function getFrameShapeFromUrl(url: string): FrameShape {
  // Default until image loads; square works as neutral fallback
  if (url.includes("w=900") || url.includes("w=1200")) return "landscape";
  if (url.includes("h=800") || url.includes("h=900")) return "portrait";
  return "square";
}
