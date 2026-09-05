#!/usr/bin/env node
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {basename, dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

// All inputs are caller supplied; source videos are never modified.
// Requires Node.js, FFmpeg, ffprobe, macOS Swift/AppKit, and a Chinese-capable font.
// Run from any directory, using a NEW output directory:
// node make-comparison.mjs REFERENCE.mp4 REPLICA.mp4 OUTPUT_DIR [FONT_POSTSCRIPT_NAME]
const argv = process.argv.slice(2);
if (argv.length === 1 && ['--help', '-h'].includes(argv[0])) {
  console.log('Usage: node make-comparison.mjs REFERENCE.mp4 REPLICA.mp4 OUTPUT_DIR [FONT_POSTSCRIPT_NAME]\nCreates an 11-second, 30 fps top/bottom comparison, four matched PNGs, and a reduced GIF preview. Existing output media are never overwritten. macOS Swift/AppKit renders only label strips.');
  process.exit(0);
}
if (argv.length < 3 || argv.length > 4) throw new Error('Run with --help for usage.');
const [source, replica, out] = argv.slice(0, 3).map((path) => resolve(path));
const fontName = argv[3] ?? 'PingFangSC-Semibold';
if (source === replica) throw new Error('Reference and replica must be distinct files.');
const commands = [];
function run(binary, args, capture = false) {
  // Keep a portable command record without personal absolute input paths.
  const portable = args.map((a) => a === source ? '<REFERENCE.mp4>' : a === replica ? '<REPLICA.mp4>' : a.startsWith(out) ? `<OUTPUT_DIR>${a.slice(out.length)}` : a);
  commands.push([binary, ...portable]);
  const result = spawnSync(binary, args, {encoding: 'utf8', stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit'});
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${binary} failed (${result.status}): ${result.stderr ?? ''}`);
  return result.stdout?.trim();
}
const digest = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const probe = (path, count = false) => JSON.parse(run('ffprobe', [
  '-v', 'error', ...(count ? ['-count_frames'] : []),
  '-show_entries', 'stream=codec_name,codec_type,width,height,r_frame_rate,avg_frame_rate,nb_frames,nb_read_frames,duration:format=duration,size',
  '-of', 'json', path
], true));
const originals = [source, replica].map((path) => {
  if (!existsSync(path)) throw new Error(`Input missing: ${basename(path)}`);
  const metadata = probe(path, true);
  const videos = metadata.streams.filter((s) => s.codec_type === 'video');
  const video = videos[0];
  if (videos.length !== 1 || video.width !== 1280 || video.height !== 720 || video.avg_frame_rate !== '30/1' || Number(video.nb_read_frames) !== 330 || Math.abs(Number(metadata.format.duration) - 11) > 0.001) {
    throw new Error('Each input must be a synchronized 1280×720, 30 fps, 330-frame, 11-second clip. This case-specific script refuses implicit retiming or cropping.');
  }
  return {filename: basename(path), sha256: digest(path), metadata};
});
const filenames = ['label-source.png', 'label-replica.png', 'label-model.png', 'top-bottom-comparison.mp4', 'comparison-preview.gif', 'publication-manifest.json', ...[82, 164, 247, 329].map((n) => `comparison-frame-${String(n).padStart(3, '0')}.png`)];
for (const name of filenames) {
  if (existsSync(join(out, name))) throw new Error(`Output exists; choose a new directory: ${name}`);
}
mkdirSync(out, {recursive: true});
const scriptDir = dirname(fileURLToPath(import.meta.url));
const swiftScript = join(scriptDir, 'render-labels.swift');
run('swift', ['-module-cache-path', join(out, '.swift-module-cache'), swiftScript, out, fontName]);
// Strip coordinates: source label y=0; source y=80..799; replica label y=800;
// replica y=880..1599; model label y=1600. Both video panes stay 1280×720.
const comparison = join(out, 'top-bottom-comparison.mp4');
run('ffmpeg', [
  '-y', '-hide_banner', '-loglevel', 'error', '-i', source, '-i', replica,
  '-loop', '1', '-framerate', '30', '-i', join(out, 'label-source.png'),
  '-loop', '1', '-framerate', '30', '-i', join(out, 'label-replica.png'),
  '-loop', '1', '-framerate', '30', '-i', join(out, 'label-model.png'),
  '-filter_complex', '[0:v]trim=end_frame=330,setpts=N/(30*TB),setsar=1[src];[1:v]trim=end_frame=330,setpts=N/(30*TB),setsar=1[rep];[2:v]setsar=1[top];[3:v]setsar=1[mid];[4:v]setsar=1[foot];[top][src][mid][rep][foot]vstack=inputs=5:shortest=1,format=yuv420p[v]',
  '-map', '[v]', '-an', '-frames:v', '330', '-r', '30', '-c:v', 'libx264',
  '-crf', '18', '-preset', 'medium', '-movflags', '+faststart', comparison
]);
for (const frame of [82, 164, 247, 329]) {
  run('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', comparison,
    '-vf', `select=eq(n\\,${frame})`, '-frames:v', '1', '-update', '1',
    join(out, `comparison-frame-${String(frame).padStart(3, '0')}.png`)]);
}
run('ffmpeg', [
  '-y', '-hide_banner', '-loglevel', 'error', '-i', comparison,
  '-filter_complex', '[0:v]fps=10,scale=480:630:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle[v]',
  '-map', '[v]', '-an', '-loop', '0', join(out, 'comparison-preview.gif')
]);
const videoCheck = probe(comparison, true);
const stream = videoCheck.streams.find((s) => s.codec_type === 'video');
if (videoCheck.streams.length !== 1 || stream.codec_name !== 'h264' || stream.width !== 1280 || stream.height !== 1680 || stream.avg_frame_rate !== '30/1' || Number(stream.nb_read_frames) !== 330 || Math.abs(Number(videoCheck.format.duration) - 11) > 0.001) throw new Error('Comparison video verification failed.');
const gifCheck = probe(join(out, 'comparison-preview.gif'), true);
if (Math.abs(Number(gifCheck.format.duration) - 11) > 0.001) throw new Error('GIF duration is not 11 seconds.');
for (const [index, path] of [source, replica].entries()) {
  if (digest(path) !== originals[index].sha256) throw new Error('Input hash changed; stop publication.');
}
// The Swift interpreter path is provenance only; remove local installation paths.
const portableCommands = commands.map((command) => command.map((arg) => arg === swiftScript ? '<SCRIPT_DIR>/render-labels.swift' : arg));
const manifest = {
  caseId: 'kimi-k3-000-011-test', model: 'GPT-6 Astra', renderer: 'Remotion',
  durationSeconds: 11, fps: 30, frameCount: 330, videoDimensions: [1280, 1680],
  paneDimensions: [1280, 720], labels: ['原视频效果', '生成的复刻效果', 'GPT-6 Astra + Remotion'],
  labelFont: fontName, referenceAndReplicaUnmodified: true, inputs: originals,
  stillFramesZeroBased: [82, 164, 247, 329],
  preview: {filename: 'comparison-preview.gif', dimensions: [480, 630], fps: 10, durationSeconds: 11, note: 'Reduced-size, reduced-frame-rate GIF preview only; not a fidelity-verification render.'},
  outputs: filenames.filter((f) => existsSync(join(out, f))).map((filename) => ({filename, bytes: statSync(join(out, filename)).size, sha256: digest(join(out, filename))})),
  validation: {video: videoCheck, gif: gifCheck}, commands: portableCommands,
  commandsNote: 'Angle-bracket placeholders identify caller-supplied paths, not literal shell commands.'
};
writeFileSync(join(out, 'publication-manifest.json'), JSON.stringify(manifest, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({status: 'passed', inputsUnchanged: true, video: videoCheck, gif: gifCheck, outputFiles: manifest.outputs}, null, 2));
