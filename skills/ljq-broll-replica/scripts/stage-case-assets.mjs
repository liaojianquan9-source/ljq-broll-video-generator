#!/usr/bin/env node

import {copyFile, mkdir, readFile, stat} from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const caseArgument = process.argv[2];
if (!caseArgument) {
  console.error('Usage: stage-case-assets.mjs <case-directory>');
  process.exit(2);
}
const caseDirectory = path.resolve(caseArgument);
const caseState = JSON.parse(await readFile(path.join(caseDirectory, 'case.json'), 'utf8'));
const layout = JSON.parse(await readFile(path.join(caseDirectory, caseState.files.layout), 'utf8'));
const publicDirectory = path.join(caseDirectory, 'remotion', 'public');

const stage = async (relativePath, label) => {
  if (!relativePath || /^(https?:|data:|blob:)/.test(relativePath)) return;
  const source = path.resolve(caseDirectory, relativePath);
  const relative = path.relative(caseDirectory, source);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`${label} must stay inside the case directory`);
  if (!(await stat(source)).isFile()) throw new Error(`${label} is not a file: ${relativePath}`);
  const destination = path.resolve(publicDirectory, relativePath);
  const publicRelative = path.relative(publicDirectory, destination);
  if (publicRelative.startsWith('..') || path.isAbsolute(publicRelative)) throw new Error(`${label} has an unsafe stage path`);
  await mkdir(path.dirname(destination), {recursive: true});
  await copyFile(source, destination);
};

for (const element of layout.elements) await stage(element.asset, `asset for ${element.id}`);
if (caseState.source.hasAudio) await stage(caseState.files.source, 'source audio');
console.log(`Staged case assets: ${publicDirectory}`);
