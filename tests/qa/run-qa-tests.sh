#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"
project_dir="$(cd "$script_dir/../.." && pwd)"
master="$project_dir/skills/ljq-broll-replica"
qa="$project_dir/skills/ljq-broll-fidelity-qa"
case_dir="$(mktemp -d /tmp/ljq-qa-contract.XXXXXX)"
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
echo "QA hard-gate test passed"
