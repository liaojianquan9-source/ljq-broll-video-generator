#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"
project_dir="$(cd "$script_dir/.." && pwd)"
codex_root="${CODEX_HOME:-$HOME/.codex}"
skills_dir="$codex_root/skills"
timestamp="$(date +%Y%m%d-%H%M%S)"
backup_dir="$codex_root/skill-backups/ljq-broll-$timestamp"
skill_names=(ljq-broll-replica ljq-broll-layout-structure ljq-broll-motion-forensics ljq-broll-fidelity-qa)

mkdir -p "$skills_dir" "$backup_dir"
for skill_name in "${skill_names[@]}"; do
  source_dir="$project_dir/skills/$skill_name"
  target_dir="$skills_dir/$skill_name"
  if [ ! -f "$source_dir/SKILL.md" ]; then
    echo "Missing source Skill: $source_dir" >&2
    exit 1
  fi
  if [ -e "$target_dir" ]; then
    mv "$target_dir" "$backup_dir/$skill_name"
  fi
  mkdir -p "$target_dir"
  rsync -a --exclude '.venv' --exclude 'node_modules' "$source_dir/" "$target_dir/"
done

"$skills_dir/ljq-broll-replica/scripts/setup-environment.sh"
validator="$skills_dir/.system/skill-creator/scripts/quick_validate.py"
if [ -f "$validator" ]; then
  python_bin="$skills_dir/ljq-broll-replica/.venv/bin/python"
  for skill_name in "${skill_names[@]}"; do
    "$python_bin" "$validator" "$skills_dir/$skill_name"
  done
fi

echo "Installed LJQ B-roll Skills into: $skills_dir"
echo "Previous versions, if any, are recoverable from: $backup_dir"
