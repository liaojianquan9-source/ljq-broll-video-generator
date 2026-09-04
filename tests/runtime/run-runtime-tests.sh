#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"
project_dir="$(cd "$script_dir/../.." && pwd)"
master="${LJQ_MASTER_SKILL_DIR:-$project_dir/skills/ljq-broll-replica}"
renderer="$master/assets/remotion-renderer"
fixture_dir="$(mktemp -d /tmp/ljq-broll-runtime.XXXXXX)"
case_dir="$fixture_dir/case"
source_file="$fixture_dir/source.mp4"
trap 'rm -rf "$fixture_dir"' EXIT

if [ ! -x "$master/.venv/bin/python" ] || [ ! -d "$renderer/node_modules" ]; then
  "$master/scripts/setup-environment.sh"
fi

ffmpeg -hide_banner -loglevel error -f lavfi -i "color=c=black:s=200x100:r=30:d=0.7" -c:v libx264 -pix_fmt yuv420p "$source_file"
"$master/.venv/bin/python" "$master/scripts/inspect-clip.py" "$source_file" "$case_dir" --case-id runtime-effects

node - "$case_dir" <<'JS'
const fs = require('fs');
const path = require('path');
const caseDir = process.argv[2];
const layout = {
  schemaVersion: '1.2', caseId: 'runtime-effects',
  canvas: {width: 200, height: 100, fps: 30, durationInFrames: 21, backgroundColor: '#000000'},
  scenes: [{id: 'scene-01', startFrame: 0, endFrame: 20}],
  elements: [
    {id: 'diagonal-panel', type: 'shape', name: 'Diagonal panel', sceneId: 'scene-01', content: null, asset: null,
      bounds: [0, 0, 50, 100], anchor: [0.5, 0.5], cropMode: 'none', zIndex: 0, parentId: null,
      shape: 'rectangle', appearance: {fill: '#00ffff'}},
    {id: 'ghost-title', type: 'text', name: 'Ghost title', sceneId: 'scene-01', content: '28', asset: null,
      bounds: [50, 0, 50, 100], anchor: [0.5, 0.5], cropMode: 'none', zIndex: 1, parentId: null,
      shape: null, appearance: {color: '#ffffff', fontFamily: 'Arial', fontSizePx: 42, fontWeight: 700, textAlign: 'center', verticalAlign: 'center'}}
  ]
};
const linear = (start, end) => ({keyframes: [{frame: 0, value: start}, {frame: 20, value: end}], interpolation: 'linear'});
const motion = {schemaVersion: '1.2', caseId: 'runtime-effects', durationInFrames: 21, motions: [
  {id: 'diagonal-reveal', targetId: 'diagonal-panel', phase: 'enter', firstVisible: 0, settledFrame: 20, endFrame: 20,
    reveal: {mode: 'wipe', direction: 'diagonal-down-right', progress: linear(0, 1)}},
  {id: 'ghost-title-enter', targetId: 'ghost-title', phase: 'enter', firstVisible: 0, settledFrame: 20, endFrame: 20,
    textAnimation: {preset: 'ghost-drop-in', startFrame: 0, endFrame: 20, seed: 7, staggerFrames: 2, direction: 'top-to-bottom', distancePx: 34, blurPx: 3, ghostLayers: 3, ghostOffsetPx: 4, ghostOpacity: 0.35, stretchY: 1.2}}
]};
fs.writeFileSync(path.join(caseDir, 'specs/layout.json'), JSON.stringify(layout, null, 2) + '\n');
fs.writeFileSync(path.join(caseDir, 'specs/motion.json'), JSON.stringify(motion, null, 2) + '\n');
const statePath = path.join(caseDir, 'case.json');
const state = JSON.parse(fs.readFileSync(statePath));
state.files.layout = 'specs/layout.json';
state.files.motion = 'specs/motion.json';
fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n');
JS

node "$master/scripts/initialize-case-remotion.mjs" "$case_dir"
node "$master/scripts/stage-case-assets.mjs" "$case_dir"
if [ ! -e "$case_dir/remotion/node_modules" ]; then
  ln -s "$renderer/node_modules" "$case_dir/remotion/node_modules"
fi

browser_path="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
for frame in 0 10 20; do
  args=(still "$case_dir/remotion/composition.tsx" LjqBrollCase "$fixture_dir/frame-$frame.png" --frame="$frame" --public-dir="$case_dir/remotion/public")
  if [ -x "$browser_path" ]; then args+=(--browser-executable="$browser_path"); fi
  (cd "$renderer" && NODE_PATH="$renderer/node_modules" npx remotion "${args[@]}" >/dev/null)
done

"$master/.venv/bin/python" - "$fixture_dir" <<'PY'
from pathlib import Path
import sys
from PIL import Image, ImageChops

root = Path(sys.argv[1])
frames = [Image.open(root / f"frame-{frame}.png").convert("RGB") for frame in (0, 10, 20)]

def cyan_pixels(image):
    return sum(1 for r, g, b in image.crop((0, 0, 100, 100)).get_flattened_data() if g > 200 and b > 200 and r < 40)

start_cyan, mid_cyan, end_cyan = map(cyan_pixels, frames)
if not start_cyan < 100 < mid_cyan < end_cyan:
    raise SystemExit(f"Diagonal reveal did not grow monotonically: {start_cyan}, {mid_cyan}, {end_cyan}")
if frames[1].getpixel((20, 70))[1] < 180 or frames[1].getpixel((80, 70))[1] > 40:
    raise SystemExit("Mid-frame diagonal edge is not in the expected down-right orientation")
if frames[2].getpixel((80, 70))[1] < 180:
    raise SystemExit("Diagonal reveal did not finish")

mid_text = frames[1].crop((100, 0, 200, 100))
end_text = frames[2].crop((100, 0, 200, 100))
if mid_text.getbbox() is None or end_text.getbbox() is None:
    raise SystemExit("Ghost text did not render")
if ImageChops.difference(mid_text, end_text).getbbox() is None:
    raise SystemExit("Ghost text preset has no temporal change")
print(f"Runtime effects smoke passed: cyan={start_cyan}/{mid_cyan}/{end_cyan}")
PY
