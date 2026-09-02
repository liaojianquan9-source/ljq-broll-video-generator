#!/usr/bin/env node

import {copyFile, mkdir, readFile, rm, stat, writeFile} from 'node:fs/promises';
import path from 'node:path';

const [sceneArg, publicArg, outputArg] = process.argv.slice(2);
if (!sceneArg || !publicArg || !outputArg) {
  console.error('Usage: stage-scene.mjs <scene.json> <renderer-public> <staged.json>');
  process.exit(2);
}

const scenePath = path.resolve(sceneArg);
const publicDir = path.resolve(publicArg);
const outputPath = path.resolve(outputArg);
const scene = JSON.parse(await readFile(scenePath, 'utf8'));
const safeId = String(scene.id ?? 'scene').replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 80) || 'scene';
const relativeStageDir = path.posix.join('_staged', safeId);
const stageDir = path.join(publicDir, '_staged', safeId);

await mkdir(publicDir, {recursive: true});
await rm(stageDir, {recursive: true, force: true});
await mkdir(stageDir, {recursive: true});

const exists = async (candidate) => {
  try {
    return (await stat(candidate)).isFile();
  } catch {
    return false;
  }
};

for (const [index, element] of (scene.elements ?? []).entries()) {
  if (!['image', 'video'].includes(element.type) || !element.src) continue;
  if (/^(https?:|data:|blob:)/.test(element.src)) continue;

  const fromScene = path.isAbsolute(element.src)
    ? element.src
    : path.resolve(path.dirname(scenePath), element.src);
  const fromPublic = path.resolve(publicDir, element.src);

  if (await exists(fromScene)) {
    const extension = path.extname(fromScene);
    const basename = path
      .basename(fromScene, extension)
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .slice(0, 60);
    const stagedName = `${String(index).padStart(2, '0')}-${basename || 'asset'}${extension.toLowerCase()}`;
    await copyFile(fromScene, path.join(stageDir, stagedName));
    element.src = path.posix.join(relativeStageDir, stagedName);
    continue;
  }

  if (await exists(fromPublic)) continue;

  if (scene.renderMode === 'final') {
    console.error(`Missing media for element "${element.id}": ${element.src}`);
    process.exit(1);
  }
}

await mkdir(path.dirname(outputPath), {recursive: true});
await writeFile(outputPath, `${JSON.stringify(scene, null, 2)}\n`, 'utf8');
console.log(`Staged scene: ${outputPath}`);
