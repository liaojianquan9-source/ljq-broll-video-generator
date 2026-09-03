#!/usr/bin/env node

import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {access, readFile, stat} from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath, pathToFileURL} from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const skillDirectory = path.resolve(scriptDirectory, '..');
const schemaDirectory = path.join(skillDirectory, 'schemas');
const jsonFileKeys = new Map([
  ['layout', 'layout'],
  ['motion', 'motion'],
  ['validation', 'validation'],
]);
const reservedTargets = new Set(['@camera', '@scene', '@transition']);

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);
const near = (left, right, epsilon = 1e-6) => Math.abs(left - right) <= epsilon;

const readJson = async (filePath) => JSON.parse(await readFile(filePath, 'utf8'));

const safeCasePath = (caseDirectory, relativePath, label, errors) => {
  if (typeof relativePath !== 'string' || relativePath.length === 0) {
    errors.push(`${label} must be a non-empty relative path`);
    return null;
  }
  const resolved = path.resolve(caseDirectory, relativePath);
  const relative = path.relative(caseDirectory, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    errors.push(`${label} must stay inside the case directory`);
    return null;
  }
  return resolved;
};

const sha256 = async (filePath) => {
  const digest = createHash('sha256');
  for await (const chunk of createReadStream(filePath)) digest.update(chunk);
  return digest.digest('hex');
};

const formatSchemaError = (label, item) => {
  const location = item.instancePath || '/';
  const detail = item.keyword === 'additionalProperties'
    ? `unexpected property "${item.params.additionalProperty}"`
    : item.message;
  return `${label}${location}: ${detail}`;
};

