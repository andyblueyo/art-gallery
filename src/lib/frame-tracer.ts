// Browser-side port of scripts/trace-frame-windows.mjs: given a frame PNG's
// alpha channel, find the enclosed transparent window and propose a
// `window` value. Used by the admin portal on upload and for "re-trace".
//
// Differences from the one-off script: there is no cropPadding to seed
// from, so the window is the LARGEST transparent region that does not touch
// the image border (the exterior of most frames is transparent too, and the
// Nokia's screen is nowhere near the image centre).

import { windowToBBox, type FrameBBox, type FrameWindow } from "./frames";

export interface TraceOptions {
  alphaThreshold?: number; // alpha below this = window (default 128)
  minPoints?: number;      // Douglas–Peucker target range (default 20..40)
  maxPoints?: number;
  rectIoU?: number;        // snap thresholds (defaults 0.985 / 0.975)
  ellipseIoU?: number;
  seed?: [number, number]; // optional pixel to flood from instead of auto-pick
}

export interface TraceResult {
  window: FrameWindow;
  bbox: FrameBBox;
  polygon: [number, number][]; // simplified boundary, always kept
  stats: {
    areaFrac: number;
    rectIoU: number;
    roundedRectIoU: number;
    ellipseIoU: number;
    points: number;
  };
  flags: string[];
}

const DEFAULTS = { alphaThreshold: 128, minPoints: 20, maxPoints: 40, rectIoU: 0.985, ellipseIoU: 0.975 };

export function alphaFromImageData(img: ImageData): Uint8Array {
  const out = new Uint8Array(img.width * img.height);
  for (let i = 0, j = 3; i < out.length; i++, j += 4) out[i] = img.data[j];
  return out;
}

// Draw a loaded <img> to a canvas and pull its alpha. Throws if the canvas is
// tainted (image served without CORS headers).
export function alphaFromImage(img: HTMLImageElement): { alpha: Uint8Array; width: number; height: number } {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context");
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { alpha: alphaFromImageData(data), width: canvas.width, height: canvas.height };
}

// ── components ──────────────────────────────────────────────────────────────
interface Region { mask: Uint8Array; area: number; touchesBorder: boolean; bbox: { x: number; y: number; w: number; h: number } }

function flood(alpha: Uint8Array, W: number, H: number, start: number, thr: number, visited: Uint8Array): Region {
  const mask = new Uint8Array(W * H);
  const stack = [start];
  visited[start] = 1; mask[start] = 1;
  let area = 0, touchesBorder = false, minX = W, minY = H, maxX = -1, maxY = -1;
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % W, y = (i - x) / W;
    area++;
    if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (x === 0 || y === 0 || x === W - 1 || y === H - 1) touchesBorder = true;
    if (x > 0) { const j = i - 1; if (!visited[j] && alpha[j] < thr) { visited[j] = 1; mask[j] = 1; stack.push(j); } }
    if (x < W - 1) { const j = i + 1; if (!visited[j] && alpha[j] < thr) { visited[j] = 1; mask[j] = 1; stack.push(j); } }
    if (y > 0) { const j = i - W; if (!visited[j] && alpha[j] < thr) { visited[j] = 1; mask[j] = 1; stack.push(j); } }
    if (y < H - 1) { const j = i + W; if (!visited[j] && alpha[j] < thr) { visited[j] = 1; mask[j] = 1; stack.push(j); } }
  }
  return { mask, area, touchesBorder, bbox: { x: minX, y: minY, w: maxX + 1 - minX, h: maxY + 1 - minY } };
}

function pickWindowRegion(alpha: Uint8Array, W: number, H: number, thr: number, seed?: [number, number]): Region | null {
  const visited = new Uint8Array(W * H);
  if (seed) {
    const i = seed[1] * W + seed[0];
    if (alpha[i] < thr) { const r = flood(alpha, W, H, i, thr, visited); if (!r.touchesBorder) return r; }
    // fall through to auto-pick if the seed was bad
    visited.fill(0);
  }
  let best: Region | null = null;
  // Stride the scan; every region of meaningful size will be hit.
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) {
    const i = y * W + x;
    if (visited[i] || alpha[i] >= thr) continue;
    const r = flood(alpha, W, H, i, thr, visited);
    if (r.touchesBorder) continue;
    if (!best || r.area > best.area) best = r;
  }
  return best;
}

