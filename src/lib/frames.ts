export type FrameShape = "rect" | "circle" | "oval";
// "none" is a pseudo-category for the unframed option — deliberately absent
// from FRAME_CATEGORIES so it never renders as a tab or a frame tile.
export type FrameCategory = "classic" | "polaroid" | "digis" | "none";

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
  { file: "polaroid/film.png",            label: "Film",            category: "polaroid", aspect: 334/468, shape: "rect", innerPadding: { top: 10, right: 10, bottom: 10, left: 10 }, cropPadding: { top: 0.193, right: 0.167, bottom: 0.161, left: 0.159 } }, // manual override
  { file: "polaroid/film1-horizontal.png",label: "Film 1 Horizontal",category: "polaroid",aspect: 488/420, shape: "rect", innerPadding: { top: 10, right: 10, bottom: 10, left: 10 }, cropPadding: { top: 0.140, right: 0.013, bottom: 0.149, left: 0.016 } }, // manual override
  { file: "polaroid/film1.png",           label: "Film 1",          category: "polaroid", aspect: 350/374, shape: "rect", innerPadding: { top: 10, right: 10, bottom: 10, left: 10 }, cropPadding: { top: 0.175, right: 0.177, bottom: 0.207, left: 0.192 } }, // manual override
  { file: "polaroid/heart-border.png",    label: "Heart Border",    category: "polaroid", aspect: 350/504, shape: "rect", innerPadding: { top: 10, right: 10, bottom: 10, left: 10 }, cropPadding: { top: 0.062, right: 0.102, bottom: 0.062, left: 0.090 } },
  { file: "polaroid/red-plaid.png",       label: "Red Plaid",       category: "polaroid", aspect: 234/240, shape: "rect", innerPadding: { top: 10, right: 10, bottom: 10, left: 10 }, cropPadding: { top: 0.208, right: 0.268, bottom: 0.312, left: 0.264 } },
  { file: "polaroid/white-horizontal.png",label: "White Horizontal",category: "polaroid", aspect: 391/318, shape: "rect", innerPadding: { top: 10, right: 10, bottom: 10, left: 10 }, cropPadding: { top: 0.234, right: 0.126, bottom: 0.300, left: 0.130 } },
  { file: "polaroid/white.png",           label: "White",           category: "polaroid", aspect: 237/310, shape: "rect", innerPadding: { top: 10, right: 10, bottom: 10, left: 10 }, cropPadding: { top: 0.174, right: 0.290, bottom: 0.262, left: 0.288 } },

  // ── digis ─────────────────────────────────────────────────────────────────
  // QA note: most digis have transparent backgrounds — visual QA required, especially tamagotchis and cameras
  { file: "digis/angel-tama.png",    label: "Angel Tama",    category: "digis", aspect: 326/352, shape: "rect", innerPadding: { top: 10, right: 10, bottom: 10, left: 10 }, cropPadding: { top: 0.382, right: 0.358, bottom: 0.352, left: 0.350 } }, // inscribed rect (rounded corners)
  { file: "digis/apple-tama.png",    label: "Apple Tama",    category: "digis", aspect: 469/372, shape: "rect", innerPadding: { top: 10, right: 10, bottom: 10, left: 10 }, cropPadding: { top: 0.318, right: 0.448, bottom: 0.289, left: 0.146 } }, // manual override
  { file: "digis/blue-digi.png",     label: "Blue Digi",     category: "digis", aspect: 616/400, shape: "rect", innerPadding: { top: 10, right: 10, bottom: 10, left: 10 }, cropPadding: { top: 0.186, right: 0.327, bottom: 0.108, left: 0.076 } }, // manual override
  { file: "digis/blue-tama.png",     label: "Blue Tama",     category: "digis", aspect: 429/475, shape: "rect", innerPadding: { top: 10, right: 10, bottom: 10, left: 10 }, cropPadding: { top: 0.311, right: 0.289, bottom: 0.204, left: 0.238 } }, // manual override
  { file: "digis/canon-star.png",    label: "Canon Star",    category: "digis", aspect: 576/431, shape: "rect", innerPadding: { top: 10, right: 10, bottom: 10, left: 10 }, cropPadding: { top: 0.340, right: 0.463, bottom: 0.255, left: 0.116 } },
  { file: "digis/canon-vertical.png",label: "Canon Vertical",category: "digis", aspect: 337/514, shape: "rect", innerPadding: { top: 10, right: 10, bottom: 10, left: 10 }, cropPadding: { top: 0.102, right: 0.353, bottom: 0.464, left: 0.210 } },
  { file: "digis/canon.png",         label: "Canon",         category: "digis", aspect: 514/337, shape: "rect", innerPadding: { top: 10, right: 10, bottom: 10, left: 10 }, cropPadding: { top: 0.351, right: 0.464, bottom: 0.212, left: 0.102 } },
  { file: "digis/nokia.png",         label: "Nokia",         category: "digis", aspect: 322/762, shape: "rect", innerPadding: { top: 10, right: 10, bottom: 10, left: 10 }, cropPadding: { top: 0.271, right: 0.166, bottom: 0.524, left: 0.141 } },
  { file: "digis/paint.png",         label: "Paint",         category: "digis", aspect: 338/258, shape: "rect", innerPadding: { top: 10, right: 10, bottom: 10, left: 10 }, cropPadding: { top: 0.117, right: 0.049, bottom: 0.237, left: 0.155 } },
  { file: "digis/pink-digi.png",     label: "Pink Digi",     category: "digis", aspect: 616/399, shape: "rect", innerPadding: { top: 10, right: 10, bottom: 10, left: 10 }, cropPadding: { top: 0.229, right: 0.343, bottom: 0.114, left: 0.090 } },
  { file: "digis/pink-tama.png",     label: "Pink Tama",     category: "digis", aspect: 456/472, shape: "rect", innerPadding: { top: 10, right: 10, bottom: 10, left: 10 }, cropPadding: { top: 0.318, right: 0.436, bottom: 0.376, left: 0.268 } }, // inscribed rect; window is rotated, so this is conservative by ~60% of window area
  { file: "digis/pink2-tama.png",    label: "Pink 2 Tama",   category: "digis", aspect: 461/513, shape: "rect", innerPadding: { top: 10, right: 10, bottom: 10, left: 10 }, cropPadding: { top: 0.355, right: 0.359, bottom: 0.242, left: 0.197 } }, // inscribed rect (rounded corners)
  { file: "digis/plaid-tama.png",    label: "Plaid Tama",    category: "digis", aspect: 397/524, shape: "rect", innerPadding: { top: 10, right: 10, bottom: 10, left: 10 }, cropPadding: { top: 0.304, right: 0.242, bottom: 0.279, left: 0.230 } }, // manual override
  { file: "digis/retro-tv.png",      label: "Retro TV",      category: "digis", aspect: 485/320, shape: "rect", innerPadding: { top: 10, right: 10, bottom: 10, left: 10 }, cropPadding: { top: 0.242, right: 0.269, bottom: 0.291, left: 0.085 } },

  // ── none ──────────────────────────────────────────────────────────────────
  // The unframed option. There is no /frames/none.png — FramedArtwork skips the
  // frame overlay for this entry and sizes the box from the artwork itself, so
  // `aspect` here is an unused placeholder. The sentinel is the string "none"
  // rather than "" because falsy frame_file values are treated as "use the
  // default frame" by getFrameConfig and by the `|| DEFAULT_FRAME_FILE`
  // fallbacks on the walls, which would silently re-frame unframed pieces.
  { file: "none", label: "No Frame", category: "none", aspect: 1, selectionScale: 1.0, shape: "rect", innerPadding: { top: 0, right: 0, bottom: 0, left: 0 }, cropPadding: { top: 0, right: 0, bottom: 0, left: 0 } },
];


export const DEFAULT_FRAME_FILE = "frame1.png";

export const NO_FRAME = FRAMES.find((f) => f.file === "none")!;

export function getFrameConfig(frameFile: string | null | undefined): FrameConfig {
  if (!frameFile) return FRAMES[0];
  return FRAMES.find((f) => f.file === frameFile) ?? FRAMES[0];
}
