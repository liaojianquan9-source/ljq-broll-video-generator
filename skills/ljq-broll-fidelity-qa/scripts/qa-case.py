#!/usr/bin/env python3
"""Run full-video comparison, write the validation contract, and update case state."""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from fractions import Fraction
from pathlib import Path


def probe(video: Path) -> dict:
    command = [
        shutil.which("ffprobe") or "ffprobe", "-v", "error", "-count_frames",
        "-show_entries", "stream=codec_type,width,height,avg_frame_rate,r_frame_rate,nb_frames,nb_read_frames:format=duration",
        "-of", "json", str(video),
    ]
    result = subprocess.run(command, check=True, capture_output=True, text=True, encoding="utf-8")
    data = json.loads(result.stdout)
    stream = next((item for item in data.get("streams", []) if item.get("codec_type") == "video"), None)
    if not stream:
        raise SystemExit(f"No video stream found: {video}")
    fps = float(Fraction(stream.get("avg_frame_rate") or stream.get("r_frame_rate") or "0/1"))
    frames = stream.get("nb_read_frames") or stream.get("nb_frames")
    return {
        "width": int(stream["width"]), "height": int(stream["height"]), "fps": fps,
        "durationInFrames": int(frames),
        "hasAudio": any(item.get("codec_type") == "audio" for item in data.get("streams", [])),
        "durationSeconds": float(data.get("format", {}).get("duration") or 0),
    }


def next_evidence_dir(validation_directory: Path, correction_pass: int) -> Path:
    base = validation_directory / "iterations" / f"pass-{correction_pass}"
    if not base.exists():
        return base
    index = 1
    while (candidate := validation_directory / "iterations" / f"pass-{correction_pass}-rerun-{index}").exists():
        index += 1
    return candidate


