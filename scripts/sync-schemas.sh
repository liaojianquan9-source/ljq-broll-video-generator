#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"
project_dir="$(cd "$script_dir/.." && pwd)"
target_dir="$project_dir/skills/ljq-broll-replica/schemas"

mkdir -p "$target_dir"
for schema in case layout motion validation; do
  cp "$project_dir/schemas/$schema.schema.json" "$target_dir/$schema.schema.json"
done

echo "Synchronized schemas into the self-contained master Skill."
