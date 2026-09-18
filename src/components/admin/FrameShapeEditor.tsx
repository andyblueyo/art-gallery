"use client";

// The centrepiece of /admin/frames: the frame PNG as a canvas with the art
// window drawn on top. Rect / ellipse / polygon modes, draggable vertices,
// snap-to-shape, re-trace from pixels, and a live preview that clips a
// sample artwork through the exact component the walls use (FramedArtwork).
//
// Everything is edited in the window's own 0..1 image-normalised space; the
// SVG just scales that up by the display size, so no unit conversion leaks
// into the data.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  frameImageUrl,
  frameOriginalUrl,
  windowToBBox,
  type FrameConfig,
  type FrameWindow,
} from "@/lib/frames";
import { alphaFromImage, traceWindowFromAlpha } from "@/lib/frame-tracer";
import { FrameWindowShape } from "@/components/frames/FrameWindowShape";
import { FramesProvider } from "@/components/frames/FramesProvider";
import { FramedArtwork } from "@/components/gallery/FramedArtwork";

const DISPLAY_W = 520;
const SAMPLE_ART = "/art/star.png";
const HANDLE_R = 6;

type Mode = "rect" | "ellipse" | "polygon";
type Drag =
  | { type: "vertex"; index: number }
  | { type: "corner"; fixed: [number, number] }
  | { type: "move"; start: [number, number]; orig: FrameWindow };

