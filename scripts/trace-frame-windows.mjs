// Phase 1b: auto-trace the art window of every frame PNG and emit seed
// `window` / `bbox` / `aspect` values for public.frames.
//
//   node scripts/trace-frame-windows.mjs
//
// Pipeline per frame (see Phase 0 recon: all windows are fully transparent,
// most exteriors are transparent too, so we must flood from INSIDE):
//   1. decode PNG alpha (8-bit RGBA, non-interlaced — all 30 assets)
//   2. seed at the centre of the frames.ts cropPadding box
//   3. 4-connected flood fill over alpha < ALPHA_T  -> window mask
//   4. marching squares on the mask -> closed boundary loop(s)
//   5. Douglas–Peucker to DP_MIN..DP_MAX points
//   6. snap to rect (optionally rounded) or ellipse when IoU >= tolerance
//   7. normalise to 0..1 against the PNG's intrinsic size
//
// Outputs:
//   scripts/output/frame-windows.json                 full per-frame report
//   supabase/migrations/005_frame_windows_seed.sql    UPDATE statements
//
// Tuning knobs are the constants directly below.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { inflateSync } from "node:zlib";

const ROOT = resolve(import.meta.dirname, "..");
const FRAMES_TS = resolve(ROOT, "src/lib/frames.ts");
const FRAMES_DIR = resolve(ROOT, "public/frames");
const OUT_JSON = resolve(ROOT, "scripts/output/frame-windows.json");
const OUT_SQL = resolve(ROOT, "supabase/migrations/005_frame_windows_seed.sql");

// ── tuning ──────────────────────────────────────────────────────────────────
const ALPHA_T = 128;        // alpha below this = "window" (splits AA edge in half)
const DP_MIN = 20;          // Douglas–Peucker target point range
const DP_MAX = 40;
const RECT_IOU = 0.985;     // snap to rect / rounded rect at or above this
const ELLIPSE_IOU = 0.975;  // snap to ellipse at or above this
const REVIEW_RECT_IOU = 0.92; // polygon emitted but flag "nearly rectangular" at or above this
const PAD_WARN = 0.05;      // flag if traced bbox differs from cropPadding by > this (per side)
const MIN_AREA_FRAC = 0.02; // flag if window < 2% of image (bad seed)
const ROUND = 4;            // decimals in emitted normalised coords

// ── 1. frames.ts ────────────────────────────────────────────────────────────
function parseFrames() {
  const src = readFileSync(FRAMES_TS, "utf8");
  const re = /\{\s*file:\s*"([^"]+)",\s*label:\s*"([^"]+)",\s*category:\s*"([^"]+)",[^}]*?shape:\s*"([^"]+)",[\s\S]*?cropPadding:\s*\{\s*top:\s*([\d.]+),\s*right:\s*([\d.]+),\s*bottom:\s*([\d.]+),\s*left:\s*([\d.]+)\s*\}/g;
  const out = [];
  for (const m of src.matchAll(re)) {
    const [, file, label, category, shape, t, r, b, l] = m;
    if (file === "none") continue;
    out.push({ file, label, category, shape, crop: { top: +t, right: +r, bottom: +b, left: +l } });
  }
  if (out.length !== 30) throw new Error(`expected 30 frames in frames.ts, parsed ${out.length}`);
  return out;
}

// ── 2. PNG alpha decoder (8-bit RGBA, filter methods 0-4, no interlace) ─────
function decodePngAlpha(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("not a PNG");
  let pos = 8, width, height, idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("latin1", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      const depth = data[8], ctype = data[9], interlace = data[12];
      if (depth !== 8 || ctype !== 6 || interlace !== 0)
        throw new Error(`unsupported PNG: depth=${depth} colortype=${ctype} interlace=${interlace}`);
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    pos += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const bpp = 4, stride = width * bpp;
  const alpha = new Uint8Array(width * height);
  let prev = new Uint8Array(stride), cur = new Uint8Array(stride), p = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[p++];
    for (let x = 0; x < stride; x++) {
      const rawB = raw[p++];
      const a = x >= bpp ? cur[x - bpp] : 0;        // left
      const b = prev[x];                              // up
      const c = x >= bpp ? prev[x - bpp] : 0;        // up-left
      let v;
      switch (filter) {
        case 0: v = rawB; break;
        case 1: v = rawB + a; break;
        case 2: v = rawB + b; break;
        case 3: v = rawB + ((a + b) >> 1); break;
        case 4: { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
                  v = rawB + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c); break; }
        default: throw new Error(`bad filter ${filter} at row ${y}`);
      }
      cur[x] = v & 0xff;
    }
    for (let x = 0; x < width; x++) alpha[y * width + x] = cur[x * 4 + 3];
    [prev, cur] = [cur, prev];
  }
  return { width, height, alpha };
}

