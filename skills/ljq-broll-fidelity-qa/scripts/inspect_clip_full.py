#!/usr/bin/env python3
"""Inspect a reference clip at full resolution and produce reusable QA evidence."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import shutil
import subprocess
from fractions import Fraction
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont


def executable(value: str | None, fallback: str) -> str:
    candidate = value or shutil.which(fallback)
    if not candidate:
        raise SystemExit(f"Could not find {fallback}. Pass --{fallback} with its executable path.")
    return str(Path(candidate).resolve())


def run_json(command: list[str]) -> dict:
    result = subprocess.run(command, check=True, capture_output=True, text=True, encoding="utf-8")
    return json.loads(result.stdout)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


def font(size: int = 16) -> ImageFont.ImageFont:
    try:
        return ImageFont.load_default(size=size)
    except TypeError:
        return ImageFont.load_default()


def make_sheet(frame_paths: list[Path], indices: list[int], output: Path, width: int, height: int) -> None:
    cols = 5
    rows = (len(indices) + cols - 1) // cols
    margin, label_h = 10, 24
    canvas = Image.new(
        "RGB",
        (cols * (width + margin) + margin, rows * (height + label_h + margin) + margin),
        "#e8e4dc",
    )
    draw = ImageDraw.Draw(canvas)
    label_font = font()
    for pos, index in enumerate(indices):
        image = Image.open(frame_paths[index]).convert("RGB")
        image.thumbnail((width, height), Image.Resampling.LANCZOS)
        x = margin + (pos % cols) * (width + margin)
        y = margin + (pos // cols) * (height + label_h + margin)
        draw.text((x, y), f"f{index:04d}", fill="#111111", font=label_font)
        canvas.paste(image, (x, y + label_h))
    canvas.save(output)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("clip", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--ffmpeg")
    parser.add_argument("--ffprobe")
    parser.add_argument("--sample-step", type=int)
    args = parser.parse_args()

    clip = args.clip.resolve()
    if not clip.is_file():
        raise SystemExit(f"Clip does not exist: {clip}")
    ffmpeg = executable(args.ffmpeg, "ffmpeg")
    ffprobe = executable(args.ffprobe, "ffprobe")
    output = args.output.resolve()
    frames_dir = output / "frames-full"
    if frames_dir.exists() and any(frames_dir.glob("frame-*.png")):
        raise SystemExit(f"Refusing to reuse non-empty frame directory: {frames_dir}")
    frames_dir.mkdir(parents=True, exist_ok=True)

    probe = run_json([
        ffprobe,
        "-v", "error",
        "-count_frames",
        "-show_entries",
        "stream=index,codec_type,codec_name,width,height,r_frame_rate,avg_frame_rate,nb_frames,nb_read_frames,duration:format=duration,size",
        "-of", "json",
        str(clip),
    ])
    video_stream = next((stream for stream in probe.get("streams", []) if stream.get("codec_type") == "video"), None)
    if not video_stream:
        raise SystemExit("No video stream found.")

    subprocess.run([
        ffmpeg,
        "-hide_banner", "-loglevel", "error", "-y",
        "-i", str(clip),
        "-vsync", "0",
        str(frames_dir / "frame-%06d.png"),
    ], check=True)
    frame_paths = sorted(frames_dir.glob("frame-*.png"))
    if not frame_paths:
        raise SystemExit("FFmpeg decoded no frames.")

    fps_text = video_stream.get("r_frame_rate") or video_stream.get("avg_frame_rate") or "0/1"
    fps = float(Fraction(fps_text))
    duration = float(video_stream.get("duration") or probe.get("format", {}).get("duration") or 0)
    width = int(video_stream["width"])
    height = int(video_stream["height"])
    decoded = len(frame_paths)
    declared = int(video_stream["nb_frames"]) if video_stream.get("nb_frames") not in (None, "N/A") else None
    read_frames = int(video_stream["nb_read_frames"]) if video_stream.get("nb_read_frames") not in (None, "N/A") else None
    timeline_frames = round(duration * fps) if duration and fps else declared or decoded

    sample_step = args.sample_step or max(1, decoded // 30)
    sampled = list(range(0, decoded, sample_step))
    if sampled[-1] != decoded - 1:
        sampled.append(decoded - 1)
    make_sheet(frame_paths, sampled, output / "contact.png", 384, round(384 * height / width))

    row_total = np.zeros(height, dtype=np.int64)
    row_peak = np.zeros(height, dtype=np.int64)
    chroma_scores: list[tuple[int, int, int]] = []
    motion_scores: list[tuple[float, int]] = []
    previous = None
    for index, frame_path in enumerate(frame_paths):
        image = Image.open(frame_path).convert("RGB")
        rgb = np.asarray(image, dtype=np.int16)
        r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
        neon = ((r > 185) & (b > 150) & (g < 155)) | ((g > 175) & (b > 180) & (r < 145))
        counts = neon.sum(axis=1)
        row_total += counts
        row_peak = np.maximum(row_peak, counts)
        chroma_scores.append((int(neon.sum()), int(counts.max()), index))
        small = np.asarray(image.resize((320, 180), Image.Resampling.BILINEAR).convert("L"), dtype=np.int16)
        if previous is not None:
            motion_scores.append((float(np.abs(small - previous).mean()), index))
        previous = small

    chroma_scores.sort(reverse=True)
    motion_scores.sort(reverse=True)
    with (output / "frame-chroma.csv").open("w", newline="", encoding="utf-8") as stream:
        writer = csv.writer(stream)
        writer.writerow(["frame", "time", "neon_pixels", "max_neon_pixels_in_row"])
        for count, row_max, index in chroma_scores:
            writer.writerow([index, f"{index / fps:.6f}" if fps else "", count, row_max])
    with (output / "row-chroma.csv").open("w", newline="", encoding="utf-8") as stream:
        writer = csv.writer(stream)
        writer.writerow(["row", "mean_neon_pixels", "peak_neon_pixels"])
        for row, (total, peak) in enumerate(zip(row_total, row_peak)):
            writer.writerow([row, f"{total / decoded:.6f}", int(peak)])
    with (output / "motion.csv").open("w", newline="", encoding="utf-8") as stream:
        writer = csv.writer(stream)
        writer.writerow(["frame", "time", "mean_abs_luma_delta"])
        for delta, index in motion_scores:
            writer.writerow([index, f"{index / fps:.6f}" if fps else "", f"{delta:.6f}"])

    chroma_frames = sorted({index for _, _, index in chroma_scores[:20]})
    make_sheet(frame_paths, chroma_frames, output / "chroma-candidates.png", 384, round(384 * height / width))
    motion_frames = sorted(
        {max(0, index - 1) for _, index in motion_scores[:12]} | {index for _, index in motion_scores[:12]}
    )
    make_sheet(frame_paths, motion_frames, output / "motion-candidates.png", 384, round(384 * height / width))

    top_rows = sorted(
        ((float(total / decoded), int(peak), row) for row, (total, peak) in enumerate(zip(row_total, row_peak))),
        reverse=True,
    )[:12]
    report = {
        "source": str(clip),
        "sha256": sha256(clip),
        "bytes": clip.stat().st_size,
        "width": width,
        "height": height,
        "fps": fps,
        "duration_seconds": duration,
        "declared_frames": declared,
        "ffprobe_read_frames": read_frames,
        "decoded_png_frames": decoded,
        "suggested_timeline_frames": timeline_frames,
        "frame_count_mismatch": len({value for value in (declared, read_frames, decoded) if value is not None}) > 1,
        "top_motion_frames": [{"frame": index, "score": delta} for delta, index in motion_scores[:12]],
        "top_chroma_frames": [
            {"frame": index, "neon_pixels": count, "max_row_pixels": row_max}
            for count, row_max, index in chroma_scores[:12]
        ],
        "top_chroma_rows": [
            {"row": row, "mean_neon_pixels": mean, "peak_neon_pixels": peak}
            for mean, peak, row in top_rows
        ],
        "warning": "Chroma results are candidates, not proof. Inspect full-resolution frames; intentional saturated artwork can score highly.",
    }
    (output / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
