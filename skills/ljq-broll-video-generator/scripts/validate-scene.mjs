#!/usr/bin/env node

import {readFile} from 'node:fs/promises';
import path from 'node:path';

const scenePath = process.argv[2];
if (!scenePath) {
  console.error('Usage: validate-scene.mjs <scene.json>');
  process.exit(2);
}

const allowedTypes = new Set(['shape', 'text', 'image', 'video', 'line']);
const allowedProperties = new Set(['x', 'y', 'scale', 'scaleX', 'scaleY', 'rotation', 'opacity', 'blur', 'reveal']);
const allowedOscillations = new Set(['x', 'y', 'scale', 'rotation']);
const allowedEasings = new Set(['linear', 'in-out-cubic', 'out-cubic', 'out-back']);
const allowedEvidence = new Set(['measured', 'observed', 'inferred', 'default']);

const errors = [];
const warnings = [];
const error = (message) => errors.push(message);
const warn = (message) => warnings.push(message);
const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);

const validateTracks = (ownerAt, tracks, durationInFrames) => {
  for (const [trackIndex, track] of (tracks ?? []).entries()) {
    const trackAt = `${ownerAt}.tracks[${trackIndex}]`;
    if (!allowedProperties.has(track.property)) error(`${trackAt}.property is not supported`);
    if (track.easing !== undefined && !allowedEasings.has(track.easing)) {
      error(`${trackAt}.easing is not supported`);
    }
    if (track.evidence !== undefined && !allowedEvidence.has(track.evidence)) {
      error(`${trackAt}.evidence is not supported`);
    }
    if (!Array.isArray(track.keyframes) || track.keyframes.length === 0) {
      error(`${trackAt}.keyframes must be a non-empty array`);
      continue;
    }
    let previousFrame = -Infinity;
    for (const [keyIndex, keyframe] of track.keyframes.entries()) {
      if (!isFiniteNumber(keyframe?.frame) || !isFiniteNumber(keyframe?.value)) {
        error(`${trackAt}.keyframes[${keyIndex}] needs numeric frame and value`);
        continue;
      }
      if (keyframe.frame <= previousFrame) error(`${trackAt}.keyframes must increase by frame`);
      previousFrame = keyframe.frame;
      if (durationInFrames && keyframe.frame >= durationInFrames) {
        warn(`${trackAt}.keyframes[${keyIndex}] lies after the scene duration`);
      }
      if (['opacity', 'reveal'].includes(track.property) && (keyframe.value < 0 || keyframe.value > 1)) {
        error(`${trackAt}.${track.property} values must stay between 0 and 1`);
      }
      if (['scale', 'scaleX', 'scaleY'].includes(track.property) && keyframe.value < 0) {
        error(`${trackAt}.${track.property} values cannot be negative`);
      }
    }
  }
};

const validateOscillations = (ownerAt, oscillations) => {
  for (const [oscIndex, oscillation] of (oscillations ?? []).entries()) {
    const oscAt = `${ownerAt}.oscillations[${oscIndex}]`;
    if (!allowedOscillations.has(oscillation.property)) error(`${oscAt}.property is not supported`);
    if (!isFiniteNumber(oscillation.start) || oscillation.start < 0) error(`${oscAt}.start is invalid`);
    if (oscillation.end !== undefined && !isFiniteNumber(oscillation.end)) error(`${oscAt}.end is invalid`);
    if (!isFiniteNumber(oscillation.amplitude)) error(`${oscAt}.amplitude is invalid`);
    if (!isFiniteNumber(oscillation.period) || oscillation.period <= 0) error(`${oscAt}.period must be positive`);
    if (oscillation.evidence !== undefined && !allowedEvidence.has(oscillation.evidence)) {
      error(`${oscAt}.evidence is not supported`);
    }
  }
};

let scene;
try {
  scene = JSON.parse(await readFile(scenePath, 'utf8'));
} catch (readError) {
  console.error(`Cannot read JSON: ${readError.message}`);
  process.exit(1);
}

if (scene.schemaVersion !== '1.0') error('schemaVersion must be "1.0"');
if (typeof scene.id !== 'string' || !scene.id.trim()) error('id must be a non-empty string');
if (scene.renderMode !== undefined && !['reference', 'final'].includes(scene.renderMode)) {
  error('renderMode must be "reference" or "final"');
}

