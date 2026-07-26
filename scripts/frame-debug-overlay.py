#!/usr/bin/env python3
"""
frame-debug-overlay.py
Generate a contact sheet of every polaroid + digis frame with its
cropPadding window drawn as a red dashed rectangle, so crop geometry
can be checked visually without opening the app.

Output: scripts/output/frame-crop-check.png

Usage:
    python3 scripts/frame-debug-overlay.py
"""

import re, math, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

# ── Paths ─────────────────────────────────────────────────────────────────────
ROOT       = Path(__file__).parent.parent
FRAMES_TS  = ROOT / "src/lib/frames.ts"
FRAMES_DIR = ROOT / "public/frames"
OUT_DIR    = Path(__file__).parent / "output"
OUT_FILE   = OUT_DIR / "frame-crop-check.png"

OUT_DIR.mkdir(parents=True, exist_ok=True)

# ── Layout constants ──────────────────────────────────────────────────────────
COLS       = 4          # columns in the grid
THUMB_BOX  = 280        # each frame scaled to fit inside this square (px)
LABEL_H    = 72         # pixels below the thumb for labels
CELL_PAD   = 12         # padding around each cell
CELL_W     = THUMB_BOX + 2 * CELL_PAD
CELL_H     = THUMB_BOX + LABEL_H + 2 * CELL_PAD

BG_COLOR    = (245, 241, 235)   # warm off-white background
LABEL_BG    = (235, 230, 220)   # slightly darker label area
TEXT_COLOR  = (50, 35, 15)      # dark brown text
OVERLAY_COLOR = (209, 69, 32)   # #D14520 red-orange overlay rectangle

DASH_ON  = 6    # px of drawn dash
DASH_OFF = 4    # px of gap

# ── Fonts ─────────────────────────────────────────────────────────────────────
def load_font(size):
    for path in (
        "/System/Library/Fonts/Helvetica.ttc",
        "/System/Library/Fonts/SFNSDisplay.ttf",
        "/System/Library/Fonts/Arial.ttf",
    ):
        try:
            return ImageFont.truetype(path, size)
        except Exception:
            pass
    return ImageFont.load_default()

FONT_NAME = load_font(11)
FONT_VALS = load_font(9)

# ── Parse frames.ts ───────────────────────────────────────────────────────────
# One frame per line; extract file, label, category, cropPadding.
LINE_RE = re.compile(
    r'file:\s*"([^"]+)".*?'
    r'label:\s*"([^"]+)".*?'
    r'category:\s*"([^"]+)".*?'
    r'cropPadding:\s*\{\s*'
    r'top:\s*([\d.]+),\s*right:\s*([\d.]+),\s*bottom:\s*([\d.]+),\s*left:\s*([\d.]+)',
)

frames = []
for line in FRAMES_TS.read_text().splitlines():
    m = LINE_RE.search(line)
    if not m:
        continue
    file_, label, cat, top, right, bottom, left = m.groups()
    if cat == "classic":
        continue
    frames.append({
        "file":  file_,
        "label": label,
        "cat":   cat,
        "cp":    {
            "top":    float(top),
            "right":  float(right),
            "bottom": float(bottom),
            "left":   float(left),
        },
    })

print(f"Found {len(frames)} non-classic frames ({sum(1 for f in frames if f['cat']=='polaroid')} polaroid, "
      f"{sum(1 for f in frames if f['cat']=='digis')} digis)")

# ── Helpers ───────────────────────────────────────────────────────────────────
def draw_dashed_rect(draw, x0, y0, x1, y1, color, width=2, dash_on=DASH_ON, dash_off=DASH_OFF):
    """Draw a dashed rectangle by segmenting all four sides."""
    def dashed_line(pts):
        total = sum(
            math.hypot(pts[i+1][0]-pts[i][0], pts[i+1][1]-pts[i][1])
            for i in range(len(pts)-1)
        )
        # Walk along the segments emitting dash/gap alternately
        drawing = True
        dist_remaining = dash_on
        pos = 0.0
        segs = list(zip(pts[:-1], pts[1:]))
        for (ax, ay), (bx, by) in segs:
            seg_len = math.hypot(bx - ax, by - ay)
            seg_dx = (bx - ax) / seg_len if seg_len else 0
            seg_dy = (by - ay) / seg_len if seg_len else 0
            seg_pos = 0.0
            while seg_pos < seg_len:
                step = min(dist_remaining, seg_len - seg_pos)
                ex = ax + seg_dx * (seg_pos + step)
                ey = ay + seg_dy * (seg_pos + step)
                if drawing:
                    sx = ax + seg_dx * seg_pos
                    sy = ay + seg_dy * seg_pos
                    draw.line([(sx, sy), (ex, ey)], fill=color, width=width)
                seg_pos += step
                dist_remaining -= step
                if dist_remaining <= 0:
                    drawing = not drawing
                    dist_remaining = dash_on if drawing else dash_off

    # Top, right, bottom (reversed), left (reversed)
    dashed_line([(x0, y0), (x1, y0)])
    dashed_line([(x1, y0), (x1, y1)])
    dashed_line([(x1, y1), (x0, y1)])
    dashed_line([(x0, y1), (x0, y0)])


