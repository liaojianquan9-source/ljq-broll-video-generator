#!/usr/bin/env node

import {readFile} from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';

const caseArgument = process.argv[2];
if (!caseArgument) {
  console.error('Usage: validate-case.mjs <case-directory>');
  process.exit(2);
}

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(scriptDirectory, '..');
const caseDirectory = path.resolve(caseArgument);
const errors = [];
const error = (message) => errors.push(message);
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);

const readJson = async (filePath, label) => {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch (readError) {
    error(`${label} cannot be read as JSON: ${readError.message}`);
    return null;
  }
};

for (const schemaName of ['case', 'layout', 'motion', 'validation']) {
  await readJson(path.join(projectDirectory, 'schemas', `${schemaName}.schema.json`), `schema ${schemaName}`);
}

const caseFile = path.join(caseDirectory, 'case.json');
const caseState = await readJson(caseFile, 'case.json');

const requireString = (owner, key, at) => {
  if (typeof owner?.[key] !== 'string' || !owner[key].trim()) {
    error(`${at}.${key} must be a non-empty string`);
    return null;
  }
  return owner[key];
};

const requirePositive = (owner, key, at, integer = false) => {
  const value = owner?.[key];
  if (!isFiniteNumber(value) || value <= 0 || (integer && !Number.isInteger(value))) {
    error(`${at}.${key} must be a positive ${integer ? 'integer' : 'number'}`);
  }
  return value;
};

let layout = null;
let motion = null;
let validation = null;

if (caseState) {
  if (caseState.schemaVersion !== '1.0') error('case.json.schemaVersion must be "1.0"');
  const caseId = requireString(caseState, 'caseId', 'case.json');
  if (!/^[a-z0-9][a-z0-9-]*$/.test(caseId ?? '')) error('case.json.caseId must use lowercase letters, digits, and hyphens');

  if (!isObject(caseState.source)) {
    error('case.json.source must be an object');
  } else {
    requireString(caseState.source, 'path', 'case.json.source');
    requirePositive(caseState.source, 'bytes', 'case.json.source', true);
    requirePositive(caseState.source, 'width', 'case.json.source', true);
    requirePositive(caseState.source, 'height', 'case.json.source', true);
    requirePositive(caseState.source, 'fps', 'case.json.source');
    requirePositive(caseState.source, 'durationSeconds', 'case.json.source');
    requireString(caseState.source, 'modifiedTime', 'case.json.source');
    const sha = requireString(caseState.source, 'sha256', 'case.json.source');
    if (sha && !/^[a-f0-9]{64}$/i.test(sha)) error('case.json.source.sha256 must contain 64 hex characters');
  }

  if (!isObject(caseState.iteration)) {
    error('case.json.iteration must be an object');
  } else {
    const max = caseState.iteration.maxCorrections;
    const used = caseState.iteration.correctionsUsed;
    if (!Number.isInteger(max) || max < 0 || max > 2) error('case.json.iteration.maxCorrections must be an integer from 0 to 2');
    if (!Number.isInteger(used) || used < 0 || used > 2) error('case.json.iteration.correctionsUsed must be an integer from 0 to 2');
    if (Number.isInteger(max) && Number.isInteger(used) && used > max) error('case.json.iteration.correctionsUsed cannot exceed maxCorrections');
  }

  if (!isObject(caseState.files)) {
    error('case.json.files must be an object');
  } else {
    const loadIndexedFile = async (key, label) => {
      const relativePath = requireString(caseState.files, key, 'case.json.files');
      if (!relativePath) return null;
      const absolutePath = path.resolve(caseDirectory, relativePath);
      const relativeCheck = path.relative(caseDirectory, absolutePath);
      if (relativeCheck.startsWith('..') || path.isAbsolute(relativeCheck)) {
        error(`case.json.files.${key} must stay inside the case directory`);
        return null;
      }
      return readJson(absolutePath, label);
    };

    layout = await loadIndexedFile('layout', 'layout spec');
    motion = await loadIndexedFile('motion', 'motion spec');
    validation = await loadIndexedFile('validation', 'validation report');
  }

  const assertCaseId = (document, label) => {
    if (document && document.caseId !== caseId) error(`${label}.caseId must match case.json.caseId`);
  };
  assertCaseId(layout, 'layout spec');
  assertCaseId(motion, 'motion spec');
  assertCaseId(validation, 'validation report');
}

