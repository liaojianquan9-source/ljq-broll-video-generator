#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 3 ]; then
  echo "Usage: render-replacement-still.sh <case-directory> <element-id> <props-json> [--pass] [--observation text]" >&2
  exit 2
fi

script_dir="$(cd "$(dirname "$0")" && pwd)"
layout_skill_dir="$(cd "$script_dir/.." && pwd)"
master_dir="$(cd "$layout_skill_dir/../ljq-broll-replica" && pwd)"
renderer_dir="$master_dir/assets/remotion-renderer"
case_dir="$(cd "$1" && pwd)"
element_id="$2"
props_file="$(cd "$(dirname "$3")" && pwd)/$(basename "$3")"
status="needs_review"
observation="Replacement still requires visual review."
shift 3
while [ "$#" -gt 0 ]; do
  case "$1" in
    --pass) status="passed"; shift ;;
    --observation) observation="$2"; shift 2 ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
done

frame="$(node -e 'const l=require(process.argv[1]); const e=l.elements.find(x=>x.id===process.argv[2]); const s=l.scenes?.find(x=>x.id===e?.sceneId); if(!e||!s) process.exit(2); process.stdout.write(String(s.settledFrame.frame))' "$case_dir/specs/layout.json" "$element_id")"
output_rel="evidence/layout/replacement-$element_id.png"
output="$case_dir/$output_rel"
mkdir -p "$(dirname "$output")"

node "$master_dir/scripts/initialize-case-remotion.mjs" "$case_dir"
node "$master_dir/scripts/stage-case-assets.mjs" "$case_dir"
if [ ! -d "$renderer_dir/node_modules" ]; then
  (cd "$renderer_dir" && npm ci --ignore-scripts)
fi
if [ ! -e "$case_dir/remotion/node_modules" ]; then
  ln -s "$renderer_dir/node_modules" "$case_dir/remotion/node_modules"
fi

render_args=(still "$case_dir/remotion/composition.tsx" LjqBrollCase "$output" --frame="$frame" --props="$props_file" --public-dir="$case_dir/remotion/public")
browser_path="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
if [ -x "$browser_path" ]; then
  render_args+=(--browser-executable="$browser_path")
fi
(cd "$renderer_dir" && NODE_PATH="$renderer_dir/node_modules" npx remotion "${render_args[@]}")

node - "$case_dir/specs/layout.json" "$element_id" "$status" "$observation" "$output_rel" "$(basename "$props_file")" <<'JS'
const fs = require('fs');
const [layoutPath, elementId, status, observation, renderStill, variant] = process.argv.slice(2);
const layout = JSON.parse(fs.readFileSync(layoutPath));
layout.replacementTests ??= [];
const next = {elementId, variant, renderStill, status, observation};
const index = layout.replacementTests.findIndex((item) => item.elementId === elementId);
if (index === -1) layout.replacementTests.push(next);
else layout.replacementTests[index] = next;
fs.writeFileSync(layoutPath, JSON.stringify(layout, null, 2) + '\n');
JS

echo "Rendered replacement still for $element_id at frame $frame with status $status"
