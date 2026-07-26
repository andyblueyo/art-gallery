export type FrameShape = "rect" | "circle" | "oval";
export type FrameCategory = "classic" | "polaroid" | "digis";

export interface FrameInnerPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface FrameConfig {
  file: string;
  label: string;
  category: FrameCategory;
  aspect: number;
  shape: FrameShape;
  innerPadding: FrameInnerPadding;
  selectionScale?: number; // scale factor for selection bounding box
  cropPadding: { top: number; right: number; bottom: number; left: number };
}

export const FRAME_CATEGORIES: { id: FrameCategory; label: string }[] = [
  { id: "classic",  label: "classic"  },
  { id: "polaroid", label: "polaroid" },
  { id: "digis",    label: "digis"    },
];

export const FRAMES: FrameConfig[] = [
  // ── classic ──────────────────────────────────────────────────────────────
  { file: "frame1.png", label: "Ornate Gold",      category: "classic", aspect: 3/4,  selectionScale: 1.0,  shape: "rect",   innerPadding: { top: 10, right: 10, bottom: 9,  left: 10 }, cropPadding: { top: 0.18, right: 0.18, bottom: 0.18, left: 0.18 }},
  { file: "frame2.png", label: "Circle Gold",      category: "classic", aspect: 1/1,  selectionScale: 1.0,  shape: "circle", innerPadding: { top: 16, right: 16, bottom: 16, left: 16 }, cropPadding: { top: 0.0, right: 0.0, bottom: 0.0, left: 0.0 } },
  { file: "frame3.png", label: "Thin Ornate",      category: "classic", aspect: 3/4,  selectionScale: 1.0,  shape: "rect",   innerPadding: { top: 12, right: 10, bottom: 12, left: 10 }, cropPadding: { top: 0.17, right: 0.16, bottom: 0.17, left: 0.16 } },
  { file: "frame4.png", label: "Simple Gold",      category: "classic", aspect: 3/4,  selectionScale: 1.0,  shape: "rect",   innerPadding: { top: 10, right: 10, bottom: 10, left: 10 }, cropPadding: { top: 0.13, right: 0.13, bottom: 0.13, left: 0.13 } },
  { file: "frame5.png", label: "Heart",            category: "classic", aspect: 1/1,  selectionScale: 1.0,  shape: "circle", innerPadding: { top: 12, right: 12, bottom: 10, left: 12 }, cropPadding: { top: 0.0, right: 0.15, bottom: 0.0, left: 0.0 } },
  { file: "frame6.png", label: "Oval Gold",        category: "classic", aspect: 2/3,  selectionScale: 1.0,  shape: "oval",   innerPadding: { top: 15, right: 18, bottom: 15, left: 18 }, cropPadding: { top: 0.17, right: 0.21, bottom: 0.33, left: 0.21 } },
  { file: "frame7.png", label: "Silver Square",    category: "classic", aspect: 1/1,  selectionScale: 1.04, shape: "rect",   innerPadding: { top: 13, right: 13, bottom: 13, left: 13 }, cropPadding: { top: 0.18, right: 0.18, bottom: 0.18, left: 0.18 } },
  { file: "frame8.png", label: "Gold Rectangular", category: "classic", aspect: 4/3,  selectionScale: 1.1,  shape: "rect",   innerPadding: { top: 13, right: 8,  bottom: 8,  left: 8  }, cropPadding: { top: 0.1, right: 0.0, bottom: 0.1, left: 0.0 } },

  // ── polaroid ─────────────────────────────────────────────────────────────
  // QA note: all polaroid frames have transparent backgrounds — visual QA required for each
  { file: "polaroid/cherry.png",          label: "Cherry",          category: "polaroid", aspect: 281/342, shape: "rect", innerPadding: { top: 10, right: 10, bottom: 10, left: 10 }, cropPadding: { top: 0.088, right: 0.230, bottom: 0.228, left: 0.208 } },
  { file: "polaroid/film.png",            label: "Film",            category: "polaroid", aspect: 334/468, shape: "rect", innerPadding: { top: 10, right: 10, bottom: 10, left: 10 }, cropPadding: { top: 0.069, right: 0.091, bottom: 0.167, left: 0.091 } },
  { file: "polaroid/film1-horizontal.png",label: "Film 1 Horizontal",category: "polaroid",aspect: 488/420, shape: "rect", innerPadding: { top: 10, right: 10, bottom: 10, left: 10 }, cropPadding: { top: 0.057, right: 0.036, bottom: 0.059, left: 0.034 } },
  { file: "polaroid/film1.png",           label: "Film 1",          category: "polaroid", aspect: 350/374, shape: "rect", innerPadding: { top: 10, right: 10, bottom: 10, left: 10 }, cropPadding: { top: 0.173, right: 0.055, bottom: 0.203, left: 0.068 } },
  { file: "polaroid/heart-border.png",    label: "Heart Border",    category: "polaroid", aspect: 350/504, shape: "rect", innerPadding: { top: 10, right: 10, bottom: 10, left: 10 }, cropPadding: { top: 0.062, right: 0.102, bottom: 0.062, left: 0.090 } },
  { file: "polaroid/red-plaid.png",       label: "Red Plaid",       category: "polaroid", aspect: 234/240, shape: "rect", innerPadding: { top: 10, right: 10, bottom: 10, left: 10 }, cropPadding: { top: 0.208, right: 0.268, bottom: 0.312, left: 0.264 } },
  { file: "polaroid/white-horizontal.png",label: "White Horizontal",category: "polaroid", aspect: 391/318, shape: "rect", innerPadding: { top: 10, right: 10, bottom: 10, left: 10 }, cropPadding: { top: 0.180, right: 0.126, bottom: 0.184, left: 0.092 } },
  { file: "polaroid/white.png",           label: "White",           category: "polaroid", aspect: 237/310, shape: "rect", innerPadding: { top: 10, right: 10, bottom: 10, left: 10 }, cropPadding: { top: 0.118, right: 0.256, bottom: 0.262, left: 0.270 } },

  // ── digis ─────────────────────────────────────────────────────────────────
  // QA note: most digis have transparent backgrounds — visual QA required, especially tamagotchis and cameras
  { file: "digis/angel-tama.png",    label: "Angel Tama",    category: "digis", aspect: 326/352, shape: "rect", innerPadding: { top: 10, right: 10, bottom: 10, left: 10 }, cropPadding: { top: 0.144, right: 0.178, bottom: 0.152, left: 0.170 } },
  { file: "digis/apple-tama.png",    label: "Apple Tama",    category: "digis", aspect: 469/372, shape: "rect", innerPadding: { top: 10, right: 10, bottom: 10, left: 10 }, cropPadding: { top: 0.126, right: 0.028, bottom: 0.130, left: 0.034 } },
  { file: "digis/blue-digi.png",     label: "Blue Digi",     category: "digis", aspect: 616/400, shape: "rect", innerPadding: { top: 10, right: 10, bottom: 10, left: 10 }, cropPadding: { top: 0.000, right: 0.003, bottom: 0.007, left: 0.002 } },
  { file: "digis/blue-tama.png",     label: "Blue Tama",     category: "digis", aspect: 429/475, shape: "rect", innerPadding: { top: 10, right: 10, bottom: 10, left: 10 }, cropPadding: { top: 0.018, right: 0.022, bottom: 0.032, left: 0.120 } },
  { file: "digis/canon-star.png",    label: "Canon Star",    category: "digis", aspect: 576/431, shape: "rect", innerPadding: { top: 10, right: 10, bottom: 10, left: 10 }, cropPadding: { top: 0.000, right: 0.002, bottom: 0.002, left: 0.000 } },
  { file: "digis/canon-vertical.png",label: "Canon Vertical",category: "digis", aspect: 337/514, shape: "rect", innerPadding: { top: 10, right: 10, bottom: 10, left: 10 }, cropPadding: { top: 0.050, right: 0.109, bottom: 0.059, left: 0.113 } },
  { file: "digis/canon.png",         label: "Canon",         category: "digis", aspect: 514/337, shape: "rect", innerPadding: { top: 10, right: 10, bottom: 10, left: 10 }, cropPadding: { top: 0.106, right: 0.059, bottom: 0.115, left: 0.050 } },
  { file: "digis/nokia.png",         label: "Nokia",         category: "digis", aspect: 322/762, shape: "rect", innerPadding: { top: 10, right: 10, bottom: 10, left: 10 }, cropPadding: { top: 0.000, right: 0.009, bottom: 0.004, left: 0.003 } },
  { file: "digis/paint.png",         label: "Paint",         category: "digis", aspect: 338/258, shape: "rect", innerPadding: { top: 10, right: 10, bottom: 10, left: 10 }, cropPadding: { top: 0.117, right: 0.049, bottom: 0.237, left: 0.155 } },
  { file: "digis/pink-digi.png",     label: "Pink Digi",     category: "digis", aspect: 616/399, shape: "rect", innerPadding: { top: 10, right: 10, bottom: 10, left: 10 }, cropPadding: { top: 0.005, right: 0.002, bottom: 0.002, left: 0.006 } },
  { file: "digis/pink-tama.png",     label: "Pink Tama",     category: "digis", aspect: 456/472, shape: "rect", innerPadding: { top: 10, right: 10, bottom: 10, left: 10 }, cropPadding: { top: 0.038, right: 0.028, bottom: 0.018, left: 0.060 } },
  { file: "digis/pink2-tama.png",    label: "Pink 2 Tama",   category: "digis", aspect: 461/513, shape: "rect", innerPadding: { top: 10, right: 10, bottom: 10, left: 10 }, cropPadding: { top: 0.010, right: 0.019, bottom: 0.011, left: 0.013 } },
  { file: "digis/plaid-tama.png",    label: "Plaid Tama",    category: "digis", aspect: 397/524, shape: "rect", innerPadding: { top: 10, right: 10, bottom: 10, left: 10 }, cropPadding: { top: 0.000, right: 0.040, bottom: 0.097, left: 0.037 } },
  { file: "digis/retro-tv.png",      label: "Retro TV",      category: "digis", aspect: 485/320, shape: "rect", innerPadding: { top: 10, right: 10, bottom: 10, left: 10 }, cropPadding: { top: 0.180, right: 0.006, bottom: 0.186, left: 0.012 } },
];


export const DEFAULT_FRAME_FILE = "frame1.png";

export function getFrameConfig(frameFile: string | null | undefined): FrameConfig {
  if (!frameFile) return FRAMES[0];
  return FRAMES.find((f) => f.file === frameFile) ?? FRAMES[0];
}
