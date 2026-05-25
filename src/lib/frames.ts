export type FrameShape = "rect" | "circle" | "oval";

export interface FrameInnerPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface FrameConfig {
  file: string;
  label: string;
  aspect: number;
  shape: FrameShape;
  innerPadding: FrameInnerPadding;
}

export const FRAMES: FrameConfig[] = [
  { file: "frame1.png", label: "Ornate Gold",   aspect: 3/4, shape: "rect",   innerPadding: { top: 10, right: 10, bottom: 9, left: 10 } },
  { file: "frame2.png", label: "Circle Gold",   aspect: 1/1, shape: "circle", innerPadding: { top: 16, right: 16, bottom: 16, left: 16 } },
  { file: "frame3.png", label: "Thin Ornate",   aspect: 3/4, shape: "rect",   innerPadding: { top: 12, right: 10, bottom: 12, left: 10 } },
  { file: "frame4.png", label: "Simple Gold",   aspect: 3/4, shape: "rect",   innerPadding: { top: 10, right: 10, bottom: 10, left: 10 } },
  { file: "frame5.png", label: "Heart",         aspect: 1/1, shape: "circle", innerPadding: { top: 12, right: 12, bottom: 10, left: 12 } },
  { file: "frame6.png", label: "Oval Gold",     aspect: 2/3, shape: "oval",   innerPadding: { top: 15, right: 18, bottom: 15, left: 18 } },
  { file: "frame7.png", label: "Silver Square", aspect: 1/1, shape: "rect",   innerPadding: { top: 13, right: 13, bottom: 13, left: 13 } },
  { file: "frame8.png", label: "Gold Rectangular", aspect: 4/3, shape: "rect",   innerPadding: { top: 13, right: 8, bottom: 8, left: 8 } },
];

export const DEFAULT_FRAME_FILE = "frame1.png";

export function getFrameConfig(frameFile: string | null | undefined): FrameConfig {
  if (!frameFile) return FRAMES[0];
  return FRAMES.find((f) => f.file === frameFile) ?? FRAMES[0];
}