def rel(path: Path, case_directory: Path) -> str:
    return path.relative_to(case_directory).as_posix()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("case_directory", type=Path)
    parser.add_argument("--visual-status", choices=["review", "pass", "fail"], default="review")
    parser.add_argument("--owner", choices=["preflight", "layout", "motion", "implementation", "qa"], default="layout")
    parser.add_argument("--target-id")
    parser.add_argument("--observation", default="Visual comparison still requires review.")
    args = parser.parse_args()

    case_directory = args.case_directory.expanduser().resolve()
    case_path = case_directory / "case.json"
    state = json.loads(case_path.read_text(encoding="utf-8"))
    if state["stages"]["implementation"] != "passed" or not state["files"]["render"]:
        raise SystemExit("Implementation must be passed and case.json.files.render must exist before QA.")
    source = case_directory / state["files"]["source"]
    render = case_directory / state["files"]["render"]
    if not source.is_file() or not render.is_file():
        raise SystemExit("Both case-local source and full render must exist.")

    source_probe = probe(source)
    render_probe = probe(render)
    layout = json.loads((case_directory / state["files"]["layout"]).read_text(encoding="utf-8")) if state["files"].get("layout") else None
    motion = json.loads((case_directory / state["files"]["motion"]).read_text(encoding="utf-8")) if state["files"].get("motion") else None
    qa_gates_path = case_directory / state["files"]["qaGates"] if state["files"].get("qaGates") else None
    qa_gates = json.loads(qa_gates_path.read_text(encoding="utf-8")) if qa_gates_path and qa_gates_path.is_file() else {"checks": []}
    validation_directory = case_directory / "validation"
    evidence_directory = next_evidence_dir(validation_directory, state["iteration"]["correctionsUsed"])
    evidence_directory.mkdir(parents=True, exist_ok=False)
    compare_script = Path(__file__).with_name("compare_video_frames.py")
    dimensions_equal = source_probe["width"] == render_probe["width"] and source_probe["height"] == render_probe["height"]
    if dimensions_equal:
        compare_command = [sys.executable, str(compare_script), str(source), str(render), "--output", str(evidence_directory)]
        exclusion_mask = state.get("scope", {}).get("exclusionMask")
        if exclusion_mask:
            compare_command.extend(["--exclude-mask", str(case_directory / exclusion_mask)])
        subprocess.run(compare_command, check=True)
        raw = json.loads((evidence_directory / "report.json").read_text(encoding="utf-8"))
    else:
        raw = {
            "mean_abs_rgb_delta_average": None,
            "mean_abs_rgb_delta_worst": None,
            "worst_delta_frame": None,
            "warning": "Visual pixel comparison skipped because dimensions differ.",
        }
        (evidence_directory / "report.json").write_text(json.dumps(raw, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    checks = []
    issues = []
    def check(check_id: str, passed: bool, evidence: str, owner: str = "implementation", issue_type: str = "render", status: str | None = None) -> None:
        resolved_status = status or ("pass" if passed else "fail")
        checks.append({"id": check_id, "status": resolved_status, "evidence": evidence})
        if resolved_status == "fail":
            issues.append({
                "id": f"issue-{check_id}", "type": "audio" if check_id == "audio" else issue_type,
                "targetId": None, "owner": owner, "severity": "high",
                "observation": evidence, "evidence": rel(evidence_directory / "report.json", case_directory),
            })

    check("dimensions", source_probe["width"] == render_probe["width"] and source_probe["height"] == render_probe["height"], f"source={source_probe['width']}x{source_probe['height']}; render={render_probe['width']}x{render_probe['height']}")
    check("fps", abs(source_probe["fps"] - render_probe["fps"]) <= 0.01, f"source={source_probe['fps']}; render={render_probe['fps']}")
    check("frame-count", source_probe["durationInFrames"] == render_probe["durationInFrames"], f"source={source_probe['durationInFrames']}; render={render_probe['durationInFrames']}")
    check("audio", source_probe["hasAudio"] == render_probe["hasAudio"], f"source={source_probe['hasAudio']}; render={render_probe['hasAudio']}")
    if state.get("schemaVersion") == "1.2":
        scope = state["scope"]
        tolerance = 1 / max(1, source_probe["fps"])
        scope_ok = abs(source_probe["durationSeconds"] - scope["durationSeconds"]) <= tolerance + 1e-6
        check("scope", scope_ok, f"requested={scope['durationSeconds']}; decoded={source_probe['durationSeconds']}; tolerance={tolerance}", "preflight", "scope")

        scenes = layout.get("scenes", []) if layout else []
        scene_ok = bool(scenes) and all(scene.get("status") == "passed" and all((case_directory / scene[key]).is_file() for key in ["sourceStill", "renderStill", "comparisonStill"]) for scene in scenes)
        check("settled-scenes", scene_ok, f"passed={sum(scene.get('status') == 'passed' for scene in scenes)}/{len(scenes)}", "layout", "geometry")

        replaceable = {element["id"] for element in (layout or {}).get("elements", []) if element.get("replaceable")}
        passed_replacements = {item["elementId"] for item in (layout or {}).get("replacementTests", []) if item.get("status") == "passed" and (case_directory / item["renderStill"]).is_file()}
        replacement_ok = replaceable.issubset(passed_replacements)
        replacement_status = "not_applicable" if not replaceable else None
        check("replacement-smoke", replacement_ok, f"covered={len(replaceable & passed_replacements)}/{len(replaceable)}", "layout", "reusability", replacement_status)

        continuity_ok = motion is not None and motion.get("continuity", {}).get("status") == "passed" and (case_directory / motion["continuity"]["evidence"]).is_file()
        check("motion-continuity", continuity_ok, f"status={(motion or {}).get('continuity', {}).get('status', 'missing')}", "motion", "continuity")

        manual = {item.get("id"): item for item in qa_gates.get("checks", [])}
        live = manual.get("live-elements")
        check("live-elements", bool(live and live.get("status") == "pass"), live.get("observation", "Missing live-elements audit") if live else "Missing live-elements audit", (live or {}).get("owner", "layout"), "reusability")
        excluded = manual.get("excluded-regions")
        exclusions_exist = bool(scope.get("exclude"))
        excluded_ok = bool(excluded and excluded.get("status") == "pass") if exclusions_exist else bool(excluded and excluded.get("status") in {"pass", "not_applicable"})
        excluded_status = None if exclusions_exist else (excluded or {}).get("status", "fail")
        check("excluded-regions", excluded_ok, excluded.get("observation", "Missing excluded-regions audit") if excluded else "Missing excluded-regions audit", (excluded or {}).get("owner", "qa"), "scope", excluded_status)
    hard_failed = any(item["status"] == "fail" for item in checks)

    if not hard_failed and args.visual_status == "fail":
        issues.append({
            "id": "issue-visual-fidelity", "type": "geometry" if args.owner == "layout" else "motion" if args.owner == "motion" else "render",
            "targetId": args.target_id, "owner": args.owner, "severity": "high",
            "observation": args.observation, "evidence": rel(evidence_directory / "comparison.png", case_directory),
        })
    checks.append({
        "id": "visual-fidelity",
        "status": "pass" if args.visual_status == "pass" and not hard_failed else "fail" if args.visual_status == "fail" else "not_applicable",
        "evidence": args.observation,
    })
    if hard_failed or args.visual_status == "fail":
        status = "needs_revision"
    elif args.visual_status == "pass":
        status = "passed"
    else:
        status = "pending"

    artifacts = {"rawReport": rel(evidence_directory / "report.json", case_directory)}
    if (evidence_directory / "comparison.png").exists():
        artifacts["comparison"] = rel(evidence_directory / "comparison.png", case_directory)
    if qa_gates_path and qa_gates_path.is_file():
        artifacts["qaGates"] = rel(qa_gates_path, case_directory)
    report = {
        "schemaVersion": state.get("schemaVersion", "1.1"), "caseId": state["caseId"], "status": status,
        "correctionPass": state["iteration"]["correctionsUsed"],
        "source": {key: source_probe[key] for key in ["width", "height", "fps", "durationInFrames", "hasAudio"]},
        "render": {key: render_probe[key] for key in ["width", "height", "fps", "durationInFrames", "hasAudio"]},
        "checks": checks,
        "metrics": {
            "meanAbsRgbDeltaAverage": raw["mean_abs_rgb_delta_average"],
            "meanAbsRgbDeltaWorst": raw["mean_abs_rgb_delta_worst"],
            "worstDeltaFrame": raw["worst_delta_frame"],
        },
        "issues": issues, "knownDifferences": state["knownDifferences"],
        "artifacts": artifacts,
    }
    validation_directory.mkdir(parents=True, exist_ok=True)
    report_path = validation_directory / "report.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    state["files"]["validation"] = "validation/report.json"
    if status == "passed":
        state["stages"]["qa"] = "passed"
        state["status"] = "passed"
    else:
        state["stages"]["qa"] = "needs_review"
        state["status"] = "in_progress"
    case_path.write_text(json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": status, "report": str(report_path), "evidence": str(evidence_directory)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
