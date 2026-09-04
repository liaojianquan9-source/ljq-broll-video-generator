#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"
project_dir="$(cd "$script_dir/../.." && pwd)"
python_bin="$project_dir/skills/ljq-broll-replica/.venv/bin/python"
motion_scripts="$project_dir/skills/ljq-broll-motion-forensics/scripts"
fixture_dir="$(mktemp -d /tmp/ljq-motion-fixture.XXXXXX)"
trap 'rm -rf "$fixture_dir"' EXIT

"$python_bin" - "$fixture_dir" <<'PY'
from pathlib import Path
import sys
import numpy as np
from PIL import Image

out = Path(sys.argv[1])
rng = np.random.default_rng(7)
texture = rng.integers(50, 255, (24, 32), dtype=np.uint8)
for frame in range(12):
    rgb = np.zeros((64, 128, 3), dtype=np.uint8)
    rgb[20:44, 30 + frame:62 + frame] = texture[..., None]
    rgb[52:56, 5:5 + frame * 7, 0] = 230
    Image.fromarray(rgb).save(out / f"frame-{frame:06d}.png")
PY

track_output="$fixture_dir/track.txt"
timeline_output="$fixture_dir/timeline.txt"
edge_output="$fixture_dir/edge.txt"
"$python_bin" "$motion_scripts/motion_track.py" "$fixture_dir" --ref 0 --region card:20,10,100,50 --scale 1 --step 1 >"$track_output"
"$python_bin" "$motion_scripts/element_timeline.py" "$fixture_dir" --colour red --scale 1 --min-new 10 >"$timeline_output"
"$python_bin" "$motion_scripts/edge_trace.py" "$fixture_dir" --edge 5,54,80,54 --from 0 --to 11 --step 2 --colour red >"$edge_output"

grep -q 'peak-to-peak' "$track_output"
grep -q 'frames adding more than' "$timeline_output"
grep -q 'edge (5,54)' "$edge_output"

continuity_case="$fixture_dir/continuity-case"
mkdir -p "$continuity_case/specs"
node - "$continuity_case/specs/motion.json" <<'JS'
const fs = require('fs');
const output = process.argv[2];
fs.writeFileSync(output, JSON.stringify({
  schemaVersion: '1.2', caseId: 'continuity-fixture', durationInFrames: 40,
  motions: [{id: 'smooth-x', targetId: 'hero', phase: 'entrance', firstVisible: 0, settledFrame: 30, endFrame: 39,
    transform: {x: {keyframes: [{frame: 0, value: 120}, {frame: 30, value: 0}], interpolation: 'bezier', bezier: [0.2, 0.8, 0.3, 1]}},
    evidence: {type: 'measured', detail: 'fixture'}, confidence: 'high'}],
  continuity: {status: 'needs_review', evidence: 'evidence/motion/continuity.json', windows: []}
}, null, 2));
JS
node "$project_dir/skills/ljq-broll-replica/scripts/analyze-motion-continuity.mjs" "$continuity_case"
grep -q '"status": "passed"' "$continuity_case/evidence/motion/continuity.json"
node - "$continuity_case/specs/motion.json" <<'JS'
const fs = require('fs');
const file = process.argv[2];
const motion = require(file);
motion.motions[0].transform.x.bezier = [0.3, 1.8, 0.7, -0.8];
fs.writeFileSync(file, JSON.stringify(motion, null, 2));
JS
if node "$project_dir/skills/ljq-broll-replica/scripts/analyze-motion-continuity.mjs" "$continuity_case"; then
  echo "Expected reversing curve to fail continuity analysis" >&2
  exit 1
fi
grep -q '"status": "failed"' "$continuity_case/evidence/motion/continuity.json"
echo "Motion forensics tests passed"
