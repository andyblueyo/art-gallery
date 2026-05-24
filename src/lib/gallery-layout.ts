import type { GalleryLayoutItem } from "@/lib/gallery-wall-data";

/** Fixed salon positions — reused for however many pieces the artist has (up to 10). */
const SALON_SLOTS: Omit<GalleryLayoutItem, "artIndex">[] = [
  { frameFile: "frame1.png", left: "4%", top: "8%", width: 200, rot: -2 },
  { frameFile: "frame1.png", left: "19%", top: "5%", width: 280, rot: 1 },
  { frameFile: "frame1.png", left: "43%", top: "3%", width: 160, rot: 0 },
  { frameFile: "frame1.png", left: "58%", top: "6%", width: 230, rot: -1 },
  { frameFile: "frame1.png", left: "81%", top: "4%", width: 180, rot: 2 },
  { frameFile: "frame1.png", left: "6%", top: "44%", width: 240, rot: 1 },
  { frameFile: "frame1.png", left: "24%", top: "40%", width: 320, rot: 0 },
  { frameFile: "frame1.png", left: "52%", top: "42%", width: 200, rot: -1 },
  { frameFile: "frame1.png", left: "68%", top: "38%", width: 260, rot: 1 },
  { frameFile: "frame1.png", left: "88%", top: "45%", width: 160, rot: -2 },
];

const MAX_WALL_PIECES = 10;

/** Build wall layout for the first N artworks (max 10). */
export function buildGalleryLayout(pieceCount: number): GalleryLayoutItem[] {
  const count = Math.min(Math.max(pieceCount, 0), MAX_WALL_PIECES);
  return SALON_SLOTS.slice(0, count).map((slot, artIndex) => ({
    ...slot,
    artIndex,
  }));
}

export const GALLERY_WALL_MAX = MAX_WALL_PIECES;
