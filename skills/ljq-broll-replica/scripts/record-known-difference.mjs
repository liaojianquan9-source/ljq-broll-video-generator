#!/usr/bin/env node

import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const [caseArgument, ...differenceParts] = process.argv.slice(2);
const difference = differenceParts.join(' ').trim();
if (!caseArgument || !difference) {
  console.error('Usage: record-known-difference.mjs <case-directory> <difference>');
  process.exit(2);
}
const caseDirectory = path.resolve(caseArgument);
const casePath = path.join(caseDirectory, 'case.json');
const state = JSON.parse(await readFile(casePath, 'utf8'));
if (!state.knownDifferences.includes(difference)) state.knownDifferences.push(difference);
state.status = 'blocked';
state.stages.qa = 'blocked';
state.iteration.lastRootCause = difference;
await writeFile(casePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
console.log(`Recorded known difference and stopped: ${difference}`);
