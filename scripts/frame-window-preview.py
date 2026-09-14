#!/usr/bin/env python3
"""
frame-window-preview.py
Contact sheet of every frame with the auto-traced window from
scripts/output/frame-windows.json drawn over it:
  red   = emitted window (rect / rounded rect / ellipse / polygon)
  blue  = raw simplified polygon (shown only when the window was snapped)
Output: scripts/output/frame-windows-preview.png
Usage:  python3 scripts/frame-window-preview.py [digis|classic|polaroid ...]
"""
import json, sys
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).parent.parent
DATA = json.loads((ROOT / "scripts/output/frame-windows.json").read_text())
OUT = ROOT / "scripts/output/frame-windows-preview.png"
only = set(sys.argv[1:])
if only: DATA = [d for d in DATA if d["category"] in only]

COLS, BOX, LABEL = 5, 320, 46
rows = -(-len(DATA) // COLS)
sheet = Image.new("RGB", (COLS * BOX, rows * (BOX + LABEL)), (250, 247, 240))
draw = ImageDraw.Draw(sheet)

for i, d in enumerate(DATA):
    im = Image.open(ROOT / "public/frames" / d["frame_file"]).convert("RGBA")
    W, H = im.size
    s = min((BOX - 16) / W, (BOX - 16) / H)
    tw, th = int(W * s), int(H * s)
    thumb = im.resize((tw, th), Image.LANCZOS)
    ox = (i % COLS) * BOX + (BOX - tw) // 2
    oy = (i // COLS) * (BOX + LABEL) + (BOX - th) // 2
    sheet.paste(Image.new("RGB", (tw, th), (215, 205, 190)), (ox, oy))
    sheet.paste(thumb, (ox, oy), thumb)
    P = lambda x, y: (ox + x * tw, oy + y * th)

    w = d.get("window")
    if w:
        if w["kind"] != "polygon" and d.get("polygon"):
            draw.polygon([P(x, y) for x, y in d["polygon"]], outline=(40, 90, 220), width=1)
        if w["kind"] == "rect":
            r = w.get("radius", 0) * tw
            draw.rounded_rectangle([P(w["x"], w["y"]), P(w["x"] + w["w"], w["y"] + w["h"])], radius=r, outline=(230, 30, 30), width=2)
        elif w["kind"] == "ellipse":
            draw.ellipse([P(w["cx"] - w["rx"], w["cy"] - w["ry"]), P(w["cx"] + w["rx"], w["cy"] + w["ry"])], outline=(230, 30, 30), width=2)
        else:
            draw.polygon([P(x, y) for x, y in w["points"]], outline=(230, 30, 30), width=2)
    sx, sy = d["seed"]
    draw.ellipse([P(sx / W, sy / H)[0] - 3, P(sx / W, sy / H)[1] - 3, P(sx / W, sy / H)[0] + 3, P(sx / W, sy / H)[1] + 3], fill=(0, 160, 0))

    st = d.get("stats", {})
    kind = (w or {}).get("kind", "NONE")
    if kind == "rect" and w.get("radius"): kind = f"rrect r={w['radius']}"
    l1 = f"{d['frame_file']}  → {kind}"
    l2 = f"rect {st.get('rect_iou','-')}  rr {st.get('rounded_rect_iou','-')}  ell {st.get('ellipse_iou','-')}  pts {st.get('dp_pts','-')}"
    flag = "  ".join(f.split(":")[0] for f in d["flags"]) or ""
    lx, ly = (i % COLS) * BOX + 6, (i // COLS) * (BOX + LABEL) + BOX - 2
    draw.text((lx, ly), l1, fill=(40, 30, 20))
    draw.text((lx, ly + 13), l2, fill=(90, 80, 70))
    if flag: draw.text((lx, ly + 26), flag, fill=(200, 40, 40))

sheet.save(OUT)
print(f"wrote {OUT} ({sheet.size[0]}x{sheet.size[1]}, {len(DATA)} frames)")