if (!scene.canvas || typeof scene.canvas !== 'object') {
  error('canvas is required');
} else {
  for (const field of ['width', 'height', 'fps', 'durationInFrames']) {
    const value = scene.canvas[field];
    if (!Number.isInteger(value) || value <= 0) error(`canvas.${field} must be a positive integer`);
  }
}

if (!Array.isArray(scene.elements) || scene.elements.length === 0) {
  error('elements must be a non-empty array');
}

const ids = new Set();
for (const [index, element] of (scene.elements ?? []).entries()) {
  const at = `elements[${index}]`;
  if (!element || typeof element !== 'object') {
    error(`${at} must be an object`);
    continue;
  }
  if (typeof element.id !== 'string' || !element.id.trim()) {
    error(`${at}.id must be a non-empty string`);
  } else if (ids.has(element.id)) {
    error(`${at}.id duplicates "${element.id}"`);
  } else {
    ids.add(element.id);
  }
  if (!allowedTypes.has(element.type)) error(`${at}.type is not supported`);

  if (element.type === 'line') {
    for (const field of ['from', 'to']) {
      const point = element[field];
      if (!Array.isArray(point) || point.length !== 2 || !point.every(isFiniteNumber)) {
        error(`${at}.${field} must be [x, y] numbers`);
      }
    }
  } else {
    const box = element.box;
    if (!Array.isArray(box) || box.length !== 4 || !box.every(isFiniteNumber)) {
      error(`${at}.box must be [x, y, width, height] numbers`);
    } else {
      if (box[2] <= 0 || box[3] <= 0) error(`${at}.box width and height must be positive`);
      if (box[0] < 0 || box[1] < 0 || box[0] + box[2] > 100 || box[1] + box[3] > 100) {
        warn(`${at}.box extends outside the canvas`);
      }
    }
  }

  if (scene.renderMode === 'final' && ['image', 'video'].includes(element.type) && !element.src) {
    error(`${at}.src is required for final ${element.type}`);
  }

  if (element.type === 'text') {
    if (element.mixBlendMode !== undefined && !['normal', 'difference'].includes(element.mixBlendMode)) {
      error(`${at}.mixBlendMode must be "normal" or "difference"`);
    }
    if (element.segments !== undefined) {
      if (!Array.isArray(element.segments) || element.segments.length === 0) {
        error(`${at}.segments must be a non-empty array`);
      } else {
        for (const [segmentIndex, segment] of element.segments.entries()) {
          const segmentAt = `${at}.segments[${segmentIndex}]`;
          if (typeof segment?.content !== 'string') {
            error(`${segmentAt}.content must be a string`);
          }
        }
      }
    }
    if (element.revealMode !== undefined && !['clip', 'characters'].includes(element.revealMode)) {
      error(`${at}.revealMode must be "clip" or "characters"`);
    }
    if (element.textIndent !== undefined && !isFiniteNumber(element.textIndent)) {
      error(`${at}.textIndent must be a number`);
    }
    if (element.lineHeight !== undefined && (!isFiniteNumber(element.lineHeight) || element.lineHeight <= 0)) {
      error(`${at}.lineHeight must be a positive number`);
    }
    if (element.textEntrance !== undefined) {
      const entranceAt = `${at}.textEntrance`;
      if (!element.textEntrance || typeof element.textEntrance !== 'object' || Array.isArray(element.textEntrance)) {
        error(`${entranceAt} must be an object`);
      } else {
        if (element.textEntrance.preset !== 'jump-in') {
          error(`${entranceAt}.preset must be "jump-in"`);
        }
        for (const field of ['startFrame', 'durationInFrames', 'intensity']) {
          const value = element.textEntrance[field];
          if (value !== undefined && !isFiniteNumber(value)) {
            error(`${entranceAt}.${field} must be a number`);
          }
        }
        if (element.textEntrance.startFrame !== undefined && element.textEntrance.startFrame < 0) {
          error(`${entranceAt}.startFrame cannot be negative`);
        }
        if (element.textEntrance.durationInFrames !== undefined && element.textEntrance.durationInFrames <= 0) {
          error(`${entranceAt}.durationInFrames must be positive`);
        }
        if (element.textEntrance.intensity !== undefined && element.textEntrance.intensity < 0) {
          error(`${entranceAt}.intensity cannot be negative`);
        }
      }
    }
  }

  validateTracks(at, element.tracks, scene.canvas?.durationInFrames);
  validateOscillations(at, element.oscillations);
}

