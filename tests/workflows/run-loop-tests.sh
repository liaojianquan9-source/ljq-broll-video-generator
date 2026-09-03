#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"
project_dir="$(cd "$script_dir/../.." && pwd)"
case_dir="$(mktemp -d /tmp/ljq-loop-contract.XXXXXX)"

node - "$case_dir" <<'JS'
const fs = require('fs');
const path = require('path');
const dir = process.argv[2];
fs.mkdirSync(path.join(dir, 'validation'), {recursive: true});
fs.writeFileSync(path.join(dir, 'case.json'), JSON.stringify({
  status: 'in_progress',
  stages: {preflight: 'passed', layout: 'passed', motion: 'passed', implementation: 'passed', qa: 'needs_review'},
  files: {render: 'render/final.mp4', validation: 'validation/report.json'},
  iteration: {maxCorrections: 2, correctionsUsed: 0, lastRootCause: null},
  knownDifferences: []
}, null, 2));
fs.writeFileSync(path.join(dir, 'validation/report.json'), JSON.stringify({status: 'needs_revision'}));
JS

node "$project_dir/skills/ljq-broll-replica/scripts/begin-correction.mjs" "$case_dir" --owner layout --root-cause "geometry"
node "$project_dir/skills/ljq-broll-replica/scripts/begin-correction.mjs" "$case_dir" --owner motion --root-cause "timing"
if node "$project_dir/skills/ljq-broll-replica/scripts/begin-correction.mjs" "$case_dir" --owner implementation --root-cause "third attempt"; then
  echo "Expected a third correction to be rejected" >&2
  exit 1
fi
node -e 'const c=require(process.argv[1]); if(c.iteration.correctionsUsed!==2||c.status!=="blocked") process.exit(1)' "$case_dir/case.json"
echo "Two-correction workflow test passed"
