#!/usr/bin/env python3
"""Freeze a video source into a portable B-roll case and create keyframe evidence."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import subprocess
from datetime import datetime
from fractions import Fraction
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def executable(name: str) -> str:
    result = shutil.which(name)
    if not result:
        raise SystemExit(f"Missing required command: {name}")
    return result


def run_json(command: list[str]) -> dict:
    result = subprocess.run(command, check=True, capture_output=True, text=True, encoding="utf-8")
    return json.loads(result.stdout)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "broll-case"


def draw_contact_sheet(frame_paths: list[Path], frame_numbers: list[int], destination: Path) -> None:
    opened = [Image.open(item).convert("RGB") for item in frame_paths]
    thumb_width = 420
    thumb_height = round(thumb_width * opened[0].height / opened[0].width)
    margin = 16
    label_height = 28
    columns = min(3, len(opened))
    rows = (len(opened) + columns - 1) // columns
    canvas = Image.new("RGB", (margin + columns * (thumb_width + margin), margin + rows * (thumb_height + label_height + margin)), "#161616")
    draw = ImageDraw.Draw(canvas)
    font = ImageFont.load_default()
    for index, image in enumerate(opened):
        image.thumbnail((thumb_width, thumb_height), Image.Resampling.LANCZOS)
        left = margin + (index % columns) * (thumb_width + margin)
        top = margin + (index // columns) * (thumb_height + label_height + margin)
        draw.text((left, top), f"source frame {frame_numbers[index]}", fill="white", font=font)
        canvas.paste(image, (left, top + label_height))
    canvas.save(destination)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("clip", type=Path)
    parser.add_argument("case_directory", type=Path)
    parser.add_argument("--case-id")
    parser.add_argument("--keyframe", type=int, action="append", default=[])
    parser.add_argument("--force", action="store_true", help="replace an existing generated case.json")
    args = parser.parse_args()

    clip = args.clip.expanduser().resolve()
    case_directory = args.case_directory.expanduser().resolve()
    if not clip.is_file():
        raise SystemExit(f"Source video does not exist: {clip}")
    if (case_directory / "case.json").exists() and not args.force:
        raise SystemExit(f"Case already exists: {case_directory}. Use --force only when replacement is intentional.")

    ffmpeg = executable("ffmpeg")
    ffprobe = executable("ffprobe")
    probe = run_json([
        ffprobe, "-v", "error", "-count_frames",
        "-show_entries", "stream=codec_type,width,height,avg_frame_rate,r_frame_rate,nb_frames,nb_read_frames,duration:format=duration",
        "-of", "json", str(clip),
    ])
    video = next((item for item in probe.get("streams", []) if item.get("codec_type") == "video"), None)
    if not video:
        raise SystemExit("No video stream found in the source.")
    has_audio = any(item.get("codec_type") == "audio" for item in probe.get("streams", []))
    fps_text = video.get("avg_frame_rate") or video.get("r_frame_rate") or "0/1"
    fps = float(Fraction(fps_text))
    if fps <= 0:
        raise SystemExit("Could not determine a positive video fps.")
    duration = float(video.get("duration") or probe.get("format", {}).get("duration") or 0)
    declared = None if video.get("nb_frames") in (None, "N/A") else int(video["nb_frames"])
    decoded = None if video.get("nb_read_frames") in (None, "N/A") else int(video["nb_read_frames"])
    decoded = decoded or declared or round(duration * fps)
    if decoded <= 0 or duration <= 0:
        raise SystemExit("Could not determine the source duration and decoded frame count.")

    case_directory.mkdir(parents=True, exist_ok=True)
    originals = case_directory / "assets" / "originals"
    evidence_directory = case_directory / "evidence"
    specs_directory = case_directory / "specs"
    remotion_directory = case_directory / "remotion"
    render_directory = case_directory / "render"
    validation_directory = case_directory / "validation"
    for directory in [originals, evidence_directory, specs_directory, remotion_directory, render_directory, validation_directory]:
        directory.mkdir(parents=True, exist_ok=True)

    previous_keyframes = list(evidence_directory.glob("keyframe-*.png"))
    if previous_keyframes and not args.force:
        raise SystemExit(f"Keyframe evidence already exists in {evidence_directory}; use --force only when replacement is intentional.")
    for previous_keyframe in previous_keyframes:
        previous_keyframe.unlink()

    local_source = originals / f"reference{clip.suffix.lower()}"
    shutil.copy2(clip, local_source)
    digest = sha256(local_source)
    modified = datetime.fromtimestamp(clip.stat().st_mtime).astimezone().isoformat()

    requested = args.keyframe or [0, round((decoded - 1) * 0.25), round((decoded - 1) * 0.5), round((decoded - 1) * 0.75), decoded - 1]
    frame_numbers = sorted(set(max(0, min(decoded - 1, item)) for item in requested))
    selection = "+".join(f"eq(n\\,{item})" for item in frame_numbers)
    frame_pattern = evidence_directory / "keyframe-%03d.png"
    subprocess.run([
        ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-i", str(local_source),
        "-vf", f"select={selection}", "-fps_mode", "vfr", str(frame_pattern),
    ], check=True)
    frame_paths = sorted(evidence_directory.glob("keyframe-*.png"))
    if len(frame_paths) != len(frame_numbers):
        raise SystemExit(f"Expected {len(frame_numbers)} keyframes but FFmpeg produced {len(frame_paths)}.")
    draw_contact_sheet(frame_paths, frame_numbers, evidence_directory / "contact-sheet.png")

    source_evidence = {
        "schemaVersion": "1.1",
        "sourcePath": str(clip),
        "caseLocalSource": str(local_source.relative_to(case_directory)),
        "sha256": digest,
        "bytes": local_source.stat().st_size,
        "width": int(video["width"]),
        "height": int(video["height"]),
        "fps": fps,
        "durationSeconds": duration,
        "declaredFrames": declared,
        "decodedFrames": decoded,
        "hasAudio": has_audio,
        "keyframes": [
            {"frame": frame, "timeSeconds": frame / fps, "file": str(path.relative_to(case_directory))}
            for frame, path in zip(frame_numbers, frame_paths)
        ],
        "contactSheet": "evidence/contact-sheet.png",
        "note": "Keyframes are evidence candidates. The layout stage must choose the settled frame by inspecting the full-resolution stills.",
    }
    (evidence_directory / "source.json").write_text(json.dumps(source_evidence, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    case_id = slugify(args.case_id or clip.stem)
    case_state = {
        "schemaVersion": "1.1",
        "caseId": case_id,
        "status": "in_progress",
        "source": {
            "path": str(clip),
            "bytes": local_source.stat().st_size,
            "modifiedTime": modified,
            "sha256": digest,
            "width": int(video["width"]),
            "height": int(video["height"]),
            "fps": fps,
            "durationSeconds": duration,
            "declaredFrames": declared,
            "decodedFrames": decoded,
            "shotRange": [0, decoded - 1],
            "hasAudio": has_audio,
        },
        "stages": {"preflight": "passed", "layout": "pending", "motion": "pending", "implementation": "pending", "qa": "pending"},
        "files": {
            "source": str(local_source.relative_to(case_directory)),
            "sourceEvidence": "evidence/source.json",
            "layout": None,
            "motion": None,
            "validation": None,
            "composition": None,
            "propsSchema": None,
            "render": None,
        },
        "iteration": {"maxCorrections": 2, "correctionsUsed": 0, "lastRootCause": None},
        "knownDifferences": [],
    }
    (case_directory / "case.json").write_text(json.dumps(case_state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"caseDirectory": str(case_directory), "caseId": case_id, "decodedFrames": decoded, "keyframes": frame_numbers}, ensure_ascii=False))


if __name__ == "__main__":
    main()
