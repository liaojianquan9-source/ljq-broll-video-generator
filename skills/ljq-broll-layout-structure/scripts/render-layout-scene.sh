#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo "Usage: render-layout-scene.sh <case-directory> <scene-id> [--pass] [--observation text]" >&2
  exit 2
fi

script_dir="$(cd "$(dirname "$0")" && pwd)"
layout_skill_dir="$(cd "$script_dir/.." && pwd)"
master_dir="$(cd "$layout_skill_dir/../ljq-broll-replica" && pwd)"
renderer_dir="$master_dir/assets/remotion-renderer"
case_dir="$(cd "$1" && pwd)"
scene_id="$2"
status="needs_review"
observation="Settled still requires visual review."
shift 2
while [ "$#" -gt 0 ]; do
  case "$1" in
    --pass) status="passed"; shift ;;
    --observation) observation="$2"; shift 2 ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
done

frame="$(node -e 'const l=require(process.argv[1]); const s=l.scenes?.find(x=>x.id===process.argv[2]); if(!s) process.exit(2); process.stdout.write(String(s.settledFrame.frame))' "$case_dir/specs/layout.json" "$scene_id")"
evidence_dir="$case_dir/evidence/layout"
source_still="$evidence_dir/$scene_id-source.png"
render_still="$evidence_dir/$scene_id-render.png"
comparison_still="$evidence_dir/$scene_id-comparison.png"
mkdir -p "$evidence_dir"

node "$master_dir/scripts/initialize-case-remotion.mjs" "$case_dir"
node "$master_dir/scripts/stage-case-assets.mjs" "$case_dir"
if [ ! -d "$renderer_dir/node_modules" ]; then
  (cd "$renderer_dir" && npm ci --ignore-scripts)
fi
if [ ! -e "$case_dir/remotion/node_modules" ]; then
  ln -s "$renderer_dir/node_modules" "$case_dir/remotion/node_modules"
fi

ffmpeg -hide_banner -loglevel error -y -i "$case_dir/$(node -e 'const c=require(process.argv[1]); process.stdout.write(c.files.source)' "$case_dir/case.json")" -vf "select=eq(n\,$frame)" -frames:v 1 "$source_still"
render_args=(still "$case_dir/remotion/composition.tsx" LjqBrollCase "$render_still" --frame="$frame" --public-dir="$case_dir/remotion/public")
browser_path="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
if [ -x "$browser_path" ]; then
  render_args+=(--browser-executable="$browser_path")
fi
(cd "$renderer_dir" && NODE_PATH="$renderer_dir/node_modules" npx remotion "${render_args[@]}")
"$master_dir/.venv/bin/python" "$script_dir/compare_stills.py" "$source_still" "$render_still" "$comparison_still"

node - "$case_dir/specs/layout.json" "$scene_id" "$status" "$observation" "evidence/layout/$scene_id-source.png" "evidence/layout/$scene_id-render.png" "evidence/layout/$scene_id-comparison.png" <<'JS'
const fs = require('fs');
const [layoutPath, sceneId, status, observation, sourceStill, renderStill, comparisonStill] = process.argv.slice(2);
const layout = JSON.parse(fs.readFileSync(layoutPath));
const scene = layout.scenes.find((item) => item.id === sceneId);
if (!scene) throw new Error(`Missing scene: ${sceneId}`);
Object.assign(scene, {sourceStill, renderStill, comparisonStill, status, observation});
fs.writeFileSync(layoutPath, JSON.stringify(layout, null, 2) + '\n');
JS

echo "Rendered settled scene $scene_id at frame $frame with status $status"
