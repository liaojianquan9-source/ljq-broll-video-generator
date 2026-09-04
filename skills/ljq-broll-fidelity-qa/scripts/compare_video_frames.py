#!/usr/bin/env python3
"""Compare source and rendered clips frame by frame after full-resolution decoding."""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFont


def executable(value: str | None, fallback: str) -> str:
    candidate = value or shutil.which(fallback)
    if not candidate:
        raise SystemExit(f"Could not find {fallback}. Pass --{fallback} with its executable path.")
    return str(Path(candidate).resolve())


def decode(ffmpeg: str, video: Path, frames: Path) -> list[Path]:
    if frames.exists() and any(frames.glob("frame-*.png")):
        raise SystemExit(f"Refusing to reuse non-empty frame directory: {frames}")
    frames.mkdir(parents=True, exist_ok=True)
    subprocess.run([
        ffmpeg,
        "-hide_banner", "-loglevel", "error", "-y",
        "-i", str(video),
        "-vsync", "0",
        str(frames / "frame-%06d.png"),
    ], check=True)
    result = sorted(frames.glob("frame-*.png"))
    if not result:
        raise SystemExit(f"No frames decoded from {video}")
    return result


def font(size: int = 16) -> ImageFont.ImageFont:
    try:
        return ImageFont.load_default(size=size)
    except TypeError:
        return ImageFont.load_default()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("render", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--ffmpeg")
    parser.add_argument("--exclude-mask", type=Path, help="Static grayscale mask; white pixels are excluded from visual metrics.")
    args = parser.parse_args()

    source = args.source.resolve()
    render = args.render.resolve()
    if not source.is_file() or not render.is_file():
        raise SystemExit("Both source and render must exist.")
    ffmpeg = executable(args.ffmpeg, "ffmpeg")
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    source_frames = decode(ffmpeg, source, output / "source-frames")
    render_frames = decode(ffmpeg, render, output / "render-frames")
    compared = min(len(source_frames), len(render_frames))
    exclusion_mask = None
    if args.exclude_mask:
        exclusion_mask = Image.open(args.exclude_mask.expanduser().resolve()).convert("L")

    deltas: list[float] = []
    neon_counts: list[int] = []
    dimensions_match = True
    for index in range(compared):
        source_image = Image.open(source_frames[index]).convert("RGB")
        render_image = Image.open(render_frames[index]).convert("RGB")
        if source_image.size != render_image.size:
            dimensions_match = False
            raise SystemExit(f"Dimension mismatch at frame {index}: {source_image.size} vs {render_image.size}")
        source_rgb = np.asarray(source_image, dtype=np.int16)
        render_rgb = np.asarray(render_image, dtype=np.int16)
        included = np.ones(source_rgb.shape[:2], dtype=bool)
        if exclusion_mask is not None:
            if exclusion_mask.size != source_image.size:
                raise SystemExit(f"Exclusion mask size {exclusion_mask.size} does not match video frame {source_image.size}")
            included = np.asarray(exclusion_mask, dtype=np.uint8) < 128
            if not included.any():
                raise SystemExit("Exclusion mask removes every pixel")
        absolute = np.abs(source_rgb - render_rgb)
        deltas.append(float(absolute[included].mean()))
        r, g, b = render_rgb[..., 0], render_rgb[..., 1], render_rgb[..., 2]
        neon = ((r > 185) & (b > 150) & (g < 155)) | ((g > 175) & (b > 180) & (r < 145))
        neon_counts.append(int((neon & included).sum()))

    sample_count = min(10, compared)
    sample_indices = sorted({round(value) for value in np.linspace(0, compared - 1, sample_count)})
    first = Image.open(source_frames[0])
    thumb_width = 480
    thumb_height = round(thumb_width * first.height / first.width)
    label_h = 24
    canvas = Image.new("RGB", (thumb_width * 3, len(sample_indices) * (thumb_height + label_h)), "white")
    draw = ImageDraw.Draw(canvas)
    label_font = font()
    for row, index in enumerate(sample_indices):
        y = row * (thumb_height + label_h)
        left = Image.open(source_frames[index]).convert("RGB").resize((thumb_width, thumb_height), Image.Resampling.LANCZOS)
        right = Image.open(render_frames[index]).convert("RGB").resize((thumb_width, thumb_height), Image.Resampling.LANCZOS)
        draw.text((5, y + 3), f"source f{index:04d}", fill="#111", font=label_font)
        draw.text((thumb_width + 5, y + 3), f"render f{index:04d}  MAD={deltas[index]:.3f}", fill="#111", font=label_font)
        draw.text((thumb_width * 2 + 5, y + 3), "absolute RGB difference", fill="#111", font=label_font)
        canvas.paste(left, (0, y + label_h))
        canvas.paste(right, (thumb_width, y + label_h))
        difference = ImageChops.difference(left, right)
        if exclusion_mask is not None:
            resized_mask = exclusion_mask.resize((thumb_width, thumb_height), Image.Resampling.NEAREST)
            difference.paste(Image.new("RGB", difference.size, "#222222"), mask=resized_mask)
        canvas.paste(difference, (thumb_width * 2, y + label_h))
    canvas.save(output / "comparison.png")

    report = {
        "source": str(source),
        "render": str(render),
        "source_decoded_frames": len(source_frames),
        "render_decoded_frames": len(render_frames),
        "compared_frames": compared,
        "frame_counts_match": len(source_frames) == len(render_frames),
        "dimensions_match": dimensions_match,
        "mean_abs_rgb_delta_average": float(np.mean(deltas)),
        "mean_abs_rgb_delta_worst": max(deltas),
        "worst_delta_frame": int(np.argmax(deltas)),
        "render_neon_pixels_worst": max(neon_counts),
        "worst_neon_frame": int(np.argmax(neon_counts)),
        "excluded_pixels": int((np.asarray(exclusion_mask, dtype=np.uint8) >= 128).sum()) if exclusion_mask is not None else 0,
        "warning": "Sequential comparison assumes aligned decoded frames. Inspect comparison.png and investigate any frame-count mismatch.",
    }
    (output / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
