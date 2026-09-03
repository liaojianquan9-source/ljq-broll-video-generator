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
  schemaVersion: '1.1', caseId: 'e2e-smoke',
  canvas: {width: 160, height: 90, fps: 15, durationInFrames: 15, backgroundColor: '#101522'},
  settledFrame: {frame: 7, timeSeconds: 7 / 15, evidenceType: 'measured', evidence: 'Synthetic constant-color fixture.', confidence: 'high'},
  elements: [{
    id: 'background-plate', type: 'background', name: 'Background plate', content: null, asset: null,
    assetSource: null, completeness: null, bounds: [0, 0, 100, 100], anchor: [0.5, 0.5],
    cropMode: 'none', zIndex: 0, parentId: null, shape: null, appearance: {fill: '#101522'},
    replaceable: true, evidence: [{type: 'measured', detail: 'Synthetic source color.', frame: 7}], confidence: 'high'
  }]
};
const motion = {
  schemaVersion: '1.1', caseId: 'e2e-smoke', durationInFrames: 15,
  motions: [{
    id: 'background-hold', targetId: 'background-plate', phase: 'hold', firstVisible: 0, settledFrame: 0, endFrame: 14,
    transform: {opacity: [{frame: 0, value: 1}, {frame: 14, value: 1}]},
    evidence: {type: 'measured', detail: 'Synthetic source is constant.', frames: [0, 14]}, confidence: 'high'
  }]
};
fs.writeFileSync(path.join(caseDir, 'specs/layout.json'), JSON.stringify(layout, null, 2) + '\n');
fs.writeFileSync(path.join(caseDir, 'specs/motion.json'), JSON.stringify(motion, null, 2) + '\n');
const statePath = path.join(caseDir, 'case.json');
const state = JSON.parse(fs.readFileSync(statePath));
state.files.layout = 'specs/layout.json'; state.files.motion = 'specs/motion.json';
state.stages.layout = 'passed'; state.stages.motion = 'passed';
fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n');
JS

node "$master/scripts/initialize-case-remotion.mjs" "$case_dir"
"$master/scripts/render-case.sh" "$case_dir"
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
