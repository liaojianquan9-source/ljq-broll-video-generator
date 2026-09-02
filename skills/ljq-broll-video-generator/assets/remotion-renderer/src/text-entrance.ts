type PathPoint = readonly [progress: number, xEm: number, yEm: number];

// A compact, renderer-independent reconstruction of the observed “jump in” path.
// Positive x/y means right/down. The path rises past the baseline, then settles.
const jumpInPath: readonly PathPoint[] = [
  [0, 5.416667, 2.625],
  [0.041667, 5.388011, 2.603305],
  [0.083333, 5.296652, 2.534209],
  [0.125, 5.135004, 2.41247],
  [0.166667, 4.897993, 2.23524],
  [0.208333, 4.586087, 2.004483],
  [0.25, 4.208328, 1.729181],
  [0.291667, 3.78304, 1.425484],
  [0.333333, 3.334377, 1.113536],
  [0.375, 2.886114, 0.812431],
  [0.416667, 2.456643, 0.536335],
  [0.458333, 2.057263, 0.293687],
  [0.5, 1.693289, 0.088286],
  [0.541667, 1.365943, -0.078779],
  [0.583333, 1.074117, -0.20744],
  [0.625, 0.81572, -0.297165],
  [0.666667, 0.588995, -0.34518],
  [0.708333, 0.395574, -0.344047],
  [0.75, 0.248259, -0.286098],
  [0.791667, 0.160457, -0.193388],
  [0.833333, 0.111407, -0.106219],
  [0.875, 0.074255, -0.041995],
  [0.916667, 0.037245, -0.008011],
  [0.958333, 0.009355, -0.000208],
  [1, 0, 0],
];

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

const pointAt = (progress: number): readonly [number, number] => {
  const value = clamp01(progress);
  for (let index = 0; index < jumpInPath.length - 1; index += 1) {
    const left = jumpInPath[index];
    const right = jumpInPath[index + 1];
    if (value <= right[0]) {
      const span = right[0] - left[0];
      const local = span === 0 ? 0 : (value - left[0]) / span;
      return [
        left[1] + (right[1] - left[1]) * local,
        left[2] + (right[2] - left[2]) * local,
      ];
    }
  }
  return [0, 0];
};

export type JumpInCharacterState = {
  readonly xEm: number;
  readonly yEm: number;
  readonly opacity: number;
};

export const jumpInCharacterAt = ({
  frame,
  startFrame,
  durationInFrames,
  characterIndex,
  characterCount,
  intensity = 0.26,
}: {
  readonly frame: number;
  readonly startFrame: number;
  readonly durationInFrames: number;
  readonly characterIndex: number;
  readonly characterCount: number;
  readonly intensity?: number;
}): JumpInCharacterState => {
  const count = Math.max(1, characterCount);
  const duration = Math.max(1, durationInFrames);
  const timingUnits = 26 + 2 * (count - 1);
  const characterStart = startFrame + (duration * 2 * characterIndex) / timingUnits;
  const characterDuration = (duration * 26) / timingUnits;
  const fadeDuration = (duration * 19) / timingUnits;
  const progress = clamp01((frame - characterStart) / characterDuration);
  const opacity = clamp01((frame - characterStart) / fadeDuration);
  const [xEm, yEm] = pointAt(progress);

  return {
    xEm: xEm * intensity,
    yEm: yEm * intensity,
    opacity,
  };
};