def make_cell(frame_meta: dict) -> Image.Image:
    """Render one cell: frame image + overlay + label."""
    asset = FRAMES_DIR / frame_meta["file"]
    cp    = frame_meta["cp"]
    label = frame_meta["label"]
    cat   = frame_meta["cat"]

    # Load frame
    try:
        img = Image.open(asset).convert("RGBA")
    except FileNotFoundError:
        img = Image.new("RGBA", (200, 200), (200, 180, 160, 255))

    W, H = img.size

    # Scale to fit inside THUMB_BOX while preserving aspect
    scale = min(THUMB_BOX / W, THUMB_BOX / H)
    tw = max(1, round(W * scale))
    th = max(1, round(H * scale))
    thumb = img.resize((tw, th), Image.LANCZOS)

    # Compute cropPadding box IN THUMBNAIL space
    bx0 = round(cp["left"]   * tw)
    by0 = round(cp["top"]    * th)
    bx1 = round((1 - cp["right"])  * tw)
    by1 = round((1 - cp["bottom"]) * th)

    # Composite thumb onto a white cell background
    cell = Image.new("RGBA", (CELL_W, CELL_H), (*BG_COLOR, 255))

    # White area behind the thumb
    thumb_x = (CELL_W - tw) // 2
    thumb_y = CELL_PAD + (THUMB_BOX - th) // 2
    cell.paste(thumb, (thumb_x, thumb_y), mask=thumb)

    # Draw dashed overlay rectangle (absolute coords on cell)
    draw = ImageDraw.Draw(cell)
    rx0, ry0 = thumb_x + bx0, thumb_y + by0
    rx1, ry1 = thumb_x + bx1, thumb_y + by1
    draw_dashed_rect(draw, rx0, ry0, rx1, ry1, OVERLAY_COLOR, width=2)

    # Label area
    label_y = CELL_PAD + THUMB_BOX
    draw.rectangle([0, label_y, CELL_W, CELL_H], fill=LABEL_BG)

    # Category tag
    tag_text = cat.upper()
    tag_color = (120, 60, 0) if cat == "polaroid" else (20, 80, 140)
    draw.text((CELL_PAD, label_y + 4), tag_text, font=FONT_VALS, fill=tag_color)

    # Frame label
    draw.text((CELL_PAD, label_y + 16), label, font=FONT_NAME, fill=TEXT_COLOR)

    # cropPadding values
    cp_line1 = f"T:{cp['top']:.3f}  R:{cp['right']:.3f}"
    cp_line2 = f"B:{cp['bottom']:.3f}  L:{cp['left']:.3f}"
    draw.text((CELL_PAD, label_y + 32), cp_line1, font=FONT_VALS, fill=(100, 75, 50))
    draw.text((CELL_PAD, label_y + 44), cp_line2, font=FONT_VALS, fill=(100, 75, 50))

    # Box dims annotation
    box_w_px = max(0, bx1 - bx0)
    box_h_px = max(0, by1 - by0)
    draw.text(
        (CELL_PAD, label_y + 57),
        f"win {box_w_px}×{box_h_px}px  (img {tw}×{th})",
        font=FONT_VALS, fill=(140, 110, 80),
    )

    return cell.convert("RGB")


# ── Build contact sheet ───────────────────────────────────────────────────────
n      = len(frames)
cols   = COLS
rows   = math.ceil(n / cols)

sheet_w = cols * CELL_W
sheet_h = rows * CELL_H + 40    # 40px header strip

sheet = Image.new("RGB", (sheet_w, sheet_h), BG_COLOR)
draw  = ImageDraw.Draw(sheet)

# Header
header_font = load_font(14)
draw.rectangle([0, 0, sheet_w, 38], fill=(60, 40, 20))
draw.text(
    (12, 10),
    "frame-crop-check — cropPadding overlay (red dashed box = art window)",
    font=header_font,
    fill=(240, 225, 195),
)

for i, frame_meta in enumerate(frames):
    print(f"  [{i+1:02d}/{n}] {frame_meta['file']}")
    cell = make_cell(frame_meta)
    col  = i % cols
    row  = i // cols
    x    = col * CELL_W
    y    = 40 + row * CELL_H
    sheet.paste(cell, (x, y))

sheet.save(OUT_FILE, optimize=True)
print(f"\nSaved → {OUT_FILE}  ({sheet.width}×{sheet.height}px)")
