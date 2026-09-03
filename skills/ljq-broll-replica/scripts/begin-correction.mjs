#!/usr/bin/env node

import {access, copyFile, mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const argv = process.argv.slice(2);
const caseArgument = argv[0];
const option = (name) => {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : null;
};
const owner = option('--owner');
const rootCause = option('--root-cause');
const allowedOwners = new Set(['preflight', 'layout', 'motion', 'implementation', 'qa']);
if (!caseArgument || !allowedOwners.has(owner) || !rootCause) {
  console.error('Usage: begin-correction.mjs <case-directory> --owner <stage> --root-cause <text>');
  process.exit(2);
}

const caseDirectory = path.resolve(caseArgument);
const casePath = path.join(caseDirectory, 'case.json');
const state = JSON.parse(await readFile(casePath, 'utf8'));
const used = state.iteration.correctionsUsed;
if (state.iteration.maxCorrections !== 2) throw new Error('maxCorrections must remain exactly 2');
if (used >= 2) {
  state.status = 'blocked';
  state.stages.qa = 'blocked';
  state.iteration.lastRootCause = rootCause;
  await writeFile(casePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  console.error('Correction limit reached (2/2). Record a known difference or request new evidence.');
  process.exit(3);
}

const reportPath = path.join(caseDirectory, 'validation', 'report.json');
try {
  await access(reportPath);
  const evidenceDirectory = path.join(caseDirectory, 'validation', 'iterations', `pass-${used}`);
  await mkdir(evidenceDirectory, {recursive: true});
  let snapshot = path.join(evidenceDirectory, 'validation-report.json');
  let suffix = 1;
  while (true) {
    try {
      await access(snapshot);
      snapshot = path.join(evidenceDirectory, `validation-report-${suffix}.json`);
      suffix += 1;
    } catch { break; }
  }
  await copyFile(reportPath, snapshot);
} catch {
  // A manual correction may begin before a QA report exists; state still remains bounded.
}

state.iteration.correctionsUsed = used + 1;
state.iteration.lastRootCause = rootCause;
state.status = 'in_progress';
state.stages[owner] = 'in_progress';
state.stages.qa = owner === 'qa' ? 'in_progress' : 'pending';
if (owner === 'preflight') {
  for (const stage of ['layout', 'motion', 'implementation']) state.stages[stage] = 'pending';
} else if (owner === 'layout' || owner === 'motion') {
  state.stages.implementation = 'pending';
}
if (owner !== 'qa') state.files.render = null;
state.files.validation = null;
await writeFile(casePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
console.log(`Correction ${state.iteration.correctionsUsed}/2 started at ${owner}: ${rootCause}`);
