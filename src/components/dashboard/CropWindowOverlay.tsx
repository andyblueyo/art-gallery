"use client";

// Rendered inside react-image-crop's selection box (via renderSelectionAddon).
// The selection itself is constrained to the window's bounding-box aspect;
// this addon shows what will actually be visible:
//
//   * the frame graphic, ghosted at reduced opacity and positioned so its
//     window lands exactly on the selection (clipped to the photo's bounds,
//     since e.g. the Nokia body is ~7x its screen)
//   * the window's real shape — heart, ellipse, rounded screen — with the
//     part of the selection outside it darkened and outlined
//
// All geometry is in percent of the selection, derived from the crop's
// percent-unit state, so it needs no measurements and re-lays out for free.

import { useId } from "react";
import type { Crop } from "react-image-crop";
import { frameImageUrl, frameWindowBBox, type FrameConfig } from "@/lib/frames";
import { FrameWindowShape } from "@/components/frames/FrameWindowShape";

interface Props {
  frame: FrameConfig;
  crop: Crop | undefined;
}

export function CropWindowOverlay({ frame, crop }: Props) {
  const maskId = useId();
  if (!crop || crop.unit !== "%" || !crop.width || !crop.height) return null;

  const bb = frameWindowBBox(frame);
  const pct = (v: number) => `${v}%`;

  // A box covering the whole photo, expressed in percent of the selection.
  const photo = {
    left: (-crop.x / crop.width) * 100,
    top: (-crop.y / crop.height) * 100,
    width: (100 / crop.width) * 100,
    height: (100 / crop.height) * 100,
  };
  // The ghost frame, in percent of the photo: scale so bbox == selection.
  const gw = crop.width / bb.w;
  const gh = crop.height / bb.h;
  const gx = crop.x - bb.x * gw;
  const gy = crop.y - bb.y * gh;
  const ghostSrc = frameImageUrl(frame, 800);

  // window (image coords) → selection-local 0..1
  const toLocal = `scale(${1 / bb.w} ${1 / bb.h}) translate(${-bb.x} ${-bb.y})`;

  return (
    <>
      {ghostSrc && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: pct(photo.left),
            top: pct(photo.top),
            width: pct(photo.width),
            height: pct(photo.height),
            overflow: "hidden",
            pointerEvents: "none",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={ghostSrc}
            alt=""
            draggable={false}
            style={{
              position: "absolute",
              left: pct(gx),
              top: pct(gy),
              width: pct(gw),
              height: pct(gh),
              maxWidth: "none",
              opacity: 0.6,
            }}
          />
        </div>
      )}

      {frame.window && (
        <svg
          aria-hidden
          viewBox="0 0 1 1"
          preserveAspectRatio="none"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "visible" }}
        >
          <defs>
            <mask id={maskId} maskUnits="userSpaceOnUse" x={0} y={0} width={1} height={1}>
              <rect x={0} y={0} width={1} height={1} fill="white" />
              <g transform={toLocal}>
                <FrameWindowShape window={frame.window} imageAspect={frame.aspect} fill="black" />
              </g>
            </mask>
          </defs>
          {/* darken the part of the selection the window will hide */}
          <rect x={0} y={0} width={1} height={1} fill="rgba(0,0,0,0.55)" mask={`url(#${maskId})`} />
          <g transform={toLocal}>
            <FrameWindowShape
              window={frame.window}
              imageAspect={frame.aspect}
              fill="none"
              stroke="white"
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        </svg>
      )}
    </>
  );
}
