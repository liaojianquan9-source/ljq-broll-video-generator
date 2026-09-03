#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: extract-analysis-frames.sh <case-directory>" >&2
  exit 2
fi

case_dir="$(cd "$1" && pwd)"
source_rel="$(node -e 'const c=require(process.argv[1]); process.stdout.write(c.files.source)' "$case_dir/case.json")"
source_file="$case_dir/$source_rel"
frames_dir="$case_dir/evidence/motion/frames-full"

if [ ! -f "$source_file" ]; then
  echo "Case-local source does not exist: $source_file" >&2
  exit 1
fi
if [ -d "$frames_dir" ] && find "$frames_dir" -name 'frame-*.png' -print -quit | grep -q .; then
  echo "Analysis frames already exist: $frames_dir"
  exit 0
fi

mkdir -p "$frames_dir"
ffmpeg -hide_banner -loglevel error -i "$source_file" -fps_mode passthrough "$frames_dir/frame-%06d.png"
echo "Decoded analysis frames: $frames_dir"
