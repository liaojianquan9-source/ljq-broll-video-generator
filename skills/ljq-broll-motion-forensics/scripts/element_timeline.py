"""
When does each element appear, and in what order do characters enter?

Running order of a whole shot:
    python element_timeline.py FRAMES_DIR --colour red

Per-character entrance order of one text line:
    python element_timeline.py FRAMES_DIR --text 130,606,520,644 --empty 0 --cell 26

--text is x0,y0,x1,y1 of a single line; --empty is the index of a frame from
before the text exists. Monotonic onsets mean a typewriter or directional wipe.
Scattered onsets inside a short window mean every character starts at once from
a random offset -- an AE text animator with Randomize Order, or a seeded random
delay in code. That is a hand-authored signature.
"""
import argparse
import glob
import os

import numpy as np
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument("frames")
ap.add_argument("--colour", default=None, choices=[None, "red", "white"])
ap.add_argument("--scale", type=float, default=2.0, help="report coords at this multiple")
ap.add_argument("--min-new", type=int, default=90, help="only report frames adding this many px")
ap.add_argument("--text", default=None, metavar="x0,y0,x1,y1")
ap.add_argument("--empty", type=int, default=0, help="frame index with no text yet")
ap.add_argument("--cell", type=int, default=26, help="approx character cell width")
ap.add_argument("--threshold", type=float, default=9.0)
a = ap.parse_args()

files = sorted(glob.glob(os.path.join(a.frames, "*.png")))
if not files:
    raise SystemExit(f"no PNGs in {a.frames}")

if a.text:
    g = [np.asarray(Image.open(f).convert("L")).astype(np.float64) for f in files]
    x0, y0, x1, y1 = (int(v) for v in a.text.split(","))
    base = g[a.empty]
    onsets = []
    for cx in range(x0, x1 - a.cell, a.cell):
        on = None
        for i, f in enumerate(g):
            if np.abs(f[y0:y1, cx:cx + a.cell] - base[y0:y1, cx:cx + a.cell]).mean() > a.threshold:
                on = i
                break
        onsets.append(on)
    print("onset frame per character cell, left to right:")
    print("   ", onsets)
    clean = [v for v in onsets if v is not None]
    if len(clean) > 2:
        mono = all(clean[i] <= clean[i + 1] for i in range(len(clean) - 1)) or \
               all(clean[i] >= clean[i + 1] for i in range(len(clean) - 1))
        print(f"\n   spread = {max(clean) - min(clean)} frames")
        print("   monotonic => typewriter / directional wipe" if mono else
              "   NOT monotonic => characters start together from random offsets")
    raise SystemExit(0)

rgb = [np.asarray(Image.open(f).convert("RGB")).astype(np.int16) for f in files]


def sel(img):
    r, g_, b = img[..., 0], img[..., 1], img[..., 2]
    if a.colour == "red":
        return (r > 90) & (r - g_ > 55) & (r - b > 45)
    if a.colour == "white":
        return np.minimum(np.minimum(r, g_), b) > 170
    return np.abs(img - rgb[0]).sum(axis=2) > 60


masks = [sel(f) for f in rgb]
counts = [int(m.sum()) for m in masks]
peak = max(counts) or 1
print("=== selected pixels per frame ===")
for i in range(0, len(counts), 5):
    print(f"f{i:4d} {counts[i]:7d} " + "#" * int(counts[i] / peak * 60))

print(f"\n=== frames adding more than {a.min_new} new px ===")
prev = masks[0]
for i in range(1, len(masks)):
    new = masks[i] & ~prev
    n = int(new.sum())
    if n > a.min_new:
        ys, xs = np.nonzero(new)
        s = a.scale
        print(f"f{i:4d} +{n:6d}px  centroid=({int(xs.mean()*s)},{int(ys.mean()*s)})  "
              f"x=({int(xs.min()*s)},{int(xs.max()*s)})  y=({int(ys.min()*s)},{int(ys.max()*s)})")
    prev = masks[i]

print("\nSmall constant churn on a settled element means it is drifting slightly,")
print("not being redrawn. Cross-check against motion_track.py before concluding.")