// ── 3. flood fill ───────────────────────────────────────────────────────────
function flood(alpha, W, H, sx, sy) {
  const mask = new Uint8Array(W * H);
  const stack = [sy * W + sx];
  let area = 0, touchesBorder = false;
  let minX = W, minY = H, maxX = -1, maxY = -1;
  if (alpha[sy * W + sx] >= ALPHA_T) return { mask, area: 0, touchesBorder, bbox: null, seedOpaque: true };
  mask[sy * W + sx] = 1;
  while (stack.length) {
    const i = stack.pop();
    const x = i % W, y = (i - x) / W;
    area++;
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (x === 0 || y === 0 || x === W - 1 || y === H - 1) touchesBorder = true;
    const nb = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
    for (const [nx, ny] of nb) {
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx;
      if (mask[j] || alpha[j] >= ALPHA_T) continue;
      mask[j] = 1; stack.push(j);
    }
  }
  // bbox in pixel space: [minX, maxX+1) x [minY, maxY+1)
  return { mask, area, touchesBorder, seedOpaque: false,
           bbox: { x: minX, y: minY, w: maxX + 1 - minX, h: maxY + 1 - minY } };
}

// ── 4. marching squares -> loops ────────────────────────────────────────────
// Mask is padded by one zero pixel on every side so every loop is closed.
// Sample (sx, sy) in padded coords ↔ pixel centre at (sx - 0.5, sy - 0.5).
const SEG = {
  1: [["L", "B"]], 2: [["B", "R"]], 3: [["L", "R"]], 4: [["T", "R"]],
  5: [["T", "R"], ["L", "B"]], 6: [["T", "B"]], 7: [["T", "L"]], 8: [["T", "L"]],
  9: [["T", "B"]], 10: [["T", "L"], ["B", "R"]], 11: [["T", "R"]], 12: [["L", "R"]],
  13: [["B", "R"]], 14: [["L", "B"]],
};
function marchingSquares(mask, W, H) {
  const PW = W + 2, PH = H + 2;
  const at = (x, y) => (x <= 0 || y <= 0 || x >= PW - 1 || y >= PH - 1) ? 0 : mask[(y - 1) * W + (x - 1)];
  // node id for an edge midpoint: horizontal edge "h:x:y" (top edge of cell x,y), vertical "v:x:y" (left edge)
  const nodeOf = (x, y, e) => e === "T" ? `h:${x}:${y}` : e === "B" ? `h:${x}:${y + 1}` : e === "L" ? `v:${x}:${y}` : `v:${x + 1}:${y}`;
  const coordOf = (id) => { const [k, xs, ys] = id.split(":"); const x = +xs, y = +ys;
    return k === "h" ? [x + 0.5 - 0.5, y - 0.5] : [x - 0.5, y + 0.5 - 0.5]; }; // -> pixel coords
  const adj = new Map();
  const link = (a, b) => { (adj.get(a) ?? adj.set(a, []).get(a)).push(b); (adj.get(b) ?? adj.set(b, []).get(b)).push(a); };
  for (let y = 0; y < PH - 1; y++) for (let x = 0; x < PW - 1; x++) {
    const idx = at(x, y) * 8 + at(x + 1, y) * 4 + at(x + 1, y + 1) * 2 + at(x, y + 1);
    if (idx === 0 || idx === 15) continue;
    for (const [e1, e2] of SEG[idx]) link(nodeOf(x, y, e1), nodeOf(x, y, e2));
  }
  const seen = new Set(), loops = [];
  for (const start of adj.keys()) {
    if (seen.has(start)) continue;
    const loop = []; let prev = null, cur = start;
    while (cur && !seen.has(cur)) {
      seen.add(cur); loop.push(coordOf(cur));
      const [n1, n2] = adj.get(cur);
      const next = n1 !== prev ? n1 : n2;
      prev = cur; cur = next;
    }
    loops.push(loop);
  }
  return loops;
}

