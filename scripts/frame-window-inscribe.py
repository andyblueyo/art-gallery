#!/usr/bin/env python3
"""
frame-window-inscribe.py

Detect each frame's real art window from the PNG alpha channel and compute the
largest axis-aligned rectangle that fits ENTIRELY inside it (inscribed rect),
not the window's bounding box.

Why inscribed and not bbox: several frames (pink-tama, angel-tama, pink2-tama)
have rounded-corner windows. A bounding box of the transparent region overshoots
the rounding on all four sides, so the crop box spills onto opaque frame pixels.
The inscribed rectangle can never overshoot — which is the actual requirement.

Window detection:
  1. transparent = alpha < ALPHA_T
  2. flood-fill transparent from all four canvas corners -> exterior transparency
  3. window = transparent AND NOT exterior   (interior holes only)
  4. keep the largest connected component

Modes:
    python3 scripts/frame-window-inscribe.py                 # audit all frames
    python3 scripts/frame-window-inscribe.py <file> [...]    # propose values

Audit reports, for every frame's CURRENT cropPadding, what fraction of the crop
box lands outside the detected window ("spill"). spill == 0 means the box never
crosses outside the visible art window.
"""

import re
import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).parent.parent
FRAMES_TS = ROOT / "src/lib/frames.ts"
FRAMES_DIR = ROOT / "public/frames"

ALPHA_T = 16        # alpha below this counts as transparent
SPILL_TOL = 0.005   # <=0.5% of box area outside window is treated as clean
                    # (antialiased window edges are a pixel or two soft)

LINE_RE = re.compile(
    r'file:\s*"([^"]+)".*?'
    r'label:\s*"([^"]+)".*?'
    r'category:\s*"([^"]+)".*?'
    r'cropPadding:\s*\{\s*'
    r'top:\s*([\d.]+),\s*right:\s*([\d.]+),\s*bottom:\s*([\d.]+),\s*left:\s*([\d.]+)'
)


def parse_frames(include_classic=False):
    out = []
    for line in FRAMES_TS.read_text().splitlines():
        m = LINE_RE.search(line)
        if not m:
            continue
        f, label, cat, t, r, b, l = m.groups()
        if cat == "classic" and not include_classic:
            continue
        out.append({
            "file": f, "label": label, "cat": cat,
            "cp": {"top": float(t), "right": float(r),
                   "bottom": float(b), "left": float(l)},
        })
    return out


