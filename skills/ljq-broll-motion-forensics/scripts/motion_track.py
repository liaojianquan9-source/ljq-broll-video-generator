"""
Per-region motion tracking by phase correlation, subpixel.

    python motion_track.py FRAMES_DIR --ref 100 \
        --region bg-prop:400,100,540,200 \
        --region card-a:130,120,330,240

FRAMES_DIR holds numbered PNGs. Region boxes are x0,y0,x1,y1 in the coordinate
space of those frames; pass --scale 2 if they are half-size and you want the
numbers reported at full resolution.

Only track regions with real texture. A flat gradient cannot be locked onto and
the failure looks like large motion, not like an error.

An excursion that coincides with something passing over the region is occlusion.
Check the frame before believing the number.
"""
import argparse
import glob
import os

import numpy as np
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument("frames")
ap.add_argument("--ref", type=int, default=0, help="reference frame index")
ap.add_argument("--region", action="append", default=[], metavar="NAME:x0,y0,x1,y1")
ap.add_argument("--scale", type=float, default=2.0, help="multiply results by this")
ap.add_argument("--step", type=int, default=1)
ap.add_argument("--rotation", action="append", default=[], metavar="NAME:boxA/boxB",
                help="two boxes on one object, e.g. card:130,120,330,240/280,180,360,250")
a = ap.parse_args()

files = sorted(glob.glob(os.path.join(a.frames, "*.png")))
if not files:
    raise SystemExit(f"no PNGs in {a.frames}")
g = [np.asarray(Image.open(f).convert("L")).astype(np.float64) for f in files]
print(f"{len(g)} frames, {g[0].shape[1]}x{g[0].shape[0]}, reference = f{a.ref}")


def shift_of(p, q):
    """Translation of q relative to p."""
    win = np.outer(np.hanning(p.shape[0]), np.hanning(p.shape[1]))
    P = np.fft.fft2((p - p.mean()) * win)
    Q = np.fft.fft2((q - q.mean()) * win)
    R = P * np.conj(Q)
    m = np.abs(R)
    m[m == 0] = 1e-12
    r = np.fft.ifft2(R / m).real
    py, px = np.unravel_index(np.argmax(r), r.shape)

    def sub(c, i, n):
        lo, hi = c[(i - 1) % n], c[(i + 1) % n]
        d = 2 * (lo - 2 * c[i] + hi)
        return 0.0 if d == 0 else (lo - hi) / d

    dy = py + sub(r[:, px], py, r.shape[0])
    dx = px + sub(r[py, :], px, r.shape[1])
    if dy > r.shape[0] / 2:
        dy -= r.shape[0]
    if dx > r.shape[1] / 2:
        dx -= r.shape[1]
    return dy, dx


def parse_box(s):
    return [int(v) for v in s.split(",")]


if a.region:
    print("\n=== translation ===")
for spec in a.region:
    name, box = spec.split(":", 1)
    x0, y0, x1, y1 = parse_box(box)
    ref = g[a.ref][y0:y1, x0:x1]
    xs, ys = [], []
    for i in range(a.ref, len(g), a.step):
        dy, dx = shift_of(ref, g[i][y0:y1, x0:x1])
        xs.append(dx * a.scale)
        ys.append(dy * a.scale)
    xs, ys = np.array(xs), np.array(ys)
    print(f"\n{name:20s} dx [{xs.min():+7.2f},{xs.max():+7.2f}]  "
          f"dy [{ys.min():+7.2f},{ys.max():+7.2f}]  "
          f"peak-to-peak {max(np.ptp(xs), np.ptp(ys)):.2f}px")
    print("   dx: " + " ".join(f"{v:+5.1f}" for v in xs[:: max(1, len(xs) // 16)]))
    print("   dy: " + " ".join(f"{v:+5.1f}" for v in ys[:: max(1, len(ys) // 16)]))

if a.rotation:
    print("\n=== rotation (angle between two patches on one object) ===")
for spec in a.rotation:
    name, boxes = spec.split(":", 1)
    ba, bb = (parse_box(b) for b in boxes.split("/"))
    cax, cay = (ba[0] + ba[2]) / 2, (ba[1] + ba[3]) / 2
    cbx, cby = (bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2
    base = np.degrees(np.arctan2(cby - cay, cbx - cax))
    angs, near, far = [], [], []
    for i in range(a.ref, len(g), max(a.step, 4)):
        va = shift_of(g[a.ref][ba[1]:ba[3], ba[0]:ba[2]], g[i][ba[1]:ba[3], ba[0]:ba[2]])
        vb = shift_of(g[a.ref][bb[1]:bb[3], bb[0]:bb[2]], g[i][bb[1]:bb[3], bb[0]:bb[2]])
        angs.append(np.degrees(np.arctan2((cby + vb[0]) - (cay + va[0]),
                                          (cbx + vb[1]) - (cax + va[1]))) - base)
        near.append(np.hypot(*va) * a.scale)
        far.append(np.hypot(*vb) * a.scale)
    angs = np.array(angs)
    ratio = max(far) / max(max(near), 1e-6)
    print(f"\n{name:20s} rotation [{angs.min():+.2f}, {angs.max():+.2f}] deg  "
          f"peak-to-peak {np.ptp(angs):.2f} deg")
    print(f"{'':20s} displacement: patchA {max(near):.1f}px  patchB {max(far):.1f}px  "
          f"ratio {ratio:.2f}")
    print(f"{'':20s} ratio well above 1 => rotating about a pivot near patch A,")
    print(f"{'':20s} ratio near 1       => translating, not rotating")
    print("   angle: " + " ".join(f"{v:+.2f}" for v in angs[:: max(1, len(angs) // 14)]))
