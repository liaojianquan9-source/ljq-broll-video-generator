#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"
project_dir="$(cd "$script_dir/../.." && pwd)"
python_bin="$project_dir/skills/ljq-broll-replica/.venv/bin/python"
motion_scripts="$project_dir/skills/ljq-broll-motion-forensics/scripts"
fixture_dir="$(mktemp -d /tmp/ljq-motion-fixture.XXXXXX)"
trap 'rm -rf "$fixture_dir"' EXIT

"$python_bin" - "$fixture_dir" <<'PY'
from pathlib import Path
import sys
import numpy as np
from PIL import Image

out = Path(sys.argv[1])
rng = np.random.default_rng(7)
texture = rng.integers(50, 255, (24, 32), dtype=np.uint8)
for frame in range(12):
    rgb = np.zeros((64, 128, 3), dtype=np.uint8)
    rgb[20:44, 30 + frame:62 + frame] = texture[..., None]
    rgb[52:56, 5:5 + frame * 7, 0] = 230
    Image.fromarray(rgb).save(out / f"frame-{frame:06d}.png")
PY

track_output="$fixture_dir/track.txt"
timeline_output="$fixture_dir/timeline.txt"
edge_output="$fixture_dir/edge.txt"
"$python_bin" "$motion_scripts/motion_track.py" "$fixture_dir" --ref 0 --region card:20,10,100,50 --scale 1 --step 1 >"$track_output"
"$python_bin" "$motion_scripts/element_timeline.py" "$fixture_dir" --colour red --scale 1 --min-new 10 >"$timeline_output"
"$python_bin" "$motion_scripts/edge_trace.py" "$fixture_dir" --edge 5,54,80,54 --from 0 --to 11 --step 2 --colour red >"$edge_output"

grep -q 'peak-to-peak' "$track_output"
grep -q 'frames adding more than' "$timeline_output"
grep -q 'edge (5,54)' "$edge_output"
echo "Motion forensics tests passed"
