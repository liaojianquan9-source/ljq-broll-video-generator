import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  OffthreadVideo,
  interpolate,
  random,
  staticFile,
  useCurrentFrame,
} from 'remotion';
import type {CaseProps} from './schema';

type Keyframe = {frame: number; value: number};
type Track = Keyframe[];
type Appearance = {
  backgroundColor?: string;
  backgroundImage?: string;
  color?: string;
  fill?: string;
  opacity?: number;
  mixBlendMode?: string;
  filter?: string;
  blurPx?: number;
  brightness?: number;
  contrast?: number;
  saturation?: number;
  hueRotateDeg?: number;
  boxShadow?: string;
  textShadow?: string;
  borderRadiusPx?: number;
  borderWidthPx?: number;
  borderColor?: string;
  borderStyle?: string;
  fontFamily?: string;
  fontSizePx?: number;
  fontWeight?: number | string;
  lineHeight?: number | string;
  letterSpacingPx?: number;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  verticalAlign?: 'top' | 'center' | 'bottom';
  whiteSpace?: string;
  overflow?: string;
  objectFit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
  objectPosition?: string;
  clipPath?: string;
  maskImage?: string;
  transformOrigin?: string;
  paddingPx?: number;
  isolation?: string;
};
type LayoutElement = {
  id: string;
  type: 'background' | 'group' | 'text' | 'image' | 'video' | 'shape' | 'line' | 'effect';
  name: string;
  content: string | null;
  asset: string | null;
  bounds: [number, number, number, number];
  anchor: [number, number];
  cropMode: 'viewport-clip' | 'container-mask' | 'asset-crop' | 'none';
  zIndex: number;
  parentId: string | null;
  shape?: 'rectangle' | 'circle' | 'ellipse' | 'line' | 'custom' | null;
  appearance: Appearance;
};
type LayoutSpec = {
  canvas: {width: number; height: number; fps: number; durationInFrames: number; backgroundColor: string};
  elements: LayoutElement[];
};
type Motion = {
  targetId: string;
  easingCandidate?: string;
  transform?: Partial<Record<'x' | 'y' | 'scaleX' | 'scaleY' | 'rotationDeg' | 'opacity' | 'blurPx', Track>>;
  effects?: Partial<Record<'brightness' | 'contrast' | 'saturation' | 'hueRotateDeg', Track>>;
  reveal?: {mode: string; progress: Track; direction?: string};
  textAnimation?: {preset: string; startFrame: number; endFrame: number; seed: number; distancePx?: number; blurPx?: number; staggerFrames: number};
};
type MotionSpec = {motions: Motion[]};
type CaseState = {files: {source: string}; source: {hasAudio: boolean}};
type MotionState = {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotationDeg: number;
  opacity: number;
  blurPx: number;
  brightness: number;
  contrast: number;
  saturation: number;
  hueRotateDeg: number;
  reveal: number;
  revealMode?: string;
  revealDirection?: string;
  textAnimation?: Motion['textAnimation'];
};

const easingFor = (name?: string) => {
  if (name?.includes('back')) return Easing.out(Easing.back(1.35));
  if (name?.includes('in-out')) return Easing.inOut(Easing.cubic);
  if (name?.includes('in')) return Easing.in(Easing.cubic);
  if (name?.includes('out')) return Easing.out(Easing.cubic);
  return Easing.linear;
};

const valueAt = (track: Track | undefined, frame: number, fallback: number, easingName?: string) => {
  if (!track || track.length === 0) return fallback;
  if (track.length === 1 || frame <= track[0].frame) return track[0].value;
  const last = track[track.length - 1];
  if (frame >= last.frame) return last.value;
  for (let index = 0; index < track.length - 1; index += 1) {
    const left = track[index];
    const right = track[index + 1];
    if (frame <= right.frame) {
      return interpolate(frame, [left.frame, right.frame], [left.value, right.value], {
        extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: easingFor(easingName),
      });
    }
  }
  return last.value;
};

