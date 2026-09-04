#!/usr/bin/env python3
"""Create a source/render/difference strip for one settled scene."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("render", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()

    source = Image.open(args.source).convert("RGB")
    render = Image.open(args.render).convert("RGB")
    if source.size != render.size:
        raise SystemExit(f"Still dimensions differ: source={source.size}, render={render.size}")
    difference = ImageChops.difference(source, render)
    label_height = 28
    canvas = Image.new("RGB", (source.width * 3, source.height + label_height), "white")
    draw = ImageDraw.Draw(canvas)
    draw.text((8, 8), "source", fill="#111")
    draw.text((source.width + 8, 8), "render", fill="#111")
    draw.text((source.width * 2 + 8, 8), "absolute difference", fill="#111")
    canvas.paste(source, (0, label_height))
    canvas.paste(render, (source.width, label_height))
    canvas.paste(difference, (source.width * 2, label_height))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(args.output)


if __name__ == "__main__":
    main()
