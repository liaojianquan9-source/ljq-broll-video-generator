#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"
skill_dir="$(cd "$script_dir/.." && pwd)"

for command_name in node npm python3 ffmpeg ffprobe; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Missing required command: $command_name" >&2
    exit 1
  fi
done

node_major="$(node -p 'Number(process.versions.node.split(".")[0])')"
if [ "$node_major" -lt 20 ]; then
  echo "Node.js 20 or newer is required; found $(node --version)." >&2
  exit 1
fi

if [ ! -d "$skill_dir/.venv" ]; then
  python3 -m venv "$skill_dir/.venv"
fi
"$skill_dir/.venv/bin/python" -m pip install --disable-pip-version-check -r "$skill_dir/requirements.txt"
(cd "$skill_dir" && npm ci --ignore-scripts)
(cd "$skill_dir/assets/remotion-renderer" && npm ci --ignore-scripts)

"$skill_dir/.venv/bin/python" - <<'PY'
import numpy
import PIL
print(f"Python dependencies ready: numpy={numpy.__version__}, pillow={PIL.__version__}")
PY
(cd "$skill_dir" && node -e "import('ajv').then(() => console.log('Node dependency ready: ajv'))")

echo "B-roll replication environment is ready."