const motionAt = (targetId: string, motions: Motion[], frame: number): MotionState => {
  const state: MotionState = {
    x: 0, y: 0, scaleX: 1, scaleY: 1, rotationDeg: 0, opacity: 1, blurPx: 0,
    brightness: 1, contrast: 1, saturation: 1, hueRotateDeg: 0, reveal: 1,
  };
  for (const motion of motions.filter((item) => item.targetId === targetId)) {
    const transform = motion.transform ?? {};
    state.x += valueAt(transform.x, frame, 0, motion.easingCandidate);
    state.y += valueAt(transform.y, frame, 0, motion.easingCandidate);
    state.scaleX *= valueAt(transform.scaleX, frame, 1, motion.easingCandidate);
    state.scaleY *= valueAt(transform.scaleY, frame, 1, motion.easingCandidate);
    state.rotationDeg += valueAt(transform.rotationDeg, frame, 0, motion.easingCandidate);
    state.opacity *= valueAt(transform.opacity, frame, 1, motion.easingCandidate);
    state.blurPx += valueAt(transform.blurPx, frame, 0, motion.easingCandidate);
    const effects = motion.effects ?? {};
    state.brightness *= valueAt(effects.brightness, frame, 1, motion.easingCandidate);
    state.contrast *= valueAt(effects.contrast, frame, 1, motion.easingCandidate);
    state.saturation *= valueAt(effects.saturation, frame, 1, motion.easingCandidate);
    state.hueRotateDeg += valueAt(effects.hueRotateDeg, frame, 0, motion.easingCandidate);
    if (motion.reveal) {
      state.reveal *= valueAt(motion.reveal.progress, frame, 1, motion.easingCandidate);
      state.revealMode = motion.reveal.mode;
      state.revealDirection = motion.reveal.direction;
    }
    if (motion.textAnimation) state.textAnimation = motion.textAnimation;
  }
  return state;
};

const revealClip = (state: MotionState): string | undefined => {
  if (!state.revealMode || state.revealMode === 'fade' || state.revealMode === 'characters') return undefined;
  const hidden = 100 - Math.max(0, Math.min(1, state.reveal)) * 100;
  if (state.revealDirection === 'right-to-left') return `inset(0 0 0 ${hidden}%)`;
  if (state.revealDirection === 'top-to-bottom') return `inset(0 0 ${hidden}% 0)`;
  if (state.revealDirection === 'bottom-to-top') return `inset(${hidden}% 0 0 0)`;
  if (state.revealDirection === 'radial') return `circle(${state.reveal * 72}% at 50% 50%)`;
  return `inset(0 ${hidden}% 0 0)`;
};

const relativeBounds = (element: LayoutElement, parent?: LayoutElement): [number, number, number, number] => {
  if (!parent) return element.bounds;
  const [left, top, width, height] = element.bounds;
  const [parentLeft, parentTop, parentWidth, parentHeight] = parent.bounds;
  return [
    ((left - parentLeft) / parentWidth) * 100,
    ((top - parentTop) / parentHeight) * 100,
    (width / parentWidth) * 100,
    (height / parentHeight) * 100,
  ];
};

const filterFor = (appearance: Appearance, state: MotionState): string | undefined => {
  const parts = [appearance.filter];
  const blur = (appearance.blurPx ?? 0) + state.blurPx;
  if (blur > 0) parts.push(`blur(${blur}px)`);
  parts.push(`brightness(${(appearance.brightness ?? 1) * state.brightness})`);
  parts.push(`contrast(${(appearance.contrast ?? 1) * state.contrast})`);
  parts.push(`saturate(${(appearance.saturation ?? 1) * state.saturation})`);
  const hue = (appearance.hueRotateDeg ?? 0) + state.hueRotateDeg;
  if (hue !== 0) parts.push(`hue-rotate(${hue}deg)`);
  return parts.filter(Boolean).join(' ') || undefined;
};

const mediaSource = (source: string) => /^(https?:|data:|blob:)/.test(source) ? source : staticFile(source);