interface Props {
  draft: FrameConfig; // file/imagePath/aspect/window — window is the value being edited
  onChange: (w: FrameWindow) => void;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const rnd = (v: number) => +v.toFixed(4);

// ── conversions (snap-to-shape) ─────────────────────────────────────────────
function toRect(w: FrameWindow): FrameWindow {
  const b = windowToBBox(w);
  return { kind: "rect", x: rnd(b.x), y: rnd(b.y), w: rnd(b.w), h: rnd(b.h), radius: w.kind === "rect" ? w.radius ?? 0 : 0 };
}
function toEllipse(w: FrameWindow): FrameWindow {
  const b = windowToBBox(w);
  return { kind: "ellipse", cx: rnd(b.x + b.w / 2), cy: rnd(b.y + b.h / 2), rx: rnd(b.w / 2), ry: rnd(b.h / 2) };
}
function toPolygon(w: FrameWindow, aspect: number): FrameWindow {
  if (w.kind === "polygon") return w;
  if (w.kind === "ellipse") {
    const pts: [number, number][] = [];
    for (let i = 0; i < 32; i++) {
      const t = (i / 32) * Math.PI * 2;
      pts.push([rnd(w.cx + w.rx * Math.cos(t)), rnd(w.cy + w.ry * Math.sin(t))]);
    }
    return { kind: "polygon", points: pts };
  }
  const b = windowToBBox(w);
  if (w.kind === "rect" && w.radius) {
    // approximate the rounded corners with 4 points each
    const rx = Math.min(w.radius, b.w / 2), ry = Math.min(w.radius * aspect, b.h / 2);
    const corner = (cx: number, cy: number, a0: number): [number, number][] =>
      [0, 1, 2, 3, 4].map((i) => { const a = a0 + (i / 4) * (Math.PI / 2); return [rnd(cx + rx * Math.cos(a)), rnd(cy + ry * Math.sin(a))]; });
    return { kind: "polygon", points: [
      ...corner(b.x + b.w - rx, b.y + ry, -Math.PI / 2),
      ...corner(b.x + b.w - rx, b.y + b.h - ry, 0),
      ...corner(b.x + rx, b.y + b.h - ry, Math.PI / 2),
      ...corner(b.x + rx, b.y + ry, Math.PI),
    ] };
  }
  return { kind: "polygon", points: [[rnd(b.x), rnd(b.y)], [rnd(b.x + b.w), rnd(b.y)], [rnd(b.x + b.w), rnd(b.y + b.h)], [rnd(b.x), rnd(b.y + b.h)]] };
}
function modeOf(w: FrameWindow): Mode { return w.kind === "path" ? "polygon" : w.kind; }

function translate(w: FrameWindow, dx: number, dy: number): FrameWindow {
  const b = windowToBBox(w);
  dx = Math.max(-b.x, Math.min(1 - b.x - b.w, dx));
  dy = Math.max(-b.y, Math.min(1 - b.y - b.h, dy));
  switch (w.kind) {
    case "rect": return { ...w, x: rnd(w.x + dx), y: rnd(w.y + dy) };
    case "ellipse": return { ...w, cx: rnd(w.cx + dx), cy: rnd(w.cy + dy) };
    case "polygon": return { ...w, points: w.points.map(([x, y]) => [rnd(x + dx), rnd(y + dy)] as [number, number]) };
    case "path": return w;
  }
}

function rectFromCorners(a: [number, number], b: [number, number], w: FrameWindow): FrameWindow {
  const x = Math.min(a[0], b[0]), y = Math.min(a[1], b[1]);
  const ww = Math.max(0.01, Math.abs(a[0] - b[0])), hh = Math.max(0.01, Math.abs(a[1] - b[1]));
  const r: FrameWindow = { kind: "rect", x: rnd(x), y: rnd(y), w: rnd(ww), h: rnd(hh), radius: w.kind === "rect" ? w.radius ?? 0 : 0 };
  return w.kind === "ellipse" ? toEllipse(r) : r;
}

export function FrameShapeEditor({ draft, onChange }: Props) {
  const aspect = draft.aspect > 0 ? draft.aspect : 1;
  const W = DISPLAY_W, H = DISPLAY_W / aspect;
  const win = useMemo<FrameWindow>(() => draft.window ?? { kind: "rect", x: 0.1, y: 0.1, w: 0.8, h: 0.8, radius: 0 }, [draft.window]);
  const mode = modeOf(win);
  const bbox = windowToBBox(win);

  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [tracing, setTracing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const toNorm = useCallback((e: { clientX: number; clientY: number }): [number, number] => {
    const r = svgRef.current!.getBoundingClientRect();
    return [clamp01((e.clientX - r.left) / r.width), clamp01((e.clientY - r.top) / r.height)];
  }, []);

  // ── pointer interaction ───────────────────────────────────────────────────
  const startDrag = (drag: Drag) => (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    dragRef.current = drag;
    svgRef.current?.setPointerCapture(e.pointerId);
    if (drag.type === "vertex") setSelected(drag.index);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const p = toNorm(e);
    if (d.type === "vertex" && win.kind === "polygon") {
      const points = win.points.slice();
      points[d.index] = [rnd(p[0]), rnd(p[1])];
      onChange({ ...win, points });
    } else if (d.type === "corner") {
      onChange(rectFromCorners(d.fixed, p, win));
    } else if (d.type === "move") {
      onChange(translate(d.orig, p[0] - d.start[0], p[1] - d.start[1]));
    }
  };
  const onPointerUp = () => { dragRef.current = null; };

  const onShapePointerDown = (e: React.PointerEvent) => {
    startDrag({ type: "move", start: toNorm(e), orig: win })(e);
  };

  // polygon: click a midpoint to insert a vertex; Delete removes the selected one
  const insertVertex = (i: number) => {
    if (win.kind !== "polygon") return;
    const a = win.points[i], b = win.points[(i + 1) % win.points.length];
    const points = win.points.slice();
    points.splice(i + 1, 0, [rnd((a[0] + b[0]) / 2), rnd((a[1] + b[1]) / 2)]);
    onChange({ ...win, points });
    setSelected(i + 1);
  };
  const removeSelected = useCallback(() => {
    if (win.kind !== "polygon" || selected === null || win.points.length <= 3) return;
    onChange({ ...win, points: win.points.filter((_, i) => i !== selected) });
    setSelected(null);
  }, [win, selected, onChange]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "Delete" || e.key === "Backspace") && selected !== null && (e.target as HTMLElement)?.tagName !== "INPUT") {
        e.preventDefault();
        removeSelected();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [removeSelected, selected]);

  // ── re-trace from pixels ──────────────────────────────────────────────────
  const retrace = async (forcePolygon: boolean) => {
    setTracing(true); setNotice(null);
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error("image failed to load")); img.src = frameOriginalUrl(draft); });
      const { alpha, width, height } = alphaFromImage(img);
      const result = traceWindowFromAlpha(alpha, width, height);
      if (!result) { setNotice("No enclosed transparent region found — draw the window by hand."); return; }
      onChange(forcePolygon ? { kind: "polygon", points: result.polygon } : result.window);
      setSelected(null);
      setNotice(result.flags.length ? result.flags.join(" · ") : `traced as ${result.window.kind} (rect IoU ${result.stats.rectIoU}, ellipse IoU ${result.stats.ellipseIoU})`);
    } catch (e) {
      setNotice(`Couldn't read pixels: ${(e as Error).message}`);
    } finally { setTracing(false); }
  };

  const setMode = (m: Mode) => {
    if (m === mode) return;
    onChange(m === "rect" ? toRect(win) : m === "ellipse" ? toEllipse(win) : toPolygon(win, aspect));
    setSelected(null);
  };

  // ── handles ───────────────────────────────────────────────────────────────
  const px = (p: [number, number]) => [p[0] * W, p[1] * H] as const;
  const corners: { p: [number, number]; fixed: [number, number] }[] = mode === "polygon" ? [] : [
    { p: [bbox.x, bbox.y], fixed: [bbox.x + bbox.w, bbox.y + bbox.h] },
    { p: [bbox.x + bbox.w, bbox.y], fixed: [bbox.x, bbox.y + bbox.h] },
    { p: [bbox.x + bbox.w, bbox.y + bbox.h], fixed: [bbox.x, bbox.y] },
    { p: [bbox.x, bbox.y + bbox.h], fixed: [bbox.x + bbox.w, bbox.y] },
  ];

  const btn = (active: boolean) =>
    `rounded-full px-3 py-1 text-xs font-medium transition-colors ${active ? "bg-[#3b2a1a] text-[#faf7f0]" : "border border-[#d8ceb8] text-brown hover:border-[#c8a040]/60"}`;

  const previewCatalog = { frames: [{ ...draft, window: win, bbox }], categories: [] };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_240px]">
      <div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-brown-muted">shape</span>
          {(["rect", "ellipse", "polygon"] as Mode[]).map((m) => (
            <button key={m} type="button" className={btn(mode === m)} onClick={() => setMode(m)}>{m}</button>
          ))}
          <span className="mx-2 h-4 w-px bg-[#d8ceb8]" />
          <button type="button" className={btn(false)} disabled={tracing} onClick={() => retrace(false)}>{tracing ? "tracing…" : "re-trace"}</button>
          <button type="button" className={btn(false)} disabled={tracing} onClick={() => retrace(true)}>trace as polygon</button>
          {mode === "rect" && win.kind === "rect" && (
            <label className="ml-2 flex items-center gap-1 text-xs text-brown-muted">
              corner radius
              <input
                type="number" min={0} max={0.5} step={0.005}
                value={win.radius ?? 0}
                onChange={(e) => onChange({ ...win, radius: Math.max(0, Math.min(0.5, Number(e.target.value) || 0)) })}
                className="w-20 rounded border border-[#d8ceb8] bg-white/70 px-1 py-0.5 text-xs text-brown"
              />
            </label>
          )}
          {mode === "polygon" && win.kind === "polygon" && (
            <span className="ml-2 text-xs text-brown-muted">
              {win.points.length} pts · click a midpoint to add · select + Delete to remove
              {selected !== null && (
                <button type="button" className="ml-2 underline" onClick={removeSelected} disabled={win.points.length <= 3}>remove #{selected + 1}</button>
              )}
            </span>
          )}
        </div>

        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          style={{ width: "100%", maxWidth: W, height: "auto", display: "block", touchAction: "none", background: "repeating-conic-gradient(#e9e2d3 0 25%, #f5f0e8 0 50%) 0 0 / 20px 20px", borderRadius: 8, border: "1px solid #d8ceb8" }}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <image href={frameImageUrl(draft, 800)} x={0} y={0} width={W} height={H} preserveAspectRatio="none" />
          {/* bbox */}
          <rect x={bbox.x * W} y={bbox.y * H} width={bbox.w * W} height={bbox.h * H} fill="none" stroke="rgba(59,42,26,0.5)" strokeDasharray="4 3" />
          {/* the window itself; drag its body to move */}
          <g transform={`scale(${W} ${H})`} style={{ cursor: "move" }} onPointerDown={onShapePointerDown}>
            <FrameWindowShape window={win} imageAspect={aspect} fill="rgba(200,160,64,0.28)" stroke="#c8a040" strokeWidth={2} vectorEffect="non-scaling-stroke" />
          </g>
          {/* corner handles for rect / ellipse */}
          {corners.map((c, i) => {
            const [x, y] = px(c.p);
            return <circle key={i} cx={x} cy={y} r={HANDLE_R} fill="#fff" stroke="#c8a040" strokeWidth={2} style={{ cursor: "nwse-resize" }} onPointerDown={startDrag({ type: "corner", fixed: c.fixed })} />;
          })}
          {/* polygon vertices + midpoints */}
          {win.kind === "polygon" && win.points.map((p, i) => {
            const [x, y] = px(p);
            const q = win.points[(i + 1) % win.points.length];
            const [mx, my] = px([(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]);
            return (
              <g key={i}>
                <circle cx={mx} cy={my} r={4} fill="rgba(255,255,255,0.7)" stroke="#c8a040" strokeDasharray="2 2" style={{ cursor: "copy" }} onPointerDown={(e) => { e.stopPropagation(); insertVertex(i); }} />
                <circle cx={x} cy={y} r={selected === i ? HANDLE_R + 2 : HANDLE_R} fill={selected === i ? "#c8a040" : "#fff"} stroke="#c8a040" strokeWidth={2} style={{ cursor: "grab" }} onPointerDown={startDrag({ type: "vertex", index: i })} />
              </g>
            );
          })}
        </svg>

        <p className="mt-2 min-h-[1.25rem] text-xs text-brown-muted">
          {notice ?? `bbox ${(bbox.x * 100).toFixed(1)}% ${(bbox.y * 100).toFixed(1)}% · ${(bbox.w * 100).toFixed(1)}% × ${(bbox.h * 100).toFixed(1)}% · window aspect ${((bbox.w / bbox.h) * aspect).toFixed(3)}`}
        </p>
      </div>

      {/* live preview through the wall renderer */}
      <div>
        <p className="mb-2 text-xs uppercase tracking-wide text-brown-muted">wall preview</p>
        <div className="rounded-lg p-4" style={{ background: "#2a2018" }}>
          <FramesProvider catalog={previewCatalog}>
            <FramedArtwork
              frame_file={draft.file}
              artSrc={SAMPLE_ART}
              width={200}
              title="sample"
              medium=""
              artistName=""
              showTooltip={false}
            />
          </FramesProvider>
        </div>
        <p className="mt-2 text-[11px] leading-snug text-brown-muted">
          Same component as the gallery walls. The sample is clipped to the window exactly as a real piece will be.
        </p>
      </div>
    </div>
  );
}
