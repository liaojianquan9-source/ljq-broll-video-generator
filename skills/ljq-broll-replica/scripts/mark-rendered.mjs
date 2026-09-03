#!/usr/bin/env node

import {readFile, stat, writeFile} from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const [caseArgument, renderArgument] = process.argv.slice(2);
if (!caseArgument || !renderArgument) {
  console.error('Usage: mark-rendered.mjs <case-directory> <render-file>');
  process.exit(2);
}
const caseDirectory = path.resolve(caseArgument);
const renderPath = path.resolve(renderArgument);
const relative = path.relative(caseDirectory, renderPath);
if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Render file must stay inside the case directory');
if (!(await stat(renderPath)).isFile()) throw new Error(`Render file does not exist: ${renderPath}`);
const casePath = path.join(caseDirectory, 'case.json');
const state = JSON.parse(await readFile(casePath, 'utf8'));
state.files.render = relative.split(path.sep).join('/');
state.stages.implementation = 'passed';
state.stages.qa = 'pending';
state.status = 'ready_for_qa';
await writeFile(casePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
console.log(`Marked implementation passed: ${relative}`);
