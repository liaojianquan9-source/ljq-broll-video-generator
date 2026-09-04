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


def probe_video(ffprobe: str, clip: Path) -> dict:
    probe = run_json([
        ffprobe, "-v", "error", "-count_frames",
        "-show_entries", "stream=codec_type,width,height,avg_frame_rate,r_frame_rate,nb_frames,nb_read_frames,duration:format=duration",
        "-of", "json", str(clip),
    ])
    video = next((item for item in probe.get("streams", []) if item.get("codec_type") == "video"), None)
    if not video:
        raise SystemExit(f"No video stream found: {clip}")
    fps_text = video.get("avg_frame_rate") or video.get("r_frame_rate") or "0/1"
    fps = float(Fraction(fps_text))
    duration = float(video.get("duration") or probe.get("format", {}).get("duration") or 0)
    declared = None if video.get("nb_frames") in (None, "N/A") else int(video["nb_frames"])
    decoded = None if video.get("nb_read_frames") in (None, "N/A") else int(video["nb_read_frames"])
    decoded = decoded or declared or round(duration * fps)
    if fps <= 0 or decoded <= 0 or duration <= 0:
        raise SystemExit(f"Could not determine valid video timing: {clip}")
    return {
        "width": int(video["width"]),
        "height": int(video["height"]),
        "fps": fps,
        "duration": duration,
        "declared": declared,
        "decoded": decoded,
        "has_audio": any(item.get("codec_type") == "audio" for item in probe.get("streams", [])),
    }


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
    parser.add_argument("--start-seconds", type=float)
    parser.add_argument("--end-seconds", type=float)
    parser.add_argument("--include", action="append", default=[])
    parser.add_argument("--exclude", action="append", default=[])
    parser.add_argument("--excluded-region-mode", choices=["none", "blank", "transparent", "background"], default="none")
    parser.add_argument("--exclusion-mask")
    parser.add_argument("--scope-confirmation", default="No ambiguity remained after timecode normalization.")
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
    original_probe = probe_video(ffprobe, clip)
    start_seconds = 0.0 if args.start_seconds is None else args.start_seconds
    end_seconds = original_probe["duration"] if args.end_seconds is None else args.end_seconds
    if start_seconds < 0 or end_seconds <= start_seconds or end_seconds > original_probe["duration"] + 1 / original_probe["fps"]:
        raise SystemExit(
            f"Invalid requested range: start={start_seconds:.6f}, end={end_seconds:.6f}, "
            f"source duration={original_probe['duration']:.6f}"
        )
    requested_duration = end_seconds - start_seconds
    if args.exclude and args.excluded_region_mode == "none":
        raise SystemExit("--excluded-region-mode is required when --exclude is used")

    case_directory.mkdir(parents=True, exist_ok=True)
    originals = case_directory / "assets" / "originals"
    evidence_directory = case_directory / "evidence"
    specs_directory = case_directory / "specs"
    remotion_directory = case_directory / "remotion"
    render_directory = case_directory / "render"
    validation_directory = case_directory / "validation"
    for directory in [originals, evidence_directory, specs_directory, remotion_directory, render_directory, validation_directory]:
        directory.mkdir(parents=True, exist_ok=True)

    exclusion_mask_value = None
    if args.exclusion_mask:
        mask_source = Path(args.exclusion_mask).expanduser().resolve()
        if not mask_source.is_file():
            raise SystemExit(f"Exclusion mask does not exist: {mask_source}")
        mask_target = evidence_directory / f"exclusion-mask{mask_source.suffix.lower()}"
        shutil.copy2(mask_source, mask_target)
        exclusion_mask_value = str(mask_target.relative_to(case_directory))

    previous_keyframes = list(evidence_directory.glob("keyframe-*.png"))
    if previous_keyframes and not args.force:
        raise SystemExit(f"Keyframe evidence already exists in {evidence_directory}; use --force only when replacement is intentional.")
    for previous_keyframe in previous_keyframes:
        previous_keyframe.unlink()

    trim_requested = args.start_seconds is not None or args.end_seconds is not None
    local_source = originals / ("reference.mp4" if trim_requested else f"reference{clip.suffix.lower()}")
    if trim_requested:
        subprocess.run([
            ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-i", str(clip),
            "-ss", f"{start_seconds:.9f}", "-t", f"{requested_duration:.9f}",
            "-map", "0:v:0", "-map", "0:a?",
            "-c:v", "libx264", "-preset", "medium", "-crf", "10", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(local_source),
        ], check=True)
    else:
        shutil.copy2(clip, local_source)
    local_probe = probe_video(ffprobe, local_source)
    fps = local_probe["fps"]
    duration = local_probe["duration"]
    declared = local_probe["declared"]
    decoded = local_probe["decoded"]
    has_audio = local_probe["has_audio"]
    expected_frames = round(requested_duration * fps)
    if abs(decoded - expected_frames) > 1:
        raise SystemExit(
            f"Trimmed clip frame count differs from requested duration by more than one frame: "
            f"expected={expected_frames}, decoded={decoded}"
        )
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
        "schemaVersion": "1.2",
        "sourcePath": str(clip),
        "originalSha256": sha256(clip),
        "originalBytes": clip.stat().st_size,
        "caseLocalSource": str(local_source.relative_to(case_directory)),
        "sha256": digest,
        "bytes": local_source.stat().st_size,
        "width": local_probe["width"],
        "height": local_probe["height"],
        "fps": fps,
        "durationSeconds": duration,
        "declaredFrames": declared,
        "decodedFrames": decoded,
        "hasAudio": has_audio,
        "scope": {
            "startSeconds": start_seconds,
            "endSeconds": end_seconds,
            "durationSeconds": requested_duration,
            "include": args.include,
            "exclude": args.exclude,
            "excludedRegionMode": args.excluded_region_mode,
            "exclusionMask": exclusion_mask_value,
            "confirmation": args.scope_confirmation,
        },
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
        "schemaVersion": "1.2",
        "caseId": case_id,
        "status": "in_progress",
        "source": {
            "path": str(clip),
            "bytes": local_source.stat().st_size,
            "modifiedTime": modified,
            "sha256": digest,
            "width": local_probe["width"],
            "height": local_probe["height"],
            "fps": fps,
            "durationSeconds": duration,
            "declaredFrames": declared,
            "decodedFrames": decoded,
            "shotRange": [0, decoded - 1],
            "hasAudio": has_audio,
        },
        "scope": {
            "startSeconds": start_seconds,
            "endSeconds": end_seconds,
            "durationSeconds": requested_duration,
            "include": args.include,
            "exclude": args.exclude,
            "excludedRegionMode": args.excluded_region_mode,
            "exclusionMask": exclusion_mask_value,
            "confirmation": args.scope_confirmation,
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
            "qaGates": None,
        },
        "iteration": {"maxCorrections": 2, "correctionsUsed": 0, "lastRootCause": None},
        "knownDifferences": [],
    }
    (case_directory / "case.json").write_text(json.dumps(case_state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"caseDirectory": str(case_directory), "caseId": case_id, "decodedFrames": decoded, "keyframes": frame_numbers}, ensure_ascii=False))


if __name__ == "__main__":
    main()
