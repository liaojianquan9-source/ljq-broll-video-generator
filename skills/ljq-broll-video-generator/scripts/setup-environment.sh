#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"
skill_dir="$(cd "$script_dir/.." && pwd)"
project_dir="$(cd "$skill_dir/../.." && pwd)"
renderer_dir="$skill_dir/assets/remotion-renderer"
python_deps_dir="$project_dir/workspace/.python-deps"

missing=()
for command_name in node npm ffmpeg ffprobe python3; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    missing+=("$command_name")
  fi
done

if [ "${#missing[@]}" -gt 0 ]; then
  echo "Missing system commands: ${missing[*]}" >&2
  echo "Install the missing commands, then run this script again." >&2
  exit 1
fi

chmod +x "$script_dir"/*.sh "$script_dir"/*.mjs

if [ -f "$renderer_dir/package-lock.json" ]; then
  npm ci --prefix "$renderer_dir" --no-audit --no-fund
else
  npm install --prefix "$renderer_dir" --no-audit --no-fund
fi

mkdir -p "$python_deps_dir"
if ! PYTHONPATH="$python_deps_dir" python3 -c 'import yaml' >/dev/null 2>&1; then
  python3 -m pip install --target "$python_deps_dir" PyYAML --quiet
fi

npm run typecheck --prefix "$renderer_dir"

echo "Environment ready"
echo "  Node: $(node --version)"
echo "  npm: $(npm --version)"
echo "  FFmpeg: $(ffmpeg -version | sed -n '1p')"
remotion_version="$(node -e 'process.stdout.write(require(process.argv[1]).version)' "$renderer_dir/node_modules/remotion/package.json")"
echo "  Remotion: $remotion_version"
browser_path="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
if [ -x "$browser_path" ]; then
  echo "  Chrome: $browser_path"
else
  echo "  Chrome: not found; Remotion will use its managed browser when available"
fi
