#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"
project_dir="$(cd "$script_dir/../.." && pwd)"
master="$project_dir/skills/ljq-broll-replica"
fixture_dir="$(mktemp -d /tmp/ljq-preflight-contract.XXXXXX)"
trap 'rm -rf "$fixture_dir"' EXIT

source_file="$fixture_dir/source.mp4"
case_dir="$fixture_dir/case"
ffmpeg -hide_banner -loglevel error -f lavfi -i "testsrc2=s=160x90:r=10:d=3" -c:v libx264 -pix_fmt yuv420p "$source_file"
"$master/.venv/bin/python" "$master/scripts/inspect-clip.py" "$source_file" "$case_dir" --case-id scoped-clip --start-seconds 0.5 --end-seconds 1.6 --include text --scope-confirmation "User confirmed 0.5s–1.6s."
node "$master/scripts/validate-case.mjs" "$case_dir"
node - "$case_dir/case.json" <<'JS'
const state = require(process.argv[2]);
if (state.schemaVersion !== '1.2') process.exit(1);
if (Math.abs(state.scope.startSeconds - 0.5) > 1e-9 || Math.abs(state.scope.endSeconds - 1.6) > 1e-9) process.exit(1);
if (state.source.decodedFrames !== 11) process.exit(1);
if (Math.abs(state.scope.durationSeconds - 1.1) > 1e-9) process.exit(1);
JS

if "$master/.venv/bin/python" "$master/scripts/inspect-clip.py" "$source_file" "$fixture_dir/invalid-range" --start-seconds 2 --end-seconds 1; then
  echo "Expected invalid range to fail" >&2
  exit 1
fi
if "$master/.venv/bin/python" "$master/scripts/inspect-clip.py" "$source_file" "$fixture_dir/invalid-exclusion" --exclude person; then
  echo "Expected exclusion without region mode to fail" >&2
  exit 1
fi
echo "Preflight scope tests passed"
