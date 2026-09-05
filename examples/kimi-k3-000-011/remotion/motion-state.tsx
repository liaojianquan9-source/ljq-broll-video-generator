import React, {createContext, useContext} from 'react';
import {Easing, useCurrentFrame} from 'remotion';
import contract from '../specs/motion.json';

export const MotionEnabled = createContext(true);
type Track = {keyframes: {frame: number; value: number}[]; interpolation: string; bezier?: number[]};
export const at = (track: Track | undefined, frame: number, fallback: number): number => {
  if (!track) return fallback;
  const keys = track.keyframes;
  if (frame <= keys[0].frame) return keys[0].value;
  if (frame >= keys[keys.length - 1].frame) return keys[keys.length - 1].value;
  const i = keys.findIndex(k => k.frame > frame);
  const a = keys[i - 1], b = keys[i];
  let t = (frame - a.frame) / (b.frame - a.frame);
  if (track.interpolation === 'bezier' && track.bezier) t = Easing.bezier(...track.bezier as [number, number, number, number])(t);
  return a.value + (b.value - a.value) * t;
};

export const useElementMotion = (targetId: string, scope?: string) => {
  const frame = useCurrentFrame();
  const enabled = useContext(MotionEnabled);
  const motions = enabled ? (contract.motions as any[]).filter(m => m.targetId === targetId && (!scope || m.id.startsWith(scope))) : [];
  let x = 0, y = 0, scaleX = 1, scaleY = 1, rotation = 0, opacity = 1, blur = 0, brightness = 1;
  let clipPath: string | undefined;
  for (const m of motions) {
    const t = m.transform || {};
    x += at(t.x, frame, 0); y += at(t.y, frame, 0);
    scaleX *= at(t.scaleX, frame, 1); scaleY *= at(t.scaleY, frame, 1);
    rotation += at(t.rotationDeg, frame, 0);
    opacity *= at(t.opacity, frame, 1); blur += at(t.blurPx, frame, 0);
    brightness *= at(m.effects?.brightness, frame, 1);
    if (m.phase === 'entrance' && frame < m.firstVisible) opacity = 0;
    if (m.reveal) {
      const p = at(m.reveal.progress, frame, 1);
      if (m.reveal.mode === 'fade') opacity *= p;
      else if (m.reveal.direction === 'left-to-right') clipPath = `inset(-100% ${(1 - p) * 100}% -100% -20%)`;
    }
  }
  return {opacity, blur, brightness, style: {
    transform: `translate(${x}px,${y}px) scale(${scaleX},${scaleY}) rotate(${rotation}deg)`,
    transformOrigin: '50% 50%', opacity, clipPath,
  } as React.CSSProperties};
};

export const MotionGroup: React.FC<React.PropsWithChildren<{id: string; scope?: string}>> = ({id, scope, children}) => {
  const m = useElementMotion(id, scope);
  return <div data-motion-group={id} style={{position: 'absolute', inset: 0, ...m.style,
    filter: m.blur ? `blur(${m.blur}px)` : undefined}}>{children}</div>;
};

export const useTextMotion = (id: string, count: number) => {
  const frame = useCurrentFrame();
  const enabled = useContext(MotionEnabled);
  const entry = enabled && (contract.motions as any[]).find(m => m.targetId === id && m.textAnimation);
  if (!entry || frame >= entry.textAnimation.endFrame) return null;
  const t = entry.textAnimation;
  const stagger = Math.min(t.staggerFrames, Math.max(0, (t.endFrame - t.startFrame - 4) / Math.max(1, count - 1)));
  const duration = Math.max(4, t.endFrame - t.startFrame - (count - 1) * stagger);
  return Array.from({length: count}, (_, i) => {
    const raw = Math.max(0, Math.min(1, (frame - t.startFrame - i * stagger) / duration));
    const p = 1 - Math.pow(1 - raw, id === 'parameter-main-number' ? 2.5 : 3);
    const before = frame < t.startFrame + i * stagger;
    if (t.preset === 'typewriter') return {opacity: before ? 0 : 1, y: 0, scaleY: 1, blur: 0, progress: before ? 0 : 1};
    // A stretched live glyph is not a detached ghost. The source does not
    // establish repeated numeral copies, so ghostOpacity=0 in the contract.
    const numeral = id === 'parameter-main-number';
    return {opacity: numeral ? 0.4 + 0.6 * p : before ? 0 : Math.min(1, raw * 4),
      y: (t.distancePx || 0) * (1 - p) * (t.direction === 'top-to-bottom' ? -1 : 1),
      scaleY: 1 + ((t.stretchY || 1) - 1) * (1 - p),
      blur: (t.blurPx || 0) * (1 - p), progress: p};
  });
};

export const useWhiteGlyphReveal = (id: string) => {
  const frame = useCurrentFrame();
  const enabled = useContext(MotionEnabled);
  if (!enabled || !['kimi-title', 'k3-title'].includes(id)) return 0;
  const m = (contract.motions as any[]).find(m => m.id === 'space-white-through-live-glyphs');
  return m ? at(m.reveal.progress, frame, 0) : 0;
};