for (const [index, element] of (scene.elements ?? []).entries()) {
  if (element?.type !== 'shape' || element.textAnchor === undefined) continue;
  const anchorAt = `elements[${index}].textAnchor`;
  if (!element.textAnchor || typeof element.textAnchor !== 'object' || Array.isArray(element.textAnchor)) {
    error(`${anchorAt} must be an object`);
    continue;
  }
  const target = (scene.elements ?? []).find((candidate) => candidate?.id === element.textAnchor.elementId);
  if (!target) {
    error(`${anchorAt}.elementId references missing element "${element.textAnchor.elementId}"`);
  } else if (target.type !== 'text') {
    error(`${anchorAt}.elementId must reference a text element`);
  } else {
    const segments = target.segments ?? [{content: target.content ?? target.label ?? ''}];
    if (!Number.isInteger(element.textAnchor.segmentIndex) || element.textAnchor.segmentIndex < 0) {
      error(`${anchorAt}.segmentIndex must be a non-negative integer`);
    } else if (element.textAnchor.segmentIndex >= segments.length) {
      error(`${anchorAt}.segmentIndex is outside the target text segments`);
    }
  }
  for (const field of ['paddingLeft', 'paddingRight', 'top', 'bottom']) {
    const value = element.textAnchor[field];
    if (value !== undefined && !isFiniteNumber(value)) {
      error(`${anchorAt}.${field} must be a number`);
    }
  }
}

const groupIds = new Set();
const groupedElementIds = new Set();
if (scene.groups !== undefined && !Array.isArray(scene.groups)) {
  error('groups must be an array');
}
for (const [groupIndex, group] of (Array.isArray(scene.groups) ? scene.groups : []).entries()) {
  const at = `groups[${groupIndex}]`;
  if (!group || typeof group !== 'object') {
    error(`${at} must be an object`);
    continue;
  }
  if (typeof group.id !== 'string' || !group.id.trim()) {
    error(`${at}.id must be a non-empty string`);
  } else if (groupIds.has(group.id)) {
    error(`${at}.id duplicates "${group.id}"`);
  } else {
    groupIds.add(group.id);
  }
  if (!Array.isArray(group.elementIds) || group.elementIds.length === 0) {
    error(`${at}.elementIds must be a non-empty array`);
  } else {
    for (const [elementIdIndex, elementId] of group.elementIds.entries()) {
      if (typeof elementId !== 'string' || !elementId.trim()) {
        error(`${at}.elementIds[${elementIdIndex}] must be a non-empty string`);
      } else if (!ids.has(elementId)) {
        error(`${at}.elementIds references missing element "${elementId}"`);
      } else if (groupedElementIds.has(elementId)) {
        error(`${at}.elementIds assigns "${elementId}" to more than one group`);
      } else {
        groupedElementIds.add(elementId);
      }
    }
  }
  validateTracks(at, group.tracks, scene.canvas?.durationInFrames);
  validateOscillations(at, group.oscillations);
  for (const [trackIndex, track] of (group.tracks ?? []).entries()) {
    if (['x', 'y'].includes(track.property) && track.keyframes?.length > 2 && track.easing !== 'linear') {
      warn(
        `${at}.tracks[${trackIndex}] uses segmented easing for parent ${track.property}; verify that repeated easing does not create visible stops`,
      );
    }
  }
}

for (const focusId of scene.focus ?? []) {
  if (!ids.has(focusId)) warn(`focus references missing element "${focusId}"`);
}

for (const message of warnings) console.warn(`WARNING: ${message}`);
if (errors.length > 0) {
  for (const message of errors) console.error(`ERROR: ${message}`);
  console.error(`FAILED: ${errors.length} error(s), ${warnings.length} warning(s)`);
  process.exit(1);
}

console.log(
  `OK: ${path.basename(scenePath)} — ${scene.elements.length} element(s), ${scene.canvas.durationInFrames} frame(s) at ${scene.canvas.fps} fps`,
);
