#!/usr/bin/env node

import {access, copyFile, mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';

const caseArgument = process.argv[2];
if (!caseArgument) {
  console.error('Usage: initialize-case-remotion.mjs <case-directory>');
  process.exit(2);
}
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const skillDirectory = path.resolve(scriptDirectory, '..');
const templates = path.join(skillDirectory, 'assets', 'remotion-renderer', 'templates');
const caseDirectory = path.resolve(caseArgument);
const caseState = JSON.parse(await readFile(path.join(caseDirectory, 'case.json'), 'utf8'));
const remotionDirectory = path.join(caseDirectory, 'remotion');
await mkdir(remotionDirectory, {recursive: true});

const exists = async (filePath) => {
  try { await access(filePath); return true; } catch { return false; }
};

for (const name of ['composition.tsx', 'runtime.tsx', 'schema.ts']) {
  const destination = path.join(remotionDirectory, name);
  if (!(await exists(destination))) await copyFile(path.join(templates, name), destination);
}

const motionPath = path.join(caseDirectory, 'specs', 'motion.json');
if (!(await exists(motionPath))) {
  await mkdir(path.dirname(motionPath), {recursive: true});
  const placeholder = {
    schemaVersion: '1.1',
    caseId: caseState.caseId,
    durationInFrames: caseState.source.decodedFrames,
    motions: [],
  };
  await writeFile(motionPath, `${JSON.stringify(placeholder, null, 2)}\n`, 'utf8');
}

caseState.files.composition = 'remotion/composition.tsx';
caseState.files.propsSchema = 'remotion/schema.ts';
await writeFile(path.join(caseDirectory, 'case.json'), `${JSON.stringify(caseState, null, 2)}\n`, 'utf8');
console.log(`Initialized editable Remotion case: ${remotionDirectory}`);
