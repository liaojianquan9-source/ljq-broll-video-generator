#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"
project_dir="$(cd "$script_dir/../.." && pwd)"
master="${LJQ_MASTER_SKILL_DIR:-$project_dir/skills/ljq-broll-replica}"
qa="${LJQ_QA_SKILL_DIR:-$project_dir/skills/ljq-broll-fidelity-qa}"
smoke_dir="$(mktemp -d /tmp/ljq-broll-e2e.XXXXXX)"
source_file="$smoke_dir/source.mp4"
case_dir="$smoke_dir/case"

if [ ! -x "$master/.venv/bin/python" ] || [ ! -d "$master/assets/remotion-renderer/node_modules" ]; then
  "$master/scripts/setup-environment.sh"
fi

ffmpeg -hide_banner -loglevel error -f lavfi -i "color=c=#101522:s=160x90:r=15:d=1" -c:v libx264 -pix_fmt yuv420p "$source_file"
"$master/.venv/bin/python" "$master/scripts/inspect-clip.py" "$source_file" "$case_dir" --case-id e2e-smoke

node - "$case_dir" <<'JS'
const fs = require('fs');
const path = require('path');
const caseDir = process.argv[2];
const layout = {
  schemaVersion: '1.2', caseId: 'e2e-smoke',
  canvas: {width: 160, height: 90, fps: 15, durationInFrames: 15, backgroundColor: '#101522'},
  scenes: [{
    id: 'scene-01', startFrame: 0, endFrame: 14,
    settledFrame: {frame: 7, timeSeconds: 7 / 15, evidenceType: 'measured', evidence: 'Synthetic constant-color fixture.', confidence: 'high'},
    sourceStill: 'evidence/layout/scene-01-source.png', renderStill: 'evidence/layout/scene-01-render.png', comparisonStill: 'evidence/layout/scene-01-comparison.png',
    status: 'needs_review', observation: 'Awaiting settled-scene render.'
  }],
  replacementTests: [],
  elements: [{
    id: 'background-plate', type: 'background', name: 'Background plate', sceneId: 'scene-01', content: null, asset: null,
    assetSource: null, completeness: null, bounds: [0, 0, 100, 100], anchor: [0.5, 0.5],
    cropMode: 'none', zIndex: 0, parentId: null, shape: null, appearance: {fill: '#101522'},
    replaceable: true, evidence: [{type: 'measured', detail: 'Synthetic source color.', frame: 7}], confidence: 'high'
  }]
};
const motion = {
  schemaVersion: '1.2', caseId: 'e2e-smoke', durationInFrames: 15,
  motions: [{
    id: 'background-hold', targetId: 'background-plate', phase: 'hold', firstVisible: 0, settledFrame: 0, endFrame: 14,
    transform: {opacity: [{frame: 0, value: 1}, {frame: 14, value: 1}]},
    evidence: {type: 'measured', detail: 'Synthetic source is constant.', frames: [0, 14]}, confidence: 'high'
  }],
  continuity: {status: 'needs_review', evidence: 'evidence/motion/continuity.json', windows: []}
};
fs.writeFileSync(path.join(caseDir, 'specs/layout.json'), JSON.stringify(layout, null, 2) + '\n');
fs.writeFileSync(path.join(caseDir, 'specs/motion.json'), JSON.stringify(motion, null, 2) + '\n');
const statePath = path.join(caseDir, 'case.json');
const state = JSON.parse(fs.readFileSync(statePath));
state.files.layout = 'specs/layout.json'; state.files.motion = 'specs/motion.json';
state.stages.layout = 'in_progress'; state.stages.motion = 'in_progress';
fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n');
JS

node "$master/scripts/initialize-case-remotion.mjs" "$case_dir"
"$project_dir/skills/ljq-broll-layout-structure/scripts/render-layout-scene.sh" "$case_dir" scene-01 --pass --observation "Synthetic source and settled render match."
node -e 'require("fs").writeFileSync(process.argv[1], JSON.stringify({theme:{"background-plate":"linear-gradient(90deg, #334455, #556677)"}}) + "\n")' "$case_dir/replacement-props.json"
"$project_dir/skills/ljq-broll-layout-structure/scripts/render-replacement-still.sh" "$case_dir" background-plate "$case_dir/replacement-props.json" --pass --observation "Replacement theme renders without retaining the default flat fill."
node "$master/scripts/analyze-motion-continuity.mjs" "$case_dir"
node - "$case_dir/case.json" <<'JS'
const fs = require('fs');
const file = process.argv[2];
const state = require(file);
state.stages.layout = 'passed';
state.stages.motion = 'passed';
fs.writeFileSync(file, JSON.stringify(state, null, 2) + '\n');
JS
"$master/scripts/render-case.sh" "$case_dir"
node "$master/scripts/record-qa-gates.mjs" "$case_dir" --live-status pass --live-evidence evidence/layout/scene-01-comparison.png --live-observation "All visible elements are live or editable components." --excluded-status not_applicable --excluded-evidence evidence/layout/scene-01-comparison.png --excluded-observation "No excluded regions in the synthetic fixture."
"$master/.venv/bin/python" "$qa/scripts/qa-case.py" "$case_dir" --visual-status pass --observation "Synthetic constant-color source and reconstruction are visually equivalent."
node "$master/scripts/validate-case.mjs" "$case_dir" --complete
"$master/.venv/bin/python" - "$case_dir/validation/report.json" <<'PY'
import json
import sys
report = json.load(open(sys.argv[1], encoding="utf-8"))
if report["metrics"]["meanAbsRgbDeltaAverage"] > 4:
    raise SystemExit("Unexpected visual delta in synthetic equivalence test")
print("End-to-end smoke test passed")
PY
