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

v12_dir="$(mktemp -d /tmp/ljq-broll-v12-case.XXXXXX)"
trap 'rm -f "$invalid_output"; rm -rf "$v12_dir"' EXIT
node - "$v12_dir" <<'JS'
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const dir = process.argv[2];
for (const sub of ['assets/originals', 'evidence/layout', 'evidence/motion', 'specs', 'remotion', 'validation']) fs.mkdirSync(path.join(dir, sub), {recursive: true});
const source = Buffer.from('v12-source');
fs.writeFileSync(path.join(dir, 'assets/originals/reference.mp4'), source);
for (const file of ['scene-source.png', 'scene-render.png', 'scene-comparison.png', 'replacement-hero.png']) fs.writeFileSync(path.join(dir, 'evidence/layout', file), file);
fs.writeFileSync(path.join(dir, 'evidence/motion/continuity.json'), '{}');
fs.writeFileSync(path.join(dir, 'evidence/source.json'), '{}');
fs.writeFileSync(path.join(dir, 'remotion/composition.tsx'), 'export default null;');
fs.writeFileSync(path.join(dir, 'remotion/schema.ts'), 'export default null;');
const caseState = {
  schemaVersion: '1.2', caseId: 'v12-card', status: 'in_progress',
  source: {path: '/original/source.mp4', bytes: source.length, modifiedTime: '2026-09-05T00:00:00+08:00', sha256: crypto.createHash('sha256').update(source).digest('hex'), width: 1920, height: 1080, fps: 30, durationSeconds: 2, declaredFrames: 60, decodedFrames: 60, shotRange: [0, 59], hasAudio: false},
  scope: {startSeconds: 11, endSeconds: 13, durationSeconds: 2, include: ['B-roll elements'], exclude: [], excludedRegionMode: 'none', exclusionMask: null, confirmation: 'User confirmed 11s–13s.'},
  stages: {preflight: 'passed', layout: 'passed', motion: 'passed', implementation: 'pending', qa: 'pending'},
  files: {source: 'assets/originals/reference.mp4', sourceEvidence: 'evidence/source.json', layout: 'specs/layout.json', motion: 'specs/motion.json', validation: null, composition: 'remotion/composition.tsx', propsSchema: 'remotion/schema.ts', render: null, qaGates: 'validation/gates.json'},
  iteration: {maxCorrections: 2, correctionsUsed: 0, lastRootCause: null}, knownDifferences: []
};
const layout = {
  schemaVersion: '1.2', caseId: 'v12-card', canvas: {width: 1920, height: 1080, fps: 30, durationInFrames: 60, backgroundColor: '#000'},
  scenes: [{id: 'scene-01', startFrame: 0, endFrame: 59, settledFrame: {frame: 30, timeSeconds: 1, evidenceType: 'measured', evidence: 'fixture', confidence: 'high'}, sourceStill: 'evidence/layout/scene-source.png', renderStill: 'evidence/layout/scene-render.png', comparisonStill: 'evidence/layout/scene-comparison.png', status: 'passed', observation: 'fixture'}],
  replacementTests: [{elementId: 'hero', variant: 'alternate image', renderStill: 'evidence/layout/replacement-hero.png', status: 'passed', observation: 'fixture'}],
  elements: [{id: 'hero', type: 'image', name: 'Hero', sceneId: 'scene-01', content: null, asset: 'assets/originals/reference.mp4', assetSource: 'original', completeness: 'complete', bounds: [0, 0, 100, 100], anchor: [0.5, 0.5], cropMode: 'none', zIndex: 1, parentId: null, shape: null, appearance: {objectFit: 'cover'}, replaceable: true, evidence: [{type: 'measured', detail: 'fixture'}], confidence: 'high'}]
};
const motion = {
  schemaVersion: '1.2', caseId: 'v12-card', durationInFrames: 60,
  motions: [{id: 'hero-enter', targetId: 'hero', phase: 'entrance', firstVisible: 0, settledFrame: 30, endFrame: 59, transform: {x: {keyframes: [{frame: 0, value: 100}, {frame: 30, value: 0}], interpolation: 'bezier', bezier: [0.2, 0.8, 0.3, 1]}}, evidence: {type: 'measured', detail: 'fixture', frames: [0, 30]}, confidence: 'high'}],
  continuity: {status: 'passed', evidence: 'evidence/motion/continuity.json', windows: [{targetId: 'hero', property: 'x', startFrame: 0, endFrame: 30, duplicateFrames: 0, unexpectedReversals: 0, maxVelocityJump: 0.1}]}
};
const gates = {schemaVersion: '1.2', caseId: 'v12-card', checks: [{id: 'live-elements', status: 'pass', owner: 'layout', observation: 'fixture', evidence: 'evidence/layout/scene-comparison.png'}, {id: 'excluded-regions', status: 'not_applicable', owner: 'qa', observation: 'fixture', evidence: 'evidence/layout/scene-comparison.png'}]};
for (const [file, value] of [['case.json', caseState], ['specs/layout.json', layout], ['specs/motion.json', motion], ['validation/gates.json', gates]]) fs.writeFileSync(path.join(dir, file), JSON.stringify(value, null, 2));
JS
node "$validator" "$v12_dir"
node - "$v12_dir/specs/layout.json" "$v12_dir/specs/motion.json" "$v12_dir/validation/gates.json" <<'JS'
const fs = require('fs');
const layoutPath = process.argv[2];
const motionPath = process.argv[3];
const gatesPath = process.argv[4];
const layout = require(layoutPath);
layout.replacementTests = [];
fs.writeFileSync(layoutPath, JSON.stringify(layout));
const motion = require(motionPath);
motion.motions[0].transform.x = [{frame: 0, value: 100}, {frame: 15, value: 40}, {frame: 30, value: 0}];
motion.continuity.status = 'failed';
fs.writeFileSync(motionPath, JSON.stringify(motion));
const gates = require(gatesPath);
gates.checks.push({...gates.checks[0], observation: 'duplicate'});
fs.writeFileSync(gatesPath, JSON.stringify(gates));
JS
v12_invalid="$(mktemp /tmp/ljq-broll-v12-invalid.XXXXXX)"
if node "$validator" "$v12_dir" >"$v12_invalid" 2>&1; then
  echo "Expected invalid v1.2 contract to fail" >&2
  exit 1
fi
grep -q 'requires a passed replacement test' "$v12_invalid"
grep -q 'must use a curve track in schema 1.2' "$v12_invalid"
grep -q 'motion.continuity.status must be "passed"' "$v12_invalid"
grep -q 'qa-gates check IDs must be unique' "$v12_invalid"
rm -f "$v12_invalid"
echo "Contract tests passed"