// ── 5. Douglas–Peucker ──────────────────────────────────────────────────────
function perpDist(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const L2 = dx * dx + dy * dy;
  if (L2 === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}
function dp(points, eps) {
  const keep = new Uint8Array(points.length); keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop();
    let maxD = 0, idx = -1;
    for (let i = s + 1; i < e; i++) { const d = perpDist(points[i], points[s], points[e]); if (d > maxD) { maxD = d; idx = i; } }
    if (maxD > eps) { keep[idx] = 1; stack.push([s, idx], [idx, e]); }
  }
  return points.filter((_, i) => keep[i]);
}
function simplifyLoop(loop) {
  // rotate loop so it starts at the point farthest from the centroid (a real corner), then close it
  let cx = 0, cy = 0; for (const [x, y] of loop) { cx += x; cy += y; } cx /= loop.length; cy /= loop.length;
  let far = 0, fd = -1; loop.forEach(([x, y], i) => { const d = (x - cx) ** 2 + (y - cy) ** 2; if (d > fd) { fd = d; far = i; } });
  const rot = loop.slice(far).concat(loop.slice(0, far)); rot.push(rot[0]);
  // grow epsilon until <= DP_MAX, then back off while > DP_MIN allows
  let lo = 0.25, hi = 64, best = null;
  for (let it = 0; it < 40; it++) {
    const eps = Math.sqrt(lo * hi);
    const pts = dp(rot, eps); pts.pop();
    if (pts.length > DP_MAX) lo = eps; else { best = { pts, eps }; if (pts.length < DP_MIN) hi = eps; else break; }
    if (hi / lo < 1.02) break;
  }
  if (!best) { const pts = dp(rot, 64); pts.pop(); best = { pts, eps: 64 }; }
  return best;
}

// ── 6. snapping ─────────────────────────────────────────────────────────────
function iou(mask, W, bbox, inside) {
  let inter = 0, shape = 0, maskN = 0;
  const x0 = Math.max(0, bbox.x - 2), y0 = Math.max(0, bbox.y - 2);
  const x1 = Math.min(W, bbox.x + bbox.w + 2), y1 = Math.min(mask.length / W, bbox.y + bbox.h + 2);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const m = mask[y * W + x], s = inside(x + 0.5, y + 0.5) ? 1 : 0;
    if (m && s) inter++; if (s) shape++; if (m) maskN++;
  }
  return inter / (shape + maskN - inter);
}
function snap(mask, W, bbox, area) {
  const { x, y, w, h } = bbox;
  const cx = x + w / 2, cy = y + h / 2;
  const rectIoU = iou(mask, W, bbox, (px, py) => px >= x && px < x + w && py >= y && py < y + h);
  // rounded-rect radius from corner deficit: bboxArea - area = (4 - π) r²
  const r = Math.min(w, h) / 2 * Math.min(1, Math.sqrt(Math.max(0, w * h - area) / (4 - Math.PI)) / (Math.min(w, h) / 2));
  const rrIoU = r > 1 ? iou(mask, W, bbox, (px, py) => {
    const dx = Math.max(0, Math.abs(px - cx) - (w / 2 - r)), dy = Math.max(0, Math.abs(py - cy) - (h / 2 - r));
    return px >= x && px < x + w && py >= y && py < y + h && dx * dx + dy * dy <= r * r;
  }) : 0;
  const rx = w / 2, ry = h / 2;
  const ellIoU = iou(mask, W, bbox, (px, py) => ((px - cx) / rx) ** 2 + ((py - cy) / ry) ** 2 <= 1);
  return { rectIoU, rrIoU, r, ellIoU };
}