def window_mask(path: Path):
    """Return (mask, W, H). mask[y, x] True == inside the frame's art window."""
    img = Image.open(path).convert("RGBA")
    W, H = img.size
    alpha = np.array(img)[:, :, 3]
    transparent = alpha < ALPHA_T

    # Flood-fill transparency inward from every canvas corner: anything reachable
    # is exterior background, not a window.
    exterior = np.zeros_like(transparent)
    q = deque()
    for y, x in ((0, 0), (0, W - 1), (H - 1, 0), (H - 1, W - 1)):
        if transparent[y, x] and not exterior[y, x]:
            exterior[y, x] = True
            q.append((y, x))
    while q:
        y, x = q.popleft()
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < H and 0 <= nx < W and transparent[ny, nx] and not exterior[ny, nx]:
                exterior[ny, nx] = True
                q.append((ny, nx))

    holes = transparent & ~exterior
    if not holes.any():
        return None, W, H

    # Largest connected hole == the art window.
    seen = np.zeros_like(holes)
    best = None
    best_n = 0
    ys, xs = np.nonzero(holes)
    for sy, sx in zip(ys, xs):
        if seen[sy, sx]:
            continue
        comp = []
        seen[sy, sx] = True
        q.append((sy, sx))
        while q:
            y, x = q.popleft()
            comp.append((y, x))
            for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                if 0 <= ny < H and 0 <= nx < W and holes[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    q.append((ny, nx))
        if len(comp) > best_n:
            best_n = len(comp)
            best = comp

    mask = np.zeros_like(holes)
    for y, x in best:
        mask[y, x] = True
    return mask, W, H


def max_inscribed_rect(mask):
    """Largest-area axis-aligned all-True rectangle. Returns (x0, y0, x1, y1) exclusive."""
    H, W = mask.shape
    heights = np.zeros(W + 1, dtype=np.int32)  # sentinel 0 at the end
    best = (0, 0, 0, 0, 0)  # area, x0, y0, x1, y1
    for y in range(H):
        heights[:W] = np.where(mask[y], heights[:W] + 1, 0)
        stack = []
        for x in range(W + 1):
            h = heights[x]
            start = x
            while stack and stack[-1][1] > h:
                sx, sh = stack.pop()
                area = sh * (x - sx)
                if area > best[0]:
                    best = (area, sx, y - sh + 1, x, y + 1)
                start = sx
            stack.append((start, h))
    return best[1], best[2], best[3], best[4]


def bbox(mask):
    ys, xs = np.nonzero(mask)
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


def to_padding(x0, y0, x1, y1, W, H):
    return {
        "top": round(y0 / H, 3),
        "right": round((W - x1) / W, 3),
        "bottom": round((H - y1) / H, 3),
        "left": round(x0 / W, 3),
    }


def spill(cp, mask, W, H):
    """Fraction of the current crop box that falls OUTSIDE the window."""
    x0 = int(round(cp["left"] * W))
    y0 = int(round(cp["top"] * H))
    x1 = int(round((1 - cp["right"]) * W))
    y1 = int(round((1 - cp["bottom"]) * H))
    x0c, y0c = max(0, x0), max(0, y0)
    x1c, y1c = min(W, x1), min(H, y1)
    total = max(0, x1 - x0) * max(0, y1 - y0)
    if total == 0:
        return 1.0, (x0, y0, x1, y1)
    inside = int(mask[y0c:y1c, x0c:x1c].sum())
    return 1.0 - inside / total, (x0, y0, x1, y1)


def fmt(cp):
    return (f'cropPadding: {{ top: {cp["top"]:.3f}, right: {cp["right"]:.3f}, '
            f'bottom: {cp["bottom"]:.3f}, left: {cp["left"]:.3f} }}')


def main():
    targets = [a for a in sys.argv[1:] if not a.startswith("--")]
    frames = parse_frames(include_classic="--all" in sys.argv)
    if targets:
        frames = [f for f in frames if any(t in f["file"] for t in targets)]

    print(f"{'frame':<32} {'spill':>7}  status")
    print("-" * 78)
    dirty = []
    undetected = []
    for fr in frames:
        mask, W, H = window_mask(FRAMES_DIR / fr["file"])
        if mask is None:
            undetected.append(fr["file"])
            print(f"{fr['file']:<32} {'—':>7}  NO TRANSPARENT WINDOW (opaque art area)")
            continue
        s, _ = spill(fr["cp"], mask, W, H)
        ok = s <= SPILL_TOL
        status = "clean" if ok else "OVERSHOOTS"
        print(f"{fr['file']:<32} {s*100:6.2f}%  {status}")
        if not ok:
            dirty.append(fr["file"])
        if targets:
            ir = max_inscribed_rect(mask)
            bb = bbox(mask)
            cp_i = to_padding(*ir, W, H)
            cp_b = to_padding(*bb, W, H)
            print(f"    img {W}x{H}  window bbox {bb}  inscribed {ir}")
            print(f"    bbox      -> {fmt(cp_b)}   (overshoots rounded corners)")
            print(f"    inscribed -> {fmt(cp_i)}")
            s2, _ = spill(cp_i, mask, W, H)
            print(f"    inscribed spill: {s2*100:.2f}%")
            print()

    print("-" * 78)
    if undetected:
        print(f"{len(undetected)} frame(s) have no detectable transparent window "
              f"(needs visual check): {', '.join(undetected)}")
    print(f"{len(dirty)} frame(s) overshoot: {', '.join(dirty) if dirty else 'none'}")


if __name__ == "__main__":
    main()
