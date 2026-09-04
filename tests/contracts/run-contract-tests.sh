#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"
project_dir="$(cd "$script_dir/../.." && pwd)"
validator="$project_dir/scripts/validate-case.mjs"

node "$validator" "$script_dir/minimal-case"

invalid_output="$(mktemp /tmp/ljq-broll-invalid-case.XXXXXX)"
trap 'rm -f "$invalid_output"' EXIT

if node "$validator" "$script_dir/invalid-case" >"$invalid_output" 2>&1; then
  echo "Expected invalid-case validation to fail" >&2
  exit 1
fi

grep -q 'duplicates "duplicate-card"' "$invalid_output"
grep -q 'references missing element "not-in-layout"' "$invalid_output"
grep -q 'text must stay live and cannot use an asset snapshot' "$invalid_output"
grep -q 'restarts nonlinear easing' "$invalid_output"
echo "Contract tests passed"