// ── 7. run ──────────────────────────────────────────────────────────────────
const rnd = (v) => +v.toFixed(ROUND);
const report = [];
for (const f of parseFrames()) {
  const { width: W, height: H, alpha } = decodePngAlpha(readFileSync(resolve(FRAMES_DIR, f.file)));
  const { crop } = f;
  const seed = [Math.round(W * (crop.left + (1 - crop.left - crop.right) / 2)),
                Math.round(H * (crop.top + (1 - crop.top - crop.bottom) / 2))];
  const flags = [];
  if (f.shape === "circle") flags.push("MANUAL_REVIEW: zero cropPadding, seed = image centre");

  const fl = flood(alpha, W, H, seed[0], seed[1]);
  const entry = { frame_file: f.file, label: f.label, category: f.category, width: W, height: H, seed, flags };
  if (fl.seedOpaque) { flags.push("ERROR: seed pixel is opaque, nothing traced"); report.push(entry); continue; }
  if (fl.touchesBorder) flags.push("ERROR: flood leaked to image border, window not enclosed");
  if (fl.area / (W * H) < MIN_AREA_FRAC) flags.push(`WARN: window only ${(fl.area / (W * H) * 100).toFixed(1)}% of image`);

  const loops = marchingSquares(fl.mask, W, H).sort((a, b) => b.length - a.length);
  const { pts, eps } = simplifyLoop(loops[0]);
  const { rectIoU, rrIoU, r, ellIoU } = snap(fl.mask, W, fl.bbox, fl.area);
  const bb = fl.bbox;

  // Order matters: a circle is also a rounded rect with r = min(w,h)/2, so
  // test the ellipse before the rounded rect. radius is normalised to width.
  let window;
  if (rectIoU >= RECT_IOU) window = { kind: "rect", x: rnd(bb.x / W), y: rnd(bb.y / H), w: rnd(bb.w / W), h: rnd(bb.h / H), radius: 0 };
  else if (ellIoU >= ELLIPSE_IOU) window = { kind: "ellipse", cx: rnd((bb.x + bb.w / 2) / W), cy: rnd((bb.y + bb.h / 2) / H), rx: rnd(bb.w / 2 / W), ry: rnd(bb.h / 2 / H) };
  else if (rrIoU >= RECT_IOU) window = { kind: "rect", x: rnd(bb.x / W), y: rnd(bb.y / H), w: rnd(bb.w / W), h: rnd(bb.h / H), radius: rnd(r / W) };
  else {
    window = { kind: "polygon", points: pts.map(([px, py]) => [rnd(px / W), rnd(py / H)]) };
    const nearRect = Math.max(rectIoU, rrIoU);
    if (nearRect >= REVIEW_RECT_IOU) flags.push(`REVIEW: nearly rectangular (best rect IoU ${nearRect.toFixed(3)}) — polygon emitted, consider forcing rect`);
  }

  // compare with the cropPadding box the app uses today
  const padDiff = { top: bb.y / H - crop.top, left: bb.x / W - crop.left,
                    right: (1 - (bb.x + bb.w) / W) - crop.right, bottom: (1 - (bb.y + bb.h) / H) - crop.bottom };
  const worst = Math.max(...Object.values(padDiff).map(Math.abs));
  const cropIsZero = Object.values(crop).every((v) => v === 0);
  if (!cropIsZero && worst > PAD_WARN) flags.push(`WARN: traced bbox differs from cropPadding by up to ${(worst * 100).toFixed(1)}% (${Object.entries(padDiff).map(([k, v]) => `${k} ${(v * 100).toFixed(1)}`).join(", ")})`);
  if (loops.length > 1) flags.push(`INFO: ${loops.length - 1} inner hole(s) ignored`);

  Object.assign(entry, {
    window,
    bbox: { x: rnd(bb.x / W), y: rnd(bb.y / H), w: rnd(bb.w / W), h: rnd(bb.h / H) },
    aspect: +(W / H).toFixed(6),
    stats: { area_px: fl.area, area_frac: +(fl.area / (W * H)).toFixed(4), bbox_px: bb,
             rect_iou: +rectIoU.toFixed(4), rounded_rect_iou: +rrIoU.toFixed(4), radius_px: +r.toFixed(1),
             ellipse_iou: +ellIoU.toFixed(4), boundary_pts: loops[0].length, dp_pts: pts.length, dp_eps_px: +eps.toFixed(2) },
    polygon: pts.map(([px, py]) => [rnd(px / W), rnd(py / H)]),   // always kept for the preview / manual fallback
    crop_padding: crop,
  });
  report.push(entry);
}