const textAnimationClip = (animation: MotionState['textAnimation'], frame: number): string | undefined => {
  if (!animation || animation.preset !== 'wipe') return undefined;
  const progress = Math.max(0, Math.min(1, (frame - animation.startFrame) / Math.max(1, animation.endFrame - animation.startFrame)));
  return `inset(0 ${100 - progress * 100}% 0 0)`;
};

const textContent = (content: string, animation: NonNullable<MotionState['textAnimation']>, frame: number, id: string) => {
  const duration = Math.max(1, animation.endFrame - animation.startFrame);
  const progress = Math.max(0, Math.min(1, (frame - animation.startFrame) / duration));
  if (animation.preset === 'typewriter') return content.slice(0, Math.floor(content.length * progress));
  if (animation.preset !== 'scatter-in') return content;
  return [...content].map((character, index) => {
    const localStart = animation.startFrame + index * animation.staggerFrames;
    const local = Math.max(0, Math.min(1, (frame - localStart) / Math.max(1, duration * 0.65)));
    const angle = random(`${animation.seed}-${id}-${index}`) * Math.PI * 2;
    const distance = (animation.distancePx ?? 24) * (1 - local);
    return (
      <span key={`${id}-${index}`} style={{
        display: 'inline-block',
        opacity: local,
        translate: `${Math.cos(angle) * distance}px ${Math.sin(angle) * distance}px`,
        filter: animation.blurPx ? `blur(${animation.blurPx * (1 - local)}px)` : undefined,
      }}>{character === ' ' ? '\u00a0' : character}</span>
    );
  });
};

