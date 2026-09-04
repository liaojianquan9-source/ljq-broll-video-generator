#!/usr/bin/env node

import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const caseArgument = process.argv[2];
if (!caseArgument) {
  console.error('Usage: analyze-motion-continuity.mjs <case-directory>');
  process.exit(2);
}

const caseDirectory = path.resolve(caseArgument);
const motionPath = path.join(caseDirectory, 'specs', 'motion.json');
const motion = JSON.parse(await readFile(motionPath, 'utf8'));
const spatial = new Set(['x', 'y', 'scaleX', 'scaleY', 'rotationDeg']);

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const cubic = (t, a, b, c, d) => {
  const one = 1 - t;
  return one ** 3 * a + 3 * one ** 2 * t * b + 3 * one * t ** 2 * c + t ** 3 * d;
};
const cubicBezier = (progress, [x1, y1, x2, y2]) => {
  let low = 0;
  let high = 1;
  for (let index = 0; index < 24; index += 1) {
    const middle = (low + high) / 2;
    if (cubic(middle, 0, x1, x2, 1) < progress) low = middle;
    else high = middle;
  }
  return cubic((low + high) / 2, 0, y1, y2, 1);
};
const trackKeyframes = (track) => Array.isArray(track) ? track : track?.keyframes ?? [];
const trackProgress = (track, progress) => {
  if (Array.isArray(track) || track.interpolation === 'linear') return progress;
  return cubicBezier(progress, track.bezier);
};
const valueAt = (track, frame) => {
  const keyframes = trackKeyframes(track);
  if (frame <= keyframes[0].frame) return keyframes[0].value;
  const last = keyframes.at(-1);
  if (frame >= last.frame) return last.value;
  for (let index = 0; index < keyframes.length - 1; index += 1) {
    const left = keyframes[index];
    const right = keyframes[index + 1];
    if (frame <= right.frame) {
      const raw = (frame - left.frame) / Math.max(1, right.frame - left.frame);
      const progress = trackProgress(track, clamp(raw, 0, 1));
      return left.value + (right.value - left.value) * progress;
    }
  }
  return last.value;
};

const windows = [];
let failed = false;
for (const item of motion.motions ?? []) {
  for (const [property, track] of Object.entries(item.transform ?? {})) {
    if (!spatial.has(property)) continue;
    const keyframes = trackKeyframes(track);
    if (keyframes.length < 2) continue;
    const startFrame = keyframes[0].frame;
    const endFrame = keyframes.at(-1).frame;
    const values = [];
    for (let frame = startFrame; frame <= endFrame; frame += 1) values.push(valueAt(track, frame));
    const velocities = values.slice(1).map((value, index) => value - values[index]);
    const span = Math.max(1e-9, Math.max(...values) - Math.min(...values));
    const epsilon = span * 1e-5;
    const significant = velocities.filter((value) => Math.abs(value) > epsilon);
    let duplicateFrames = 0;
    for (let index = 1; index < velocities.length - 1; index += 1) {
      if (Math.abs(velocities[index]) <= epsilon && velocities.slice(index + 1).some((value) => Math.abs(value) > epsilon)) duplicateFrames += 1;
    }
    let unexpectedReversals = 0;
    for (let index = 1; index < significant.length; index += 1) {
      if (Math.sign(significant[index]) !== Math.sign(significant[index - 1])) unexpectedReversals += 1;
    }
    const maxVelocity = Math.max(epsilon, ...velocities.map((value) => Math.abs(value)));
    const jumps = velocities.slice(1).map((value, index) => Math.abs(value - velocities[index]) / maxVelocity);
    const maxVelocityJump = jumps.length === 0 ? 0 : Math.max(...jumps);
    const allowReversal = !Array.isArray(track) && track.allowReversal === true;
    const allowHoldFrames = !Array.isArray(track) && track.allowHoldFrames === true;
    if ((!allowHoldFrames && duplicateFrames > 0) || (!allowReversal && unexpectedReversals > 0) || maxVelocityJump > 0.65) failed = true;
    windows.push({
      targetId: item.targetId,
      property,
      startFrame,
      endFrame,
      duplicateFrames,
      unexpectedReversals,
      maxVelocityJump: Number(maxVelocityJump.toFixed(6)),
    });
  }
}

const evidenceDirectory = path.join(caseDirectory, 'evidence', 'motion');
await mkdir(evidenceDirectory, {recursive: true});
const evidencePath = path.join(evidenceDirectory, 'continuity.json');
const report = {
  status: failed ? 'failed' : 'passed',
  windows,
  rule: 'Active spatial windows must avoid unintended duplicate frames, reversals, and normalized velocity jumps above 0.65.',
};
await writeFile(evidencePath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
motion.schemaVersion = '1.2';
motion.continuity = {
  status: report.status,
  evidence: path.relative(caseDirectory, evidencePath).split(path.sep).join('/'),
  windows,
};
await writeFile(motionPath, `${JSON.stringify(motion, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({status: report.status, evidence: evidencePath, windows: windows.length}));
if (failed) process.exit(1);
