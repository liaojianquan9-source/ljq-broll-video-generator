import {Easing, interpolate} from 'remotion';
import type {
  EasingName,
  MotionProperty,
  MotionState,
  MotionTrack,
  Oscillation,
} from './types';

const defaults: MotionState = {
  x: 0,
  y: 0,
  scale: 1,
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
  opacity: 1,
  blur: 0,
  reveal: 1,
};

const easingFor = (name: EasingName | undefined) => {
  if (name === 'in-out-cubic') return Easing.inOut(Easing.cubic);
  if (name === 'out-cubic') return Easing.out(Easing.cubic);
  if (name === 'out-back') return Easing.out(Easing.back(1.35));
  return Easing.linear;
};

const valueForTrack = (track: MotionTrack, frame: number): number => {
  const points = [...track.keyframes].sort((a, b) => a.frame - b.frame);
  if (points.length === 0) return defaults[track.property];
  if (points.length === 1 || frame <= points[0].frame) return points[0].value;
  if (frame >= points[points.length - 1].frame) return points[points.length - 1].value;

  for (let index = 0; index < points.length - 1; index += 1) {
    const left = points[index];
    const right = points[index + 1];
    if (frame <= right.frame) {
      return interpolate(frame, [left.frame, right.frame], [left.value, right.value], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: easingFor(track.easing),
      });
    }
  }

  return points[points.length - 1].value;
};

const oscillationValue = (oscillation: Oscillation, frame: number): number => {
  if (frame < oscillation.start || (oscillation.end !== undefined && frame > oscillation.end)) {
    return 0;
  }
  const phase = oscillation.phase ?? 0;
  const elapsed = frame - oscillation.start;
  return (
    oscillation.amplitude *
    Math.sin((elapsed / oscillation.period + phase) * Math.PI * 2)
  );
};

export const motionAt = (
  frame: number,
  tracks: readonly MotionTrack[] | undefined,
  oscillations: readonly Oscillation[] | undefined,
): MotionState => {
  const state: Record<MotionProperty, number> = {...defaults};

  for (const track of tracks ?? []) {
    state[track.property] = valueForTrack(track, frame);
  }

  for (const oscillation of oscillations ?? []) {
    state[oscillation.property] += oscillationValue(oscillation, frame);
  }

  return {
    x: state.x,
    y: state.y,
    scale: Math.max(0, state.scale),
    scaleX: Math.max(0, state.scaleX),
    scaleY: Math.max(0, state.scaleY),
    rotation: state.rotation,
    opacity: Math.min(1, Math.max(0, state.opacity)),
    blur: Math.max(0, state.blur),
    reveal: Math.min(1, Math.max(0, state.reveal)),
  };
};
