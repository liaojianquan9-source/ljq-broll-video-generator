"""
How is a straight stroke revealed -- wiped, or faded?

    python edge_trace.py FRAMES_DIR --edge 1497,322,470,143 \
        --exclude 1497,322 --exclude 470,143 --from 60 --to 160 --mode intensity

--edge is x0,y0,x1,y1 in the coordinate space of the frames in FRAMES_DIR.
Use FULL-RESOLUTION frames: a 2px line does not survive downscaling.

TWO TRAPS

1. Mask out the endpoints with --exclude. Connector lines terminate in a
   coloured dot; sampling with any tolerance lights up the first positions from
   frame zero and the line appears to start at the pin when it does not.

2. Occupancy alone cannot distinguish a wipe from a fade -- use
   --mode intensity.
     wipe : sharp step, e.g. 444333000000, boundary marches along
     fade : every position rises together, 0 -> 2 -> 3 -> 4 -> 5
   A fade crossing the visibility threshold at different points (wherever the
   backdrop is darkest) shows up as disconnected fragments appearing mid-edge,
   which is easily misread as a stroke starting in the middle of nowhere.
"""
import argparse
import glob
import os

import numpy as np
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument("frames")
ap.add_argument("--edge", required=True, metavar="x0,y0,x1,y1")
ap.add_argument("--exclude", action="append", default=[], metavar="x,y",
                help="mask a radius around this point (repeat per endpoint dot)")
ap.add_argument("--exclude-radius", type=int, default=34)
ap.add_argument("--samples", type=int, default=64)
ap.add_argument("--win", type=int, default=4, help="half-size of the sampling window")
ap.add_argument("--mode", choices=["occupancy", "intensity"], default="intensity")
ap.add_argument("--from", dest="f0", type=int, default=0, help="first frame INDEX")
ap.add_argument("--to", dest="f1", type=int, default=10**9)
ap.add_argument("--step", type=int, default=2)
ap.add_argument("--frame0", type=int, default=0, help="frame number of the first file")
ap.add_argument("--frame-step", type=int, default=1, help="frame stride between files")
ap.add_argument("--colour", default="red")
a = ap.parse_args()

files = sorted(glob.glob(os.path.join(a.frames, "*.png")))
if not files:
    raise SystemExit(f"no PNGs in {a.frames}")
x0, y0, x1, y1 = (int(v) for v in a.edge.split(","))
skips = [tuple(int(v) for v in s.split(",")) for s in a.exclude]


def ink(img):
    r, g, b = img[..., 0], img[..., 1], img[..., 2]
    if a.colour == "red":
        return (r > 95) & (r - g > 60) & (r - b > 50), r - np.maximum(g, b)
    if a.colour == "white":
        m = np.minimum(np.minimum(r, g), b)
        return m > 170, m
    raise SystemExit("colour must be red or white")


DIG = "0123456789"
print(f"edge ({x0},{y0}) -> ({x1},{y1});  left = first endpoint, 'x' = masked")
if not skips:
    print("WARNING: no --exclude given. If either end has a coloured dot, the")
    print("         reading at that end is the dot, not the stroke.")

for idx, path in enumerate(files):
    fn = a.frame0 + idx * a.frame_step
    if not (a.f0 <= fn <= a.f1) or (idx % max(1, a.step // a.frame_step)):
        continue
    img = np.asarray(Image.open(path).convert("RGB")).astype(np.int16)
    mask, score = ink(img)
    row = ""
    for k in range(a.samples):
        t = k / (a.samples - 1)
        x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
        if any((x - px) ** 2 + (y - py) ** 2 < a.exclude_radius ** 2 for px, py in skips):
            row += "x"
            continue
        ys, xs = slice(int(y) - a.win, int(y) + a.win + 1), slice(int(x) - a.win, int(x) + a.win + 1)
        if a.mode == "occupancy":
            row += "#" if mask[ys, xs].any() else "."
        else:
            row += DIG[min(9, max(0, int(score[ys, xs].max() / 14)))]
    print(f"  f{fn:4d} {row}")
