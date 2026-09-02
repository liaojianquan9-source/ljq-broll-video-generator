#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 2 ]; then
  echo "Usage: render-video.sh <scene.json> <output.mp4>" >&2
  exit 2
fi

script_dir="$(cd "$(dirname "$0")" && pwd)"
renderer_dir="$(cd "$script_dir/../assets/remotion-renderer" && pwd)"
scene_path="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"

if [ ! -f "$scene_path" ]; then
  echo "Scene not found: $scene_path" >&2
  exit 2
fi

mkdir -p "$(dirname "$2")"
output_path="$(cd "$(dirname "$2")" && pwd)/$(basename "$2")"
output_stem="${output_path%.*}"
qa_dir="${output_stem}.qa"
mkdir -p "$qa_dir"

node "$script_dir/validate-scene.mjs" "$scene_path"
node "$script_dir/stage-scene.mjs" \
  "$scene_path" \
  "$renderer_dir/public" \
  "$qa_dir/staged-scene.json"
node "$script_dir/validate-scene.mjs" "$qa_dir/staged-scene.json"

if [ ! -d "$renderer_dir/node_modules" ]; then
  npm install --prefix "$renderer_dir" --no-audit --no-fund
fi

browser_path="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
render_args=(render src/index.ts LjqBrollVideo "$output_path" --props="$qa_dir/staged-scene.json" --codec=h264 --concurrency=1)

cd "$renderer_dir"
if [ -x "$browser_path" ]; then
  npx remotion "${render_args[@]}" --browser-executable="$browser_path"
else
  npx remotion "${render_args[@]}"
fi

ffprobe -v error -show_format -show_streams -of json "$output_path" > "$qa_dir/ffprobe.json"
duration="$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$output_path")"
middle_time="$(awk -v value="$duration" 'BEGIN { printf "%.3f", value / 2 }')"
sample_rate="$(awk -v value="$duration" 'BEGIN { printf "%.8f", 12 / value }')"

ffmpeg -y -v error -ss 0 -i "$output_path" -frames:v 1 "$qa_dir/start.png"
ffmpeg -y -v error -ss "$middle_time" -i "$output_path" -frames:v 1 "$qa_dir/middle.png"
ffmpeg -y -v error -sseof -0.1 -i "$output_path" -frames:v 1 "$qa_dir/end.png"
ffmpeg -y -v error -i "$output_path" \
  -vf "fps=${sample_rate},scale=320:180:force_original_aspect_ratio=decrease,pad=320:180:-1:-1:color=black,tile=4x3" \
  -frames:v 1 "$qa_dir/contact-sheet.png"

echo "Rendered video: $output_path"
echo "Quality pack: $qa_dir"