mkdirSync(resolve(ROOT, "scripts/output"), { recursive: true });
writeFileSync(OUT_JSON, JSON.stringify(report, null, 2));

// ── SQL ─────────────────────────────────────────────────────────────────────
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const ok = report.filter((e) => e.window && !e.flags.some((f) => f.startsWith("ERROR")));
const bad = report.filter((e) => !ok.includes(e));
const review = report.filter((e) => e.flags.length);
const sql = `-- 005_frame_windows_seed.sql
-- GENERATED by scripts/trace-frame-windows.mjs on ${new Date().toISOString().slice(0, 10)} — Phase 1b seed windows.
-- Re-run the script after tuning; hand-edit only after visual review.
--
-- Rows written: ${ok.length}/30${bad.length ? `   NOT written (errors): ${bad.map((e) => e.frame_file).join(", ")}` : ""}
-- Flagged for review:
${review.map((e) => `--   ${e.frame_file}\n${e.flags.map((f) => `--       ${f}`).join("\n")}`).join("\n") || "--   (none)"}

begin;

${ok.map((e) => `update public.frames
   set window_shape = ${q(JSON.stringify(e.window))}::jsonb,
       bbox   = ${q(JSON.stringify(e.bbox))}::jsonb,
       aspect = ${e.aspect}
 where frame_file = ${q(e.frame_file)};`).join("\n\n")}

-- every real frame must now have a window
do $$
declare v_missing text[];
begin
  select coalesce(array_agg(frame_file), '{}') into v_missing
    from public.frames where kind = 'frame' and window_shape is null;
  if array_length(v_missing, 1) > 0 then
    raise exception 'frames without window: %', v_missing;
  end if;
  raise notice 'frame windows OK: all kind=frame rows have a window';
end $$;

commit;
`;
writeFileSync(OUT_SQL, sql);

// ── console summary ─────────────────────────────────────────────────────────
for (const e of report) {
  const k = e.window ? e.window.kind + (e.window.kind === "rect" && e.window.radius ? `(r=${e.window.radius})` : "") : "—";
  const s = e.stats ?? {};
  console.log(`${e.frame_file.padEnd(30)} ${k.padEnd(14)} rect=${s.rect_iou ?? "-"} rr=${s.rounded_rect_iou ?? "-"} ell=${s.ellipse_iou ?? "-"} pts=${s.dp_pts ?? "-"} area=${s.area_frac ?? "-"}${e.flags.length ? "  ⚑ " + e.flags.join(" | ") : ""}`);
}
console.log(`\nwrote ${OUT_JSON}\nwrote ${OUT_SQL}`);
