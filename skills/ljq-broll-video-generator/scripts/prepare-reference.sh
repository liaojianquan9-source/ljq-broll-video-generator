#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 2 ]; then
  echo "Usage: prepare-reference.sh <reference-video> <analysis-directory>" >&2
  exit 2
fi

reference_video="$1"
analysis_dir="$2"

if [ ! -f "$reference_video" ]; then
  echo "Reference video not found: $reference_video" >&2
  exit 2
fi

mkdir -p "$analysis_dir/frames"

ffprobe -v error -show_format -show_streams -of json "$reference_video" > "$analysis_dir/metadata.json"

duration="$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$reference_video")"
if ! awk -v value="$duration" 'BEGIN { exit !(value > 0) }'; then
  echo "Could not determine a positive video duration" >&2
  exit 1
fi

middle_time="$(awk -v value="$duration" 'BEGIN { printf "%.3f", value / 2 }')"
end_time="$(awk -v value="$duration" 'BEGIN { result = value - 0.05; if (result < 0) result = 0; printf "%.3f", result }')"
sample_rate="$(awk -v value="$duration" 'BEGIN { printf "%.8f", 12 / value }')"

ffmpeg -y -v error -ss 0 -i "$reference_video" -frames:v 1 "$analysis_dir/start.png"
ffmpeg -y -v error -ss "$middle_time" -i "$reference_video" -frames:v 1 "$analysis_dir/middle.png"
ffmpeg -y -v error -ss "$end_time" -i "$reference_video" -frames:v 1 "$analysis_dir/end.png"

ffmpeg -y -v error -i "$reference_video" \
  -vf "fps=6,scale=960:-2:force_original_aspect_ratio=decrease" \
  "$analysis_dir/frames/%05d.png"

ffmpeg -y -v error -i "$reference_video" \
  -vf "fps=${sample_rate},scale=480:270:force_original_aspect_ratio=decrease,pad=480:270:-1:-1:color=black,tile=4x3" \
  -frames:v 1 "$analysis_dir/contact-sheet.png"

echo "Prepared reference analysis: $analysis_dir"
echo "  metadata.json"
echo "  start.png / middle.png / end.png"
echo "  contact-sheet.png"
echo "  frames/ at 6 fps"