const ElementNode: React.FC<{
  element: LayoutElement;
  parent?: LayoutElement;
  elements: LayoutElement[];
  motions: Motion[];
  overrides: CaseProps;
}> = ({element, parent, elements, motions, overrides}) => {
  const frame = useCurrentFrame();
  const state = motionAt(element.id, motions, frame);
  const [left, top, width, height] = relativeBounds(element, parent);
  const appearance = element.appearance;
  const opacity = (appearance.opacity ?? 1) * state.opacity * (state.revealMode === 'fade' ? state.reveal : 1);
  const style: React.CSSProperties = {
    position: 'absolute',
    left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%`,
    zIndex: element.zIndex,
    transformOrigin: appearance.transformOrigin ?? `${element.anchor[0] * 100}% ${element.anchor[1] * 100}%`,
    translate: `${state.x}px ${state.y}px`,
    rotate: `${state.rotationDeg}deg`,
    scale: `${Math.max(0, state.scaleX)} ${Math.max(0, state.scaleY)}`,
    opacity,
    filter: filterFor(appearance, state),
    clipPath: textAnimationClip(state.textAnimation, frame) ?? revealClip(state) ?? appearance.clipPath,
    maskImage: appearance.maskImage,
    mixBlendMode: appearance.mixBlendMode as React.CSSProperties['mixBlendMode'],
    isolation: appearance.isolation as React.CSSProperties['isolation'],
    overflow: (appearance.overflow ?? (element.cropMode === 'container-mask' ? 'hidden' : undefined)) as React.CSSProperties['overflow'],
    backgroundColor: appearance.backgroundColor ?? appearance.fill,
    backgroundImage: overrides.theme[element.id] ?? appearance.backgroundImage,
    color: appearance.color,
    borderRadius: element.shape === 'circle' || element.shape === 'ellipse' ? '50%' : appearance.borderRadiusPx,
    borderWidth: appearance.borderWidthPx,
    borderColor: appearance.borderColor,
    borderStyle: appearance.borderStyle as React.CSSProperties['borderStyle'],
    boxShadow: appearance.boxShadow,
    padding: appearance.paddingPx,
  };
  const children = elements.filter((item) => item.parentId === element.id).sort((a, b) => a.zIndex - b.zIndex);
  if (element.type === 'group') {
    return <div data-element-id={element.id} aria-label={element.name} style={style}>{children.map((child) => (
      <ElementNode key={child.id} element={child} parent={element} elements={elements} motions={motions} overrides={overrides} />
    ))}</div>;
  }
  if (element.type === 'text') {
    const content = overrides.content[element.id] ?? element.content ?? '';
    return <div data-element-id={element.id} aria-label={element.name} style={{
      ...style,
      display: 'flex',
      alignItems: appearance.verticalAlign === 'bottom' ? 'flex-end' : appearance.verticalAlign === 'top' ? 'flex-start' : 'center',
      justifyContent: appearance.textAlign === 'right' ? 'flex-end' : appearance.textAlign === 'center' ? 'center' : 'flex-start',
      fontFamily: appearance.fontFamily,
      fontSize: appearance.fontSizePx,
      fontWeight: appearance.fontWeight,
      lineHeight: appearance.lineHeight,
      letterSpacing: appearance.letterSpacingPx,
      textAlign: appearance.textAlign,
      whiteSpace: appearance.whiteSpace as React.CSSProperties['whiteSpace'],
      textShadow: appearance.textShadow,
    }}>{state.textAnimation ? textContent(content, state.textAnimation, frame, element.id) : content}</div>;
  }
  if (element.type === 'image' || element.type === 'video') {
    const source = overrides.assets[element.id] ?? element.asset;
    if (!source) return null;
    const mediaStyle: React.CSSProperties = {
      width: '100%', height: '100%', objectFit: appearance.objectFit ?? 'cover', objectPosition: appearance.objectPosition,
      borderRadius: appearance.borderRadiusPx,
    };
    return <div data-element-id={element.id} aria-label={element.name} style={style}>
      {element.type === 'image' ? <Img src={mediaSource(source)} style={mediaStyle} /> : <OffthreadVideo src={mediaSource(source)} muted style={mediaStyle} />}
    </div>;
  }
  if (element.type === 'line') {
    return <div data-element-id={element.id} aria-label={element.name} style={{...style, height: 0, borderTop: `${appearance.borderWidthPx ?? 2}px ${appearance.borderStyle ?? 'solid'} ${appearance.borderColor ?? appearance.fill ?? '#fff'}`}} />;
  }
  return <div data-element-id={element.id} aria-label={element.name} style={style} />;
};

const sceneStyle = (state: MotionState): React.CSSProperties => ({
  translate: `${state.x}px ${state.y}px`,
  rotate: `${state.rotationDeg}deg`,
  scale: `${Math.max(0, state.scaleX)} ${Math.max(0, state.scaleY)}`,
  opacity: state.opacity * (state.revealMode === 'fade' ? state.reveal : 1),
  filter: `blur(${state.blurPx}px) brightness(${state.brightness}) contrast(${state.contrast}) saturate(${state.saturation}) hue-rotate(${state.hueRotateDeg}deg)`,
  clipPath: revealClip(state),
});

export const CaseFromSpec: React.FC<{
  caseState: CaseState;
  layout: LayoutSpec;
  motion: MotionSpec;
  overrides: CaseProps;
}> = ({caseState, layout, motion, overrides}) => {
  const frame = useCurrentFrame();
  const camera = motionAt('@camera', motion.motions, frame);
  const scene = motionAt('@scene', motion.motions, frame);
  const transition = motionAt('@transition', motion.motions, frame);
  const rootElements = layout.elements.filter((item) => item.parentId === null).sort((a, b) => a.zIndex - b.zIndex);
  return <AbsoluteFill style={{backgroundColor: overrides.theme.background ?? layout.canvas.backgroundColor, overflow: 'hidden'}}>
    <AbsoluteFill style={sceneStyle(transition)}>
      <AbsoluteFill style={sceneStyle(scene)}>
        <AbsoluteFill style={sceneStyle(camera)}>
          {rootElements.map((element) => <ElementNode key={element.id} element={element} elements={layout.elements} motions={motion.motions} overrides={overrides} />)}
        </AbsoluteFill>
      </AbsoluteFill>
    </AbsoluteFill>
    {caseState.source.hasAudio ? <Audio src={staticFile(caseState.files.source)} /> : null}
  </AbsoluteFill>;
};
