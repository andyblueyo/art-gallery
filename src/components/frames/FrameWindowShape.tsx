// The SVG element for a frame window, in the frame image's normalised 0..1
// coordinate space. Drop it inside any <svg viewBox="0 0 1 1"> or a
// <clipPath clipPathUnits="objectBoundingBox"> — the same numbers drive the
// crop overlay, the wall renderer and the editor canvas.

import type { SVGProps } from "react";
import type { FrameWindow } from "@/lib/frames";

type Props = {
  window: FrameWindow;
  // Frame image w/h. Only needed to keep a rounded rect's corners circular:
  // `radius` is normalised to the image width, so ry = radius * aspect.
  imageAspect?: number;
} & Omit<SVGProps<SVGElement>, "points" | "d" | "x" | "y" | "width" | "height" | "cx" | "cy" | "rx" | "ry">;

export function FrameWindowShape({ window: w, imageAspect = 1, ...rest }: Props) {
  const props = rest as SVGProps<SVGRectElement> & SVGProps<SVGEllipseElement> & SVGProps<SVGPolygonElement> & SVGProps<SVGPathElement>;
  switch (w.kind) {
    case "rect": {
      const r = w.radius ?? 0;
      return <rect x={w.x} y={w.y} width={w.w} height={w.h} rx={r} ry={r * imageAspect} {...props} />;
    }
    case "ellipse":
      return <ellipse cx={w.cx} cy={w.cy} rx={w.rx} ry={w.ry} {...props} />;
    case "polygon":
      return <polygon points={w.points.map(([x, y]) => `${x},${y}`).join(" ")} {...props} />;
    case "path":
      return <path d={w.d} {...props} />;
  }
}