export const validateCase = async (caseArgument, {complete = false} = {}) => {
  const caseDirectory = path.resolve(caseArgument);
  const errors = [];
  const documents = {};
  const resolvedFiles = {};

  const schemas = {};
  for (const name of ['case', 'layout', 'motion', 'validation']) {
    try {
      schemas[name] = await readJson(path.join(schemaDirectory, `${name}.schema.json`));
    } catch (cause) {
      errors.push(`schema ${name} cannot be read: ${cause.message}`);
    }
  }
  if (errors.length > 0) return {caseDirectory, errors, counts: {elements: 0, motions: 0}};

  const ajv = new Ajv2020({allErrors: true, strict: true, strictRequired: false, allowUnionTypes: true});
  const validators = Object.fromEntries(Object.entries(schemas).map(([name, schema]) => [name, ajv.compile(schema)]));

  try {
    documents.case = await readJson(path.join(caseDirectory, 'case.json'));
  } catch (cause) {
    errors.push(`case.json cannot be read as JSON: ${cause.message}`);
    return {caseDirectory, errors, counts: {elements: 0, motions: 0}};
  }

  if (!validators.case(documents.case)) {
    errors.push(...validators.case.errors.map((item) => formatSchemaError('case.json', item)));
  }

  const caseState = documents.case;
  if (!isObject(caseState.files)) {
    return {caseDirectory, errors, counts: {elements: 0, motions: 0}};
  }

  for (const [key, schemaName] of jsonFileKeys) {
    const relativePath = caseState.files[key];
    if (relativePath === null || relativePath === undefined) continue;
    const resolved = safeCasePath(caseDirectory, relativePath, `case.json.files.${key}`, errors);
    if (!resolved) continue;
    resolvedFiles[key] = resolved;
    try {
      documents[key] = await readJson(resolved);
      if (!validators[schemaName](documents[key])) {
        errors.push(...validators[schemaName].errors.map((item) => formatSchemaError(`${relativePath}`, item)));
      }
    } catch (cause) {
      errors.push(`${relativePath} cannot be read as JSON: ${cause.message}`);
    }
  }

  for (const key of ['source', 'sourceEvidence', 'composition', 'propsSchema', 'render']) {
    const relativePath = caseState.files[key];
    if (relativePath === null || relativePath === undefined) continue;
    const resolved = safeCasePath(caseDirectory, relativePath, `case.json.files.${key}`, errors);
    if (!resolved) continue;
    resolvedFiles[key] = resolved;
    try {
      await access(resolved);
    } catch {
      errors.push(`case.json.files.${key} does not exist: ${relativePath}`);
    }
  }

  const requireFile = (stage, key) => {
    const state = caseState.stages?.[stage];
    if ((state === 'passed' || (complete && state !== 'skipped')) && !caseState.files[key]) {
      errors.push(`stage ${stage} requires case.json.files.${key}`);
    }
  };
  requireFile('preflight', 'source');
  requireFile('preflight', 'sourceEvidence');
  requireFile('layout', 'layout');
  requireFile('layout', 'composition');
  requireFile('layout', 'propsSchema');
  requireFile('motion', 'motion');
  requireFile('implementation', 'composition');
  requireFile('implementation', 'propsSchema');
  requireFile('implementation', 'render');
  requireFile('qa', 'validation');
  requireFile('qa', 'render');

  if (complete || caseState.status === 'passed') {
    for (const stage of ['preflight', 'layout', 'motion', 'implementation', 'qa']) {
      if (caseState.stages?.[stage] !== 'passed') errors.push(`complete case requires stage ${stage} to be passed`);
    }
    if (caseState.status !== 'passed') errors.push('complete case requires case.json.status to be "passed"');
    if (documents.validation?.status !== 'passed') errors.push('complete case requires validation.status to be "passed"');
  }

  if (resolvedFiles.source && isObject(caseState.source)) {
    try {
      const sourceStat = await stat(resolvedFiles.source);
      if (sourceStat.size !== caseState.source.bytes) errors.push('case.json.source.bytes does not match the case-local source file');
      const digest = await sha256(resolvedFiles.source);
      if (digest.toLowerCase() !== String(caseState.source.sha256).toLowerCase()) errors.push('case.json.source.sha256 does not match the case-local source file');
    } catch {
      // Missing-file error was already recorded above.
    }
  }

  const layout = documents.layout;
  const motion = documents.motion;
  const validation = documents.validation;
  const elementIds = new Set();
  if (layout) {
    if (layout.caseId !== caseState.caseId) errors.push('layout.caseId must match case.json.caseId');
    if (layout.canvas) {
      for (const key of ['width', 'height']) {
        if (layout.canvas[key] !== caseState.source?.[key]) errors.push(`layout.canvas.${key} must match case.json.source.${key}`);
      }
      if (!near(layout.canvas.fps, caseState.source?.fps)) errors.push('layout.canvas.fps must match case.json.source.fps');
      if (layout.canvas.durationInFrames !== caseState.source?.decodedFrames) errors.push('layout.canvas.durationInFrames must match case.json.source.decodedFrames');
    }
    if (layout.settledFrame?.frame >= layout.canvas?.durationInFrames) errors.push('layout.settledFrame.frame must be inside the timeline');

    for (const [index, element] of (layout.elements ?? []).entries()) {
      if (elementIds.has(element.id)) errors.push(`layout.elements[${index}].id duplicates "${element.id}"`);
      elementIds.add(element.id);
      if (element.asset) {
        const assetPath = safeCasePath(caseDirectory, element.asset, `layout.elements[${index}].asset`, errors);
        if (assetPath) {
          try { await access(assetPath); } catch { errors.push(`layout.elements[${index}].asset does not exist: ${element.asset}`); }
        }
      }
    }
    const byId = new Map((layout.elements ?? []).map((element) => [element.id, element]));
    for (const [index, element] of (layout.elements ?? []).entries()) {
      if (element.parentId && !byId.has(element.parentId)) errors.push(`layout.elements[${index}].parentId references missing element "${element.parentId}"`);
      const visited = new Set([element.id]);
      let parent = element.parentId;
      while (parent && byId.has(parent)) {
        if (visited.has(parent)) {
          errors.push(`layout.elements[${index}] participates in a parent cycle`);
          break;
        }
        visited.add(parent);
        parent = byId.get(parent).parentId;
      }
    }
  }

  const checkTrack = (track, at, duration) => {
    let previous = -1;
    for (const [index, keyframe] of track.entries()) {
      if (keyframe.frame <= previous) errors.push(`${at} frames must strictly increase`);
      if (keyframe.frame >= duration) errors.push(`${at}[${index}].frame must be smaller than durationInFrames`);
      previous = keyframe.frame;
    }
  };
  if (motion) {
    if (motion.caseId !== caseState.caseId) errors.push('motion.caseId must match case.json.caseId');
    if (motion.durationInFrames !== caseState.source?.decodedFrames) errors.push('motion.durationInFrames must match case.json.source.decodedFrames');
    const motionIds = new Set();
    for (const [index, item] of (motion.motions ?? []).entries()) {
      const at = `motion.motions[${index}]`;
      if (motionIds.has(item.id)) errors.push(`${at}.id duplicates "${item.id}"`);
      motionIds.add(item.id);
      if (!elementIds.has(item.targetId) && !reservedTargets.has(item.targetId)) errors.push(`${at}.targetId references missing element "${item.targetId}"`);
      if (item.firstVisible > item.settledFrame) errors.push(`${at}.firstVisible cannot be after settledFrame`);
      if (item.settledFrame > item.endFrame) errors.push(`${at}.settledFrame cannot be after endFrame`);
      if (item.endFrame >= motion.durationInFrames) errors.push(`${at}.endFrame must be smaller than durationInFrames`);
      for (const [property, track] of Object.entries(item.transform ?? {})) {
        checkTrack(track, `${at}.transform.${property}`, motion.durationInFrames);
        if (property === 'opacity' && track.some(({value}) => value < 0 || value > 1)) errors.push(`${at}.transform.opacity values must stay between 0 and 1`);
      }
      for (const [property, track] of Object.entries(item.effects ?? {})) checkTrack(track, `${at}.effects.${property}`, motion.durationInFrames);
      if (item.reveal) {
        checkTrack(item.reveal.progress, `${at}.reveal.progress`, motion.durationInFrames);
        if (item.reveal.progress.some(({value}) => value < 0 || value > 1)) errors.push(`${at}.reveal.progress values must stay between 0 and 1`);
      }
      if (item.textAnimation) {
        if (item.textAnimation.startFrame > item.textAnimation.endFrame) errors.push(`${at}.textAnimation.startFrame cannot be after endFrame`);
        if (item.textAnimation.endFrame >= motion.durationInFrames) errors.push(`${at}.textAnimation.endFrame must be smaller than durationInFrames`);
      }
    }
  }

  if (validation) {
    if (validation.caseId !== caseState.caseId) errors.push('validation.caseId must match case.json.caseId');
    if (validation.correctionPass !== caseState.iteration?.correctionsUsed) errors.push('validation.correctionPass must match case.json.iteration.correctionsUsed');
    for (const [index, issue] of (validation.issues ?? []).entries()) {
      if (issue.targetId && !elementIds.has(issue.targetId) && !reservedTargets.has(issue.targetId)) errors.push(`validation.issues[${index}].targetId references missing element "${issue.targetId}"`);
    }
    if (validation.status === 'passed') {
      if ((validation.checks ?? []).some((check) => check.status === 'fail')) errors.push('validation.status cannot be passed while a check fails');
      if ((validation.issues ?? []).some((issue) => issue.severity === 'high')) errors.push('validation.status cannot be passed while a high-severity issue remains');
    }
    const expected = {
      width: caseState.source?.width,
      height: caseState.source?.height,
      durationInFrames: caseState.source?.decodedFrames,
      hasAudio: caseState.source?.hasAudio,
    };
    for (const side of ['source', 'render']) {
      for (const [key, value] of Object.entries(expected)) {
        if (validation[side]?.[key] !== value) errors.push(`validation.${side}.${key} must match case.json.source.${key}`);
      }
      if (!near(validation[side]?.fps, caseState.source?.fps, 0.01)) errors.push(`validation.${side}.fps must match case.json.source.fps`);
    }
  }

  return {
    caseDirectory,
    errors,
    counts: {elements: elementIds.size, motions: motion?.motions?.length ?? 0},
    correctionPass: validation?.correctionPass ?? caseState.iteration?.correctionsUsed ?? 0,
  };
};

export const runCli = async (argv = process.argv.slice(2)) => {
  const complete = argv.includes('--complete');
  const caseArgument = argv.find((argument) => !argument.startsWith('--'));
  if (!caseArgument) {
    console.error('Usage: validate-case.mjs <case-directory> [--complete]');
    return 2;
  }
  const result = await validateCase(caseArgument, {complete});
  if (result.errors.length > 0) {
    console.error(`Invalid case: ${result.caseDirectory}`);
    for (const message of result.errors) console.error(`- ${message}`);
    return 1;
  }
  console.log(`Valid case: ${result.caseDirectory}`);
  console.log(`  elements: ${result.counts.elements}`);
  console.log(`  motions: ${result.counts.motions}`);
  console.log(`  correction pass: ${result.correctionPass}/2`);
  return 0;
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(await runCli());
