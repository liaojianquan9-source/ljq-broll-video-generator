#!/usr/bin/env node

import {constants} from 'node:fs';
import {access, mkdir, mkdtemp, readFile, realpath, stat, writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';

const usage = `Usage: render-review-stills.mjs <case-directory> [options]

  --mode static|motion          Default: static; forces motionEnabled false|true
  --frames 82,164               Zero-based integer frames; default: scene settled frames
  --props FILE                 JSON object, absolute or case-relative path inside case
  --composition ID             Default: LjqBrollCase
  --browser-executable PATH    Existing local Chrome/Chromium executable
  --dry-run                    Print plan; no bundle, browser, or output directory
  --help                       Show this help

Exports review probes into a NEW validation/review-stills-* directory, using one
bundle and one browser. Does not overwrite approved stills or edit case/layout/QA
state. Dependencies must already exist in assets/remotion-renderer; no installation
or browser download is attempted. The existing macOS Google Chrome is the fallback.

Both modes require a boolean motionEnabled in the composition's DEFAULT resolved
props, before user overrides. Its declaration does not prove runtime consumption:
inspect the probes and compare static output with the approved layout. The manifest
remains pending_review; this tool never passes a gate. Dry-run does not check this
capability or evaluate composition metadata, and is not static-render evidence.
`;

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const readObject = async (file, label) => {
  const value = JSON.parse(await readFile(file, 'utf8'));
  if (!isObject(value)) throw new Error(`${label} must be a JSON object`);
  return value;
};
const inside = (root, target, label) => {
  const relative = path.relative(root, target);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`${label} must stay inside the case directory`);
  }
  return target;
};
const existingCasePath = async (root, value, label, type = 'file') => {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is required`);
  const candidate = inside(root, path.resolve(root, value), label);
  const resolved = inside(root, await realpath(candidate), label);
  const info = await stat(resolved);
  if (!(type === 'directory' ? info.isDirectory() : info.isFile())) {
    throw new Error(`${label} must be a ${type}`);
  }
  return resolved;
};
const optionalDirectory = async (root, value, label) => {
  try { return await existingCasePath(root, value, label, 'directory'); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
};

const parseArgs = (argv) => {
  if (argv.length === 1 && argv[0] === '--help') return {help: true};
  const options = {mode: 'static', composition: 'LjqBrollCase', dryRun: false};
  const valued = new Map([
    ['--mode', 'mode'], ['--frames', 'frames'], ['--props', 'props'],
    ['--composition', 'composition'], ['--browser-executable', 'browserExecutable'],
  ]);
  const seen = new Set();
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith('-')) {
      if (options.caseArgument) throw new Error(`Unexpected argument: ${argument}`);
      options.caseArgument = argument;
      continue;
    }
    if (seen.has(argument)) throw new Error(`Duplicate option: ${argument}`);
    seen.add(argument);
    if (argument === '--dry-run') { options.dryRun = true; continue; }
    if (!valued.has(argument)) throw new Error(`Unknown option: ${argument}`);
    const value = argv[++index];
    if (!value || value.startsWith('--') || !value.trim()) throw new Error(`Missing value for ${argument}`);
    options[valued.get(argument)] = value;
  }
  if (!options.caseArgument) throw new Error('A case directory is required');
  if (!['static', 'motion'].includes(options.mode)) throw new Error('--mode must be static or motion');
  if (options.frames !== undefined) {
    const values = options.frames.split(',').map((value) => value.trim());
    if (values.some((value) => !/^\d+$/.test(value))) throw new Error('--frames must be comma-separated non-negative integers');
    options.frames = [...new Set(values.map(Number))];
  }
  return options;
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) { console.log(usage); return; }
  const caseDirectory = await realpath(path.resolve(options.caseArgument));
  if (!(await stat(caseDirectory)).isDirectory()) throw new Error('Case path must be a directory');
  const caseIndex = await existingCasePath(caseDirectory, 'case.json', 'case.json');
  const state = await readObject(caseIndex, 'case.json');
  if (!isObject(state.files)) throw new Error('case.json.files must be an object');
  const entryPoint = await existingCasePath(caseDirectory, state.files.composition, 'files.composition');
  const layoutPath = await existingCasePath(caseDirectory, state.files.layout, 'files.layout');
  const sourcePath = await existingCasePath(caseDirectory, state.files.source, 'files.source');
  const currentRender = state.files.render == null ? null
    : await existingCasePath(caseDirectory, state.files.render, 'files.render');
  const layout = await readObject(layoutPath, 'layout');
  const frameCount = state.source?.decodedFrames;
  if (!Number.isSafeInteger(frameCount) || frameCount < 1) throw new Error('source.decodedFrames must be a positive integer');
  const scenes = Array.isArray(layout.scenes) ? layout.scenes : [];
  const frames = options.frames ?? [...new Set(scenes.map((scene) => scene.settledFrame?.frame))];
  if (!frames.length || frames.some((frame) => !Number.isSafeInteger(frame) || frame < 0 || frame >= frameCount)) {
    throw new Error(`Frames must be integers in 0..${frameCount - 1}; provide --frames or valid scene settled frames`);
  }
  const propsFile = options.props
    ? await existingCasePath(caseDirectory, options.props, '--props') : null;
  const overrides = propsFile ? await readObject(propsFile, '--props file') : {};
  const publicDir = await optionalDirectory(caseDirectory, path.join(path.dirname(entryPoint), 'public'), 'public directory');
  const validationDir = await optionalDirectory(caseDirectory, 'validation', 'validation directory')
    ?? path.join(caseDirectory, 'validation');
  const reviewNote = 'Review probes only; runtime consumption of motionEnabled and fidelity to approved layout require visual review. No gate is passed.';
  const plan = {
    caseId: state.caseId, mode: options.mode, compositionId: options.composition,
    caseDirectory, caseIndex, entryPoint, layoutPath, sourcePath, currentRender,
    publicDir, propsFile, frames, requestedOverrides: overrides,
    forcedMotionEnabled: options.mode === 'motion',
    outputDirectoryPattern: path.join(validationDir, 'review-stills-XXXXXX'),
    capability: 'unchecked: requires loading composition default props in a browser',
    note: reviewNote,
  };
  if (options.dryRun) {
    console.log(JSON.stringify({dryRun: true, ...plan, actualInputProps: null,
      note: `DRY RUN: static/motion capability and composition metadata are NOT checked. No outputs created. ${reviewNote}`}, null, 2));
    return;
  }

  const rendererDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../assets/remotion-renderer');
  const requireRenderer = createRequire(path.join(rendererDir, 'package.json'));
  const {bundle} = requireRenderer('@remotion/bundler');
  const {openBrowser, renderStill, selectComposition} = requireRenderer('@remotion/renderer');
  const browserExecutable = path.resolve(options.browserExecutable
    ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
  if (!(await stat(browserExecutable)).isFile()) throw new Error('Browser executable must be an existing local file');
  await access(browserExecutable, constants.X_OK);
  await mkdir(validationDir, {recursive: true});
  await existingCasePath(caseDirectory, validationDir, 'validation directory', 'directory');
  const outputDirectory = await mkdtemp(path.join(validationDir, 'review-stills-'));
  console.log(`Review output: ${outputDirectory}`);
  const serveUrl = await bundle({
    entryPoint, publicDir, rootDir: rendererDir,
    outDir: path.join(outputDirectory, 'bundle'), enableCaching: false,
    webpackOverride: (config) => ({...config, resolve: {...config.resolve,
      modules: [...(config.resolve?.modules ?? ['node_modules']), path.join(rendererDir, 'node_modules')],
    }}),
  });
  const browser = await openBrowser('chrome', {browserExecutable, logLevel: 'error'});
  try {
    // Never let --props invent the capability we are checking.
    const defaults = await selectComposition({serveUrl, id: options.composition, puppeteerInstance: browser, logLevel: 'error'});
    if (typeof defaults.props?.motionEnabled !== 'boolean') {
      throw new Error(`Composition ${options.composition} must declare a boolean motionEnabled in its default resolved props; no stills rendered`);
    }
    const inputProps = {...defaults.props, ...overrides, motionEnabled: options.mode === 'motion'};
    const composition = await selectComposition({serveUrl, id: options.composition, inputProps, puppeteerInstance: browser, logLevel: 'error'});
    if (composition.props?.motionEnabled !== inputProps.motionEnabled) {
      throw new Error('Resolved composition did not retain the forced motionEnabled value');
    }
    if (frames.some((frame) => frame >= composition.durationInFrames)) {
      throw new Error(`Requested frame exceeds resolved composition duration (${composition.durationInFrames} frames)`);
    }
    const stills = [];
    for (const frame of frames) {
      const output = path.join(outputDirectory, `frame-${String(frame).padStart(6, '0')}.png`);
      await renderStill({serveUrl, composition, inputProps, puppeteerInstance: browser,
        frame, imageFormat: 'png', overwrite: false, output, logLevel: 'error'});
      stills.push({frame, source: {video: sourcePath, frame}, render: {frame, output},
        sceneIds: scenes.filter((scene) => frame >= scene.startFrame && frame <= scene.endFrame).map((scene) => scene.id)});
      console.log(`Rendered review probe: frame ${frame}`);
    }
    const manifestPath = path.join(outputDirectory, 'manifest.json');
    const manifest = {
      ...plan, createdAt: new Date().toISOString(), status: 'pending_review',
      outputDirectory, manifestPath, browserExecutable, actualInputProps: inputProps,
      resolvedProps: composition.props,
      capability: 'default resolved props declare boolean motionEnabled; runtime behavior still requires review',
      renderMetadata: {width: composition.width, height: composition.height,
        fps: composition.fps, durationInFrames: composition.durationInFrames},
      stills,
    };
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, {encoding: 'utf8', flag: 'wx'});
    console.log(JSON.stringify({status: 'pending_review', manifest: manifestPath, frames, note: reviewNote}, null, 2));
  } finally {
    await browser.close({silent: true});
  }
};

main().catch((error) => {
  console.error(`Review still export failed: ${error.message}`);
  process.exitCode = 1;
});
