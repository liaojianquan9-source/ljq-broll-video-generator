#!/usr/bin/env node

import {access, mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const argv = process.argv.slice(2);
const caseArgument = argv[0];
const option = (name) => {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : null;
};
const liveStatus = option('--live-status');
const liveEvidence = option('--live-evidence');
const liveObservation = option('--live-observation');
const excludedStatus = option('--excluded-status');
const excludedEvidence = option('--excluded-evidence');
const excludedObservation = option('--excluded-observation');
const statuses = new Set(['pass', 'fail', 'not_applicable']);
if (!caseArgument || !statuses.has(liveStatus) || !statuses.has(excludedStatus) || !liveEvidence || !excludedEvidence || !liveObservation || !excludedObservation) {
  console.error('Usage: record-qa-gates.mjs <case-directory> --live-status <pass|fail> --live-evidence <path> --live-observation <text> --excluded-status <pass|fail|not_applicable> --excluded-evidence <path> --excluded-observation <text>');
  process.exit(2);
}
if (liveStatus === 'not_applicable') throw new Error('live-elements cannot be not_applicable');

const caseDirectory = path.resolve(caseArgument);
const resolveEvidence = async (value, label) => {
  const resolved = path.resolve(caseDirectory, value);
  const relative = path.relative(caseDirectory, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`${label} must stay inside the case directory`);
  await access(resolved);
  return relative.split(path.sep).join('/');
};
const statePath = path.join(caseDirectory, 'case.json');
const state = JSON.parse(await readFile(statePath, 'utf8'));
const manifest = {
  schemaVersion: '1.2',
  caseId: state.caseId,
  checks: [
    {id: 'live-elements', status: liveStatus, owner: 'layout', observation: liveObservation, evidence: await resolveEvidence(liveEvidence, 'live evidence')},
    {id: 'excluded-regions', status: excludedStatus, owner: 'qa', observation: excludedObservation, evidence: await resolveEvidence(excludedEvidence, 'excluded evidence')},
  ],
};
const output = path.join(caseDirectory, 'validation', 'gates.json');
await mkdir(path.dirname(output), {recursive: true});
await writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
state.files.qaGates = 'validation/gates.json';
await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
console.log(`Recorded QA gates: ${output}`);
