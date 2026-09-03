#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 1 ] || [ "$#" -gt 2 ]; then
  echo "Usage: render-case.sh <case-directory> [output.mp4]" >&2
  exit 2
fi

script_dir="$(cd "$(dirname "$0")" && pwd)"
skill_dir="$(cd "$script_dir/.." && pwd)"
renderer_dir="$skill_dir/assets/remotion-renderer"
case_dir="$(cd "$1" && pwd)"
if [ "$#" -eq 2 ]; then
  if [[ "$2" = /* ]]; then
    output_arg="$2"
  else
    output_arg="$case_dir/$2"
  fi
else
  output_arg="$case_dir/render/final.mp4"
fi
mkdir -p "$(dirname "$output_arg")"
output_path="$(cd "$(dirname "$output_arg")" && pwd)/$(basename "$output_arg")"

node "$script_dir/initialize-case-remotion.mjs" "$case_dir"
node "$script_dir/validate-case.mjs" "$case_dir"
node "$script_dir/stage-case-assets.mjs" "$case_dir"

if [ ! -d "$renderer_dir/node_modules" ]; then
  (cd "$renderer_dir" && npm ci --ignore-scripts)
fi
if [ ! -e "$case_dir/remotion/node_modules" ]; then
  ln -s "$renderer_dir/node_modules" "$case_dir/remotion/node_modules"
fi

browser_path="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
render_args=(render "$case_dir/remotion/composition.tsx" LjqBrollCase "$output_path" --codec=h264 --concurrency=1 --public-dir="$case_dir/remotion/public")
has_audio="$(node -e 'const c=require(process.argv[1]); process.stdout.write(String(c.source.hasAudio))' "$case_dir/case.json")"
if [ "$has_audio" != "true" ]; then
  render_args+=(--muted)
fi
if [ -x "$browser_path" ]; then
  render_args+=(--browser-executable="$browser_path")
fi

(cd "$renderer_dir" && NODE_PATH="$renderer_dir/node_modules" npx remotion "${render_args[@]}")
node "$script_dir/mark-rendered.mjs" "$case_dir" "$output_path"
node "$script_dir/validate-case.mjs" "$case_dir"
echo "Rendered case: $output_path"