const elementIds = new Set();
if (layout) {
  if (layout.schemaVersion !== '1.0') error('layout.schemaVersion must be "1.0"');
  if (!Array.isArray(layout.elements) || layout.elements.length === 0) {
    error('layout.elements must be a non-empty array');
  }

  for (const [index, element] of (layout.elements ?? []).entries()) {
    const at = `layout.elements[${index}]`;
    const id = requireString(element, 'id', at);
    if (id) {
      if (elementIds.has(id)) error(`${at}.id duplicates "${id}"`);
      elementIds.add(id);
    }
    if (!Array.isArray(element.bounds) || element.bounds.length !== 4 || !element.bounds.every(isFiniteNumber)) {
      error(`${at}.bounds must be four numbers`);
    } else if (element.bounds[2] <= 0 || element.bounds[3] <= 0) {
      error(`${at}.bounds width and height must be positive`);
    }
    if (!Array.isArray(element.anchor) || element.anchor.length !== 2 || !element.anchor.every(isFiniteNumber)) {
      error(`${at}.anchor must be two numbers`);
    } else if (element.anchor.some((value) => value < 0 || value > 1)) {
      error(`${at}.anchor values must stay between 0 and 1`);
    }
    if (!['original', 'found', 'extracted', 'recreated'].includes(element.assetSource)) error(`${at}.assetSource is invalid`);
    if (!['complete', 'visible-only', 'unknown'].includes(element.completeness)) error(`${at}.completeness is invalid`);
    if (!['viewport-clip', 'container-mask', 'asset-crop', 'none'].includes(element.cropMode)) error(`${at}.cropMode is invalid`);
    if (!['high', 'medium', 'low'].includes(element.confidence)) error(`${at}.confidence is invalid`);
    if (!Array.isArray(element.evidence) || element.evidence.length === 0) error(`${at}.evidence must be a non-empty array`);
    if (!isObject(element.appearance)) error(`${at}.appearance must be an object`);
  }

  for (const [index, element] of (layout.elements ?? []).entries()) {
    if (element.parentId && !elementIds.has(element.parentId)) error(`layout.elements[${index}].parentId references missing element "${element.parentId}"`);
    if (element.parentId && element.parentId === element.id) error(`layout.elements[${index}].parentId cannot reference itself`);
  }
}

const reservedTargets = new Set(['@camera', '@scene', '@transition']);
if (motion) {
  if (motion.schemaVersion !== '1.0') error('motion.schemaVersion must be "1.0"');
  requirePositive(motion, 'durationInFrames', 'motion', true);
  if (!Array.isArray(motion.motions)) error('motion.motions must be an array');

  const motionIds = new Set();
  for (const [index, item] of (motion.motions ?? []).entries()) {
    const at = `motion.motions[${index}]`;
    const id = requireString(item, 'id', at);
    if (id) {
      if (motionIds.has(id)) error(`${at}.id duplicates "${id}"`);
      motionIds.add(id);
    }
    const targetId = requireString(item, 'targetId', at);
    if (targetId && !elementIds.has(targetId) && !reservedTargets.has(targetId)) error(`${at}.targetId references missing element "${targetId}"`);
    for (const key of ['firstVisible', 'settledFrame', 'endFrame']) {
      if (!Number.isInteger(item[key]) || item[key] < 0) error(`${at}.${key} must be a non-negative integer`);
    }
    if (Number.isInteger(item.firstVisible) && Number.isInteger(item.settledFrame) && item.firstVisible > item.settledFrame) error(`${at}.firstVisible cannot be after settledFrame`);
    if (Number.isInteger(item.settledFrame) && Number.isInteger(item.endFrame) && item.settledFrame > item.endFrame) error(`${at}.settledFrame cannot be after endFrame`);
    if (!item.transform && !item.reveal) error(`${at} must define transform or reveal`);

    for (const [property, track] of Object.entries(item.transform ?? {})) {
      if (!Array.isArray(track) || track.length === 0) {
        error(`${at}.transform.${property} must be a non-empty keyframe array`);
        continue;
      }
      let previousFrame = -Infinity;
      for (const [keyframeIndex, keyframe] of track.entries()) {
        if (!isFiniteNumber(keyframe?.frame) || !isFiniteNumber(keyframe?.value)) {
          error(`${at}.transform.${property}[${keyframeIndex}] needs numeric frame and value`);
          continue;
        }
        if (keyframe.frame <= previousFrame) error(`${at}.transform.${property} frames must strictly increase`);
        previousFrame = keyframe.frame;
      }
    }
  }
}

if (validation) {
  if (validation.schemaVersion !== '1.0') error('validation.schemaVersion must be "1.0"');
  if (!Number.isInteger(validation.correctionPass) || validation.correctionPass < 0 || validation.correctionPass > 2) error('validation.correctionPass must be an integer from 0 to 2');
  for (const [index, issue] of (validation.issues ?? []).entries()) {
    if (!['preflight', 'layout', 'motion', 'implementation', 'qa'].includes(issue.owner)) error(`validation.issues[${index}].owner is invalid`);
    if (issue.targetId && !elementIds.has(issue.targetId) && !reservedTargets.has(issue.targetId)) error(`validation.issues[${index}].targetId references missing element "${issue.targetId}"`);
  }
}

if (errors.length > 0) {
  console.error(`Invalid case: ${caseDirectory}`);
  for (const message of errors) console.error(`- ${message}`);
  process.exit(1);
}

console.log(`Valid case: ${caseDirectory}`);
console.log(`  elements: ${elementIds.size}`);
console.log(`  motions: ${motion?.motions?.length ?? 0}`);
console.log(`  correction pass: ${validation?.correctionPass ?? 0}/2`);
