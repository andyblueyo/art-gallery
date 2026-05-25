import type { InnerPadding } from "@/components/gallery/FramedArtwork";

export interface WallArtist {
  name: string;
  handle: string;
  bio: string;
  instagram: string;
  pieceCount: number;
  followers: number;
}

export interface WallArtwork {
  title: string;
  medium: string;
  src: string;
  fileType?: "image" | "pdf";
  frame_file: string;
}

export interface GalleryLayoutItem {
  frameFile: string;
  artIndex: number;
  left: string;
  top: string;
  width: number;
  rot: number;
  innerPadding?: InnerPadding;
}

// All slots use frame1.png until landscape/oval frames are added to public/frames/
export const galleryLayout: GalleryLayoutItem[] = [
  { frameFile: "frame1.png", artIndex: 0, left: "4%", top: "8%", width: 200, rot: -2 },
  { frameFile: "frame1.png", artIndex: 1, left: "19%", top: "5%", width: 280, rot: 1 },
  { frameFile: "frame1.png", artIndex: 2, left: "43%", top: "3%", width: 160, rot: 0 },
  { frameFile: "frame1.png", artIndex: 3, left: "58%", top: "6%", width: 230, rot: -1 },
  { frameFile: "frame1.png", artIndex: 4, left: "81%", top: "4%", width: 180, rot: 2 },
  { frameFile: "frame1.png", artIndex: 5, left: "6%", top: "44%", width: 240, rot: 1 },
  { frameFile: "frame1.png", artIndex: 6, left: "24%", top: "40%", width: 320, rot: 0 },
  { frameFile: "frame1.png", artIndex: 7, left: "52%", top: "42%", width: 200, rot: -1 },
  { frameFile: "frame1.png", artIndex: 8, left: "68%", top: "38%", width: 260, rot: 1 },
  { frameFile: "frame1.png", artIndex: 9, left: "88%", top: "45%", width: 160, rot: -2 },
];

/** Per-frame inner padding (%). Add entries when new frame PNGs land in public/frames/ */
const FRAME_PADDING: Record<string, InnerPadding> = {
  "frame1.png": { top: 17, right: 15, bottom: 17, left: 15 },
  "frame2.png": { top: 11, right: 14, bottom: 11, left: 14 },
  "frame3.png": { top: 18, right: 16, bottom: 18, left: 16 },
};

export function getFramePadding(frameFile: string): InnerPadding | undefined {
  return FRAME_PADDING[frameFile];
}