// ── marching squares ────────────────────────────────────────────────────────
type Edge = "T" | "R" | "B" | "L";
const SEG: Record<number, [Edge, Edge][]> = {
  1: [["L", "B"]], 2: [["B", "R"]], 3: [["L", "R"]], 4: [["T", "R"]],
  5: [["T", "R"], ["L", "B"]], 6: [["T", "B"]], 7: [["T", "L"]], 8: [["T", "L"]],
  9: [["T", "B"]], 10: [["T", "L"], ["B", "R"]], 11: [["T", "R"]], 12: [["L", "R"]],
  13: [["B", "R"]], 14: [["L", "B"]],
};

function marchingSquares(mask: Uint8Array, W: number, H: number): [number, number][][] {
  const PW = W + 2, PH = H + 2;
  const at = (x: number, y: number) => (x <= 0 || y <= 0 || x >= PW - 1 || y >= PH - 1) ? 0 : mask[(y - 1) * W + (x - 1)];
  const nodeOf = (x: number, y: number, e: Edge) =>
    e === "T" ? `h:${x}:${y}` : e === "B" ? `h:${x}:${y + 1}` : e === "L" ? `v:${x}:${y}` : `v:${x + 1}:${y}`;
  const coordOf = (id: string): [number, number] => {
    const [k, xs, ys] = id.split(":"); const x = +xs, y = +ys;
    return k === "h" ? [x, y - 0.5] : [x - 0.5, y];
  };
  const adj = new Map<string, string[]>();
  const link = (a: string, b: string) => {
    (adj.get(a) ?? adj.set(a, []).get(a)!).push(b);
    (adj.get(b) ?? adj.set(b, []).get(b)!).push(a);
  };
  for (let y = 0; y < PH - 1; y++) for (let x = 0; x < PW - 1; x++) {
    const idx = at(x, y) * 8 + at(x + 1, y) * 4 + at(x + 1, y + 1) * 2 + at(x, y + 1);
    if (idx === 0 || idx === 15) continue;
    for (const [e1, e2] of SEG[idx]) link(nodeOf(x, y, e1), nodeOf(x, y, e2));
  }
  const seen = new Set<string>(), loops: [number, number][][] = [];
  for (const start of Array.from(adj.keys())) {
    if (seen.has(start)) continue;
    const loop: [number, number][] = []; let prev: string | null = null, cur: string | undefined = start;
    while (cur && !seen.has(cur)) {
      seen.add(cur); loop.push(coordOf(cur));
      const [n1, n2] = adj.get(cur)!;
      const next: string = n1 !== prev ? n1 : n2;
      prev = cur; cur = next;
    }
    loops.push(loop);
  }
  return loops.sort((a, b) => b.length - a.length);
}

// ── Douglas–Peucker ─────────────────────────────────────────────────────────
function perpDist(p: [number, number], a: [number, number], b: [number, number]) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
  if (L2 === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}
function dp(points: [number, number][], eps: number) {
  const keep = new Uint8Array(points.length); keep[0] = keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop()!;
    let maxD = 0, idx = -1;
    for (let i = s + 1; i < e; i++) { const d = perpDist(points[i], points[s], points[e]); if (d > maxD) { maxD = d; idx = i; } }
    if (maxD > eps) { keep[idx] = 1; stack.push([s, idx], [idx, e]); }
  }
  return points.filter((_, i) => keep[i]);
}
function simplifyLoop(loop: [number, number][], minPts: number, maxPts: number): [number, number][] {
  let cx = 0, cy = 0; for (const [x, y] of loop) { cx += x; cy += y; } cx /= loop.length; cy /= loop.length;
  let far = 0, fd = -1; loop.forEach(([x, y], i) => { const d = (x - cx) ** 2 + (y - cy) ** 2; if (d > fd) { fd = d; far = i; } });
  const rot = loop.slice(far).concat(loop.slice(0, far)); rot.push(rot[0]);
  let lo = 0.25, hi = 64, best: [number, number][] | null = null;
  for (let it = 0; it < 40; it++) {
    const eps = Math.sqrt(lo * hi);
    const pts = dp(rot, eps); pts.pop();
    if (pts.length > maxPts) lo = eps; else { best = pts; if (pts.length < minPts) hi = eps; else break; }
    if (hi / lo < 1.02) break;
  }
  if (!best) { best = dp(rot, 64); best.pop(); }
  return best;
}

