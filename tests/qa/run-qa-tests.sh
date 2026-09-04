#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"
project_dir="$(cd "$script_dir/../.." && pwd)"
master="$project_dir/skills/ljq-broll-replica"
qa="$project_dir/skills/ljq-broll-fidelity-qa"
case_dir="$(mktemp -d /tmp/ljq-qa-contract.XXXXXX)"
gate_dir=""
trap 'rm -rf "$case_dir"; if [ -n "${gate_dir:-}" ]; then rm -rf "$gate_dir"; fi' EXIT
mkdir -p "$case_dir/assets/originals" "$case_dir/render"

ffmpeg -hide_banner -loglevel error -f lavfi -i "color=c=black:s=160x90:r=15:d=1" -c:v libx264 -pix_fmt yuv420p "$case_dir/assets/originals/reference.mp4"
ffmpeg -hide_banner -loglevel error -f lavfi -i "color=c=black:s=120x90:r=15:d=1" -c:v libx264 -pix_fmt yuv420p "$case_dir/render/final.mp4"
node - "$case_dir" <<'JS'
const fs = require('fs');
const path = require('path');
const dir = process.argv[2];
fs.writeFileSync(path.join(dir, 'case.json'), JSON.stringify({
  caseId: 'qa-contract', status: 'ready_for_qa',
  stages: {preflight: 'passed', layout: 'passed', motion: 'passed', implementation: 'passed', qa: 'pending'},
  files: {source: 'assets/originals/reference.mp4', render: 'render/final.mp4', validation: null},
  iteration: {maxCorrections: 2, correctionsUsed: 0, lastRootCause: null}, knownDifferences: []
}, null, 2));
JS

"$master/.venv/bin/python" "$qa/scripts/qa-case.py" "$case_dir" --visual-status review
node - "$case_dir/validation/report.json" <<'JS'
const report = require(process.argv[2]);
if (report.status !== 'needs_revision') process.exit(1);
if (!report.checks.some((item) => item.id === 'dimensions' && item.status === 'fail')) process.exit(1);
if (!report.issues.some((item) => item.owner === 'implementation')) process.exit(1);
JS

gate_dir="$(mktemp -d /tmp/ljq-qa-gates.XXXXXX)"
mkdir -p "$gate_dir/assets/originals" "$gate_dir/render" "$gate_dir/specs" "$gate_dir/evidence/layout" "$gate_dir/evidence/motion" "$gate_dir/remotion" "$gate_dir/validation"
ffmpeg -hide_banner -loglevel error -f lavfi -i "color=c=black:s=160x90:r=15:d=1" -c:v libx264 -pix_fmt yuv420p "$gate_dir/assets/originals/reference.mp4"
cp "$gate_dir/assets/originals/reference.mp4" "$gate_dir/render/final.mp4"
for file in source render comparison; do cp "$gate_dir/assets/originals/reference.mp4" "$gate_dir/evidence/layout/scene-$file.bin"; done
cp "$gate_dir/assets/originals/reference.mp4" "$gate_dir/evidence/motion/continuity.json"
node - "$gate_dir" <<'JS'
const fs = require('fs');
const path = require('path');
const dir = process.argv[2];
const state = {
  schemaVersion: '1.2', caseId: 'qa-gates', status: 'ready_for_qa',
  scope: {startSeconds: 0, endSeconds: 1, durationSeconds: 1, include: ['B-roll'], exclude: [], excludedRegionMode: 'none', exclusionMask: null, confirmation: 'fixture'},
  stages: {preflight: 'passed', layout: 'passed', motion: 'passed', implementation: 'passed', qa: 'pending'},
  files: {source: 'assets/originals/reference.mp4', render: 'render/final.mp4', layout: 'specs/layout.json', motion: 'specs/motion.json', validation: null, qaGates: null},
  iteration: {maxCorrections: 2, correctionsUsed: 0, lastRootCause: null}, knownDifferences: []
};
const layout = {schemaVersion: '1.2', scenes: [{id: 'scene-01', startFrame: 0, endFrame: 14, settledFrame: {frame: 7}, sourceStill: 'evidence/layout/scene-source.bin', renderStill: 'evidence/layout/scene-render.bin', comparisonStill: 'evidence/layout/scene-comparison.bin', status: 'passed'}], replacementTests: [], elements: [{id: 'background', replaceable: false}]};
const motion = {schemaVersion: '1.2', continuity: {status: 'passed', evidence: 'evidence/motion/continuity.json', windows: []}};
fs.writeFileSync(path.join(dir, 'case.json'), JSON.stringify(state, null, 2));
fs.writeFileSync(path.join(dir, 'specs/layout.json'), JSON.stringify(layout, null, 2));
fs.writeFileSync(path.join(dir, 'specs/motion.json'), JSON.stringify(motion, null, 2));
JS
"$master/.venv/bin/python" "$qa/scripts/qa-case.py" "$gate_dir" --visual-status pass --observation "Pixels match."
node - "$gate_dir/validation/report.json" <<'JS'
const report = require(process.argv[2]);
if (report.status !== 'needs_revision') process.exit(1);
if (!report.checks.some((item) => item.id === 'live-elements' && item.status === 'fail')) process.exit(1);
JS
node "$master/scripts/record-qa-gates.mjs" "$gate_dir" --live-status pass --live-evidence evidence/layout/scene-comparison.bin --live-observation "Runtime audit found no screenshot-backed live elements." --excluded-status not_applicable --excluded-evidence evidence/layout/scene-comparison.bin --excluded-observation "No excluded regions."
"$master/.venv/bin/python" "$qa/scripts/qa-case.py" "$gate_dir" --visual-status pass --observation "Pixels and required gates pass."
node - "$gate_dir/validation/report.json" <<'JS'
const report = require(process.argv[2]);
if (report.status !== 'passed') process.exit(1);
for (const id of ['scope', 'live-elements', 'replacement-smoke', 'settled-scenes', 'motion-continuity', 'excluded-regions', 'visual-fidelity']) {
  if (!report.checks.some((item) => item.id === id && ['pass', 'not_applicable'].includes(item.status))) process.exit(1);
}
JS
echo "QA hard-gate test passed"