// ── snapping ────────────────────────────────────────────────────────────────
function iou(mask: Uint8Array, W: number, H: number, bb: Region["bbox"], inside: (px: number, py: number) => boolean) {
  let inter = 0, shape = 0, maskN = 0;
  const x0 = Math.max(0, bb.x - 2), y0 = Math.max(0, bb.y - 2), x1 = Math.min(W, bb.x + bb.w + 2), y1 = Math.min(H, bb.y + bb.h + 2);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const m = mask[y * W + x], s = inside(x + 0.5, y + 0.5) ? 1 : 0;
    if (m && s) inter++; if (s) shape++; if (m) maskN++;
  }
  return inter / (shape + maskN - inter);
}

export function traceWindowFromAlpha(alpha: Uint8Array, W: number, H: number, opts: TraceOptions = {}): TraceResult | null {
  const o = { ...DEFAULTS, ...opts };
  const region = pickWindowRegion(alpha, W, H, o.alphaThreshold, opts.seed);
  if (!region) return null;
  const { mask, area, bbox: bb } = region;
  const flags: string[] = [];
  if (area / (W * H) < 0.02) flags.push(`window is only ${(area / (W * H) * 100).toFixed(1)}% of the image`);

  const loops = marchingSquares(mask, W, H);
  const pts = simplifyLoop(loops[0], o.minPoints, o.maxPoints);
  const rnd = (v: number) => +v.toFixed(4);
  const polygon = pts.map(([px, py]) => [rnd(px / W), rnd(py / H)] as [number, number]);

  const cx = bb.x + bb.w / 2, cy = bb.y + bb.h / 2;
  const rectIoU = iou(mask, W, H, bb, (px, py) => px >= bb.x && px < bb.x + bb.w && py >= bb.y && py < bb.y + bb.h);
  const half = Math.min(bb.w, bb.h) / 2;
  const r = Math.min(half, Math.sqrt(Math.max(0, bb.w * bb.h - area) / (4 - Math.PI)));
  const rrIoU = r > 1 ? iou(mask, W, H, bb, (px, py) => {
    const dx = Math.max(0, Math.abs(px - cx) - (bb.w / 2 - r)), dy = Math.max(0, Math.abs(py - cy) - (bb.h / 2 - r));
    return px >= bb.x && px < bb.x + bb.w && py >= bb.y && py < bb.y + bb.h && dx * dx + dy * dy <= r * r;
  }) : 0;
  const ellIoU = iou(mask, W, H, bb, (px, py) => ((px - cx) / (bb.w / 2)) ** 2 + ((py - cy) / (bb.h / 2)) ** 2 <= 1);

  const nb = { x: rnd(bb.x / W), y: rnd(bb.y / H), w: rnd(bb.w / W), h: rnd(bb.h / H) };
  let window: FrameWindow;
  if (rectIoU >= o.rectIoU) window = { kind: "rect", ...nb, radius: 0 };
  else if (ellIoU >= o.ellipseIoU) window = { kind: "ellipse", cx: rnd(cx / W), cy: rnd(cy / H), rx: rnd(bb.w / 2 / W), ry: rnd(bb.h / 2 / H) };
  else if (rrIoU >= o.rectIoU) window = { kind: "rect", ...nb, radius: rnd(r / W) };
  else {
    window = { kind: "polygon", points: polygon };
    if (Math.max(rectIoU, rrIoU) >= 0.92) flags.push("nearly rectangular — consider snapping to rect");
  }
  if (loops.length > 1) flags.push(`${loops.length - 1} inner hole(s) ignored`);

  return {
    window, bbox: windowToBBox(window), polygon,
    stats: { areaFrac: +(area / (W * H)).toFixed(4), rectIoU: +rectIoU.toFixed(4), roundedRectIoU: +rrIoU.toFixed(4), ellipseIoU: +ellIoU.toFixed(4), points: polygon.length },
    flags,
  };
}
